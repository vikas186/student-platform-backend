import Joi from 'joi';
import { SCRAPE_PRESETS } from '../../../models/ScrapeJob.model';
import { COURSE_CLEANING_STATUSES } from '../../../models/ScrapedCourse.model';
import { UNIVERSITY_CLEANING_STATUSES } from '../../../models/ScrapeUniversity.model';
import { FEE_CLEANING_STATUSES } from '../../../models/ScrapeFee.model';
import { SCHOLARSHIP_CLEANING_STATUSES } from '../../../models/ScrapeScholarship.model';

export const startScrapeJoiSchema = {
  body: Joi.object({
    source: Joi.string()
      .valid(...SCRAPE_PRESETS)
      .optional(),
    url: Joi.string()
      .uri({ scheme: ['http', 'https'] })
      .max(2048)
      .optional(),
    name: Joi.string().trim().max(256).optional(),
    seeds: Joi.array()
      .items(Joi.string().uri({ scheme: ['http', 'https'] }).max(2048))
      .max(30)
      .optional(),
  }).xor('source', 'url'),
};

export const listJobsJoiSchema = {
  query: {
    status: Joi.string().optional(),
    source: Joi.string().trim().max(128).optional(),
    page: Joi.number().integer().min(1).optional(),
    limit: Joi.number().integer().min(1).max(100).optional(),
  },
};

export const jobIdJoiSchema = {
  params: { id: Joi.string().uuid().required() },
  query: { force: Joi.boolean().optional() },
};

const ENTITY_STATUSES = [
  ...COURSE_CLEANING_STATUSES,
  ...UNIVERSITY_CLEANING_STATUSES,
  ...FEE_CLEANING_STATUSES,
  ...SCHOLARSHIP_CLEANING_STATUSES,
].filter((v, i, a) => a.indexOf(v) === i);

export const listEntityJoiSchema = {
  query: {
    source: Joi.string().trim().max(128).optional(),
    country: Joi.string().trim().max(128).optional(),
    search: Joi.string().trim().max(256).optional(),
    cleaningStatus: Joi.string()
      .valid(...ENTITY_STATUSES)
      .optional(),
    qualityMin: Joi.number().integer().min(0).max(100).optional(),
    qualityMax: Joi.number().integer().min(0).max(100).optional(),
    isDuplicate: Joi.boolean().optional(),
    jobId: Joi.string().uuid().optional(),
    includeRejected: Joi.boolean().optional(),
    page: Joi.number().integer().min(1).optional(),
    limit: Joi.number().integer().min(1).max(200).optional(),
  },
};

export const exportEntityJoiSchema = {
  query: {
    ...listEntityJoiSchema.query,
    format: Joi.string().valid('csv', 'xlsx').optional(),
  },
};

export const entityIdJoiSchema = {
  params: { id: Joi.string().uuid().required() },
};

export const courseIdJoiSchema = entityIdJoiSchema;

export const deleteCoursesBulkJoiSchema = {
  body: {
    ids: Joi.array().items(Joi.string().uuid()).min(1).max(500).required(),
  },
};

export const listCoursesJoiSchema = listEntityJoiSchema;
export const exportCoursesJoiSchema = exportEntityJoiSchema;
