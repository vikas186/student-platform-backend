import { randomUUID } from 'crypto';
import { db } from '../../../config/database';
import AppError from '../../../utils/errorHandler';
import { assertFlywireConfigured, flywireConfig } from './flywire.config';
import { createFlywireJsonLink, toFlywireSubunits } from './flywire.client';
import type { CreateFlywirePayLinkInput, FlywireWebhookPayload } from './flywire.types';

const SUCCESS_STATUSES = new Set(['guaranteed', 'delivered', 'processed']);
const FAILED_STATUSES = new Set(['cancelled', 'canceled', 'failed', 'unpaid', 'reversed']);

const splitName = (fullName: string | null | undefined): { first: string; last: string } => {
  const parts = (fullName || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first: 'Student', last: 'Payer' };
  if (parts.length === 1) return { first: parts[0], last: parts[0] };
  return { first: parts[0], last: parts.slice(1).join(' ') };
};

export const resolveFlywirePaymentDestination = async (application: {
  course?: { university?: { flywirePaymentDestination?: string | null } | null } | null;
  universityName?: string | null;
}): Promise<string> => {
  const fromCourse = application.course?.university?.flywirePaymentDestination?.trim();
  if (fromCourse) return fromCourse;

  const uniName = application.universityName?.trim();
  if (uniName) {
    const uni = await db.University.findOne({
      where: { name: uniName },
      attributes: ['id', 'flywirePaymentDestination'],
    });
    const dest = (uni as { flywirePaymentDestination?: string | null } | null)
      ?.flywirePaymentDestination?.trim();
    if (dest) return dest;
  }

  const fallback = flywireConfig().paymentDestination;
  if (!fallback) {
    throw new AppError(
      'Flywire payment destination is not configured. Set FLYWIRE_PAYMENT_DESTINATION or university.flywirePaymentDestination.',
      503,
    );
  }
  return fallback;
};

export const createFlywirePayLink = async (input: CreateFlywirePayLinkInput) => {
  assertFlywireConfigured();
  const c = flywireConfig();

  const amountMajor = typeof input.amount === 'number' ? input.amount : Number(input.amount);
  if (!Number.isFinite(amountMajor) || amountMajor <= 0) {
    throw new AppError('Amount must be a positive number', 400);
  }

  const externalRef = `uniwizer-${randomUUID()}`;
  const subunits = toFlywireSubunits(amountMajor);
  const names = splitName(
    [input.payerFirstName, input.payerLastName].filter(Boolean).join(' ') || input.payerFirstName,
  );
  const first = input.payerFirstName?.trim() || names.first;
  const last = input.payerLastName?.trim() || names.last;
  const country = (input.payerCountry || 'IN').trim().toUpperCase().slice(0, 2) || 'IN';
  const email = input.studentEmail?.trim() || undefined;
  const returnUrl = input.returnUrl?.trim() || c.frontendUrl;

  const payment = await db.Payment.create({
    userId: input.userId,
    applicationId: input.applicationId,
    agentProfileId: input.agentProfileId ?? null,
    amount: amountMajor,
    type: input.type,
    currency: (input.currency || 'USD').toUpperCase().slice(0, 8),
    studentEmail: email || null,
    status: 'pending',
    payLink: null,
    gateway: 'flywire',
    gatewayExternalRef: externalRef,
    gatewayPaymentId: null,
  });

  try {
    const { url } = await createFlywireJsonLink({
      provider: 'PayByJSON',
      payment_destination: input.paymentDestination,
      amount: subunits,
      max_amount: subunits,
      country,
      sender_email: email,
      sender_first_name: first,
      sender_last_name: last,
      allow_to_edit_payer_information: true,
      callback_url: c.callbackUrl,
      callback_id: externalRef,
      callback_version: '2',
      return_cta: returnUrl,
      return_cta_name: 'Return to Uniwizer',
      days_to_expire: '30',
    });

    payment.payLink = url;
    await payment.save();
    return payment;
  } catch (err) {
    payment.status = 'failed';
    await payment.save().catch(() => undefined);
    throw err;
  }
};

const mapFlywireStatus = (
  eventType: string | undefined,
  dataStatus: string | undefined,
): 'pending' | 'success' | 'failed' | null => {
  const candidates = [dataStatus, eventType]
    .filter((s): s is string => Boolean(s))
    .map(s => s.trim().toLowerCase());

  for (const s of candidates) {
    if (SUCCESS_STATUSES.has(s)) return 'success';
    if (FAILED_STATUSES.has(s)) return 'failed';
  }
  return null;
};

export const applyFlywireWebhookPayload = async (payload: FlywireWebhookPayload): Promise<void> => {
  const data = payload.data || {};
  const externalRef =
    (typeof data.external_reference === 'string' && data.external_reference.trim()) ||
    (typeof (payload as { external_reference?: string }).external_reference === 'string' &&
      (payload as { external_reference: string }).external_reference.trim()) ||
    null;

  if (!externalRef) {
    console.warn('[flywire] webhook missing external_reference / callback_id mapping');
    return;
  }

  const payment = await db.Payment.findOne({ where: { gatewayExternalRef: externalRef } });
  if (!payment) {
    console.warn(`[flywire] webhook: no payment for ref ${externalRef}`);
    return;
  }

  const flywirePaymentId =
    (typeof data.payment_id === 'string' && data.payment_id) ||
    (typeof data.payment_id === 'number' ? String(data.payment_id) : null);

  if (flywirePaymentId && !payment.gatewayPaymentId) {
    payment.gatewayPaymentId = flywirePaymentId;
  }

  const mapped = mapFlywireStatus(payload.event_type, typeof data.status === 'string' ? data.status : undefined);

  if (mapped === 'success') {
    if (payment.status !== 'success') {
      payment.status = 'success';
      await payment.save();
    } else if (flywirePaymentId && payment.changed('gatewayPaymentId')) {
      await payment.save();
    }
    return;
  }

  if (mapped === 'failed') {
    if (payment.status === 'success') {
      // Do not downgrade a successful payment from a later failure event unless reversed.
      const isReverse = [payload.event_type, data.status]
        .filter((s): s is string => typeof s === 'string')
        .some(s => s.toLowerCase() === 'reversed');
      if (isReverse) {
        payment.status = 'failed';
        await payment.save();
      } else if (payment.changed('gatewayPaymentId')) {
        await payment.save();
      }
      return;
    }
    payment.status = 'failed';
    await payment.save();
    return;
  }

  // Intermediate statuses (initiated, authorized, …) — keep pending, store Flywire id
  if (payment.changed('gatewayPaymentId')) {
    await payment.save();
  }
};
