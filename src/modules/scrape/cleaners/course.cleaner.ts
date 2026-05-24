import { Op } from 'sequelize';
import { db, sequelize } from '../../../../config/database';
import { scrapeLogger } from '../logger';
import type { RawCourseRow } from '../scrapers/types';
import { cleanCourseData } from './clean-course.service';
import { applyJunkFilters } from './junk-filter.util';
import {
  courseCompositeKey,
  courseUrlKey,
  findDuplicateInList,
} from './duplicate-check.util';
import { validateCourseRequiredFields } from '../validators/course.validator';
import type { CleanedCourse, CleaningStats } from './course.types';
import { finalizeCleaningStats } from './course.types';

export const cleanCourses = async (
  rawCourses: RawCourseRow[],
  source: string,
  jobId: string,
  _rawBatchId: string,
): Promise<{ courses: CleanedCourse[]; stats: CleaningStats }> => {
  const stats: Omit<CleaningStats, 'totalScraped' | 'valid'> = {
    raw: rawCourses.length,
    junkRemoved: 0,
    validationRejected: 0,
    duplicates: 0,
    highQuality: 0,
    needsReview: 0,
    rejected: 0,
    persisted: 0,
  };

  const { cleaned: afterJunk, removed } = applyJunkFilters(rawCourses);
  stats.junkRemoved = removed;

  scrapeLogger.info('Cleaning started', {
    jobId,
    source,
    raw: stats.raw,
    afterJunk: afterJunk.length,
    junkRemoved: removed,
  });

  const existing = source?.trim()
    ? await db.ScrapedCourse.findAll({
        where: { source: source.trim() },
        attributes: ['id', 'courseUrl', 'universityName', 'courseName', 'country'],
      })
    : [];

  const urlIndex = existing
    .filter(e => e.courseUrl)
    .map(e => ({ id: e.id, key: courseUrlKey(e.courseUrl!) }));

  const nameIndex = existing.map(e => ({
    id: e.id,
    key: courseCompositeKey(e.universityName, e.courseName, e.country || ''),
  }));

  const batchUrlKeys: Array<{ id: string; key: string }> = [];
  const batchNameKeys: Array<{ id: string; key: string }> = [];
  const results: CleanedCourse[] = [];

  for (const row of afterJunk) {
    const val = validateCourseRequiredFields(row);
    if (!val.valid) {
      stats.validationRejected++;
      scrapeLogger.debug('Validation rejected course', { reasons: val.reasons, courseName: row.courseName });
      continue;
    }

    let isDuplicate = false;
    let duplicateOf: string | null = null;

    const urlKey = row.courseUrl ? courseUrlKey(row.courseUrl) : '';
    if (urlKey) {
      const urlBatchDup = findDuplicateInList(urlKey, batchUrlKeys);
      const urlDbDup = findDuplicateInList(urlKey, urlIndex);
      if (urlBatchDup.isDuplicate || urlDbDup.isDuplicate) {
        isDuplicate = true;
        duplicateOf = urlBatchDup.duplicateOfId || urlDbDup.duplicateOfId;
      } else {
        batchUrlKeys.push({ id: `batch-${batchUrlKeys.length}`, key: urlKey });
      }
    }

    const nameKey = courseCompositeKey(row.universityName, row.courseName, row.country || '');
    const nameBatchDup = findDuplicateInList(nameKey, batchNameKeys);
    const nameDbDup = findDuplicateInList(nameKey, nameIndex);
    if (nameBatchDup.isDuplicate || nameDbDup.isDuplicate) {
      isDuplicate = true;
      duplicateOf = duplicateOf || nameBatchDup.duplicateOfId || nameDbDup.duplicateOfId;
    } else {
      batchNameKeys.push({ id: `batch-n-${batchNameKeys.length}`, key: nameKey });
    }

    if (isDuplicate) {
      stats.duplicates++;
      continue;
    }

    const cleaned = cleanCourseData(row);

    if (cleaned.cleaningStatus === 'rejected') {
      stats.rejected++;
      continue;
    }

    if (cleaned.cleaningStatus === 'high_quality') stats.highQuality++;
    else if (cleaned.cleaningStatus === 'needs_review') stats.needsReview++;

    results.push(cleaned);
  }

  const finalStats = finalizeCleaningStats(stats);
  scrapeLogger.info('Cleaning finished', {
    jobId,
    source,
    ...finalStats,
  });

  return { courses: results, stats: finalStats };
};

export const persistCleanedCourses = async (
  jobId: string,
  rawBatchId: string,
  source: string,
  courses: CleanedCourse[],
): Promise<number> => {
  let count = 0;
  await sequelize.transaction(async t => {
    await db.ScrapedCourse.destroy({
      where: { jobId, recordStatus: 'cleaned' },
      transaction: t,
    });

    for (const c of courses) {
      await db.ScrapedCourse.create(
        {
          jobId,
          rawBatchId,
          source,
          universityName: c.universityName,
          courseName: c.courseName,
          country: c.country || null,
          city: c.city || null,
          studyLevel: c.studyLevel || null,
          duration: c.duration || null,
          tuitionFee: c.tuitionFee || null,
          intake: c.intake || null,
          ieltsRequirement: c.ieltsRequirement || null,
          academicRequirement: c.academicRequirement || null,
          applicationFee: c.applicationFee || null,
          scholarship: c.scholarship || null,
          courseUrl: c.courseUrl || null,
          normalizedTuition: c.normalizedTuition,
          normalizedDuration: c.normalizedDuration,
          normalizedIntakes: c.normalizedIntakes,
          normalizedRequirements: c.normalizedRequirements,
          qualityScore: c.qualityScore,
          cleaningStatus: c.cleaningStatus,
          isDuplicate: false,
          duplicateOf: null,
          cleaningNotes: c.cleaningNotes,
          recordStatus: 'cleaned',
          scrapedAt: new Date(),
        },
        { transaction: t },
      );
      count++;
    }
  });

  scrapeLogger.info('Persisted cleaned courses', { jobId, count });
  return count;
};
