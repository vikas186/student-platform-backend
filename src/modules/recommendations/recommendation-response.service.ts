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

/** Prefer a real destination country over catalog placeholder "General". */
const resolveFeeCountry = (
  candidateCountry: string | null | undefined,
  inputCountry: string | null | undefined,
  universityName?: string | null,
): string | null => {
  const c = (candidateCountry || '').trim();
  const i = (inputCountry || '').trim();
  const isPlaceholder = (v: string) =>
    !v || /^(general|international|mixed)(\b|\/)/i.test(v) || looksLikeProgramCountry(v);

  // User's Course Mapping / apply destination wins — catalog rows are often mislabeled
  // (e.g. Australian unis stored as General/USA), which forced USD fees.
  if (i && !isPlaceholder(i)) return i;

  if (c && !isPlaceholder(c)) return c;
  const fromName = inferCountryFromUniversityName(universityName);
  if (fromName) return fromName;
  return c || i || null;
};

const looksLikeProgramCountry = (v: string): boolean =>
  /\(Hons\)|Foundation Year|Bachelor of|Master of/i.test(v) || v.length > 64;

const inferCountryFromUniversityName = (name: string | null | undefined): string | null => {
  const n = (name || '').toLowerCase();
  if (!n) return null;
  if (/germany|berlin|munich|hamburg|frankfurt/.test(n)) return 'Germany';
  if (/france|paris|lyon/.test(n)) return 'France';
  if (/netherlands|amsterdam|delft/.test(n)) return 'Netherlands';
  if (/united kingdom|\buk\b|london|manchester|edinburgh|scotland|england/.test(n)) {
    return 'United Kingdom';
  }
  if (/australia|sydney|melbourne|brisbane|perth|adelaide|canberra/.test(n)) return 'Australia';
  if (/canada|toronto|vancouver|montreal/.test(n)) return 'Canada';
  if (/new zealand|auckland|wellington/.test(n)) return 'New Zealand';
  if (/united states|\busa\b|new york|boston|california/.test(n)) return 'USA';
  if (/ireland|dublin/.test(n)) return 'Ireland';
  if (/singapore/.test(n)) return 'Singapore';
  if (/switzerland|zurich|zürich/.test(n)) return 'Switzerland';
  return null;
};

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
      const feeCountry = resolveFeeCountry(c.country, input.country, c.universityName);
      return {
        title: c.courseName,
        feeBand: formatFeeBand(c.fee, c.feeRange, feeCountry),
        careers: lookupCareers(input.field, input.level, input.country, c.careerTags, c.courseName),
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
      const feeCountry = resolveFeeCountry(c.country, input.country, c.universityName);
      return {
        title: c.courseName,
        universityName: c.universityName,
        universityId: c.universityId,
        courseId: c.courseId,
        feeBand: formatFeeBand(c.fee, c.feeRange, feeCountry),
        careers: lookupCareers(input.field, input.level, input.country, c.careerTags, c.courseName),
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
