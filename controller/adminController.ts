import { Request, Response } from 'express';
import { catchAsyncError } from '../middleware/catchAsyncError';
import constant from '../constant';
import AppError from '../utils/errorHandler';
import * as adminPortal from '../services/adminPortal.service';
import * as rolePermissions from '../services/rolePermissions.service';
import { getQueryString } from '../utils/getQueryString';
import { pickOptionalTrimmedString } from '../utils/requestFields';

export const getDashboard = catchAsyncError(async (_req: Request, res: Response) => {
  const data = await adminPortal.getDashboardForAdmin();
  res.status(constant.msgCode.successCode).json({
    success: true,
    message: 'Dashboard summary',
    data,
  });
});

export const listUsers = catchAsyncError(async (req: Request, res: Response) => {
  const result = await adminPortal.listUsersForAdmin(req.query as any);
  res.status(constant.msgCode.successCode).json({
    success: true,
    message: 'Users fetched',
    ...result,
  });
});

export const createUser = catchAsyncError(async (req: Request, res: Response) => {
  const user = await adminPortal.createUserForAdmin(req.body);
  res.status(201).json({
    success: true,
    message: 'User created',
    data: { user },
  });
});

export const patchUserRole = catchAsyncError(async (req: Request, res: Response) => {
  const actor = req.user as { id?: string };
  const user = await adminPortal.updateUserRoleForAdmin(getQueryString(req.params.userId), req.body.role, actor.id || '');
  res.status(constant.msgCode.successCode).json({
    success: true,
    message: 'Role updated',
    data: { user },
  });
});

export const deleteUser = catchAsyncError(async (req: Request, res: Response) => {
  const actor = req.user as { id?: string };
  await adminPortal.deleteUserForAdmin(getQueryString(req.params.userId), actor.id || '');
  res.status(constant.msgCode.successCode).json({
    success: true,
    message: 'User deleted',
  });
});

export const listApplications = catchAsyncError(async (req: Request, res: Response) => {
  const result = await adminPortal.listApplicationsForAdmin(req.query as any);
  res.status(constant.msgCode.successCode).json({
    success: true,
    message: 'Applications fetched',
    ...result,
  });
});

export const getApplication = catchAsyncError(async (req: Request, res: Response) => {
  const app = await adminPortal.getApplicationForAdmin(getQueryString(req.params.applicationId));
  res.status(constant.msgCode.successCode).json({
    success: true,
    data: { application: app },
  });
});

export const patchApplicationStatus = catchAsyncError(async (req: Request, res: Response) => {
  const app = await adminPortal.updateApplicationStatusForAdmin(
    getQueryString(req.params.applicationId),
    req.body.status,
  );
  res.status(constant.msgCode.successCode).json({
    success: true,
    message: 'Application status updated',
    data: { application: app },
  });
});

export const getApplicationStatusOptions = catchAsyncError(async (_req: Request, res: Response) => {
  const options = adminPortal.getApplicationStatusOptionsForAdmin();
  res.status(constant.msgCode.successCode).json({
    success: true,
    data: { options },
  });
});

export const patchApplicationStatusUi = catchAsyncError(async (req: Request, res: Response) => {
  const app = await adminPortal.updateApplicationStatusFromUiForAdmin(
    getQueryString(req.params.applicationId),
    req.body.uiStatus,
  );
  res.status(constant.msgCode.successCode).json({
    success: true,
    message: 'Application status updated',
    data: { application: app },
  });
});

export const listUniversitiesAdmin = catchAsyncError(async (req: Request, res: Response) => {
  const result = await adminPortal.listUniversitiesForAdmin(req.query as Record<string, unknown>);
  res.status(constant.msgCode.successCode).json({
    success: true,
    data: result,
  });
});

export const importUniversityCatalog = catchAsyncError(async (req: Request, res: Response) => {
  const file = req.file as Express.Multer.File | undefined;
  if (!file) {
    throw new AppError('Catalog file is required (field name: file). Use .xlsx, .xls, or .csv.', 400);
  }
  const result = await adminPortal.importUniversityCatalogFileForAdmin(file);
  res.status(constant.msgCode.successCode).json({
    success: true,
    message: result.message,
    data: result,
  });
});

export const importUniversityCoursesCsv = catchAsyncError(async (req: Request, res: Response) => {
  const uid = Number(getQueryString(req.params.universityId));
  const file = req.file as Express.Multer.File | undefined;
  if (!file) {
    throw new AppError('CSV file is required (field name: file)', 400);
  }
  const result = await adminPortal.importUniversityCoursesCsvForAdmin(uid, file);
  res.status(constant.msgCode.successCode).json({
    success: true,
    message: result.message,
    data: result,
  });
});

export const listCoursesAdmin = catchAsyncError(async (req: Request, res: Response) => {
  const uid = Number((req.query as any).universityId);
  const courses = await adminPortal.listCoursesForAdmin(uid);
  res.status(constant.msgCode.successCode).json({
    success: true,
    data: { courses },
  });
});

export const createCourseAdmin = catchAsyncError(async (req: Request, res: Response) => {
  const course = await adminPortal.createCourseForAdmin(req.body);
  res.status(201).json({
    success: true,
    message: 'Course created',
    data: { course },
  });
});

export const patchCourseAdmin = catchAsyncError(async (req: Request, res: Response) => {
  const courseId = Number(getQueryString(req.params.courseId));
  const course = await adminPortal.patchCourseForAdmin(courseId, req.body);
  res.status(constant.msgCode.successCode).json({
    success: true,
    message: 'Course updated',
    data: { course },
  });
});

export const createIntakeRow = catchAsyncError(async (req: Request, res: Response) => {
  const deadline = await adminPortal.createIntakeRowForAdmin(req.body);
  res.status(201).json({
    success: true,
    message: 'Intake row created',
    data: { deadline },
  });
});

export const uploadOfferLetterByMatch = catchAsyncError(async (req: Request, res: Response) => {
  const file = req.file as Express.Multer.File | undefined;
  const body = req.body as Record<string, unknown>;
  const applicationId =
    pickOptionalTrimmedString(body, ['applicationId', 'application_id', 'applicationNumber']) ?? undefined;
  const studentEmail = pickOptionalTrimmedString(body, ['studentEmail', 'student_email', 'email']) ?? undefined;
  const studentName =
    pickOptionalTrimmedString(body, ['studentName', 'student_name', 'fullName', 'name']) ?? '';
  const program =
    pickOptionalTrimmedString(body, ['program', 'programName', 'course', 'courseName', 'degree']) ?? '';
  const university =
    pickOptionalTrimmedString(body, ['university', 'universityName', 'uni', 'school', 'institution']) ?? '';
  const letter = await adminPortal.uploadOfferLetterByMatchForAdmin(file as Express.Multer.File, {
    studentName,
    program,
    university,
    applicationId,
    studentEmail,
  });
  res.status(constant.msgCode.successCode).json({
    success: true,
    message: 'Offer letter uploaded',
    data: { offerLetter: letter },
  });
});

export const createCommissionRich = catchAsyncError(async (req: Request, res: Response) => {
  const commission = await adminPortal.createCommissionSlabRichForAdmin(req.body);
  res.status(201).json({
    success: true,
    message: 'Commission slab created',
    data: { commission },
  });
});

export const patchAgentSubscription = catchAsyncError(async (req: Request, res: Response) => {
  const agent = await adminPortal.patchAgentSubscriptionForAdmin(
    Number(getQueryString(req.params.agentProfileId)),
    req.body.subscriptionPlanId === undefined || req.body.subscriptionPlanId === ''
      ? null
      : Number(req.body.subscriptionPlanId),
  );
  res.status(constant.msgCode.successCode).json({
    success: true,
    message: 'Agent subscription updated',
    data: { agent },
  });
});

export const deleteApplication = catchAsyncError(async (req: Request, res: Response) => {
  await adminPortal.deleteApplicationForAdmin(getQueryString(req.params.applicationId));
  res.status(constant.msgCode.successCode).json({
    success: true,
    message: 'Application deleted',
  });
});

export const listDeadlines = catchAsyncError(async (req: Request, res: Response) => {
  const result = await adminPortal.listDeadlinesForAdmin(req.query as any);
  res.status(constant.msgCode.successCode).json({
    success: true,
    message: 'Deadlines fetched',
    ...result,
  });
});

export const createDeadline = catchAsyncError(async (req: Request, res: Response) => {
  const row = await adminPortal.createDeadlineForAdmin(req.body);
  res.status(201).json({
    success: true,
    message: 'Deadline created',
    data: { deadline: row },
  });
});

export const patchDeadline = catchAsyncError(async (req: Request, res: Response) => {
  const row = await adminPortal.updateDeadlineForAdmin(Number(getQueryString(req.params.deadlineId)), req.body);
  res.status(constant.msgCode.successCode).json({
    success: true,
    message: 'Deadline updated',
    data: { deadline: row },
  });
});

export const deleteDeadline = catchAsyncError(async (req: Request, res: Response) => {
  await adminPortal.deleteDeadlineForAdmin(Number(getQueryString(req.params.deadlineId)));
  res.status(constant.msgCode.successCode).json({
    success: true,
    message: 'Deadline deleted',
  });
});

export const listOfferLetters = catchAsyncError(async (req: Request, res: Response) => {
  const rows = await adminPortal.listOfferLettersForAdmin(req.query as any);
  res.status(constant.msgCode.successCode).json({
    success: true,
    message: 'Offer letters fetched',
    data: rows,
  });
});

export const createOfferLetter = catchAsyncError(async (req: Request, res: Response) => {
  const letter = await adminPortal.createOfferLetterForAdmin(req.body);
  res.status(201).json({
    success: true,
    message: 'Offer letter created',
    data: { offerLetter: letter },
  });
});

export const uploadOfferLetterFile = catchAsyncError(async (req: Request, res: Response) => {
  const file = req.file as Express.Multer.File | undefined;
  const letter = await adminPortal.uploadOfferLetterFileForAdmin(
    getQueryString(req.params.offerLetterId),
    file as Express.Multer.File,
  );
  res.status(constant.msgCode.successCode).json({
    success: true,
    message: 'File uploaded',
    data: { offerLetter: letter },
  });
});

export const deleteOfferLetter = catchAsyncError(async (req: Request, res: Response) => {
  await adminPortal.deleteOfferLetterForAdmin(getQueryString(req.params.offerLetterId));
  res.status(constant.msgCode.successCode).json({
    success: true,
    message: 'Offer letter deleted',
  });
});

export const listAgents = catchAsyncError(async (req: Request, res: Response) => {
  const result = await adminPortal.listAgentsForAdmin(req.query as any);
  res.status(constant.msgCode.successCode).json({
    success: true,
    message: 'Agents fetched',
    data: result.agents,
    meta: {
      page: result.page,
      limit: result.limit,
      total: result.total,
    },
  });
});

export const listPayments = catchAsyncError(async (req: Request, res: Response) => {
  const result = await adminPortal.listPaymentsForAdmin(req.query as any);
  res.status(constant.msgCode.successCode).json({
    success: true,
    message: 'Payments fetched',
    ...result,
  });
});

export const listAgentAgreements = catchAsyncError(async (req: Request, res: Response) => {
  const result = await adminPortal.listAgentAgreementsForAdmin(req.query as any);
  res.status(constant.msgCode.successCode).json({
    success: true,
    message: 'Agent agreements fetched',
    data: result.agreements,
    meta: { page: result.page, limit: result.limit, total: result.total, status: result.status },
  });
});

export const approveAgentAgreement = catchAsyncError(async (req: Request, res: Response) => {
  const actor = req.user as { id?: string };
  const id = Number(getQueryString(req.params.agentProfileId));
  if (!Number.isFinite(id) || id < 1) {
    throw new AppError('Invalid agent profile id', 400);
  }
  const data = await adminPortal.approveAgentAgreement(id, actor.id || '');
  res.status(constant.msgCode.successCode).json({
    success: true,
    message: 'Agreement approved',
    data,
  });
});

export const rejectAgentAgreement = catchAsyncError(async (req: Request, res: Response) => {
  const actor = req.user as { id?: string };
  const id = Number(getQueryString(req.params.agentProfileId));
  if (!Number.isFinite(id) || id < 1) {
    throw new AppError('Invalid agent profile id', 400);
  }
  const reason = pickOptionalTrimmedString(req.body as Record<string, unknown>, ['reason']) ?? null;
  const data = await adminPortal.rejectAgentAgreement(id, actor.id || '', reason);
  res.status(constant.msgCode.successCode).json({
    success: true,
    message: 'Agreement rejected',
    data,
  });
});

export const deleteAgentAgreement = catchAsyncError(async (req: Request, res: Response) => {
  const id = Number(getQueryString(req.params.agentProfileId));
  if (!Number.isFinite(id) || id < 1) {
    throw new AppError('Invalid agent profile id', 400);
  }
  const data = await adminPortal.deleteAgentAgreement(id);
  res.status(constant.msgCode.successCode).json({
    success: true,
    message: 'Agreement removed; agent must upload and obtain approval again',
    data,
  });
});

export const listCommissions = catchAsyncError(async (_req: Request, res: Response) => {
  const rows = await adminPortal.listCommissionsForAdmin();
  res.status(constant.msgCode.successCode).json({
    success: true,
    message: 'Commission slabs fetched',
    data: rows,
  });
});

export const createCommission = catchAsyncError(async (req: Request, res: Response) => {
  const row = await adminPortal.createCommissionForAdmin(req.body);
  res.status(201).json({
    success: true,
    message: 'Commission slab created',
    data: { commission: row },
  });
});

export const patchCommission = catchAsyncError(async (req: Request, res: Response) => {
  const row = await adminPortal.updateCommissionForAdmin(Number(getQueryString(req.params.commissionId)), req.body);
  res.status(constant.msgCode.successCode).json({
    success: true,
    message: 'Commission slab updated',
    data: { commission: row },
  });
});

export const deleteCommission = catchAsyncError(async (req: Request, res: Response) => {
  await adminPortal.deleteCommissionForAdmin(Number(getQueryString(req.params.commissionId)));
  res.status(constant.msgCode.successCode).json({
    success: true,
    message: 'Commission slab deleted',
  });
});

export const listSubscriptionPlans = catchAsyncError(async (_req: Request, res: Response) => {
  const rows = await adminPortal.listSubscriptionPlansForAdmin();
  res.status(constant.msgCode.successCode).json({
    success: true,
    message: 'Subscription plans fetched',
    data: rows,
  });
});

export const createSubscriptionPlan = catchAsyncError(async (req: Request, res: Response) => {
  const row = await adminPortal.createSubscriptionPlanForAdmin(req.body);
  res.status(201).json({
    success: true,
    message: 'Subscription plan created',
    data: { plan: row },
  });
});

export const patchSubscriptionPlan = catchAsyncError(async (req: Request, res: Response) => {
  const row = await adminPortal.updateSubscriptionPlanForAdmin(Number(getQueryString(req.params.planId)), req.body);
  res.status(constant.msgCode.successCode).json({
    success: true,
    message: 'Subscription plan updated',
    data: { plan: row },
  });
});

export const deleteSubscriptionPlan = catchAsyncError(async (req: Request, res: Response) => {
  await adminPortal.deleteSubscriptionPlanForAdmin(Number(getQueryString(req.params.planId)));
  res.status(constant.msgCode.successCode).json({
    success: true,
    message: 'Subscription plan deleted',
  });
});

export const createUniversity = catchAsyncError(async (req: Request, res: Response) => {
  const row = await adminPortal.createUniversityForAdmin(req.body);
  res.status(201).json({
    success: true,
    message: 'University created',
    data: { university: row },
  });
});

export const patchUniversity = catchAsyncError(async (req: Request, res: Response) => {
  const row = await adminPortal.updateUniversityForAdmin(Number(getQueryString(req.params.universityId)), req.body);
  res.status(constant.msgCode.successCode).json({
    success: true,
    message: 'University updated',
    data: { university: row },
  });
});

export const deleteUniversity = catchAsyncError(async (req: Request, res: Response) => {
  const id = Number(getQueryString(req.params.universityId));
  if (!Number.isFinite(id) || id < 1) {
    throw new AppError('Invalid university id', 400);
  }
  await adminPortal.deleteUniversityForAdmin(id);
  res.status(constant.msgCode.successCode).json({
    success: true,
    message: 'University deleted',
  });
});

export const globalSearch = catchAsyncError(async (req: Request, res: Response) => {
  const data = await adminPortal.adminGlobalSearch(String((req.query as any).q || ''));
  res.status(constant.msgCode.successCode).json({
    success: true,
    data,
  });
});

export const getRolesMetadata = catchAsyncError(async (_req: Request, res: Response) => {
  const data = adminPortal.getRolesMetadataForAdmin();
  res.status(constant.msgCode.successCode).json({
    success: true,
    data,
  });
});

export const getPermissionsMatrix = catchAsyncError(async (_req: Request, res: Response) => {
  const data = await rolePermissions.getPermissionMatrixForAdmin();
  res.status(constant.msgCode.successCode).json({
    success: true,
    message: 'Permission matrix',
    data,
  });
});

export const putPermissionsMatrix = catchAsyncError(async (req: Request, res: Response) => {
  const data = await rolePermissions.replacePermissionMatrixForAdmin(req.body.matrix);
  res.status(constant.msgCode.successCode).json({
    success: true,
    message: 'Permissions updated',
    data,
  });
});

export const resetPermissionsMatrix = catchAsyncError(async (_req: Request, res: Response) => {
  const data = await rolePermissions.resetPermissionMatrixToDefaults();
  res.status(constant.msgCode.successCode).json({
    success: true,
    message: 'Permissions reset to defaults',
    data,
  });
});

export const syncChatKnowledge = catchAsyncError(async (_req: Request, res: Response) => {
  const data = await adminPortal.syncChatKnowledgeForAdmin();
  res.status(constant.msgCode.successCode).json({
    success: true,
    message: 'Knowledge base synced',
    data,
  });
});

export const syncRecommendationKnowledge = catchAsyncError(async (_req: Request, res: Response) => {
  const data = await adminPortal.syncRecommendationKnowledgeForAdmin();
  res.status(constant.msgCode.successCode).json({
    success: true,
    message: 'Recommendation knowledge base synced',
    data,
  });
});

export const patchStudentCounselling = catchAsyncError(async (req: Request, res: Response) => {
  const id = Number(getQueryString(req.params.studentProfileId));
  if (!Number.isFinite(id) || id < 1) {
    throw new AppError('Invalid student profile id', 400);
  }
  const { counsellingCompleted } = req.body as { counsellingCompleted: boolean };
  const row = await adminPortal.patchStudentCounsellingForAdmin(id, counsellingCompleted);
  res.status(constant.msgCode.successCode).json({
    success: true,
    message: 'Student counselling flag updated',
    data: { studentProfile: row },
  });
});
