import { Op } from 'sequelize';
import { db } from '../../../config/database';
import {
  FEE_RANGE_PROGRAMS,
  fieldToFeeRangeKeys,
  namesMatch,
  parseFeeNumber,
} from '../../../utils/catalogProgram.util';
import { fetchLatestCommissionByUniversity } from '../../../utils/commissionLookup.util';
import type { AcademicBand, NormalizedMatchInput, RecommendationCandidate } from './recommendation.types';
import { candidateRefKey, parseCandidateRefKey } from './recommendation.types';
import { fieldMatchesText, levelMatchesProgram } from './input-normalizer.service';
import { enrichCandidatesWithScrapeContext, loadScrapeContext } from './scrape-context.service';

const PUBLIC_POOL_LIMIT = 80;
const AGENT_POOL_LIMIT = 120;
const CATALOG_DEFAULT_QUALITY = 90;
const FEE_RANGE_DEFAULT_QUALITY = 85;

const undergradNameInclude = [
  { courseName: { [Op.iLike]: '%bachelor%' } },
  { courseName: { [Op.iLike]: '%undergraduate%' } },
  { courseName: { [Op.iLike]: '%b.sc%' } },
  { courseName: { [Op.iLike]: '%bsc%' } },
  { courseName: { [Op.iLike]: '%b.eng%' } },
  { courseName: { [Op.iLike]: '%beng%' } },
  { studyLevel: { [Op.iLike]: '%bachelor%' } },
  { studyLevel: { [Op.iLike]: '%undergrad%' } },
];

const postgradNameInclude = [
  { courseName: { [Op.iLike]: '%master%' } },
  { courseName: { [Op.iLike]: '%postgrad%' } },
  { courseName: { [Op.iLike]: '%mba%' } },
  { courseName: { [Op.iLike]: '%m.sc%' } },
  { courseName: { [Op.iLike]: '%msc%' } },
  { courseName: { [Op.iLike]: '%m.eng%' } },
  { courseName: { [Op.iLike]: '%meng%' } },
  { studyLevel: { [Op.iLike]: '%master%' } },
  { studyLevel: { [Op.iLike]: '%postgrad%' } },
];

const undergradNameExclude = {
  [Op.and]: [
    { courseName: { [Op.notILike]: '%master%' } },
    { courseName: { [Op.notILike]: '%mba%' } },
    { courseName: { [Op.notILike]: '%m.sc%' } },
    { courseName: { [Op.notILike]: '%msc %' } },
    { courseName: { [Op.notILike]: '%postgrad%' } },
    { courseName: { [Op.notILike]: '%m.eng%' } },
    { courseName: { [Op.notILike]: '%meng%' } },
    { courseName: { [Op.notILike]: '%phd%' } },
  ],
};

const postgradNameExclude = {
  [Op.and]: [
    { courseName: { [Op.notILike]: '%bachelor%' } },
    { courseName: { [Op.notILike]: '%undergraduate%' } },
    { courseName: { [Op.notILike]: '%b.sc%' } },
    { courseName: { [Op.notILike]: '% bsc%' } },
    { courseName: { [Op.notILike]: '%b.eng%' } },
    { courseName: { [Op.notILike]: '%beng%' } },
  ],
};

const buildLevelWhere = (input: NormalizedMatchInput): Record<string, unknown> | undefined => {
  const band = input.wantedBand;
  if (!band || band === 'any') return undefined;
  if (band === 'undergrad') {
    return {
      [Op.or]: [{ degree: { [Op.iLike]: '%undergrad%' } }, { degree: { [Op.iLike]: '%bachelor%' } }],
    };
  }
  if (band === 'postgrad') {
    return {
      [Op.or]: [
        { degree: { [Op.iLike]: '%postgrad%' } },
        { degree: { [Op.iLike]: '%master%' } },
        { degree: { [Op.iLike]: '%mba%' } },
        { degree: { [Op.iLike]: '%msc%' } },
      ],
    };
  }
  if (band === 'doctoral') {
    return { [Op.or]: [{ degree: { [Op.iLike]: '%phd%' } }, { degree: { [Op.iLike]: '%doctor%' } }] };
  }
  if (band === 'diploma') {
    return {
      [Op.or]: [
        { degree: { [Op.iLike]: '%diploma%' } },
        { degree: { [Op.iLike]: '%certificate%' } },
        { degree: { [Op.iLike]: '%foundation%' } },
      ],
    };
  }
  return undefined;
};

const buildScrapeLevelWhere = (input: NormalizedMatchInput): Record<string, unknown> | undefined => {
  const band = input.wantedBand;
  if (!band || band === 'any') return undefined;
  if (band === 'undergrad') {
    return { [Op.and]: [{ [Op.or]: undergradNameInclude }, undergradNameExclude] };
  }
  if (band === 'postgrad') {
    return { [Op.and]: [{ [Op.or]: postgradNameInclude }, postgradNameExclude] };
  }
  if (band === 'doctoral') {
    return {
      [Op.or]: [{ courseName: { [Op.iLike]: '%phd%' } }, { studyLevel: { [Op.iLike]: '%phd%' } }],
    };
  }
  if (band === 'diploma') {
    return {
      [Op.or]: [
        { courseName: { [Op.iLike]: '%diploma%' } },
        { courseName: { [Op.iLike]: '%certificate%' } },
        { courseName: { [Op.iLike]: '%foundation%' } },
        { studyLevel: { [Op.iLike]: '%diploma%' } },
      ],
    };
  }
  return undefined;
};

const buildFieldWhere = (
  input: NormalizedMatchInput,
  column: 'courseName' | 'degree',
): Record<string, unknown> | undefined => {
  if (input.audience === 'agent' || !input.fieldKeywords.length) return undefined;
  const orClauses = input.fieldKeywords.map(k => ({ [column]: { [Op.iLike]: `%${k}%` } }));
  return { [Op.or]: orClauses };
};

const buildScrapeFieldWhere = (input: NormalizedMatchInput): Record<string, unknown> | undefined => {
  if (input.audience === 'agent' || !input.fieldKeywords.length) return undefined;
  const orClauses = input.fieldKeywords.map(k => ({ courseName: { [Op.iLike]: `%${k}%` } }));
  return { [Op.or]: orClauses };
};

const passesLevel = (
  courseName: string,
  degree: string | null | undefined,
  wanted: AcademicBand,
): boolean => levelMatchesProgram(courseName, degree, wanted);

export const buildCandidatePool = async (input: NormalizedMatchInput): Promise<RecommendationCandidate[]> => {
  const poolLimit = input.audience === 'agent' ? AGENT_POOL_LIMIT : PUBLIC_POOL_LIMIT;
  const countryPattern = `%${input.country}%`;
  const commissionMap = await fetchLatestCommissionByUniversity();

  const activeUniversities = await db.University.findAll({
    where: { status: true, country: { [Op.iLike]: countryPattern } },
    attributes: ['id', 'name', 'country', 'programFeeRanges'],
    limit: poolLimit,
  });

  const allActiveUniversities = await db.University.findAll({
    where: { status: true },
    attributes: ['id', 'name', 'country'],
    limit: 500,
  });

  const uniById = new Map(
    activeUniversities.map(u => [
      u.id,
      u.get({ plain: true }) as {
        id: number;
        name: string;
        country: string;
        programFeeRanges: Record<string, unknown> | null;
      },
    ]),
  );
  const uniList = [...uniById.values()];

  const resolveUniId = (scrapedName: string): { id: number; name: string } | null => {
    for (const u of allActiveUniversities) {
      if (namesMatch(u.name, scrapedName)) {
        return { id: u.id, name: u.name };
      }
    }
    return null;
  };

  const levelWhere = buildLevelWhere(input);
  const scrapeLevel = buildScrapeLevelWhere(input);
  const catalogField = buildFieldWhere(input, 'courseName');
  const scrapeField = buildScrapeFieldWhere(input);

  const catalogWhere =
    levelWhere && catalogField
      ? { [Op.and]: [levelWhere, catalogField] }
      : levelWhere || catalogField;

  const scrapeBase = {
    recordStatus: 'cleaned',
    cleaningStatus: 'high_quality',
    isDuplicate: false,
    country: { [Op.iLike]: countryPattern },
  };
  const scrapeAnd: unknown[] = [scrapeBase];
  if (scrapeLevel) scrapeAnd.push(scrapeLevel);
  if (scrapeField) scrapeAnd.push(scrapeField);
  const scrapeCourseWhere = scrapeAnd.length > 1 ? { [Op.and]: scrapeAnd } : scrapeBase;

  const [catalogCourses, scrapedCourses, scrapeCtx] = await Promise.all([
    db.Course.findAll({
      where: catalogWhere,
      include: [
        {
          model: db.University,
          as: 'university',
          required: true,
          where: { status: true, country: { [Op.iLike]: countryPattern } },
          attributes: ['id', 'name', 'country'],
        },
      ],
      limit: poolLimit,
      order: [['courseName', 'ASC']],
    }),
    db.ScrapedCourse.findAll({
      where: scrapeCourseWhere,
      limit: poolLimit,
      order: [['qualityScore', 'DESC']],
    }),
    loadScrapeContext(input),
  ]);

  const candidates: RecommendationCandidate[] = [];

  for (const row of catalogCourses) {
    const plain = row.get({ plain: true }) as {
      id: number;
      courseName: string;
      degree: string;
      fee: number;
      duration: string;
      university?: { id: number; name: string; country: string };
    };
    if (!plain.university) continue;
    if (!passesLevel(plain.courseName, plain.degree, input.wantedBand)) continue;

    const comm = commissionMap.get(plain.university.id);
    candidates.push({
      refId: candidateRefKey('catalog', plain.id),
      source: 'catalog',
      courseId: plain.id,
      courseName: plain.courseName,
      degree: plain.degree,
      country: plain.university.country,
      universityId: plain.university.id,
      universityName: plain.university.name,
      fee: plain.fee,
      feeRange: null,
      duration: plain.duration,
      intake: null,
      qualityScore: CATALOG_DEFAULT_QUALITY,
      commissionPercent: comm?.percentage ?? null,
      subjectTags: [],
      careerTags: [],
      scholarshipHint: null,
      vectorSimilarity: 0,
      rerankScore: 0,
    });
  }

  for (const row of scrapedCourses) {
    const plain = row.get({ plain: true }) as {
      id: string;
      courseName: string;
      studyLevel: string | null;
      tuitionFee: string | null;
      duration: string | null;
      universityName: string;
      country: string | null;
      intake: string | null;
      normalizedIntakes: string[] | null;
      qualityScore: number;
      subjectTags: string[];
      careerTags: string[];
    };

    if (!passesLevel(plain.courseName, plain.studyLevel, input.wantedBand)) continue;
    if (input.audience !== 'agent' && !fieldMatchesText(plain.courseName, plain.subjectTags ?? [], input.fieldKeywords)) {
      continue;
    }

    const resolved = resolveUniId(plain.universityName);
    const comm = resolved ? commissionMap.get(resolved.id) : null;

    candidates.push({
      refId: candidateRefKey('scrape', plain.id),
      source: 'scrape',
      courseId: plain.id,
      courseName: plain.courseName,
      degree: plain.studyLevel || 'Program',
      country: plain.country || input.country,
      universityId: resolved?.id ?? null,
      universityName: resolved?.name ?? plain.universityName,
      fee: parseFeeNumber(plain.tuitionFee),
      feeRange: plain.tuitionFee,
      duration: plain.duration || '—',
      intake: plain.intake,
      qualityScore: plain.qualityScore ?? 50,
      commissionPercent: comm?.percentage ?? null,
      subjectTags: plain.subjectTags ?? [],
      careerTags: plain.careerTags ?? [],
      scholarshipHint: null,
      vectorSimilarity: 0,
      rerankScore: 0,
    });
  }

  const feeKeys =
    input.audience === 'agent' ? Object.keys(FEE_RANGE_PROGRAMS) : fieldToFeeRangeKeys(input.field, input.level);
  for (const uni of uniList) {
    const ranges = uni.programFeeRanges;
    if (!ranges) continue;
    for (const key of feeKeys) {
      const meta = FEE_RANGE_PROGRAMS[key];
      const val = ranges[key];
      if (!meta || val == null || String(val).trim() === '') continue;
      if (!passesLevel(meta.courseName, meta.degree, input.wantedBand)) continue;

      const comm = commissionMap.get(uni.id);
      candidates.push({
        refId: candidateRefKey('fee_range', key, uni.id),
        source: 'fee_range',
        courseId: key,
        courseName: meta.courseName,
        degree: meta.degree,
        country: uni.country,
        universityId: uni.id,
        universityName: uni.name,
        fee: parseFeeNumber(val),
        feeRange: String(val),
        duration: meta.duration,
        intake: null,
        qualityScore: FEE_RANGE_DEFAULT_QUALITY,
        commissionPercent: comm?.percentage ?? null,
        subjectTags: [],
        careerTags: [],
        scholarshipHint: null,
        vectorSimilarity: 0,
        rerankScore: 0,
      });
    }
  }

  return enrichCandidatesWithScrapeContext(candidates, scrapeCtx);
};

export const loadCandidatesByRefIds = async (refIds: string[]): Promise<RecommendationCandidate[]> => {
  if (!refIds.length) return [];
  const poolKeys = new Set(refIds);
  const parsed = refIds
    .map(refId => ({ refId, parsed: parseCandidateRefKey(refId) }))
    .filter(
      (p): p is { refId: string; parsed: NonNullable<ReturnType<typeof parseCandidateRefKey>> } => p.parsed != null,
    );

  const commissionMap = await fetchLatestCommissionByUniversity();
  const result: RecommendationCandidate[] = [];

  for (const { parsed: p } of parsed) {
    if (p.source === 'catalog') {
      const course = await db.Course.findByPk(p.courseId, {
        include: [{ model: db.University, as: 'university', attributes: ['id', 'name', 'country'] }],
      });
      if (!course) continue;
      const plain = course.get({ plain: true }) as {
        id: number;
        courseName: string;
        degree: string;
        fee: number;
        duration: string;
        university?: { id: number; name: string; country: string };
      };
      if (!plain.university) continue;
      const refIdKey = candidateRefKey('catalog', plain.id);
      if (!poolKeys.has(refIdKey)) continue;
      result.push({
        refId: refIdKey,
        source: 'catalog',
        courseId: plain.id,
        courseName: plain.courseName,
        degree: plain.degree,
        country: plain.university.country,
        universityId: plain.university.id,
        universityName: plain.university.name,
        fee: plain.fee,
        feeRange: null,
        duration: plain.duration,
        intake: null,
        qualityScore: CATALOG_DEFAULT_QUALITY,
        commissionPercent: commissionMap.get(plain.university.id)?.percentage ?? null,
        subjectTags: [],
        careerTags: [],
        scholarshipHint: null,
        vectorSimilarity: 0,
        rerankScore: 0,
      });
    } else if (p.source === 'scrape') {
      const course = await db.ScrapedCourse.findByPk(p.courseId);
      if (!course) continue;
      const plain = course.get({ plain: true }) as {
        id: string;
        courseName: string;
        studyLevel: string | null;
        tuitionFee: string | null;
        duration: string | null;
        universityName: string;
        country: string | null;
        intake: string | null;
        qualityScore: number;
        subjectTags: string[];
        careerTags: string[];
      };
      let resolvedId: number | null = null;
      let resolvedName: string | null = plain.universityName;
      const allUnis = await db.University.findAll({ where: { status: true }, attributes: ['id', 'name'], limit: 500 });
      for (const u of allUnis) {
        if (namesMatch(u.name, plain.universityName)) {
          resolvedId = u.id;
          resolvedName = u.name;
          break;
        }
      }
      const scrapeRefId = candidateRefKey('scrape', plain.id);
      if (!poolKeys.has(scrapeRefId)) continue;
      result.push({
        refId: scrapeRefId,
        source: 'scrape',
        courseId: plain.id,
        courseName: plain.courseName,
        degree: plain.studyLevel || 'Program',
        country: plain.country || '',
        universityId: resolvedId,
        universityName: resolvedName,
        fee: parseFeeNumber(plain.tuitionFee),
        feeRange: plain.tuitionFee,
        duration: plain.duration || '—',
        intake: plain.intake,
        qualityScore: plain.qualityScore ?? 50,
        commissionPercent: resolvedId ? commissionMap.get(resolvedId)?.percentage ?? null : null,
        subjectTags: plain.subjectTags ?? [],
        careerTags: plain.careerTags ?? [],
        scholarshipHint: null,
        vectorSimilarity: 0,
        rerankScore: 0,
      });
    } else if (p.source === 'fee_range' && p.universityId) {
      const uni = await db.University.findByPk(p.universityId);
      if (!uni) continue;
      const meta = FEE_RANGE_PROGRAMS[p.courseId];
      if (!meta) continue;
      const ranges = uni.programFeeRanges as Record<string, unknown> | null;
      const val = ranges?.[p.courseId];
      if (val == null) continue;
      const refId = candidateRefKey('fee_range', p.courseId, uni.id);
      if (!poolKeys.has(refId)) continue;
      result.push({
        refId,
        source: 'fee_range',
        courseId: p.courseId,
        courseName: meta.courseName,
        degree: meta.degree,
        country: uni.country,
        universityId: uni.id,
        universityName: uni.name,
        fee: parseFeeNumber(val),
        feeRange: String(val),
        duration: meta.duration,
        intake: null,
        qualityScore: FEE_RANGE_DEFAULT_QUALITY,
        commissionPercent: commissionMap.get(uni.id)?.percentage ?? null,
        subjectTags: [],
        careerTags: [],
        scholarshipHint: null,
        vectorSimilarity: 0,
        rerankScore: 0,
      });
    }
  }

  return result;
};
