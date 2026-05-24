import { z } from 'zod';
import {
  rawBatchSchema,
  rawCourseSchema,
  rawUniversitySchema,
  rawScholarshipSchema,
  type RawBatch,
} from '../schemas/scrape.schemas';
import { scrapeLogger } from '../logger';

const CHUNK_SIZE = parseInt(process.env.SCRAPE_RAW_CHUNK_SIZE || '25', 10);

export type ValidatedRawBatch = RawBatch & {
  invalidCount: number;
  errors: string[];
};

const safeParseArray = <T>(
  schema: z.ZodType<T>,
  rows: unknown[],
  label: string,
  errors: string[],
): T[] => {
  const valid: T[] = [];
  rows.forEach((row, i) => {
    const result = schema.safeParse(row);
    if (result.success) valid.push(result.data);
    else errors.push(`${label}[${i}]: ${result.error.issues.map(x => x.message).join('; ')}`);
  });
  return valid;
};

export const validateRawBatch = (data: {
  courses?: unknown[];
  universities?: unknown[];
  scholarships?: unknown[];
}): ValidatedRawBatch => {
  const errors: string[] = [];
  const courses = safeParseArray(rawCourseSchema, data.courses || [], 'course', errors);
  const universities = safeParseArray(rawUniversitySchema, data.universities || [], 'university', errors);
  const scholarships = safeParseArray(rawScholarshipSchema, data.scholarships || [], 'scholarship', errors);

  const batch = rawBatchSchema.parse({ courses, universities, scholarships });

  scrapeLogger.info('Raw batch validated', {
    courses: batch.courses.length,
    universities: batch.universities.length,
    scholarships: batch.scholarships.length,
    invalidCount: errors.length,
  });

  return { ...batch, invalidCount: errors.length, errors };
};

export const chunkArray = <T>(items: T[]): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += CHUNK_SIZE) {
    chunks.push(items.slice(i, i + CHUNK_SIZE));
  }
  return chunks;
};
