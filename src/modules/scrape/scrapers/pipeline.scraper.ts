import { SCRAPE_DELAY_MS, randomScrapeDelay } from '../config/scrape.constants';
import type { SourceConfig } from '../config/scrape-sources';
import { classifyPage } from '../classifier/page.classifier';
import { classifyStudiesOverseasPage } from '../classifier/studiesOverseas.classifier';
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
import {
  enqueueIDPCoursePagination,
  extractIDPCourses,
} from './idp/idp-course.extractor';

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

/** AECC / IDP URL rules run before generic heuristics. */
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
      // Destination / filtered listings must win over the detail regex:
      // /courses/all/all/canada would otherwise match as a single course page.
      if (
        path === '/courses' ||
        path === '/courses/' ||
        /^\/courses\/all(\/|$)/.test(path) ||
        /^\/courses\/study-[^/]+(\/|$)/.test(path)
      ) {
        return { type: 'course_listing', scores: { ...emptyScores(), course_listing: 100 } };
      }
      // Detail: /course/:slug or /courses/:single-slug (not /all/...)
      if (/^\/course\/[^/?#]+/.test(path) || /^\/courses\/[^/?#]+\/?$/.test(path)) {
        return { type: 'course', scores: { ...emptyScores(), course: 100 } };
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

  if (source === 'IDP') {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return classifyPage(url, title, content);
    }

    const host = parsed.hostname.toLowerCase();
    const path = parsed.pathname.toLowerCase();

    if (host.includes('idp.com')) {
      if (/\/find-a-course(?:\/|$)/.test(path)) {
        return { type: 'course_listing', scores: { ...emptyScores(), course_listing: 100 } };
      }
      if (/\/universities-and-colleges\/[^/]+\/[^/]+\/prg-[a-z]{2}-\d+/i.test(`${path}${parsed.search}`)) {
        return { type: 'course', scores: { ...emptyScores(), course: 100 } };
      }
      if (/\/universities-and-colleges\/[^/]+\/iid-/i.test(path)) {
        return { type: 'university', scores: { ...emptyScores(), university: 100 } };
      }
      if (path === '/india' || path === '/india/' || /\/india\/search/.test(path)) {
        return { type: 'reject', scores: emptyScores(), reason: 'IDP marketing or empty search page' };
      }
      // Root homepage without find-a-course — marketing only
      if (path === '/' || path === '') {
        return { type: 'reject', scores: emptyScores(), reason: 'IDP marketing homepage' };
      }
    }
  }

  if (source === 'STUDIES_OVERSEAS') {
    return classifyStudiesOverseasPage(url, title, content);
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

  if (config.source !== 'AECC' && config.source !== 'IDP') {
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

  const maxQueueSize =
    config.maxPages <= 0
      ? Number.MAX_SAFE_INTEGER
      : config.source === 'AECC'
        ? Math.max(config.maxPages * Math.max(config.seeds.length, 1), config.maxPages)
        : config.maxPages;
  scrapeLogger.info('Pipeline pages queued', {
    source: config.source,
    count: limitedQueue.length,
    maxQueueSize,
    seedCount: config.seeds.length,
  });
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
        scrapeLogger.warn('Pipeline page rejected', {
          url,
          pageTitle: capture.title,
          reason: classification.reason || 'low classification score',
          scores: classification.scores,
        });
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
          const reason = 'AECC course listing returned no parseable courses';
          scrapeLogger.warn('AECC page parse failed', { url, reason });
          rejectedPages.push({
            url,
            pageTitle: capture.title,
            classification: 'reject',
            reason,
          });
        } else if (!rows.length && classification.type === 'course') {
          const reason = 'AECC course API extraction returned no rows';
          scrapeLogger.warn('AECC page parse failed', { url, reason });
          rejectedPages.push({
            url,
            pageTitle: capture.title,
            classification: 'reject',
            reason,
          });
        }
      } else if (
        config.source === 'IDP' &&
        (classification.type === 'course' || classification.type === 'course_listing')
      ) {
        let rows = extractIDPCourses(page.html, url);
        if (!rows.length && classification.type === 'course_listing') {
          scrapeLogger.warn('IDP listing empty — retrying page capture', { url });
          await sleep(3000);
          const retryPage = await capturePageWithPlaywright(url, { source: config.source, saveArtifacts: false });
          pagesVisited++;
          apiResponseCount += retryPage.apiResponses.length;
          rows = extractIDPCourses(retryPage.html, url);
        }
        pushCourseRows(rows, courses, entitySeen, capture.mainText);

        if (classification.type === 'course_listing') {
          const added = enqueueIDPCoursePagination(
            url,
            config.maxPages,
            limitedQueue,
            scrapedUrls,
            page.html,
          );
          if (added > 0) {
            scrapeLogger.info('IDP course pagination queued', { source: config.source, url, added });
          }
        }

        if (!rows.length) {
          const reason = classification.type === 'course_listing'
            ? 'IDP course listing returned no parseable courses'
            : 'IDP course page returned no parseable courses';
          scrapeLogger.warn('IDP page parse failed', { url, reason });
          rejectedPages.push({
            url,
            pageTitle: capture.title,
            classification: 'reject',
            reason,
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
          const reason = 'course extraction failed';
          scrapeLogger.warn('Generic page parse failed', { url, reason });
          rejectedPages.push({
            url,
            pageTitle: capture.title,
            classification: 'reject',
            reason,
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
        } else {
          const reason = 'university extraction failed';
          scrapeLogger.warn('Generic page parse failed', { url, reason });
          rejectedPages.push({
            url,
            pageTitle: capture.title,
            classification: 'reject',
            reason,
          });
        }
      } else if (classification.type === 'fee') {
        const row = extractFee(capture);
        if (row) {
          const key = dedupeKey('fee', row.sourceUrl || url, `${row.country}-${row.studyLevel}`);
          if (!entitySeen.has(key)) {
            entitySeen.add(key);
            fees.push(row);
          }
        } else {
          const reason = 'fee extraction failed';
          scrapeLogger.warn('Generic page parse failed', { url, reason });
          rejectedPages.push({
            url,
            pageTitle: capture.title,
            classification: 'reject',
            reason,
          });
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
            const reason = 'AECC scholarship API extraction returned no rows';
            scrapeLogger.warn('AECC page parse failed', { url, reason });
            rejectedPages.push({
              url,
              pageTitle: capture.title,
              classification: 'reject',
              reason,
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
          } else {
            const reason = 'scholarship extraction failed';
            scrapeLogger.warn('Generic page parse failed', { url, reason });
            rejectedPages.push({
              url,
              pageTitle: capture.title,
              classification: 'reject',
              reason,
            });
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

      if (config.source !== 'AECC' && config.source !== 'IDP') {
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
