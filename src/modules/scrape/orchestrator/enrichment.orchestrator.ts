import { scrapeLogger } from '../logger';
import { validateRawBatch, chunkArray } from '../buffer/raw-buffer.service';
import { enrichEntity, mergeRecord } from '../enrichment/enrichment.service';
import { cleanCourseData } from '../cleaners/clean-course.service';
import { cleanUniversityData } from '../cleaners/university.cleaner';
import { cleanScholarshipData } from '../cleaners/scholarship.cleaner';
import { cleanFeeData } from '../cleaners/fee.cleaner';
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
    fees?: unknown[];
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
  stats.feesFound = (raw.fees || []).length;
  stats.rejectedCount += validated.invalidCount;

  scrapeLogger.info('Enrichment started', {
    jobId,
    source,
    courses: validated.courses.length,
    universities: validated.universities.length,
    scholarships: validated.scholarships.length,
    fees: (raw.fees || []).length,
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
        aiSummary: enrichment.aiSummary ?? undefined,
        subjectTags: enrichment.subjectTags || [],
        careerTags: enrichment.careerTags || [],
        ieltsRequired: enrichment.ieltsRequired ?? undefined,
        ieltsScore: enrichment.ieltsScore ?? undefined,
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

      const normalizeArray = (arr: unknown): string[] | undefined => {
        if (!arr || !Array.isArray(arr)) return undefined;
        return arr.map(x => {
          if (x == null) return '';
          if (typeof x === 'object') {
            return (x as any).name || (x as any).title || JSON.stringify(x);
          }
          return String(x).trim();
        }).filter(Boolean);
      };

      if (merged.faculties) merged.faculties = normalizeArray(merged.faculties);
      if (merged.departments) merged.departments = normalizeArray(merged.departments);
      if (merged.popularCourses) merged.popularCourses = normalizeArray(merged.popularCourses);

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

  const cleanedFees = ((raw.fees || []) as any[]).map(rawFee => {
    const cleaned = cleanFeeData(rawFee);
    if (cleaned.cleaningStatus === 'rejected') {
      stats.rejectedCount++;
    } else if (cleaned.cleaningStatus === 'high_quality') {
      stats.validCount++;
    } else {
      stats.needsReviewCount++;
    }
    return cleaned;
  });

  const persisted = await upsertEnrichedBatch(jobId, rawBatchId, source, {
    courses: enrichedCourses,
    universities: enrichedUniversities,
    scholarships: enrichedScholarships,
    fees: cleanedFees,
  });

  stats.persisted = { ...persisted, rejectedPages: stats.rejectedPages };
  scrapeLogger.info('Enrichment pipeline complete', { jobId, ...stats });
  return stats;
};
