import { Request, Response } from 'express';
import { catchAsyncError } from '../middleware/catchAsyncError';
import constant from '../constant';
import * as adminPortal from '../services/adminPortal.service';
import * as rolePermissions from '../services/rolePermissions.service';
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
  const user = await adminPortal.updateUserRoleForAdmin(req.params.userId, req.body.role, actor.id || '');
  res.status(constant.msgCode.successCode).json({
    success: true,
    message: 'Role updated',
    data: { user },
  });
});

export const deleteUser = catchAsyncError(async (req: Request, res: Response) => {
  const actor = req.user as { id?: string };
  await adminPortal.deleteUserForAdmin(req.params.userId, actor.id || '');
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
  const app = await adminPortal.getApplicationForAdmin(req.params.applicationId);
  res.status(constant.msgCode.successCode).json({
    success: true,
    data: { application: app },
  });
});

export const patchApplicationStatus = catchAsyncError(async (req: Request, res: Response) => {
  const app = await adminPortal.updateApplicationStatusForAdmin(
    req.params.applicationId,
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
    req.params.applicationId,
    req.body.uiStatus,
  );
  res.status(constant.msgCode.successCode).json({
    success: true,
    message: 'Application status updated',
    data: { application: app },
  });
});

export const listUniversitiesAdmin = catchAsyncError(async (_req: Request, res: Response) => {
  const universities = await adminPortal.listUniversitiesForAdmin();
  res.status(constant.msgCode.successCode).json({
    success: true,
    data: { universities },
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
    Number(req.params.agentProfileId),
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
  await adminPortal.deleteApplicationForAdmin(req.params.applicationId);
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
  const row = await adminPortal.updateDeadlineForAdmin(Number(req.params.deadlineId), req.body);
  res.status(constant.msgCode.successCode).json({
    success: true,
    message: 'Deadline updated',
    data: { deadline: row },
  });
});

export const deleteDeadline = catchAsyncError(async (req: Request, res: Response) => {
  await adminPortal.deleteDeadlineForAdmin(Number(req.params.deadlineId));
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
  const letter = await adminPortal.uploadOfferLetterFileForAdmin(req.params.offerLetterId, file as Express.Multer.File);
  res.status(constant.msgCode.successCode).json({
    success: true,
    message: 'File uploaded',
    data: { offerLetter: letter },
  });
});

export const deleteOfferLetter = catchAsyncError(async (req: Request, res: Response) => {
  await adminPortal.deleteOfferLetterForAdmin(req.params.offerLetterId);
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
  const row = await adminPortal.updateCommissionForAdmin(Number(req.params.commissionId), req.body);
  res.status(constant.msgCode.successCode).json({
    success: true,
    message: 'Commission slab updated',
    data: { commission: row },
  });
});

export const deleteCommission = catchAsyncError(async (req: Request, res: Response) => {
  await adminPortal.deleteCommissionForAdmin(Number(req.params.commissionId));
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
  const row = await adminPortal.updateSubscriptionPlanForAdmin(Number(req.params.planId), req.body);
  res.status(constant.msgCode.successCode).json({
    success: true,
    message: 'Subscription plan updated',
    data: { plan: row },
  });
});

export const deleteSubscriptionPlan = catchAsyncError(async (req: Request, res: Response) => {
  await adminPortal.deleteSubscriptionPlanForAdmin(Number(req.params.planId));
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
  const row = await adminPortal.updateUniversityForAdmin(Number(req.params.universityId), req.body);
  res.status(constant.msgCode.successCode).json({
    success: true,
    message: 'University updated',
    data: { university: row },
  });
});

export const deleteUniversity = catchAsyncError(async (req: Request, res: Response) => {
  await adminPortal.deleteUniversityForAdmin(Number(req.params.universityId));
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
