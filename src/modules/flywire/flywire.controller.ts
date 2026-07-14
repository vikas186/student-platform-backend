import { Request, Response } from 'express';
import { catchAsyncError } from '../../../middleware/catchAsyncError';
import { applyFlywireWebhookPayload } from './flywire.service';
import type { FlywireWebhookPayload } from './flywire.types';

export const flywireWebhookHandler = catchAsyncError(async (req: Request, res: Response) => {
  const payload = (req as Request & { flywireWebhook?: FlywireWebhookPayload }).flywireWebhook;
  if (!payload) {
    res.status(400).json({ success: false, message: 'Missing webhook payload' });
    return;
  }

  void applyFlywireWebhookPayload(payload).catch(err => {
    console.error('[flywire] webhook processing failed:', err instanceof Error ? err.message : err);
  });

  res.status(200).json({ received: true });
});
