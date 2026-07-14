import type { SourceConfig } from '../config/scrape-sources';
import type {
  ScrapePipelineResult,
  RawCourseRow,
  RawUniversityRow,
  RawFeeRow,
  RawScholarshipRow,
  RejectedPageRow,
  ScrapeRunOptions,
} from '../extractors/types';
import { scrapeLogger } from '../logger';
import { getPlaywrightBrowser, capturePageWithPlaywright } from '../scrapers/playwright.util';
import type { Page } from 'playwright';

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

/** Simple vanilla implementation of p-limit concurrency wrapper */
async function runWithLimit(concurrency: number, tasks: (() => Promise<void>)[]) {
  const executing: Promise<any>[] = [];
  for (const task of tasks) {
    const p = task();
    executing.push(p);
    p.then(() => executing.splice(executing.indexOf(p), 1));
    if (executing.length >= concurrency) {
      await Promise.race(executing);
    }
  }
  await Promise.all(executing);
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

  while (listingQueue.length > 0 && visitedListings.size < config.maxPages) {
    const url = listingQueue.shift()!;
    if (visitedListings.has(url)) continue;
    visitedListings.add(url);

    try {
      const pageResult = await capturePageWithPlaywright(url, {
        source: config.source,
        saveArtifacts: true,
      });
      pagesVisited++;
      apiResponseCount += pageResult.apiResponses.length;

      // Extract __NEXT_DATA__
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
                scrapeLogger.info('University discovered', { name: uniName, url: targetUrl });
              }
            }
          }
        } catch (err) {
          scrapeLogger.warn('Failed to parse __NEXT_DATA__ from listing page', { url, error: String(err) });
        }
      }

      // Pagination detection
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
  const unisToScrape = Array.from(discoveredUnisMap.values()).slice(0, config.maxDetailPages);
  scrapeLogger.info('Starting details extraction phase', { totalToScrape: unisToScrape.length });

  const browser = await getPlaywrightBrowser();

  const scrapeUniTask = (uniSeed: { name: string; country: string; url: string }) => async () => {
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

        // 1. Overview & JSON extraction
        await page.goto(uniSeed.url, { waitUntil: 'load', timeout: 60000 });
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

        universities.push({
          universityName: uniName,
          country,
          city,
          ranking,
          overview: overview ? overview.slice(0, 5000) : '',
          websiteUrl: (details.universityUrl || details.url || '').slice(0, 250),
          sourceUrl: uniSeed.url.slice(0, 250),
          pageText: html.slice(0, 15000),
        });

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
        const scholarshipsList = details.scholarshipsAvailable?.data || details.scholarshipsAvailable || [];
        if (Array.isArray(scholarshipsList)) {
          for (const item of scholarshipsList) {
            scholarships.push({
              scholarshipName: (item.title || item.name || 'Scholarship').trim().slice(0, 250),
              universityName: uniName,
              country,
              amount: (item.amount || '').trim().slice(0, 250),
              eligibility: item.eligibility || '',
              deadline: (item.deadline || '').trim().slice(0, 120),
              description: item.description || '',
              sourceUrl: uniSeed.url.slice(0, 250),
            });
          }
          if (scholarshipsList.length > 0) {
            scrapeLogger.info('Scholarships extracted', { name: uniName, count: scholarshipsList.length });
          }
        }

        // 2. Courses Tab clicking & DOM parsing
        const coursesUrl = `${uniSeed.url}?section=courses`;
        await page.goto(coursesUrl, { waitUntil: 'load', timeout: 60000 });
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
        }  await extractCourses('Bachelors');

        scrapeLogger.info('Courses extracted', { name: uniName, count: courses.length });
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

  // Run detail tasks concurrently (max 5 concurrent tasks)
  const detailTasks = unisToScrape.map(uni => scrapeUniTask(uni));
  await runWithLimit(5, detailTasks);

  scrapeLogger.info('Studies Overseas scraper pipeline completed', {
    source: config.source,
    pagesVisited,
    coursesCount: courses.length,
    unisCount: universities.length,
    feesCount: fees.length,
    scholarshipsCount: scholarships.length,
    rejectedPagesCount: rejectedPages.length,
  });

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
