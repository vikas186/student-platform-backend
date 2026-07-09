import AppError from '../../../utils/errorHandler';

export const digilockerConfig = () => ({
  clientId: process.env.DIGILOCKER_CLIENT_ID?.trim() || '',
  clientSecret: process.env.DIGILOCKER_CLIENT_SECRET?.trim() || '',
  redirectUri:
    process.env.DIGILOCKER_REDIRECT_URI?.trim() ||
    `${(process.env.BACKEND_URL || 'http://localhost:4001').replace(/\/$/, '')}/api/v1/student/digilocker/callback`,
  frontendUrl: (process.env.FRONTEND_URL || 'http://localhost:8080').replace(/\/$/, ''),
  authUrl:
    process.env.DIGILOCKER_AUTH_URL?.trim() ||
    'https://digilocker.meripehchaan.gov.in/public/oauth2/1/authorize',
  tokenUrl:
    process.env.DIGILOCKER_TOKEN_URL?.trim() ||
    'https://digilocker.meripehchaan.gov.in/public/oauth2/2/token',
  apiBase:
    process.env.DIGILOCKER_API_BASE?.trim() ||
    'https://digilocker.meripehchaan.gov.in/public/oauth2',
  scope: process.env.DIGILOCKER_SCOPE?.trim() || 'avs_parent',
});

/** True when the partner app is configured for issued-document APIs (files.issueddocs). */
export const isDigilockerDocumentsImportEnabled = (): boolean =>
  digilockerConfig().scope.includes('files.issueddocs');

export const hasDigilockerDocumentScope = (scopes: string | null | undefined): boolean =>
  Boolean(scopes?.includes('files.issueddocs'));

export const isDigilockerConfigured = (): boolean => {
  const c = digilockerConfig();
  return Boolean(c.clientId && c.clientSecret);
};

export const assertDigilockerConfigured = (): void => {
  if (!isDigilockerConfigured()) {
    throw new AppError(
      'DigiLocker is not configured. Set DIGILOCKER_CLIENT_ID and DIGILOCKER_CLIENT_SECRET.',
      503,
    );
  }
};

export const assertDigilockerDocumentsImportEnabled = (): void => {
  if (!isDigilockerDocumentsImportEnabled()) {
    throw new AppError(
      'DigiLocker certificate import is not enabled for this partner app. The current integration only supports AVS (avs / avs_parent). Request files.issueddocs scope from the DigiLocker Partner Portal, or upload academic documents manually.',
      503,
    );
  }
};
