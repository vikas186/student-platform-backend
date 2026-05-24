import {
  getCourseRejectionReason,
  hasInvalidContentKeyword,
  hasPositiveCourseKeyword,
  isCatalogPageUrl,
  isInvalidContentUrl,
  isRealCourse,
} from '../validators/is-real-course.util';

const JUNK_NAME_RE =
  /^(home|about|contact|login|sign in|study abroad consult|study abroad guide|book free|talk to us|enquire|read more|learn more|view all|click here)$/i;

export { isRealCourse, isCatalogPageUrl, isInvalidContentUrl, hasPositiveCourseKeyword };

export const isJunkCourseName = (name: string, href: string): boolean => {
  const n = name.trim();
  if (n.length < 4) return true;
  if (n.length > 180) return true;
  if (JUNK_NAME_RE.test(n)) return true;
  if (isInvalidContentUrl(href)) return true;
  if (hasInvalidContentKeyword(`${n} ${href}`)) return true;
  if (!isRealCourse(n, href)) return true;
  return false;
};

export const scoreCourseLink = (name: string, href: string): number => {
  if (isJunkCourseName(name, href)) return -1;
  if (!isRealCourse(name, href) && !isCatalogPageUrl(href)) return -1;

  let score = 0;
  const hay = `${name} ${href}`.toLowerCase();

  if (isCatalogPageUrl(href)) score += 6;
  if (/\/(course|program|degree|major|faculty|catalog|programme)s?\b/i.test(href)) score += 5;
  if (hasPositiveCourseKeyword(name)) score += 4;
  if (name.length >= 15 && name.length <= 100) score += 2;

  try {
    const segments = new URL(href).pathname.split('/').filter(Boolean);
    if (segments.length >= 3) score += 2;
    if (segments.length >= 4) score += 1;
  } catch {
    return -1;
  }

  if (isInvalidContentUrl(href)) return -1;
  if (/study-in-[a-z-]+$/i.test(href) && !hasPositiveCourseKeyword(name)) score -= 5;
  if (/^programs in /i.test(name)) score -= 4;

  return score;
};

export const filterRealCourses = <T extends { courseName: string; courseUrl?: string }>(rows: T[]): T[] =>
  rows.filter(r => isRealCourse(r.courseName, r.courseUrl || ''));

export const explainCourseRejection = (name: string, href = ''): string =>
  getCourseRejectionReason(name, href) || 'unknown';
