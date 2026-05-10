import { Router } from 'express';
import { jwtAuthMiddleware } from '../middleware/jwtAuth';
import { requirePermission } from '../middleware/requirePermission';
import { adminUniversityCatalogUpload, adminUniversityCsvUpload, agentDocumentUpload } from '../middleware/multer';
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
  importUniversityCatalog,
  importUniversityCoursesCsv,
  listCoursesAdmin,
  createCourseAdmin,
  patchCourseAdmin,
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
  listAgentAgreements,
  approveAgentAgreement,
  rejectAgentAgreement,
  deleteAgentAgreement,
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
  getPermissionsMatrix,
  putPermissionsMatrix,
  resetPermissionsMatrix,
  patchAgentSubscription,
  syncChatKnowledge,
  patchStudentCounselling,
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
  listAgentAgreementsQueryJoiSchema,
  rejectAgentAgreementJoiSchema,
  listApplicationsQueryJoiSchema,
  listCoursesQueryJoiSchema,
  listUniversitiesQueryJoiSchema,
  universityCoursesImportParamsJoiSchema,
  createAdminCourseJoiSchema,
  patchAdminCourseJoiSchema,
  listDeadlinesQueryJoiSchema,
  listPaymentsQueryJoiSchema,
  listUsersQueryJoiSchema,
  patchAgentSubscriptionJoiSchema,
  patchStudentCounsellingJoiSchema,
  patchApplicationStatusJoiSchema,
  patchApplicationStatusUiJoiSchema,
  patchCommissionJoiSchema,
  patchDeadlineJoiSchema,
  patchSubscriptionPlanJoiSchema,
  patchUniversityJoiSchema,
  patchUserRoleJoiSchema,
  putPermissionsMatrixJoiSchema,
} from '../validations/admin.validation';

const adminRouter = Router();

adminRouter.use(jwtAuthMiddleware(['admin']));

adminRouter
  .get('/dashboard', requirePermission('applications', 'view'), getDashboard)
  .get('/roles', requirePermission('roles_permissions', 'view'), getRolesMetadata)
  .get('/permissions', requirePermission('roles_permissions', 'view'), getPermissionsMatrix)
  .put(
    '/permissions',
    requirePermission('roles_permissions', 'edit'),
    validateMiddleware(putPermissionsMatrixJoiSchema),
    putPermissionsMatrix,
  )
  .post('/permissions/reset', requirePermission('roles_permissions', 'edit'), resetPermissionsMatrix)
  .get('/application-status-options', requirePermission('applications', 'view'), getApplicationStatusOptions)
  .get('/search', requirePermission('applications', 'view'), validateMiddleware(globalSearchQueryJoiSchema), globalSearch)
  .get(
    '/universities',
    requirePermission('deadlines', 'view'),
    validateMiddleware(listUniversitiesQueryJoiSchema),
    listUniversitiesAdmin,
  )
  .post(
    '/universities/import-catalog',
    requirePermission('deadlines', 'create'),
    adminUniversityCatalogUpload.single('file'),
    importUniversityCatalog,
  )
  .post(
    '/universities/:universityId/courses/import-csv',
    requirePermission('deadlines', 'create'),
    validateMiddleware(universityCoursesImportParamsJoiSchema),
    adminUniversityCsvUpload.single('file'),
    importUniversityCoursesCsv,
  )
  .get('/courses', requirePermission('deadlines', 'view'), validateMiddleware(listCoursesQueryJoiSchema), listCoursesAdmin)
  .post('/courses', requirePermission('deadlines', 'create'), validateMiddleware(createAdminCourseJoiSchema), createCourseAdmin)
  .patch('/courses/:courseId', requirePermission('deadlines', 'edit'), validateMiddleware(patchAdminCourseJoiSchema), patchCourseAdmin)
  .get('/users', requirePermission('users', 'view'), validateMiddleware(listUsersQueryJoiSchema), listUsers)
  .post('/users', requirePermission('users', 'create'), validateMiddleware(createAdminUserJoiSchema), createUser)
  .patch('/users/:userId/role', requirePermission('users', 'edit'), validateMiddleware(patchUserRoleJoiSchema), patchUserRole)
  .delete('/users/:userId', requirePermission('users', 'delete'), deleteUser)
  .get(
    '/applications',
    requirePermission('applications', 'view'),
    validateMiddleware(listApplicationsQueryJoiSchema),
    listApplications,
  )
  .get('/applications/:applicationId', requirePermission('applications', 'view'), getApplication)
  .patch(
    '/applications/:applicationId/status',
    requirePermission('applications', 'approve'),
    validateMiddleware(patchApplicationStatusJoiSchema),
    patchApplicationStatus,
  )
  .patch(
    '/applications/:applicationId/status-ui',
    requirePermission('applications', 'approve'),
    validateMiddleware(patchApplicationStatusUiJoiSchema),
    patchApplicationStatusUi,
  )
  .delete('/applications/:applicationId', requirePermission('applications', 'edit'), deleteApplication)
  .get('/deadlines', requirePermission('deadlines', 'view'), validateMiddleware(listDeadlinesQueryJoiSchema), listDeadlines)
  .post('/deadlines', requirePermission('deadlines', 'create'), validateMiddleware(createDeadlineJoiSchema), createDeadline)
  .post('/deadlines/intake-row', requirePermission('deadlines', 'create'), validateMiddleware(intakeRowJoiSchema), createIntakeRow)
  .patch('/deadlines/:deadlineId', requirePermission('deadlines', 'edit'), validateMiddleware(patchDeadlineJoiSchema), patchDeadline)
  .delete('/deadlines/:deadlineId', requirePermission('deadlines', 'delete'), deleteDeadline)
  .get('/offer-letters', requirePermission('applications', 'view'), listOfferLetters)
  .post(
    '/offer-letters/upload-match',
    requirePermission('applications', 'edit'),
    agentDocumentUpload.single('file'),
    uploadOfferLetterByMatch,
  )
  .post(
    '/offer-letters',
    requirePermission('applications', 'edit'),
    validateMiddleware(createOfferLetterAdminJoiSchema),
    createOfferLetter,
  )
  .post(
    '/offer-letters/:offerLetterId/file',
    requirePermission('applications', 'edit'),
    agentDocumentUpload.single('file'),
    uploadOfferLetterFile,
  )
  .delete('/offer-letters/:offerLetterId', requirePermission('applications', 'edit'), deleteOfferLetter)
  .get('/agents', requirePermission('agent_ranking', 'view'), validateMiddleware(listAgentsQueryJoiSchema), listAgents)
  .get(
    '/agents/agreements',
    requirePermission('agent_ranking', 'view'),
    validateMiddleware(listAgentAgreementsQueryJoiSchema),
    listAgentAgreements,
  )
  .post(
    '/agents/:agentProfileId/agreement/approve',
    requirePermission('agent_ranking', 'approve'),
    approveAgentAgreement,
  )
  .post(
    '/agents/:agentProfileId/agreement/reject',
    requirePermission('agent_ranking', 'approve'),
    validateMiddleware(rejectAgentAgreementJoiSchema),
    rejectAgentAgreement,
  )
  .delete(
    '/agents/:agentProfileId/agreement',
    requirePermission('agent_ranking', 'approve'),
    deleteAgentAgreement,
  )
  .patch(
    '/agents/:agentProfileId/subscription',
    requirePermission('subscriptions', 'edit'),
    validateMiddleware(patchAgentSubscriptionJoiSchema),
    patchAgentSubscription,
  )
  .get('/payments', requirePermission('payments', 'view'), validateMiddleware(listPaymentsQueryJoiSchema), listPayments)
  .get('/commissions', requirePermission('commission_slabs', 'view'), listCommissions)
  .post('/commissions', requirePermission('commission_slabs', 'create'), validateMiddleware(createCommissionJoiSchema), createCommission)
  .post(
    '/commission-slabs/rich',
    requirePermission('commission_slabs', 'create'),
    validateMiddleware(commissionSlabRichJoiSchema),
    createCommissionRich,
  )
  .patch(
    '/commissions/:commissionId',
    requirePermission('commission_slabs', 'edit'),
    validateMiddleware(patchCommissionJoiSchema),
    patchCommission,
  )
  .delete('/commissions/:commissionId', requirePermission('commission_slabs', 'delete'), deleteCommission)
  .get('/subscription-plans', requirePermission('subscriptions', 'view'), listSubscriptionPlans)
  .post(
    '/subscription-plans',
    requirePermission('subscriptions', 'create'),
    validateMiddleware(createSubscriptionPlanJoiSchema),
    createSubscriptionPlan,
  )
  .patch(
    '/subscription-plans/:planId',
    requirePermission('subscriptions', 'edit'),
    validateMiddleware(patchSubscriptionPlanJoiSchema),
    patchSubscriptionPlan,
  )
  .delete('/subscription-plans/:planId', requirePermission('subscriptions', 'delete'), deleteSubscriptionPlan)
  .post('/universities', requirePermission('deadlines', 'create'), validateMiddleware(createUniversityJoiSchema), createUniversity)
  .patch(
    '/universities/:universityId',
    requirePermission('deadlines', 'edit'),
    validateMiddleware(patchUniversityJoiSchema),
    patchUniversity,
  )
  .delete('/universities/:universityId', requirePermission('deadlines', 'delete'), deleteUniversity)
  .post('/chat/knowledge/sync', requirePermission('deadlines', 'edit'), syncChatKnowledge)
  .patch(
    '/students/:studentProfileId/counselling',
    requirePermission('users', 'edit'),
    validateMiddleware(patchStudentCounsellingJoiSchema),
    patchStudentCounselling,
  );

export default adminRouter;
