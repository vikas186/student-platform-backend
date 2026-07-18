import { randomUUID } from 'crypto';
import { lookupCareers } from '../../../config/careerSalaryReference';
import { formatFeeBand } from '../../../utils/catalogProgram.util';
import type {
  AgentPathway,
  NormalizedMatchInput,
  PublicSuggestion,
  RecommendationCandidate,
} from './recommendation.types';
import { RECOMMENDATION_DISCLAIMER } from './recommendation.types';
import type { LlmPick } from './recommendation-llm.service';

export const buildPublicSuggestions = (
  picks: LlmPick[],
  candidates: RecommendationCandidate[],
  input: NormalizedMatchInput,
): PublicSuggestion[] => {
  const byRef = new Map(candidates.map(c => [c.refId, c]));

  return picks
    .map(pick => {
      const c = byRef.get(pick.refId);
      if (!c) return null;
      const matchReasons = [...pick.matchReasons];
      if (c.scholarshipHint && !matchReasons.some(r => /scholarship/i.test(r))) {
        matchReasons.push(`Scholarship: ${c.scholarshipHint}`);
      }
      return {
        title: c.courseName,
        feeBand: formatFeeBand(c.fee, c.feeRange),
        careers: lookupCareers(input.field, input.level, input.country, c.careerTags),
        matchReasons,
        matchScore: c.rerankScore,
        university: null as null,
      };
    })
    .filter((s): s is PublicSuggestion => s != null);
};

export const buildAgentPathways = (
  picks: LlmPick[],
  candidates: RecommendationCandidate[],
  input: NormalizedMatchInput,
): AgentPathway[] => {
  const byRef = new Map(candidates.map(c => [c.refId, c]));

  return picks
    .map(pick => {
      const c = byRef.get(pick.refId);
      if (!c || !c.universityName?.trim()) return null;
      const matchReasons = [...pick.matchReasons];
      if (c.scholarshipHint && !matchReasons.some(r => /scholarship/i.test(r))) {
        matchReasons.push(`Scholarship: ${c.scholarshipHint}`);
      }
      return {
        title: c.courseName,
        universityName: c.universityName,
        universityId: c.universityId,
        courseId: c.courseId,
        feeBand: formatFeeBand(c.fee, c.feeRange),
        careers: lookupCareers(input.field, input.level, input.country, c.careerTags),
        commissionPercent: c.commissionPercent,
        matchReasons,
        matchScore: c.rerankScore,
      };
    })
    .filter((p): p is AgentPathway => p != null);
};

export const wrapMatchResponse = <T>(suggestions: T[]) => ({
  requestId: randomUUID(),
  disclaimer: RECOMMENDATION_DISCLAIMER,
  suggestions: suggestions as T[],
});

export const wrapAgentResponse = (pathways: AgentPathway[]) => ({
  requestId: randomUUID(),
  disclaimer: RECOMMENDATION_DISCLAIMER,
  pathways,
});
