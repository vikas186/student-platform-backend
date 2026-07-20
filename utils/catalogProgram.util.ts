import {
  alignFeeRangeCurrency,
  currencyCodeForCountry,
} from './universityCatalogImport';

export const FEE_RANGE_PROGRAMS: Record<
  string,
  { courseName: string; degree: string; duration: string }
> = {
  ugBusinessUsdYear: {
    courseName: 'Undergraduate Business Programs',
    degree: 'Undergraduate',
    duration: 'Per year (USD)',
  },
  ugStemUsdYear: {
    courseName: 'Undergraduate STEM Programs',
    degree: 'Undergraduate',
    duration: 'Per year (USD)',
  },
  ugComputerScienceUsdYear: {
    courseName: 'Undergraduate Computer Science Programs',
    degree: 'Undergraduate',
    duration: 'Per year (USD)',
  },
  pgBusinessUsdYear: {
    courseName: 'Postgraduate Business Programs',
    degree: 'Postgraduate',
    duration: 'Per year (USD)',
  },
  pgStemUsdYear: {
    courseName: 'Postgraduate STEM Programs',
    degree: 'Postgraduate',
    duration: 'Per year (USD)',
  },
  pgComputerScienceUsdYear: {
    courseName: 'Postgraduate Computer Science Programs',
    degree: 'Postgraduate',
    duration: 'Per year (USD)',
  },
};

export type ProgramAdmissionRequirements = {
  academicMinPercent?: number | null;
  academicRequirement?: string | null;
  ielts?: number | null;
  ieltsMinBand?: number | null;
  toefl?: number | null;
  pte?: number | null;
  duolingo?: number | null;
  englishRequirement?: string | null;
  workExperienceYears?: number | null;
  workExperienceRequired?: boolean | null;
  workExperienceNotes?: string | null;
  /** Display band for ranges like "NZD 38,310 – 45,000/year" (from sheet imports). */
  feeRange?: string | null;
  feeNote?: string | null;
  /** Optional scrape / CSV import extras stored on Course.admissionRequirements. */
  intake?: string | null;
  applicationFee?: string | null;
  scholarship?: string | null;
  courseUrl?: string | null;
};

export type PublicProgram = {
  id: number | string;
  courseName: string;
  degree: string;
  fee: number | null;
  feeRange?: string | null;
  duration: string;
  source: 'course' | 'scrape' | 'fee_range';
  admissionRequirements?: ProgramAdmissionRequirements | null;
};

export const normalizeUniName = (value: string): string =>
  value
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .split(',')[0]
    .replace(/\b(university|college|institute|of|the|and|through)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');

const significantUniTokens = (value: string): string[] =>
  normalizeUniName(value)
    .split(/\s+/)
    .filter(t => t.length > 2);

export const namesMatch = (catalogName: string, scrapedName: string): boolean => {
  const a = normalizeUniName(catalogName);
  const b = normalizeUniName(scrapedName);
  if (!a || !b) return false;
  if (a === b) return true;

  // Whole-phrase containment only when the shorter side is multi-token
  // (avoids "canterbury" matching "canterbury christ church").
  if (a.length >= 6 && b.length >= 6) {
    const shorter = a.length <= b.length ? a : b;
    const longer = a.length <= b.length ? b : a;
    if (shorter.split(/\s+/).filter(Boolean).length >= 2 && ` ${longer} `.includes(` ${shorter} `)) {
      return true;
    }
  }

  const ta = significantUniTokens(catalogName);
  const tb = significantUniTokens(scrapedName);
  if (!ta.length || !tb.length) return false;
  const setB = new Set(tb);
  const hits = ta.filter(t => setB.has(t));
  if (!hits.length) return false;

  // Short single-token names must be exact (not "auckland" ⊂ "auckland technology"/AUT).
  if (ta.length === 1) return tb.length === 1 && hits.length === 1;
  // Long catalog vs short scrape core should not match on a single shared token.
  if (tb.length === 1 && ta.length > 1) return false;
  return hits.length >= 2;
};

/** Short search needles used to preload scrape courses for a catalog university page. */
export const universityScrapeNeedles = (catalogName: string): string[] => {
  const core = catalogName.replace(/\([^)]*\)/g, ' ').split(',')[0].trim();
  const words = significantUniTokens(catalogName);
  const out = [core];
  if (words[0]) out.push(words[0]);
  if (words.length >= 2) out.push(`${words[0]} ${words[1]}`);
  return [...new Set(out.map(s => s.trim()).filter(s => s.length >= 3))];
};

export const parseFeeNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return null;
  const match = value.replace(/,/g, '').match(/\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
};

export function formatFeeBand(
  fee: number | null,
  feeRange?: string | null,
  country?: string | null,
): string {
  if (feeRange?.trim()) {
    return alignFeeRangeCurrency(feeRange, country) || feeRange.trim();
  }
  if (fee != null && Number.isFinite(fee) && fee > 0) {
    const code = currencyCodeForCountry(country);
    return `${code} ${Math.round(fee).toLocaleString('en-US')}/year`;
  }
  return 'Contact for fee details';
}

const asFiniteNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
};

export const buildAdmissionRequirementsFromScrape = (course: {
  ieltsRequirement?: string | null;
  academicRequirement?: string | null;
  normalizedRequirements?: Record<string, unknown> | null;
}): ProgramAdmissionRequirements | null => {
  const norm = course.normalizedRequirements ?? {};
  const academicText = course.academicRequirement?.trim() || null;
  const englishText = course.ieltsRequirement?.trim() || null;

  const req: ProgramAdmissionRequirements = {
    academicMinPercent: asFiniteNumber(norm.academicMinPercent),
    academicRequirement: academicText,
    ielts: asFiniteNumber(norm.ieltsOverall),
    ieltsMinBand: asFiniteNumber(norm.ieltsMinBand),
    toefl: asFiniteNumber(norm.toeflOverall),
    pte: asFiniteNumber(norm.pteOverall),
    duolingo: asFiniteNumber(norm.duolingoOverall),
    englishRequirement: englishText,
    workExperienceYears: asFiniteNumber(norm.workExperienceYears),
    workExperienceRequired:
      typeof norm.workExperienceRequired === 'boolean' ? norm.workExperienceRequired : null,
    workExperienceNotes: null,
  };

  // Fallback parse from free text when normalizer missed values
  if (req.ielts == null && englishText) {
    const m = englishText.match(/ielts\s*(\d(?:\.\d)?)/i);
    if (m) req.ielts = parseFloat(m[1]);
  }
  if (req.toefl == null && englishText) {
    const m = englishText.match(/toefl(?:\s*iBT)?\s*(\d{2,3})/i);
    if (m) req.toefl = parseInt(m[1], 10);
  }
  if (req.pte == null && englishText) {
    const m = englishText.match(/pte(?:\s*academic)?\s*(\d{2,3})/i);
    if (m) req.pte = parseInt(m[1], 10);
  }
  if (req.duolingo == null && englishText) {
    const m = englishText.match(/duolingo(?:\s*english(?:\s*test)?)?\s*(?:DET)?\s*(\d{2,3})/i);
    if (m) req.duolingo = parseInt(m[1], 10);
  }
  if (req.academicMinPercent == null && academicText) {
    const m =
      academicText.match(/(\d{2,3}(?:\.\d+)?)\s*%/) ||
      academicText.match(/(?:minimum|min\.?|at least)\s*(?:of\s*)?(\d{2,3}(?:\.\d+)?)\s*(?:percent|percentage|%)/i);
    if (m) req.academicMinPercent = parseFloat(m[1]);
  }
  if (req.workExperienceYears == null && academicText) {
    const m = academicText.match(
      /(\d+(?:\.\d+)?)\s*(?:\+\s*)?(?:years?|yrs?)\s+(?:of\s+)?(?:work\s+)?experience/i,
    );
    if (m) {
      req.workExperienceYears = parseFloat(m[1]);
      req.workExperienceRequired = true;
    }
  }

  const hasAny =
    req.academicMinPercent != null ||
    Boolean(req.academicRequirement) ||
    req.ielts != null ||
    req.toefl != null ||
    req.pte != null ||
    req.duolingo != null ||
    Boolean(req.englishRequirement) ||
    req.workExperienceYears != null ||
    req.workExperienceRequired === true;

  return hasAny ? req : null;
};

export const mapDbCourse = (
  course: {
    id: number;
    courseName: string;
    degree: string;
    fee: number;
    duration: string;
    admissionRequirements?: ProgramAdmissionRequirements | null;
  },
  country?: string | null,
): PublicProgram => {
  const rawRange = course.admissionRequirements?.feeRange?.trim() || null;
  const feeRange = alignFeeRangeCurrency(rawRange, country) || rawRange;
  const feeNum =
    typeof course.fee === 'number' && Number.isFinite(course.fee) && course.fee > 0
      ? course.fee
      : null;
  return {
    id: course.id,
    courseName: course.courseName,
    degree: course.degree,
    fee: feeNum,
    feeRange,
    duration: course.duration,
    source: 'course',
    admissionRequirements: course.admissionRequirements
      ? { ...course.admissionRequirements, feeRange: feeRange || course.admissionRequirements.feeRange }
      : null,
  };
};

export const mapScrapedCourse = (
  course: {
    id: string;
    courseName: string;
    studyLevel: string | null;
    tuitionFee: string | null;
    duration: string | null;
    ieltsRequirement?: string | null;
    academicRequirement?: string | null;
    normalizedTuition?: Record<string, unknown> | null;
    normalizedRequirements?: Record<string, unknown> | null;
  },
  universityAdmissionFallback?: string | null,
  country?: string | null,
): PublicProgram => {
  const normTuition = course.normalizedTuition ?? {};
  const amount = asFiniteNumber(normTuition.amount);
  const minAmount = asFiniteNumber(normTuition.minAmount);
  const maxAmount = asFiniteNumber(normTuition.maxAmount);
  const storedCurrency =
    typeof normTuition.currency === 'string' && normTuition.currency.trim()
      ? String(normTuition.currency).trim().toUpperCase()
      : null;
  const currency = storedCurrency || currencyCodeForCountry(country);

  let feeRange = course.tuitionFee || null;
  if (minAmount != null && maxAmount != null) {
    feeRange = `${currency} ${Math.round(minAmount).toLocaleString('en-US')}–${Math.round(maxAmount).toLocaleString('en-US')}/year`;
  } else if (amount != null && amount > 0) {
    feeRange = `${currency} ${Math.round(amount).toLocaleString('en-US')}/year`;
  }
  feeRange = alignFeeRangeCurrency(feeRange, country) || feeRange;

  let admissionRequirements = buildAdmissionRequirementsFromScrape(course);
  if (!admissionRequirements && universityAdmissionFallback?.trim()) {
    admissionRequirements = buildAdmissionRequirementsFromScrape({
      academicRequirement: universityAdmissionFallback,
      ieltsRequirement: universityAdmissionFallback,
    });
  }

  const fee =
    amount != null && amount > 0
      ? amount
      : (() => {
          const parsed = parseFeeNumber(course.tuitionFee);
          return parsed != null && parsed > 0 ? parsed : null;
        })();

  return {
    id: course.id,
    courseName: course.courseName,
    degree: course.studyLevel || 'Program',
    fee,
    feeRange,
    duration: course.duration || '—',
    source: 'scrape',
    admissionRequirements,
  };
};

export const programsFromFeeRanges = (ranges: Record<string, unknown> | null): PublicProgram[] => {
  if (!ranges) return [];

  return Object.entries(FEE_RANGE_PROGRAMS)
    .filter(([key]) => {
      const value = ranges[key];
      return value != null && String(value).trim() !== '';
    })
    .map(([key, meta]) => ({
      id: `fee-${key}`,
      courseName: meta.courseName,
      degree: meta.degree,
      fee: null,
      feeRange: String(ranges[key]),
      duration: meta.duration,
      source: 'fee_range' as const,
      admissionRequirements: null,
    }));
};

/** Priority when the same programme exists in catalog sheet + scrape (+ fee matrix). */
const SOURCE_PRIORITY: Record<PublicProgram['source'], number> = {
  course: 3,
  scrape: 2,
  fee_range: 1,
};

export const normalizeProgramTitle = (name: string): string =>
  name
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');

/** Collapse UG/PG wording so "UG" and "Undergraduate" dedupe together. */
export const normalizeDegreeBand = (degree: string): string => {
  const d = degree.toLowerCase().trim();
  if (!d || d === '—' || d === 'program' || d === 'programme') return 'program';
  if (/undergrad|bachelor|\bug\b|^ba\b|^b\.?a\.?\b|^bsc|^b\.?sc|^beng|^b\.?eng|^bba|^b\.?s\.?\b/.test(d)) {
    return 'ug';
  }
  if (
    /postgrad|master|\bpg\b|graduate|^mba|^msc|^m\.?sc|^meng|^m\.?eng|^m\.?s\.?\b|phd|doctoral|llm/.test(d)
  ) {
    return 'pg';
  }
  return normalizeProgramTitle(d);
};

/** Prefer band from programme title so mislabeled scrape studyLevel can't block dedupe. */
export const inferBandFromTitle = (courseName: string): 'ug' | 'pg' | null => {
  const n = courseName.toLowerCase();
  if (/\b(master|masters|mba|m\.?sc|m\.?eng|m\.?s\.?\b|postgrad|phd|doctor|llm|graduate diploma)\b/.test(n)) {
    return 'pg';
  }
  if (/\b(bachelor|bachelors|b\.?sc|b\.?a\b|b\.?eng|bba|undergrad|associate)\b/.test(n)) {
    return 'ug';
  }
  return null;
};

/** Identity key across sources — must NOT include `source` or sheet+scrape duplicates both appear. */
export const programDedupeKey = (program: Pick<PublicProgram, 'courseName' | 'degree'>): string => {
  const title = normalizeProgramTitle(program.courseName);
  const band = inferBandFromTitle(program.courseName) || normalizeDegreeBand(program.degree);
  return `${title}::${band}`;
};

const admissionRichness = (req: ProgramAdmissionRequirements | null | undefined): number => {
  if (!req) return 0;
  let n = 0;
  if (req.academicRequirement?.trim()) n += 2;
  if (req.englishRequirement?.trim()) n += 2;
  if (req.ielts != null) n += 1;
  if (req.ieltsMinBand != null) n += 1;
  if (req.toefl != null) n += 1;
  if (req.pte != null) n += 1;
  if (req.duolingo != null) n += 1;
  if (req.academicMinPercent != null) n += 1;
  if (req.applicationFee?.trim()) n += 1;
  if (req.intake?.trim()) n += 1;
  return n;
};

const mergeAdmissionRequirements = (
  primary: ProgramAdmissionRequirements | null | undefined,
  secondary: ProgramAdmissionRequirements | null | undefined,
): ProgramAdmissionRequirements | null => {
  if (!primary && !secondary) return null;
  if (!primary) return secondary ?? null;
  if (!secondary) return primary;
  const pick = <T,>(a: T | null | undefined, b: T | null | undefined): T | null | undefined =>
    a != null && a !== '' ? a : b;
  return {
    academicMinPercent: pick(primary.academicMinPercent, secondary.academicMinPercent) ?? null,
    academicRequirement: pick(primary.academicRequirement, secondary.academicRequirement) ?? null,
    ielts: pick(primary.ielts, secondary.ielts) ?? null,
    ieltsMinBand: pick(primary.ieltsMinBand, secondary.ieltsMinBand) ?? null,
    toefl: pick(primary.toefl, secondary.toefl) ?? null,
    pte: pick(primary.pte, secondary.pte) ?? null,
    duolingo: pick(primary.duolingo, secondary.duolingo) ?? null,
    englishRequirement: pick(primary.englishRequirement, secondary.englishRequirement) ?? null,
    workExperienceYears: pick(primary.workExperienceYears, secondary.workExperienceYears) ?? null,
    workExperienceRequired: pick(primary.workExperienceRequired, secondary.workExperienceRequired) ?? null,
    workExperienceNotes: pick(primary.workExperienceNotes, secondary.workExperienceNotes) ?? null,
    intake: pick(primary.intake, secondary.intake) ?? null,
    applicationFee: pick(primary.applicationFee, secondary.applicationFee) ?? null,
    scholarship: pick(primary.scholarship, secondary.scholarship) ?? null,
    courseUrl: pick(primary.courseUrl, secondary.courseUrl) ?? null,
    feeRange: pick(primary.feeRange, secondary.feeRange) ?? null,
    feeNote: pick(primary.feeNote, secondary.feeNote) ?? null,
  };
};

/**
 * Collapse duplicate programmes across catalog / scrape / fee_range.
 * Sheet (`course`) always wins over scrape for the same title; missing fee/admission
 * fields on the winner are filled from the loser so students still see requirements.
 */
export const dedupePrograms = (programs: PublicProgram[]): PublicProgram[] => {
  const byKey = new Map<string, PublicProgram>();

  for (const program of programs) {
    const key = programDedupeKey(program);
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, program);
      continue;
    }

    const incomingPri = SOURCE_PRIORITY[program.source];
    const existingPri = SOURCE_PRIORITY[existing.source];
    const preferIncoming =
      incomingPri > existingPri ||
      (incomingPri === existingPri &&
        admissionRichness(program.admissionRequirements) > admissionRichness(existing.admissionRequirements));

    const winner = preferIncoming ? program : existing;
    const loser = preferIncoming ? existing : program;

    byKey.set(key, {
      ...winner,
      fee:
        winner.fee != null && Number.isFinite(winner.fee) && winner.fee > 0
          ? winner.fee
          : loser.fee != null && Number.isFinite(loser.fee) && loser.fee > 0
            ? loser.fee
            : winner.fee ?? loser.fee ?? null,
      feeRange: winner.feeRange?.trim() ? winner.feeRange : loser.feeRange ?? null,
      duration:
        winner.duration && winner.duration !== '—' ? winner.duration : loser.duration || winner.duration,
      admissionRequirements: mergeAdmissionRequirements(
        winner.admissionRequirements,
        loser.admissionRequirements,
      ),
    });
  }

  return Array.from(byKey.values());
};

export const buildProgramsForUniversity = (
  catalogName: string,
  dbCourses: Array<{
    id: number;
    courseName: string;
    degree: string;
    fee: number;
    duration: string;
    admissionRequirements?: ProgramAdmissionRequirements | null;
  }>,
  scrapedCourses: Array<{
    id: string;
    courseName: string;
    studyLevel: string | null;
    tuitionFee: string | null;
    duration: string | null;
    universityName: string;
    ieltsRequirement?: string | null;
    academicRequirement?: string | null;
    normalizedTuition?: Record<string, unknown> | null;
    normalizedRequirements?: Record<string, unknown> | null;
  }>,
  programFeeRanges: Record<string, unknown> | null,
  scrapeUniversityAdmissions: Array<{
    universityName: string;
    admissionRequirements?: string | null;
    acceptanceCriteria?: string | null;
  }> = [],
  country?: string | null,
): PublicProgram[] => {
  const uniAdmissionFor = (scrapedUniName: string): string | null => {
    for (const u of scrapeUniversityAdmissions) {
      if (!namesMatch(catalogName, u.universityName) && !namesMatch(scrapedUniName, u.universityName)) {
        continue;
      }
      const text = [u.admissionRequirements, u.acceptanceCriteria].filter(Boolean).join('\n').trim();
      if (text) return text;
    }
    return null;
  };

  const fromDb = dbCourses.map(c => mapDbCourse(c, country));
  // Scrape fills gaps only — same title as a sheet/catalog course is dropped in dedupePrograms
  // (catalog `course` source wins; admission/fee gaps may be filled from scrape).
  const fromScrape = scrapedCourses
    .filter(row => namesMatch(catalogName, row.universityName))
    .map(row => mapScrapedCourse(row, uniAdmissionFor(row.universityName), country));

  const namedPrograms = dedupePrograms([...fromDb, ...fromScrape]);
  if (namedPrograms.length > 0) return namedPrograms;

  return programsFromFeeRanges(programFeeRanges);
};

/** Map user field input to program_fee_ranges JSON keys */
export const fieldToFeeRangeKeys = (field: string, level: string): string[] => {
  const f = field.toLowerCase();
  const isUg = /undergrad|bachelor|ug/i.test(level);
  const isPg = /postgrad|master|pg|graduate/i.test(level);
  const prefix = isPg ? 'pg' : isUg ? 'ug' : '';

  const keys: string[] = [];
  if (/business|commerce|mba|management|finance/i.test(f)) {
    keys.push(`${prefix || 'pg'}BusinessUsdYear`, `${prefix || 'ug'}BusinessUsdYear`);
  }
  if (/computer|software|cs|it|tech|data/i.test(f)) {
    keys.push(`${prefix || 'pg'}ComputerScienceUsdYear`, `${prefix || 'ug'}ComputerScienceUsdYear`);
  }
  if (/stem|engineering|science|math/i.test(f)) {
    keys.push(`${prefix || 'pg'}StemUsdYear`, `${prefix || 'ug'}StemUsdYear`);
  }
  if (/engineer/i.test(f) && !keys.length) {
    keys.push(`${prefix || 'pg'}StemUsdYear`, `${prefix || 'ug'}StemUsdYear`);
  }
  // Do not fall back to every fee bucket — those labels ("Undergraduate STEM Programs")
  // are fee-matrix placeholders, not real course titles for Explore mapping.
  return [...new Set(keys.filter(k => k in FEE_RANGE_PROGRAMS))];
};
