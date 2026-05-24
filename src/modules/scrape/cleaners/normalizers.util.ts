import type { NormalizedDuration, NormalizedRequirements, NormalizedTuition } from './course.types';

const MONTH_MAP: Record<string, string> = {
  jan: 'January',
  feb: 'February',
  mar: 'March',
  apr: 'April',
  may: 'May',
  jun: 'June',
  jul: 'July',
  aug: 'August',
  sep: 'September',
  sept: 'September',
  oct: 'October',
  nov: 'November',
  dec: 'December',
};

export const normalizeText = (value: unknown): string | null => {
  if (value == null) return null;
  const s = String(value).replace(/\s+/g, ' ').trim();
  return s.length ? s : null;
};

export const normalizeCountry = (value: string): string | null => {
  const s = normalizeText(value);
  if (!s) return null;
  const map: Record<string, string> = {
    usa: 'United States',
    us: 'United States',
    uk: 'United Kingdom',
    uae: 'United Arab Emirates',
    中国: 'China',
    china: 'China',
  };
  const key = s.toLowerCase();
  return map[key] || s;
};

export const normalizeDegreeLevel = (value: string): string | null => {
  const s = normalizeText(value);
  if (!s) return null;
  if (/\b(phd|doctorate|doctoral)\b/i.test(s)) return 'PhD';
  if (/\b(master|m\.?\s?sc|mba|postgraduate)\b/i.test(s)) return 'Master';
  if (/\b(bachelor|b\.?\s?sc|undergraduate|ug)\b/i.test(s)) return 'Bachelor';
  if (/\b(diploma|associate|certificate)\b/i.test(s)) return 'Diploma';
  return s;
};

const parseAmount = (raw: string): number | null => {
  const cleaned = raw.replace(/,/g, '');
  const m = cleaned.match(/(\d+(?:\.\d+)?)/);
  if (!m) return null;
  const n = parseFloat(m[1]);
  return Number.isFinite(n) ? n : null;
};

const detectCurrency = (raw: string): string | null => {
  const hay = raw.toUpperCase();
  if (/\bCAD\b|CA\$|C\$/.test(hay)) return 'CAD';
  if (/\bAUD\b|AU\$|A\$/.test(hay)) return 'AUD';
  if (/\bUSD\b|US\$/.test(hay)) return 'USD';
  if (/\bGBP\b|£/.test(raw)) return 'GBP';
  if (/\bEUR\b|€/.test(raw)) return 'EUR';
  if (/\bINR\b|₹/.test(raw)) return 'INR';
  if (/\bCNY\b|¥|RMB/.test(raw)) return 'CNY';
  if (/\bNZD\b/.test(hay)) return 'NZD';
  if (/\$/.test(raw) && !/CA\$|AU\$|US\$/.test(raw)) return 'USD';
  return null;
};

const detectPeriod = (raw: string): NormalizedTuition['period'] => {
  if (/per\s*year|annual|yearly|\/\s*yr/i.test(raw)) return 'yearly';
  if (/per\s*semester|semester/i.test(raw)) return 'semester';
  if (/per\s*month|monthly/i.test(raw)) return 'monthly';
  if (/total|overall/i.test(raw)) return 'total';
  return 'unknown';
};

export const normalizeTuition = (value: string): NormalizedTuition | null => {
  const raw = normalizeText(value);
  if (!raw) return null;

  const currency = detectCurrency(raw);
  const period = detectPeriod(raw);

  const range = raw.match(/(\d[\d,]*(?:\.\d+)?)\s*[-–—to]+\s*(\d[\d,]*(?:\.\d+)?)/i);
  if (range) {
    return {
      amount: null,
      minAmount: parseAmount(range[1]),
      maxAmount: parseAmount(range[2]),
      currency,
      period,
      raw,
    };
  }

  return {
    amount: parseAmount(raw),
    currency,
    period,
    raw,
  };
};

export const normalizeDuration = (value: string): NormalizedDuration | null => {
  const raw = normalizeText(value);
  if (!raw) return null;

  let mode: NormalizedDuration['mode'] = 'unknown';
  if (/full[- ]?time/i.test(raw)) mode = 'full-time';
  else if (/part[- ]?time/i.test(raw)) mode = 'part-time';
  else if (/online/i.test(raw)) mode = 'online';

  const yearM = raw.match(/(\d+(?:\.\d+)?)\s*(years?|yrs?)/i);
  if (yearM) {
    return { value: parseFloat(yearM[1]), unit: 'years', mode, raw };
  }
  const monthM = raw.match(/(\d+(?:\.\d+)?)\s*(months?|mos?)/i);
  if (monthM) {
    return { value: parseFloat(monthM[1]), unit: 'months', mode, raw };
  }
  const weekM = raw.match(/(\d+(?:\.\d+)?)\s*(weeks?)/i);
  if (weekM) {
    return { value: parseFloat(weekM[1]), unit: 'weeks', mode, raw };
  }
  const semM = raw.match(/(\d+(?:\.\d+)?)\s*(semesters?)/i);
  if (semM) {
    return { value: parseFloat(semM[1]), unit: 'semesters', mode, raw };
  }

  return { value: null, unit: 'unknown', mode, raw };
};

export const normalizeIntakes = (value: string): string[] => {
  const raw = normalizeText(value);
  if (!raw) return [];

  const parts = raw.split(/[,，;；|\/、]+/).map(p => p.trim()).filter(Boolean);
  const out: string[] = [];

  for (const part of parts) {
    if (/fall|spring|summer|winter/i.test(part)) {
      out.push(part);
      continue;
    }
    const m = part.match(/^([A-Za-z]{3,9})\b/i);
    if (m) {
      const key = m[1].toLowerCase().slice(0, 4);
      out.push(MONTH_MAP[key] || part);
    } else {
      out.push(part);
    }
  }

  return [...new Set(out)];
};

export const normalizeEnglishRequirements = (value: string): NormalizedRequirements | null => {
  const raw = normalizeText(value);
  if (!raw) return null;

  const out: NormalizedRequirements = { raw };

  const ielts = raw.match(/ielts\s*(\d(?:\.\d)?)/i);
  if (ielts) out.ieltsOverall = parseFloat(ielts[1]);

  const band = raw.match(/(?:band|no\s+band)\s*(?:less\s+than|below|under)?\s*(\d(?:\.\d)?)/i);
  if (band) out.ieltsMinBand = parseFloat(band[1]);

  const toefl = raw.match(/toefl(?:\s*iBT)?\s*(\d{2,3})/i);
  if (toefl) out.toeflOverall = parseInt(toefl[1], 10);

  const pte = raw.match(/pte(?:\s*academic)?\s*(\d{2,3})/i);
  if (pte) out.pteOverall = parseInt(pte[1], 10);

  if (!out.ieltsOverall && !out.toeflOverall && !out.pteOverall) return null;
  return out;
};

export const normalizeDeadline = (value: string): string | null => normalizeText(value);

export const normalizeUrl = (value: string, baseUrl?: string): string | null => {
  const s = normalizeText(value);
  if (!s) return null;
  try {
    return new URL(s, baseUrl || undefined).toString();
  } catch {
    return null;
  }
};
