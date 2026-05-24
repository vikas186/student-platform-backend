import type { RawCourseRow } from '../scrapers/types';

const JUNK_PHRASE_RE =
  /^(apply now|learn more|read more|contact us|book consultation|cookie|privacy|terms|sign in|login|register|view all|click here)$/i;

export const isJunkText = (text: string): boolean => {
  const t = text.trim();
  if (!t || t.length < 3) return true;
  if (JUNK_PHRASE_RE.test(t)) return true;
  return false;
};

export const filterJunkCourse = (c: RawCourseRow): { pass: boolean; reason?: string } => {
  const name = (c.courseName || '').trim();
  if (!name) return { pass: false, reason: 'empty course name' };
  if (isJunkText(name)) return { pass: false, reason: 'junk phrase' };
  return { pass: true };
};

export const applyJunkFilters = (courses: RawCourseRow[]): { cleaned: RawCourseRow[]; removed: number } => {
  let removed = 0;
  const cleaned: RawCourseRow[] = [];
  for (const c of courses) {
    const check = filterJunkCourse(c);
    if (check.pass) cleaned.push(c);
    else removed++;
  }
  return { cleaned, removed };
};
