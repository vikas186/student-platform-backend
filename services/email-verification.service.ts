import AppError from '../utils/errorHandler';
import { db } from '../config/database';
import type { UserRole } from '../models/User.model';
import { generateOpaqueRefreshToken } from './token.service';
import {
  buildEmailVerificationUrl,
  buildStudentEmailVerificationUrl,
  sendAgentEmailVerificationEmail,
  sendStudentEmailVerificationLinkEmail,
} from './email.service';

const LINK_EXPIRY_MS = 24 * 60 * 60 * 1000;

/** Verification emails must be awaited — signup/resend should fail visibly if Brevo is misconfigured. */
const formatEmailSendError = (err: unknown): string => {
  const msg = err instanceof Error ? err.message : String(err);
  if (/525|unauthorized ip/i.test(msg)) {
    return (
      'Email service is misconfigured: the server IP is not authorized in Brevo. ' +
      'In Brevo go to SMTP & API → Authorized IPs and add this server, ' +
      'or switch BREVO_API_KEY to an xkeysib- REST API key (no IP whitelist required).'
    );
  }
  return (
    'We could not send the verification email. Check that your email address is correct, ' +
    'try again in a few minutes, or use a different inbox (some disposable addresses are blocked).'
  );
};

const sendVerificationEmail = async (task: () => Promise<void>, context: string): Promise<void> => {
  try {
    await task();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[email] ${context} failed:`, msg);
    throw new AppError(formatEmailSendError(err), 503);
  }
};

const invalidateExistingTokens = async (userId: string) => {
  await db.EmailVerificationToken.update({ used: true }, { where: { userId, used: false } });
};

const requiresEmailVerification = (role: UserRole): boolean => role === 'student' || role === 'agent';

export const assertEmailVerifiedForLogin = (user: InstanceType<typeof db.User>) => {
  const role = user.getDataValue('role') as UserRole;
  if (!requiresEmailVerification(role)) return;
  if (!user.getDataValue('emailVerified')) {
    throw new AppError(
      'Please verify your email before signing in. Check your inbox for the verification message.',
      403,
    );
  }
};

const issueStudentLink = async (user: InstanceType<typeof db.User>) => {
  await invalidateExistingTokens(user.id);
  const token = generateOpaqueRefreshToken();
  const expiresAt = new Date(Date.now() + LINK_EXPIRY_MS);
  await db.EmailVerificationToken.create({
    userId: user.id,
    token,
    otp: null,
    kind: 'link',
    used: false,
    expiresAt,
  });
  const verifyUrl = buildStudentEmailVerificationUrl(token);
  await sendVerificationEmail(
    () =>
      sendStudentEmailVerificationLinkEmail({
        to: user.email,
        name: user.name,
        verifyUrl,
      }),
    'student email verification link',
  );
  return verifyUrl;
};

const issueAgentLink = async (user: InstanceType<typeof db.User>) => {
  await invalidateExistingTokens(user.id);
  const token = generateOpaqueRefreshToken();
  const expiresAt = new Date(Date.now() + LINK_EXPIRY_MS);
  await db.EmailVerificationToken.create({
    userId: user.id,
    token,
    otp: null,
    kind: 'link',
    used: false,
    expiresAt,
  });
  const verifyUrl = buildEmailVerificationUrl(token);
  await sendVerificationEmail(
    () =>
      sendAgentEmailVerificationEmail({
        to: user.email,
        name: user.name,
        verifyUrl,
      }),
    'agent email verification link',
  );
  return verifyUrl;
};

export const sendSignupVerificationEmail = async (user: InstanceType<typeof db.User>) => {
  const role = user.getDataValue('role') as UserRole;
  const isDev = process.env.NODE_ENV === 'development';
  if (role === 'student') {
    const verifyUrl = await issueStudentLink(user);
    return { method: 'link' as const, ...(isDev ? { devVerifyUrl: verifyUrl } : {}) };
  }
  if (role === 'agent') {
    const verifyUrl = await issueAgentLink(user);
    return { method: 'link' as const, ...(isDev ? { devVerifyUrl: verifyUrl } : {}) };
  }
  return null;
};

export const verifyStudentOtp = async (email: string, otp: string) => {
  const normalized = String(email).trim().toLowerCase();
  const code = String(otp).trim();
  if (!/^\d{6}$/.test(code)) {
    throw new AppError('Invalid verification code', 400);
  }

  const user = await db.User.findOne({ where: { email: normalized } });
  if (!user) {
    throw new AppError('Invalid verification code', 400);
  }
  if (user.role !== 'student') {
    throw new AppError('This verification code is not valid for this account type', 400);
  }
  if (user.emailVerified) {
    return { alreadyVerified: true, user: user.toSafeObject() };
  }

  const entry = await db.EmailVerificationToken.findOne({
    where: {
      userId: user.id,
      kind: 'otp',
      otp: code,
      used: false,
    },
    order: [['createdAt', 'DESC']],
  });

  if (!entry || entry.expiresAt.getTime() < Date.now()) {
    throw new AppError('Invalid or expired verification code', 400);
  }

  entry.used = true;
  await entry.save();
  user.emailVerified = true;
  await user.save();

  return { alreadyVerified: false, user: user.toSafeObject() };
};

const completeEmailLinkVerification = async (
  entry: InstanceType<typeof db.EmailVerificationToken>,
  user: InstanceType<typeof db.User>,
) => {
  if (user.role !== 'student' && user.role !== 'agent') {
    throw new AppError('Invalid verification link', 400);
  }
  if (user.emailVerified) {
    entry.used = true;
    await entry.save();
    return { alreadyVerified: true, user: user.toSafeObject() };
  }
  entry.used = true;
  await entry.save();
  user.emailVerified = true;
  await user.save();
  return { alreadyVerified: false, user: user.toSafeObject() };
};

export const verifyEmailLink = async (token: string) => {
  const trimmed = String(token).trim();
  if (trimmed.length < 32) {
    throw new AppError('Invalid verification link', 400);
  }

  const entry = await db.EmailVerificationToken.findOne({
    where: { token: trimmed, kind: 'link', used: false },
    include: [{ model: db.User, as: 'user' }],
  });

  if (!entry || entry.expiresAt.getTime() < Date.now()) {
    throw new AppError('Invalid or expired verification link', 400);
  }

  const user = entry.get('user') as InstanceType<typeof db.User> | null;
  if (!user) {
    throw new AppError('Invalid verification link', 400);
  }

  return completeEmailLinkVerification(entry, user);
};

export const verifyStudentEmailLink = verifyEmailLink;

export const verifyAgentEmailLink = verifyEmailLink;

export const resendVerificationEmail = async (email: string) => {
  const normalized = String(email).trim().toLowerCase();
  const user = await db.User.findOne({ where: { email: normalized } });
  if (!user || !requiresEmailVerification(user.role)) {
    return {
      message: 'If an account exists and is unverified, a new verification message has been sent.',
    };
  }
  if (user.emailVerified) {
    throw new AppError('This email is already verified. You can sign in.', 400);
  }

  const sent = await sendSignupVerificationEmail(user);
  return {
    message: 'Verification message sent',
    method: user.role === 'student' || user.role === 'agent' ? ('link' as const) : undefined,
    ...(sent && 'devVerifyUrl' in sent && sent.devVerifyUrl ? { devVerifyUrl: sent.devVerifyUrl } : {}),
    ...(process.env.NODE_ENV === 'development' ? { email: user.email } : {}),
  };
};
