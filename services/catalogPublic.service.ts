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
  universityScrapeNeedles,
  type PublicProgram,
} from '../utils/catalogProgram.util';
import { alignFeeRangeCurrency } from '../utils/universityCatalogImport';

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
  /** Comma-separated list, e.g. `United Kingdom,Australia,Canada`. */
  countries?: string;
  page?: string | number;
  limit?: string | number;
};

const universityNameKey = (name: string): string =>
  name.trim().toLowerCase().replace(/\s+/g, ' ');

/** Sentinel chip for placeholder / uncategorized catalog destinations (was "General"). */
export const REST_OF_WORLD_COUNTRY = 'Rest of the World';

/** Primary destination chips shown separately on apply forms. */
const FEATURED_DESTINATION_PATTERNS: RegExp[] = [
  /united kingdom|\buk\b|britain/i,
  /united states|\busa\b|\bu\.s\.?\b/i,
  /canada/i,
  /australia/i,
  /new zealand|\bnz\b/i,
  /ireland/i,
  /germany/i,
  /france/i,
  /netherlands|\bholland\b/i,
];

const isFeaturedDestinationCountry = (country: string): boolean =>
  FEATURED_DESTINATION_PATTERNS.some(re => re.test(country.trim()));

/** True when a "country" cell looks like a program title (bad catalog import). */
export const looksLikeProgramAsCountry = (value: string): boolean => {
  const v = value.trim();
  if (!v) return false;
  if (/^(BA|BSc|BEng|BBA|MA|MSc|MBA|MEng|PhD|LLB|LLM|PGDip|PGCert)\b/i.test(v)) return true;
  if (/\(Hons\)|Foundation Year|Bachelor of|Master of|Diploma in|Certificate in/i.test(v)) return true;
  if (v.length > 64) return true;
  return false;
};

/** Placeholder / junk destination labels that should not appear as named country chips. */
export const isPlaceholderCatalogCountry = (value: string): boolean => {
  const v = value.trim();
  if (!v) return true;
  return /^(general|international|mixed)(\b|\/|$)/i.test(v);
};

export const isRestOfWorldSelection = (value: string): boolean => {
  const v = value.trim();
  if (!v) return false;
  return /^rest of the world$/i.test(v) || isPlaceholderCatalogCountry(v);
};

/**
 * Rest of the World = placeholder destinations (General / International / mixed)
 * plus any named country that is not a featured chip (Italy, Spain, Singapore, …).
 */
export const restOfWorldCountryWhere = () =>
  db.sequelize.literal(`(
    country ILIKE 'General'
    OR country ILIKE 'International'
    OR country ILIKE 'mixed%'
    OR country ILIKE 'Rest of the World'
    OR (
      country IS NOT NULL
      AND BTRIM(country) <> ''
      AND country !~* '(united kingdom|\\muk\\M|britain|united states|\\musa\\M|\\mu\\.?s\\.?\\M|canada|australia|new zealand|\\mnz\\M|ireland|germany|france|netherlands|holland)'
    )
  )`);

const parseCountriesQuery = (query: PublicUniversitiesQuery): string[] => {
  const fromList = String(query.countries ?? '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  const single = query.country?.trim();
  if (single) fromList.push(single);
  return [...new Set(fromList)].slice(0, 40);
};

/** Distinct destination countries from active catalog universities (for apply forms). */
export const listPublicCatalogCountries = async () => {
  const rows = await db.University.findAll({
    attributes: ['country'],
    where: {
      status: true,
      country: { [Op.and]: [{ [Op.ne]: null }, { [Op.ne]: '' }] },
    },
    group: ['country'],
    order: [['country', 'ASC']],
    raw: true,
  });

  const rawCountries = rows
    .map(r => String((r as { country?: string }).country ?? '').trim())
    .filter(c => c && !looksLikeProgramAsCountry(c));

  const hasGeneralBucket = rawCountries.some(c => isPlaceholderCatalogCountry(c));

  const featured: string[] = [];
  const leftovers: string[] = [];
  const seen = new Set<string>();

  for (const c of rawCountries) {
    if (isPlaceholderCatalogCountry(c)) continue;
    const key = c.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    if (isFeaturedDestinationCountry(c)) featured.push(c);
    else leftovers.push(c);
  }

  // Featured first, then leftover named destinations (Italy, Spain, …), then Rest of the World.
  const unique = [...featured, ...leftovers];
  if (hasGeneralBucket || leftovers.length > 0) {
    unique.push(REST_OF_WORLD_COUNTRY);
  }

  return { countries: unique };
};

export const listPublicUniversitiesWithPrograms = async (query: PublicUniversitiesQuery) => {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
  const offset = (page - 1) * limit;

  const where: Record<string, unknown> = { status: true };
  const andClauses: unknown[] = [];

  const countries = parseCountriesQuery(query);
  if (countries.length === 1) {
    if (isRestOfWorldSelection(countries[0]!)) {
      andClauses.push(restOfWorldCountryWhere());
    } else {
      andClauses.push({ country: { [Op.iLike]: countries[0] } });
    }
  } else if (countries.length > 1) {
    const restSelected = countries.some(c => isRestOfWorldSelection(c));
    const named = countries.filter(c => !isRestOfWorldSelection(c));
    const orParts: unknown[] = named.map(c => ({
      country: { [Op.iLike]: c },
    }));
    if (restSelected) {
      orParts.push(restOfWorldCountryWhere());
    }
    if (orParts.length === 1) {
      andClauses.push(orParts[0]!);
    } else if (orParts.length > 1) {
      andClauses.push({ [Op.or]: orParts });
    }
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
  const scrapeNeedles = [
    ...new Set(pageNames.flatMap(name => universityScrapeNeedles(name))),
  ];
  if (scrapeNeedles.length) {
    (scrapedWhere as Record<symbol, unknown>)[Op.or] = scrapeNeedles.map(needle => ({
      universityName: { [Op.iLike]: `%${needle}%` },
    }));
  }

  const scrapedRows =
    scrapeNeedles.length > 0
      ? await db.ScrapedCourse.findAll({
          where: scrapedWhere,
          attributes: [...SCRAPED_PROGRAM_ATTRIBUTES],
          order: [
            ['universityName', 'ASC'],
            ['courseName', 'ASC'],
          ],
          limit: 3000,
        })
      : [];

  const scrapeUniRows =
    scrapeNeedles.length > 0
      ? await db.ScrapeUniversity.findAll({
          where: {
            recordStatus: 'cleaned',
            cleaningStatus: { [Op.in]: ['high_quality', 'needs_review'] },
            isDuplicate: false,
            [Op.or]: scrapeNeedles.map(needle => ({
              universityName: { [Op.iLike]: `%${needle}%` },
            })),
          },
          attributes: ['universityName', 'admissionRequirements', 'acceptanceCriteria'],
          limit: 500,
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

  const scrapeUniPlain = scrapeUniRows.map(row =>
    row.get({ plain: true }),
  ) as Array<{
    universityName: string;
    admissionRequirements: string | null;
    acceptanceCriteria: string | null;
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
      bestCountry = pickBetterCountry(bestCountry || '', p.country || '');
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
      scrapeUniPlain,
      bestCountry,
    );

    const withCurrency = programs.map(p => {
      const aligned = alignFeeRangeCurrency(p.feeRange, bestCountry);
      if (!aligned || aligned === p.feeRange) return p;
      return {
        ...p,
        feeRange: aligned,
        admissionRequirements: p.admissionRequirements
          ? { ...p.admissionRequirements, feeRange: aligned }
          : p.admissionRequirements,
      };
    });

    return {
      id: plain.id,
      name: plain.name,
      country: bestCountry,
      status: plain.status,
      programFeeRanges: mergedFeeRanges,
      programsCount: withCurrency.length,
      programs: withCurrency,
      createdAt: plain.createdAt,
      updatedAt: plain.updatedAt,
    };
  });

  // Prefer institutions that already have selectable programmes (NZ polytech shells often have none).
  const deduped = dedupeUniversitiesByNameCountry(universities)
    .filter(u => (u.programs?.length ?? u.programsCount ?? 0) > 0)
    .sort((a, b) => {
      const pc = (b.programsCount ?? 0) - (a.programsCount ?? 0);
      if (pc !== 0) return pc;
      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    });

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

const catalogProgramCount = (uni: PublicUniversityRow): number =>
  (uni.programs ?? []).filter(p => p.source === 'course').length;

const pickBetterCountry = (a: string, b: string): string => {
  const aOk = !looksLikeProgramAsCountry(a || '') && (a || '').trim();
  const bOk = !looksLikeProgramAsCountry(b || '') && (b || '').trim();
  if (aOk && !bOk) return a;
  if (bOk && !aOk) return b;
  const aGeneral = /^(general|international|mixed)(\b|\/)/i.test((a || '').trim());
  const bGeneral = /^(general|international|mixed)(\b|\/)/i.test((b || '').trim());
  if (aOk && bOk && aGeneral && !bGeneral) return b;
  if (aOk && bOk && bGeneral && !aGeneral) return a;
  // Prefer a real destination over the catalog-import default "United Kingdom".
  const aDefault = /^united kingdom$/i.test((a || '').trim());
  const bDefault = /^united kingdom$/i.test((b || '').trim());
  if (aOk && bOk && aDefault && !bDefault) return b;
  if (aOk && bOk && bDefault && !aDefault) return a;
  return aOk ? a : bOk ? b : a || b;
};

const findFuzzyUniversityIndex = (rows: PublicUniversityRow[], name: string): number => {
  const exact = universityNameKey(name);
  for (let i = 0; i < rows.length; i++) {
    if (universityNameKey(rows[i].name) === exact) return i;
    if (namesMatch(rows[i].name, name)) return i;
  }
  return -1;
};

/**
 * One row per institution. Exact name + fuzzy name match (sheet vs scrape aliases).
 * Prefer the row with more catalog (`course`) programmes; merge programmes with sheet-first dedupe.
 */
const dedupeUniversitiesByNameCountry = (rows: PublicUniversityRow[]): PublicUniversityRow[] => {
  const merged: PublicUniversityRow[] = [];

  for (const uni of rows) {
    const idx = findFuzzyUniversityIndex(merged, uni.name);
    if (idx < 0) {
      merged.push(uni);
      continue;
    }

    const existing = merged[idx];
    const mergedPrograms = dedupePrograms([...existing.programs, ...uni.programs]);
    const existingCatalog = catalogProgramCount(existing);
    const incomingCatalog = catalogProgramCount(uni);
    const preferIncoming =
      incomingCatalog > existingCatalog ||
      (incomingCatalog === existingCatalog && (uni.programsCount ?? 0) > (existing.programsCount ?? 0)) ||
      (incomingCatalog === existingCatalog &&
        uni.programsCount === existing.programsCount &&
        uni.id > existing.id);

    const winner = preferIncoming ? uni : existing;
    const loser = preferIncoming ? existing : uni;

    merged[idx] = {
      ...winner,
      country: pickBetterCountry(winner.country, loser.country),
      programs: mergedPrograms,
      programsCount: mergedPrograms.length,
      programFeeRanges: winner.programFeeRanges ?? loser.programFeeRanges ?? null,
    };
  }

  return merged.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
};

// Re-export for tests / other modules
export { mapDbCourse, mapScrapedCourse, namesMatch, parseFeeNumber, programsFromFeeRanges };
