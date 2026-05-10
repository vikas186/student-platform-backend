import { Request, Response } from 'express';
import constant from '../../../constant';
import AppError from '../../../utils/errorHandler';
import { catchAsyncError } from '../../../middleware/catchAsyncError';
import * as chatService from './chat.service';
import type { UserRole } from '../../../models/User.model';

const chatUser = (req: Request) => {
  const u = req.user as { id?: string; role?: UserRole } | undefined;
  if (!u?.id || !u.role) {
    throw new AppError('Unauthorized', 401);
  }
  return { id: u.id, role: u.role };
};

export const postMessage = catchAsyncError(async (req: Request, res: Response) => {
  const user = chatUser(req);
  const body = req.body as { sessionId?: string; message: string };
  const data = await chatService.postMessage(user, body);
  res.status(constant.msgCode.successCode).json({
    success: true,
    message: 'Reply generated',
    data,
  });
});

export const getHistory = catchAsyncError(async (req: Request, res: Response) => {
  const user = chatUser(req);
  const q = req.query as unknown as { sessionId: string; limit?: number; cursor?: string };
  const data = await chatService.getHistory(user.id, {
    sessionId: q.sessionId,
    limit: Number(q.limit) || 50,
    cursor: q.cursor,
  });
  res.status(constant.msgCode.successCode).json({
    success: true,
    message: 'Chat history',
    data,
  });
});

export const deleteHistory = catchAsyncError(async (req: Request, res: Response) => {
  const user = chatUser(req);
  const q = req.query as { sessionId?: string; all?: string };
  const all = String(q.all || '').toLowerCase() === 'true';
  if (!all && !q.sessionId) {
    throw new AppError('Provide sessionId or all=true', 400);
  }
  await chatService.deleteHistory(user.id, q.sessionId, all);
  res.status(constant.msgCode.successCode).json({
    success: true,
    message: 'Chat history deleted',
  });
});

export const postFeedback = catchAsyncError(async (req: Request, res: Response) => {
  const user = chatUser(req);
  const body = req.body as { messageId: number; rating: number; comment?: string | null };
  await chatService.postFeedback(user.id, body);
  res.status(constant.msgCode.successCode).json({
    success: true,
    message: 'Feedback saved',
  });
});
