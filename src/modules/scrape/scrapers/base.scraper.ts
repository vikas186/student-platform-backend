import { SCRAPE_DELAY_MS, randomScrapeDelay } from '../config/scrape.constants';
import type { SourceConfig } from '../config/scrape-sources';
import { scrapeLogger } from '../logger';
import { extractCoursesFromApiResponses } from './api-course-extract.util';
import { filterRealCourses, isCatalogPageUrl, isRealCourse, scoreCourseLink } from './link.util';
import { isAllowedByRobots } from './robots.util';
import { capturePageWithPlaywright } from './playwright.util';
import type { RawCourseRow, ScrapeResult } from './types';

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
const yieldEventLoop = (): Promise<void> => new Promise(r => setImmediate(r));

export const isSameSite = (baseUrl: string, href: string): boolean => {
  try {
    const a = new URL(baseUrl);
    const b = new URL(href, baseUrl);
    return a.hostname === b.hostname;
  } catch {
    return false;
  }
};

const linkToCourse = (name: string, href: string, universityHint?: string): RawCourseRow | null => {
  if (!isRealCourse(name, href)) return null;
  return {
    universityName: universityHint || 'University',
    courseName: name.trim(),
    courseUrl: href,
  };
};

const mergeCourses = (lists: RawCourseRow[][]): RawCourseRow[] => {
  const seen = new Set<string>();
  const out: RawCourseRow[] = [];
  for (const list of lists) {
    for (const c of list) {
      if (!isRealCourse(c.courseName, c.courseUrl || '')) continue;
      const key = `${c.universityName}::${c.courseName}::${c.courseUrl || ''}`.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(c);
    }
  }
  return out;
};

const discoverCatalogUrls = (links: Array<{ href: string; name: string }>, baseUrl: string): string[] => {
  const urls = new Set<string>();
  for (const { href, name } of links) {
    if (!isSameSite(baseUrl, href)) continue;
    if (isCatalogPageUrl(href)) urls.add(href);
    else if (scoreCourseLink(name, href) >= 5) urls.add(href);
  }
  return [...urls];
};

export const runCatalogScrape = async (config: SourceConfig): Promise<ScrapeResult> => {
  const courses: RawCourseRow[] = [];
  const scrapedUrls = new Set<string>();
  let pagesVisited = 0;
  let apiResponseCount = 0;

  const jobs: string[] = [];
  for (const seed of config.seeds) {
    if (isCatalogPageUrl(seed) || /\/(course|program|universit|degree|catalog)/i.test(seed)) {
      if (!jobs.includes(seed)) jobs.push(seed);
    }
  }
  if (!jobs.length) jobs.push(config.baseUrl);

  const homepage = await capturePageWithPlaywright(config.baseUrl, { source: config.source });
  pagesVisited++;
  apiResponseCount += homepage.apiResponses.length;
  courses.push(...extractCoursesFromApiResponses(homepage.apiResponses, config.baseUrl));

  for (const href of discoverCatalogUrls(homepage.links, config.baseUrl)) {
    if (!jobs.includes(href)) jobs.push(href);
  }

  const limitedJobs = jobs.slice(0, config.maxPages);
  scrapeLogger.info('Catalog pages queued', { source: config.source, count: limitedJobs.length });

  for (const url of limitedJobs) {
    if (scrapedUrls.has(url)) continue;
    scrapedUrls.add(url);

    const allowed = await isAllowedByRobots(url);
    if (!allowed) {
      scrapeLogger.warn('Blocked by robots.txt', { url });
      continue;
    }

    await sleep(SCRAPE_DELAY_MS + randomScrapeDelay());
    await yieldEventLoop();
    try {
      const page = await capturePageWithPlaywright(url, { source: config.source });
      pagesVisited++;
      apiResponseCount += page.apiResponses.length;

      const fromApi = extractCoursesFromApiResponses(page.apiResponses, url);
      const fromLinks: RawCourseRow[] = [];
      for (const { href, name } of page.links) {
        if (!isSameSite(config.baseUrl, href)) continue;
        const row = linkToCourse(name, href);
        if (row) fromLinks.push(row);
      }

      courses.push(...mergeCourses([fromApi, fromLinks]));
    } catch (err) {
      scrapeLogger.warn('Page scrape failed', { url, error: err instanceof Error ? err.message : String(err) });
    }
  }

  const detailLinks = filterRealCourses(courses)
    .filter(c => c.courseUrl && scoreCourseLink(c.courseName, c.courseUrl) >= 3)
    .map(c => ({ name: c.courseName, href: c.courseUrl! }))
    .sort((a, b) => scoreCourseLink(b.name, b.href) - scoreCourseLink(a.name, a.href))
    .slice(0, config.maxDetailPages);

  for (const { href, name } of detailLinks) {
    if (scrapedUrls.has(href)) continue;
    scrapedUrls.add(href);
    await sleep(SCRAPE_DELAY_MS + randomScrapeDelay());
    await yieldEventLoop();
    try {
      const page = await capturePageWithPlaywright(href, { source: config.source });
      pagesVisited++;
      apiResponseCount += page.apiResponses.length;
      const fromApi = extractCoursesFromApiResponses(page.apiResponses, href);
      if (fromApi.length) {
        courses.push(...fromApi);
      } else if (isRealCourse(name, href)) {
        courses.push({
          universityName: courses.find(c => c.courseUrl === href)?.universityName || 'University',
          courseName: name,
          courseUrl: href,
          academicRequirement: page.mainText.slice(0, 2000) || undefined,
        });
      }
    } catch {
      /* skip detail */
    }
  }

  const filtered = filterRealCourses(mergeCourses([courses]));
  scrapeLogger.info('Scrape course filter applied', {
    source: config.source,
    beforeFilter: courses.length,
    afterFilter: filtered.length,
  });

  return {
    courses: filtered,
    universities: [],
    fees: [],
    scholarships: [],
    rejectedPages: [],
    pagesVisited,
    apiResponseCount,
  };
};
