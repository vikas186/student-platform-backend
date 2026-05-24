import { chromium, type Browser, type Page } from 'playwright';
import {
  pickRandomUserAgent,
  randomScrapeDelay,
  SCRAPE_MAX_API_RESPONSES,
  SCRAPE_PAGE_RETRIES,
  SCRAPE_PAGE_WAIT_MS,
  SCRAPE_TIMEOUT_MS,
} from '../config/scrape.constants';
import {
  saveDebugHtml,
  saveScrapeFailureDebug,
} from '../debug/scrape-debug.util';
import { scrapeLogger } from '../logger';
import { shouldCaptureApiResponse, type CapturedApiResponse } from './api-course-extract.util';
import type { RawCourseRow } from './types';

export type DomLink = { href: string; name: string };

export type PlaywrightCaptureContext = {
  source?: string;
  saveArtifacts?: boolean;
  onCoursesExtracted?: (courses: RawCourseRow[]) => void;
};

let browser: Browser | null = null;

export const getPlaywrightBrowser = async (): Promise<Browser> => {
  if (!browser) browser = await chromium.launch({ headless: true });
  return browser;
};

export const closePlaywrightBrowser = async (): Promise<void> => {
  if (browser) {
    await browser.close();
    browser = null;
  }
};

const dismissCookieBanners = async (page: Page): Promise<void> => {
  for (const sel of [
    'button:has-text("Accept all")',
    'button:has-text("Accept All")',
    'button:has-text("Accept")',
    'button:has-text("I agree")',
    '#onetrust-accept-btn-handler',
    '[data-testid="accept-cookies"]',
  ]) {
    try {
      const btn = page.locator(sel).first();
      if (await btn.isVisible({ timeout: 600 })) {
        await btn.click({ timeout: 2000 });
        await page.waitForTimeout(400);
        return;
      }
    } catch {
      /* next */
    }
  }
};

const AECC_API_URL_RE = /\/(courses|universities|scholarship|scholarships|programs)\b/i;

const isAeccApiUrl = (url: string): boolean => AECC_API_URL_RE.test(url);

const shouldCaptureForSource = (
  source: string | undefined,
  url: string,
  contentType: string,
  body: string,
): boolean => {
  if (source === 'AECC') {
    if (
      (isAeccApiUrl(url) || /search\.aeccglobal\.com\/api\//i.test(url)) &&
      contentType.includes('json') &&
      body.length >= 40 &&
      body.length <= 500_000
    ) {
      return true;
    }
  }
  return shouldCaptureApiResponse(url, contentType, body);
};

export type PlaywrightPageResult = {
  url: string;
  title: string;
  mainText: string;
  html?: string;
  links: DomLink[];
  apiResponses: CapturedApiResponse[];
};

const extractPageContent = async (page: Page): Promise<{ title: string; mainText: string; links: DomLink[] }> =>
  page.evaluate(() => {
    const chromeSel = 'header, nav, footer, [role="navigation"], aside';
    const programSelectors = [
      '[data-testid*="course"] a[href]',
      '[data-testid*="program"] a[href]',
      '[class*="course-card"] a[href]',
      '[class*="program-card"] a[href]',
      '[class*="program-list"] a[href]',
      '[class*="course-list"] a[href]',
      'table[class*="course"] a[href]',
      'table[class*="program"] a[href]',
      '.degree-list a[href]',
      '.programme-list a[href]',
      'article[class*="course"] a[href]',
      'article[class*="program"] a[href]',
    ];

    const scopeSelectors = [
      '[class*="course-list"]',
      '[class*="program-list"]',
      '[class*="catalog"]',
      'main',
      '[role="main"]',
      '#content',
      '.content',
      'article',
      'body',
    ];

    let scope: Element | null = null;
    for (const sel of scopeSelectors) {
      scope = document.querySelector(sel);
      if (scope) break;
    }
    if (!scope) scope = document.body;

    const links: DomLink[] = [];
    const seen = new Set<string>();

    const addLink = (a: Element) => {
      if (a.closest(chromeSel)) return;
      const el = a as HTMLAnchorElement;
      const href = el.href;
      if (!href || seen.has(href)) return;
      const name =
        el.getAttribute('aria-label') ||
        el.getAttribute('title') ||
        (el.textContent || '').replace(/\s+/g, ' ').trim();
      if (name.length < 3) return;
      seen.add(href);
      links.push({ href, name });
    };

    for (const sel of programSelectors) {
      scope.querySelectorAll(sel).forEach(addLink);
    }
    scope.querySelectorAll('a[href]').forEach(addLink);

    const titleEl =
      scope.querySelector('[data-testid="course-title"]') ||
      scope.querySelector('[data-testid="program-title"]') ||
      scope.querySelector('h1') ||
      scope.querySelector('[class*="course-title"]') ||
      scope.querySelector('[class*="program-title"]');
    const title = (titleEl?.textContent || document.title || '').replace(/\s+/g, ' ').trim();
    const clone = scope.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('script, style, noscript, nav, footer, header').forEach(n => n.remove());
    let mainText = (clone.innerText || '').replace(/\s+/g, ' ').trim();
    if (titleEl?.textContent && !mainText.includes(titleEl.textContent.trim().slice(0, 20))) {
      mainText = `${titleEl.textContent.trim()} ${mainText}`.trim();
    }
    return { title, mainText, links };
  });

const capturePageOnce = async (
  url: string,
  attempt: number,
  ctx?: PlaywrightCaptureContext,
): Promise<PlaywrightPageResult> => {
  const b = await getPlaywrightBrowser();
  const apiResponses: CapturedApiResponse[] = [];
  const seenApiUrl = new Set<string>();
  const userAgent = pickRandomUserAgent();
  const page = await b.newPage({ userAgent, viewport: { width: 1280, height: 900 } });

  page.on('response', async res => {
    try {
      if (apiResponses.length >= SCRAPE_MAX_API_RESPONSES) return;
      const resUrl = res.url();
      if (seenApiUrl.has(resUrl)) return;
      const ct = res.headers()['content-type'] || '';
      if (res.status() < 200 || res.status() >= 400) return;
      const body = await res.text();
      if (!shouldCaptureForSource(ctx?.source, resUrl, ct, body)) return;
      seenApiUrl.add(resUrl);
      apiResponses.push({ url: resUrl, body: body.slice(0, 80_000) });
    } catch {
      /* ignore */
    }
  });

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: SCRAPE_TIMEOUT_MS });
    try {
      await page.waitForLoadState('networkidle', { timeout: 20_000 });
    } catch {
      scrapeLogger.debug('networkidle timeout — continuing', { url, attempt });
    }
    await dismissCookieBanners(page);
    await page.waitForTimeout(SCRAPE_PAGE_WAIT_MS);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
    await page.waitForTimeout(800);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(2000);

    if (ctx?.source === 'AECC') {
      try {
        await page.waitForSelector('a.sr-tile, .search_result_content', { timeout: 20_000 });
      } catch {
        scrapeLogger.debug('AECC course tiles not visible yet', { url, attempt });
      }
    }

    const { title, mainText, links } = await extractPageContent(page);
    const html = await page.content();
    const result: PlaywrightPageResult = { url, title, mainText, html, links, apiResponses };

    if (ctx?.source === 'AECC') {
      scrapeLogger.info('AECC XHR captured', { url, capturedCount: apiResponses.length });
    }

    if (ctx?.saveArtifacts) {
      const { saveDebugHtml, saveDebugScreenshot } = await import('../debug/scrape-debug.util');
      await saveDebugScreenshot(page, 'page', ctx.source);
      await saveDebugHtml(page, 'page', ctx.source);
    }

    if (ctx?.onCoursesExtracted) ctx.onCoursesExtracted([]);
    if (!mainText && links.length === 0 && ctx?.saveArtifacts) {
      await saveDebugHtml(page, 'empty-page', ctx.source);
    }

    return result;
  } catch (err) {
    await saveScrapeFailureDebug(page, url, ctx?.source, err, attempt);
    throw err;
  } finally {
    await page.close();
  }
};

export const capturePageWithPlaywright = async (
  url: string,
  ctx?: PlaywrightCaptureContext,
): Promise<PlaywrightPageResult> => {
  let lastError: unknown;
  for (let attempt = 1; attempt <= SCRAPE_PAGE_RETRIES; attempt++) {
    try {
      if (attempt === 1) {
        scrapeLogger.info('Loading page', { url, source: ctx?.source });
      } else {
        await new Promise(r => setTimeout(r, randomScrapeDelay()));
        scrapeLogger.info('Retrying page capture', { url, attempt, source: ctx?.source });
      }
      return await capturePageOnce(url, attempt, ctx);
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
};
