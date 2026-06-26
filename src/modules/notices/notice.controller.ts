import { Request, Response } from 'express';
import constant from '../../../constant';
import { catchAsyncError } from '../../../middleware/catchAsyncError';
import { syncNoticesFromAi } from './notice-ai.service';
import * as noticeService from './notice.service';

export const listActiveNoticesHandler = catchAsyncError(async (_req: Request, res: Response) => {
  const data = await noticeService.listActiveNotices();
  res.status(constant.msgCode.successCode).json({ success: true, data });
});

export const listAdminNoticesHandler = catchAsyncError(async (req: Request, res: Response) => {
  await noticeService.purgeNoticesOlderThanRetention();
  const q = req.query as Record<string, string>;
  const result = await noticeService.listAdminNotices({
    q: q.q,
    includeInactive: String(q.includeInactive || '').toLowerCase() === 'true',
    page: q.page ? Number(q.page) : 1,
    limit: q.limit ? Number(q.limit) : 50,
  });
  res.status(constant.msgCode.successCode).json({ success: true, ...result });
});

export const syncNoticesAiHandler = catchAsyncError(async (_req: Request, res: Response) => {
  const data = await syncNoticesFromAi();
  res.status(constant.msgCode.successCode).json({
    success: true,
    message: 'Notice AI sync completed',
    data,
  });
});
