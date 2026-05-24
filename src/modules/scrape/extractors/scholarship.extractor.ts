import type { PageCapture, RawScholarshipRow } from './types';
import { extractCountryHint, extractTitleFromText, firstMatch } from './text-parse.util';

export const extractScholarship = (page: PageCapture): RawScholarshipRow | null => {
  const title = page.title || extractTitleFromText(page.mainText);
  const scholarshipName =
    firstMatch(page.mainText, [
      /(?:scholarship|grant|bursary|financial aid)[:\s]+([A-Z][^.;\n]{5,120})/i,
    ]) || (/\bscholarship\b/i.test(title) ? title : null);

  if (!scholarshipName) return null;

  const universityName = firstMatch(page.mainText, [
    /(?:university|institution)[:\s]+([A-Z][^.;\n]{5,120})/i,
    /at\s+([A-Z][A-Za-z\s&'.-]{5,80}University)/,
  ]);
  const country = extractCountryHint(page.url, page.mainText);
  const amount = firstMatch(page.mainText, [
    /(?:amount|award|coverage|value)[:\s]+([$£€]?\s?[\d,.]+[^.\n]{0,40})/i,
    /(?:up to|worth)[:\s]+([$£€]?\s?[\d,.]+[^.\n]{0,40})/i,
  ]);
  const eligibility = firstMatch(page.mainText, [/eligibility[:\s]+([^.]{10,800})/i]);
  const deadline = firstMatch(page.mainText, [/deadline[:\s]+([^.;\n]{3,80})/i]);

  return {
    scholarshipName,
    universityName,
    country,
    amount,
    eligibility,
    deadline,
    description: page.mainText.slice(0, 2000) || undefined,
    sourceUrl: page.url,
  };
};
