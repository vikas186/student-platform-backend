import type { RawCourseRow } from '../../extractors/types';

export type IDPCoursesPageMeta = {
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

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const parseJsonLdBlocks = (html: string): unknown[] => {
  const blocks: unknown[] = [];
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html))) {
    try {
      blocks.push(JSON.parse(match[1]) as unknown);
    } catch {
      /* skip malformed JSON-LD */
    }
  }
  return blocks;
};

const walkJsonLdNodes = (node: unknown, visit: (obj: Record<string, unknown>) => void): void => {
  if (node == null) return;
  if (Array.isArray(node)) {
    for (const item of node) walkJsonLdNodes(item, visit);
    return;
  }
  if (!isPlainObject(node)) return;
  visit(node);
  for (const value of Object.values(node)) walkJsonLdNodes(value, visit);
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

const inferStudyLevel = (courseName: string): string | undefined => {
  const hay = courseName.toLowerCase();
  if (/\b(phd|doctorate|research)\b/.test(hay)) return 'Research';
  if (/\b(mba|master|msc|m\.sc|postgraduate|graduate diploma)\b/.test(hay)) return 'Postgraduate';
  if (/\b(bachelor|bsc|b\.sc|beng|undergraduate|diploma|vocational)\b/.test(hay)) return 'Undergraduate';
  return undefined;
};

const buildPageText = (fields: {
  courseName: string;
  universityName: string;
  country?: string;
  city?: string;
  studyLevel?: string;
  tuitionFee?: string;
  intake?: string;
  description?: string;
}): string =>
  [
    fields.courseName,
    fields.universityName,
    fields.country,
    fields.city,
    fields.studyLevel,
    fields.tuitionFee,
    fields.intake,
    fields.description,
  ]
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

const mapIdpCourseItem = (item: Record<string, unknown>): (RawCourseRow & { pageText?: string }) | null => {
  const type = asString(item['@type']);
  if (type && type !== 'Course') return null;

  const courseName = asString(item.name);
  if (!courseName || courseName.length < 3) return null;

  const courseUrl = asString(item.url ?? item['@id']);
  if (!courseUrl || !/PRG-[A-Z]{2}-\d+/i.test(courseUrl)) return null;

  const provider = isPlainObject(item.provider) ? item.provider : {};
  const universityName = asString(provider.name) || 'Unknown University';

  const offers = isPlainObject(item.offers) ? item.offers : {};
  const price = asString(offers.price);
  const currency = asString(offers.priceCurrency);
  const tuitionFee =
    price && currency
      ? `${currency} ${Number(price.replace(/,/g, '')).toLocaleString('en-US')}`
      : undefined;

  const instance = isPlainObject(item.hasCourseInstance) ? item.hasCourseInstance : {};
  const location = asString(instance.location);
  const { city, country } = parseLocation(location);
  const intake = asString(instance.startDate) || undefined;
  const studyLevel = inferStudyLevel(courseName);
  const description = asString(item.description) || undefined;

  return {
    universityName,
    courseName,
    country,
    city,
    studyLevel,
    tuitionFee,
    intake,
    courseUrl,
    pageText: buildPageText({
      courseName,
      universityName,
      country,
      city,
      studyLevel,
      tuitionFee,
      intake,
      description,
    }),
  };
};

const readItemList = (
  node: Record<string, unknown>,
): { total?: number; courses: Record<string, unknown>[] } => {
  const mainEntity = isPlainObject(node.mainEntity) ? node.mainEntity : node;
  const listType = asString(mainEntity['@type']);
  if (listType !== 'ItemList') return { courses: [] };

  const totalRaw = mainEntity.numberOfItems;
  const total = Number(typeof totalRaw === 'string' ? totalRaw.replace(/,/g, '') : totalRaw);
  const elements = Array.isArray(mainEntity.itemListElement) ? mainEntity.itemListElement : [];
  const courses = elements.filter(isPlainObject) as Record<string, unknown>[];
  return {
    total: Number.isFinite(total) && total > 0 ? total : undefined,
    courses,
  };
};

export const extractIDPCoursePageMetaFromHtml = (
  html: string,
  pageUrl: string,
  pageSizeFallback = 24,
): IDPCoursesPageMeta | null => {
  let total: number | undefined;
  let pageSize = 0;

  for (const block of parseJsonLdBlocks(html)) {
    walkJsonLdNodes(block, obj => {
      const list = readItemList(obj);
      if (list.total) total = list.total;
      if (list.courses.length > pageSize) pageSize = list.courses.length;
    });
  }

  if (!total && pageSize === 0) return null;

  let page = 1;
  try {
    const parsed = new URL(pageUrl);
    const pageParam = Number(parsed.searchParams.get('page') || '1');
    if (Number.isFinite(pageParam) && pageParam > 0) page = pageParam;
  } catch {
    /* keep default page */
  }

  return {
    total: total ?? pageSize,
    page,
    pageSize: pageSize > 0 ? pageSize : pageSizeFallback,
  };
};

export const extractIDPCoursesFromHtml = (
  html: string,
): Array<RawCourseRow & { pageText?: string }> => {
  const courses: Array<RawCourseRow & { pageText?: string }> = [];
  const seen = new Set<string>();

  for (const block of parseJsonLdBlocks(html)) {
    walkJsonLdNodes(block, obj => {
      const list = readItemList(obj);
      for (const item of list.courses) {
        const row = mapIdpCourseItem(item);
        if (!row) continue;
        const key = (row.courseUrl || `${row.universityName}::${row.courseName}`).toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        courses.push(row);
      }
    });
  }

  return courses;
};

export const extractIDPCourses = (
  html?: string,
  pageUrl?: string,
): Array<RawCourseRow & { pageText?: string }> => {
  if (!html) return [];
  return extractIDPCoursesFromHtml(html);
};

export const buildIDPCourseListingPageUrl = (listingUrl: string, page: number): string => {
  const url = new URL(listingUrl);
  url.searchParams.set('page', String(page));
  return url.toString();
};

export const enqueueIDPCoursePagination = (
  listingUrl: string,
  maxPages: number,
  queue: string[],
  scrapedUrls: Set<string>,
  html?: string,
): number => {
  const meta = html ? extractIDPCoursePageMetaFromHtml(html, listingUrl) : null;
  if (!meta) return 0;

  const totalPages = Math.min(Math.ceil(meta.total / meta.pageSize), maxPages);
  let added = 0;

  for (let page = 2; page <= totalPages; page++) {
    const nextUrl = buildIDPCourseListingPageUrl(listingUrl, page);
    if (scrapedUrls.has(nextUrl) || queue.includes(nextUrl)) continue;
    queue.push(nextUrl);
    added++;
  }

  return added;
};
