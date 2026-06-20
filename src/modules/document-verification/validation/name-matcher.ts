export const normalizeName = (name: string | null | undefined): string => {
  if (!name?.trim()) return '';
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

const tokenSort = (s: string): string =>
  s
    .split(' ')
    .filter(Boolean)
    .sort()
    .join(' ');

/** Levenshtein ratio 0–1 */
const similarity = (a: string, b: string): number => {
  if (!a && !b) return 1;
  if (!a || !b) return 0;
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  const dist = dp[m][n];
  return 1 - dist / Math.max(m, n);
};

export const namesMatch = (
  passportName: string | null | undefined,
  extractedName: string | null | undefined,
  threshold = 0.85,
): boolean => {
  const a = tokenSort(normalizeName(passportName));
  const b = tokenSort(normalizeName(extractedName));
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.includes(b) || b.includes(a)) return true;
  return similarity(a, b) >= threshold;
};

export const isValidPan = (pan: string | null | undefined): boolean => {
  if (!pan?.trim()) return false;
  return /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan.trim().toUpperCase());
};
