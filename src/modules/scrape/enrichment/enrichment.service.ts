import { scrapeAiEnabled } from './openai.client';
import { categorizeAndTagPage } from './categorizer.service';
import { parseHtmlToStructuredFields } from './html-parser.service';
import { summarizeEntity } from './summarizer.service';
import type { CategorizerOutput } from '../schemas/scrape.schemas';
import { scrapeLogger } from '../logger';

export type EnrichmentContext = {
  entityType: 'course' | 'university' | 'scholarship';
  url: string;
  title: string;
  pageText: string;
};

export type EnrichmentResult = {
  aiSummary?: string;
  subjectTags: string[];
  careerTags: string[];
  ieltsRequired?: boolean;
  ieltsScore?: string;
  pageCategory?: string;
  parserOutput: Record<string, unknown>;
  categorizerOutput: CategorizerOutput | Record<string, unknown>;
  model?: string;
};

const mergeRecord = <T extends Record<string, unknown>>(base: T, patch: Record<string, unknown>): T => {
  const out = { ...base };
  for (const [k, v] of Object.entries(patch)) {
    if (v != null && v !== '') (out as Record<string, unknown>)[k] = v;
  }
  return out;
};

export const enrichEntity = async (ctx: EnrichmentContext): Promise<EnrichmentResult> => {
  const empty: EnrichmentResult = {
    subjectTags: [],
    careerTags: [],
    parserOutput: {},
    categorizerOutput: {},
  };

  if (!scrapeAiEnabled()) {
    scrapeLogger.debug('AI enrichment skipped (disabled or no API key)');
    return empty;
  }

  try {
    const [categorizerOutput, parserOutput, aiSummary] = await Promise.all([
      categorizeAndTagPage({ url: ctx.url, title: ctx.title, content: ctx.pageText }),
      parseHtmlToStructuredFields({
        entityType: ctx.entityType,
        url: ctx.url,
        title: ctx.title,
        htmlOrText: ctx.pageText,
      }),
      summarizeEntity({ entityType: ctx.entityType, title: ctx.title, content: ctx.pageText }),
    ]);

    return {
      aiSummary,
      subjectTags: categorizerOutput.subjectTags || [],
      careerTags: categorizerOutput.careerTags || [],
      ieltsRequired: categorizerOutput.ieltsRequired,
      ieltsScore: categorizerOutput.ieltsScore,
      pageCategory: categorizerOutput.pageType,
      parserOutput,
      categorizerOutput,
      model: process.env.SCRAPE_OPENAI_MODEL || 'gpt-4o-mini',
    };
  } catch (err) {
    scrapeLogger.warn('AI enrichment failed for entity', {
      entityType: ctx.entityType,
      url: ctx.url,
      error: err instanceof Error ? err.message : String(err),
    });
    return empty;
  }
};

export { mergeRecord };
