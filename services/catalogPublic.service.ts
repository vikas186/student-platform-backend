import { Op } from 'sequelize';
import { db } from '../config/database';

const PUBLIC_UNIVERSITY_ATTRIBUTES = [
  'id',
  'name',
  'country',
  'status',
  'programFeeRanges',
  'createdAt',
  'updatedAt',
] as const;

const PROGRAM_ATTRIBUTES = ['id', 'courseName', 'degree', 'fee', 'duration'] as const;

const SCRAPED_PROGRAM_ATTRIBUTES = [
  'id',
  'courseName',
  'studyLevel',
  'tuitionFee',
  'duration',
  'universityName',
] as const;

const FEE_RANGE_PROGRAMS: Record<
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

export type PublicUniversitiesQuery = {
  search?: string;
  country?: string;
  page?: string | number;
  limit?: string | number;
};

const normalizeUniName = (value: string): string =>
  value
    .toLowerCase()
    .replace(/\b(university|college|institute|of|the)\b/g, ' ')
    .replace(/[^a-z0-9]/g, '');

const namesMatch = (catalogName: string, scrapedName: string): boolean => {
  const a = normalizeUniName(catalogName);
  const b = normalizeUniName(scrapedName);
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.length >= 8 && b.length >= 8 && (a.includes(b) || b.includes(a))) return true;
  return catalogName.toLowerCase().trim() === scrapedName.toLowerCase().trim();
};

const parseFeeNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return null;
  const match = value.replace(/,/g, '').match(/\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
};

const mapDbCourse = (course: {
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

const mapScrapedCourse = (course: {
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

const programsFromFeeRanges = (ranges: Record<string, unknown> | null): PublicProgram[] => {
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

const dedupePrograms = (programs: PublicProgram[]): PublicProgram[] => {
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

const buildProgramsForUniversity = (
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

export const listPublicUniversitiesWithPrograms = async (query: PublicUniversitiesQuery) => {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
  const offset = (page - 1) * limit;

  const where: Record<string, unknown> = { status: true };
  const andClauses: Record<string, unknown>[] = [];

  if (query.country?.trim()) {
    andClauses.push({ country: { [Op.iLike]: `%${query.country.trim()}%` } });
  }
  if (query.search?.trim()) {
    const term = `%${query.search.trim()}%`;
    andClauses.push({
      [Op.or]: [{ name: { [Op.iLike]: term } }, { country: { [Op.iLike]: term } }],
    });
  }
  if (andClauses.length > 0) {
    (where as Record<symbol, unknown>)[Op.and] = andClauses;
  }

  const [{ rows, count }, scrapedCourses] = await Promise.all([
    db.University.findAndCountAll({
      where,
      attributes: [...PUBLIC_UNIVERSITY_ATTRIBUTES],
      include: [
        {
          model: db.Course,
          as: 'courses',
          attributes: [...PROGRAM_ATTRIBUTES],
          required: false,
        },
      ],
      order: [
        ['name', 'ASC'],
        [{ model: db.Course, as: 'courses' }, 'courseName', 'ASC'],
      ],
      limit,
      offset,
      distinct: true,
    }),
    db.ScrapedCourse.findAll({
      where: {
        recordStatus: 'cleaned',
        cleaningStatus: { [Op.in]: ['high_quality', 'needs_review'] },
        isDuplicate: false,
      },
      attributes: [...SCRAPED_PROGRAM_ATTRIBUTES],
      order: [['universityName', 'ASC'], ['courseName', 'ASC']],
    }),
  ]);

  const scrapedPlain = scrapedCourses.map(row =>
    row.get({ plain: true }),
  ) as Array<{
    id: string;
    courseName: string;
    studyLevel: string | null;
    tuitionFee: string | null;
    duration: string | null;
    universityName: string;
  }>;

  const universities = rows.map(row => {
    const plain = row.get({ plain: true }) as {
      id: number;
      name: string;
      country: string;
      status: boolean;
      programFeeRanges: Record<string, unknown> | null;
      createdAt: Date;
      updatedAt: Date;
      courses?: Array<{
        id: number;
        courseName: string;
        degree: string;
        fee: number;
        duration: string;
      }>;
    };

    const programs = buildProgramsForUniversity(
      plain.name,
      plain.courses ?? [],
      scrapedPlain,
      plain.programFeeRanges,
    );

    return {
      id: plain.id,
      name: plain.name,
      country: plain.country,
      status: plain.status,
      programFeeRanges: plain.programFeeRanges,
      programsCount: programs.length,
      programs,
      createdAt: plain.createdAt,
      updatedAt: plain.updatedAt,
    };
  });

  return { universities, page, limit, total: count };
};
