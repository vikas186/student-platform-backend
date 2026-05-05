import { NextFunction, Request, Response } from 'express';
import { catchAsyncError } from './catchAsyncError';
import AppError from '../utils/errorHandler';
import constant from '../constant';
import { USER_ROLES, type UserRole } from '../models/User.model';
import { roleHasPermission } from '../services/rolePermissions.service';

/**
 * After `jwtAuthMiddleware`, checks the DB-backed permission matrix for `req.user.role`.
 * Admins short-circuit to allowed in `roleHasPermission`.
 */
export const requirePermission = (moduleKey: string, actionKey: string) =>
  catchAsyncError(async (req: Request, _res: Response, next: NextFunction) => {
    const roleRaw = req.user?.role;
    const role = typeof roleRaw === 'string' ? roleRaw : '';
    if (!USER_ROLES.includes(role as UserRole)) {
      return next(new AppError('Unauthorized', constant.msgCode.unAuthorizedUser));
    }
    const allowed = await roleHasPermission(role as UserRole, moduleKey, actionKey);
    if (!allowed) {
      return next(
        new AppError(`Forbidden — missing permission: ${moduleKey}.${actionKey}`, constant.msgCode.forbidden),
      );
    }
    next();
  });
