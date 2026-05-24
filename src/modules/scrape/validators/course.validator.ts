import type { RawCourseRow } from '../scrapers/types';

const JUNK_PHRASE_RE =
  /^(apply now|learn more|read more|contact us|view all|click here)$/i;

/** Light validation for classifier-selected course pages (no strict keyword gate). */
export const validateCourseRequiredFields = (c: RawCourseRow): { valid: boolean; reasons: string[] } => {
  const reasons: string[] = [];
  const courseName = (c.courseName || '').trim();
  const courseUrl = (c.courseUrl || '').trim();

  if (!courseName || courseName.length < 3) reasons.push('missing courseName');
  else if (JUNK_PHRASE_RE.test(courseName)) reasons.push('junk courseName phrase');

  if (!courseUrl) reasons.push('missing courseUrl');
  else if (!/^https?:\/\//i.test(courseUrl)) reasons.push('invalid courseUrl');

  return { valid: reasons.length === 0, reasons };
};
