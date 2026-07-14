import AppError from '../../../utils/errorHandler';
import { flywireConfig } from './flywire.config';
import { createFlywireDigest } from './flywire.digest';
import type { FlywireJsonLinkRequest } from './flywire.types';

export interface FlywireJsonLinkResult {
  url: string;
  raw: Record<string, unknown>;
}

export const createFlywireJsonLink = async (
  body: FlywireJsonLinkRequest,
): Promise<FlywireJsonLinkResult> => {
  const c = flywireConfig();
  const bodyString = JSON.stringify(body);
  const digest = createFlywireDigest(c.sharedSecret, bodyString);

  let res: Response;
  try {
    res = await fetch(c.gatewayUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Flywire-Digest': digest,
      },
      body: bodyString,
    });
  } catch (err) {
    throw new AppError(
      `Flywire gateway unreachable: ${err instanceof Error ? err.message : String(err)}`,
      502,
    );
  }

  const text = await res.text();
  let parsed: Record<string, unknown> = {};
  try {
    parsed = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    parsed = { raw: text };
  }

  if (!res.ok) {
    const msg =
      (typeof parsed.message === 'string' && parsed.message) ||
      (typeof parsed.error === 'string' && parsed.error) ||
      text.slice(0, 300) ||
      `Flywire link creation failed (${res.status})`;
    throw new AppError(msg, 502);
  }

  const url =
    (typeof parsed.url === 'string' && parsed.url) ||
    (typeof (parsed as { link?: string }).link === 'string' && (parsed as { link: string }).link) ||
    null;

  if (!url) {
    throw new AppError('Flywire response did not include a payment URL', 502);
  }

  return { url, raw: parsed };
};

/** Convert major-unit amount (e.g. 50.00 USD) to Flywire subunits (cents). */
export const toFlywireSubunits = (amountMajor: number): number => {
  if (!Number.isFinite(amountMajor) || amountMajor <= 0) {
    throw new AppError('Amount must be a positive number', 400);
  }
  return Math.round(amountMajor * 100);
};
