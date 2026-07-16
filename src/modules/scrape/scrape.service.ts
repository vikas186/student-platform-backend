import { Op } from 'sequelize';
import * as XLSX from 'xlsx';
import { db, sequelize } from '../../../config/database';
import AppError from '../../../utils/errorHandler';
import { COURSE_CLEANING_STATUSES } from '../../../models/ScrapedCourse.model';
import { UNIVERSITY_CLEANING_STATUSES } from '../../../models/ScrapeUniversity.model';
import { FEE_CLEANING_STATUSES } from '../../../models/ScrapeFee.model';
import { SCHOLARSHIP_CLEANING_STATUSES } from '../../../models/ScrapeScholarship.model';
import type { ScrapeTrigger, ScrapeJobStatus } from '../../../models/ScrapeJob.model';
import { resolveScrapeTarget, type StartScrapeBody } from './config/scrape-target.util';
import { PRESET_CONFIG } from './config/scrape-sources';
import { startScrapeJob } from './scrape.processor';

const ENTITY_STATUSES = ['high_quality', 'needs_review'] as const;

type ListQuery = {
  source?: string;
  country?: string;
  search?: string;
  cleaningStatus?: string;
  qualityMin?: number;
  qualityMax?: number;
  isDuplicate?: boolean;
  jobId?: string;
  includeRejected?: boolean;
  page?: number;
  limit?: number;
};

const buildEntityWhere = (
  query: ListQuery,
  allowedStatuses: readonly string[],
  searchFields: string[],
): Record<string, unknown> => {
  const where: Record<string, unknown> = { recordStatus: 'cleaned' };
  if (query.source) where.source = query.source;
  if (query.jobId) where.jobId = query.jobId;
  if (query.country?.trim()) where.country = { [Op.iLike]: `%${query.country.trim()}%` };

  if (query.cleaningStatus && allowedStatuses.includes(query.cleaningStatus)) {
    where.cleaningStatus = query.cleaningStatus;
  } else if (!query.includeRejected) {
    where.cleaningStatus = { [Op.in]: [...ENTITY_STATUSES] };
    where.isDuplicate = false;
  }

  if (query.isDuplicate === true || query.isDuplicate === false) where.isDuplicate = query.isDuplicate;

  if (query.qualityMin != null || query.qualityMax != null) {
    const q: Record<number | symbol, number> = {};
    if (query.qualityMin != null) q[Op.gte] = query.qualityMin;
    if (query.qualityMax != null) q[Op.lte] = query.qualityMax;
    where.qualityScore = q;
  }

  if (query.search?.trim()) {
    const term = `%${query.search.trim()}%`;
    Object.assign(where, {
      [Op.or]: searchFields.map(f => ({ [f]: { [Op.iLike]: term } })),
    });
  }

  return where;
};

const paginate = (query: ListQuery) => {
  const page = Math.max(1, query.page || 1);
  const limit = Math.min(200, Math.max(1, query.limit || 20));
  return { page, limit, offset: (page - 1) * limit };
};

export const createScrapeJob = async (body: StartScrapeBody, trigger: ScrapeTrigger = 'manual') => {
  try {
    const target = resolveScrapeTarget(body);
    return await startScrapeJob(target, trigger);
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError(err instanceof Error ? err.message : 'Could not start scrape job', 409);
  }
};

export const listScrapePresets = () =>
  Object.entries(PRESET_CONFIG)
    .filter(([source]) => source === 'STUDIES_OVERSEAS')
    .map(([source, cfg]) => ({
      source,
      label: cfg.label || source,
      targetUrl: cfg.baseUrl,
      targetName: cfg.label || source,
    }));

export const listScrapeJobs = async (query: {
  status?: string;
  source?: string;
  page?: number;
  limit?: number;
}) => {
  const page = Math.max(1, query.page || 1);
  const limit = Math.min(100, Math.max(1, query.limit || 20));
  const offset = (page - 1) * limit;
  const where: Record<string, unknown> = {};
  if (query.status) where.status = query.status;
  if (query.source) where.source = query.source;

  const { rows, count } = await db.ScrapeJob.findAndCountAll({
    where,
    order: [['createdAt', 'DESC']],
    limit,
    offset,
    include: [{ model: db.RawScrapeBatch, as: 'rawBatches', required: false }],
  });

  return { data: rows, pagination: { page, limit, total: count, totalPages: Math.ceil(count / limit) } };
};

export const getScrapeJobById = async (id: string) => {
  const job = await db.ScrapeJob.findByPk(id, {
    include: [
      { model: db.RawScrapeBatch, as: 'rawBatches' },
      { model: db.ScrapedCourse, as: 'courses', limit: 20 },
      { model: db.ScrapeUniversity, as: 'universities', limit: 20 },
      { model: db.ScrapeFee, as: 'fees', limit: 20 },
      { model: db.ScrapeScholarship, as: 'scholarships', limit: 20 },
      { model: db.ScrapeRejectedPage, as: 'rejectedPages', limit: 20 },
    ],
  });
  if (!job) throw new AppError('Scrape job not found', 404);
  return job;
};

export const listCourses = async (query: ListQuery) => {
  const { page, limit, offset } = paginate(query);
  const where = buildEntityWhere(query, COURSE_CLEANING_STATUSES, ['universityName', 'courseName', 'country']);

  const { rows, count } = await db.ScrapedCourse.findAndCountAll({
    where,
    include: [{ model: db.ScrapeJob, as: 'job', attributes: ['id', 'source', 'status', 'createdAt'] }],
    order: [['scrapedAt', 'DESC']],
    limit,
    offset,
  });

  return { data: rows, pagination: { page, limit, total: count, totalPages: Math.ceil(count / limit) } };
};

export const listUniversities = async (query: ListQuery) => {
  const { page, limit, offset } = paginate(query);
  const where = buildEntityWhere(query, UNIVERSITY_CLEANING_STATUSES, ['universityName', 'country', 'city']);

  const { rows, count } = await db.ScrapeUniversity.findAndCountAll({
    where,
    include: [{ model: db.ScrapeJob, as: 'job', attributes: ['id', 'source', 'status', 'createdAt'] }],
    order: [['scrapedAt', 'DESC']],
    limit,
    offset,
  });

  return { data: rows, pagination: { page, limit, total: count, totalPages: Math.ceil(count / limit) } };
};

export const listFees = async (query: ListQuery) => {
  const { page, limit, offset } = paginate(query);
  const where = buildEntityWhere(query, FEE_CLEANING_STATUSES, ['country', 'studyLevel', 'description']);

  const { rows, count } = await db.ScrapeFee.findAndCountAll({
    where,
    include: [{ model: db.ScrapeJob, as: 'job', attributes: ['id', 'source', 'status', 'createdAt'] }],
    order: [['scrapedAt', 'DESC']],
    limit,
    offset,
  });

  return { data: rows, pagination: { page, limit, total: count, totalPages: Math.ceil(count / limit) } };
};

export const listScholarships = async (query: ListQuery) => {
  const { page, limit, offset } = paginate(query);
  const where = buildEntityWhere(query, SCHOLARSHIP_CLEANING_STATUSES, [
    'scholarshipName',
    'universityName',
    'country',
  ]);

  const { rows, count } = await db.ScrapeScholarship.findAndCountAll({
    where,
    include: [{ model: db.ScrapeJob, as: 'job', attributes: ['id', 'source', 'status', 'createdAt'] }],
    order: [['scrapedAt', 'DESC']],
    limit,
    offset,
  });

  return { data: rows, pagination: { page, limit, total: count, totalPages: Math.ceil(count / limit) } };
};

const toExportFile = (rows: Record<string, unknown>[], sheetName: string, filename: string, format: 'csv' | 'xlsx') => {
  if (format === 'csv') {
    const header = Object.keys(rows[0] || {}).join(',');
    const body = rows.map(r => Object.values(r).map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    return { contentType: 'text/csv', filename: `${filename}.csv`, body: `${header}\n${body}` };
  }
  const sheet = XLSX.utils.json_to_sheet(rows);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, sheetName);
  const buffer = XLSX.write(book, { type: 'buffer', bookType: 'xlsx' });
  return {
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    filename: `${filename}.xlsx`,
    body: buffer,
  };
};

export const exportCourses = async (query: ListQuery, format: 'csv' | 'xlsx' = 'xlsx') => {
  const { data } = await listCourses({ ...query, page: 1, limit: 5000 });
  const rows = data.map(c => ({
    source: c.source,
    universityName: c.universityName,
    courseName: c.courseName,
    country: c.country || '',
    city: c.city || '',
    studyLevel: c.studyLevel || '',
    duration: c.duration || '',
    tuitionFee: c.tuitionFee || '',
    intake: c.intake || '',
    courseUrl: c.courseUrl || '',
    qualityScore: c.qualityScore,
    cleaningStatus: c.cleaningStatus || '',
    scrapedAt: c.scrapedAt,
  }));
  return toExportFile(rows, 'Courses', 'courses', format);
};

export const exportUniversities = async (query: ListQuery, format: 'csv' | 'xlsx' = 'xlsx') => {
  const { data } = await listUniversities({ ...query, page: 1, limit: 5000 });
  const rows = data.map(u => ({
    source: u.source,
    universityName: u.universityName,
    country: u.country || '',
    city: u.city || '',
    ranking: u.ranking || '',
    websiteUrl: u.websiteUrl || '',
    sourceUrl: u.sourceUrl || '',
    qualityScore: u.qualityScore,
    cleaningStatus: u.cleaningStatus || '',
    scrapedAt: u.scrapedAt,
  }));
  return toExportFile(rows, 'Universities', 'universities', format);
};

export const exportFees = async (query: ListQuery, format: 'csv' | 'xlsx' = 'xlsx') => {
  const { data } = await listFees({ ...query, page: 1, limit: 5000 });
  const rows = data.map(f => ({
    source: f.source,
    country: f.country || '',
    studyLevel: f.studyLevel || '',
    tuitionFee: f.tuitionFee || '',
    livingCost: f.livingCost || '',
    accommodationCost: f.accommodationCost || '',
    currency: f.currency || '',
    sourceUrl: f.sourceUrl || '',
    qualityScore: f.qualityScore,
    cleaningStatus: f.cleaningStatus || '',
    scrapedAt: f.scrapedAt,
  }));
  return toExportFile(rows, 'Fees', 'fees', format);
};

export const exportScholarships = async (query: ListQuery, format: 'csv' | 'xlsx' = 'xlsx') => {
  const { data } = await listScholarships({ ...query, page: 1, limit: 5000 });
  const rows = data.map(s => ({
    source: s.source,
    scholarshipName: s.scholarshipName,
    universityName: s.universityName || '',
    country: s.country || '',
    amount: s.amount || '',
    eligibility: s.eligibility || '',
    deadline: s.deadline || '',
    sourceUrl: s.sourceUrl || '',
    qualityScore: s.qualityScore,
    cleaningStatus: s.cleaningStatus || '',
    scrapedAt: s.scrapedAt,
  }));
  return toExportFile(rows, 'Scholarships', 'scholarships', format);
};

const NON_DELETABLE_JOB_STATUSES: ScrapeJobStatus[] = ['scraping', 'cleaning'];

export const deleteScrapeJob = async (id: string, force = false): Promise<void> => {
  const job = await db.ScrapeJob.findByPk(id);
  if (!job) throw new AppError('Scrape job not found', 404);
  if (!force && NON_DELETABLE_JOB_STATUSES.includes(job.status)) {
    throw new AppError(`Cannot delete job while status is "${job.status}"`, 409);
  }

  await sequelize.transaction(async transaction => {
    await db.ScrapeAiMeta.destroy({ where: { jobId: id }, transaction });
    await job.destroy({ transaction });
  });
};

export const deleteCourse = async (id: string): Promise<void> => {
  const course = await db.ScrapedCourse.findByPk(id);
  if (!course) throw new AppError('Course not found', 404);
  await course.destroy();
};

export const deleteCoursesBulk = async (ids: string[]): Promise<{ deleted: number }> => {
  const uniqueIds = [...new Set(ids.filter(Boolean))];
  if (!uniqueIds.length) throw new AppError('No course ids provided', 400);
  const deleted = await db.ScrapedCourse.destroy({ where: { id: uniqueIds } });
  if (deleted === 0) throw new AppError('No courses found for the given ids', 404);
  return { deleted };
};

export const deleteUniversity = async (id: string): Promise<void> => {
  const row = await db.ScrapeUniversity.findByPk(id);
  if (!row) throw new AppError('University not found', 404);
  await row.destroy();
};

export const deleteFee = async (id: string): Promise<void> => {
  const row = await db.ScrapeFee.findByPk(id);
  if (!row) throw new AppError('Fee record not found', 404);
  await row.destroy();
};

export const deleteScholarship = async (id: string): Promise<void> => {
  const row = await db.ScrapeScholarship.findByPk(id);
  if (!row) throw new AppError('Scholarship not found', 404);
  await row.destroy();
};
