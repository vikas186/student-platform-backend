import type { PageCapture, RawCourseRow } from '../extractors/types';
import { extractCourse } from '../extractors/course.extractor';

/** Course scraper: title, fee, duration, level from Playwright capture. */
export const scrapeCourse = (page: PageCapture): RawCourseRow | null => {
  const row = extractCourse(page);
  if (!row) return null;
  return { ...row, courseUrl: row.courseUrl || page.url };
};

export const buildCourseCapture = (
  page: PageCapture,
): PageCapture & { pageText: string } => ({
  ...page,
  pageText: page.mainText.slice(0, 15_000),
});
