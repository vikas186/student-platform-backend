import OpenAI from 'openai';
import type { RecommendationCandidate } from './recommendation.types';
import type { RerankAudience } from './recommendation-rerank.service';

let client: OpenAI | null = null;

const getClient = (): OpenAI => {
  if (!process.env.OPENAI_API_KEY?.trim()) {
    throw new Error('OPENAI_API_KEY is not configured');
  }
  if (!client) {
    client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return client;
};

const chatModel = () => process.env.OPENAI_CHAT_MODEL || 'gpt-4o-mini';

export type LlmPick = {
  refId: string;
  matchReasons: string[];
};

export const pickCandidatesWithLlm = async (
  candidates: RecommendationCandidate[],
  pickCount: number,
  inputSummary: string,
  audience: RerankAudience = 'public',
): Promise<LlmPick[]> => {
  if (!candidates.length) return [];

  const simplified = candidates.map(c => ({
    refId: c.refId,
    title: c.courseName,
    level: c.degree,
    country: c.country,
    university: c.universityName,
    fee: c.fee,
    feeRange: c.feeRange,
    qualityScore: c.qualityScore,
    commissionPercent: c.commissionPercent,
    scholarshipHint: c.scholarshipHint,
    source: c.source,
  }));

  const systemPrompt =
    audience === 'agent'
      ? `You help education agents find partner university programs for their students.
Pick exactly ${pickCount} items ONLY from the provided candidates list.
The agent typed free-text program focus (e.g. nursing, law, MBA, engineering) — choose programs that best match that intent semantically, not only exact keyword matches.
Prefer catalog and fee-range rows when they fit; include scraped programs when they are strong matches.
When commissionPercent is present, mention partner commission as a reason when relevant.
When scholarshipHint is present, mention relevant scholarships as a reason.
Do not invent courses, fees, scholarships, or universities.
Output JSON: { "picks": [{ "refId": string, "matchReasons": string[] }] }
Each matchReasons array should have 2-3 short bullet reasons.`
      : `You select course recommendations for a student recruitment platform.
Pick exactly ${pickCount} items ONLY from the provided candidates list.
When scholarshipHint is present, mention relevant scholarships as a reason.
Do not invent courses, fees, scholarships, or universities.
Output JSON: { "picks": [{ "refId": string, "matchReasons": string[] }] }
Each matchReasons array should have 2-3 short bullet reasons.`;

  const res = await getClient().chat.completions.create({
    model: chatModel(),
    temperature: 0.2,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: systemPrompt,
      },
      {
        role: 'user',
        content: `User preferences: ${inputSummary}

Candidates (pick ${pickCount}):
${JSON.stringify(simplified)}`,
      },
    ],
    max_tokens: 800,
  });

  const raw = res.choices[0]?.message?.content?.trim();
  if (!raw) return fallbackPick(candidates, pickCount, audience);

  try {
    const parsed = JSON.parse(raw) as { picks?: LlmPick[] };
    const picks = parsed.picks ?? [];
    const validIds = new Set(candidates.map(c => c.refId));
    const filtered = picks.filter(p => validIds.has(p.refId)).slice(0, pickCount);
    if (filtered.length > 0) return filtered;
  } catch {
    /* fallback below */
  }

  return fallbackPick(candidates, pickCount, audience);
};

const fallbackPick = (
  candidates: RecommendationCandidate[],
  pickCount: number,
  audience: RerankAudience = 'public',
): LlmPick[] =>
  candidates.slice(0, pickCount).map(c => ({
    refId: c.refId,
    matchReasons:
      audience === 'agent'
        ? [
            `Program aligns with agent search focus`,
            c.universityName ? `At ${c.universityName} in ${c.country}` : `Available in ${c.country}`,
            c.commissionPercent != null
              ? `Partner commission ${c.commissionPercent}%`
              : c.fee != null
                ? `Fee around $${Math.round(c.fee).toLocaleString()}`
                : 'Fee details in band below',
          ]
        : [
            `Matches your ${c.degree} level preference`,
            `Available in ${c.country}`,
            c.fee != null ? `Fee around $${Math.round(c.fee).toLocaleString()}` : 'Fee details in band below',
          ],
  }));
