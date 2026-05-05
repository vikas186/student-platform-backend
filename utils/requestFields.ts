/** Multipart/query fields may be strings, arrays, or numbers depending on client/multer. */
export const pickOptionalTrimmedString = (
  source: Record<string, unknown> | undefined | null,
  keys: string[],
): string | undefined => {
  if (!source || typeof source !== 'object') return undefined;
  for (const key of keys) {
    let v: unknown = (source as Record<string, unknown>)[key];
    if (Array.isArray(v)) v = v[0];
    if (v === undefined || v === null) continue;
    const s = String(v).trim();
    if (s.length > 0) return s;
  }
  return undefined;
};

export const pickOptionalPositiveInt = (
  source: Record<string, unknown> | undefined | null,
  keys: string[],
): number | undefined => {
  const raw = pickOptionalTrimmedString(source, keys);
  if (raw === undefined) return undefined;
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1) return undefined;
  return n;
};
