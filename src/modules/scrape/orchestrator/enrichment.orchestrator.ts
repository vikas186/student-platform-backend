import { scrapeLogger } from '../logger';
import { validateRawBatch, chunkArray } from '../buffer/raw-buffer.service';
import { enrichEntity, mergeRecord } from '../enrichment/enrichment.service';
import { cleanCourseData } from '../cleaners/clean-course.service';
import { cleanUniversityData } from '../cleaners/university.cleaner';
import { cleanScholarshipData } from '../cleaners/scholarship.cleaner';
import {
  enrichedCourseSchema,
  enrichedUniversitySchema,
  enrichedScholarshipSchema,
  type EnrichedCourse,
  type EnrichedScholarship,
  type EnrichedUniversity,
} from '../schemas/scrape.schemas';
import { upsertEnrichedBatch } from '../persistence/entity-upsert.service';
import type { EntityCleaningStats } from '../cleaners/entity.cleaner';

const pageTextFrom = (...parts: Array<string | undefined>): string =>
  parts.filter(Boolean).join('\n').slice(0, 15_000);

export const processEnrichmentPipeline = async (
  jobId: string,
  rawBatchId: string,
  source: string,
  raw: {
    courses: unknown[];
    universities: unknown[];
    scholarships: unknown[];
    rejectedPages?: unknown[];
  },
): Promise<EntityCleaningStats> => {
  const stats: EntityCleaningStats = {
    coursesFound: 0,
    universitiesFound: 0,
    feesFound: 0,
    scholarshipsFound: 0,
    rejectedPages: (raw.rejectedPages as unknown[])?.length || 0,
    validCount: 0,
    needsReviewCount: 0,
    rejectedCount: 0,
    duplicates: 0,
    persisted: { courses: 0, universities: 0, fees: 0, scholarships: 0, rejectedPages: 0 },
  };

  const validated = validateRawBatch(raw);
  stats.coursesFound = validated.courses.length;
  stats.universitiesFound = validated.universities.length;
  stats.scholarshipsFound = validated.scholarships.length;
  stats.rejectedCount += validated.invalidCount;

  scrapeLogger.info('Enrichment started', {
    jobId,
    source,
    courses: validated.courses.length,
    universities: validated.universities.length,
    scholarships: validated.scholarships.length,
  });

  const enrichedCourses: Array<{ entity: EnrichedCourse; enrichment: Awaited<ReturnType<typeof enrichEntity>> }> = [];
  const enrichedUniversities: Array<{ entity: EnrichedUniversity; enrichment: Awaited<ReturnType<typeof enrichEntity>> }> = [];
  const enrichedScholarships: Array<{ entity: EnrichedScholarship; enrichment: Awaited<ReturnType<typeof enrichEntity>> }> = [];

  for (const chunk of chunkArray(validated.courses)) {
    scrapeLogger.info('Enriching courses', { jobId, chunkSize: chunk.length, done: enrichedCourses.length });
    for (const rawCourse of chunk) {
      const cleaned = cleanCourseData(rawCourse);
      if (cleaned.cleaningStatus === 'rejected') {
        stats.rejectedCount++;
        continue;
      }
      if (cleaned.cleaningStatus === 'high_quality') stats.validCount++;
      else stats.needsReviewCount++;

      const pageText = rawCourse.pageText || pageTextFrom(rawCourse.courseName, rawCourse.academicRequirement, rawCourse.tuitionFee);
      const enrichment = await enrichEntity({
        entityType: 'course',
        url: rawCourse.courseUrl || '',
        title: rawCourse.courseName,
        pageText,
      });

      const merged = mergeRecord(
        { ...cleaned } as Record<string, unknown>,
        enrichment.parserOutput,
      );
      const entity = enrichedCourseSchema.parse({
        ...merged,
        qualityScore: cleaned.qualityScore,
        cleaningStatus: cleaned.cleaningStatus,
        aiSummary: enrichment.aiSummary,
        subjectTags: enrichment.subjectTags || [],
        careerTags: enrichment.careerTags || [],
        ieltsRequired: enrichment.ieltsRequired,
        ieltsScore: enrichment.ieltsScore,
      });
      enrichedCourses.push({ entity, enrichment });
    }
  }

  for (const chunk of chunkArray(validated.universities)) {
    for (const rawUni of chunk) {
      const cleaned = cleanUniversityData(rawUni);
      if (cleaned.cleaningStatus === 'rejected') {
        stats.rejectedCount++;
        continue;
      }
      if (cleaned.cleaningStatus === 'high_quality') stats.validCount++;
      else stats.needsReviewCount++;

      const enrichment = await enrichEntity({
        entityType: 'university',
        url: rawUni.sourceUrl || '',
        title: rawUni.universityName,
        pageText: rawUni.pageText || pageTextFrom(rawUni.universityName, rawUni.overview, rawUni.ranking),
      });

      const merged = mergeRecord(
        { ...cleaned } as Record<string, unknown>,
        enrichment.parserOutput,
      );
      const entity = enrichedUniversitySchema.parse({
        ...merged,
        qualityScore: cleaned.qualityScore,
        cleaningStatus: cleaned.cleaningStatus,
        aiSummary: enrichment.aiSummary,
        subjectTags: enrichment.subjectTags,
        rankingTags: enrichment.subjectTags.filter(t => /rank|top|qs|times/i.test(t)),
      });
      enrichedUniversities.push({ entity, enrichment });
    }
  }

  for (const chunk of chunkArray(validated.scholarships)) {
    for (const rawSch of chunk) {
      const cleaned = cleanScholarshipData(rawSch);
      if (cleaned.cleaningStatus === 'rejected') {
        stats.rejectedCount++;
        continue;
      }
      if (cleaned.cleaningStatus === 'high_quality') stats.validCount++;
      else stats.needsReviewCount++;

      const enrichment = await enrichEntity({
        entityType: 'scholarship',
        url: rawSch.sourceUrl || '',
        title: rawSch.scholarshipName,
        pageText: rawSch.pageText || pageTextFrom(rawSch.scholarshipName, rawSch.eligibility, rawSch.description),
      });

      const merged = mergeRecord(
        { ...cleaned } as Record<string, unknown>,
        enrichment.parserOutput,
      );
      const entity = enrichedScholarshipSchema.parse({
        ...merged,
        qualityScore: cleaned.qualityScore,
        cleaningStatus: cleaned.cleaningStatus,
        aiSummary: enrichment.aiSummary,
        subjectTags: enrichment.subjectTags,
      });
      enrichedScholarships.push({ entity, enrichment });
    }
  }

  const persisted = await upsertEnrichedBatch(jobId, rawBatchId, source, {
    courses: enrichedCourses,
    universities: enrichedUniversities,
    scholarships: enrichedScholarships,
  });

  stats.persisted = { ...persisted, fees: 0, rejectedPages: stats.rejectedPages };
  scrapeLogger.info('Enrichment pipeline complete', { jobId, ...stats });
  return stats;
};
