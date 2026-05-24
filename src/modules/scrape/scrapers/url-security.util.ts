import AppError from '../../../../utils/errorHandler';

const BLOCKED_HOST_RE =
  /^(localhost|127\.\d+\.\d+\.\d+|0\.0\.0\.0|::1|\[::1\]|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)$/i;

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);

export const normalizeScrapeUrl = (raw: string): string => {
  const trimmed = raw.trim();
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  const url = new URL(withProtocol);
  if (!ALLOWED_PROTOCOLS.has(url.protocol)) {
    throw new AppError('Only http and https URLs are allowed', 400);
  }
  if (BLOCKED_HOST_RE.test(url.hostname)) {
    throw new AppError('Scraping local or private network URLs is not allowed', 400);
  }
  url.hash = '';
  return url.toString().replace(/\/$/, '') || url.toString();
};

export const sourceLabelFromUrl = (url: string): string => {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./i, '');
    return hostname.slice(0, 128) || 'custom';
  } catch {
    return 'custom';
  }
};

export const assertSameOriginSeed = (baseUrl: string, seed: string): string => {
  const normalized = normalizeScrapeUrl(seed);
  const base = new URL(baseUrl);
  const seedUrl = new URL(normalized);
  if (base.hostname !== seedUrl.hostname) {
    throw new AppError(`Seed URL must be on the same domain as ${base.hostname}`, 400);
  }
  return normalized;
};

export const normalizeSeedUrls = (baseUrl: string, seeds: string[] = []): string[] => {
  const base = normalizeScrapeUrl(baseUrl);
  const out = new Set<string>([base]);
  for (const seed of seeds) {
    if (!seed?.trim()) continue;
    out.add(assertSameOriginSeed(base, seed));
  }
  return [...out];
};
