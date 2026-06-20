import fs from 'fs/promises';
import path from 'path';
import type { Page } from 'playwright';
import { scrapeLogger } from '../logger';
import type { ScrapePipelineResult } from '../extractors/types';

const DEBUG_ROOT = path.resolve(process.cwd(), 'debug');
const RAW_ROOT = path.resolve(process.cwd(), 'raw');

const ensureDir = async (dir: string): Promise<void> => {
  await fs.mkdir(dir, { recursive: true });
};

const timestamp = (): string => new Date().toISOString().replace(/[:.]/g, '-');

export const saveRawScrapeJson = async (
  source: string,
  jobId: string,
  result: ScrapePipelineResult,
  targetUrl?: string,
): Promise<string> => {
  await ensureDir(RAW_ROOT);
  const slug = String(source || 'unknown')
    .replace(/[^a-z0-9.-]+/gi, '-')
    .toLowerCase();
  const filename = `${slug}-${timestamp()}.json`;
  const filepath = path.join(RAW_ROOT, filename);
  const payload = {
    jobId,
    source,
    targetUrl,
    scrapedAt: new Date().toISOString(),
    pagesVisited: result.pagesVisited,
    apiResponseCount: result.apiResponseCount,
    coursesFound: result.courses.length,
    universitiesFound: result.universities.length,
    feesFound: result.fees.length,
    scholarshipsFound: result.scholarships.length,
    rejectedPages: result.rejectedPages.length,
    courses: result.courses,
    universities: result.universities,
    fees: result.fees,
    scholarships: result.scholarships,
    rejected: result.rejectedPages,
  };
  await fs.writeFile(filepath, JSON.stringify(payload, null, 2), 'utf8');
  scrapeLogger.info('Raw scrape JSON saved', { filepath });
  return filepath;
};

export const saveDebugScreenshot = async (
  page: Page,
  label: string,
  source?: string,
): Promise<string | null> => {
  try {
    const dir = path.join(DEBUG_ROOT, 'screenshots');
    await ensureDir(dir);
    const name = [source?.toLowerCase(), label, timestamp()].filter(Boolean).join('-');
    const filepath = path.join(dir, `${name}.png`);
    await page.screenshot({ path: filepath, fullPage: true });
    scrapeLogger.info('Debug screenshot saved', { filepath });
    return filepath;
  } catch (err) {
    scrapeLogger.warn('Failed to save screenshot', { error: err instanceof Error ? err.message : String(err) });
    return null;
  }
};

export const saveDebugHtml = async (
  page: Page,
  label: string,
  source?: string,
): Promise<string | null> => {
  try {
    const dir = path.join(DEBUG_ROOT, 'html');
    await ensureDir(dir);
    const name = [source?.toLowerCase(), label, timestamp()].filter(Boolean).join('-');
    const filepath = path.join(dir, `${name}.html`);
    const html = await page.content();
    await fs.writeFile(filepath, html, 'utf8');
    scrapeLogger.info('Debug HTML saved', { filepath });
    return filepath;
  } catch (err) {
    scrapeLogger.warn('Failed to save HTML', { error: err instanceof Error ? err.message : String(err) });
    return null;
  }
};

export const saveDebugLog = async (
  label: string,
  data: Record<string, unknown>,
  source?: string,
): Promise<string> => {
  const dir = path.join(DEBUG_ROOT, 'logs');
  await ensureDir(dir);
  const name = [source?.toLowerCase(), label, timestamp()].filter(Boolean).join('-');
  const filepath = path.join(dir, `${name}.json`);
  await fs.writeFile(filepath, JSON.stringify({ ...data, savedAt: new Date().toISOString() }, null, 2), 'utf8');
  scrapeLogger.info('Debug log saved', { filepath });
  return filepath;
};

export const saveScrapeFailureDebug = async (
  page: Page | null,
  url: string,
  source: string | undefined,
  error: unknown,
  attempt: number,
): Promise<void> => {
  const message = error instanceof Error ? error.message : String(error);
  scrapeLogger.error('Scrape page failed', { url, attempt, error: message });
  await saveDebugLog('page-failure', { url, source, attempt, error: message }, source);
  if (page) {
    await saveDebugScreenshot(page, `failure-attempt-${attempt}`, source);
    await saveDebugHtml(page, `failure-attempt-${attempt}`, source);
  }
};
