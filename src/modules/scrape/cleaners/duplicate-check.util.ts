const STRIP_WORDS = new Set(['university', 'college', 'institute', 'campus', 'program', 'course', 'the', 'of', 'and']);

export const normalizeNameKey = (name: string | undefined | null): string =>
  String(name || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(w => w.length > 1 && !STRIP_WORDS.has(w))
    .join(' ')
    .trim();

export const levenshtein = (a: string, b: string): number => {
  if (a === b) return 0;
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp: number[] = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const temp = dp[j];
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = temp;
    }
  }
  return dp[n];
};

export const tokenSimilarity = (a: string, b: string): number => {
  const ka = normalizeNameKey(a);
  const kb = normalizeNameKey(b);
  if (!ka || !kb) return 0;
  if (ka === kb) return 1;
  const maxLen = Math.max(ka.length, kb.length);
  return maxLen === 0 ? 0 : 1 - levenshtein(ka, kb) / maxLen;
};

export const findDuplicateInList = (
  key: string,
  existing: Array<{ id: string; key: string }>,
  threshold = 0.9,
): { isDuplicate: boolean; duplicateOfId: string | null } => {
  for (const e of existing) {
    if (e.key === key) return { isDuplicate: true, duplicateOfId: e.id };
    if (tokenSimilarity(key, e.key) >= threshold) return { isDuplicate: true, duplicateOfId: e.id };
  }
  return { isDuplicate: false, duplicateOfId: null };
};

export const courseUrlKey = (url: string | undefined | null): string =>
  String(url || '')
    .split('#')[0]
    .toLowerCase();

export const courseCompositeKey = (
  universityName: string,
  courseName: string,
  country: string,
): string =>
  `${normalizeNameKey(universityName)}::${normalizeNameKey(courseName)}::${normalizeNameKey(country)}`;
