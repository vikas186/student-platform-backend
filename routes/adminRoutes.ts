import { Router } from 'express';
import { jwtAuthMiddleware } from '../middleware/jwtAuth';
import { agentDocumentUpload } from '../middleware/multer';
import validateMiddleware from '../middleware/validate';
import {
  getDashboard,
  listUsers,
  createUser,
  patchUserRole,
  deleteUser,
  listApplications,
  getApplication,
  patchApplicationStatus,
  patchApplicationStatusUi,
  getApplicationStatusOptions,
  listUniversitiesAdmin,
  listCoursesAdmin,
  createIntakeRow,
  deleteApplication,
  listDeadlines,
  createDeadline,
  patchDeadline,
  deleteDeadline,
  listOfferLetters,
  createOfferLetter,
  uploadOfferLetterByMatch,
  uploadOfferLetterFile,
  deleteOfferLetter,
  listAgents,
  listPayments,
  listCommissions,
  createCommission,
  createCommissionRich,
  patchCommission,
  deleteCommission,
  listSubscriptionPlans,
  createSubscriptionPlan,
  patchSubscriptionPlan,
  deleteSubscriptionPlan,
  createUniversity,
  patchUniversity,
  deleteUniversity,
  globalSearch,
  getRolesMetadata,
  patchAgentSubscription,
} from '../controller/adminController';
import {
  commissionSlabRichJoiSchema,
  createAdminUserJoiSchema,
  createCommissionJoiSchema,
  createDeadlineJoiSchema,
  createOfferLetterAdminJoiSchema,
  createSubscriptionPlanJoiSchema,
  createUniversityJoiSchema,
  globalSearchQueryJoiSchema,
  intakeRowJoiSchema,
  listAgentsQueryJoiSchema,
  listApplicationsQueryJoiSchema,
  listCoursesQueryJoiSchema,
  listDeadlinesQueryJoiSchema,
  listPaymentsQueryJoiSchema,
  listUsersQueryJoiSchema,
  patchAgentSubscriptionJoiSchema,
  patchApplicationStatusJoiSchema,
  patchApplicationStatusUiJoiSchema,
  patchCommissionJoiSchema,
  patchDeadlineJoiSchema,
  patchSubscriptionPlanJoiSchema,
  patchUniversityJoiSchema,
  patchUserRoleJoiSchema,
} from '../validations/admin.validation';

const adminRouter = Router();

adminRouter.use(jwtAuthMiddleware(['admin']));

adminRouter
  .get('/dashboard', getDashboard)
  .get('/roles', getRolesMetadata)
  .get('/application-status-options', getApplicationStatusOptions)
  .get('/search', validateMiddleware(globalSearchQueryJoiSchema), globalSearch)
  .get('/universities', listUniversitiesAdmin)
  .get('/courses', validateMiddleware(listCoursesQueryJoiSchema), listCoursesAdmin)
  .get('/users', validateMiddleware(listUsersQueryJoiSchema), listUsers)
  .post('/users', validateMiddleware(createAdminUserJoiSchema), createUser)
  .patch('/users/:userId/role', validateMiddleware(patchUserRoleJoiSchema), patchUserRole)
  .delete('/users/:userId', deleteUser)
  .get('/applications', validateMiddleware(listApplicationsQueryJoiSchema), listApplications)
  .get('/applications/:applicationId', getApplication)
  .patch(
    '/applications/:applicationId/status',
    validateMiddleware(patchApplicationStatusJoiSchema),
    patchApplicationStatus,
  )
  .patch(
    '/applications/:applicationId/status-ui',
    validateMiddleware(patchApplicationStatusUiJoiSchema),
    patchApplicationStatusUi,
  )
  .delete('/applications/:applicationId', deleteApplication)
  .get('/deadlines', validateMiddleware(listDeadlinesQueryJoiSchema), listDeadlines)
  .post('/deadlines', validateMiddleware(createDeadlineJoiSchema), createDeadline)
  .post('/deadlines/intake-row', validateMiddleware(intakeRowJoiSchema), createIntakeRow)
  .patch('/deadlines/:deadlineId', validateMiddleware(patchDeadlineJoiSchema), patchDeadline)
  .delete('/deadlines/:deadlineId', deleteDeadline)
  .get('/offer-letters', listOfferLetters)
  .post('/offer-letters/upload-match', agentDocumentUpload.single('file'), uploadOfferLetterByMatch)
  .post('/offer-letters', validateMiddleware(createOfferLetterAdminJoiSchema), createOfferLetter)
  .post('/offer-letters/:offerLetterId/file', agentDocumentUpload.single('file'), uploadOfferLetterFile)
  .delete('/offer-letters/:offerLetterId', deleteOfferLetter)
  .get('/agents', validateMiddleware(listAgentsQueryJoiSchema), listAgents)
  .patch('/agents/:agentProfileId/subscription', validateMiddleware(patchAgentSubscriptionJoiSchema), patchAgentSubscription)
  .get('/payments', validateMiddleware(listPaymentsQueryJoiSchema), listPayments)
  .get('/commissions', listCommissions)
  .post('/commissions', validateMiddleware(createCommissionJoiSchema), createCommission)
  .post('/commission-slabs/rich', validateMiddleware(commissionSlabRichJoiSchema), createCommissionRich)
  .patch('/commissions/:commissionId', validateMiddleware(patchCommissionJoiSchema), patchCommission)
  .delete('/commissions/:commissionId', deleteCommission)
  .get('/subscription-plans', listSubscriptionPlans)
  .post('/subscription-plans', validateMiddleware(createSubscriptionPlanJoiSchema), createSubscriptionPlan)
  .patch('/subscription-plans/:planId', validateMiddleware(patchSubscriptionPlanJoiSchema), patchSubscriptionPlan)
  .delete('/subscription-plans/:planId', deleteSubscriptionPlan)
  .post('/universities', validateMiddleware(createUniversityJoiSchema), createUniversity)
  .patch('/universities/:universityId', validateMiddleware(patchUniversityJoiSchema), patchUniversity)
  .delete('/universities/:universityId', deleteUniversity);

export default adminRouter;
