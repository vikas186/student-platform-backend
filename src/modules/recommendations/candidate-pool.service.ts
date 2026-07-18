import { Op } from 'sequelize';
import { db } from '../../../config/database';
import {
  FEE_RANGE_PROGRAMS,
  fieldToFeeRangeKeys,
  namesMatch,
  parseFeeNumber,
} from '../../../utils/catalogProgram.util';
import { fetchLatestCommissionByUniversity } from '../../../utils/commissionLookup.util';
import type { NormalizedMatchInput, RecommendationCandidate } from './recommendation.types';
import { candidateRefKey, parseCandidateRefKey } from './recommendation.types';
import { fieldMatchesText, levelMatchesDegree } from './input-normalizer.service';
import { enrichCandidatesWithScrapeContext, loadScrapeContext } from './scrape-context.service';

const PUBLIC_POOL_LIMIT = 80;
const AGENT_POOL_LIMIT = 120;
const CATALOG_DEFAULT_QUALITY = 90;
const FEE_RANGE_DEFAULT_QUALITY = 85;

const buildLevelWhere = (input: NormalizedMatchInput): Record<string, unknown> | undefined => {
  if (!input.levelKeywords.length) return undefined;
  const orClauses = input.levelKeywords.map(k => ({ degree: { [Op.iLike]: `%${k}%` } }));
  return { [Op.or]: orClauses };
};

const buildScrapeLevelWhere = (input: NormalizedMatchInput): Record<string, unknown> | undefined => {
  if (!input.levelKeywords.length) return undefined;
  const orClauses = input.levelKeywords.map(k => ({ studyLevel: { [Op.iLike]: `%${k}%` } }));
  return { [Op.or]: orClauses };
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
    if (!levelMatchesDegree(plain.degree, input.levelKeywords)) continue;

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

    if (plain.studyLevel && !levelMatchesDegree(plain.studyLevel, input.levelKeywords)) continue;
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
      if (!levelMatchesDegree(meta.degree, input.levelKeywords)) continue;

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
