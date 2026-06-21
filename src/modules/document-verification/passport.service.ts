import crypto from 'crypto';
import fs from 'fs';
import { db } from '../../../config/database';
import type { DiditWebhookPayload } from '../didit/didit.types';
import { mapDiditStatusToInternal } from '../didit/didit.service';
import { PASSPORT_CONFIDENCE_THRESHOLD } from './document-types';
import { writeVerificationAudit } from './audit.service';
import { resolveAbsolutePath } from './ocr/ocr.service';

export const hashFile = (fileUrl: string): string => {
  const absolutePath = resolveAbsolutePath(fileUrl);
  const buf = fs.readFileSync(absolutePath);
  return crypto.createHash('sha256').update(buf).digest('hex');
};

const pickString = (obj: Record<string, unknown> | undefined, keys: string[]): string | null => {
  if (!obj) return null;
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return null;
};

const pickNumber = (obj: Record<string, unknown> | undefined, keys: string[]): number | null => {
  if (!obj) return null;
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (typeof v === 'string' && v.trim()) {
      const n = Number(v);
      if (Number.isFinite(n)) return n;
    }
  }
  return null;
};

export const extractPassportFieldsFromWebhook = (payload: DiditWebhookPayload) => {
  const idVerifications = payload.decision?.id_verifications;
  const first = Array.isArray(idVerifications) ? (idVerifications[0] as Record<string, unknown>) : undefined;
  const extra = (first?.extra_fields ?? first?.extracted_data ?? first) as Record<string, unknown> | undefined;

  const confidence =
    pickNumber(first, ['confidence', 'confidence_score', 'score']) ??
    pickNumber(extra, ['confidence', 'confidence_score']);

  const passportNumber = pickString(extra, ['document_number', 'passport_number', 'id_number']);
  const fullName = pickString(extra, ['full_name', 'name', 'first_name']) ??
    ([pickString(extra, ['first_name']), pickString(extra, ['last_name'])].filter(Boolean).join(' ') || null);
  const nationality = pickString(extra, ['nationality', 'country', 'issuing_country']);
  const dateOfBirth = pickString(extra, ['date_of_birth', 'dob', 'birth_date']);

  return { confidence, passportNumber, fullName, nationality, dateOfBirth, first, extra };
};

export const mapPassportStatus = (
  diditStatus: string | undefined | null,
  confidence: number | null,
): 'pending' | 'verified' | 'needs_review' | 'rejected' => {
  const internal = mapDiditStatusToInternal(diditStatus);
  if (internal === 'rejected' || internal === 'failed') return 'rejected';
  if (internal === 'pending' || internal === 'not_started') return 'pending';
  if (internal === 'verified') {
    if (confidence != null && confidence < PASSPORT_CONFIDENCE_THRESHOLD) return 'needs_review';
    return 'verified';
  }
  return 'needs_review';
};

export const getLatestPassportVerificationForUser = async (userId: string) => {
  return db.PassportVerification.findOne({
    where: { userId },
    order: [['updatedAt', 'DESC']],
  });
};

export const getVerifiedPassportName = async (userId: string): Promise<string | null> => {
  const row = await db.PassportVerification.findOne({
    where: { userId, status: 'verified' },
    order: [['updatedAt', 'DESC']],
  });
  return row?.fullName?.trim() || null;
};

export const createPassportVerificationForUpload = async (input: {
  userId: string;
  documentId: string;
  fileUrl: string;
}) => {
  const row = await db.PassportVerification.create({
    userId: input.userId,
    documentId: input.documentId,
    status: 'pending',
    rawResponse: { source: 'upload', fileUrl: input.fileUrl },
  });
  await writeVerificationAudit({
    entityType: 'passport',
    entityId: row.id,
    action: 'ocr_processed',
    notes: 'Passport uploaded; pending review',
    metadata: { documentId: input.documentId },
  });
  return row;
};

export const linkPassportToDiditSession = async (
  passportVerificationId: string,
  verificationSessionId: string,
  verificationId: string | null,
  verificationUrl: string | null,
) => {
  await db.PassportVerification.update(
    {
      verificationSessionId,
      verificationId,
      status: 'pending',
    },
    { where: { id: passportVerificationId } },
  );
  if (verificationUrl) {
    await db.VerificationSession.update({ verificationUrl }, { where: { id: verificationSessionId } });
  }
};

export const syncPassportFromWebhook = async (payload: DiditWebhookPayload): Promise<void> => {
  const sessionId = payload.session_id;
  if (!sessionId) return;

  const session = await db.VerificationSession.findOne({ where: { diditSessionId: sessionId } });
  if (!session) return;

  const userId = session.userId;
  const fields = extractPassportFieldsFromWebhook(payload);
  const status = mapPassportStatus(payload.status, fields.confidence);

  let row = await db.PassportVerification.findOne({
    where: { verificationSessionId: session.id },
    order: [['updatedAt', 'DESC']],
  });

  if (!row) {
    row = await db.PassportVerification.findOne({
      where: { userId, status: 'pending' },
      order: [['updatedAt', 'DESC']],
    });
  }

  if (!row) {
    row = await db.PassportVerification.create({
      userId,
      verificationSessionId: session.id,
      verificationId: sessionId,
      status,
      confidenceScore: fields.confidence,
      passportNumber: fields.passportNumber,
      fullName: fields.fullName,
      nationality: fields.nationality,
      dateOfBirth: fields.dateOfBirth,
      rawResponse: payload as Record<string, unknown>,
    });
  } else {
    await row.update({
      verificationSessionId: session.id,
      verificationId: sessionId,
      status,
      confidenceScore: fields.confidence,
      passportNumber: fields.passportNumber ?? row.passportNumber,
      fullName: fields.fullName ?? row.fullName,
      nationality: fields.nationality ?? row.nationality,
      dateOfBirth: fields.dateOfBirth ?? row.dateOfBirth,
      rawResponse: payload as Record<string, unknown>,
    });
  }

  if (row.documentId && status === 'verified') {
    await db.Document.update({ status: 'verified' }, { where: { id: row.documentId } });
  }

  await writeVerificationAudit({
    entityType: 'passport',
    entityId: row.id,
    action: 'webhook_update',
    notes: `Didit status: ${payload.status ?? 'unknown'} → ${status}`,
    metadata: { confidence: fields.confidence, diditStatus: payload.status },
  });
};
