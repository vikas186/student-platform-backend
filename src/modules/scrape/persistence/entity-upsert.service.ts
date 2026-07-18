import { sequelize } from '../../../../config/database';
import { db } from '../../../../config/database';
import { scrapeLogger } from '../logger';
import type {
  EnrichedCourse,
  EnrichedScholarship,
  EnrichedUniversity,
} from '../schemas/scrape.schemas';
import type { EnrichmentResult } from '../enrichment/enrichment.service';
import { getJaroWinkler, checkSemanticDuplicate, isAcronym } from '../utils/similarity.util';

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
  const payload: any = {
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
    logoUrl: uni.logoUrl || null,
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
    intakes: uni.intakes || null,
    courses: uni.courses || null,
    costOfStudy: uni.costOfStudy || null,
    scholarships: uni.scholarships || null,
    admissionRequirements: uni.admissionRequirements || null,
    acceptanceCriteria: uni.acceptanceCriteria || null,
  };

  // 1. Database Match Check (Exact Name + Country) - Global across all sources
  let existing = await db.ScrapeUniversity.findOne({
    where: { universityName: uni.universityName, country: uni.country || '' },
  });

  // 2. Fuzzy String Matching & AI Semantic Check Check - Global across all sources
  if (!existing) {
    const candidates = await db.ScrapeUniversity.findAll({
      where: { country: uni.country || '' },
    });

    for (const candidate of candidates) {
      // Direct case-insensitive comparison
      if (candidate.universityName.trim().toLowerCase() === uni.universityName.trim().toLowerCase()) {
        existing = candidate;
        scrapeLogger.info('Exact case-insensitive duplicate university matched', {
          universityName: uni.universityName,
        });
        break;
      }

      // Jaro-Winkler name similarity scorer
      const score = getJaroWinkler(uni.universityName, candidate.universityName);
      if (score >= 0.95) {
        existing = candidate;
        scrapeLogger.info('High similarity duplicate university matched (Jaro-Winkler)', {
          scrapedName: uni.universityName,
          matchedAs: candidate.universityName,
          score,
        });
        break;
      }

      const isAbbr = isAcronym(uni.universityName, candidate.universityName) ||
                     isAcronym(candidate.universityName, uni.universityName);

      if (score >= 0.70 || isAbbr) {
        // Fuzzy name match for near-duplicates or abbreviations
        const isDuplicate = await checkSemanticDuplicate(
          uni.universityName,
          candidate.universityName,
          uni.country || '',
          uni.city || null
        );
        if (isDuplicate) {
          existing = candidate;
          scrapeLogger.info('Fuzzy duplicate university matched', {
            scrapedName: uni.universityName,
            matchedAs: candidate.universityName,
            score,
            isAbbr,
          });
          break;
        }
      }
    }
  }

  // 3. Merge & Change Detection & Persist
  if (existing) {
    // Merge comma/semi/newline-separated lists
    const mergeSet = (val1: string | null, val2: string | null, sep: string = ',') => {
      const set1 = String(val1 || '').split(sep).map(s => s.trim()).filter(Boolean);
      const set2 = String(val2 || '').split(sep).map(s => s.trim()).filter(Boolean);
      const union = Array.from(new Set([...set1, ...set2]));
      return union.join(sep === ',' ? ', ' : sep === ';' ? '; ' : sep);
    };

    payload.intakes = mergeSet(existing.intakes, uni.intakes || null);
    payload.courses = mergeSet(existing.courses, uni.courses || null);
    payload.scholarships = mergeSet(existing.scholarships, uni.scholarships || null, ';');
    payload.admissionRequirements = mergeSet(existing.admissionRequirements, uni.admissionRequirements || null, '\n');
    payload.acceptanceCriteria = mergeSet(existing.acceptanceCriteria, uni.acceptanceCriteria || null, '\n');

    // Merge Cost of Study
    payload.costOfStudy = existing.costOfStudy && existing.costOfStudy.includes(String(uni.costOfStudy || ''))
      ? existing.costOfStudy
      : uni.costOfStudy
        ? existing.costOfStudy
          ? `${existing.costOfStudy} | ${uni.costOfStudy}`
          : uni.costOfStudy
        : existing.costOfStudy;

    // Merge source values
    const existingSources = (existing.source || '').split(',').map((s: string) => s.trim()).filter(Boolean);
    if (!existingSources.includes(source)) {
      existingSources.push(source);
      payload.source = existingSources.join(', ');
    } else {
      payload.source = existing.source;
    }

    const fieldsToCompare = [
      'city',
      'ranking',
      'overview',
      'websiteUrl',
      'sourceUrl',
      'logoUrl',
      'intakes',
      'courses',
      'costOfStudy',
      'scholarships',
      'admissionRequirements',
      'acceptanceCriteria',
      'source',
    ];

    let hasChanges = false;
    for (const field of fieldsToCompare) {
      const existingVal = String(existing.get(field) || '').trim();
      const incomingVal = String(payload[field] || '').trim();
      if (existingVal !== incomingVal) {
        hasChanges = true;
        break;
      }
    }

    if (!hasChanges) {
      scrapeLogger.info('No changes detected for duplicate university, skipping update', {
        universityName: uni.universityName,
        matchedAs: existing.universityName,
      });
      return existing.id;
    }

    scrapeLogger.info('Changes detected for duplicate university, updating existing record', {
      universityName: uni.universityName,
      matchedAs: existing.universityName,
    });

    const { universityName, ...updatePayload } = payload;
    await existing.update(updatePayload);
    const id = existing.id;
    await upsertAiMeta('university', id, jobId, source, enrichment);
    return id;
  } else {
    // Insert new university record
    const row = await db.ScrapeUniversity.create(payload);
    const id = row.id;
    await upsertAiMeta('university', id, jobId, source, enrichment);
    return id;
  }
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
    fees?: any[];
  },
): Promise<{ courses: number; universities: number; scholarships: number; fees: number }> => {
  const sourceLabel = source?.trim();
  if (!sourceLabel) {
    throw new Error('Missing scrape source for enriched upsert');
  }

  let courses = 0;
  let universities = 0;
  let scholarships = 0;
  let fees = 0;

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
    if (data.fees) {
      for (const fee of data.fees) {
        if (fee.cleaningStatus === 'rejected') continue;
        const existing = await db.ScrapeFee.findOne({
          where: {
            source: sourceLabel,
            country: fee.country || '',
            studyLevel: fee.studyLevel || '',
            tuitionFee: fee.tuitionFee || '',
          },
        });
        const payload = {
          jobId,
          rawBatchId,
          source: sourceLabel,
          country: fee.country || null,
          studyLevel: fee.studyLevel || null,
          tuitionFee: fee.tuitionFee || null,
          livingCost: fee.livingCost || null,
          accommodationCost: fee.accommodationCost || null,
          currency: fee.currency || null,
          description: fee.description || null,
          sourceUrl: fee.sourceUrl || null,
          qualityScore: fee.qualityScore,
          cleaningStatus: fee.cleaningStatus,
          recordStatus: 'cleaned',
          scrapedAt: new Date(),
        };
        if (existing) {
          await existing.update(payload);
        } else {
          await db.ScrapeFee.create(payload);
        }
        fees++;
      }
    }
  });

  scrapeLogger.info('Upserted enriched entities', { jobId, courses, universities, scholarships, fees });
  return { courses, universities, scholarships, fees };
};
