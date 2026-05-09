import { Op } from 'sequelize';
import AppError from '../utils/errorHandler';
import type { UserRole } from '../models/User.model';
import {
  generateToken,
  generateOpaqueRefreshToken,
  refreshTtlMs,
} from './token.service';
import { db } from '../config/database';
import { getPermissionMatrixSliceForRole } from './rolePermissions.service';

type SignupStudentBody = {
  fullName: string;
  email: string;
  password: string;
  phoneNumber: string;
  targetCountries: string[];
};

const signupStudent = async (body: SignupStudentBody) => {
  if (await db.User.findOne({ where: { email: body.email } })) {
    throw new AppError('Email already taken', 400);
  }

  const user = await db.User.create({
    name: body.fullName,
    email: body.email,
    password: body.password,
    role: 'student',
    phone: body.phoneNumber,
    status: true,
  });

  await db.StudentProfile.create({
    userId: user.id,
    academicDetails: null,
    preferredCountry: null,
    targetCountries: body.targetCountries,
  });

  return user.toSafeObject();
};

type SignupAgentBody = {
  fullName: string;
  email: string;
  password: string;
  agencyName: string;
  primaryMarket: string;
  phoneNumber?: string | null;
};

const signupAgent = async (body: SignupAgentBody) => {
  if (await db.User.findOne({ where: { email: body.email } })) {
    throw new AppError('Email already taken', 400);
  }

  const phone =
    body.phoneNumber && String(body.phoneNumber).trim() !== '' ? String(body.phoneNumber).trim() : null;

  const user = await db.User.create({
    name: body.fullName,
    email: body.email,
    password: body.password,
    role: 'agent',
    phone,
    status: true,
  });

  await db.AgentProfile.create({
    userId: user.id,
    agencyName: body.agencyName,
    primaryMarket: body.primaryMarket,
    logoUrl: null,
    subscriptionPlanId: null,
  });

  return user.toSafeObject();
};

type SignupByRoleBody = {
  role: 'student' | 'agent' | 'university';
  fullName?: string;
  email: string;
  password: string;
  phoneNumber?: string | null;
  targetCountries?: string[];
  agencyName?: string;
  primaryMarket?: string;
  universityId?: number;
  institutionName?: string;
  country?: string;
};

/** Match Enroll UI: find by name+country or create institution row. */
const findOrCreateUniversityForSignup = async (institutionName: string, country: string) => {
  const name = institutionName.trim();
  const countryNorm = country.trim() || 'General';
  let uni = await db.University.findOne({
    where: {
      [Op.and]: [{ name: { [Op.iLike]: name } }, { country: { [Op.iLike]: countryNorm } }],
    },
  });
  if (!uni) {
    uni = await db.University.create({
      name,
      country: countryNorm,
      status: true,
    });
  }
  return uni;
};

const createUniversityPortalUser = async (params: {
  userDisplayName: string;
  email: string;
  password: string;
  universityId: number;
}) => {
  const emailNorm = String(params.email).trim().toLowerCase();
  if (await db.User.findOne({ where: { email: emailNorm } })) {
    throw new AppError('Email already taken', 400);
  }
  const user = await db.User.create({
    name: params.userDisplayName,
    email: emailNorm,
    password: params.password,
    role: 'university',
    phone: null,
    status: true,
  });
  await db.UniversityProfile.create({
    userId: user.id,
    universityId: params.universityId,
    jobTitle: null,
  });
  return user.toSafeObject();
};

const signupUniversity = async (body: {
  fullName: string;
  email: string;
  password: string;
  universityId?: number;
  institutionName?: string;
  country?: string;
}) => {
  let universityId: number;
  let userDisplayName: string;

  const hasId = body.universityId != null && Number(body.universityId) >= 1;
  const hasInst =
    typeof body.institutionName === 'string' &&
    body.institutionName.trim().length > 0 &&
    typeof body.country === 'string' &&
    body.country.trim().length > 0;

  if (hasId && hasInst) {
    throw new AppError('Provide either universityId or institutionName and country, not both', 400);
  }
  if (!hasId && !hasInst) {
    throw new AppError('Provide universityId and fullName, or institutionName and country', 400);
  }

  if (hasId) {
    if (!body.fullName?.trim()) {
      throw new AppError('fullName is required when universityId is set', 400);
    }
    const uni = await db.University.findByPk(Number(body.universityId));
    if (!uni) {
      throw new AppError('University not found', 404);
    }
    universityId = uni.id;
    userDisplayName = body.fullName.trim();
  } else {
    const uni = await findOrCreateUniversityForSignup(body.institutionName!, body.country!);
    universityId = uni.id;
    userDisplayName = body.institutionName!.trim();
  }

  return createUniversityPortalUser({
    userDisplayName,
    email: body.email,
    password: body.password,
    universityId,
  });
};

const signupByRole = async (body: SignupByRoleBody) => {
  if (body.role === 'student') {
    return signupStudent({
      fullName: body.fullName as string,
      email: body.email,
      password: body.password,
      phoneNumber: body.phoneNumber as string,
      targetCountries: body.targetCountries as string[],
    });
  }
  if (body.role === 'university') {
    return signupUniversity({
      fullName: body.fullName ?? '',
      email: body.email,
      password: body.password,
      universityId: body.universityId,
      institutionName: body.institutionName,
      country: body.country,
    });
  }
  return signupAgent({
    fullName: body.fullName as string,
    email: body.email,
    password: body.password,
    agencyName: body.agencyName as string,
    primaryMarket: body.primaryMarket as string,
    phoneNumber: body.phoneNumber,
  });
};

/** Issue access + refresh tokens and persist session (same as login response shape). */
const createAuthSession = async (user: InstanceType<typeof db.User>) => {
  const token = await generateToken(user);
  const refreshToken = generateOpaqueRefreshToken();
  const refreshExpiresAt = new Date(Date.now() + refreshTtlMs());

  if (!token) {
    throw new AppError('Something went wrong', 400);
  }

  await db.Token.create({
    token,
    refreshToken,
    refreshExpiresAt,
    userId: user.id,
  });

  const safe = user.toSafeObject() as Record<string, unknown>;
  const permissions = await getPermissionMatrixSliceForRole(user.role as UserRole);
  return { token, refreshToken, user: { ...safe, permissions } };
};

const loginService = async (email: any, password: any) => {
  const user = await db.User.findOne({ where: { email } });
  if (!user || !(await user.login(password))) {
    throw new AppError('Invalid email or password', 400);
  }
  if (!user.status) {
    throw new AppError('You are not allowed to login', 400);
  }

  return createAuthSession(user);
};

type SignupAdminBody = {
  fullName: string;
  email: string;
  password: string;
  signupSecret?: string | null;
};

/**
 * Creates a user with role `admin` (no student/agent profile).
 * - **First admin**: allowed without secret unless `ADMIN_SIGNUP_SECRET` is set in env (then it must match).
 * - **Further admins**: require `signupSecret` body === `ADMIN_SIGNUP_SECRET` env (env must be non-empty).
 */
const signupAdmin = async (body: SignupAdminBody) => {
  const adminCount = await db.User.count({ where: { role: 'admin' } });
  const envSecret = (process.env.ADMIN_SIGNUP_SECRET || '').trim();
  const provided = body.signupSecret === undefined || body.signupSecret === null ? '' : String(body.signupSecret).trim();

  if (adminCount > 0) {
    if (!envSecret) {
      throw new AppError(
        'Admin registration is disabled. Set ADMIN_SIGNUP_SECRET on the server and send it as signupSecret.',
        403,
      );
    }
    if (provided !== envSecret) {
      throw new AppError('Invalid admin signup secret', 403);
    }
  } else if (envSecret && provided !== envSecret) {
    throw new AppError('Invalid admin signup secret', 403);
  }

  const email = String(body.email).trim().toLowerCase();
  if (await db.User.findOne({ where: { email } })) {
    throw new AppError('Email already taken', 400);
  }

  const user = await db.User.create({
    name: String(body.fullName).trim(),
    email,
    password: body.password,
    role: 'admin',
    phone: null,
    status: true,
  });

  return user.toSafeObject();
};

const loginAdminService = async (email: any, password: any) => {
  const user = await db.User.findOne({ where: { email: String(email).trim().toLowerCase() } });
  if (!user || !(await user.login(password))) {
    throw new AppError('Invalid email or password', 400);
  }
  if (user.role !== 'admin') {
    throw new AppError('Access denied. This account is not an administrator.', 403);
  }
  if (!user.status) {
    throw new AppError('You are not allowed to login', 400);
  }

  return createAuthSession(user);
};

const loginUniversityService = async (email: any, password: any) => {
  const user = await db.User.findOne({ where: { email: String(email).trim().toLowerCase() } });
  if (!user || !(await user.login(password))) {
    throw new AppError('Invalid email or password', 400);
  }
  if (user.role !== 'university') {
    throw new AppError('Access denied. This account is not a university portal user.', 403);
  }
  if (!user.status) {
    throw new AppError('You are not allowed to login', 400);
  }

  return createAuthSession(user);
};

const refreshSessionService = async (refreshToken: string) => {
  if (!refreshToken || typeof refreshToken !== 'string') {
    throw new AppError('Refresh token is required', 400);
  }

  const trimmed = refreshToken.trim();
  const session = await db.Token.findOne({ where: { refreshToken: trimmed } });
  if (!session) {
    throw new AppError('Invalid or expired refresh token', 401);
  }
  /** Only treat as expired when a concrete expiry exists and is in the past (NULL = legacy row, still redeem once). */
  const refreshExpired =
    session.refreshExpiresAt != null && session.refreshExpiresAt.getTime() < Date.now();
  if (refreshExpired) {
    throw new AppError('Invalid or expired refresh token', 401);
  }

  const user = await db.User.findByPk(session.userId);
  if (!user || !user.status) {
    throw new AppError('Invalid or expired refresh token', 401);
  }

  const newAccess = await generateToken(user);
  const newRefresh = generateOpaqueRefreshToken();
  const newRefreshExpiresAt = new Date(Date.now() + refreshTtlMs());

  await session.update({
    token: newAccess,
    refreshToken: newRefresh,
    refreshExpiresAt: newRefreshExpiresAt,
  });

  const safe = user.toSafeObject() as Record<string, unknown>;
  const permissions = await getPermissionMatrixSliceForRole(user.role as UserRole);
  return { token: newAccess, refreshToken: newRefresh, user: { ...safe, permissions } };
};

const logoutUserService = async (userId: any, token: any) => {
  if (!token) throw new AppError('Token is required for logout', 400);

  const result = await db.Token.destroy({
    where: { userId, token },
  });

  if (!result) throw new AppError('Token not found or already invalidated', 400);

  return { success: true, message: 'Logged out successfully' };
};

const logoutAllDevicesService = async (userId: any) => {
  if (!userId) throw new AppError('User ID is required for logout from all devices', 400);

  const result = await db.Token.destroy({
    where: { userId },
  });

  if (!result) throw new AppError('No active sessions found for this user', 404);

  return { success: true, message: 'Logged out from all devices successfully' };
};

const changePasswordService = async (userId: any, oldPassword: any, newPassword: any) => {
  const user: any = await db.User.findByPk(userId);
  if (!user) {
    throw new AppError('User not found', 400);
  }

  const isMatch = await user.login(oldPassword);
  if (!isMatch) {
    throw new AppError('Incorrect password', 400);
  }
  user.password = newPassword;
  await user.save();
  return user.toSafeObject();
};

const resetPasswordUpdateService = async (userId: any, password: any) => {
  const user = await db.User.findByPk(userId);
  if (!user) {
    throw new AppError('User not found', 404);
  }
  user.password = password;
  await user.save();
  return user.toSafeObject();
};

const resetPasswordService = async (email: any) => {
  const user = await db.User.findOne({ where: { email } });
  if (!user) {
    throw new AppError('User not found', 400);
  }

  const token = await generateToken(user);
  const expiresAt = new Date(Date.now() + 3600 * 1000);

  await db.PasswordResetToken.create({
    token,
    expiresAt,
    userId: user.id,
  });

  const resetUrl = `${process.env.BACKEND_URL}/change-password?token=${token}`;

  return { message: 'Reset password email sent', resetUrl };
};

const generateRandomPassword = (length = 12) => {
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#=';
  let password = '';
  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * charset.length);
    password += charset[randomIndex];
  }
  return password;
};

export default {
  signupByRole,
  signupAdmin,
  loginService,
  loginAdminService,
  loginUniversityService,
  refreshSessionService,
  logoutUserService,
  changePasswordService,
  resetPasswordService,
  generateRandomPassword,
  resetPasswordUpdateService,
  logoutAllDevicesService,
};
