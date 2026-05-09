import { Router } from 'express';
import {
  getAgentProfile,
  patchAgentProfile,
  getDashboard,
  listApplications,
  exportApplicationsCsv,
  createApplication,
  getApplication,
  patchApplication,
  submitApplication,
  deleteApplication,
  listStudents,
  createStudent,
  listDocuments,
  uploadDocument,
  patchDocument,
  deleteDocument,
  verifyDocumentsDemo,
  listOfferLetters,
  createOfferLetter,
  getOfferLetter,
  patchOfferLetter,
  uploadOfferLetterFile,
  uploadSignedOffer,
  sendOfferLetter,
  getCommission,
  createDepositPayLink,
  listDeadlines,
  discoveryUniversities,
  discoveryCourses,
  globalSearch,
  getAgreementStatus,
  uploadAgreement,
  requireAgreementApproved,
} from '../controller/agentController';
import { jwtAuthMiddleware } from '../middleware/jwtAuth';
import { requirePermission } from '../middleware/requirePermission';
import { agentAgreementUpload, agentDocumentUpload } from '../middleware/multer';
import validateMiddleware from '../middleware/validate';
import {
  listApplicationsQueryJoiSchema,
  createApplicationBodyJoiSchema,
  createAgentStudentBodyJoiSchema,
  patchApplicationBodyJoiSchema,
  listDocumentsQueryJoiSchema,
  patchDocumentBodyJoiSchema,
  verifyDocumentsBodyJoiSchema,
  createOfferLetterBodyJoiSchema,
  patchOfferLetterBodyJoiSchema,
  depositPayLinkBodyJoiSchema,
  discoveryQueryJoiSchema,
  deadlinesQueryJoiSchema,
  globalSearchQueryJoiSchema,
  agentProfilePatchJoiSchema,
  listStudentsQueryJoiSchema,
} from '../validations/agent.validation';

const agentRouter = Router();

agentRouter.use(jwtAuthMiddleware(['agent']));

/**
 * Agreement workflow — these MUST be reachable even before admin approval, otherwise
 * the agent has no way to see the gate message or upload the signed copy.
 */
agentRouter
  .get('/agreement', getAgreementStatus)
  .post('/agreement/signed', agentAgreementUpload.single('file'), uploadAgreement);

/**
 * Everything below this line requires the agent's partnership agreement to be
 * approved by admin. The gate returns 403 with a `Portal locked` message until then.
 */
agentRouter.use(requireAgreementApproved);

agentRouter
  .get('/profile', getAgentProfile)
  .patch('/profile', validateMiddleware(agentProfilePatchJoiSchema), patchAgentProfile)
  .get('/dashboard', requirePermission('applications', 'view'), getDashboard)
  .get('/search', requirePermission('applications', 'view'), validateMiddleware(globalSearchQueryJoiSchema), globalSearch)
  .post('/students', requirePermission('applications', 'create'), validateMiddleware(createAgentStudentBodyJoiSchema), createStudent)
  .get('/students', requirePermission('applications', 'view'), validateMiddleware(listStudentsQueryJoiSchema), listStudents)
  .get(
    '/applications/export',
    requirePermission('applications', 'view'),
    validateMiddleware(listApplicationsQueryJoiSchema),
    exportApplicationsCsv,
  )
  .get('/applications', requirePermission('applications', 'view'), validateMiddleware(listApplicationsQueryJoiSchema), listApplications)
  .post(
    '/applications',
    requirePermission('applications', 'create'),
    validateMiddleware(createApplicationBodyJoiSchema),
    createApplication,
  )
  .get('/applications/:applicationId', requirePermission('applications', 'view'), getApplication)
  .patch(
    '/applications/:applicationId',
    requirePermission('applications', 'edit'),
    validateMiddleware(patchApplicationBodyJoiSchema),
    patchApplication,
  )
  .post('/applications/:applicationId/submit', requirePermission('applications', 'edit'), submitApplication)
  .delete('/applications/:applicationId', requirePermission('applications', 'edit'), deleteApplication)
  .get('/documents', requirePermission('applications', 'view'), validateMiddleware(listDocumentsQueryJoiSchema), listDocuments)
  .post('/documents', requirePermission('applications', 'edit'), agentDocumentUpload.single('file'), uploadDocument)
  .patch(
    '/documents/:documentId',
    requirePermission('applications', 'edit'),
    validateMiddleware(patchDocumentBodyJoiSchema),
    patchDocument,
  )
  .delete('/documents/:documentId', requirePermission('applications', 'edit'), deleteDocument)
  .post(
    '/documents/verify-demo',
    requirePermission('applications', 'edit'),
    validateMiddleware(verifyDocumentsBodyJoiSchema),
    verifyDocumentsDemo,
  )
  .get('/offer-letters', requirePermission('applications', 'view'), listOfferLetters)
  .post(
    '/offer-letters',
    requirePermission('applications', 'edit'),
    validateMiddleware(createOfferLetterBodyJoiSchema),
    createOfferLetter,
  )
  .get('/offer-letters/:offerLetterId', requirePermission('applications', 'view'), getOfferLetter)
  .patch(
    '/offer-letters/:offerLetterId',
    requirePermission('applications', 'edit'),
    validateMiddleware(patchOfferLetterBodyJoiSchema),
    patchOfferLetter,
  )
  .post(
    '/offer-letters/:offerLetterId/file',
    requirePermission('applications', 'edit'),
    agentDocumentUpload.single('file'),
    uploadOfferLetterFile,
  )
  .post(
    '/offer-letters/:offerLetterId/signed',
    requirePermission('applications', 'edit'),
    agentDocumentUpload.single('file'),
    uploadSignedOffer,
  )
  .post('/offer-letters/:offerLetterId/send', requirePermission('applications', 'edit'), sendOfferLetter)
  .get('/commission', requirePermission('commission_slabs', 'view'), getCommission)
  .post(
    '/deposits/pay-link',
    requirePermission('payments', 'create'),
    validateMiddleware(depositPayLinkBodyJoiSchema),
    createDepositPayLink,
  )
  .get('/deadlines', requirePermission('deadlines', 'view'), validateMiddleware(deadlinesQueryJoiSchema), listDeadlines)
  .get(
    '/discovery/universities',
    requirePermission('applications', 'view'),
    validateMiddleware(discoveryQueryJoiSchema),
    discoveryUniversities,
  )
  .get(
    '/discovery/courses',
    requirePermission('applications', 'view'),
    validateMiddleware(discoveryQueryJoiSchema),
    discoveryCourses,
  );

export default agentRouter;
