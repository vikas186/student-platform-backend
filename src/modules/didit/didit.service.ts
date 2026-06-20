import axios, { AxiosError } from 'axios';
import { db } from '../../../config/database';
import AppError from '../../../utils/errorHandler';
import { assertDiditConfigured, diditConfig } from './didit.config';
import type {
  DiditCreateSessionResponse,
  DiditInternalStatus,
  DiditWebhookPayload,
  VerificationStatusDto,
} from './didit.types';

/** Map Didit session status strings to internal UI statuses. */
export const mapDiditStatusToInternal = (diditStatus: string | undefined | null): DiditInternalStatus => {
  const s = (diditStatus ?? '').trim();
  if (!s || s === 'Not Started') return 'not_started';
  if (s === 'Approved') return 'verified';
  if (s === 'Declined') return 'rejected';
  if (s === 'Abandoned' || s === 'Expired' || s === 'Kyc Expired') return 'failed';
  return 'pending';
};

const extractDocumentType = (payload: DiditWebhookPayload): string | null => {
  const doc = payload.decision?.id_verifications?.[0]?.document_type;
  return typeof doc === 'string' && doc.trim() ? doc.trim() : null;
};

const toStatusDto = (row: {
  id: string;
  status: string;
  verificationUrl?: string | null;
  documentType?: string | null;
  updatedAt?: Date;
}): VerificationStatusDto => ({
  status: row.status as DiditInternalStatus,
  sessionId: row.id,
  verificationUrl: row.verificationUrl ?? null,
  documentType: row.documentType ?? null,
  updatedAt: row.updatedAt ? row.updatedAt.toISOString() : null,
});

/**
 * Create a Didit verification session via REST API.
 * Docs: https://docs.didit.me/integration/api-full-flow — POST /v3/session/
 */
export const createDiditSessionForUser = async (
  userId: string,
  userEmail?: string | null,
  opts?: { passportVerificationId?: string },
): Promise<{
  verificationUrl: string;
  sessionId: string;
  internalSessionId: string;
  diditSessionId: string;
}> => {
  assertDiditConfigured();
  const cfg = diditConfig();

  const callback = `${cfg.frontendUrl}/student/verification?didit=complete`;

  // TODO: confirm endpoint/payload against https://docs.didit.me/reference/create-session
  const body: Record<string, unknown> = {
    workflow_id: cfg.workflowId,
    vendor_data: userId,
    callback,
  };
  if (userEmail?.trim()) {
    body.contact_details = { email: userEmail.trim() };
  }

  try {
    const { data } = await axios.post<DiditCreateSessionResponse>(
      `${cfg.baseUrl}/v3/session/`,
      body,
      {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': cfg.apiKey,
        },
        timeout: 30_000,
      },
    );

    if (!data?.session_id || !data?.url) {
      throw new AppError('Didit returned an invalid session response', 502);
    }

    const internalStatus = mapDiditStatusToInternal(data.status);

    const existing = await db.VerificationSession.findOne({
      where: { diditSessionId: data.session_id },
    });

    if (existing) {
      await existing.update({
        userId,
        verificationUrl: data.url,
        status: internalStatus,
        verificationData: { lastCreateResponse: data },
      });
      if (opts?.passportVerificationId) {
        const { linkPassportToDiditSession } = await import('../document-verification/passport.service');
        await linkPassportToDiditSession(
          opts.passportVerificationId,
          existing.id,
          data.session_id,
          data.url,
        );
      }
      return {
        verificationUrl: data.url,
        sessionId: existing.id,
        internalSessionId: existing.id,
        diditSessionId: data.session_id,
      };
    }

    const row = await db.VerificationSession.create({
      userId,
      diditSessionId: data.session_id,
      diditVerificationId: data.session_id,
      status: internalStatus,
      verificationUrl: data.url,
      verificationData: { lastCreateResponse: data },
      processedWebhookEvents: [],
    });

    if (opts?.passportVerificationId) {
      const { linkPassportToDiditSession } = await import('../document-verification/passport.service');
      await linkPassportToDiditSession(opts.passportVerificationId, row.id, data.session_id, data.url);
    }

    return {
      verificationUrl: data.url,
      sessionId: row.id,
      internalSessionId: row.id,
      diditSessionId: data.session_id,
    };
  } catch (err) {
    if (err instanceof AppError) throw err;
    const ax = err as AxiosError<{ detail?: string }>;
    const status = ax.response?.status ?? 502;
    const detail = ax.response?.data?.detail ?? ax.message;
    console.error('[didit] create session failed:', status, detail);
    throw new AppError(`Didit session creation failed: ${detail}`, status >= 400 && status < 600 ? status : 502);
  }
};

export const getLatestVerificationStatusForUser = async (userId: string): Promise<VerificationStatusDto> => {
  const row = await db.VerificationSession.findOne({
    where: { userId },
    order: [['updatedAt', 'DESC']],
  });

  if (!row) {
    return {
      status: 'not_started',
      sessionId: null,
      verificationUrl: null,
      documentType: null,
      updatedAt: null,
    };
  }

  return toStatusDto(row.get({ plain: true }) as Parameters<typeof toStatusDto>[0]);
};

export const applyDiditWebhookPayload = async (payload: DiditWebhookPayload): Promise<void> => {
  const sessionId = payload.session_id;
  if (!sessionId) {
    console.warn('[didit] webhook missing session_id');
    return;
  }

  const row = await db.VerificationSession.findOne({
    where: { diditSessionId: sessionId },
  });

  if (!row) {
    console.warn('[didit] webhook for unknown session:', sessionId);
    return;
  }

  const eventId = payload.event_id;
  const processed = Array.isArray(row.processedWebhookEvents) ? [...row.processedWebhookEvents] : [];
  if (eventId && processed.includes(eventId)) {
    console.log('[didit] duplicate webhook event skipped:', eventId);
    return;
  }

  const internalStatus = mapDiditStatusToInternal(payload.status);
  const documentType = extractDocumentType(payload);

  if (eventId) processed.push(eventId);

  await row.update({
    status: internalStatus,
    verificationData: payload as Record<string, unknown>,
    ...(documentType ? { documentType } : {}),
    processedWebhookEvents: processed,
    ...(payload.vendor_data && !row.userId ? { userId: payload.vendor_data } : {}),
  });

  try {
    const { syncPassportFromWebhook } = await import('../document-verification/passport.service');
    await syncPassportFromWebhook(payload);
  } catch (err) {
    console.error('[didit] passport sync failed:', err instanceof Error ? err.message : err);
  }
};
