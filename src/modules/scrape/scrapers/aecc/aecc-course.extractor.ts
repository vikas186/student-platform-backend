import type { RawCourseRow } from '../../extractors/types';
import type { CapturedApiResponse } from '../api-course-extract.util';

export type AECCCoursesPageMeta = {
  total: number;
  page: number;
  pageSize: number;
};

const asString = (value: unknown): string => {
  if (value == null) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
};

const formatTuition = (fee: unknown, currency: unknown): string | undefined => {
  if (fee == null || fee === '') return undefined;
  const amount = typeof fee === 'number' ? fee.toLocaleString('en-US') : asString(fee);
  if (!amount) return undefined;
  const cur = asString(currency);
  return cur ? `${cur} ${amount}` : amount;
};

const formatIntake = (value: unknown): string | undefined => {
  if (value == null) return undefined;
  if (Array.isArray(value)) {
    const parts = value.map(v => asString(v)).filter(Boolean);
    return parts.length ? parts.join(', ') : undefined;
  }
  const text = asString(value);
  return text || undefined;
};

const formatIelts = (value: unknown): string | undefined => {
  if (value == null || value === '') return undefined;
  if (typeof value === 'number') return String(value);
  return asString(value) || undefined;
};

const buildPageText = (fields: {
  courseName: string;
  universityName: string;
  country?: string;
  duration?: string;
  studyLevel?: string;
  city?: string;
  tuitionFee?: string;
  intake?: string;
}): string =>
  [
    fields.courseName,
    fields.universityName,
    fields.country,
    fields.city,
    fields.studyLevel,
    fields.duration,
    fields.tuitionFee,
    fields.intake,
  ]
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const parseJson = (body: string): unknown => {
  try {
    return JSON.parse(body) as unknown;
  } catch {
    return null;
  }
};

const readMeta = (node: unknown): AECCCoursesPageMeta | null => {
  if (!isPlainObject(node)) return null;

  const data = isPlainObject(node.data) ? node.data : node;
  const total = Number(data.total);
  const page = Number(data.page ?? data.currentPage ?? 1);
  const pageSize = Number(data.pageSize ?? data.limit ?? data.perPage ?? 20);

  if (!Number.isFinite(total) || total <= 0) return null;
  return {
    total,
    page: Number.isFinite(page) && page > 0 ? page : 1,
    pageSize: Number.isFinite(pageSize) && pageSize > 0 ? pageSize : 20,
  };
};

export const extractAECCCoursePageMeta = (
  apiResponses: CapturedApiResponse[],
): AECCCoursesPageMeta | null => {
  for (const res of apiResponses) {
    const meta = readMeta(parseJson(res.body));
    if (meta) return meta;
  }
  return null;
};

const collectCourseNodes = (node: unknown, acc: Record<string, unknown>[]): void => {
  if (node == null) return;

  if (Array.isArray(node)) {
    for (const item of node) collectCourseNodes(item, acc);
    return;
  }

  if (!isPlainObject(node)) return;

  if (Array.isArray(node.courses)) {
    for (const item of node.courses) {
      if (isPlainObject(item)) acc.push(item);
    }
  }

  if (isPlainObject(node.data)) {
    collectCourseNodes(node.data, acc);
  }

  for (const value of Object.values(node)) {
    if (Array.isArray(value) && value.length && isPlainObject(value[0])) {
      const first = value[0] as Record<string, unknown>;
      if ('courseName' in first || 'course_name' in first || 'name' in first) {
        for (const item of value) {
          if (isPlainObject(item)) acc.push(item);
        }
      }
    }
  }
};

const mapCourseItem = (item: Record<string, unknown>, fallbackUrl: string): RawCourseRow | null => {
  const courseName = asString(item.courseName ?? item.course_name ?? item.name ?? item.title);
  if (!courseName || courseName.length < 3) return null;

  const universityName =
    asString(item.universityName ?? item.university_name ?? item.university ?? item.institution) ||
    'Unknown University';

  const courseUrl =
    asString(item.courseUrl ?? item.course_url ?? item.url ?? item.link ?? item.slug) || fallbackUrl;

  const studyLevel = asString(item.level ?? item.studyLevel ?? item.study_level ?? item.degreeLevel);
  const duration = asString(item.duration);
  const country = asString(item.country ?? item.destination);
  const city = asString(item.city ?? item.location);
  const tuitionFee = formatTuition(item.tuitionFee ?? item.tuition_fee ?? item.fee, item.currency);
  const intake = formatIntake(item.intake ?? item.intakes ?? item.startDate);
  const ieltsRequirement = formatIelts(item.ieltsRequired ?? item.ielts ?? item.ieltsRequirement);
  const scholarshipAvailable = item.scholarshipAvailable ?? item.scholarship_available;

  const row: RawCourseRow & { pageText?: string } = {
    universityName,
    courseName,
    country: country || undefined,
    city: city || undefined,
    studyLevel: studyLevel || undefined,
    duration: duration || undefined,
    tuitionFee,
    intake,
    ieltsRequirement,
    scholarship:
      scholarshipAvailable === true
        ? 'Available'
        : scholarshipAvailable === false
          ? undefined
          : asString(scholarshipAvailable) || undefined,
    courseUrl: courseUrl.startsWith('http')
      ? courseUrl
      : courseUrl
        ? `https://search.aeccglobal.com/${courseUrl.replace(/^\//, '')}`
        : fallbackUrl,
    pageText: buildPageText({
      courseName,
      universityName,
      country,
      city,
      studyLevel,
      duration,
      tuitionFee,
      intake,
    }),
  };

  return row;
};

const mapAeccCourseItem = (item: Record<string, unknown>, fallbackUrl: string): RawCourseRow | null => {
  const row = mapCourseItem(item, fallbackUrl);
  if (!row) return null;
  return row.courseName.trim().length >= 3 ? row : null;
};

const inferStudyLevel = (courseName: string, href: string): string | undefined => {
  const hay = `${courseName} ${href}`.toLowerCase();
  if (/\b(phd|doctorate|research)\b/.test(hay)) return 'Research';
  if (/\b(mba|master|msc|m\.sc|postgraduate|graduate diploma)\b/.test(hay)) return 'Postgraduate';
  if (/\b(bachelor|bsc|b\.sc|beng|undergraduate|diploma|vocational)\b/.test(hay)) return 'Undergraduate';
  return undefined;
};

const parseLocation = (locationText: string): { city?: string; country?: string } => {
  const parts = locationText
    .split(',')
    .map(part => part.trim())
    .filter(Boolean);
  if (!parts.length) return {};
  if (parts.length === 1) return { country: parts[0] };
  return { city: parts.slice(0, -1).join(', '), country: parts[parts.length - 1] };
};

const readFeatureValue = (chunk: string, label: string): string | undefined => {
  const re = new RegExp(`<p>${label}<\\/p>\\s*<span>([^<]+)<\\/span>`, 'i');
  return chunk.match(re)?.[1]?.trim() || undefined;
};

export const extractAECCCoursesFromHtml = (
  html: string,
  pageUrl: string,
): Array<RawCourseRow & { pageText?: string }> => {
  const courses: Array<RawCourseRow & { pageText?: string }> = [];
  const seen = new Set<string>();
  const origin = (() => {
    try {
      return new URL(pageUrl).origin;
    } catch {
      return 'https://search.aeccglobal.com';
    }
  })();

  const chunks = html.split('<a class="sr-tile"');
  for (let index = 1; index < chunks.length; index++) {
    const chunk = chunks[index];
    const href = chunk.match(/href="([^"]+)"/)?.[1]?.trim();
    if (!href) continue;

    const courseName = chunk.match(/class="[^"]*\bsr-tile-text\b[^"]*"[\s\S]*?<h2[^>]*>([^<]+)<\/h2>/i)?.[1]?.trim();
    const universityName = chunk.match(/class="[^"]*\buni-tip\b[^"]*"[\s\S]*?<h2[^>]*>([^<]+)<\/h2>/i)?.[1]?.trim();
    if (!courseName || !universityName) continue;

    const locationText =
      chunk.match(/class="[^"]*\buni-location\b[^"]*"[\s\S]*?<p>([^<]+)<\/p>/i)?.[1]?.trim() || '';
    const { city, country } = parseLocation(locationText);
    const tuitionFee = readFeatureValue(chunk, 'Annual course fee');
    const duration = readFeatureValue(chunk, 'Duration');
    const scholarshipAvailable = /Scholarship Available/i.test(chunk);

    const courseUrl = href.startsWith('http') ? href : `${origin}${href.startsWith('/') ? href : `/${href}`}`;
    const studyLevel = inferStudyLevel(courseName, href);

    const row: RawCourseRow & { pageText?: string } = {
      universityName,
      courseName,
      country,
      city,
      studyLevel,
      duration,
      tuitionFee,
      scholarship: scholarshipAvailable ? 'Available' : undefined,
      courseUrl,
      pageText: buildPageText({
        courseName,
        universityName,
        country,
        city,
        studyLevel,
        duration,
        tuitionFee,
      }),
    };

    const key = (row.courseUrl || `${row.universityName}::${row.courseName}`).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    courses.push(row);
  }

  return courses;
};

export const extractAECCCoursePageMetaFromHtml = (html: string, pageSizeFallback = 12): AECCCoursesPageMeta | null => {
  const totalMatch = html.match(/(\d[\d,]*)\s+courses found/i);
  if (!totalMatch) return null;

  const total = Number(totalMatch[1].replace(/,/g, ''));
  if (!Number.isFinite(total) || total <= 0) return null;

  const tilesOnPage = (html.match(/<a class="sr-tile"/g) || []).length;
  const pageMatch = html.match(/[?&]page=(\d+)/i);
  const page = pageMatch ? Number(pageMatch[1]) : 1;

  return {
    total,
    page: Number.isFinite(page) && page > 0 ? page : 1,
    pageSize: tilesOnPage > 0 ? tilesOnPage : pageSizeFallback,
  };
};

export const extractAECCCourses = (
  apiResponses: CapturedApiResponse[],
  html?: string,
  pageUrl?: string,
): Array<RawCourseRow & { pageText?: string }> => {
  const seen = new Set<string>();
  const courses: Array<RawCourseRow & { pageText?: string }> = [];

  for (const res of apiResponses) {
    const parsed = parseJson(res.body);
    const nodes: Record<string, unknown>[] = [];
    collectCourseNodes(parsed, nodes);

    for (const item of nodes) {
      const row = mapAeccCourseItem(item, res.url);
      if (!row) continue;

      const key = (row.courseUrl || `${row.universityName}::${row.courseName}`).toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      courses.push(row);
    }
  }

  if (html && pageUrl) {
    for (const row of extractAECCCoursesFromHtml(html, pageUrl)) {
      const key = (row.courseUrl || `${row.universityName}::${row.courseName}`).toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      courses.push(row);
    }
  }

  return courses;
};

export const buildAECCCourseListingPageUrl = (listingUrl: string, page: number): string => {
  const url = new URL(listingUrl);
  url.searchParams.set('page', String(page));
  return url.toString();
};

export const enqueueAECCCoursePagination = (
  listingUrl: string,
  apiResponses: CapturedApiResponse[],
  maxPages: number,
  queue: string[],
  scrapedUrls: Set<string>,
  html?: string,
): number => {
  const meta = extractAECCCoursePageMeta(apiResponses) || (html ? extractAECCCoursePageMetaFromHtml(html) : null);
  if (!meta) return 0;

  const catalogPages = Math.ceil(meta.total / meta.pageSize);
  const totalPages = maxPages > 0 ? Math.min(catalogPages, maxPages) : catalogPages;
  let added = 0;

  for (let page = 2; page <= totalPages; page++) {
    const nextUrl = buildAECCCourseListingPageUrl(listingUrl, page);
    if (scrapedUrls.has(nextUrl) || queue.includes(nextUrl)) continue;
    queue.push(nextUrl);
    added++;
  }

  return added;
};
