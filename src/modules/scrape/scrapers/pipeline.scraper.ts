import { SCRAPE_DELAY_MS, randomScrapeDelay } from '../config/scrape.constants';
import type { SourceConfig } from '../config/scrape-sources';
import { classifyPage } from '../classifier/page.classifier';
import { extractFee } from '../extractors/fee.extractor';
import { scrapeCourse } from './course.scraper';
import { scrapeUniversity } from './university.scraper';
import { scrapeScholarship } from './scholarship.scraper';
import type {
  ScrapePipelineResult,
  PageCapture,
  RejectedPageRow,
  ScrapeProgress,
  ScrapeRunOptions,
  ClassificationResult,
  PageType,
} from '../extractors/types';
import { scrapeLogger } from '../logger';
import { isAllowedByRobots } from '../scrapers/robots.util';
import { capturePageWithPlaywright } from '../scrapers/playwright.util';
import { isSameSite } from '../scrapers/base.scraper';
import {
  enqueueAECCCoursePagination,
  extractAECCCourses,
} from './aecc/aecc-course.extractor';
import { extractAECCScholarships } from './aecc/aecc-scholarship.extractor';

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
const yieldEventLoop = (): Promise<void> => new Promise(r => setImmediate(r));

const emptyScores = (): Record<PageType, number> => ({
  course: 0,
  course_listing: 0,
  university: 0,
  fee: 0,
  scholarship: 0,
  reject: 0,
});

/** AECC URL rules run before generic heuristics. */
export const classifyPageForPipeline = (
  url: string,
  title: string,
  content: string,
  source: string,
): ClassificationResult => {
  if (source === 'AECC') {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return classifyPage(url, title, content);
    }

    const host = parsed.hostname.toLowerCase();
    const path = parsed.pathname.toLowerCase();

    if (host === 'www.aeccglobal.com' || host === 'aeccglobal.com') {
      if (path === '/in' || path === '/in/') {
        return { type: 'reject', scores: emptyScores(), reason: 'AECC marketing homepage' };
      }
    }

    if (host.includes('search.aeccglobal.com')) {
      if (/^\/courses?\/[^/?#]+/.test(path)) {
        return { type: 'course', scores: { ...emptyScores(), course: 100 } };
      }
      if (path === '/courses' || path === '/courses/') {
        return { type: 'course_listing', scores: { ...emptyScores(), course_listing: 100 } };
      }
      if (path === '/universities' || path === '/universities/') {
        return { type: 'university', scores: { ...emptyScores(), university: 100 } };
      }
      if (/^\/universities\/[^/?#]+/.test(path)) {
        return { type: 'university', scores: { ...emptyScores(), university: 100 } };
      }
      if (/^\/scholarship(?:\/|$)/.test(path)) {
        return { type: 'scholarship', scores: { ...emptyScores(), scholarship: 100 } };
      }
    }
  }

  return classifyPage(url, title, content);
};

const scoreDiscoveryLink = (url: string, name: string | undefined): number => {
  let score = 0;
  const linkName = name || '';
  if (/\/(course|program|programme|degree|universit|fee|scholarship|tuition)/i.test(url)) score += 8;
  if (/\b(course|program|university|fee|scholarship|tuition)\b/i.test(linkName)) score += 4;
  if (/\/(blog|news|event|visa|ielts|toefl|student-life|career)/i.test(url)) score -= 20;
  return score;
};

const dedupeKey = (type: string, url: string, name: string | undefined): string =>
  `${type}::${url || ''}::${name || ''}`.toLowerCase();

const pushCourseRows = (
  rows: Array<{ courseUrl?: string; courseName: string; universityName: string; pageText?: string }>,
  courses: ScrapePipelineResult['courses'],
  entitySeen: Set<string>,
  fallbackPageText: string,
): void => {
  for (const row of rows) {
    const key = dedupeKey('course', row.courseUrl || '', row.courseName);
    if (entitySeen.has(key)) continue;
    entitySeen.add(key);
    courses.push({
      ...row,
      pageText: (row.pageText || fallbackPageText).slice(0, 15_000),
    });
  }
};

const pushScholarshipRows = (
  rows: Array<{ sourceUrl?: string; scholarshipName: string; pageText?: string }>,
  scholarships: ScrapePipelineResult['scholarships'],
  entitySeen: Set<string>,
  fallbackPageText: string,
): void => {
  for (const row of rows) {
    const key = dedupeKey('scholarship', row.sourceUrl || '', row.scholarshipName);
    if (entitySeen.has(key)) continue;
    entitySeen.add(key);
    scholarships.push({
      ...row,
      pageText: (row.pageText || fallbackPageText).slice(0, 15_000),
    });
  }
};

export const runPipelineScrape = async (
  config: SourceConfig,
  options?: ScrapeRunOptions,
): Promise<ScrapePipelineResult> => {
  const reportProgress = async (extra?: Partial<ScrapeProgress>) => {
    if (!options?.onProgress) return;
    await options.onProgress({
      totalPages: pagesVisited,
      coursesFound: courses.length,
      universitiesFound: universities.length,
      feesFound: fees.length,
      scholarshipsFound: scholarships.length,
      rejectedPages: rejectedPages.length,
      ...extra,
    });
  };

  const courses: ScrapePipelineResult['courses'] = [];
  const universities: ScrapePipelineResult['universities'] = [];
  const fees: ScrapePipelineResult['fees'] = [];
  const scholarships: ScrapePipelineResult['scholarships'] = [];
  const rejectedPages: RejectedPageRow[] = [];

  const scrapedUrls = new Set<string>();
  const entitySeen = new Set<string>();
  let pagesVisited = 0;
  let apiResponseCount = 0;

  const limitedQueue: string[] = [];
  for (const seed of config.seeds) {
    if (!limitedQueue.includes(seed)) limitedQueue.push(seed);
  }
  if (!limitedQueue.length) limitedQueue.push(config.baseUrl);

  if (config.source !== 'AECC') {
    const homepage = await capturePageWithPlaywright(config.baseUrl, {
      source: config.source,
      saveArtifacts: true,
    });
    pagesVisited++;
    apiResponseCount += homepage.apiResponses.length;

    for (const { href, name } of homepage.links) {
      if (!isSameSite(config.baseUrl, href)) continue;
      if (scoreDiscoveryLink(href, name) >= 3 && !limitedQueue.includes(href)) limitedQueue.push(href);
    }
  }

  const maxQueueSize = config.maxPages;
  scrapeLogger.info('Pipeline pages queued', { source: config.source, count: limitedQueue.length });
  await reportProgress({ currentPage: 0 });

  let pageNum = 0;
  for (let queueIndex = 0; queueIndex < limitedQueue.length; queueIndex++) {
    if (limitedQueue.length > maxQueueSize && queueIndex >= maxQueueSize) break;

    const url = limitedQueue[queueIndex];
    if (scrapedUrls.has(url)) continue;
    scrapedUrls.add(url);
    pageNum++;

    scrapeLogger.info('Pipeline page start', {
      source: config.source,
      page: pageNum,
      total: Math.min(limitedQueue.length, maxQueueSize),
      url,
    });

    const allowed = await isAllowedByRobots(url, { source: config.source });
    if (!allowed) {
      rejectedPages.push({ url, classification: 'reject', reason: 'blocked by robots.txt' });
      continue;
    }

    await sleep(SCRAPE_DELAY_MS + randomScrapeDelay());
    await yieldEventLoop();

    try {
      const page = await capturePageWithPlaywright(url, { source: config.source, saveArtifacts: true });
      pagesVisited++;
      apiResponseCount += page.apiResponses.length;

      const capture: PageCapture = {
        url: page.url,
        title: page.title,
        mainText: page.mainText,
        links: page.links,
        apiResponses: page.apiResponses,
      };

      const classification = classifyPageForPipeline(
        capture.url,
        capture.title,
        capture.mainText,
        config.source,
      );

      await reportProgress({ currentPage: pageNum, currentUrl: url });

      if (classification.type === 'reject') {
        rejectedPages.push({
          url,
          pageTitle: capture.title,
          classification: 'reject',
          reason: classification.reason || 'low classification score',
        });
        continue;
      }

      if (
        config.source === 'AECC' &&
        (classification.type === 'course' || classification.type === 'course_listing')
      ) {
        let rows = extractAECCCourses(capture.apiResponses, page.html, url);
        if (!rows.length && classification.type === 'course_listing') {
          scrapeLogger.warn('AECC listing empty — retrying page capture', { url });
          await sleep(3000);
          const retryPage = await capturePageWithPlaywright(url, { source: config.source, saveArtifacts: false });
          pagesVisited++;
          apiResponseCount += retryPage.apiResponses.length;
          rows = extractAECCCourses(retryPage.apiResponses, retryPage.html, url);
        }
        pushCourseRows(rows, courses, entitySeen, capture.mainText);

        if (classification.type === 'course_listing') {
          const added = enqueueAECCCoursePagination(
            url,
            capture.apiResponses,
            config.maxPages,
            limitedQueue,
            scrapedUrls,
            page.html,
          );
          if (added > 0) {
            scrapeLogger.info('AECC course pagination queued', { source: config.source, url, added });
          }
        }

        if (!rows.length && classification.type === 'course_listing') {
          rejectedPages.push({
            url,
            pageTitle: capture.title,
            classification: 'reject',
            reason: 'AECC course listing returned no parseable courses',
          });
        } else if (!rows.length && classification.type === 'course') {
          rejectedPages.push({
            url,
            pageTitle: capture.title,
            classification: 'reject',
            reason: 'AECC course API extraction returned no rows',
          });
        }
      } else if (classification.type === 'course' || classification.type === 'course_listing') {
        const row = scrapeCourse({ ...capture, mainText: capture.mainText });
        if (row) {
          const key = dedupeKey('course', row.courseUrl || url, row.courseName);
          if (!entitySeen.has(key)) {
            entitySeen.add(key);
            courses.push({ ...row, pageText: capture.mainText.slice(0, 15_000) });
          }
        } else {
          rejectedPages.push({
            url,
            pageTitle: capture.title,
            classification: 'reject',
            reason: 'course extraction failed',
          });
        }
      } else if (classification.type === 'university') {
        const row = scrapeUniversity(capture);
        if (row) {
          const key = dedupeKey('university', row.sourceUrl || url, row.universityName);
          if (!entitySeen.has(key)) {
            entitySeen.add(key);
            universities.push({ ...row, pageText: capture.mainText.slice(0, 15_000) });
          }
        }
      } else if (classification.type === 'fee') {
        const row = extractFee(capture);
        if (row) {
          const key = dedupeKey('fee', row.sourceUrl || url, `${row.country}-${row.studyLevel}`);
          if (!entitySeen.has(key)) {
            entitySeen.add(key);
            fees.push(row);
          }
        }
      } else if (classification.type === 'scholarship') {
        if (config.source === 'AECC') {
          const rows = extractAECCScholarships(capture.apiResponses, page.html, url);
          pushScholarshipRows(rows, scholarships, entitySeen, capture.mainText);
          let scholarshipPath = '';
          try {
            scholarshipPath = new URL(url).pathname.toLowerCase();
          } catch {
            scholarshipPath = '';
          }
          if (!rows.length && /\/scholarship\/[^/?#]+/.test(scholarshipPath)) {
            rejectedPages.push({
              url,
              pageTitle: capture.title,
              classification: 'reject',
              reason: 'AECC scholarship API extraction returned no rows',
            });
          }
        } else {
          const row = scrapeScholarship(capture);
          if (row) {
            const key = dedupeKey('scholarship', row.sourceUrl || url, row.scholarshipName);
            if (!entitySeen.has(key)) {
              entitySeen.add(key);
              scholarships.push({ ...row, pageText: capture.mainText.slice(0, 15_000) });
            }
          }
        }
      }

      scrapeLogger.info('Pipeline page done', {
        source: config.source,
        page: pageNum,
        total: Math.min(limitedQueue.length, maxQueueSize),
        type: classification.type,
        courses: courses.length,
        universities: universities.length,
        fees: fees.length,
        scholarships: scholarships.length,
        apiResponses: page.apiResponses.length,
      });

      if (config.source !== 'AECC') {
        for (const { href, name } of page.links) {
          if (!isSameSite(config.baseUrl, href)) continue;
          if (scrapedUrls.has(href)) continue;
          if (
            scoreDiscoveryLink(href, name) >= 5 &&
            limitedQueue.length < maxQueueSize &&
            !limitedQueue.includes(href)
          ) {
            limitedQueue.push(href);
          }
        }
      }
    } catch (err) {
      scrapeLogger.warn('Pipeline page failed', { url, error: err instanceof Error ? err.message : String(err) });
      rejectedPages.push({
        url,
        classification: 'reject',
        reason: err instanceof Error ? err.message : 'page capture failed',
      });
    }
  }

  scrapeLogger.info('Pipeline scrape summary', {
    source: config.source,
    pagesVisited,
    courses: courses.length,
    universities: universities.length,
    fees: fees.length,
    scholarships: scholarships.length,
    rejected: rejectedPages.length,
    apiResponseCount,
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
