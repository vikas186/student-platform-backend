export type CourseRefSource = 'catalog' | 'scrape' | 'fee_range';

export type RecommendationCandidate = {
  refId: string;
  source: CourseRefSource;
  courseId: number | string;
  courseName: string;
  degree: string;
  country: string;
  universityId: number | null;
  universityName: string | null;
  fee: number | null;
  feeRange: string | null;
  duration: string;
  intake: string | null;
  qualityScore: number;
  commissionPercent: number | null;
  subjectTags: string[];
  careerTags: string[];
  /** Short scholarship note from scrape_scholarships when matched by university/country */
  scholarshipHint: string | null;
  vectorSimilarity: number;
  rerankScore: number;
};

export type MatchAudience = 'public' | 'agent';

/** Academic level band used for strict UG/PG filtering */
export type AcademicBand = 'undergrad' | 'postgrad' | 'doctoral' | 'diploma' | 'unknown' | 'any';

export type NormalizedMatchInput = {
  audience: MatchAudience;
  level: string;
  field: string;
  country: string;
  score: number | null;
  budget: number | null;
  intake: string | null;
  fieldKeywords: string[];
  levelKeywords: string[];
  /** Strict academic band for UG/PG filtering (never drop for public matches) */
  wantedBand: AcademicBand;
  /** ILIKE patterns for country matching (aliases like UK → United Kingdom) */
  countryPatterns: string[];
  /** Lowercase words from program focus / field (length >= 2) for soft text scoring */
  programFocusWords: string[];
  querySummary: string;
};

export type PublicMatchBody = {
  level: string;
  field: string;
  country: string;
  score?: number;
  budget?: number | string;
  intake?: string;
};

export type AgentMatchBody = {
  country: string;
  programFocus: string;
  /** Academic level from Discovery UI (undergrad / postgrad / high_school). */
  level?: string;
  score?: number;
  budget?: number | string;
  intake?: string;
  limit?: number;
};

export type CareerDto = {
  role: string;
  salaryRange: string;
};

export type PublicSuggestion = {
  title: string;
  feeBand: string;
  careers: CareerDto[];
  matchReasons: string[];
  matchScore: number;
  university: null;
};

export type AgentPathway = {
  title: string;
  universityName: string;
  /** Catalog university id when resolved; null for scrape-only institutions */
  universityId: number | null;
  courseId: number | string;
  feeBand: string;
  careers: CareerDto[];
  commissionPercent: number | null;
  matchReasons: string[];
  matchScore: number;
};

export const RECOMMENDATION_DISCLAIMER =
  'Suggestions based on available program data. Verify fees and entry requirements with a counsellor before applying.';

export const REC_SOURCE_TYPES = [
  'rec_catalog',
  'rec_scrape',
  'rec_scrape_university',
  'rec_scrape_scholarship',
  'rec_scrape_fee',
  'rec_fee_range',
  'rec_career',
  'rec_commission',
] as const;

export type RecSourceType = (typeof REC_SOURCE_TYPES)[number];

/** Program-like chunks that map directly to candidate refIds */
export const REC_PROGRAM_SOURCE_TYPES = ['rec_catalog', 'rec_scrape', 'rec_fee_range'] as const;

/** Context chunks that enrich / boost program candidates (not picks themselves) */
export const REC_CONTEXT_SOURCE_TYPES = [
  'rec_scrape_university',
  'rec_scrape_scholarship',
  'rec_scrape_fee',
  'rec_career',
  'rec_commission',
] as const;

export const candidateRefKey = (source: CourseRefSource, courseId: number | string, universityId?: number | null): string => {
  if (source === 'fee_range') {
    return `fee_range:${universityId ?? 'x'}:${courseId}`;
  }
  return `${source}:${courseId}`;
};

export const parseCandidateRefKey = (
  refId: string,
): { source: CourseRefSource; courseId: string; universityId: number | null } | null => {
  const parts = refId.split(':');
  if (parts[0] === 'catalog' && parts.length >= 2) {
    return { source: 'catalog', courseId: parts[1], universityId: null };
  }
  if (parts[0] === 'scrape' && parts.length >= 2) {
    return { source: 'scrape', courseId: parts[1], universityId: null };
  }
  if (parts[0] === 'fee_range' && parts.length >= 3) {
    const uniId = parts[1] === 'x' ? null : parseInt(parts[1], 10);
    return { source: 'fee_range', courseId: parts.slice(2).join(':'), universityId: Number.isFinite(uniId) ? uniId : null };
  }
  return null;
};

export const ragHitToRefId = (sourceType: string, sourceId: string | null, universityId: number | null): string | null => {
  if (!sourceId) return null;
  if (sourceType === 'rec_catalog') return `catalog:${sourceId}`;
  if (sourceType === 'rec_scrape') return `scrape:${sourceId}`;
  if (sourceType === 'rec_fee_range') return `fee_range:${universityId ?? 'x'}:${sourceId}`;
  return null;
};
