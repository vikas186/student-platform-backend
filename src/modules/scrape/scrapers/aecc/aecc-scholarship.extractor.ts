import type { RawScholarshipRow } from '../../extractors/types';
import type { CapturedApiResponse } from '../api-course-extract.util';

const asString = (value: unknown): string => {
  if (value == null) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
};

const formatAmount = (amount: unknown, currency: unknown): string | undefined => {
  if (amount == null || amount === '') return undefined;
  const value = typeof amount === 'number' ? amount.toLocaleString('en-US') : asString(amount);
  if (!value) return undefined;
  const cur = asString(currency);
  return cur ? `${cur} ${value}` : value;
};

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const parseJson = (body: string): unknown => {
  try {
    return JSON.parse(body) as unknown;
  } catch {
    return null;
  }
};

const collectScholarshipNodes = (node: unknown, acc: Record<string, unknown>[]): void => {
  if (node == null) return;

  if (Array.isArray(node)) {
    for (const item of node) collectScholarshipNodes(item, acc);
    return;
  }

  if (!isPlainObject(node)) return;

  const arrayKeys = ['scholarships', 'scholarship', 'data', 'items', 'results'];
  for (const key of arrayKeys) {
    const value = node[key];
    if (Array.isArray(value)) {
      for (const item of value) {
        if (isPlainObject(item)) acc.push(item);
      }
    }
  }

  if (isPlainObject(node.data)) {
    collectScholarshipNodes(node.data, acc);
  }
};

const buildPageText = (fields: {
  scholarshipName: string;
  universityName?: string;
  country?: string;
  amount?: string;
  eligibility?: string;
  deadline?: string;
}): string =>
  [fields.scholarshipName, fields.universityName, fields.country, fields.amount, fields.eligibility, fields.deadline]
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

const mapScholarshipItem = (
  item: Record<string, unknown>,
  fallbackUrl: string,
): (RawScholarshipRow & { pageText?: string }) | null => {
  const scholarshipName = asString(
    item.scholarshipName ?? item.scholarship_name ?? item.name ?? item.title,
  );
  if (!scholarshipName || scholarshipName.length < 3) return null;

  const universityName = asString(item.universityName ?? item.university_name ?? item.university);
  const country = asString(item.country ?? item.destination);
  const amount = formatAmount(
    item.amount ?? item.scholarshipAmount ?? item.value,
    item.currency,
  );
  const eligibility = asString(item.eligibility ?? item.criteria ?? item.requirements);
  const deadline = asString(item.deadline ?? item.applicationDeadline ?? item.closingDate);
  const description = asString(item.description ?? item.summary ?? item.overview);
  const sourceUrl = asString(
    item.applicationUrl ?? item.application_url ?? item.url ?? item.link ?? item.sourceUrl,
  );

  return {
    scholarshipName,
    universityName: universityName || undefined,
    country: country || undefined,
    amount,
    eligibility: eligibility || undefined,
    deadline: deadline || undefined,
    description: description || undefined,
    sourceUrl: sourceUrl.startsWith('http')
      ? sourceUrl
      : sourceUrl
        ? `https://search.aeccglobal.com/scholarship/${sourceUrl.replace(/^\//, '')}`
        : fallbackUrl,
    pageText: buildPageText({ scholarshipName, universityName, country, amount, eligibility, deadline }),
  };
};

const readFeatureValue = (chunk: string, label: string): string | undefined => {
  const re = new RegExp(`<p>${label}<\\/p>\\s*<span>([^<]+)<\\/span>`, 'i');
  return chunk.match(re)?.[1]?.trim() || undefined;
};

export const extractAECCScholarshipsFromHtml = (
  html: string,
  pageUrl: string,
): Array<RawScholarshipRow & { pageText?: string }> => {
  const scholarships: Array<RawScholarshipRow & { pageText?: string }> = [];
  const seen = new Set<string>();
  const origin = (() => {
    try {
      return new URL(pageUrl).origin;
    } catch {
      return 'https://search.aeccglobal.com';
    }
  })();

  const chunks = html.split('<a ');
  for (let index = 1; index < chunks.length; index++) {
    const chunk = chunks[index];
    const tagEnd = chunk.indexOf('>');
    if (tagEnd < 0) continue;
    const openingTag = chunk.slice(0, tagEnd);
    if (!/\bscholar-tile\b/.test(openingTag)) continue;

    const href = openingTag.match(/href="([^"]+)"/)?.[1]?.trim();
    if (!href) continue;

    const body = chunk.slice(tagEnd + 1);
    const scholarshipName =
      body.match(/class="[^"]*\buni-tip\b[^"]*"[\s\S]*?<h3[^>]*>([^<]+)<\/h3>/i)?.[1]?.trim() ||
      body.match(/class="[^"]*\bscholar-deat\b[^"]*"[\s\S]*?<h3[^>]*>([^<]+)<\/h3>/i)?.[1]?.trim();
    if (!scholarshipName) continue;

    const universityName = body.match(/class="scholar-uni"[^>]*>([^<]+)</i)?.[1]?.trim();
    const country = body.match(/class="scholar-country"[\s\S]*?<span class="ms-2">([^<]+)<\/span>/i)?.[1]?.trim();
    const amount = readFeatureValue(body, 'Scholarship Value');
    const studyLevel = readFeatureValue(body, 'Study Level');
    const sourceUrl = href.startsWith('http') ? href : `${origin}${href.startsWith('/') ? href : `/${href}`}`;

    const row: RawScholarshipRow & { pageText?: string } = {
      scholarshipName,
      universityName: universityName || undefined,
      country: country || undefined,
      amount,
      eligibility: studyLevel ? `Study level: ${studyLevel}` : undefined,
      sourceUrl,
      pageText: buildPageText({
        scholarshipName,
        universityName,
        country,
        amount,
        eligibility: studyLevel ? `Study level: ${studyLevel}` : undefined,
      }),
    };

    const key = (row.sourceUrl || `${row.scholarshipName}::${row.universityName || ''}`).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    scholarships.push(row);
  }

  return scholarships;
};

export const extractAECCScholarships = (
  apiResponses: CapturedApiResponse[],
  html?: string,
  pageUrl?: string,
): Array<RawScholarshipRow & { pageText?: string }> => {
  const seen = new Set<string>();
  const scholarships: Array<RawScholarshipRow & { pageText?: string }> = [];

  for (const res of apiResponses) {
    const nodes: Record<string, unknown>[] = [];
    collectScholarshipNodes(parseJson(res.body), nodes);

    for (const item of nodes) {
      const row = mapScholarshipItem(item, res.url);
      if (!row) continue;

      const key = (row.sourceUrl || `${row.scholarshipName}::${row.universityName || ''}`).toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      scholarships.push(row);
    }
  }

  if (html && pageUrl) {
    for (const row of extractAECCScholarshipsFromHtml(html, pageUrl)) {
      const key = (row.sourceUrl || `${row.scholarshipName}::${row.universityName || ''}`).toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      scholarships.push(row);
    }
  }

  return scholarships;
};
