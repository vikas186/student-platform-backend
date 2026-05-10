import OpenAI from 'openai';

const embeddingModel = () => process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small';

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

/** Returns a 1536-dim vector for `text-embedding-3-small` (default dimensions). */
export const embedText = async (text: string): Promise<number[]> => {
  const c = getClient();
  const res = await c.embeddings.create({
    model: embeddingModel(),
    input: text.replace(/\s+/g, ' ').trim().slice(0, 8000),
  });
  const emb = res.data[0]?.embedding;
  if (!emb?.length) {
    throw new Error('OpenAI returned an empty embedding');
  }
  return emb;
};

export const embedTexts = async (texts: string[]): Promise<number[][]> => {
  if (texts.length === 0) return [];
  const c = getClient();
  const inputs = texts.map(t => t.replace(/\s+/g, ' ').trim().slice(0, 8000));
  const res = await c.embeddings.create({
    model: embeddingModel(),
    input: inputs,
  });
  return res.data.sort((a, b) => a.index - b.index).map(d => d.embedding);
};

export const vectorLiteral = (embedding: number[]): string => `[${embedding.join(',')}]`;

/** Cosine similarity in [0,1] for equal-length numeric vectors (undefined if mismatch). */
export const cosineSimilarity = (a: number[], b: number[]): number => {
  if (a.length === 0 || a.length !== b.length) {
    return 0;
  }
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
};

export const parseEmbeddingFromDb = (raw: unknown): number[] => {
  if (Array.isArray(raw)) {
    return raw.map(x => Number(x)).filter(n => !Number.isNaN(n));
  }
  if (typeof raw === 'string') {
    try {
      const p = JSON.parse(raw) as unknown;
      return Array.isArray(p) ? p.map(x => Number(x)).filter(n => !Number.isNaN(n)) : [];
    } catch {
      return [];
    }
  }
  return [];
};
