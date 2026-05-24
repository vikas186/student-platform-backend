import { db, sequelize } from '../../../../config/database';
import { scrapeLogger } from '../logger';
import type {
  RawCourseRow,
  RawFeeRow,
  RawScholarshipRow,
  RawUniversityRow,
  RejectedPageRow,
} from '../extractors/types';
import { cleanCourses, persistCleanedCourses } from './course.cleaner';
import { cleanUniversityData, type CleanedUniversity } from './university.cleaner';
import { cleanFeeData, type CleanedFee } from './fee.cleaner';
import { cleanScholarshipData, type CleanedScholarship } from './scholarship.cleaner';
import { findDuplicateInList, normalizeNameKey } from './duplicate-check.util';

export type EntityCleaningStats = {
  coursesFound: number;
  universitiesFound: number;
  feesFound: number;
  scholarshipsFound: number;
  rejectedPages: number;
  validCount: number;
  needsReviewCount: number;
  rejectedCount: number;
  duplicates: number;
  persisted: {
    courses: number;
    universities: number;
    fees: number;
    scholarships: number;
    rejectedPages: number;
  };
};

const universityKey = (name: string, country: string): string =>
  `${normalizeNameKey(name)}::${normalizeNameKey(country)}`;

const feeKey = (source: string, country: string, studyLevel: string): string =>
  `${source}::${normalizeNameKey(country)}::${normalizeNameKey(studyLevel)}`;

const scholarshipKey = (name: string, university: string, country: string): string =>
  `${normalizeNameKey(name)}::${normalizeNameKey(university)}::${normalizeNameKey(country)}`;

const countByStatus = (items: Array<{ cleaningStatus: string }>, stats: EntityCleaningStats): void => {
  for (const item of items) {
    if (item.cleaningStatus === 'high_quality') stats.validCount++;
    else if (item.cleaningStatus === 'needs_review') stats.needsReviewCount++;
    else if (item.cleaningStatus === 'rejected') stats.rejectedCount++;
  }
};

export const cleanUniversities = async (
  raw: RawUniversityRow[],
  source: string,
): Promise<CleanedUniversity[]> => {
  const existing = source?.trim()
    ? await db.ScrapeUniversity.findAll({
        where: { source: source.trim() },
        attributes: ['id', 'universityName', 'country'],
      })
    : [];
  const index = existing.map(e => ({
    id: e.id,
    key: universityKey(e.universityName, e.country || ''),
  }));
  const batchKeys: Array<{ id: string; key: string }> = [];
  const results: CleanedUniversity[] = [];

  for (const row of raw) {
    const key = universityKey(row.universityName, row.country || '');
    const batchDup = findDuplicateInList(key, batchKeys);
    const dbDup = findDuplicateInList(key, index);
    if (batchDup.isDuplicate || dbDup.isDuplicate) continue;

    batchKeys.push({ id: `b-${batchKeys.length}`, key });
    const cleaned = cleanUniversityData(row);
    if (cleaned.cleaningStatus !== 'rejected') results.push(cleaned);
  }
  return results;
};

export const cleanFees = async (raw: RawFeeRow[], source: string): Promise<CleanedFee[]> => {
  const existing = source?.trim()
    ? await db.ScrapeFee.findAll({
        where: { source: source.trim() },
        attributes: ['id', 'country', 'studyLevel'],
      })
    : [];
  const index = existing.map(e => ({
    id: e.id,
    key: feeKey(source, e.country || '', e.studyLevel || ''),
  }));
  const batchKeys: Array<{ id: string; key: string }> = [];
  const results: CleanedFee[] = [];

  for (const row of raw) {
    const key = feeKey(source, row.country || '', row.studyLevel || '');
    const batchDup = findDuplicateInList(key, batchKeys);
    const dbDup = findDuplicateInList(key, index);
    if (batchDup.isDuplicate || dbDup.isDuplicate) continue;

    batchKeys.push({ id: `b-${batchKeys.length}`, key });
    const cleaned = cleanFeeData(row);
    if (cleaned.cleaningStatus !== 'rejected') results.push(cleaned);
  }
  return results;
};

export const cleanScholarships = async (
  raw: RawScholarshipRow[],
  source: string,
): Promise<CleanedScholarship[]> => {
  const existing = source?.trim()
    ? await db.ScrapeScholarship.findAll({
        where: { source: source.trim() },
        attributes: ['id', 'scholarshipName', 'universityName', 'country'],
      })
    : [];
  const index = existing.map(e => ({
    id: e.id,
    key: scholarshipKey(e.scholarshipName, e.universityName || '', e.country || ''),
  }));
  const batchKeys: Array<{ id: string; key: string }> = [];
  const results: CleanedScholarship[] = [];

  for (const row of raw) {
    const key = scholarshipKey(row.scholarshipName, row.universityName || '', row.country || '');
    const batchDup = findDuplicateInList(key, batchKeys);
    const dbDup = findDuplicateInList(key, index);
    if (batchDup.isDuplicate || dbDup.isDuplicate) continue;

    batchKeys.push({ id: `b-${batchKeys.length}`, key });
    const cleaned = cleanScholarshipData(row);
    if (cleaned.cleaningStatus !== 'rejected') results.push(cleaned);
  }
  return results;
};

export const cleanAndPersistAll = async (
  jobId: string,
  rawBatchId: string,
  source: string,
  data: {
    courses: RawCourseRow[];
    universities: RawUniversityRow[];
    fees: RawFeeRow[];
    scholarships: RawScholarshipRow[];
    rejectedPages: RejectedPageRow[];
  },
): Promise<EntityCleaningStats> => {
  const stats: EntityCleaningStats = {
    coursesFound: data.courses.length,
    universitiesFound: data.universities.length,
    feesFound: data.fees.length,
    scholarshipsFound: data.scholarships.length,
    rejectedPages: data.rejectedPages.length,
    validCount: 0,
    needsReviewCount: 0,
    rejectedCount: 0,
    duplicates: 0,
    persisted: { courses: 0, universities: 0, fees: 0, scholarships: 0, rejectedPages: 0 },
  };

  const { courses, stats: courseStats } = await cleanCourses(data.courses, source, jobId, rawBatchId);
  stats.duplicates += courseStats.duplicates;
  stats.rejectedCount += courseStats.rejected + courseStats.validationRejected;
  countByStatus(courses, stats);
  stats.persisted.courses = await persistCleanedCourses(jobId, rawBatchId, source, courses);

  const universities = await cleanUniversities(data.universities, source);
  countByStatus(universities, stats);

  const fees = await cleanFees(data.fees, source);
  countByStatus(fees, stats);

  const scholarships = await cleanScholarships(data.scholarships, source);
  countByStatus(scholarships, stats);

  await sequelize.transaction(async t => {
    await db.ScrapeUniversity.destroy({ where: { jobId, recordStatus: 'cleaned' }, transaction: t });
    await db.ScrapeFee.destroy({ where: { jobId, recordStatus: 'cleaned' }, transaction: t });
    await db.ScrapeScholarship.destroy({ where: { jobId, recordStatus: 'cleaned' }, transaction: t });
    await db.ScrapeRejectedPage.destroy({ where: { jobId }, transaction: t });

    for (const u of universities) {
      await db.ScrapeUniversity.create(
        {
          jobId,
          rawBatchId,
          source,
          universityName: u.universityName,
          country: u.country || null,
          city: u.city || null,
          ranking: u.ranking || null,
          overview: u.overview || null,
          websiteUrl: u.websiteUrl || null,
          sourceUrl: u.sourceUrl || null,
          faculties: u.faculties || [],
          departments: u.departments || [],
          popularCourses: u.popularCourses || [],
          qualityScore: u.qualityScore,
          cleaningStatus: u.cleaningStatus,
          recordStatus: 'cleaned',
          scrapedAt: new Date(),
        },
        { transaction: t },
      );
      stats.persisted.universities++;
    }

    for (const f of fees) {
      await db.ScrapeFee.create(
        {
          jobId,
          rawBatchId,
          source,
          country: f.country || null,
          studyLevel: f.studyLevel || null,
          tuitionFee: f.tuitionFee || null,
          livingCost: f.livingCost || null,
          accommodationCost: f.accommodationCost || null,
          currency: f.currency || null,
          description: f.description || null,
          sourceUrl: f.sourceUrl || null,
          qualityScore: f.qualityScore,
          cleaningStatus: f.cleaningStatus,
          recordStatus: 'cleaned',
          scrapedAt: new Date(),
        },
        { transaction: t },
      );
      stats.persisted.fees++;
    }

    for (const s of scholarships) {
      await db.ScrapeScholarship.create(
        {
          jobId,
          rawBatchId,
          source,
          scholarshipName: s.scholarshipName,
          universityName: s.universityName || null,
          country: s.country || null,
          amount: s.amount || null,
          eligibility: s.eligibility || null,
          deadline: s.deadline || null,
          description: s.description || null,
          sourceUrl: s.sourceUrl || null,
          qualityScore: s.qualityScore,
          cleaningStatus: s.cleaningStatus,
          recordStatus: 'cleaned',
          scrapedAt: new Date(),
        },
        { transaction: t },
      );
      stats.persisted.scholarships++;
    }

    for (const r of data.rejectedPages) {
      await db.ScrapeRejectedPage.create(
        {
          jobId,
          rawBatchId,
          source,
          url: r.url,
          pageTitle: r.pageTitle || null,
          classification: r.classification,
          reason: r.reason,
        },
        { transaction: t },
      );
      stats.persisted.rejectedPages++;
    }
  });

  scrapeLogger.info('Entity cleaning complete', { jobId, ...stats });
  return stats;
};
