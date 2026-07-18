import { getOpenAiClient, scrapeAiModel, scrapeAiEnabled } from '../enrichment/openai.client';
import { scrapeLogger } from '../logger';
import { Op } from 'sequelize';
import { db } from '../../../../config/database';

/** Standard Jaro-Winkler string similarity scorer. Returns value between 0.0 and 1.0. */
export function getJaroWinkler(s1: string, s2: string): number {
  const norm1 = s1.trim().toLowerCase();
  const norm2 = s2.trim().toLowerCase();

  if (norm1 === norm2) return 1.0;
  if (!norm1 || !norm2) return 0.0;

  const jaro = getJaroDistance(norm1, norm2);
  if (jaro < 0.7) return jaro;

  let prefixLength = 0;
  const maxPrefix = 4;
  for (let i = 0; i < Math.min(norm1.length, norm2.length, maxPrefix); i++) {
    if (norm1[i] === norm2[i]) {
      prefixLength++;
    } else {
      break;
    }
  }

  return jaro + prefixLength * 0.1 * (1.0 - jaro);
}

function getJaroDistance(s1: string, s2: string): number {
  const len1 = s1.length;
  const len2 = s2.length;
  const matchWindow = Math.floor(Math.max(len1, len2) / 2) - 1;

  const matches1 = new Array(len1).fill(false);
  const matches2 = new Array(len2).fill(false);

  let matches = 0;
  let transpositions = 0;

  for (let i = 0; i < len1; i++) {
    const start = Math.max(0, i - matchWindow);
    const end = Math.min(len2 - 1, i + matchWindow);

    for (let j = start; j <= end; j++) {
      if (!matches2[j] && s1[i] === s2[j]) {
        matches1[i] = true;
        matches2[j] = true;
        matches++;
        break;
      }
    }
  }

  if (matches === 0) return 0.0;

  let k = 0;
  for (let i = 0; i < len1; i++) {
    if (matches1[i]) {
      while (!matches2[k]) k++;
      if (s1[i] !== s2[k]) transpositions++;
      k++;
    }
  }

  const t = transpositions / 2;
  return (matches / len1 + matches / len2 + (matches - t) / matches) / 3.0;
}

/** Returns true if s1 is a subsequence/acronym of s2, or vice-versa. */
export function isAcronym(s1: string, s2: string): boolean {
  const a = s1.trim().toLowerCase();
  const f = s2.trim().toLowerCase();
  if (a.length < 2 || f.length < 2) return false;

  let ai = 0;
  for (let fi = 0; fi < f.length; fi++) {
    if (f[fi] === a[ai]) {
      ai++;
      if (ai === a.length) return true;
    }
  }

  const words = f.split(/\s+/).filter(Boolean);
  const acronym = words.map(w => w[0]).join('');
  if (acronym.includes(a) || a.includes(acronym)) return true;

  return false;
}

/** Calls OpenAI to determine if two slightly different university names refer to the same entity. */
export const checkSemanticDuplicate = async (
  scrapedName: string,
  candidateName: string,
  country: string,
  city: string | null
): Promise<boolean> => {
  if (!scrapeAiEnabled()) {
    scrapeLogger.debug('AI duplicate checking is disabled or key is missing. Falling back.');
    const score = getJaroWinkler(scrapedName, candidateName);
    return score >= 0.92;
  }

  try {
    const openai = getOpenAiClient();
    const model = scrapeAiModel();

    const prompt = `You are a professional database cleaning assistant.
Compare the following two university records in the location "${city || 'Unknown'}, ${country}" and decide if they refer to the exact same university entity (even if formatted, abbreviated, or translated differently), or if they are separate/distinct institutions.

Record A:
- Name: "${scrapedName}"

Record B:
- Name: "${candidateName}"

Examples of duplicates:
- "University of Connecticut" and "UConn"
- "University of Connecticut" and "University of Connecticut, Storrs"
- "University of Connecticut" and "University of Connecticut (Public Ivy)"

Provide your decision in JSON format with the following keys:
1. "isDuplicate": boolean (true if they are the same university entity, false if they are different/distinct universities)
2. "explanation": string (short reasoning)

JSON:`;

    const completion = await openai.chat.completions.create({
      model,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.1,
    });

    const resText = completion.choices[0]?.message?.content || '{}';
    const result = JSON.parse(resText);

    scrapeLogger.info('AI duplicate match result', {
      scrapedName,
      candidateName,
      isDuplicate: result.isDuplicate,
      explanation: result.explanation,
    });

    return !!result.isDuplicate;
  } catch (err) {
    scrapeLogger.warn('AI duplicate detection check failed, falling back to Jaro-Winkler score', {
      error: err instanceof Error ? err.message : String(err),
    });
    const score = getJaroWinkler(scrapedName, candidateName);
    return score >= 0.92;
  }
};

/** Finds a duplicate in the master Universities table using Jaro-Winkler and semantic check. */
export async function findMasterUniversityDuplicate(
  name: string,
  country: string
): Promise<any | null> {
  const normName = name.trim();
  const normCountry = country.trim();

  // 0. Same institution name (any country) — catalog CSVs sometimes put program titles in country.
  const byName = await db.University.findOne({
    where: { name: { [Op.iLike]: normName } },
    order: [['id', 'ASC']],
  });
  if (byName) {
    scrapeLogger.info('Exact master university name duplicate found', { name: normName });
    return byName;
  }

  // 1. Exact case-insensitive match on name + country
  const exact = await db.University.findOne({
    where: {
      name: { [Op.iLike]: normName },
      country: { [Op.iLike]: normCountry },
    },
  });
  if (exact) {
    scrapeLogger.info('Exact master university duplicate found', { name: normName });
    return exact;
  }

  // 2. Fuzzy/AI check (same country when present)
  const candidates = await db.University.findAll({
    where: normCountry
      ? {
          [Op.or]: [
            { country: { [Op.iLike]: normCountry } },
            { name: { [Op.iLike]: `%${normName.slice(0, Math.min(12, normName.length))}%` } },
          ],
        }
      : { name: { [Op.iLike]: `%${normName.slice(0, Math.min(12, normName.length))}%` } },
    limit: 200,
  });

  for (const candidate of candidates) {
    if (candidate.name.trim().toLowerCase() === normName.toLowerCase()) {
      scrapeLogger.info('Exact case-insensitive master university duplicate matched', { name: normName });
      return candidate;
    }

    const score = getJaroWinkler(normName, candidate.name);
    if (score >= 0.95) {
      scrapeLogger.info('High similarity master university duplicate matched (Jaro-Winkler)', {
        name: normName,
        matchedAs: candidate.name,
        score,
      });
      return candidate;
    }

    const isAbbr = isAcronym(normName, candidate.name) || isAcronym(candidate.name, normName);
    if (score >= 0.70 || isAbbr) {
      const isDuplicate = await checkSemanticDuplicate(normName, candidate.name, normCountry, null);
      if (isDuplicate) {
        scrapeLogger.info('AI semantic master university duplicate matched', {
          name: normName,
          matchedAs: candidate.name,
          score,
          isAbbr,
        });
        return candidate;
      }
    }
  }

  return null;
}
