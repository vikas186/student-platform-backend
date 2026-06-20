import { Request, Response } from 'express';
import { catchAsyncError } from '../../../middleware/catchAsyncError';
import constant from '../../../constant';
import AppError from '../../../utils/errorHandler';
import {
  applyDiditWebhookPayload,
  createDiditSessionForUser,
  getLatestVerificationStatusForUser,
} from './didit.service';

const studentUserId = (req: Request): string => {
  const user = req.user as { id?: string } | undefined;
  if (!user?.id) throw new AppError('Authenticated user id missing', 401);
  return user.id;
};

export const createDiditSessionHandler = catchAsyncError(async (req: Request, res: Response) => {
  const userId = studentUserId(req);
  const user = req.user as { email?: string } | undefined;
  const result = await createDiditSessionForUser(userId, user?.email ?? null);

  res.status(constant.msgCode.successCode).json({
    success: true,
    verificationUrl: result.verificationUrl,
    sessionId: result.sessionId,
  });
});

export const getDiditStatusHandler = catchAsyncError(async (req: Request, res: Response) => {
  const userId = studentUserId(req);
  const data = await getLatestVerificationStatusForUser(userId);

  res.status(constant.msgCode.successCode).json({
    success: true,
    data,
  });
});

export const diditWebhookHandler = catchAsyncError(async (req: Request, res: Response) => {
  const payload = (req as Request & { diditWebhook?: Record<string, unknown> }).diditWebhook;
  if (!payload) {
    res.status(400).json({ success: false, message: 'Missing webhook payload' });
    return;
  }

  // Return 2xx quickly; Didit times out after 5s
  void applyDiditWebhookPayload(payload as Parameters<typeof applyDiditWebhookPayload>[0]).catch(err => {
    console.error('[didit] webhook processing failed:', err instanceof Error ? err.message : err);
  });

  res.status(200).json({ received: true });
});
