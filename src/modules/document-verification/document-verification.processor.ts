import { db } from '../../../config/database';
import AppError from '../../../utils/errorHandler';
import {
  BANK_STATEMENT_MAX_AGE_DAYS,
  normalizeDocumentType,
  OCR_CONFIDENCE_THRESHOLD,
  resolveVerificationPipeline,
} from './document-types';
import { writeVerificationAudit } from './audit.service';
import { dispatchVerificationJob } from './dispatch';
import { runOcrOnFile } from './ocr/ocr.service';
import { parseAcademicText, academicHasRequiredFields } from './ocr/parsers/academic.parser';
import { parseBankText, isStatementWithinDays } from './ocr/parsers/bank.parser';
import { parseItrText } from './ocr/parsers/itr.parser';
import { hashFile, createPassportVerificationForUpload } from './passport.service';
import { createDiditSessionForUser } from '../didit/didit.service';
import { namesMatch, isValidPan } from './validation/name-matcher';
import { getVerifiedPassportName } from './passport.service';
import { linkPassportToDiditSession } from './passport.service';

export type VerificationUploadResult = {
  verificationUrl?: string | null;
  passportVerificationId?: string | null;
  registryId?: string | null;
  pipeline: string;
};

export const processVerificationUpload = async (input: {
  userId: string;
  userEmail?: string | null;
  documentId: string;
  fileUrl: string;
  documentType: string;
}): Promise<VerificationUploadResult> => {
  const normalizedType = normalizeDocumentType(input.documentType);
  const pipeline = resolveVerificationPipeline(normalizedType);

  if (pipeline === 'passport') {
    const passportRow = await createPassportVerificationForUpload({
      userId: input.userId,
      documentId: input.documentId,
      fileUrl: input.fileUrl,
    });

    const didit = await createDiditSessionForUser(input.userId, input.userEmail, {
      passportVerificationId: passportRow.id,
    });

    await linkPassportToDiditSession(
      passportRow.id,
      didit.internalSessionId,
      didit.diditSessionId,
      didit.verificationUrl,
    );

    return {
      pipeline,
      verificationUrl: didit.verificationUrl,
      passportVerificationId: passportRow.id,
      registryId: `passport:${passportRow.id}`,
    };
  }

  if (pipeline === 'academic') {
    const row = await db.AcademicDocument.create({
      userId: input.userId,
      documentId: input.documentId,
      documentType: normalizedType,
      fileUrl: input.fileUrl,
      verificationStatus: 'pending',
    });
    dispatchVerificationJob(
      () => processAcademicDocument(row.id, input.userId),
      `academic OCR ${row.id}`,
    );
    return { pipeline, registryId: `academic:${row.id}` };
  }

  if (pipeline === 'bank') {
    const row = await db.BankStatement.create({
      userId: input.userId,
      documentId: input.documentId,
      fileUrl: input.fileUrl,
      verificationStatus: 'pending',
    });
    dispatchVerificationJob(() => processBankStatement(row.id, input.userId), `bank OCR ${row.id}`);
    return { pipeline, registryId: `bank:${row.id}` };
  }

  if (pipeline === 'itr') {
    const row = await db.ItrDocument.create({
      userId: input.userId,
      documentId: input.documentId,
      fileUrl: input.fileUrl,
      verificationStatus: 'pending',
    });
    dispatchVerificationJob(() => processItrDocument(row.id, input.userId), `itr OCR ${row.id}`);
    return { pipeline, registryId: `itr:${row.id}` };
  }

  return { pipeline: 'none' };
};

const processAcademicDocument = async (academicId: string, userId: string) => {
  const row = await db.AcademicDocument.findByPk(academicId);
  if (!row?.fileUrl) return;

  try {
    const fileHash = hashFile(row.fileUrl);
    const duplicate = await db.AcademicDocument.findOne({
      where: { userId, documentType: row.documentType, fileHash },
    });
    if (duplicate && duplicate.id !== row.id) {
      await row.update({
        fileHash,
        verificationStatus: 'needs_review',
        duplicateOfId: duplicate.id,
        reviewNotes: 'Duplicate upload detected',
      });
      await writeVerificationAudit({
        entityType: 'academic',
        entityId: row.id,
        action: 'auto_needs_review',
        notes: 'Duplicate upload',
      });
      return;
    }

    const ocr = await runOcrOnFile(row.fileUrl);
    const fields = parseAcademicText(ocr.text);
    const passportName = await getVerifiedPassportName(userId);
    const nameOk = namesMatch(passportName, fields.studentName);
    const fieldsOk = academicHasRequiredFields(fields);
    const confidenceOk = ocr.confidence >= OCR_CONFIDENCE_THRESHOLD;

    let status: 'pre_verified' | 'needs_review' = 'needs_review';
    if (nameOk && confidenceOk && fieldsOk) status = 'pre_verified';

    await row.update({
      fileHash,
      ocrText: ocr.text,
      studentName: fields.studentName,
      institutionName: fields.institutionName,
      degree: fields.degree,
      course: fields.course,
      passingYear: fields.passingYear,
      cgpa: fields.cgpa,
      ocrConfidence: ocr.confidence,
      verificationStatus: status,
      reviewNotes:
        status === 'pre_verified'
          ? null
          : `Auto review: nameMatch=${nameOk}, confidence=${ocr.confidence.toFixed(1)}, fields=${fieldsOk}`,
    });

    await writeVerificationAudit({
      entityType: 'academic',
      entityId: row.id,
      action: status === 'pre_verified' ? 'auto_pre_verified' : 'auto_needs_review',
      metadata: { nameOk, confidenceOk, fieldsOk },
    });

    if (status === 'pre_verified' && row.documentId) {
      await db.Document.update({ status: 'verified' }, { where: { id: row.documentId } });
    }
  } catch (err) {
    await row.update({
      verificationStatus: 'needs_review',
      reviewNotes: err instanceof Error ? err.message : 'OCR failed',
    });
    await writeVerificationAudit({
      entityType: 'academic',
      entityId: row.id,
      action: 'auto_needs_review',
      notes: 'OCR processing failed',
    });
  }
};

const processBankStatement = async (bankId: string, userId: string) => {
  const row = await db.BankStatement.findByPk(bankId);
  if (!row?.fileUrl) return;

  try {
    const fileHash = hashFile(row.fileUrl);
    const ocr = await runOcrOnFile(row.fileUrl);
    const fields = parseBankText(ocr.text);
    const passportName = await getVerifiedPassportName(userId);
    const nameOk = namesMatch(passportName, fields.accountHolderName);
    const dateOk = isStatementWithinDays(fields.statementDate, BANK_STATEMENT_MAX_AGE_DAYS);

    let status: 'financial_verified' | 'needs_review' = 'needs_review';
    if (nameOk && dateOk && fields.accountHolderName && fields.statementDate) {
      status = 'financial_verified';
    }

    await row.update({
      fileHash,
      ocrText: ocr.text,
      accountHolderName: fields.accountHolderName,
      bankName: fields.bankName,
      statementDate: fields.statementDate,
      openingBalance: fields.openingBalance,
      closingBalance: fields.closingBalance,
      ocrConfidence: ocr.confidence,
      verificationStatus: status,
      reviewNotes:
        status === 'financial_verified'
          ? null
          : `Auto review: nameMatch=${nameOk}, dateOk=${dateOk}`,
    });

    await writeVerificationAudit({
      entityType: 'bank',
      entityId: row.id,
      action: status === 'financial_verified' ? 'auto_financial_verified' : 'auto_needs_review',
    });

    if (status === 'financial_verified' && row.documentId) {
      await db.Document.update({ status: 'verified' }, { where: { id: row.documentId } });
    }
  } catch (err) {
    await row.update({
      verificationStatus: 'needs_review',
      reviewNotes: err instanceof Error ? err.message : 'OCR failed',
    });
  }
};

const processItrDocument = async (itrId: string, userId: string) => {
  const row = await db.ItrDocument.findByPk(itrId);
  if (!row?.fileUrl) return;

  try {
    const fileHash = hashFile(row.fileUrl);
    const ocr = await runOcrOnFile(row.fileUrl);
    const fields = parseItrText(ocr.text);
    const passportName = await getVerifiedPassportName(userId);
    const nameOk = namesMatch(passportName, fields.taxpayerName);
    const panOk = isValidPan(fields.pan);

    let status: 'financial_verified' | 'needs_review' = 'needs_review';
    if (nameOk && panOk) status = 'financial_verified';

    await row.update({
      fileHash,
      ocrText: ocr.text,
      pan: fields.pan?.toUpperCase() ?? null,
      taxpayerName: fields.taxpayerName,
      assessmentYear: fields.assessmentYear,
      totalIncome: fields.totalIncome,
      ocrConfidence: ocr.confidence,
      verificationStatus: status,
      reviewNotes:
        status === 'financial_verified' ? null : `Auto review: nameMatch=${nameOk}, panOk=${panOk}`,
    });

    await writeVerificationAudit({
      entityType: 'itr',
      entityId: row.id,
      action: status === 'financial_verified' ? 'auto_financial_verified' : 'auto_needs_review',
    });

    if (status === 'financial_verified' && row.documentId) {
      await db.Document.update({ status: 'verified' }, { where: { id: row.documentId } });
    }
  } catch (err) {
    await row.update({
      verificationStatus: 'needs_review',
      reviewNotes: err instanceof Error ? err.message : 'OCR failed',
    });
  }
};

export const validateVerificationDocumentType = (documentType: string | undefined) => {
  const normalized = normalizeDocumentType(documentType);
  const pipeline = resolveVerificationPipeline(normalized);
  if (pipeline === 'none' && documentType && documentType !== 'general') {
    throw new AppError(
      `Unsupported document type "${documentType}". Use passport, academic, bank_statement, or itr types.`,
      400,
    );
  }
  return normalized;
};
