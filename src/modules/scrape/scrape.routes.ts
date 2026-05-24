import { Router } from 'express';
import { jwtAuthMiddleware } from '../../../middleware/jwtAuth';
import { requirePermission } from '../../../middleware/requirePermission';
import validateMiddleware from '../../../middleware/validate';
import {
  deleteCourse,
  deleteCoursesBulk,
  deleteFee,
  deleteJob,
  deleteScholarship,
  deleteUniversity,
  exportCourses,
  exportFees,
  exportScholarships,
  exportUniversities,
  getJob,
  listCourses,
  listFees,
  listJobs,
  listPresets,
  listScholarships,
  listUniversities,
  startScrape,
} from './scrape.controller';
import {
  courseIdJoiSchema,
  deleteCoursesBulkJoiSchema,
  entityIdJoiSchema,
  exportEntityJoiSchema,
  jobIdJoiSchema,
  listEntityJoiSchema,
  listJobsJoiSchema,
  startScrapeJoiSchema,
} from './scrape.validation';

const scrapeRouter = Router();

scrapeRouter.use(jwtAuthMiddleware(['admin']));

scrapeRouter.post(
  '/scrape/start',
  requirePermission('university_scraping', 'create'),
  validateMiddleware(startScrapeJoiSchema as never),
  startScrape,
);

scrapeRouter.get('/scrape/presets', requirePermission('university_scraping', 'view'), listPresets);

scrapeRouter.get(
  '/scrape/jobs',
  requirePermission('university_scraping', 'view'),
  validateMiddleware(listJobsJoiSchema as never),
  listJobs,
);

scrapeRouter.get(
  '/scrape/jobs/:id',
  requirePermission('university_scraping', 'view'),
  validateMiddleware(jobIdJoiSchema as never),
  getJob,
);

scrapeRouter.delete(
  '/scrape/jobs/:id',
  requirePermission('university_scraping', 'delete'),
  validateMiddleware(jobIdJoiSchema as never),
  deleteJob,
);

const entityRoutes = [
  { path: 'courses', list: listCourses, exportFn: exportCourses, del: deleteCourse, bulk: deleteCoursesBulk },
  { path: 'universities', list: listUniversities, exportFn: exportUniversities, del: deleteUniversity },
  { path: 'fees', list: listFees, exportFn: exportFees, del: deleteFee },
  { path: 'scholarships', list: listScholarships, exportFn: exportScholarships, del: deleteScholarship },
] as const;

for (const r of entityRoutes) {
  scrapeRouter.get(
    `/${r.path}`,
    requirePermission('university_scraping', 'view'),
    validateMiddleware(listEntityJoiSchema as never),
    r.list,
  );
  scrapeRouter.get(
    `/${r.path}/export`,
    requirePermission('university_scraping', 'view'),
    validateMiddleware(exportEntityJoiSchema as never),
    r.exportFn,
  );
  scrapeRouter.delete(
    `/${r.path}/:id`,
    requirePermission('university_scraping', 'delete'),
    validateMiddleware(entityIdJoiSchema as never),
    r.del,
  );
}

scrapeRouter.delete(
  '/courses/bulk',
  requirePermission('university_scraping', 'delete'),
  validateMiddleware(deleteCoursesBulkJoiSchema as never),
  deleteCoursesBulk,
);

export default scrapeRouter;
