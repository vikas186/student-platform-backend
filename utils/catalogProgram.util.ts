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

export type PublicProgram = {
  id: number | string;
  courseName: string;
  degree: string;
  fee: number | null;
  feeRange?: string | null;
  duration: string;
  source: 'course' | 'scrape' | 'fee_range';
};

export const normalizeUniName = (value: string): string =>
  value
    .toLowerCase()
    .replace(/\b(university|college|institute|of|the)\b/g, ' ')
    .replace(/[^a-z0-9]/g, '');

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

export const mapDbCourse = (course: {
  id: number;
  courseName: string;
  degree: string;
  fee: number;
  duration: string;
}): PublicProgram => ({
  id: course.id,
  courseName: course.courseName,
  degree: course.degree,
  fee: course.fee,
  duration: course.duration,
  source: 'course',
});

export const mapScrapedCourse = (course: {
  id: string;
  courseName: string;
  studyLevel: string | null;
  tuitionFee: string | null;
  duration: string | null;
}): PublicProgram => ({
  id: course.id,
  courseName: course.courseName,
  degree: course.studyLevel || 'Program',
  fee: parseFeeNumber(course.tuitionFee),
  feeRange: course.tuitionFee || null,
  duration: course.duration || '—',
  source: 'scrape',
});

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
  }>,
  scrapedCourses: Array<{
    id: string;
    courseName: string;
    studyLevel: string | null;
    tuitionFee: string | null;
    duration: string | null;
    universityName: string;
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
  if (keys.length === 0) {
    return Object.keys(FEE_RANGE_PROGRAMS);
  }
  return [...new Set(keys.filter(k => k in FEE_RANGE_PROGRAMS))];
};
