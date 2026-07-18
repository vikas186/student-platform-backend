import { embedText } from '../chat/embedding.service';
import { assertKnowledgeBaseReady, searchRecommendationKnowledge } from '../chat/knowledge-base.service';
import { buildCandidatePool } from './candidate-pool.service';
import { normalizeAgentInput, normalizePublicInput } from './input-normalizer.service';
import { pickCandidatesWithLlm } from './recommendation-llm.service';
import { buildAgentPathways, buildPublicSuggestions, wrapAgentResponse, wrapMatchResponse } from './recommendation-response.service';
import { intersectWithVectorHits, rerankCandidates } from './recommendation-rerank.service';
import { boostCandidatesFromContextHits } from './scrape-context.service';
import type { AgentMatchBody, PublicMatchBody } from './recommendation.types';
import { ragHitToRefId } from './recommendation.types';

const buildRefSimilarityMap = (
  hits: Awaited<ReturnType<typeof searchRecommendationKnowledge>>,
): Map<string, number> => {
  const m = new Map<string, number>();
  for (const h of hits) {
    const refId = ragHitToRefId(h.sourceType, h.sourceId, h.universityId);
    if (!refId) continue;
    const prev = m.get(refId) ?? 0;
    if (h.similarity > prev) m.set(refId, h.similarity);
  }
  return m;
};

export const matchPublicRecommendations = async (body: PublicMatchBody) => {
  await assertKnowledgeBaseReady();
  const input = normalizePublicInput(body);

  const [pool, embedding] = await Promise.all([buildCandidatePool(input), embedText(input.querySummary)]);

  let hits: Awaited<ReturnType<typeof searchRecommendationKnowledge>> = [];
  try {
    hits = await searchRecommendationKnowledge(embedding, 'public', { limit: 16 });
  } catch {
    hits = [];
  }

  const refSimilarity = await boostCandidatesFromContextHits(pool, hits, buildRefSimilarityMap(hits));
  let merged = intersectWithVectorHits(pool, refSimilarity, 'public');
  if (!merged.length) merged = pool;

  const reranked = rerankCandidates(merged, input, 'public', 8);
  const pickCount = Math.min(4, Math.max(3, reranked.length >= 3 ? 4 : reranked.length));
  const picks = await pickCandidatesWithLlm(reranked, pickCount, input.querySummary);
  const suggestions = buildPublicSuggestions(picks, reranked, input);

  return wrapMatchResponse(suggestions);
};

export const matchAgentRecommendations = async (body: AgentMatchBody) => {
  await assertKnowledgeBaseReady();
  const input = normalizeAgentInput(body);
  const limit = Math.min(4, Math.max(1, body.limit ?? 2));

  const [pool, embedding] = await Promise.all([buildCandidatePool(input), embedText(input.querySummary)]);

  let hits: Awaited<ReturnType<typeof searchRecommendationKnowledge>> = [];
  try {
    hits = await searchRecommendationKnowledge(embedding, 'agent', { limit: 24 });
  } catch {
    hits = [];
  }

  const refSimilarity = await boostCandidatesFromContextHits(pool, hits, buildRefSimilarityMap(hits));
  let merged = intersectWithVectorHits(pool, refSimilarity, 'agent');
  if (!merged.length) merged = pool;

  const reranked = rerankCandidates(merged, input, 'agent', 12);
  const picks = await pickCandidatesWithLlm(reranked.length ? reranked : merged, limit, input.querySummary, 'agent');
  const candidateMap = new Map(reranked.map(c => [c.refId, c]));
  for (const c of merged) {
    if (!candidateMap.has(c.refId)) candidateMap.set(c.refId, c);
  }
  const pathways = buildAgentPathways(picks, [...candidateMap.values()], input);

  return wrapAgentResponse(pathways);
};
