import type { PageCapture, RawUniversityRow } from '../extractors/types';
import { extractUniversity } from '../extractors/university.extractor';

/** University scraper: name, location, ranking from Playwright capture. */
export const scrapeUniversity = (page: PageCapture): RawUniversityRow | null => {
  const row = extractUniversity(page);
  if (!row) return null;
  return { ...row, sourceUrl: row.sourceUrl || page.url };
};

export const buildUniversityCapture = (page: PageCapture): PageCapture & { pageText: string } => ({
  ...page,
  pageText: page.mainText.slice(0, 15_000),
});
