import type { EntityCleaningStatus } from '../extractors/types';

export type QualityResult = { score: number; status: EntityCleaningStatus };

export const scoreToEntityStatus = (score: number): EntityCleaningStatus => {
  if (score >= 70) return 'high_quality';
  if (score >= 40) return 'needs_review';
  return 'rejected';
};

export const clampScore = (score: number): number => Math.min(100, Math.max(0, score));

export const scoreFromFields = (fields: Array<{ present: boolean; weight: number }>): QualityResult => {
  let score = 0;
  for (const f of fields) {
    if (f.present) score += f.weight;
  }
  score = clampScore(score);
  return { score, status: scoreToEntityStatus(score) };
};
