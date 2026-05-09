import { Router } from 'express';
import {
  signup,
  signupUniversityUser,
  signupAdmin,
  loginUser,
  loginAdminUser,
  loginUniversityUser,
  refreshAccessToken,
  logoutUser,
  logoutAllDevices,
  changePassword,
  deleteUser,
  forgotPassword,
} from '../controller/authController';
import { jwtAuthMiddleware } from '../middleware/jwtAuth';
import { requirePermission } from '../middleware/requirePermission';
import validateMiddleware from '../middleware/validate';
import {
  adminSignupJoiSchema,
  loginJoiSchema,
  refreshTokenJoiSchema,
  roleBasedSignupJoiSchema,
  universitySignupJoiSchema,
} from '../validations/auth.validation';

const authRouter: Router = Router();

authRouter
  .post('/signup', validateMiddleware(roleBasedSignupJoiSchema), signup)
  .post('/university/signup', validateMiddleware(universitySignupJoiSchema), signupUniversityUser)
  .post('/university/login', validateMiddleware(loginJoiSchema), loginUniversityUser)
  .post('/admin/signup', validateMiddleware(adminSignupJoiSchema), signupAdmin)
  .post('/admin/login', validateMiddleware(loginJoiSchema), loginAdminUser)
  .post('/login', loginUser)
  .post('/refresh-token', validateMiddleware(refreshTokenJoiSchema), refreshAccessToken)
  .post('/logout', jwtAuthMiddleware(['all']), logoutUser)
  .post('/logout-all-devices', jwtAuthMiddleware(['all']), logoutAllDevices)
  .patch('/change-password', jwtAuthMiddleware(['all']), changePassword)
  .delete('/users/:userId', jwtAuthMiddleware(['admin']), requirePermission('users', 'delete'), deleteUser)
  .post('/forgot-password', forgotPassword);

export default authRouter;
