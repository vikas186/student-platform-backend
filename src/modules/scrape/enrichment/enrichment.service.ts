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

export { mergeRecord };

const emptyEnrichment = (): EnrichmentResult => ({
  subjectTags: [],
  careerTags: [],
  parserOutput: {},
  categorizerOutput: {},
});

/**
 * Optional AI enrichment. Disabled unless SCRAPE_AI_ENRICHMENT=true.
 * Scraping uses rule-based cleaners for validation by default.
 */
export const enrichEntity = async (ctx: EnrichmentContext): Promise<EnrichmentResult> => {
  if (!scrapeAiEnabled()) {
    return emptyEnrichment();
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
      aiSummary: aiSummary || undefined,
      subjectTags: (categorizerOutput as CategorizerOutput)?.subjectTags ?? [],
      careerTags: (categorizerOutput as CategorizerOutput)?.careerTags ?? [],
      ieltsRequired: (parserOutput as { ieltsRequired?: boolean })?.ieltsRequired,
      ieltsScore: (parserOutput as { ieltsScore?: string })?.ieltsScore,
      pageCategory: (categorizerOutput as CategorizerOutput)?.pageType,
      parserOutput: (parserOutput as Record<string, unknown>) || {},
      categorizerOutput: categorizerOutput || {},
      model: process.env.SCRAPE_OPENAI_MODEL || 'gpt-4o-mini',
    };
  } catch (err) {
    scrapeLogger.warn('AI enrichment failed for entity', {
      entityType: ctx.entityType,
      url: ctx.url,
      error: err instanceof Error ? err.message : String(err),
    });
    return emptyEnrichment();
  }
};
