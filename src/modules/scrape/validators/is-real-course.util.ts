/**
 * Strict course vs blog/SEO/visa content detection.
 */

const INVALID_TITLE_KEYWORDS = [
  'visa',
  'scholarship',
  'scholarships',
  'blog',
  'guide',
  'overview',
  'explore',
  'student life',
  'cost of',
  'cost of living',
  'ielts',
  'toefl',
  'pte exam',
  'work permit',
  'reasons to study',
  'why study',
  'top reasons',
  'how to apply',
  'application process',
  'living expenses',
  'accommodation guide',
  'exam preparation',
  'test preparation',
  'immigration',
  'study abroad consult',
  'free consultation',
  'book consultation',
  'counselling',
  'counseling',
  'news and',
  'latest news',
  'read more',
  'learn more',
  'view all',
  'click here',
  'download brochure',
  'contact us',
  'talk to us',
  'enquire now',
  'popular courses',
  'best universities',
  'university ranking',
  'country guide',
  'destination guide',
];

const INVALID_URL_PATTERNS: RegExp[] = [
  /\/blog\b/i,
  /\/blogs\b/i,
  /\/news\b/i,
  /\/articles?\b/i,
  /\/visa\b/i,
  /\/visas\b/i,
  /\/scholarship/i,
  /\/guides?\b/i,
  /\/guide-/i,
  /\/ielts\b/i,
  /\/toefl\b/i,
  /\/pte\b/i,
  /\/student-life/i,
  /\/cost-of/i,
  /\/living-cost/i,
  /\/why-study/i,
  /\/reasons-to-study/i,
  /\/explore-/i,
  /\/overview\b/i,
  /\/resources?\b/i,
  /\/immigration/i,
  /\/work-permit/i,
  /study-abroad-guide/i,
  /\/events?\b/i,
  /\/webinar/i,
  /\/faq\b/i,
  /\/about\b/i,
  /\/contact\b/i,
  /\/privacy/i,
  /\/terms/i,
  /\/cookie/i,
  /salesiq\.zohopublic\.com/i,
  /zohopublic\.com\/visitor/i,
  /google-analytics|googletagmanager|facebook\.com\/tr/i,
];

const POSITIVE_COURSE_KEYWORDS = [
  'bachelor',
  'bachelors',
  "bachelor's",
  'master',
  'masters',
  "master's",
  'mba',
  'diploma',
  'certificate',
  'bsc',
  'b.sc',
  'msc',
  'm.sc',
  'phd',
  'ph.d',
  'doctorate',
  'engineering',
  'science',
  'business',
  'nursing',
  'computer',
  'undergraduate',
  'postgraduate',
  'honours',
  'honors',
  'degree in',
  'major in',
  'llb',
  'llm',
  'beng',
  'meng',
  'ba ',
  ' ba',
  'b.a.',
  'm.a.',
  'associate degree',
  'foundation year',
  'grad cert',
  'graduate certificate',
  'graduate diploma',
  'vocational',
  'research',
];

const GENERIC_NON_COURSE_TITLE_RE =
  /^(study in|programs in|courses in|education in|universities in|top \d+|best \d+|why |how to |what is |all about )/i;

const CATALOG_URL_RE =
  /\/(courses?|programs?|programmes?|degrees?|catalog(ue)?|facult(y|ies)|academics?|study-programs?|majors?|departments?|school-of-)\b/i;

export const hasPositiveCourseKeyword = (title: string): boolean => {
  const t = title.toLowerCase();
  return POSITIVE_COURSE_KEYWORDS.some(kw => t.includes(kw));
};

export const hasInvalidContentKeyword = (text: string): boolean => {
  const t = text.toLowerCase();
  return INVALID_TITLE_KEYWORDS.some(kw => t.includes(kw));
};

export const isInvalidContentUrl = (url: string): boolean => {
  if (!url?.trim()) return true;
  return INVALID_URL_PATTERNS.some(re => re.test(url));
};

/** Pages likely to list degree programs (safe to crawl). */
export const isCatalogPageUrl = (url: string): boolean => {
  if (!url?.trim() || isInvalidContentUrl(url)) return false;
  if (CATALOG_URL_RE.test(url)) return true;
  if (/\/study-in-[a-z-]+\/(universit(y|ies)|courses?|programs?)/i.test(url)) return true;
  if (/\/universit(y|ies)\/[^/]+\/(courses?|programs?)/i.test(url)) return true;
  return false;
};

/**
 * Returns true only for titles that look like real degree/program names.
 */
export const isRealCourse = (courseTitle: string, courseUrl = ''): boolean => {
  const title = (courseTitle || '').trim();
  const url = (courseUrl || '').trim();

  if (title.length < 8 || title.length > 180) return false;
  if (GENERIC_NON_COURSE_TITLE_RE.test(title) && !hasPositiveCourseKeyword(title)) return false;

  const combined = `${title} ${url}`.toLowerCase();
  if (hasInvalidContentKeyword(combined)) return false;
  if (url && isInvalidContentUrl(url)) return false;

  return hasPositiveCourseKeyword(title);
};

export const getCourseRejectionReason = (courseTitle: string, courseUrl = ''): string | null => {
  const title = (courseTitle || '').trim();
  const url = (courseUrl || '').trim();

  if (!title) return 'empty title';
  if (title.length < 8) return 'title too short for a program name';
  if (title.length > 180) return 'title too long';
  if (url && isInvalidContentUrl(url)) return 'informational or blog URL';
  if (hasInvalidContentKeyword(`${title} ${url}`)) return 'informational or SEO content keyword';
  if (GENERIC_NON_COURSE_TITLE_RE.test(title) && !hasPositiveCourseKeyword(title)) return 'generic landing page title';
  if (!hasPositiveCourseKeyword(title)) return 'missing degree or program keyword';
  return null;
};
