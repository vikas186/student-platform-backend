import type { AgentMatchBody, NormalizedMatchInput, PublicMatchBody, RecommendationCandidate } from './recommendation.types';

const parseBudget = (value?: number | string): number | null => {
  if (value == null || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const n = parseFloat(String(value).replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? n : null;
};

const levelKeywords = (level: string): string[] => {
  const l = level.toLowerCase().trim();
  if (/high[_\s-]?school|secondary|foundation|pathway/i.test(l)) {
    return ['diploma', 'certificate', 'foundation', 'pathway', 'associate', 'undergraduate', 'bachelor'];
  }
  if (/undergrad|bachelor|ug|bsc|ba\b|beng/i.test(l)) {
    return ['undergraduate', 'bachelor', 'bachelors', 'ug', 'bsc', 'ba', 'beng'];
  }
  if (/postgrad|master|pg|graduate|mba|msc|meng/i.test(l)) {
    return ['postgraduate', 'master', 'masters', 'graduate', 'mba', 'msc', 'meng', 'pg'];
  }
  return [l];
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
  // Avoid bare "science" — it matches almost every BSc and empties CS-specific pools after a quality-ranked limit.
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
    programFocusWords: programFocusWords(field),
    querySummary: `Level: ${level}. Field: ${field}. Country: ${country}.${budget ? ` Budget up to USD ${budget}.` : ''}${body.intake ? ` Intake: ${body.intake}.` : ''}${score != null ? ` Academic score: ${score}.` : ''}`,
  };
};

export const normalizeAgentInput = (body: AgentMatchBody): NormalizedMatchInput => {
  const country = body.country.trim();
  const field = body.programFocus.trim();
  const words = programFocusWords(field);

  return {
    audience: 'agent',
    level: 'any',
    field,
    country,
    score: null,
    budget: null,
    intake: null,
    fieldKeywords: fieldKeywords(field),
    levelKeywords: [],
    programFocusWords: words,
    querySummary: `Find partner university programs in ${country} matching: "${field}". Include admin catalog courses, fee ranges, and high-quality scraped programs. Prioritize semantic fit to the program focus.`,
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

export const levelMatchesDegree = (degree: string, levelKeywordsList: string[]): boolean => {
  if (!levelKeywordsList.length) return true;
  const d = degree.toLowerCase();
  return levelKeywordsList.some(k => d.includes(k));
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
