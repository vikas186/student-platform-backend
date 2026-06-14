import type { NormalizedMatchInput, RecommendationCandidate } from './recommendation.types';
import { fieldMatchesText, scoreProgramFocus, scoreIntake } from './input-normalizer.service';

export type RerankAudience = 'public' | 'agent';

const WEIGHTS = {
  public: { budget: 0.25, field: 0.28, quality: 0.2, vector: 0.15, intake: 0.12, commission: 0 },
  agent: { budget: 0.1, field: 0.25, quality: 0.2, vector: 0.25, intake: 0, commission: 0.2 },
};

const scoreBudget = (fee: number | null, budget: number | null): number => {
  if (budget == null || budget <= 0) return 0.5;
  if (fee == null) return 0.4;
  if (fee <= budget) return 1;
  const over = (fee - budget) / budget;
  return Math.max(0, 1 - over);
};

const scoreField = (c: RecommendationCandidate, input: NormalizedMatchInput, audience: RerankAudience): number => {
  if (audience === 'agent') return scoreProgramFocus(c, input);
  if (fieldMatchesText(`${c.courseName} ${c.degree}`, c.subjectTags, input.fieldKeywords)) return 1;
  return 0.2;
};

const scoreQuality = (c: RecommendationCandidate): number => {
  const base = Math.min(1, c.qualityScore / 100);
  if (c.source === 'catalog') return Math.min(1, base + 0.12);
  if (c.source === 'fee_range') return Math.min(1, base + 0.08);
  return base;
};

const scoreCommission = (c: RecommendationCandidate): number => {
  if (c.commissionPercent == null) return 0.3;
  return Math.min(1, c.commissionPercent / 25);
};

export const rerankCandidates = (
  candidates: RecommendationCandidate[],
  input: NormalizedMatchInput,
  audience: RerankAudience,
  topN = 8,
): RecommendationCandidate[] => {
  const w = WEIGHTS[audience];

  const scored = candidates.map(c => {
    const intakeScore =
      audience === 'public' ? scoreIntake(c.intake, null, input.intake) : 0.5;

    const rerankScore =
      100 *
      (w.budget * scoreBudget(c.fee, input.budget) +
        w.field * scoreField(c, input, audience) +
        w.quality * scoreQuality(c) +
        w.vector * Math.min(1, c.vectorSimilarity) +
        (w.intake ?? 0) * intakeScore +
        w.commission * scoreCommission(c));

    return { ...c, rerankScore: Math.round(rerankScore * 10) / 10 };
  });

  return scored.sort((a, b) => b.rerankScore - a.rerankScore).slice(0, topN);
};

export const mergeVectorScores = (
  candidates: RecommendationCandidate[],
  refSimilarity: Map<string, number>,
): RecommendationCandidate[] =>
  candidates.map(c => ({
    ...c,
    vectorSimilarity: refSimilarity.get(c.refId) ?? c.vectorSimilarity,
  }));

export const intersectWithVectorHits = (
  pool: RecommendationCandidate[],
  refSimilarity: Map<string, number>,
  audience: RerankAudience = 'public',
): RecommendationCandidate[] => {
  if (refSimilarity.size === 0) return pool;

  // Agent: keep full country pool; vector similarity boosts ranking only.
  if (audience === 'agent') {
    return mergeVectorScores(pool, refSimilarity);
  }

  /** Admin-uploaded catalog courses + fee matrix — always keep in the candidate set */
  const manualRows = pool.filter(c => c.source === 'catalog' || c.source === 'fee_range');
  const hitIds = new Set(refSimilarity.keys());
  const vectorMatched = pool.filter(c => hitIds.has(c.refId));

  const byRef = new Map<string, RecommendationCandidate>();
  for (const c of manualRows) byRef.set(c.refId, c);
  for (const c of vectorMatched) byRef.set(c.refId, c);

  const merged = byRef.size > 0 ? [...byRef.values()] : pool;
  return mergeVectorScores(merged, refSimilarity);
};
