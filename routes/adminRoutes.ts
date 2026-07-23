import { Router } from 'express';
import { loginAdminUser } from '../controller/authController';
import { jwtAuthMiddleware } from '../middleware/jwtAuth';
import { requirePermission } from '../middleware/requirePermission';
import { adminUniversityCatalogUpload, adminUniversityCsvUpload, agentAgreementUpload, agentDocumentUpload } from '../middleware/multer';
import validateMiddleware from '../middleware/validate';
import {
  getAdminUserDocumentStatusHandler,
  approveAdminVerificationHandler,
  getAdminVerificationDetailHandler,
  listAdminVerificationsHandler,
  rejectAdminVerificationHandler,
  requestAdminVerificationResubmissionHandler,
} from '../src/modules/document-verification/document-verification.controller';
import {
  adminVerificationActionJoiSchema,
  adminVerificationDetailParamsJoiSchema,
  adminVerificationResubmitJoiSchema,
  adminVerificationsListQueryJoiSchema,
  adminUserDocumentStatusParamsJoiSchema,
} from '../src/modules/document-verification/document-verification.validation';
import { getDigilockerPartnerDiagnosticsHandler } from '../src/modules/digilocker/digilocker.controller';
import {
  listAdminNoticesHandler,
  syncNoticesAiHandler,
} from '../src/modules/notices/notice.controller';
import { listAdminNoticesJoiSchema } from '../src/modules/notices/notice.validation';
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
  patchApplicationManualUpload,
  getApplicationStatusOptions,
  listUniversitiesAdmin,
  importUniversityCatalog,
  importUniversityCoursesCsv,
  listCoursesAdmin,
  createCourseAdmin,
  patchCourseAdmin,
  deleteCourseAdmin,
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
  getAgentAgreementTemplate,
  uploadAgentAgreementTemplate,
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
  syncRecommendationKnowledge,
  patchStudentCounselling,
  sendPromotionEmail,
  listActivityLogs,
} from '../controller/adminController';
import {
  deleteGoogleConnectionHandler,
  getAvailabilityHandler,
  getGoogleAuthUrlHandler,
  getGoogleConnectionHandler,
  googleOAuthCallbackHandler,
  listAdminAppointmentsHandler,
  listCounsellorCalendarsHandler,
  listUnavailabilityHandler,
  createUnavailabilityHandler,
  deleteUnavailabilityHandler,
  patchAdminAppointmentStatusHandler,
  putAvailabilityHandler,
} from '../src/modules/scheduling/scheduling.controller';
import {
  googleCallbackJoiSchema,
  listAdminAppointmentsJoiSchema,
  patchAppointmentStatusJoiSchema,
  setAvailabilityJoiSchema,
} from '../src/modules/scheduling/scheduling.validation';
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
  sendPromotionEmailJoiSchema,
  patchApplicationStatusJoiSchema,
  patchApplicationStatusUiJoiSchema,
  patchApplicationManualUploadJoiSchema,
  patchCommissionJoiSchema,
  patchDeadlineJoiSchema,
  patchSubscriptionPlanJoiSchema,
  patchUniversityJoiSchema,
  patchUserRoleJoiSchema,
  putPermissionsMatrixJoiSchema,
} from '../validations/admin.validation';
import { loginJoiSchema } from '../validations/auth.validation';

const adminRouter = Router();

/** Uniwizer UI calls `/api/v1/admin/login`; auth router also exposes `/api/v1/auth/admin/login`. */
adminRouter.post('/login', validateMiddleware(loginJoiSchema), loginAdminUser);

/** Google OAuth callback — public (no JWT) */
adminRouter.get(
  '/google/callback',
  validateMiddleware(googleCallbackJoiSchema as any),
  googleOAuthCallbackHandler,
);

adminRouter.use(jwtAuthMiddleware(['admin']));

adminRouter
  .get('/dashboard', requirePermission('applications', 'view'), getDashboard)
  .get(
    '/digilocker/diagnostics',
    requirePermission('applications', 'view'),
    getDigilockerPartnerDiagnosticsHandler,
  )
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
  .delete('/courses/:courseId', requirePermission('deadlines', 'delete'), deleteCourseAdmin)
  .get('/users', requirePermission('users', 'view'), validateMiddleware(listUsersQueryJoiSchema), listUsers)
  .post('/users', requirePermission('users', 'create'), validateMiddleware(createAdminUserJoiSchema), createUser)
  .patch('/users/:userId/role', requirePermission('users', 'edit'), validateMiddleware(patchUserRoleJoiSchema), patchUserRole)
  .delete('/users/:userId', requirePermission('users', 'delete'), deleteUser)
  .post(
    '/emails/promotion',
    requirePermission('users', 'edit'),
    validateMiddleware(sendPromotionEmailJoiSchema),
    sendPromotionEmail,
  )
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
  .patch(
    '/applications/:applicationId/manual-upload',
    requirePermission('applications', 'approve'),
    validateMiddleware(patchApplicationManualUploadJoiSchema),
    patchApplicationManualUpload,
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
  .get(
    '/agents/agreement-template',
    requirePermission('agent_ranking', 'view'),
    getAgentAgreementTemplate,
  )
  .post(
    '/agents/agreement-template',
    requirePermission('agent_ranking', 'approve'),
    agentAgreementUpload.single('file'),
    uploadAgentAgreementTemplate,
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
  .post('/recommendations/knowledge/sync', requirePermission('deadlines', 'edit'), syncRecommendationKnowledge)
  .patch(
    '/students/:studentProfileId/counselling',
    requirePermission('users', 'edit'),
    validateMiddleware(patchStudentCounsellingJoiSchema),
    patchStudentCounselling,
  )
  .get('/google/auth-url', requirePermission('users', 'edit'), getGoogleAuthUrlHandler)
  .get('/google/connection', requirePermission('users', 'view'), getGoogleConnectionHandler)
  .delete('/google/connection', requirePermission('users', 'edit'), deleteGoogleConnectionHandler)
  .put(
    '/scheduling/availability',
    requirePermission('users', 'edit'),
    validateMiddleware(setAvailabilityJoiSchema as any),
    putAvailabilityHandler,
  )
  .get('/scheduling/availability', requirePermission('users', 'view'), getAvailabilityHandler)
  .get('/scheduling/counsellors', requirePermission('users', 'view'), listCounsellorCalendarsHandler)
  .get('/scheduling/unavailability', requirePermission('users', 'view'), listUnavailabilityHandler)
  .post('/scheduling/unavailability', requirePermission('users', 'edit'), createUnavailabilityHandler)
  .delete('/scheduling/unavailability/:id', requirePermission('users', 'edit'), deleteUnavailabilityHandler)
  .get(
    '/scheduling/appointments',
    requirePermission('users', 'view'),
    validateMiddleware(listAdminAppointmentsJoiSchema as any),
    listAdminAppointmentsHandler,
  )
  .patch(
    '/scheduling/appointments/:appointmentId/status',
    requirePermission('users', 'edit'),
    validateMiddleware(patchAppointmentStatusJoiSchema as any),
    patchAdminAppointmentStatusHandler,
  )
  .get(
    '/verifications',
    requirePermission('users', 'view'),
    validateMiddleware(adminVerificationsListQueryJoiSchema as any),
    listAdminVerificationsHandler,
  )
  .get(
    '/verifications/:id',
    requirePermission('users', 'view'),
    validateMiddleware(adminVerificationDetailParamsJoiSchema as any),
    getAdminVerificationDetailHandler,
  )
  .post(
    '/verifications/:id/approve',
    requirePermission('users', 'edit'),
    validateMiddleware({ ...adminVerificationDetailParamsJoiSchema, ...adminVerificationActionJoiSchema } as any),
    approveAdminVerificationHandler,
  )
  .post(
    '/verifications/:id/reject',
    requirePermission('users', 'edit'),
    validateMiddleware({ ...adminVerificationDetailParamsJoiSchema, ...adminVerificationActionJoiSchema } as any),
    rejectAdminVerificationHandler,
  )
  .post(
    '/verifications/:id/request-resubmission',
    requirePermission('users', 'edit'),
    validateMiddleware({ ...adminVerificationDetailParamsJoiSchema, ...adminVerificationResubmitJoiSchema } as any),
    requestAdminVerificationResubmissionHandler,
  )
  .get(
    '/users/:userId/document-status',
    requirePermission('users', 'view'),
    validateMiddleware(adminUserDocumentStatusParamsJoiSchema as any),
    getAdminUserDocumentStatusHandler,
  )
  .get(
    '/notices',
    requirePermission('users', 'view'),
    validateMiddleware(listAdminNoticesJoiSchema as any),
    listAdminNoticesHandler,
  )
  .post(
    '/notices/sync-ai',
    requirePermission('users', 'edit'),
    syncNoticesAiHandler,
  )
  .get(
    '/activity-logs',
    listActivityLogs,
  );

export default adminRouter;
