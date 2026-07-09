import type { Request, Response } from 'express';
import { catchAsyncError } from '../../../middleware/catchAsyncError';
import AppError from '../../../utils/errorHandler';
import {
  disconnectDigilocker,
  digilockerFrontendRedirect,
  getDigilockerAuthUrl,
  getDigilockerConnectionStatus,
  handleDigilockerOAuthCallback,
  importDigilockerDocumentForStudent,
  importAllDigilockerDocumentsForStudent,
  listDigilockerIssuedDocuments,
} from './digilocker.service';
import { isDigilockerConfigured } from './digilocker.config';

const getStudentProfileId = async (req: Request): Promise<number> => {
  const userId = (req.user as { id?: string })?.id;
  if (!userId) throw new AppError('Unauthorized', 401);
  const { db } = await import('../../../config/database');
  const profile = await db.StudentProfile.findOne({ where: { userId } });
  if (!profile) throw new AppError('Student profile not found', 404);
  return profile.getDataValue('id') as number;
};

export const getDigilockerStatusHandler = catchAsyncError(async (req: Request, res: Response) => {
  const userId = (req.user as { id: string }).id;
  const status = await getDigilockerConnectionStatus(userId);
  res.json({ success: true, data: status });
});

export const getDigilockerAuthUrlHandler = catchAsyncError(async (req: Request, res: Response) => {
  const userId = (req.user as { id: string }).id;
  const applicationId = String(req.query.applicationId ?? '').trim();
  if (!applicationId) throw new AppError('applicationId is required', 400);
  const authUrl = getDigilockerAuthUrl(userId, applicationId);
  res.json({ success: true, data: { authUrl } });
});

export const digilockerCallbackHandler = catchAsyncError(async (req: Request, res: Response) => {
  const code = typeof req.query.code === 'string' ? req.query.code : '';
  const state = typeof req.query.state === 'string' ? req.query.state : '';
  const error = typeof req.query.error === 'string' ? req.query.error : '';
  const errorDescription =
    typeof req.query.error_description === 'string' ? req.query.error_description : '';

  if (error) {
    let applicationId = '';
    try {
      const { verifyDigilockerOAuthState } = await import('./digilocker.service');
      applicationId = verifyDigilockerOAuthState(state).applicationId;
    } catch {
      res.redirect(`${digilockerConfigSafeFrontend()}/student/applications?digilocker=error`);
      return;
    }
    res.redirect(digilockerFrontendRedirect(applicationId, false, errorDescription || error));
    return;
  }

  if (!code || !state) {
    throw new AppError('Missing DigiLocker OAuth code or state', 400);
  }

  const { applicationId } = await handleDigilockerOAuthCallback(code, state);
  res.redirect(digilockerFrontendRedirect(applicationId, true));
});

function digilockerConfigSafeFrontend(): string {
  return (process.env.FRONTEND_URL || 'http://localhost:8080').replace(/\/$/, '');
}

export const listDigilockerDocumentsHandler = catchAsyncError(async (req: Request, res: Response) => {
  if (!isDigilockerConfigured()) {
    res.json({ success: true, data: [] });
    return;
  }
  const userId = (req.user as { id: string }).id;
  const docs = await listDigilockerIssuedDocuments(userId);
  res.json({ success: true, data: docs });
});

export const importDigilockerDocumentHandler = catchAsyncError(async (req: Request, res: Response) => {
  const userId = (req.user as { id: string }).id;
  const applicationId = String(req.body?.applicationId ?? '').trim();
  const uri = String(req.body?.uri ?? '').trim();
  const documentType = req.body?.documentType ? String(req.body.documentType).trim() : null;
  if (!applicationId || !uri) throw new AppError('applicationId and uri are required', 400);

  const studentProfileId = await getStudentProfileId(req);
  const doc = await importDigilockerDocumentForStudent({
    userId,
    studentProfileId,
    applicationId,
    uri,
    documentType,
  });

  res.status(201).json({
    success: true,
    message: 'DigiLocker document imported',
    data: doc,
  });
});

export const importAllDigilockerDocumentsHandler = catchAsyncError(async (req: Request, res: Response) => {
  const userId = (req.user as { id: string }).id;
  const applicationId = String(req.body?.applicationId ?? '').trim();
  if (!applicationId) throw new AppError('applicationId is required', 400);

  const studentProfileId = await getStudentProfileId(req);
  const result = await importAllDigilockerDocumentsForStudent({
    userId,
    studentProfileId,
    applicationId,
  });

  res.status(201).json({
    success: true,
    message: `Imported ${result.imported.length} document(s) from DigiLocker`,
    data: result,
  });
});

export const disconnectDigilockerHandler = catchAsyncError(async (req: Request, res: Response) => {
  const userId = (req.user as { id: string }).id;
  await disconnectDigilocker(userId);
  res.json({ success: true, message: 'DigiLocker disconnected' });
});
