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
  listUniversities,
  getUniversity,
  createTuitionPayLink,
} from '../controller/studentController';
import { jwtAuthMiddleware } from '../middleware/jwtAuth';
import { requirePermission } from '../middleware/requirePermission';
import { studentDocumentUpload, studentOfferSignedUpload } from '../middleware/multer';
import validateMiddleware from '../middleware/validate';
import {
  applicationBodyJoiSchema,
  listApplicationsQueryJoiSchema,
  studentProfilePatchJoiSchema,
  universitiesQueryJoiSchema,
  tuitionPayLinkBodyJoiSchema,
} from '../validations/student.validation';
import {
  bookStudentAppointmentHandler,
  cancelStudentAppointmentHandler,
  getStudentFlowHandler,
  listStudentAppointmentsHandler,
  listStudentSlotsHandler,
  rescheduleStudentAppointmentHandler,
} from '../src/modules/scheduling/scheduling.controller';
import {
  digilockerCallbackHandler,
  disconnectDigilockerHandler,
  getDigilockerAuthUrlHandler,
  getDigilockerStatusHandler,
  importDigilockerDocumentHandler,
  importAllDigilockerDocumentsHandler,
  listDigilockerDocumentsHandler,
} from '../src/modules/digilocker/digilocker.controller';
import {
  createDiditSessionHandler,
  getDiditStatusHandler,
} from '../src/modules/didit/didit.controller';
import {
  getStudentDocumentStatusHandler,
  listStudentVerificationsHandler,
} from '../src/modules/document-verification/document-verification.controller';
import {
  appointmentIdParamJoiSchema,
  bookAppointmentJoiSchema,
  listSlotsJoiSchema,
  rescheduleAppointmentJoiSchema,
} from '../src/modules/scheduling/scheduling.validation';

const studentRouter = Router();

/**
 * Universities catalog browsing — readable by students, agents, and admins.
 * Declared BEFORE the student-only auth gate so other portal roles aren't rejected.
 * `requirePermission('applications','view')` is satisfied by the default matrix
 * for all three roles (admins short-circuit to allowed).
 */
studentRouter.get(
  '/universities',
  jwtAuthMiddleware(['student', 'agent', 'admin']),
  requirePermission('applications', 'view'),
  validateMiddleware(universitiesQueryJoiSchema),
  listUniversities,
);
studentRouter.get(
  '/universities/:universityId',
  jwtAuthMiddleware(['student', 'agent', 'admin']),
  requirePermission('applications', 'view'),
  getUniversity,
);

/** DigiLocker OAuth callback — no JWT; validated via signed state. */
studentRouter.get('/digilocker/callback', digilockerCallbackHandler);

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
  .delete('/documents/:documentId', requirePermission('applications', 'edit'), deleteDocument)
  .get('/scheduling/flow', getStudentFlowHandler)
  .get(
    '/scheduling/slots',
    validateMiddleware(listSlotsJoiSchema as any),
    listStudentSlotsHandler,
  )
  .post(
    '/scheduling/appointments',
    validateMiddleware(bookAppointmentJoiSchema as any),
    bookStudentAppointmentHandler,
  )
  .get('/scheduling/appointments', listStudentAppointmentsHandler)
  .patch(
    '/scheduling/appointments/:appointmentId/cancel',
    validateMiddleware(appointmentIdParamJoiSchema as any),
    cancelStudentAppointmentHandler,
  )
  .patch(
    '/scheduling/appointments/:appointmentId/reschedule',
    validateMiddleware(rescheduleAppointmentJoiSchema as any),
    rescheduleStudentAppointmentHandler,
  )
  .post('/verification/didit/session', createDiditSessionHandler)
  .get('/verification/didit/status', getDiditStatusHandler)
  .post(
    '/payments/tuition-link',
    requirePermission('applications', 'edit'),
    validateMiddleware(tuitionPayLinkBodyJoiSchema),
    createTuitionPayLink,
  )
  .get('/document-status', requirePermission('applications', 'view'), getStudentDocumentStatusHandler)
  .get('/verifications', requirePermission('applications', 'view'), listStudentVerificationsHandler)
  .get('/digilocker/status', requirePermission('applications', 'view'), getDigilockerStatusHandler)
  .get('/digilocker/auth-url', requirePermission('applications', 'edit'), getDigilockerAuthUrlHandler)
  .get('/digilocker/documents', requirePermission('applications', 'view'), listDigilockerDocumentsHandler)
  .post('/digilocker/import', requirePermission('applications', 'edit'), importDigilockerDocumentHandler)
  .post('/digilocker/import-all', requirePermission('applications', 'edit'), importAllDigilockerDocumentsHandler)
  .delete('/digilocker/disconnect', requirePermission('applications', 'edit'), disconnectDigilockerHandler);

export default studentRouter;
