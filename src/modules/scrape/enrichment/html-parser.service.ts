import { z } from 'zod';
import { getOpenAiClient, rateLimitAi, scrapeAiModel } from './openai.client';
import { parserOutputSchema } from '../schemas/scrape.schemas';

const parserSchema = z.object({
  fields: parserOutputSchema,
});

export type HtmlParserInput = {
  entityType: 'course' | 'university' | 'scholarship';
  url: string;
  title: string;
  htmlOrText: string;
};

export const parseHtmlToStructuredFields = async (input: HtmlParserInput): Promise<Record<string, unknown>> => {
  await rateLimitAi();
  const client = getOpenAiClient();
  const text = input.htmlOrText.slice(0, 12_000);

  const res = await client.chat.completions.create({
    model: scrapeAiModel(),
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content:
          'Extract structured study-abroad data from page content. Return JSON: { "fields": { ... } }. Use only keys relevant to the entity type. Omit unknown fields.',
      },
      {
        role: 'user',
        content: JSON.stringify({
          entityType: input.entityType,
          url: input.url,
          title: input.title,
          content: text,
          expectedKeys:
            input.entityType === 'course'
              ? ['courseName', 'universityName', 'country', 'studyLevel', 'duration', 'tuitionFee', 'intake', 'ieltsRequirement', 'academicRequirement']
              : input.entityType === 'university'
                ? ['universityName', 'country', 'city', 'ranking', 'overview', 'faculties', 'departments']
                : ['scholarshipName', 'universityName', 'country', 'amount', 'eligibility', 'deadline'],
        }),
      },
    ],
    temperature: 0.1,
  });

  const raw = res.choices[0]?.message?.content || '{}';
  const parsed = parserSchema.parse(JSON.parse(raw));
  return parsed.fields;
};
