import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { diditConfig } from '../src/modules/didit/didit.config';

/** Match Didit float normalisation: whole-valued floats serialise as ints. */
const shortenFloats = (data: unknown): unknown => {
  if (Array.isArray(data)) return data.map(shortenFloats);
  if (data !== null && typeof data === 'object') {
    return Object.fromEntries(
      Object.entries(data as Record<string, unknown>).map(([key, value]) => [key, shortenFloats(value)]),
    );
  }
  if (typeof data === 'number' && Number.isFinite(data) && data % 1 === 0) {
    return Math.trunc(data);
  }
  return data;
};

const sortKeys = (obj: unknown): unknown => {
  if (Array.isArray(obj)) return obj.map(sortKeys);
  if (obj !== null && typeof obj === 'object') {
    return Object.keys(obj as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = sortKeys((obj as Record<string, unknown>)[key]);
        return acc;
      }, {});
  }
  return obj;
};

const verifySignatureV2 = (
  rawBody: string,
  signatureV2: string,
  timestamp: string,
  secret: string,
): boolean => {
  const now = Math.floor(Date.now() / 1000);
  const ts = parseInt(timestamp, 10);
  if (!Number.isFinite(ts) || Math.abs(now - ts) > 300) return false;

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return false;
  }

  const canonical = JSON.stringify(sortKeys(shortenFloats(parsed)));
  const expected = crypto.createHmac('sha256', secret).update(canonical, 'utf8').digest('hex');

  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(signatureV2, 'utf8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

/**
 * Verify Didit webhook HMAC (X-Signature-V2).
 * Docs: https://docs.didit.me/integration/webhooks
 * Must run on express.raw({ type: 'application/json' }) body.
 */
export const verifyDiditWebhook = (req: Request, res: Response, next: NextFunction): void => {
  const secret = diditConfig().webhookSecret;
  if (!secret) {
    console.error('[didit] DIDIT_WEBHOOK_SECRET is not set');
    res.status(500).json({ success: false, message: 'Webhook not configured' });
    return;
  }

  const signature = req.get('X-Signature-V2') ?? req.get('x-signature-v2');
  const timestamp = req.get('X-Timestamp') ?? req.get('x-timestamp');

  if (!signature || !timestamp) {
    res.status(401).json({ success: false, message: 'Missing signature headers' });
    return;
  }

  const rawBody =
    Buffer.isBuffer(req.body) ? req.body.toString('utf8') : typeof req.body === 'string' ? req.body : '';

  if (!rawBody) {
    res.status(400).json({ success: false, message: 'Empty webhook body' });
    return;
  }

  if (!verifySignatureV2(rawBody, signature, timestamp, secret)) {
    console.warn('[didit] webhook signature verification failed');
    res.status(401).json({ success: false, message: 'Invalid signature' });
    return;
  }

  try {
    (req as Request & { diditWebhook?: Record<string, unknown> }).diditWebhook = JSON.parse(rawBody) as Record<
      string,
      unknown
    >;
    next();
  } catch {
    res.status(400).json({ success: false, message: 'Invalid JSON body' });
  }
};
