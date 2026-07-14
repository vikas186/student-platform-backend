import { z } from 'zod';

const normalizeToOptionalString = (val: unknown): string | undefined => {
  if (val == null || val === '') return undefined;
  if (typeof val === 'number' || typeof val === 'boolean') return String(val);
  if (typeof val === 'string') {
    const t = val.trim();
    return t || undefined;
  }
  if (Array.isArray(val)) {
    const parts = val
      .map(v => (v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v).trim()))
      .filter(Boolean);
    return parts.length ? parts.join(', ') : undefined;
  }
  return undefined;
};

/** OpenAI/parser often returns numbers or arrays; normalize to optional string. */
export const optionalStringCoerce = z.preprocess(normalizeToOptionalString, z.string().optional());

/** OpenAI often returns null for booleans; treat null/undefined as absent. */
export const optionalBooleanCoerce = z.preprocess((val: unknown) => {
  if (val == null) return undefined;
  if (typeof val === 'boolean') return val;
  if (typeof val === 'string') {
    const t = val.trim().toLowerCase();
    if (t === 'true' || t === 'yes' || t === '1') return true;
    if (t === 'false' || t === 'no' || t === '0') return false;
  }
  if (typeof val === 'number') {
    if (val === 1) return true;
    if (val === 0) return false;
  }
  return undefined;
}, z.boolean().optional());

export const rawCourseSchema = z.object({
  universityName: z.string().min(1),
  courseName: z.string().min(1),
  country: optionalStringCoerce,
  city: optionalStringCoerce,
  studyLevel: optionalStringCoerce,
  duration: optionalStringCoerce,
  tuitionFee: optionalStringCoerce,
  intake: optionalStringCoerce,
  ieltsRequirement: optionalStringCoerce,
  academicRequirement: optionalStringCoerce,
  applicationFee: optionalStringCoerce,
  scholarship: optionalStringCoerce,
  courseUrl: optionalStringCoerce,
  pageText: optionalStringCoerce,
});

export const rawUniversitySchema = z.object({
  universityName: z.string().min(1),
  country: optionalStringCoerce,
  city: optionalStringCoerce,
  ranking: optionalStringCoerce,
  overview: optionalStringCoerce,
  websiteUrl: optionalStringCoerce,
  sourceUrl: optionalStringCoerce,
  faculties: z.array(z.string()).optional(),
  departments: z.array(z.string()).optional(),
  popularCourses: z.array(z.string()).optional(),
  pageText: optionalStringCoerce,
});

export const rawScholarshipSchema = z.object({
  scholarshipName: z.string().min(1),
  universityName: optionalStringCoerce,
  country: optionalStringCoerce,
  amount: optionalStringCoerce,
  eligibility: optionalStringCoerce,
  deadline: optionalStringCoerce,
  description: optionalStringCoerce,
  sourceUrl: optionalStringCoerce,
  pageText: optionalStringCoerce,
});

export const rawBatchSchema = z.object({
  courses: z.array(rawCourseSchema),
  universities: z.array(rawUniversitySchema),
  scholarships: z.array(rawScholarshipSchema),
});

export type RawCourse = z.infer<typeof rawCourseSchema>;
export type RawUniversity = z.infer<typeof rawUniversitySchema>;
export type RawScholarship = z.infer<typeof rawScholarshipSchema>;
export type RawBatch = z.infer<typeof rawBatchSchema>;

export const enrichedCourseSchema = rawCourseSchema.extend({
  qualityScore: z.number().int().min(0).max(100),
  cleaningStatus: z.enum(['high_quality', 'needs_review', 'rejected']),
  aiSummary: z.string().optional(),
  subjectTags: z.array(z.string()).default([]),
  careerTags: z.array(z.string()).default([]),
  ieltsRequired: optionalBooleanCoerce,
  ieltsScore: optionalStringCoerce,
});

export const enrichedUniversitySchema = rawUniversitySchema.extend({
  qualityScore: z.number().int().min(0).max(100),
  cleaningStatus: z.enum(['high_quality', 'needs_review', 'rejected']),
  aiSummary: z.string().optional(),
  subjectTags: z.array(z.string()).default([]),
  rankingTags: z.array(z.string()).default([]),
});

export const enrichedScholarshipSchema = rawScholarshipSchema.extend({
  qualityScore: z.number().int().min(0).max(100),
  cleaningStatus: z.enum(['high_quality', 'needs_review', 'rejected']),
  aiSummary: z.string().optional(),
  subjectTags: z.array(z.string()).default([]),
});

export type EnrichedCourse = z.infer<typeof enrichedCourseSchema>;
export type EnrichedUniversity = z.infer<typeof enrichedUniversitySchema>;
export type EnrichedScholarship = z.infer<typeof enrichedScholarshipSchema>;

export const categorizerOutputSchema = z.object({
  pageType: z.enum(['course', 'university', 'scholarship', 'fee', 'reject']),
  confidence: z.coerce.number().min(0).max(1),
  subjectTags: z.array(z.string()).default([]),
  careerTags: z.array(z.string()).default([]),
  ieltsRequired: optionalBooleanCoerce,
  ieltsScore: optionalStringCoerce,
});

export const parserOutputSchema = z.record(z.string(), z.unknown());

export type CategorizerOutput = z.infer<typeof categorizerOutputSchema>;
