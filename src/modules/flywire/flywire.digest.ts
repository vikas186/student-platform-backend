import crypto from 'crypto';

/** HMAC-SHA256 → Base64 for Flywire `X-Flywire-Digest` (outbound requests + inbound webhooks). */
export const createFlywireDigest = (sharedSecret: string, messageBody: string): string => {
  return crypto.createHmac('sha256', sharedSecret).update(messageBody, 'utf8').digest('base64');
};

export const verifyFlywireDigest = (
  sharedSecret: string,
  messageBody: string,
  headerDigest: string,
): boolean => {
  const expected = createFlywireDigest(sharedSecret, messageBody);
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(headerDigest.trim(), 'utf8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};
