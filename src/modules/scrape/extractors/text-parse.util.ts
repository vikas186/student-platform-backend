export const firstMatch = (text: string, patterns: RegExp[]): string | undefined => {
  for (const re of patterns) {
    const m = text.match(re);
    if (m?.[1]?.trim()) return m[1].trim();
  }
  return undefined;
};

export const extractListItems = (text: string, heading: RegExp, limit = 12): string[] => {
  const idx = text.search(heading);
  if (idx < 0) return [];
  const slice = text.slice(idx, idx + 2500);
  const items: string[] = [];
  for (const m of slice.matchAll(/(?:^|\n)\s*[-•*]\s*(.{3,120})/g)) {
    items.push(m[1].trim());
    if (items.length >= limit) break;
  }
  return items;
};

export const extractTitleFromText = (text: string): string => {
  const h1 = text.match(/^(.{5,200}?)(?:\s{2,}|$)/);
  return h1?.[1]?.trim() || text.slice(0, 120).trim();
};

export const extractCurrency = (text: string): string | undefined => {
  const m = text.match(/\b(USD|AUD|GBP|CAD|EUR|INR|NZD|SGD)\b/i);
  if (m) return m[1].toUpperCase();
  if (/\$/.test(text)) return 'USD';
  if (/£/.test(text)) return 'GBP';
  if (/€/.test(text)) return 'EUR';
  return undefined;
};

export const extractCountryHint = (url: string, text: string): string | undefined => {
  const fromUrl = url.match(/study-in-([a-z-]+)/i)?.[1]?.replace(/-/g, ' ');
  if (fromUrl) return fromUrl.replace(/\b\w/g, c => c.toUpperCase());
  return firstMatch(text, [
    /(?:country|destination|study in)[:\s]+([A-Z][a-zA-Z\s]{2,40})/i,
    /\b(Australia|United Kingdom|Canada|USA|United States|New Zealand|Ireland|Germany|France|Singapore|India)\b/,
  ]);
};
