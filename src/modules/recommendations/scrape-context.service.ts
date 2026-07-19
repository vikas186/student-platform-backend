import { Op } from 'sequelize';
import { db } from '../../../config/database';
import { namesMatch, parseFeeNumber } from '../../../utils/catalogProgram.util';
import type { NormalizedMatchInput, RecommendationCandidate } from './recommendation.types';
import { inferAcademicBand } from './input-normalizer.service';

const SCRAPE_CLEANED = {
  recordStatus: 'cleaned',
  cleaningStatus: 'high_quality',
  isDuplicate: false,
} as const;

type ScrapeUniPlain = {
  id: string;
  universityName: string;
  country: string | null;
  city: string | null;
  ranking: string | null;
  overview: string | null;
  intakes: string | null;
  costOfStudy: string | null;
  scholarships: string | null;
  admissionRequirements: string | null;
  popularCourses: string[];
  subjectTags: string[];
  rankingTags: string[];
  qualityScore: number;
  aiSummary: string | null;
};

type ScrapeScholarshipPlain = {
  id: string;
  scholarshipName: string;
  universityName: string | null;
  country: string | null;
  amount: string | null;
  eligibility: string | null;
  deadline: string | null;
  description: string | null;
  subjectTags: string[];
  qualityScore: number;
};

type ScrapeFeePlain = {
  id: string;
  country: string | null;
  studyLevel: string | null;
  tuitionFee: string | null;
  livingCost: string | null;
  accommodationCost: string | null;
  currency: string | null;
  description: string | null;
  qualityScore: number;
};

export type ScrapeContextBundle = {
  universities: ScrapeUniPlain[];
  scholarships: ScrapeScholarshipPlain[];
  fees: ScrapeFeePlain[];
};

const countryWhere = (countryPattern: string) => ({
  [Op.or]: [{ country: { [Op.iLike]: countryPattern } }, { country: null }],
});

const countryLooseMatch = (a: string, b: string): boolean => {
  const x = a.toLowerCase().trim();
  const y = b.toLowerCase().trim();
  if (!x || !y) return false;
  return x === y || x.includes(y) || y.includes(x);
};

/** Load high-quality scrape universities, scholarships, and fees for a match country. */
export const loadScrapeContext = async (input: NormalizedMatchInput): Promise<ScrapeContextBundle> => {
  const countryPattern = `%${input.country}%`;

  const [universities, scholarships, fees] = await Promise.all([
    db.ScrapeUniversity.findAll({
      where: {
        ...SCRAPE_CLEANED,
        country: { [Op.iLike]: countryPattern },
      },
      limit: 200,
      order: [['qualityScore', 'DESC']],
    }),
    db.ScrapeScholarship.findAll({
      where: {
        ...SCRAPE_CLEANED,
        ...countryWhere(countryPattern),
      },
      limit: 200,
      order: [['qualityScore', 'DESC']],
    }),
    db.ScrapeFee.findAll({
      where: {
        ...SCRAPE_CLEANED,
        country: { [Op.iLike]: countryPattern },
      },
      limit: 100,
      order: [['qualityScore', 'DESC']],
    }),
  ]);

  return {
    universities: universities.map(r => r.get({ plain: true }) as ScrapeUniPlain),
    scholarships: scholarships.map(r => r.get({ plain: true }) as ScrapeScholarshipPlain),
    fees: fees.map(r => r.get({ plain: true }) as ScrapeFeePlain),
  };
};

const findFeeForCandidate = (c: RecommendationCandidate, fees: ScrapeFeePlain[]): ScrapeFeePlain | null => {
  const courseBand = inferAcademicBand(c.courseName, c.degree);
  const levelMatched = fees.filter(f => {
    if (!f.studyLevel) return true;
    const feeBand = inferAcademicBand(f.studyLevel);
    if (courseBand === 'unknown' || feeBand === 'unknown') return true;
    return feeBand === courseBand || (courseBand === 'postgrad' && feeBand === 'doctoral');
  });
  const pool = levelMatched.length ? levelMatched : fees;
  return pool[0] ?? null;
};

const findScholarshipsForCandidate = (
  c: RecommendationCandidate,
  scholarships: ScrapeScholarshipPlain[],
): ScrapeScholarshipPlain[] => {
  if (!c.universityName) {
    return scholarships.filter(s => !s.universityName).slice(0, 2);
  }
  const byUni = scholarships.filter(s => s.universityName && namesMatch(s.universityName, c.universityName!));
  if (byUni.length) return byUni.slice(0, 2);
  return scholarships.filter(s => !s.universityName).slice(0, 1);
};

const findScrapeUni = (c: RecommendationCandidate, universities: ScrapeUniPlain[]): ScrapeUniPlain | null => {
  if (!c.universityName) return null;
  for (const u of universities) {
    if (namesMatch(u.universityName, c.universityName)) return u;
  }
  return null;
};

const formatScholarshipHint = (rows: ScrapeScholarshipPlain[]): string | null => {
  if (!rows.length) return null;
  return rows
    .map(s => {
      const amount = s.amount ? ` (${s.amount})` : '';
      return `${s.scholarshipName}${amount}`;
    })
    .join('; ');
};

/**
 * Fill missing fees from scrape_fees, attach scholarship hints, and boost quality
 * when a matching scrape_universities row exists.
 */
export const enrichCandidatesWithScrapeContext = (
  candidates: RecommendationCandidate[],
  ctx: ScrapeContextBundle,
): RecommendationCandidate[] =>
  candidates.map(c => {
    const scrapeUni = findScrapeUni(c, ctx.universities);
    const scholarships = findScholarshipsForCandidate(c, ctx.scholarships);
    const feeRow = c.fee == null && !c.feeRange ? findFeeForCandidate(c, ctx.fees) : null;

    const subjectTags = [...(c.subjectTags ?? [])];
    const careerTags = [...(c.careerTags ?? [])];
    if (scrapeUni?.subjectTags?.length) {
      for (const t of scrapeUni.subjectTags) {
        if (t && !subjectTags.includes(t)) subjectTags.push(t);
      }
    }
    for (const s of scholarships) {
      for (const t of s.subjectTags ?? []) {
        if (t && !subjectTags.includes(t)) subjectTags.push(t);
      }
    }

    let fee = c.fee;
    let feeRange = c.feeRange;
    if (feeRow) {
      fee = parseFeeNumber(feeRow.tuitionFee);
      const parts = [feeRow.tuitionFee, feeRow.livingCost ? `living ${feeRow.livingCost}` : null]
        .filter(Boolean)
        .join(' · ');
      feeRange = parts || feeRange;
    } else if (scrapeUni?.costOfStudy && !feeRange) {
      fee = parseFeeNumber(scrapeUni.costOfStudy);
      feeRange = scrapeUni.costOfStudy;
    }

    let qualityScore = c.qualityScore;
    if (scrapeUni) {
      qualityScore = Math.max(qualityScore, Math.min(100, (scrapeUni.qualityScore ?? 0) + 5));
    }

    let intake = c.intake;
    if (!intake && scrapeUni?.intakes) intake = scrapeUni.intakes;

    return {
      ...c,
      fee,
      feeRange,
      intake,
      qualityScore,
      subjectTags,
      careerTags,
      scholarshipHint: formatScholarshipHint(scholarships) ?? (scrapeUni?.scholarships?.slice(0, 160) || null),
    };
  });

type RagHitLike = {
  sourceType: string;
  sourceId: string | null;
  similarity: number;
  contentText?: string;
};

/**
 * Propagate vector similarity from scrape university / scholarship / fee context hits
 * onto program candidates that share university name or country.
 */
export const boostCandidatesFromContextHits = async (
  candidates: RecommendationCandidate[],
  hits: RagHitLike[],
  existing: Map<string, number>,
): Promise<Map<string, number>> => {
  const out = new Map(existing);

  const uniIds = hits.filter(h => h.sourceType === 'rec_scrape_university' && h.sourceId).map(h => h.sourceId!);
  const scholarshipIds = hits
    .filter(h => h.sourceType === 'rec_scrape_scholarship' && h.sourceId)
    .map(h => h.sourceId!);
  const feeIds = hits.filter(h => h.sourceType === 'rec_scrape_fee' && h.sourceId).map(h => h.sourceId!);

  const simBySourceId = new Map(hits.filter(h => h.sourceId).map(h => [h.sourceId!, h.similarity]));

  const [unis, scholarships, fees] = await Promise.all([
    uniIds.length
      ? db.ScrapeUniversity.findAll({ where: { id: { [Op.in]: uniIds } }, attributes: ['id', 'universityName', 'country'] })
      : Promise.resolve([]),
    scholarshipIds.length
      ? db.ScrapeScholarship.findAll({
          where: { id: { [Op.in]: scholarshipIds } },
          attributes: ['id', 'universityName', 'country', 'scholarshipName'],
        })
      : Promise.resolve([]),
    feeIds.length
      ? db.ScrapeFee.findAll({ where: { id: { [Op.in]: feeIds } }, attributes: ['id', 'country', 'studyLevel'] })
      : Promise.resolve([]),
  ]);

  const bump = (refId: string, sim: number) => {
    const prev = out.get(refId) ?? 0;
    if (sim > prev) out.set(refId, sim);
  };

  for (const u of unis) {
    const plain = u.get({ plain: true }) as { id: string; universityName: string; country: string | null };
    const sim = simBySourceId.get(plain.id) ?? 0;
    for (const c of candidates) {
      if (c.universityName && namesMatch(c.universityName, plain.universityName)) {
        bump(c.refId, sim * 0.95);
      }
    }
  }

  for (const s of scholarships) {
    const plain = s.get({ plain: true }) as {
      id: string;
      universityName: string | null;
      country: string | null;
    };
    const sim = simBySourceId.get(plain.id) ?? 0;
    for (const c of candidates) {
      if (plain.universityName && c.universityName && namesMatch(c.universityName, plain.universityName)) {
        bump(c.refId, sim * 0.9);
      } else if (plain.country && c.country && countryLooseMatch(c.country, plain.country)) {
        bump(c.refId, sim * 0.55);
      }
    }
  }

  for (const f of fees) {
    const plain = f.get({ plain: true }) as { id: string; country: string | null; studyLevel: string | null };
    const sim = simBySourceId.get(plain.id) ?? 0;
    for (const c of candidates) {
      if (plain.country && c.country && countryLooseMatch(c.country, plain.country)) {
        const courseBand = inferAcademicBand(c.courseName, c.degree);
        const feeBand = plain.studyLevel ? inferAcademicBand(plain.studyLevel) : 'unknown';
        const levelOk =
          !plain.studyLevel ||
          feeBand === 'unknown' ||
          courseBand === 'unknown' ||
          feeBand === courseBand ||
          (courseBand === 'postgrad' && feeBand === 'doctoral');
        if (levelOk) bump(c.refId, sim * 0.75);
      }
    }
  }

  return out;
};
