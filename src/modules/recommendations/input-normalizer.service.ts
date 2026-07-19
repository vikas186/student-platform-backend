import type {
  AcademicBand,
  AgentMatchBody,
  NormalizedMatchInput,
  PublicMatchBody,
  RecommendationCandidate,
} from './recommendation.types';

const parseBudget = (value?: number | string): number | null => {
  if (value == null || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const n = parseFloat(String(value).replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? n : null;
};

/** Map UI / API level string to a strict academic band. */
export const wantedBandFromLevel = (level: string): AcademicBand => {
  const l = level.toLowerCase().trim();
  if (/high[_\s-]?school|secondary|foundation|pathway|diploma|certificate/i.test(l)) return 'diploma';
  if (/undergrad|bachelor|^ug$/i.test(l)) return 'undergrad';
  if (/postgrad|master|^pg$|mba|msc|meng/i.test(l)) return 'postgrad';
  if (/phd|doctor/i.test(l)) return 'doctoral';
  // Avoid bare "graduate" alone matching undergraduate — treat as postgrad only with post/master cues
  if (/\bgraduate\b/i.test(l) && !/undergrad/i.test(l)) return 'postgrad';
  return 'any';
};

/** Keywords used only for soft SQL prefiltering — not for final includes() matching. */
const levelKeywords = (level: string): string[] => {
  const band = wantedBandFromLevel(level);
  if (band === 'diploma') return ['diploma', 'certificate', 'foundation', 'pathway', 'associate'];
  if (band === 'undergrad') return ['undergraduate', 'bachelor', 'bachelors'];
  if (band === 'postgrad') return ['postgraduate', 'master', 'masters', 'mba', 'msc'];
  if (band === 'doctoral') return ['phd', 'doctorate', 'doctoral'];
  return [];
};

/**
 * Infer academic band from course title + study level.
 * Course title wins when study_level is wrong (e.g. Masters stored as "Bachelors").
 */
export const inferAcademicBand = (...parts: Array<string | null | undefined>): AcademicBand => {
  const t = parts.filter(Boolean).join(' ').toLowerCase().replace(/\s+/g, ' ').trim();
  if (!t) return 'unknown';

  if (/\b(ph\.?\s?d|dphil|doctorate|doctoral)\b/.test(t)) return 'doctoral';

  // Postgrad title cues first — catches Masters mislabeled as Bachelor in study_level
  if (
    /\bmaster of\b/.test(t) ||
    /\bmasters?\b/.test(t) ||
    /\bm\.?\s?sc\b/.test(t) ||
    /\bm\.?\s?eng\b/.test(t) ||
    /\bmeng\b/.test(t) ||
    /\bmba\b/.test(t) ||
    /\bmphil\b/.test(t) ||
    /\bmacs\b/.test(t) ||
    /\bpost-?\s*grad/.test(t) ||
    /\bpostgraduate\b/.test(t) ||
    /\bgraduate (certificate|diploma|program|programme)\b/.test(t) ||
    /\bpg(dip|cert|de)\b/.test(t)
  ) {
    return 'postgrad';
  }

  if (
    /\bbachelor of\b/.test(t) ||
    /\bbachelors?\b/.test(t) ||
    /\bb\.?\s?sc\b/.test(t) ||
    /\bb\.?\s?eng\b/.test(t) ||
    /\bbeng\b/.test(t) ||
    /\bbba\b/.test(t) ||
    /\bundergraduate\b/.test(t) ||
    /\bundergrad\b/.test(t)
  ) {
    return 'undergrad';
  }

  if (/\b(diploma|certificate|foundation|associate|pathway|hnd|hnc)\b/.test(t)) return 'diploma';

  return 'unknown';
};

/** Strict level check using course name + degree/studyLevel (title preferred). */
export const levelMatchesProgram = (
  courseName: string,
  degreeOrStudyLevel: string | null | undefined,
  wanted: AcademicBand,
): boolean => {
  if (!wanted || wanted === 'any') return true;
  const band = inferAcademicBand(courseName, degreeOrStudyLevel);
  if (band === 'unknown') return false;
  if (wanted === 'undergrad') return band === 'undergrad';
  if (wanted === 'postgrad') return band === 'postgrad' || band === 'doctoral';
  if (wanted === 'doctoral') return band === 'doctoral';
  if (wanted === 'diploma') return band === 'diploma';
  return false;
};

/** @deprecated Use levelMatchesProgram — kept for fee-context soft checks. */
export const levelMatchesDegree = (degree: string, levelKeywordsList: string[]): boolean => {
  if (!levelKeywordsList.length) return true;
  const wanted = levelKeywordsList.some(k => /master|postgrad|mba|msc|phd|graduate/i.test(k))
    ? levelKeywordsList.some(k => /undergrad|bachelor/i.test(k))
      ? 'any'
      : 'postgrad'
    : levelKeywordsList.some(k => /undergrad|bachelor/i.test(k))
      ? 'undergrad'
      : levelKeywordsList.some(k => /diploma|certificate|foundation/i.test(k))
        ? 'diploma'
        : 'any';
  return levelMatchesProgram('', degree, wanted as AcademicBand);
};

const fieldKeywords = (field: string): string[] => {
  const f = field.toLowerCase().trim();
  const words = f.split(/[\s,/]+/).filter(w => w.length >= 2);
  const extras: string[] = [];
  if (/business|commerce|mba|management|finance/i.test(f)) {
    extras.push('business', 'commerce', 'management', 'mba', 'finance');
  }
  if (/computer|software|cs\b|it\b|tech|data|informatics/i.test(f)) {
    extras.push('computer', 'software', 'technology', 'computing', 'informatics', 'data', 'programming');
  }
  if (/\bstem\b|engineering|math/i.test(f)) extras.push('stem', 'engineering', 'mathematics');
  if (/engineer/i.test(f)) extras.push('engineering', 'engineer');
  const filteredWords = words.filter(w => w !== 'science' || /computer|data|political|social/.test(f));
  return [...new Set([...filteredWords, ...extras])];
};

const programFocusWords = (text: string): string[] => {
  const words = text
    .toLowerCase()
    .split(/[\s,/+-]+/)
    .map(w => w.trim())
    .filter(w => w.length >= 2);
  return [...new Set(words)];
};

export const normalizePublicInput = (body: PublicMatchBody): NormalizedMatchInput => {
  const level = body.level.trim();
  const field = body.field.trim();
  const country = body.country.trim();
  const lk = levelKeywords(level);
  const fk = fieldKeywords(field);
  const wantedBand = wantedBandFromLevel(level);
  const budget = parseBudget(body.budget);
  const score = body.score != null && Number.isFinite(body.score) ? body.score : null;

  return {
    audience: 'public',
    level,
    field,
    country,
    score,
    budget,
    intake: body.intake?.trim() || null,
    fieldKeywords: fk,
    levelKeywords: lk,
    wantedBand,
    programFocusWords: programFocusWords(field),
    querySummary: `Level: ${level} (${wantedBand}). Field: ${field}. Country: ${country}.${budget ? ` Budget up to USD ${budget}.` : ''}${body.intake ? ` Intake: ${body.intake}.` : ''}${score != null ? ` Academic score: ${score}.` : ''} Only suggest programs at the ${wantedBand} academic level.`,
  };
};

export const normalizeAgentInput = (body: AgentMatchBody): NormalizedMatchInput => {
  const country = body.country.trim();
  const field = body.programFocus.trim();
  const words = programFocusWords(field);
  // Infer band from free-text focus when agent mentions MBA / masters / bachelor etc.
  const wantedBand = wantedBandFromLevel(field);

  return {
    audience: 'agent',
    level: wantedBand === 'any' ? 'any' : wantedBand,
    field,
    country,
    score: null,
    budget: null,
    intake: null,
    fieldKeywords: fieldKeywords(field),
    levelKeywords: wantedBand === 'any' ? [] : levelKeywords(wantedBand),
    wantedBand,
    programFocusWords: words,
    querySummary: `Find partner university programs in ${country} matching: "${field}".${wantedBand !== 'any' ? ` Prefer ${wantedBand} level programs.` : ''} Include admin catalog courses, fee ranges, and high-quality scraped programs. Prioritize semantic fit to the program focus.`,
  };
};

/** Soft relevance 0–1 for free-text program focus (agent + public rerank). */
export const scoreProgramFocus = (c: RecommendationCandidate, input: NormalizedMatchInput): number => {
  const focus = input.field.toLowerCase().trim();
  const hay = `${c.courseName} ${c.degree} ${c.universityName ?? ''} ${c.subjectTags.join(' ')} ${c.careerTags.join(' ')}`.toLowerCase();

  if (!focus) return 0.5;
  if (hay.includes(focus)) return 1;

  const words = input.programFocusWords.length ? input.programFocusWords : programFocusWords(focus);
  if (!words.length) return 0.4;

  let hits = 0;
  for (const w of words) {
    if (hay.includes(w)) hits += 1;
  }
  if (hits === 0) return 0.12;
  return Math.min(1, 0.35 + hits / words.length);
};

export const fieldMatchesText = (text: string, tags: string[], fieldKeywordsList: string[]): boolean => {
  if (!fieldKeywordsList.length) return true;
  const hay = `${text} ${tags.join(' ')}`.toLowerCase();
  return fieldKeywordsList.some(k => hay.includes(k.toLowerCase()));
};

const intakeMatches = (intake: string | null, normalizedIntakes: string[] | null, filter: string | null): boolean => {
  if (!filter) return true;
  const f = filter.toLowerCase();
  if (intake?.toLowerCase().includes(f)) return true;
  if (normalizedIntakes?.some(i => i.toLowerCase().includes(f))) return true;
  return false;
};

/** Soft intake fit 0–1 for reranking (intake data is often missing or imprecise). */
export const scoreIntake = (
  intake: string | null,
  normalizedIntakes: string[] | null,
  filter: string | null,
): number => {
  if (!filter) return 0.5;
  if (intakeMatches(intake, normalizedIntakes, filter)) return 1;

  const f = filter.toLowerCase();
  const hay = [intake, ...(normalizedIntakes ?? [])].filter(Boolean).join(' ').toLowerCase();
  if (!hay) return 0.35;

  const season = /fall|autumn|spring|summer|winter/.exec(f)?.[0];
  const year = /\d{4}/.exec(f)?.[0];
  if (season && hay.includes(season)) return year && hay.includes(year) ? 0.85 : 0.65;
  if (year && hay.includes(year)) return 0.55;
  return 0.3;
};
