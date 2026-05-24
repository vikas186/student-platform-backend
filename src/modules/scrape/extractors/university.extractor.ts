import type { PageCapture, RawUniversityRow } from './types';
import { extractCountryHint, extractListItems, extractTitleFromText, firstMatch } from './text-parse.util';

export const extractUniversity = (page: PageCapture): RawUniversityRow | null => {
  const title = page.title || extractTitleFromText(page.mainText);
  const universityName =
    firstMatch(page.mainText, [
      /^([A-Z][A-Za-z\s&'.-]{5,120}University)/m,
      /(?:about|at)\s+([A-Z][A-Za-z\s&'.-]{5,120}University)/,
    ]) || (title.includes('University') ? title : null);

  if (!universityName) return null;

  const country = extractCountryHint(page.url, page.mainText);
  const city = firstMatch(page.mainText, [/campus[:\s]+([A-Z][a-zA-Z\s,]{2,60})/i, /\b([A-Z][a-z]+),\s*[A-Z][a-z]+\b/]);
  const ranking = firstMatch(page.mainText, [
    /rank(?:ed|ing)?[:\s#]+([#]?\d{1,4}[^.\n]{0,40})/i,
    /QS[^.\n]{0,30}(?:#|rank)\s*(\d{1,4})/i,
  ]);
  const overview = firstMatch(page.mainText, [
    /(?:university )?overview[:\s]+([^.]{40,1200})/i,
    /about (?:the )?university[:\s]+([^.]{40,1200})/i,
  ]);
  const websiteUrl = page.links.find(l => /official|website|visit/i.test(l.name))?.href;

  const faculties = extractListItems(page.mainText, /facult(y|ies)/i);
  const departments = extractListItems(page.mainText, /departments?/i);
  const popularCourses = extractListItems(page.mainText, /popular courses|featured programs/i);

  if (!ranking && !overview && !faculties.length && !departments.length) {
    if (!page.url.match(/universit(y|ies)/i)) return null;
  }

  return {
    universityName,
    country,
    city,
    ranking,
    overview: overview || page.mainText.slice(0, 1500) || undefined,
    websiteUrl,
    sourceUrl: page.url,
    faculties,
    departments,
    popularCourses,
  };
};
