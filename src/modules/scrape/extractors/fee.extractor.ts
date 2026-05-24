import type { PageCapture, RawFeeRow } from './types';
import { extractCountryHint, extractCurrency, extractTitleFromText, firstMatch } from './text-parse.util';

export const extractFee = (page: PageCapture): RawFeeRow | null => {
  const text = page.mainText;
  const tuitionFee = firstMatch(text, [
    /tuition(?: fee)?s?[:\s]+([^.;\n]{3,100})/i,
    /programme fee[:\s]+([^.;\n]{3,100})/i,
  ]);
  const livingCost = firstMatch(text, [
    /(?:living cost|cost of living)[:\s]+([^.;\n]{3,100})/i,
  ]);
  const accommodationCost = firstMatch(text, [
    /(?:accommodation|housing) cost[:\s]+([^.;\n]{3,100})/i,
  ]);

  if (!tuitionFee && !livingCost && !accommodationCost) return null;

  const country = extractCountryHint(page.url, text);
  const studyLevel = firstMatch(text, [
    /\b(undergraduate|postgraduate|bachelor|master|phd|diploma)\b/i,
  ]);
  const currency = extractCurrency(text);

  return {
    country,
    studyLevel,
    tuitionFee,
    livingCost,
    accommodationCost,
    currency,
    description: text.slice(0, 2000) || undefined,
    sourceUrl: page.url,
  };
};
