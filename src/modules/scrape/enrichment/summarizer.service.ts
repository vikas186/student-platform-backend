import { getOpenAiClient, rateLimitAi, scrapeAiModel } from './openai.client';

export type SummarizerInput = {
  entityType: 'course' | 'university' | 'scholarship';
  title: string;
  content: string;
};

/** Collects streamed gpt-4o-mini output into a 2–3 sentence summary. */
export const summarizeEntity = async (input: SummarizerInput): Promise<string> => {
  await rateLimitAi();
  const client = getOpenAiClient();

  const stream = await client.chat.completions.create({
    model: scrapeAiModel(),
    stream: true,
    messages: [
      {
        role: 'system',
        content: 'Write a factual 2–3 sentence summary for international students. No marketing fluff.',
      },
      {
        role: 'user',
        content: `${input.entityType}: ${input.title}\n\n${input.content.slice(0, 6000)}`,
      },
    ],
    temperature: 0.3,
    max_tokens: 200,
  });

  let summary = '';
  for await (const chunk of stream) {
    summary += chunk.choices[0]?.delta?.content || '';
  }
  return summary.trim();
};
