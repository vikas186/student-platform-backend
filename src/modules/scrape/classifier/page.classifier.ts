import type { ClassificationResult, PageType } from '../extractors/types';

const REJECT_SIGNALS: Array<{ re: RegExp; weight: number; label: string }> = [
  { re: /\bvisa\b/i, weight: 12, label: 'visa content' },
  { re: /\bielts\b/i, weight: 12, label: 'IELTS content' },
  { re: /\btoefl\b/i, weight: 12, label: 'TOEFL content' },
  { re: /\bimmigration\b/i, weight: 10, label: 'immigration' },
  { re: /\bblog\b/i, weight: 10, label: 'blog' },
  { re: /\/blog\b/i, weight: 10, label: 'blog URL' },
  { re: /\bnews\b/i, weight: 8, label: 'news' },
  { re: /\bevents?\b/i, weight: 8, label: 'events' },
  { re: /student life/i, weight: 8, label: 'student life' },
  { re: /reasons to study/i, weight: 10, label: 'reasons to study' },
  { re: /career guide/i, weight: 8, label: 'career guide' },
  { re: /work permit/i, weight: 10, label: 'work permit' },
];

const COURSE_SIGNALS: Array<{ re: RegExp; weight: number }> = [
  { re: /\bduration\b/i, weight: 10 },
  { re: /\btuition\b|\btuition fee\b|\bprogramme fee\b/i, weight: 12 },
  { re: /\bintake\b|\bstart date\b|\bcommencement\b/i, weight: 10 },
  { re: /\b(bachelor|master|mba|msc|bsc|phd|diploma|undergraduate|postgraduate)\b/i, weight: 14 },
  { re: /\bentry requirement\b|\badmission requirement\b|\beligibility\b/i, weight: 10 },
  { re: /\bcourse overview\b|\bprogram overview\b/i, weight: 8 },
  { re: /\/(course|program|programme|degree)s?\b/i, weight: 8 },
];

const UNIVERSITY_SIGNALS: Array<{ re: RegExp; weight: number }> = [
  { re: /\branking\b|\branked\b/i, weight: 12 },
  { re: /\bcampus\b/i, weight: 10 },
  { re: /\buniversity overview\b|\babout (the )?university\b/i, weight: 10 },
  { re: /\bfacult(y|ies)\b/i, weight: 10 },
  { re: /\bdepartments?\b/i, weight: 8 },
  { re: /\bpopular courses\b|\bfeatured programs\b/i, weight: 8 },
  { re: /\/universit(y|ies)\b/i, weight: 10 },
];

const FEE_SIGNALS: Array<{ re: RegExp; weight: number }> = [
  { re: /\btuition fee\b|\btuition fees\b/i, weight: 14 },
  { re: /\bliving cost\b|\bcost of living\b/i, weight: 12 },
  { re: /\baccommodation cost\b|\bhousing cost\b/i, weight: 10 },
  { re: /\bstudy expenses\b|\beducation cost\b/i, weight: 10 },
  { re: /\b(usd|aud|gbp|cad|eur|inr|\$|£|€)\b/i, weight: 6 },
  { re: /\/(fees?|costs?|tuition)\b/i, weight: 10 },
];

const SCHOLARSHIP_SIGNALS: Array<{ re: RegExp; weight: number }> = [
  { re: /\bscholarship\b|\bfinancial aid\b/i, weight: 14 },
  { re: /\bgrant\b|\bfunding\b|\bbursary\b/i, weight: 10 },
  { re: /\beligibility\b/i, weight: 8 },
  { re: /\bdeadline\b|\bapplication deadline\b/i, weight: 8 },
  { re: /\bamount\b|\baward\b|\bcoverage\b/i, weight: 8 },
  { re: /\/scholarship/i, weight: 12 },
];

const scoreSignals = (hay: string, signals: Array<{ re: RegExp; weight: number }>): number => {
  let score = 0;
  for (const s of signals) {
    if (s.re.test(hay)) score += s.weight;
  }
  return score;
};

const emptyScores = (): Record<PageType, number> => ({
  course: 0,
  course_listing: 0,
  university: 0,
  fee: 0,
  scholarship: 0,
  reject: 0,
});

export const classifyPage = (url: string, title: string, content: string): ClassificationResult => {
  const hay = `${url}\n${title}\n${content}`.slice(0, 120_000);
  const scores = emptyScores();

  for (const s of REJECT_SIGNALS) {
    if (s.re.test(hay)) scores.reject += s.weight;
  }

  scores.course = scoreSignals(hay, COURSE_SIGNALS);
  scores.university = scoreSignals(hay, UNIVERSITY_SIGNALS);
  scores.fee = scoreSignals(hay, FEE_SIGNALS);
  scores.scholarship = scoreSignals(hay, SCHOLARSHIP_SIGNALS);

  const candidates: PageType[] = ['course', 'university', 'fee', 'scholarship'];
  let best: PageType = 'reject';
  let bestScore = 0;

  for (const c of candidates) {
    if (scores[c] > bestScore) {
      bestScore = scores[c];
      best = c;
    }
  }

  if (bestScore < 12) {
    return { type: 'reject', scores, reason: 'insufficient entity signals' };
  }

  if (scores.reject >= 18 && scores.reject > bestScore) {
    return { type: 'reject', scores, reason: `informational or SEO page (reject signals of ${scores.reject} dominate best entity score of ${bestScore})` };
  }

  return { type: best, scores };
};
