import { Request, Response } from 'express';
import { catchAsyncError } from '../../../middleware/catchAsyncError';
import constant from '../../../constant';
import AppError from '../../../utils/errorHandler';
import { getDocumentStatusSummaryForUser, listStudentVerifications } from './document-status.service';
import {
  approveVerification,
  getAdminVerificationDetail,
  listAdminVerifications,
  rejectVerification,
  requestVerificationResubmission,
} from './admin-verification.service';

const studentUserId = (req: Request): string => {
  const user = req.user as { id?: string } | undefined;
  if (!user?.id) throw new AppError('Authenticated user id missing', 401);
  return user.id;
};

const adminUserId = (req: Request): string => {
  const user = req.user as { id?: string } | undefined;
  if (!user?.id) throw new AppError('Authenticated admin id missing', 401);
  return user.id;
};

export const getStudentDocumentStatusHandler = catchAsyncError(async (req: Request, res: Response) => {
  const userId = studentUserId(req);
  const data = await getDocumentStatusSummaryForUser(userId);
  res.status(constant.msgCode.successCode).json({ success: true, data });
});

export const listStudentVerificationsHandler = catchAsyncError(async (req: Request, res: Response) => {
  const userId = studentUserId(req);
  const data = await listStudentVerifications(userId);
  res.status(constant.msgCode.successCode).json({ success: true, data });
});

export const listAdminVerificationsHandler = catchAsyncError(async (req: Request, res: Response) => {
  const query = req.query as Record<string, string>;
  const result = await listAdminVerifications({
    category: query.category,
    status: query.status,
    userId: query.userId,
    q: query.q,
    page: query.page ? Number(query.page) : 1,
    limit: query.limit ? Number(query.limit) : 20,
  });
  res.status(constant.msgCode.successCode).json({ success: true, ...result });
});

export const getAdminVerificationDetailHandler = catchAsyncError(async (req: Request, res: Response) => {
  const registryId = String(req.params.id ?? '');
  const data = await getAdminVerificationDetail(registryId);
  res.status(constant.msgCode.successCode).json({ success: true, data });
});

export const approveAdminVerificationHandler = catchAsyncError(async (req: Request, res: Response) => {
  const registryId = String(req.params.id ?? '');
  const body = req.body as { notes?: string };
  const record = await approveVerification(registryId, adminUserId(req), body.notes);
  res.status(constant.msgCode.successCode).json({ success: true, message: 'Verification approved', data: record });
});

export const rejectAdminVerificationHandler = catchAsyncError(async (req: Request, res: Response) => {
  const registryId = String(req.params.id ?? '');
  const body = req.body as { notes?: string; reason?: string };
  const notes = body.notes ?? body.reason;
  const record = await rejectVerification(registryId, adminUserId(req), notes);
  res.status(constant.msgCode.successCode).json({ success: true, message: 'Verification rejected', data: record });
});

export const requestAdminVerificationResubmissionHandler = catchAsyncError(
  async (req: Request, res: Response) => {
    const registryId = String(req.params.id ?? '');
    const body = req.body as { notes: string };
    const record = await requestVerificationResubmission(registryId, adminUserId(req), body.notes);
    res.status(constant.msgCode.successCode).json({
      success: true,
      message: 'Resubmission requested',
      data: record,
    });
  },
);

export const getAdminUserDocumentStatusHandler = catchAsyncError(async (req: Request, res: Response) => {
  const userId = String(req.params.userId ?? '');
  const data = await getDocumentStatusSummaryForUser(userId);
  res.status(constant.msgCode.successCode).json({ success: true, data });
});
