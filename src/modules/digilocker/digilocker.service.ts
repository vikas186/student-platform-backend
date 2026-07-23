import crypto from 'crypto';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import jwt from 'jsonwebtoken';
import { db } from '../../../config/database';
import AppError from '../../../utils/errorHandler';
import { encryptToken, decryptToken } from '../scheduling/token-crypto.util';
import {
  assertDigilockerConfigured,
  assertDigilockerDocumentsImportEnabled,
  digilockerConfig,
  hasDigilockerDocumentScope,
  isDigilockerAvsOnlyGrantedScope,
  isDigilockerConfigured,
  isDigilockerDocumentsImportEnabled,
} from './digilocker.config';
import type { DigiLockerIssuedDocument, DigiLockerOAuthState } from './digilocker.types';

const oauthSecret = () => process.env.JWT_SECRET_KEY || 'default_secret_key';

const base64UrlEncode = (buf: Buffer): string =>
  buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const createCodeVerifier = (): string =>
  base64UrlEncode(crypto.randomBytes(48)).slice(0, 64);

const createCodeChallenge = (verifier: string): string =>
  base64UrlEncode(crypto.createHash('sha256').update(verifier).digest());

export const createDigilockerOAuthState = (
  userId: string,
  applicationId: string,
  codeVerifier: string,
): string =>
  jwt.sign(
    { userId, applicationId, purpose: 'digilocker', codeVerifier } satisfies DigiLockerOAuthState,
    oauthSecret(),
    { expiresIn: '2h' },
  );

export const verifyDigilockerOAuthState = (state: string): DigiLockerOAuthState => {
  try {
    const decoded = jwt.verify(state, oauthSecret()) as DigiLockerOAuthState;
    if (decoded.purpose !== 'digilocker' || !decoded.userId || !decoded.applicationId) {
      throw new Error('invalid state');
    }
    if (!decoded.codeVerifier) throw new Error('missing verifier');
    return decoded;
  } catch {
    throw new AppError('Invalid or expired DigiLocker OAuth state', 400);
  }
};

export const getDigilockerAuthUrl = (userId: string, applicationId: string): string => {
  assertDigilockerConfigured();
  const cfg = digilockerConfig();
  const codeVerifier = createCodeVerifier();
  const state = createDigilockerOAuthState(userId, applicationId, codeVerifier);
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: cfg.clientId,
    redirect_uri: cfg.redirectUri,
    state,
    scope: cfg.scope,
    code_challenge: createCodeChallenge(codeVerifier),
    code_challenge_method: 'S256',
  });
  return `${cfg.authUrl}?${params.toString()}`;
};

const exchangeAuthorizationCode = async (code: string, codeVerifier: string) => {
  const cfg = digilockerConfig();
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    redirect_uri: cfg.redirectUri,
    code_verifier: codeVerifier,
  });
  try {
    const { data } = await axios.post(cfg.tokenUrl, body.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 30_000,
    });
    return data as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      scope?: string;
      id_token?: string;
    };
  } catch (err: any) {
    console.error('DigiLocker Token Exchange Error details:', {
      url: cfg.tokenUrl,
      status: err.response?.status,
      statusText: err.response?.statusText,
      data: err.response?.data ? String(err.response.data) : undefined,
      message: err.message,
    });
    throw err;
  }
};

const parseIdTokenName = (idToken: string | undefined): string | null => {
  if (!idToken) return null;
  try {
    const payload = JSON.parse(Buffer.from(idToken.split('.')[1] ?? '', 'base64url').toString('utf8'));
    const name = payload?.name ?? payload?.given_name;
    return typeof name === 'string' && name.trim() ? name.trim() : null;
  } catch {
    return null;
  }
};

export const handleDigilockerOAuthCallback = async (code: string, state: string) => {
  const { userId, applicationId, codeVerifier } = verifyDigilockerOAuthState(state);
  const tokens = await exchangeAuthorizationCode(code, codeVerifier);
  if (!tokens.access_token) {
    throw new AppError('DigiLocker did not return an access token', 502);
  }

  const expiresAt =
    typeof tokens.expires_in === 'number'
      ? new Date(Date.now() + tokens.expires_in * 1000)
      : null;

  await db.DigiLockerConnection.upsert({
    userId,
    digilockerName: parseIdTokenName(tokens.id_token),
    accessTokenEnc: encryptToken(tokens.access_token),
    refreshTokenEnc: tokens.refresh_token ? encryptToken(tokens.refresh_token) : null,
    accessTokenExpiresAt: expiresAt,
    scopes: tokens.scope ?? digilockerConfig().scope,
    connectedAt: new Date(),
  });

  console.info('[DigiLocker] OAuth connected', {
    userId,
    applicationId,
    grantedScopes: tokens.scope ?? null,
    expiresIn: tokens.expires_in ?? null,
    hasRefresh: Boolean(tokens.refresh_token),
    hasIdToken: Boolean(tokens.id_token),
    documentsImportEnabled: isDigilockerDocumentsImportEnabled(),
    canImportCertificates: hasDigilockerDocumentScope(tokens.scope ?? null),
  });

  return { userId, applicationId };
};

const getValidAccessToken = async (userId: string): Promise<string> => {
  const row = await db.DigiLockerConnection.findByPk(userId);
  if (!row) throw new AppError('DigiLocker is not connected for this account', 400);

  const accessToken = decryptToken(row.getDataValue('accessTokenEnc'));
  const expiresAt = row.getDataValue('accessTokenExpiresAt') as Date | null;
  if (expiresAt && expiresAt.getTime() > Date.now() + 60_000) {
    return accessToken;
  }

  const refreshEnc = row.getDataValue('refreshTokenEnc') as string | null;
  if (!refreshEnc) return accessToken;

  const cfg = digilockerConfig();
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: decryptToken(refreshEnc),
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
  });
  const { data } = await axios.post(cfg.tokenUrl, body.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    timeout: 30_000,
  });
  if (!data?.access_token) throw new AppError('Could not refresh DigiLocker token', 502);

  const nextExpires =
    typeof data.expires_in === 'number'
      ? new Date(Date.now() + data.expires_in * 1000)
      : null;

  await row.update({
    accessTokenEnc: encryptToken(data.access_token),
    refreshTokenEnc: data.refresh_token ? encryptToken(data.refresh_token) : refreshEnc,
    accessTokenExpiresAt: nextExpires,
    ...(typeof data.scope === 'string' && data.scope.trim()
      ? { scopes: data.scope.trim() }
      : {}),
  });

  return data.access_token as string;
};

export const getDigilockerConnectionStatus = async (userId: string) => {
  const configured = isDigilockerConfigured();
  const documentsImportEnabled = isDigilockerDocumentsImportEnabled();
  const row = await db.DigiLockerConnection.findByPk(userId);
  if (!row) {
    return {
      configured,
      connected: false,
      digilockerName: null,
      connectedAt: null,
      grantedScopes: null,
      documentsImportEnabled,
      documentsAccessGranted: null,
      partnerApprovalRequired: documentsImportEnabled,
    };
  }
  const scopes = (row.getDataValue('scopes') as string | null) ?? null;
  const documentsAccessGranted = (() => {
    if (!documentsImportEnabled) return false;
    return scopes ? hasDigilockerDocumentScope(scopes) : null;
  })();
  return {
    configured,
    connected: true,
    digilockerName: (row.getDataValue('digilockerName') as string | null) ?? null,
    connectedAt: row.getDataValue('connectedAt')?.toISOString?.() ?? null,
    grantedScopes: scopes,
    documentsImportEnabled,
    documentsAccessGranted,
    partnerApprovalRequired:
      documentsImportEnabled &&
      Boolean(scopes) &&
      !hasDigilockerDocumentScope(scopes) &&
      isDigilockerAvsOnlyGrantedScope(scopes),
  };
};

/** Redacted diagnostics for DigiLocker partner support (no tokens/secrets). */
export const getDigilockerPartnerDiagnostics = async () => {
  const cfg = digilockerConfig();
  const rows = await db.DigiLockerConnection.findAll({
    attributes: ['userId', 'scopes', 'connectedAt', 'accessTokenExpiresAt', 'digilockerName'],
    order: [['connectedAt', 'DESC']],
    limit: 20,
  });
  return {
    clientId: cfg.clientId,
    redirectUri: cfg.redirectUri,
    authorizeScopeRequested: cfg.scope,
    documentsImportEnabled: isDigilockerDocumentsImportEnabled(),
    endpoints: {
      authorize: cfg.authUrl,
      token: cfg.tokenUrl,
      listIssued: `${cfg.apiBase}/2/files/issued`,
      downloadFile: `${cfg.apiBase}/1/file/uri`,
    },
    requestedDocumentTypes: [
      { doctype: 'SSCER', description: 'Class 10 / Secondary School Certificate', useCase: 'Verify Class 10 academics for overseas university applications' },
      { doctype: 'HSCER', description: 'Class 12 / Higher Secondary Certificate', useCase: 'Verify Class 12 academics for overseas university applications' },
      { doctype: 'DGCER', description: 'Degree / graduation certificate', useCase: 'Verify undergraduate/graduate qualification for admissions' },
      { doctype: 'INCER', description: 'Income certificate', useCase: 'Financial / sponsorship supporting document for admissions and visa file' },
    ],
    recentConnections: rows.map(r => ({
      userId: r.getDataValue('userId'),
      scopes: r.getDataValue('scopes'),
      digilockerName: r.getDataValue('digilockerName'),
      connectedAt: r.getDataValue('connectedAt'),
      accessTokenExpiresAt: r.getDataValue('accessTokenExpiresAt'),
      canImportCertificates: hasDigilockerDocumentScope(r.getDataValue('scopes') as string | null),
    })),
    note:
      'Certificate import requires DigiLocker Partner Portal to unlock Openid + Issued Documents (files.issueddocs) for this client. AVS-only tokens cannot call GET /2/files/issued.',
  };
};

export const disconnectDigilocker = async (userId: string): Promise<void> => {
  await db.DigiLockerConnection.destroy({ where: { userId } });
};

const mapDigilockerApiError = (err: any, action: string): AppError => {
  const status = err.response?.status as number | undefined;
  const errorCode = String(err.response?.data?.error ?? '').toLowerCase();
  // Use 422 (not 403) so the student UI does not treat DigiLocker partner limits as app "Access denied".
  if (status === 403 || errorCode === 'insufficient_scope') {
    return new AppError(
      'DigiLocker denied access to issued documents. Your partner app may only have KYC/AVS scope (e.g. avs_parent). Request files.issueddocs from the DigiLocker Partner Portal, or upload documents manually.',
      422,
    );
  }
  if (status === 401) {
    return new AppError('DigiLocker session expired. Click Switch account and sign in again.', 401);
  }
  const detail =
    typeof err.response?.data === 'string'
      ? err.response.data
      : err.response?.data?.error_description || err.response?.data?.error;
  const suffix = detail ? `: ${String(detail).slice(0, 200)}` : '';
  return new AppError(`DigiLocker ${action} failed${suffix}`, status && status >= 400 && status < 600 ? status : 502);
};

export const listDigilockerIssuedDocuments = async (userId: string): Promise<DigiLockerIssuedDocument[]> => {
  assertDigilockerConfigured();
  assertDigilockerDocumentsImportEnabled();

  const row = await db.DigiLockerConnection.findByPk(userId);
  const grantedScopes = (row?.getDataValue('scopes') as string | null) ?? null;
  if (grantedScopes && !hasDigilockerDocumentScope(grantedScopes)) {
    throw new AppError(
      isDigilockerAvsOnlyGrantedScope(grantedScopes)
        ? 'DigiLocker is connected for identity verification only (KYC/AVS). Certificate import needs files.issueddocs from the DigiLocker Partner Portal — upload marksheets manually for now.'
        : 'DigiLocker is connected without certificate import permission. Upload academic documents manually, or reconnect after files.issueddocs is enabled on the partner app.',
      422,
    );
  }

  const token = await getValidAccessToken(userId);
  const cfg = digilockerConfig();
  try {
    const { data } = await axios.get(`${cfg.apiBase}/2/files/issued`, {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 30_000,
    });
 
    const items = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
    return items
      .filter((item: Record<string, unknown>) => typeof item.uri === 'string' && item.uri.trim())
      .map((item: Record<string, unknown>) => ({
        name: String(item.name ?? item.description ?? 'Document'),
        type: String(item.type ?? 'file'),
        size: String(item.size ?? ''),
        date: String(item.date ?? ''),
        mime: (item.mime as string | string[]) ?? 'application/pdf',
        uri: String(item.uri),
        doctype: String(item.doctype ?? ''),
        description: String(item.description ?? item.name ?? 'Document'),
        issuerid: String(item.issuerid ?? ''),
        issuer: String(item.issuer ?? ''),
      }));
  } catch (err: any) {
    console.error('DigiLocker List Issued Documents Error details:', {
      url: `${cfg.apiBase}/2/files/issued`,
      status: err.response?.status,
      statusText: err.response?.statusText,
      data: err.response?.data,
      message: err.message,
    });
    throw mapDigilockerApiError(err, 'document list');
  }
};

export const mapDigilockerDocType = (doctype: string, description: string): string => {
  const code = doctype.trim().toUpperCase();
  const desc = description.toLowerCase();
  if (code === 'HSCER' || desc.includes('12th') || desc.includes('class xii') || desc.includes('higher secondary')) {
    return '12th_marksheet';
  }
  if (code === 'SSCER' || desc.includes('10th') || desc.includes('class x') || desc.includes('secondary school')) {
    return '10th_marksheet';
  }
  if (code === 'DGCER' || desc.includes('degree') || desc.includes('graduation')) return 'degree_certificate';
  if (code === 'INCER' || desc.includes('income certificate')) return 'itr';
  if (desc.includes('transcript') || (desc.includes('marksheet') && desc.includes('university'))) {
    return 'transcript';
  }
  if (desc.includes('diploma')) return 'diploma';
  if (desc.includes('passport')) return 'passport';
  if (desc.includes('bank')) return 'bank_statement';
  if (desc.includes('income tax') || desc.includes('itr') || desc.includes('form 16')) return 'itr';
  return 'general';
};

const verifyHmac = (fileBuf: Buffer, hmacHeader: string | undefined): void => {
  if (!hmacHeader) return;
  const cfg = digilockerConfig();
  const computed = crypto.createHmac('sha256', cfg.clientSecret).update(fileBuf).digest('base64');
  if (computed !== hmacHeader) {
    throw new AppError('DigiLocker file integrity check failed', 502);
  }
};

export const downloadDigilockerFile = async (
  userId: string,
  uri: string,
): Promise<{ buffer: Buffer; mime: string; fileName: string }> => {
  const token = await getValidAccessToken(userId);
  const cfg = digilockerConfig();
  try {
    const { data, headers } = await axios.get(`${cfg.apiBase}/1/file/uri`, {
      headers: { Authorization: `Bearer ${token}` },
      params: { uri },
      responseType: 'arraybuffer',
      timeout: 60_000,
    });
    const buffer = Buffer.from(data);
    verifyHmac(buffer, headers.hmac as string | undefined);
    const mime = String(headers['content-type'] ?? 'application/pdf');
    const ext = mime.includes('pdf') ? '.pdf' : mime.includes('png') ? '.png' : '.jpg';
    const safeUri = uri.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 48);
    return { buffer, mime, fileName: `digilocker-${safeUri}${ext}` };
  } catch (err: any) {
    console.error('DigiLocker Download File Error details:', {
      url: `${cfg.apiBase}/1/file/uri`,
      uri,
      status: err.response?.status,
      statusText: err.response?.statusText,
      data: err.response?.data ? String(err.response.data) : undefined,
      message: err.message,
    });
    throw mapDigilockerApiError(err, 'file download');
  }
};

export const importDigilockerDocumentForStudent = async (input: {
  userId: string;
  studentProfileId: number;
  applicationId: string;
  uri: string;
  documentType?: string | null;
}) => {
  const issued = await listDigilockerIssuedDocuments(input.userId);
  const meta = issued.find(d => d.uri === input.uri);
  if (!meta) throw new AppError('Document not found in your DigiLocker account', 404);

  const { buffer, mime, fileName } = await downloadDigilockerFile(input.userId, input.uri);
  const uploadDir = path.join('uploads', 'student-documents');
  fs.mkdirSync(uploadDir, { recursive: true });
  const storedName = `${Date.now()}-digilocker-${Math.random().toString(36).slice(2, 10)}${path.extname(fileName)}`;
  const absolutePath = path.join(uploadDir, storedName);
  fs.writeFileSync(absolutePath, buffer);

  const documentType =
    input.documentType?.trim() ||
    mapDigilockerDocType(meta.doctype, meta.description || meta.name);

  const { attachVerifiedStudentDocument } = await import('../../../services/studentPortal.service');
  const doc = await attachVerifiedStudentDocument(input.studentProfileId, {
    applicationId: input.applicationId,
    fileUrl: absolutePath.replace(/\\/g, '/'),
    originalFileName: meta.description?.trim() || meta.name?.trim() || fileName,
    documentType,
    fileSize: buffer.length,
    verificationSource: 'digilocker',
    verificationMeta: {
      uri: meta.uri,
      doctype: meta.doctype,
      issuer: meta.issuer,
      mime,
    },
  });

  return doc;
};

export const importAllDigilockerDocumentsForStudent = async (input: {
  userId: string;
  studentProfileId: number;
  applicationId: string;
}) => {
  const issued = await listDigilockerIssuedDocuments(input.userId);
  const { db } = await import('../../../config/database');
  const existing = await db.Document.findAll({
    where: { applicationId: input.applicationId, studentProfileId: input.studentProfileId },
  });
  const existingTypes = new Set(existing.map(d => d.type));

  const imported: Awaited<ReturnType<typeof importDigilockerDocumentForStudent>>[] = [];
  const skipped: { uri: string; reason: string }[] = [];

  for (const meta of issued) {
    const documentType = mapDigilockerDocType(meta.doctype, meta.description || meta.name);
    if (documentType === 'general') {
      skipped.push({ uri: meta.uri, reason: 'Unrecognized document type' });
      continue;
    }
    if (existingTypes.has(documentType)) {
      skipped.push({ uri: meta.uri, reason: `Already imported as ${documentType}` });
      continue;
    }
    try {
      const doc = await importDigilockerDocumentForStudent({
        ...input,
        uri: meta.uri,
        documentType,
      });
      imported.push(doc);
      existingTypes.add(documentType);
    } catch (err: any) {
      skipped.push({ uri: meta.uri, reason: err?.message || 'Import failed' });
    }
  }

  return { imported, skipped, total: issued.length };
};

/** Map DigiLocker OAuth error codes to actionable messages for students/admins. */
export const mapDigilockerOAuthError = (error: string, description?: string): string => {
  if (error === 'invalid_scope_avs') {
    return (
      'DigiLocker partner app is AVS-only (Age verification). Uncheck Age verification in MeriPehchaan Auth ' +
      'or email partners@digitalindia.gov.in to enable openid + Issued Documents for this client.'
    );
  }
  if (error === 'invalid_scope') {
    return description || 'Invalid OAuth scope. Set DIGILOCKER_SCOPE=openid for document import apps.';
  }
  return description || error;
};

export const digilockerFrontendRedirect = (
  applicationId: string,
  ok: boolean,
  message?: string,
): string => {
  const cfg = digilockerConfig();
  const params = new URLSearchParams({ digilocker: ok ? 'connected' : 'error' });
  if (message) params.set('digilocker_msg', message.slice(0, 200));
  return `${cfg.frontendUrl}/student/applications/${encodeURIComponent(applicationId)}?${params}`;
};
