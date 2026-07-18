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

const universityNameKey = (name: string): string =>
  name.trim().toLowerCase().replace(/\s+/g, ' ');

/** True when a "country" cell looks like a program title (bad catalog import). */
export const looksLikeProgramAsCountry = (value: string): boolean => {
  const v = value.trim();
  if (!v) return false;
  if (/^(BA|BSc|BEng|BBA|MA|MSc|MBA|MEng|PhD|LLB|LLM|PGDip|PGCert)\b/i.test(v)) return true;
  if (/\(Hons\)|Foundation Year|Bachelor of|Master of|Diploma in|Certificate in/i.test(v)) return true;
  if (v.length > 64) return true;
  return false;
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

  // One row per institution name (catalog imports sometimes created one row per program).
  const distinctNameRows = (await db.University.findAll({
    attributes: [
      [db.sequelize.fn('MIN', db.sequelize.col('id')), 'id'],
      [db.sequelize.fn('MIN', db.sequelize.col('name')), 'name'],
    ],
    where,
    group: [db.sequelize.fn('LOWER', db.sequelize.fn('TRIM', db.sequelize.col('name')))],
    order: [[db.sequelize.fn('MIN', db.sequelize.col('name')), 'ASC']],
    limit,
    offset,
    raw: true,
  })) as Array<{ id: number; name: string }>;

  const totalRow = (await db.University.findAll({
    attributes: [
      [
        db.sequelize.fn(
          'COUNT',
          db.sequelize.fn(
            'DISTINCT',
            db.sequelize.fn('LOWER', db.sequelize.fn('TRIM', db.sequelize.col('name'))),
          ),
        ),
        'cnt',
      ],
    ],
    where,
    raw: true,
  })) as unknown as Array<{ cnt: string | number }>;
  const count = Number(totalRow[0]?.cnt ?? 0);

  const keeperIds = distinctNameRows.map(r => Number(r.id)).filter(Number.isFinite);
  const rows =
    keeperIds.length > 0
      ? await db.University.findAll({
          where: { id: { [Op.in]: keeperIds }, status: true },
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
        })
      : [];

  const pageNames = rows.map(row => (row.get('name') as string) || '');
  // Also pull sibling duplicate-name rows' courses via scrape + same-name catalog courses.
  const siblingRows =
    pageNames.length > 0
      ? await db.University.findAll({
          where: {
            status: true,
            [Op.or]: pageNames.map(name => ({ name: { [Op.iLike]: name } })),
          },
          attributes: ['id', 'name', 'country', 'programFeeRanges'],
          include: [
            {
              model: db.Course,
              as: 'courses',
              attributes: [...PROGRAM_ATTRIBUTES],
              required: false,
            },
          ],
        })
      : [];

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

  const siblingsByName = new Map<string, typeof siblingRows>();
  for (const s of siblingRows) {
    const key = universityNameKey(String(s.get('name') || ''));
    const list = siblingsByName.get(key) ?? [];
    list.push(s);
    siblingsByName.set(key, list);
  }

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

    const siblings = siblingsByName.get(universityNameKey(plain.name)) ?? [];
    const allDbCourses = siblings.flatMap(s => {
      const p = s.get({ plain: true }) as {
        courses?: Array<{
          id: number;
          courseName: string;
          degree: string;
          fee: number;
          duration: string;
          admissionRequirements?: Record<string, unknown> | null;
        }>;
      };
      return p.courses ?? [];
    });

    let bestCountry = plain.country;
    let mergedFeeRanges = plain.programFeeRanges;
    for (const s of siblings) {
      const p = s.get({ plain: true }) as {
        country: string;
        programFeeRanges: Record<string, unknown> | null;
      };
      if (looksLikeProgramAsCountry(bestCountry || '') && !looksLikeProgramAsCountry(p.country || '')) {
        bestCountry = p.country;
      }
      if (!mergedFeeRanges && p.programFeeRanges) mergedFeeRanges = p.programFeeRanges;
    }

    const programs = buildProgramsForUniversity(
      plain.name,
      allDbCourses.map(c => ({
        ...c,
        admissionRequirements: (c.admissionRequirements as any) ?? null,
      })),
      scrapedPlain,
      mergedFeeRanges,
    );

    return {
      id: plain.id,
      name: plain.name,
      country: bestCountry,
      status: plain.status,
      programFeeRanges: mergedFeeRanges,
      programsCount: programs.length,
      programs,
      createdAt: plain.createdAt,
      updatedAt: plain.updatedAt,
    };
  });

  const deduped = dedupeUniversitiesByNameCountry(universities);

  return {
    universities: deduped,
    page,
    limit,
    total: count,
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

const dedupeUniversitiesByNameCountry = (rows: PublicUniversityRow[]): PublicUniversityRow[] => {
  const byKey = new Map<string, PublicUniversityRow>();

  for (const uni of rows) {
    const key = universityNameKey(uni.name);
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
    const loser = preferIncoming ? existing : uni;
    const country =
      !looksLikeProgramAsCountry(winner.country || '') && (winner.country || '').trim()
        ? winner.country
        : !looksLikeProgramAsCountry(loser.country || '') && (loser.country || '').trim()
          ? loser.country
          : winner.country;

    byKey.set(key, {
      ...winner,
      country,
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
