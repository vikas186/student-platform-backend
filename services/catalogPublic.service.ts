import { Op } from 'sequelize';
import { db } from '../config/database';
import {
  buildProgramsForUniversity,
  dedupePrograms,
  mapDbCourse,
  mapScrapedCourse,
  namesMatch,
  parseFeeNumber,
  programsFromFeeRanges,
  type PublicProgram,
} from '../utils/catalogProgram.util';

export type { PublicProgram } from '../utils/catalogProgram.util';

const PUBLIC_UNIVERSITY_ATTRIBUTES = [
  'id',
  'name',
  'country',
  'status',
  'programFeeRanges',
  'createdAt',
  'updatedAt',
] as const;

const PROGRAM_ATTRIBUTES = [
  'id',
  'courseName',
  'degree',
  'fee',
  'duration',
  'admissionRequirements',
] as const;

const SCRAPED_PROGRAM_ATTRIBUTES = [
  'id',
  'courseName',
  'studyLevel',
  'tuitionFee',
  'duration',
  'universityName',
  'ieltsRequirement',
  'academicRequirement',
  'normalizedTuition',
  'normalizedRequirements',
] as const;

export type PublicUniversitiesQuery = {
  search?: string;
  country?: string;
  page?: string | number;
  limit?: string | number;
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

  const { rows, count } = await db.University.findAndCountAll({
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
  });

  const pageNames = rows.map(row => (row.get('name') as string) || '');
  const scrapedWhere: Record<string, unknown> = {
    recordStatus: 'cleaned',
    cleaningStatus: { [Op.in]: ['high_quality', 'needs_review'] },
    isDuplicate: false,
  };
  if (pageNames.length) {
    (scrapedWhere as Record<symbol, unknown>)[Op.or] = pageNames.map(name => ({
      universityName: { [Op.iLike]: name },
    }));
  }

  const scrapedRows =
    pageNames.length > 0
      ? await db.ScrapedCourse.findAll({
          where: scrapedWhere,
          attributes: [...SCRAPED_PROGRAM_ATTRIBUTES],
          order: [
            ['universityName', 'ASC'],
            ['courseName', 'ASC'],
          ],
        })
      : [];

  const scrapedPlain = scrapedRows.map(row =>
    row.get({ plain: true }),
  ) as Array<{
    id: string;
    courseName: string;
    studyLevel: string | null;
    tuitionFee: string | null;
    duration: string | null;
    universityName: string;
    ieltsRequirement: string | null;
    academicRequirement: string | null;
    normalizedTuition: Record<string, unknown> | null;
    normalizedRequirements: Record<string, unknown> | null;
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
        admissionRequirements?: Record<string, unknown> | null;
      }>;
    };

    const programs = buildProgramsForUniversity(
      plain.name,
      (plain.courses ?? []).map(c => ({
        ...c,
        admissionRequirements: (c.admissionRequirements as any) ?? null,
      })),
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

  // Fee-matrix / scrape imports can create multiple University rows with the same name.
  // Collapse them for public dropdowns so each name (+ country) appears once.
  const deduped = dedupeUniversitiesByNameCountry(universities);
  const removed = universities.length - deduped.length;

  return {
    universities: deduped,
    page,
    limit,
    total: Math.max(0, count - removed),
  };
};

type PublicUniversityRow = {
  id: number;
  name: string;
  country: string;
  status: boolean;
  programFeeRanges: Record<string, unknown> | null;
  programsCount: number;
  programs: PublicProgram[];
  createdAt: Date;
  updatedAt: Date;
};

const universityNameCountryKey = (name: string, country: string): string =>
  `${name.trim().toLowerCase().replace(/\s+/g, ' ')}||${country.trim().toLowerCase()}`;

const dedupeUniversitiesByNameCountry = (rows: PublicUniversityRow[]): PublicUniversityRow[] => {
  const byKey = new Map<string, PublicUniversityRow>();

  for (const uni of rows) {
    const key = universityNameCountryKey(uni.name, uni.country || '');
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, uni);
      continue;
    }

    const mergedPrograms = dedupePrograms([...existing.programs, ...uni.programs]);
    const preferIncoming =
      (uni.programsCount ?? 0) > (existing.programsCount ?? 0) ||
      (uni.programsCount === existing.programsCount && uni.id > existing.id);

    const winner = preferIncoming ? uni : existing;
    byKey.set(key, {
      ...winner,
      programs: mergedPrograms,
      programsCount: mergedPrograms.length,
      programFeeRanges: winner.programFeeRanges ?? existing.programFeeRanges ?? uni.programFeeRanges,
    });
  }

  return Array.from(byKey.values()).sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
  );
};

// Re-export for tests / other modules
export { mapDbCourse, mapScrapedCourse, namesMatch, parseFeeNumber, programsFromFeeRanges };
