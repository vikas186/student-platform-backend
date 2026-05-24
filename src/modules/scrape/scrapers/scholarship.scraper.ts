import type { PageCapture, RawScholarshipRow } from '../extractors/types';
import { extractScholarship } from '../extractors/scholarship.extractor';

/** Scholarship scraper: amount, eligibility, deadline from Playwright capture. */
export const scrapeScholarship = (page: PageCapture): RawScholarshipRow | null => {
  const row = extractScholarship(page);
  if (!row) return null;
  return { ...row, sourceUrl: row.sourceUrl || page.url };
};

export const buildScholarshipCapture = (page: PageCapture): PageCapture & { pageText: string } => ({
  ...page,
  pageText: page.mainText.slice(0, 15_000),
});
