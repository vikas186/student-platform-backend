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
  listOfferLetters,
  getOfferLetterForApplication,
  getOfferLetterByIdOrRef,
  uploadSignedOfferLetterForApplication,
  uploadSignedOfferLetterByIdOrRef,
  listDocuments,
  uploadDocument,
  deleteDocument,
} from '../controller/studentController';
import { jwtAuthMiddleware } from '../middleware/jwtAuth';
import { requirePermission } from '../middleware/requirePermission';
import { studentDocumentUpload, studentOfferSignedUpload } from '../middleware/multer';
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
  .get(
    '/applications',
    requirePermission('applications', 'view'),
    validateMiddleware(listApplicationsQueryJoiSchema),
    listApplications,
  )
  .post(
    '/applications',
    requirePermission('applications', 'create'),
    validateMiddleware(applicationBodyJoiSchema),
    createApplication,
  )
  .get('/applications/:applicationId', requirePermission('applications', 'view'), getApplication)
  .get(
    '/applications/:applicationId/offer-letter',
    requirePermission('applications', 'view'),
    getOfferLetterForApplication,
  )
  .post(
    '/applications/:applicationId/offer-letter/signed',
    requirePermission('applications', 'edit'),
    studentOfferSignedUpload.single('file'),
    uploadSignedOfferLetterForApplication,
  )
  .patch(
    '/applications/:applicationId',
    requirePermission('applications', 'edit'),
    validateMiddleware(applicationBodyJoiSchema),
    patchApplication,
  )
  .post('/applications/:applicationId/submit', requirePermission('applications', 'edit'), submitApplication)
  .delete('/applications/:applicationId', requirePermission('applications', 'edit'), deleteApplication)
  .get('/offer-letters', requirePermission('applications', 'view'), listOfferLetters)
  .post(
    '/offer-letters/:offerLetterId/signed',
    requirePermission('applications', 'edit'),
    studentOfferSignedUpload.single('file'),
    uploadSignedOfferLetterByIdOrRef,
  )
  .get('/offer-letters/:offerLetterId', requirePermission('applications', 'view'), getOfferLetterByIdOrRef)
  .get('/documents', requirePermission('applications', 'view'), listDocuments)
  .post('/documents', requirePermission('applications', 'edit'), studentDocumentUpload.single('file'), uploadDocument)
  .delete('/documents/:documentId', requirePermission('applications', 'edit'), deleteDocument);

export default studentRouter;
