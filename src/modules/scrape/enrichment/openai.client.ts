import OpenAI from 'openai';

let client: OpenAI | null = null;

export const getOpenAiClient = (): OpenAI => {
  if (!process.env.OPENAI_API_KEY?.trim()) {
    throw new Error('OPENAI_API_KEY is not configured');
  }
  if (!client) {
    client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return client;
};

export const scrapeAiModel = (): string =>
  process.env.SCRAPE_OPENAI_MODEL || process.env.OPENAI_CHAT_MODEL || 'gpt-4o-mini';

export const scrapeAiDelayMs = (): number =>
  parseInt(process.env.SCRAPE_AI_DELAY_MS || '300', 10);

/**
 * Scrape AI enrichment is OFF by default.
 * Rule-based cleaners + quality scores validate data; set SCRAPE_AI_ENRICHMENT=true to opt in.
 */
export const scrapeAiEnabled = (): boolean =>
  process.env.SCRAPE_AI_ENRICHMENT === 'true' && !!process.env.OPENAI_API_KEY?.trim();

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

export const rateLimitAi = async (): Promise<void> => {
  await sleep(scrapeAiDelayMs());
};
