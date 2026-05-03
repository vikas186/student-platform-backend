/**
 * Human-readable offer letter reference: **`OFR-{n}`** (e.g. `OFR-201`).
 * Uppercase `OFR`, hyphen, numeric suffix without fixed-width padding (same style as `APP-10241`).
 */
export const formatOfferReference = (seq: number | string): string => {
  const n = typeof seq === 'string' ? parseInt(seq, 10) : Math.trunc(Number(seq));
  if (!Number.isFinite(n) || n < 0) {
    throw new Error('Invalid offer letter sequence');
  }
  return `OFR-${n}`;
};

/** Normalize user input to canonical `OFR-201` form or null if invalid. Leading zeros in the suffix are stripped. */
export const normalizeOfferReference = (input: string): string | null => {
  const t = String(input || '').trim();
  const m = /^OFR-0*(\d+)$/i.exec(t);
  return m ? `OFR-${m[1]}` : null;
};
