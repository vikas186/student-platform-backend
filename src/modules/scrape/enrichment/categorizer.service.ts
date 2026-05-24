import { getOpenAiClient, rateLimitAi, scrapeAiModel } from './openai.client';
import { categorizerOutputSchema, type CategorizerOutput } from '../schemas/scrape.schemas';

export type CategorizerInput = {
  url: string;
  title: string;
  content: string;
};

export const categorizeAndTagPage = async (input: CategorizerInput): Promise<CategorizerOutput> => {
  await rateLimitAi();
  const client = getOpenAiClient();

  const res = await client.chat.completions.create({
    model: scrapeAiModel(),
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content:
          'Classify study-abroad web pages. Return JSON: { pageType, confidence (0-1), subjectTags[], careerTags[], ieltsRequired?, ieltsScore? }. pageType must be course|university|scholarship|fee|reject.',
      },
      {
        role: 'user',
        content: JSON.stringify({
          url: input.url,
          title: input.title,
          content: input.content.slice(0, 8000),
        }),
      },
    ],
    temperature: 0.1,
  });

  const raw = res.choices[0]?.message?.content || '{}';
  return categorizerOutputSchema.parse(JSON.parse(raw));
};
