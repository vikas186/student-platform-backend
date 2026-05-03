import { Router } from 'express';
import {
  signup,
  signupAdmin,
  loginUser,
  loginAdminUser,
  refreshAccessToken,
  logoutUser,
  logoutAllDevices,
  changePassword,
  deleteUser,
  forgotPassword,
} from '../controller/authController';
import { jwtAuthMiddleware } from '../middleware/jwtAuth';
import validateMiddleware from '../middleware/validate';
import {
  adminSignupJoiSchema,
  loginJoiSchema,
  refreshTokenJoiSchema,
  roleBasedSignupJoiSchema,
} from '../validations/auth.validation';

const authRouter: Router = Router();

authRouter
  .post('/signup', validateMiddleware(roleBasedSignupJoiSchema), signup)
  .post('/admin/signup', validateMiddleware(adminSignupJoiSchema), signupAdmin)
  .post('/admin/login', validateMiddleware(loginJoiSchema), loginAdminUser)
  .post('/login', loginUser)
  .post('/refresh-token', validateMiddleware(refreshTokenJoiSchema), refreshAccessToken)
  .post('/logout', jwtAuthMiddleware(['all']), logoutUser)
  .post('/logout-all-devices', jwtAuthMiddleware(['all']), logoutAllDevices)
  .patch('/change-password', jwtAuthMiddleware(['all']), changePassword)
  .delete('/users/:userId', jwtAuthMiddleware(['admin']), deleteUser)
  .post('/forgot-password', forgotPassword);

export default authRouter;
