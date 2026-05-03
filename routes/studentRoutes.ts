import { Router } from 'express';
import {
  getStudentProfile,
  patchStudentProfile,
  listApplications,
  createApplication,
  getApplication,
  patchApplication,
  submitApplication,
  deleteApplication,
  listDocuments,
  uploadDocument,
  deleteDocument,
} from '../controller/studentController';
import { jwtAuthMiddleware } from '../middleware/jwtAuth';
import { studentDocumentUpload } from '../middleware/multer';
import validateMiddleware from '../middleware/validate';
import {
  applicationBodyJoiSchema,
  listApplicationsQueryJoiSchema,
  studentProfilePatchJoiSchema,
} from '../validations/student.validation';

const studentRouter = Router();

studentRouter.use(jwtAuthMiddleware(['student']));

studentRouter
  .get('/profile', getStudentProfile)
  .patch('/profile', validateMiddleware(studentProfilePatchJoiSchema), patchStudentProfile)
  .get('/applications', validateMiddleware(listApplicationsQueryJoiSchema), listApplications)
  .post('/applications', validateMiddleware(applicationBodyJoiSchema), createApplication)
  .get('/applications/:applicationId', getApplication)
  .patch('/applications/:applicationId', validateMiddleware(applicationBodyJoiSchema), patchApplication)
  .post('/applications/:applicationId/submit', submitApplication)
  .delete('/applications/:applicationId', deleteApplication)
  .get('/documents', listDocuments)
  .post('/documents', studentDocumentUpload.single('file'), uploadDocument)
  .delete('/documents/:documentId', deleteDocument);

export default studentRouter;
