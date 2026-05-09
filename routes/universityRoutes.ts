import { Router } from 'express';
import {
  getPartnership,
  getDashboard,
  getCommission,
  postCountersignedContract,
  listApplications,
  getApplication,
  getApplicationChecklist,
  patchApplicationStatus,
  patchDocument,
  getApplicationStatusOptions,
} from '../controller/universityController';
import { jwtAuthMiddleware } from '../middleware/jwtAuth';
import { requirePermission } from '../middleware/requirePermission';
import { universityContractUpload } from '../middleware/multer';
import validateMiddleware from '../middleware/validate';
import {
  listUniversityApplicationsQueryJoiSchema,
  patchUniversityApplicationStatusJoiSchema,
  patchUniversityDocumentJoiSchema,
} from '../validations/university.validation';

const universityRouter = Router();

universityRouter.use(jwtAuthMiddleware(['university']));

universityRouter
  .get('/dashboard', requirePermission('applications', 'view'), getDashboard)
  .get('/partnership', requirePermission('applications', 'view'), getPartnership)
  .get('/commission', requirePermission('commission_slabs', 'view'), getCommission)
  .get('/commission-structure', requirePermission('commission_slabs', 'view'), getCommission)
  .post(
    '/partnership/countersigned-contract',
    requirePermission('applications', 'edit'),
    universityContractUpload.single('file'),
    postCountersignedContract,
  )
  .get('/application-status-options', requirePermission('applications', 'view'), getApplicationStatusOptions)
  .get(
    '/applications',
    requirePermission('applications', 'view'),
    validateMiddleware(listUniversityApplicationsQueryJoiSchema),
    listApplications,
  )
  .get('/applications/:applicationId', requirePermission('applications', 'view'), getApplication)
  .get('/applications/:applicationId/checklist', requirePermission('applications', 'view'), getApplicationChecklist)
  .patch(
    '/applications/:applicationId',
    requirePermission('applications', 'edit'),
    validateMiddleware(patchUniversityApplicationStatusJoiSchema),
    patchApplicationStatus,
  )
  .patch(
    '/documents/:documentId',
    requirePermission('applications', 'edit'),
    validateMiddleware(patchUniversityDocumentJoiSchema),
    patchDocument,
  );

export default universityRouter;
