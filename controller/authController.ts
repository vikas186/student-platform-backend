import { Request, Response } from 'express';
import { db } from '../config/database';
import constant from '../constant';
import { catchAsyncError } from '../middleware/catchAsyncError';
import authService from '../services/auth.service';
import dbServices from '../services/db.services';
import AppError from '../utils/errorHandler';
import { isUuid } from '../utils/isUuid';
import { dispatchEmail, sendWelcomeEmail } from '../services/email.service';
import {
  resendVerificationEmail,
  verifyAgentEmailLink,
  verifyStudentEmailLink,
  verifyStudentOtp,
} from '../services/email-verification.service';
import { dispatchPartnershipAgreementIfNeeded } from '../services/agent-agreement.service';

const dispatchWelcomeEmail = (user: Record<string, unknown>, role: 'student' | 'agent' | 'university' | 'admin') => {
  const email = typeof user.email === 'string' ? user.email : '';
  const name = typeof user.name === 'string' ? user.name : 'there';
  if (!email) return;
  dispatchEmail(() => sendWelcomeEmail({ to: email, name, role }), `welcome (${role})`);
};

const signup = catchAsyncError(async (req: Request, res: Response) => {
  const user = await authService.signupByRole(req.body);
  const role = req.body.role as string;
  const message =
    role === 'agent'
      ? 'Agent account created. Check your email for a verification link before signing in.'
      : role === 'university'
        ? 'University account created successfully'
        : 'Student account created. Check your email for a verification link before signing in.';
  if (role === 'university') {
    dispatchWelcomeEmail(user as Record<string, unknown>, role);
  }
  res.status(201).json({
    success: true,
    message,
    data: {
      user,
      requiresEmailVerification: role === 'student' || role === 'agent',
    },
  });
});

const signupUniversityUser = catchAsyncError(async (req: Request, res: Response) => {
  const user = await authService.signupByRole({
    role: 'university',
    fullName: typeof req.body.fullName === 'string' ? req.body.fullName : '',
    email: req.body.email,
    password: req.body.password,
    universityId: req.body.universityId,
    institutionName: req.body.institutionName,
    country: req.body.country,
  });
  dispatchWelcomeEmail(user as Record<string, unknown>, 'university');
  res.status(201).json({
    success: true,
    message: 'University account created successfully',
    data: { user },
  });
});

const signupAdmin = catchAsyncError(async (req: Request, res: Response) => {
  const user = await authService.signupAdmin(req.body);
  dispatchWelcomeEmail(user as Record<string, unknown>, 'admin');
  res.status(201).json({
    success: true,
    message: 'Admin account created successfully',
    data: { user },
  });
});

const loginUser = catchAsyncError(async (req: Request, res: Response) => {
  const { email, password } = req.body;
  const { token, refreshToken, user } = await authService.loginService(email, password);
  res.status(200).json({
    success: true,
    message: 'Login successful',
    token,
    refreshToken,
    data: user,
  });
});

const loginAdminUser = catchAsyncError(async (req: Request, res: Response) => {
  const { email, password } = req.body;
  const { token, refreshToken, user } = await authService.loginAdminService(email, password);
  res.status(200).json({
    success: true,
    message: 'Admin login successful',
    token,
    refreshToken,
    data: user,
  });
});

const loginUniversityUser = catchAsyncError(async (req: Request, res: Response) => {
  const { email, password } = req.body;
  const { token, refreshToken, user } = await authService.loginUniversityService(email, password);
  res.status(200).json({
    success: true,
    message: 'University login successful',
    token,
    refreshToken,
    data: user,
  });
});

const refreshAccessToken = catchAsyncError(async (req: Request, res: Response) => {
  const refreshToken = req.body.refreshToken ?? req.body.refresh_token;
  const { token, refreshToken: newRefreshToken, user } = await authService.refreshSessionService(refreshToken);
  res.status(200).json({
    success: true,
    message: 'Token refreshed successfully',
    token,
    refreshToken: newRefreshToken,
    data: user,
  });
});

const logoutUser = catchAsyncError(async (req: Request, res: Response) => {
  const user: any = req?.user;
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) return res.status(400).json({ success: false, message: 'No token provided' });

  const result = await authService.logoutUserService(user?.id, token);
  res.status(200).json(result);
});

const logoutAllDevices = catchAsyncError(async (req: Request, res: Response) => {
  const user: any = req?.user;

  if (!user?.id) {
    return res.status(400).json({ success: false, message: 'User ID is missing' });
  }

  const result = await authService.logoutAllDevicesService(user.id);
  res.status(200).json(result);
});

const changePassword = catchAsyncError(async (req: Request, res: Response) => {
  const { oldPassword, newPassword } = req.body;
  const user: any = req?.user;

  const data = await authService.changePasswordService(user?.id, oldPassword, newPassword);

  res.status(constant.msgCode.successCode).json({
    success: constant.msgType.successStatus,
    message: constant.msg.changePassword,
    data,
  });
});

const forgotPassword = catchAsyncError(async (req: Request, res: Response) => {
  const { email } = req.body;

  const user = await authService.resetPasswordService(email);

  res.status(constant.msgCode.successCode).json({
    success: constant.msgType.successStatus,
    message: constant.msg.passwordChangeEmail,
    data: user,
  });
});

const resetPassword = catchAsyncError(async (req: Request, res: Response) => {
  const { password } = req.body;
  const user: any = req.user;
  const data = await authService.resetPasswordUpdateService(user?.id, password);
  if (user?.resetTokenEntry) {
    user.resetTokenEntry.used = true;
    await user.resetTokenEntry.save();
  }
  res.status(constant.msgCode.successCode).json({
    success: constant.msgType.successStatus,
    message: constant.msg.resetPassword,
    data,
  });
});

const verifyStudentEmailOtp = catchAsyncError(async (req: Request, res: Response) => {
  const { email, otp } = req.body;
  const result = await verifyStudentOtp(email, otp);
  if (!result.alreadyVerified) {
    dispatchWelcomeEmail(result.user as Record<string, unknown>, 'student');
  }
  res.status(200).json({
    success: true,
    message: result.alreadyVerified
      ? 'Email is already verified. You can sign in.'
      : 'Email verified successfully. You can sign in now.',
    data: result.user,
  });
});

const verifyStudentEmail = catchAsyncError(async (req: Request, res: Response) => {
  const token = req.body.token ?? req.query.token;
  const result = await verifyStudentEmailLink(String(token ?? ''));
  if (!result.alreadyVerified) {
    dispatchWelcomeEmail(result.user as Record<string, unknown>, 'student');
  }
  res.status(200).json({
    success: true,
    message: result.alreadyVerified
      ? 'Email is already verified. You can sign in.'
      : 'Email verified successfully. You can sign in now.',
    data: result.user,
  });
});

const verifyAgentEmail = catchAsyncError(async (req: Request, res: Response) => {
  const token = req.body.token ?? req.query.token;
  const result = await verifyAgentEmailLink(String(token ?? ''));
  if (!result.alreadyVerified) {
    dispatchWelcomeEmail(result.user as Record<string, unknown>, 'agent');
    const userId = typeof result.user.id === 'string' ? result.user.id : '';
    if (userId) dispatchPartnershipAgreementIfNeeded(userId);
  }
  res.status(200).json({
    success: true,
    message: result.alreadyVerified
      ? 'Email is already verified. You can sign in.'
      : 'Email verified successfully. You can sign in now.',
    data: result.user,
  });
});

const resendEmailVerification = catchAsyncError(async (req: Request, res: Response) => {
  const result = await resendVerificationEmail(req.body.email);
  res.status(200).json({
    success: true,
    message: result.message,
    data: result,
  });
});

const deleteUser = catchAsyncError(async (req: Request, res: Response) => {
  const { userId } = req.params;
  if (!isUuid(userId)) {
    throw new AppError('Invalid user id', 400);
  }
  const deletedUser = await dbServices.removeDocumentById(db.User, userId);
  if (!deletedUser) throw new AppError("Couldn't delete user", 400);
  res.status(constant.msgCode.successCode).json({
    success: true,
    message: 'User deleted successfully',
  });
});

export {
  loginUser,
  loginAdminUser,
  loginUniversityUser,
  refreshAccessToken,
  signup,
  signupUniversityUser,
  signupAdmin,
  logoutUser,
  changePassword,
  forgotPassword,
  resetPassword,
  deleteUser,
  logoutAllDevices,
  verifyStudentEmailOtp,
  verifyStudentEmail,
  verifyAgentEmail,
  resendEmailVerification,
};
