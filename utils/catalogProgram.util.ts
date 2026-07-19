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
    .replace(/\b(university|college|institute|of|the)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, '');

export const namesMatch = (catalogName: string, scrapedName: string): boolean => {
  const a = normalizeUniName(catalogName);
  const b = normalizeUniName(scrapedName);
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.length >= 8 && b.length >= 8 && (a.includes(b) || b.includes(a))) return true;
  return catalogName.toLowerCase().trim() === scrapedName.toLowerCase().trim();
};

export const parseFeeNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return null;
  const match = value.replace(/,/g, '').match(/\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
};

export const formatFeeBand = (fee: number | null, feeRange?: string | null): string => {
  if (feeRange?.trim()) return feeRange.trim();
  if (fee != null && Number.isFinite(fee)) {
    return `$${Math.round(fee).toLocaleString('en-US')}/year`;
  }
  return 'Contact for fee details';
};

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
    const m = academicText.match(/(\d{2,3}(?:\.\d+)?)\s*%/);
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

export const mapDbCourse = (course: {
  id: number;
  courseName: string;
  degree: string;
  fee: number;
  duration: string;
  admissionRequirements?: ProgramAdmissionRequirements | null;
}): PublicProgram => ({
  id: course.id,
  courseName: course.courseName,
  degree: course.degree,
  fee: course.fee,
  duration: course.duration,
  source: 'course',
  admissionRequirements: course.admissionRequirements ?? null,
});

export const mapScrapedCourse = (course: {
  id: string;
  courseName: string;
  studyLevel: string | null;
  tuitionFee: string | null;
  duration: string | null;
  ieltsRequirement?: string | null;
  academicRequirement?: string | null;
  normalizedTuition?: Record<string, unknown> | null;
  normalizedRequirements?: Record<string, unknown> | null;
}): PublicProgram => {
  const normTuition = course.normalizedTuition ?? {};
  const amount = asFiniteNumber(normTuition.amount);
  const minAmount = asFiniteNumber(normTuition.minAmount);
  const maxAmount = asFiniteNumber(normTuition.maxAmount);
  const currency = typeof normTuition.currency === 'string' ? normTuition.currency : 'USD';

  let feeRange = course.tuitionFee || null;
  if (minAmount != null && maxAmount != null) {
    feeRange = `${currency} ${Math.round(minAmount).toLocaleString('en-US')}–${Math.round(maxAmount).toLocaleString('en-US')}/year`;
  } else if (amount != null) {
    feeRange = `${currency} ${Math.round(amount).toLocaleString('en-US')}/year`;
  }

  return {
    id: course.id,
    courseName: course.courseName,
    degree: course.studyLevel || 'Program',
    fee: amount ?? parseFeeNumber(course.tuitionFee),
    feeRange,
    duration: course.duration || '—',
    source: 'scrape',
    admissionRequirements: buildAdmissionRequirementsFromScrape(course),
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

export const dedupePrograms = (programs: PublicProgram[]): PublicProgram[] => {
  const seen = new Set<string>();
  const result: PublicProgram[] = [];

  for (const program of programs) {
    const key = `${program.courseName}::${program.degree}::${program.source}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(program);
  }

  return result;
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
): PublicProgram[] => {
  const fromDb = dbCourses.map(mapDbCourse);
  const fromScrape = scrapedCourses
    .filter(row => namesMatch(catalogName, row.universityName))
    .map(mapScrapedCourse);

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
