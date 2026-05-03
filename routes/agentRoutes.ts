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
} from '../controller/agentController';
import { jwtAuthMiddleware } from '../middleware/jwtAuth';
import { agentDocumentUpload } from '../middleware/multer';
import validateMiddleware from '../middleware/validate';
import {
  listApplicationsQueryJoiSchema,
  createApplicationBodyJoiSchema,
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

agentRouter
  .get('/profile', getAgentProfile)
  .patch('/profile', validateMiddleware(agentProfilePatchJoiSchema), patchAgentProfile)
  .get('/dashboard', getDashboard)
  .get('/search', validateMiddleware(globalSearchQueryJoiSchema), globalSearch)
  .get('/students', validateMiddleware(listStudentsQueryJoiSchema), listStudents)
  .get('/applications/export', validateMiddleware(listApplicationsQueryJoiSchema), exportApplicationsCsv)
  .get('/applications', validateMiddleware(listApplicationsQueryJoiSchema), listApplications)
  .post('/applications', validateMiddleware(createApplicationBodyJoiSchema), createApplication)
  .get('/applications/:applicationId', getApplication)
  .patch('/applications/:applicationId', validateMiddleware(patchApplicationBodyJoiSchema), patchApplication)
  .post('/applications/:applicationId/submit', submitApplication)
  .delete('/applications/:applicationId', deleteApplication)
  .get('/documents', validateMiddleware(listDocumentsQueryJoiSchema), listDocuments)
  .post('/documents', agentDocumentUpload.single('file'), uploadDocument)
  .patch('/documents/:documentId', validateMiddleware(patchDocumentBodyJoiSchema), patchDocument)
  .delete('/documents/:documentId', deleteDocument)
  .post('/documents/verify-demo', validateMiddleware(verifyDocumentsBodyJoiSchema), verifyDocumentsDemo)
  .get('/offer-letters', listOfferLetters)
  .post('/offer-letters', validateMiddleware(createOfferLetterBodyJoiSchema), createOfferLetter)
  .get('/offer-letters/:offerLetterId', getOfferLetter)
  .patch('/offer-letters/:offerLetterId', validateMiddleware(patchOfferLetterBodyJoiSchema), patchOfferLetter)
  .post('/offer-letters/:offerLetterId/file', agentDocumentUpload.single('file'), uploadOfferLetterFile)
  .post('/offer-letters/:offerLetterId/signed', agentDocumentUpload.single('file'), uploadSignedOffer)
  .post('/offer-letters/:offerLetterId/send', sendOfferLetter)
  .get('/commission', getCommission)
  .post('/deposits/pay-link', validateMiddleware(depositPayLinkBodyJoiSchema), createDepositPayLink)
  .get('/deadlines', validateMiddleware(deadlinesQueryJoiSchema), listDeadlines)
  .get('/discovery/universities', validateMiddleware(discoveryQueryJoiSchema), discoveryUniversities)
  .get('/discovery/courses', validateMiddleware(discoveryQueryJoiSchema), discoveryCourses);

export default agentRouter;
