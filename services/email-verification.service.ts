import crypto from 'crypto';
import AppError from '../utils/errorHandler';
import { db } from '../config/database';
import type { UserRole } from '../models/User.model';
import { generateOpaqueRefreshToken } from './token.service';
import {
  buildEmailVerificationUrl,
  dispatchEmail,
  sendAgentEmailVerificationEmail,
  sendStudentEmailVerificationOtpEmail,
} from './email.service';

const OTP_EXPIRY_MS = 15 * 60 * 1000;
const LINK_EXPIRY_MS = 24 * 60 * 60 * 1000;

const generateOtp = (): string => String(crypto.randomInt(100000, 1000000));

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

const issueStudentOtp = async (user: InstanceType<typeof db.User>) => {
  await invalidateExistingTokens(user.id);
  const otp = generateOtp();
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MS);
  await db.EmailVerificationToken.create({
    userId: user.id,
    otp,
    token: null,
    kind: 'otp',
    used: false,
    expiresAt,
  });
  dispatchEmail(
    () =>
      sendStudentEmailVerificationOtpEmail({
        to: user.email,
        name: user.name,
        otp,
      }),
    'student email verification OTP',
  );
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
  dispatchEmail(
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
  if (role === 'student') {
    await issueStudentOtp(user);
    return { method: 'otp' as const };
  }
  if (role === 'agent') {
    await issueAgentLink(user);
    return { method: 'link' as const };
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

export const verifyAgentEmailLink = async (token: string) => {
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
  if (user.role !== 'agent') {
    throw new AppError('This verification link is not valid for this account type', 400);
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

  await sendSignupVerificationEmail(user);
  return {
    message: 'Verification message sent',
    method: user.role === 'student' ? ('otp' as const) : ('link' as const),
    ...(process.env.NODE_ENV === 'development' ? { email: user.email } : {}),
  };
};
