import jwt from 'jsonwebtoken';
import { google } from 'googleapis';
import { db } from '../../../config/database';
import AppError from '../../../utils/errorHandler';
import { assertGoogleOAuthConfigured, schedulingConfig } from './scheduling.config';
import { decryptToken, encryptToken } from './token-crypto.util';

const oauthSecret = () => process.env.JWT_SECRET_KEY || 'default_secret_key';

export type OAuthStatePayload = {
  userId: string;
  purpose: 'google_calendar';
};

export const createOAuthState = (userId: string): string =>
  jwt.sign({ userId, purpose: 'google_calendar' } satisfies OAuthStatePayload, oauthSecret(), {
    expiresIn: '15m',
  });

export const verifyOAuthState = (state: string): OAuthStatePayload => {
  try {
    const decoded = jwt.verify(state, oauthSecret()) as OAuthStatePayload;
    if (decoded.purpose !== 'google_calendar' || !decoded.userId) {
      throw new Error('invalid state');
    }
    return decoded;
  } catch {
    throw new AppError('Invalid or expired OAuth state', 400);
  }
};

const oauth2Client = () => {
  assertGoogleOAuthConfigured();
  const c = schedulingConfig();
  return new google.auth.OAuth2(c.clientId, c.clientSecret, c.redirectUri);
};

export const getGoogleAuthUrl = (adminUserId: string): string => {
  const client = oauth2Client();
  const c = schedulingConfig();
  return client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: c.scopes,
    state: createOAuthState(adminUserId),
  });
};

export const handleGoogleOAuthCallback = async (code: string, state: string) => {
  const { userId } = verifyOAuthState(state);
  const admin = await db.User.findByPk(userId);
  if (!admin || admin.role !== 'admin') {
    throw new AppError('Only admin accounts can connect Google Calendar', 403);
  }

  const client = oauth2Client();
  const { tokens } = await client.getToken(code);
  if (!tokens.refresh_token) {
    throw new AppError('Google did not return a refresh token. Revoke app access and try again with consent.', 400);
  }

  client.setCredentials(tokens);
  const oauth2 = google.oauth2({ version: 'v2', auth: client });
  const me = await oauth2.userinfo.get();
  const googleEmail = me.data.email;
  if (!googleEmail) {
    throw new AppError('Could not read Google account email', 400);
  }

  const expiresAt = tokens.expiry_date ? new Date(tokens.expiry_date) : null;
  const c = schedulingConfig();

  await db.GoogleCalendarConnection.upsert({
    userId,
    googleEmail,
    calendarId: 'primary',
    refreshTokenEnc: encryptToken(tokens.refresh_token),
    accessToken: tokens.access_token ?? null,
    accessTokenExpiresAt: expiresAt,
    scopes: c.scopes.join(' '),
    connectedAt: new Date(),
  });

  return { userId, googleEmail };
};

export const getConnectionForAdmin = async (adminUserId: string) => {
  const row = await db.GoogleCalendarConnection.findByPk(adminUserId);
  if (!row) return null;
  const plain = row.get({ plain: true }) as {
    userId: string;
    googleEmail: string;
    calendarId: string;
    connectedAt: Date;
  };
  return {
    connected: true,
    googleEmail: plain.googleEmail,
    calendarId: plain.calendarId,
    connectedAt: plain.connectedAt,
  };
};

export const disconnectGoogleCalendar = async (adminUserId: string): Promise<void> => {
  const row = await db.GoogleCalendarConnection.findByPk(adminUserId);
  if (!row) return;

  try {
    const client = await getAuthenticatedClient(adminUserId);
    await client.revokeCredentials();
  } catch {
    /* best effort */
  }

  await row.destroy();
};

export const getAuthenticatedClient = async (adminUserId: string) => {
  const row = await db.GoogleCalendarConnection.findByPk(adminUserId);
  if (!row) {
    throw new AppError('Google Calendar is not connected for this admin', 503);
  }

  const plain = row.get({ plain: true }) as {
    refreshTokenEnc: string;
    accessToken: string | null;
    accessTokenExpiresAt: Date | null;
  };

  const client = oauth2Client();
  const refreshToken = decryptToken(plain.refreshTokenEnc);
  client.setCredentials({
    refresh_token: refreshToken,
    access_token: plain.accessToken ?? undefined,
    expiry_date: plain.accessTokenExpiresAt ? plain.accessTokenExpiresAt.getTime() : undefined,
  });

  const needsRefresh =
    !plain.accessToken ||
    !plain.accessTokenExpiresAt ||
    plain.accessTokenExpiresAt.getTime() < Date.now() + 60_000;

  if (needsRefresh) {
    const { credentials } = await client.refreshAccessToken();
    client.setCredentials(credentials);
    row.accessToken = credentials.access_token ?? null;
    row.accessTokenExpiresAt = credentials.expiry_date ? new Date(credentials.expiry_date) : null;
    if (credentials.refresh_token) {
      row.refreshTokenEnc = encryptToken(credentials.refresh_token);
    }
    await row.save();
  }

  return client;
};

export const resolveHostAdminUserId = async (explicitAdminUserId?: string | null): Promise<string> => {
  if (explicitAdminUserId) {
    const conn = await db.GoogleCalendarConnection.findByPk(explicitAdminUserId);
    if (conn) return explicitAdminUserId;
  }

  const defaultId = schedulingConfig().defaultCounsellorAdminUserId;
  if (defaultId) {
    const conn = await db.GoogleCalendarConnection.findByPk(defaultId);
    if (conn) return defaultId;
  }

  const any = await db.GoogleCalendarConnection.findOne({ order: [['connectedAt', 'DESC']] });
  if (any) {
    const userId = any.getDataValue('userId') as string;
    if (userId) return userId;
  }

  throw new AppError('No admin has connected Google Calendar yet', 503);
};

export const isAnyGoogleCalendarConnected = async (): Promise<boolean> => {
  const count = await db.GoogleCalendarConnection.count();
  return count > 0;
};
