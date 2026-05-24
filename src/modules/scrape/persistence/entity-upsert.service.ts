import { sequelize } from '../../../../config/database';
import { db } from '../../../../config/database';
import { scrapeLogger } from '../logger';
import type {
  EnrichedCourse,
  EnrichedScholarship,
  EnrichedUniversity,
} from '../schemas/scrape.schemas';
import type { EnrichmentResult } from '../enrichment/enrichment.service';

const upsertAiMeta = async (
  entityType: 'course' | 'university' | 'scholarship',
  entityId: string,
  jobId: string,
  source: string,
  enrichment: EnrichmentResult,
): Promise<void> => {
  if (!enrichment.aiSummary && !enrichment.subjectTags.length) return;

  const existing = await db.ScrapeAiMeta.findOne({ where: { entityType, entityId } });
  const payload = {
    entityType,
    entityId,
    jobId,
    source,
    subjectTags: enrichment.subjectTags,
    careerTags: enrichment.careerTags,
    ieltsRequired: enrichment.ieltsRequired ?? null,
    ieltsScore: enrichment.ieltsScore ?? null,
    aiSummary: enrichment.aiSummary ?? null,
    pageCategory: enrichment.pageCategory ?? null,
    parserOutput: enrichment.parserOutput,
    categorizerOutput: enrichment.categorizerOutput as Record<string, unknown>,
    model: enrichment.model ?? null,
    enrichedAt: new Date(),
  };

  if (existing) await existing.update(payload);
  else await db.ScrapeAiMeta.create(payload);
};

const coursePayload = (
  jobId: string,
  rawBatchId: string,
  source: string,
  course: EnrichedCourse,
  enrichment: EnrichmentResult,
) => ({
  jobId,
  rawBatchId,
  source,
  universityName: course.universityName,
  courseName: course.courseName,
  country: course.country || null,
  city: course.city || null,
  studyLevel: course.studyLevel || null,
  duration: course.duration || null,
  tuitionFee: course.tuitionFee || null,
  intake: course.intake || null,
  ieltsRequirement: course.ieltsRequirement || null,
  academicRequirement: course.academicRequirement || null,
  applicationFee: course.applicationFee || null,
  scholarship: course.scholarship || null,
  courseUrl: course.courseUrl || null,
  qualityScore: course.qualityScore,
  cleaningStatus: course.cleaningStatus,
  aiSummary: course.aiSummary || enrichment.aiSummary || null,
  subjectTags: course.subjectTags,
  careerTags: course.careerTags,
  isDuplicate: false,
  recordStatus: 'cleaned',
  scrapedAt: new Date(),
});

export const upsertCourse = async (
  jobId: string,
  rawBatchId: string,
  source: string,
  course: EnrichedCourse,
  enrichment: EnrichmentResult,
): Promise<string> => {
  const payload = coursePayload(jobId, rawBatchId, source, course, enrichment);
  const where =
    course.courseUrl?.trim()
      ? { source, courseUrl: course.courseUrl.trim() }
      : { source, courseName: course.courseName, universityName: course.universityName };

  const existing = await db.ScrapedCourse.findOne({ where });
  const row = existing ? await existing.update(payload) : await db.ScrapedCourse.create(payload);

  const id = row.id;
  await upsertAiMeta('course', id, jobId, source, enrichment);
  return id;
};

export const upsertUniversity = async (
  jobId: string,
  rawBatchId: string,
  source: string,
  uni: EnrichedUniversity,
  enrichment: EnrichmentResult,
): Promise<string> => {
  const payload = {
    jobId,
    rawBatchId,
    source,
    universityName: uni.universityName,
    country: uni.country || '',
    city: uni.city || null,
    ranking: uni.ranking || null,
    overview: uni.overview || null,
    websiteUrl: uni.websiteUrl || null,
    sourceUrl: uni.sourceUrl || null,
    faculties: uni.faculties || [],
    departments: uni.departments || [],
    popularCourses: uni.popularCourses || [],
    qualityScore: uni.qualityScore,
    cleaningStatus: uni.cleaningStatus,
    aiSummary: uni.aiSummary || enrichment.aiSummary || null,
    subjectTags: uni.subjectTags,
    rankingTags: uni.rankingTags || [],
    isDuplicate: false,
    recordStatus: 'cleaned',
    scrapedAt: new Date(),
  };

  const existing = await db.ScrapeUniversity.findOne({
    where: { source, universityName: uni.universityName, country: uni.country || '' },
  });
  const row = existing ? await existing.update(payload) : await db.ScrapeUniversity.create(payload);

  const id = row.id;
  await upsertAiMeta('university', id, jobId, source, enrichment);
  return id;
};

export const upsertScholarship = async (
  jobId: string,
  rawBatchId: string,
  source: string,
  scholarship: EnrichedScholarship,
  enrichment: EnrichmentResult,
): Promise<string> => {
  const payload = {
    jobId,
    rawBatchId,
    source,
    scholarshipName: scholarship.scholarshipName,
    universityName: scholarship.universityName || '',
    country: scholarship.country || '',
    amount: scholarship.amount || null,
    eligibility: scholarship.eligibility || null,
    deadline: scholarship.deadline || null,
    description: scholarship.description || null,
    sourceUrl: scholarship.sourceUrl || null,
    qualityScore: scholarship.qualityScore,
    cleaningStatus: scholarship.cleaningStatus,
    aiSummary: scholarship.aiSummary || enrichment.aiSummary || null,
    subjectTags: scholarship.subjectTags,
    isDuplicate: false,
    recordStatus: 'cleaned',
    scrapedAt: new Date(),
  };

  const existing = await db.ScrapeScholarship.findOne({
    where: {
      source,
      scholarshipName: scholarship.scholarshipName,
      universityName: scholarship.universityName || '',
      country: scholarship.country || '',
    },
  });
  const row = existing ? await existing.update(payload) : await db.ScrapeScholarship.create(payload);

  const id = row.id;
  await upsertAiMeta('scholarship', id, jobId, source, enrichment);
  return id;
};

export const upsertEnrichedBatch = async (
  jobId: string,
  rawBatchId: string,
  source: string,
  data: {
    courses: Array<{ entity: EnrichedCourse; enrichment: EnrichmentResult }>;
    universities: Array<{ entity: EnrichedUniversity; enrichment: EnrichmentResult }>;
    scholarships: Array<{ entity: EnrichedScholarship; enrichment: EnrichmentResult }>;
  },
): Promise<{ courses: number; universities: number; scholarships: number }> => {
  const sourceLabel = source?.trim();
  if (!sourceLabel) {
    throw new Error('Missing scrape source for enriched upsert');
  }

  let courses = 0;
  let universities = 0;
  let scholarships = 0;

  await sequelize.transaction(async () => {
    for (const { entity, enrichment } of data.courses) {
      if (entity.cleaningStatus === 'rejected') continue;
      await upsertCourse(jobId, rawBatchId, sourceLabel, entity, enrichment);
      courses++;
    }
    for (const { entity, enrichment } of data.universities) {
      if (entity.cleaningStatus === 'rejected') continue;
      await upsertUniversity(jobId, rawBatchId, sourceLabel, entity, enrichment);
      universities++;
    }
    for (const { entity, enrichment } of data.scholarships) {
      if (entity.cleaningStatus === 'rejected') continue;
      await upsertScholarship(jobId, rawBatchId, sourceLabel, entity, enrichment);
      scholarships++;
    }
  });

  scrapeLogger.info('Upserted enriched entities', { jobId, courses, universities, scholarships });
  return { courses, universities, scholarships };
};
