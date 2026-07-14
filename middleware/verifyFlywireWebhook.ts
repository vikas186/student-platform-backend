import { Request, Response, NextFunction } from 'express';
import { flywireConfig } from '../src/modules/flywire/flywire.config';
import { verifyFlywireDigest } from '../src/modules/flywire/flywire.digest';
import type { FlywireWebhookPayload } from '../src/modules/flywire/flywire.types';

/**
 * Verify Flywire webhook HMAC (`X-Flywire-Digest`).
 * Must run on express.raw({ type: 'application/json' }) body.
 */
export const verifyFlywireWebhook = (req: Request, res: Response, next: NextFunction): void => {
  const secret = flywireConfig().sharedSecret;
  if (!secret) {
    console.error('[flywire] FLYWIRE_SHARED_SECRET is not set');
    res.status(500).json({ success: false, message: 'Webhook not configured' });
    return;
  }

  const digest = req.get('X-Flywire-Digest') ?? req.get('x-flywire-digest');
  if (!digest) {
    res.status(401).json({ success: false, message: 'Missing X-Flywire-Digest header' });
    return;
  }

  const rawBody =
    Buffer.isBuffer(req.body) ? req.body.toString('utf8') : typeof req.body === 'string' ? req.body : '';

  if (!rawBody) {
    res.status(400).json({ success: false, message: 'Empty webhook body' });
    return;
  }

  if (!verifyFlywireDigest(secret, rawBody, digest)) {
    console.warn('[flywire] webhook digest verification failed');
    res.status(401).json({ success: false, message: 'Invalid digest' });
    return;
  }

  try {
    (req as Request & { flywireWebhook?: FlywireWebhookPayload }).flywireWebhook = JSON.parse(
      rawBody,
    ) as FlywireWebhookPayload;
    next();
  } catch {
    res.status(400).json({ success: false, message: 'Invalid JSON body' });
  }
};
