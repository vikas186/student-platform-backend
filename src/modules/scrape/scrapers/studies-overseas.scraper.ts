import type { SourceConfig } from '../config/scrape-sources';
import { SCRAPE_TIMEOUT_MS } from '../config/scrape.constants';
import type {
  ScrapePipelineResult,
  RawCourseRow,
  RawUniversityRow,
  RawFeeRow,
  RawScholarshipRow,
  RejectedPageRow,
  ScrapeRunOptions,
} from '../extractors/types';
import {
  loadScrapeCheckpoint,
  saveScrapeCheckpoint,
} from '../debug/scrape-checkpoint.util';
import { scrapeLogger } from '../logger';
import { getPlaywrightBrowser, capturePageWithPlaywright } from '../scrapers/playwright.util';
import type { Page } from 'playwright';

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

/**
 * Prefer domcontentloaded (avoids hanging on ads/analytics that block `load`).
 * Falls back once if the first navigation still times out.
 */
async function gotoResilient(page: Page, url: string): Promise<void> {
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: SCRAPE_TIMEOUT_MS });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!/timeout|Timeout/i.test(msg)) throw err;
    scrapeLogger.warn('Navigation timeout — retrying with commit', { url, timeoutMs: SCRAPE_TIMEOUT_MS });
    await page.goto(url, { waitUntil: 'commit', timeout: SCRAPE_TIMEOUT_MS });
    await page.waitForLoadState('domcontentloaded', { timeout: SCRAPE_TIMEOUT_MS }).catch(() => {});
  }
}

/** Simple vanilla implementation of p-limit concurrency wrapper */
async function runWithLimit(
  concurrency: number,
  tasks: (() => Promise<void>)[],
  shouldStop?: () => boolean | Promise<boolean>,
) {
  const executing: Promise<any>[] = [];
  for (const task of tasks) {
    if (shouldStop && (await shouldStop())) break;
    const p = task();
    executing.push(p);
    p.then(() => executing.splice(executing.indexOf(p), 1));
    if (executing.length >= concurrency) {
      await Promise.race(executing);
    }
  }
  await Promise.all(executing);
}

type UniSeed = { name: string; country: string; url: string };

/**
 * Pick up to `limit` universities with round-robin across countries so USA-first
 * catalog order does not exclude other destinations.
 */
function sampleUniversitiesAcrossCountries(unis: UniSeed[], limit: number): UniSeed[] {
  if (limit <= 0 || unis.length <= limit) return unis;

  const byCountry = new Map<string, UniSeed[]>();
  for (const uni of unis) {
    const key = (uni.country || 'Unknown').trim() || 'Unknown';
    const list = byCountry.get(key);
    if (list) list.push(uni);
    else byCountry.set(key, [uni]);
  }

  const countryQueues = [...byCountry.values()];
  const selected: UniSeed[] = [];
  let round = 0;

  while (selected.length < limit) {
    let addedThisRound = false;
    for (const queue of countryQueues) {
      if (selected.length >= limit) break;
      if (round < queue.length) {
        selected.push(queue[round]);
        addedThisRound = true;
      }
    }
    if (!addedThisRound) break;
    round++;
  }

  return selected;
}

/** Standardized slugification fallback */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export const scrapeStudiesOverseas = async (
  config: SourceConfig,
  options?: ScrapeRunOptions,
): Promise<ScrapePipelineResult> => {
  scrapeLogger.info('Studies Overseas scraper pipeline started', { source: config.source });

  const courses: RawCourseRow[] = [];
  const universities: RawUniversityRow[] = [];
  const scholarships: RawScholarshipRow[] = [];
  const fees: RawFeeRow[] = [];
  const rejectedPages: RejectedPageRow[] = [];
  let pagesVisited = 0;
  let apiResponseCount = 0;
  const completedUrls = new Set<string>();
  let checkpointChain: Promise<void> = Promise.resolve();

  const persistCheckpoint = () => {
    if (!options?.jobId) return;
    const snapshot = {
      completedUrls: [...completedUrls],
      pagesVisited,
      apiResponseCount,
      courses: [...courses],
      universities: [...universities],
      fees: [...fees],
      scholarships: [...scholarships],
      rejectedPages: [...rejectedPages],
    };
    checkpointChain = checkpointChain
      .then(() => saveScrapeCheckpoint(options.jobId!, config.source, snapshot))
      .catch(err => {
        scrapeLogger.warn('Failed to save scrape checkpoint', {
          jobId: options.jobId,
          error: err instanceof Error ? err.message : String(err),
        });
      });
  };

  const reportProgress = async (progress: {
    totalPages?: number;
    coursesFound?: number;
    universitiesFound?: number;
    feesFound?: number;
    scholarshipsFound?: number;
    rejectedPages?: number;
    currentPage?: number;
    currentUrl?: string;
  }) => {
    if (options?.onProgress) {
      await Promise.resolve(options.onProgress(progress));
    }
  };

  // ----------------------------------------------------
  // LISTING CRAWL PHASE (Step 2 & 3)
  // ----------------------------------------------------
  scrapeLogger.info('Listing page started', { url: config.baseUrl });

  const listingQueue: string[] = [config.baseUrl];
  const visitedListings = new Set<string>();
  const discoveredUnisMap = new Map<string, { name: string; country: string; url: string }>();

  while (
    listingQueue.length > 0 &&
    (config.maxPages <= 0 || visitedListings.size < config.maxPages)
  ) {
    const url = listingQueue.shift()!;
    if (visitedListings.has(url)) continue;
    visitedListings.add(url);

    try {
      const pageResult = await capturePageWithPlaywright(url, {
        source: config.source,
        // Listing HTML is large; skip screenshots so we reach detail pages faster.
        saveArtifacts: false,
      });
      pagesVisited++;
      apiResponseCount += pageResult.apiResponses.length;

      let discoveredFromNextData = 0;

      // Extract __NEXT_DATA__ — homepage embeds the full country→university catalog.
      const nextDataMatch = pageResult.html?.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
      if (nextDataMatch) {
        try {
          const data = JSON.parse(nextDataMatch[1]);
          const countriesList = data.props?.pageProps?.universityCountries || [];

          for (const country of countriesList) {
            const countryName = country.label || 'Unknown';
            const countrySlug = slugify(countryName);
            const countryUnis = country.universities || [];

            // Extract schema URL maps if available
            const urlMap = new Map<string, string>();
            const schemaItems = country.meta?.schemaJson?.['@graph']?.[0]?.itemListElement || [];
            for (const item of schemaItems) {
              if (item.url && item.name) {
                urlMap.set(item.name.toLowerCase(), item.url);
              }
            }

            for (const uni of countryUnis) {
              if (!uni || !uni.name) continue;
              const uniName = uni.name.trim();
              const uniNameLower = uniName.toLowerCase();
              let targetUrl = '';

              // Find in schema map
              for (const [sName, sUrl] of urlMap.entries()) {
                if (sName.includes(uniNameLower) || uniNameLower.includes(sName.split(',')[0].trim())) {
                  targetUrl = sUrl;
                  break;
                }
              }

              if (!targetUrl) {
                const uniSlug = slugify(uniName.split(',')[0]);
                targetUrl = `https://www.studies-overseas.com/universities/${countrySlug}/${uniSlug}`;
              }

              if (!discoveredUnisMap.has(targetUrl)) {
                discoveredUnisMap.set(targetUrl, {
                  name: uniName,
                  country: countryName,
                  url: targetUrl,
                });
                discoveredFromNextData++;
                scrapeLogger.info('University discovered', { name: uniName, url: targetUrl });
              }
            }
          }
        } catch (err) {
          scrapeLogger.warn('Failed to parse __NEXT_DATA__ from listing page', { url, error: String(err) });
        }
      }

      // Only paginate when NEXT_DATA did not yield the catalog (fallback).
      // The first listing page already contains all ~672 universities.
      if (discoveredUnisMap.size === 0) {
        const regex = /href="(\/universities\/page-\d+)"/g;
        let match;
        if (pageResult.html) {
          while ((match = regex.exec(pageResult.html)) !== null) {
            const absoluteLink = `https://www.studies-overseas.com${match[1]}`;
            if (!visitedListings.has(absoluteLink) && !listingQueue.includes(absoluteLink)) {
              listingQueue.push(absoluteLink);
            }
          }
        }
      } else {
        listingQueue.length = 0;
        scrapeLogger.info('Full catalog from __NEXT_DATA__; skipping listing pagination', {
          totalDiscovered: discoveredUnisMap.size,
          newlyDiscovered: discoveredFromNextData,
        });
      }

      scrapeLogger.info('Listing page completed', { url, totalDiscovered: discoveredUnisMap.size });
      await reportProgress({
        currentPage: pagesVisited,
        currentUrl: url,
        universitiesFound: discoveredUnisMap.size,
      });

    } catch (err) {
      scrapeLogger.error('Failed to scrape listing page', { url, error: String(err) });
      rejectedPages.push({
        url,
        classification: 'course_listing',
        reason: err instanceof Error ? err.message : 'listing page capture failed',
      });
    }
  }

  // ----------------------------------------------------
  // UNIVERSITY DETAIL PAGES CRAWL PHASE (Step 4 onwards)
  // ----------------------------------------------------
  const detailOffset = Math.max(0, Number((config as { detailOffset?: number }).detailOffset) || 0);
  const allDiscovered = Array.from(discoveredUnisMap.values()).slice(detailOffset);
  // maxDetailPages <= 0 means unlimited; otherwise sample evenly across countries.
  let unisToScrape =
    config.maxDetailPages > 0
      ? sampleUniversitiesAcrossCountries(allDiscovered, config.maxDetailPages)
      : allDiscovered;

  if (options?.jobId) {
    const checkpoint = await loadScrapeCheckpoint(options.jobId);
    if (checkpoint) {
      for (const u of checkpoint.completedUrls || []) completedUrls.add(u);
      courses.push(...(checkpoint.courses || []));
      universities.push(...(checkpoint.universities || []));
      fees.push(...(checkpoint.fees || []));
      scholarships.push(...(checkpoint.scholarships || []));
      rejectedPages.push(...(checkpoint.rejectedPages || []));
      pagesVisited = Math.max(pagesVisited, checkpoint.pagesVisited || 0);
      apiResponseCount = Math.max(apiResponseCount, checkpoint.apiResponseCount || 0);
      const before = unisToScrape.length;
      unisToScrape = unisToScrape.filter(u => !completedUrls.has(u.url));
      scrapeLogger.info('Resuming Studies Overseas from checkpoint', {
        jobId: options.jobId,
        alreadyDone: completedUrls.size,
        remaining: unisToScrape.length,
        skipped: before - unisToScrape.length,
      });
      await reportProgress({
        coursesFound: courses.length,
        universitiesFound: universities.length,
        feesFound: fees.length,
        scholarshipsFound: scholarships.length,
        rejectedPages: rejectedPages.length,
      });
    }
  }

  const countryCounts = new Map<string, number>();
  for (const uni of unisToScrape) {
    const key = uni.country || 'Unknown';
    countryCounts.set(key, (countryCounts.get(key) || 0) + 1);
  }
  scrapeLogger.info('Starting details extraction phase', {
    totalToScrape: unisToScrape.length,
    alreadyCompleted: completedUrls.size,
    detailOffset,
    catalogSize: allDiscovered.length + detailOffset,
    unlimited: !(config.maxDetailPages > 0),
    countries: countryCounts.size,
    perCountry: Object.fromEntries(countryCounts),
  });

  if (unisToScrape.length === 0) {
    await checkpointChain;
    return {
      courses,
      universities,
      fees,
      scholarships,
      rejectedPages,
      pagesVisited,
      apiResponseCount,
    };
  }

  const browser = await getPlaywrightBrowser();

  const scrapeUniTask = (uniSeed: UniSeed) => async () => {
    scrapeLogger.info('University scraping started', { name: uniSeed.name, url: uniSeed.url });

    let attemptSuccess = false;
    let errorMsg = '';

    for (let attempt = 1; attempt <= 3; attempt++) {
      let page: Page | null = null;
      try {
        page = await browser.newPage({
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          viewport: { width: 1280, height: 900 },
        });
        page.setDefaultTimeout(SCRAPE_TIMEOUT_MS);
        page.setDefaultNavigationTimeout(SCRAPE_TIMEOUT_MS);

        // 1. Overview & JSON extraction
        await gotoResilient(page, uniSeed.url);
        await page.evaluate(() => {
          const style = document.createElement('style');
          style.innerHTML = '.poptin-popup-background, [id*="poptin"], [class*="poptin"], .modal-backdrop { display: none !important; pointer-events: none !important; }';
          document.head.appendChild(style);
        }).catch(() => {});
        await page.waitForTimeout(2000);
        pagesVisited++;

        const html = await page.content();
        const nextDataMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);

        if (!nextDataMatch) {
          throw new Error('__NEXT_DATA__ not found in detail page');
        }

        const data = JSON.parse(nextDataMatch[1]);
        const pageProps = data.props?.pageProps || {};
        const detailsRaw = pageProps.universityDetails || {};
        const details = Array.isArray(detailsRaw) ? detailsRaw[0] : detailsRaw;

        if (!details) {
          throw new Error('University details object empty in props');
        }

        // Map University Details
        const uniName = (details.name || details.universityName || uniSeed.name).trim().slice(0, 250);
        const country = (details.country || uniSeed.country || '').trim().slice(0, 120);
        
        let city = '';
        let campus = '';
        if (details.location) {
          const parts = details.location.split(',').map((p: string) => p.trim());
          city = (parts[0] || '').slice(0, 120);
          campus = (parts[1] || '').slice(0, 120);
        }

        let ranking = '';
        if (details.rankingSection) {
          ranking = String(details.rankingSection.title || details.rankingSection.description || '').trim().slice(0, 120);
        }

        const overview = details.description || (details.overviewSection ? details.overviewSection.description : '');
        const images: string[] = [];
        if (details.universityBannerImage) {
          images.push(details.universityBannerImage);
        }
        if (details.universityLogo) {
          images.push(details.universityLogo);
        }

        // Extract intakes, cost, scholarships, requirements, and criteria
        let intakes = '';
        if (details.intakeSection && Array.isArray(details.intakeSection.intakeDetail)) {
          intakes = details.intakeSection.intakeDetail
            .map((item: any) => (item.intake || '').trim())
            .filter(Boolean)
            .join(', ');
        }

        let costOfStudy = '';
        if (details.costToStudySection) {
          costOfStudy = (details.costToStudySection.description || '')
            .replace(/<[^>]*>/g, '')
            .replace(/&nbsp;/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        }

        let scholarshipsText = '';
        const rawScholarshipsList = details.scholarshipsAvailable?.scholarshipsCard || details.scholarshipsAvailable?.data || details.scholarshipsAvailable || [];
        const finalScholarshipsList = Array.isArray(rawScholarshipsList) ? rawScholarshipsList : [];
        if (finalScholarshipsList.length > 0) {
          scholarshipsText = finalScholarshipsList
            .map((item: any) => {
              const name = (item.name || item.title || '').trim();
              const detailsList = Array.isArray(item.detail) ? item.detail.join(', ') : '';
              return name + (detailsList ? ` (${detailsList})` : '');
            })
            .filter(Boolean)
            .join('; ');
        }

        let admissionRequirements = '';
        if (Array.isArray(details.admissionRequirementDetail)) {
          admissionRequirements = details.admissionRequirementDetail
            .map((item: any) => {
              const level = (item.name || '').trim();
              const cards = Array.isArray(item.requirementCard)
                ? item.requirementCard
                    .map((card: any) => {
                      const title = (card.title || '').trim();
                      const details = (card.cardDetails || '')
                        .replace(/<[^>]*>/g, '')
                        .replace(/&nbsp;/g, ' ')
                        .replace(/\s+/g, ' ')
                        .trim();
                      return `${title}: ${details}`;
                    })
                    .filter(Boolean)
                    .join(' | ')
                : '';
              return `${level} -> ${cards}`;
            })
            .filter(Boolean)
            .join('\n');
        }

        let acceptanceCriteria = '';
        if (details.admissionRequirementSection) {
          acceptanceCriteria = (details.admissionRequirementSection.description || '')
            .replace(/<[^>]*>/g, '')
            .replace(/&nbsp;/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        }

        const uniRow: any = {
          universityName: uniName,
          country,
          city,
          ranking,
          overview: overview ? overview.slice(0, 5000) : '',
          websiteUrl: (details.universityUrl || details.url || '').slice(0, 250),
          sourceUrl: uniSeed.url.slice(0, 250),
          logoUrl: details.universityLogo ? String(details.universityLogo).slice(0, 2048) : null,
          pageText: html.slice(0, 15000),
          intakes,
          costOfStudy,
          scholarships: scholarshipsText,
          admissionRequirements,
          acceptanceCriteria,
        };

        // Map Cost to Study (Fees)
        if (details.costToStudySection) {
          fees.push({
            country,
            studyLevel: 'Undergraduate & Postgraduate',
            tuitionFee: (details.costToStudySection.title || '').trim().slice(0, 250),
            livingCost: '',
            accommodationCost: '',
            currency: 'GBP',
            description: details.costToStudySection.description || '',
            sourceUrl: uniSeed.url.slice(0, 250),
          });
          scrapeLogger.info('Cost extracted', { name: uniName });
        }

        // Map Scholarships
        if (finalScholarshipsList.length > 0) {
          for (const item of finalScholarshipsList) {
            scholarships.push({
              scholarshipName: (item.title || item.name || 'Scholarship').trim().slice(0, 250),
              universityName: uniName,
              country,
              amount: (item.amount || (Array.isArray(item.detail) ? item.detail.find((d: string) => d.toLowerCase().includes('value')) : '') || '').trim().slice(0, 250),
              eligibility: item.eligibility || (Array.isArray(item.detail) ? item.detail.join(', ') : ''),
              deadline: (item.deadline || '').trim().slice(0, 120),
              description: item.description || '',
              sourceUrl: uniSeed.url.slice(0, 250),
            });
          }
          scrapeLogger.info('Scholarships extracted', { name: uniName, count: finalScholarshipsList.length });
        }

        // 2. Courses Tab clicking & DOM parsing
        const coursesStartIdx = courses.length;
        const coursesUrl = `${uniSeed.url}?section=courses`;
        await gotoResilient(page, coursesUrl);
        await page.evaluate(() => {
          const style = document.createElement('style');
          style.innerHTML = '.poptin-popup-background, [id*="poptin"], [class*="poptin"], .modal-backdrop { display: none !important; pointer-events: none !important; }';
          document.head.appendChild(style);
        }).catch(() => {});
        await page.waitForTimeout(3000);
        pagesVisited++;
 
        const coursesTab = page.locator('text=Courses').first();
        if (await coursesTab.isVisible()) {
          await coursesTab.click({ force: true });
          await page.waitForTimeout(2000);
        }
 
        // Click cookie banners
        try {
          const acceptBtn = page.locator('button:has-text("Accept")').first();
          if (await acceptBtn.isVisible({ timeout: 500 })) {
            await acceptBtn.click();
          }
        } catch {
          // ignore
        }
 
        const extractCourses = async (mode: string) => {
          const cards = await page!.$$('div[class*="UniversityDetail_cardBody"]');
          for (const card of cards) {
            const nameEl = await card.$('div[class*="UniversityDetail_title"] h3');
            const courseName = nameEl ? await nameEl.innerText() : '';
            if (!courseName) continue;
 
            let tuitionFee = '';
            let duration = '';
 
            const feeEl = await card.$('div[class*="UniversityDetail_courseInformation"] div:first-child h4');
            if (feeEl) tuitionFee = await feeEl.innerText();
 
            const durEl = await card.$('div[class*="UniversityDetail_courseInformation"] div:nth-child(2) h4');
            if (durEl) duration = await durEl.innerText();
 
             const slugify = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
             const uniqueCourseUrl = `${coursesUrl}#${slugify(courseName)}`;
 
             courses.push({
              universityName: uniName.slice(0, 250),
              courseName: courseName.trim().slice(0, 250),
              country: country.slice(0, 120),
              city: city.slice(0, 120),
              studyLevel: mode.slice(0, 120),
              duration: duration.trim().slice(0, 120),
              tuitionFee: tuitionFee.trim().slice(0, 250),
              courseUrl: uniqueCourseUrl.slice(0, 250),
              pageText: uniSeed.name,
            });
          }
        };
 
        // Extract Masters
        const mastersTab = page.locator('text=Masters').first();
        if (await mastersTab.isVisible()) {
          await mastersTab.click({ force: true });
          await page.waitForTimeout(1500);
        }
        await extractCourses('Masters');
 
        // Extract Bachelors
        const bachelorsTab = page.locator('text=Bachelors').first();
        if (await bachelorsTab.isVisible()) {
          await bachelorsTab.click({ force: true });
          await page.waitForTimeout(1500);
        }
        await extractCourses('Bachelors');
 
        const universityCoursesList = courses.slice(coursesStartIdx);
        uniRow.courses = universityCoursesList.map(c => c.courseName).join(', ');
        universities.push(uniRow);
        completedUrls.add(uniSeed.url);
        persistCheckpoint();

        scrapeLogger.info('Courses extracted', { name: uniName, count: universityCoursesList.length });
        scrapeLogger.info('University completed', { name: uniName });
 
        attemptSuccess = true;
        break; // break retry loop

      } catch (err) {
        errorMsg = err instanceof Error ? err.message : String(err);
        scrapeLogger.warn(`Attempt ${attempt} failed for university ${uniSeed.name}`, { error: errorMsg });
        
        // Take debug screenshot / html on failure
        if (page) {
          try {
            const { saveDebugHtml, saveDebugScreenshot } = await import('../debug/scrape-debug.util');
            await saveDebugScreenshot(page, `fail-${slugify(uniSeed.name)}`, config.source);
            await saveDebugHtml(page, `fail-${slugify(uniSeed.name)}`, config.source);
          } catch {
            // ignore
          }
        }
      } finally {
        if (page) await page.close();
      }
    }

    if (!attemptSuccess) {
      scrapeLogger.error('University details extraction failed completely after 3 retries', {
        name: uniSeed.name,
        url: uniSeed.url,
        error: errorMsg,
      });
      rejectedPages.push({
        url: uniSeed.url,
        classification: 'university',
        reason: `Failed after 3 retries: ${errorMsg}`,
      });
    }

    await reportProgress({
      currentPage: pagesVisited,
      currentUrl: uniSeed.url,
      coursesFound: courses.length,
      universitiesFound: universities.length,
      feesFound: fees.length,
      scholarshipsFound: scholarships.length,
      rejectedPages: rejectedPages.length,
    });
  };

  // Run detail tasks concurrently (max 5 concurrent tasks).
  // shouldStop skips remaining universities and keeps already-fetched data for cleaning.
  const detailTasks = unisToScrape.map(uni => scrapeUniTask(uni));
  await runWithLimit(5, detailTasks, options?.shouldStop);
  await checkpointChain;

  if (options?.shouldStop && (await options.shouldStop())) {
    scrapeLogger.info('Studies Overseas scrape stopped early — returning partial results for cleaning', {
      source: config.source,
      pagesVisited,
      coursesCount: courses.length,
      unisCount: universities.length,
      feesCount: fees.length,
      scholarshipsCount: scholarships.length,
    });
  } else {
    scrapeLogger.info('Studies Overseas scraper pipeline completed', {
      source: config.source,
      pagesVisited,
      coursesCount: courses.length,
      unisCount: universities.length,
      feesCount: fees.length,
      scholarshipsCount: scholarships.length,
      rejectedPagesCount: rejectedPages.length,
    });
  }

  return {
    courses,
    universities,
    fees,
    scholarships,
    rejectedPages,
    pagesVisited,
    apiResponseCount,
  };
};
