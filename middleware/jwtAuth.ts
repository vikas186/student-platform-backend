import jwt, { type JwtPayload } from 'jsonwebtoken';
import { catchAsyncError } from './catchAsyncError';
import AppError from '../utils/errorHandler';
import constant from '../constant';
import { verifyTokenInDb } from '../services/token.service';
import { db } from '../config/database';
import { Op } from 'sequelize';
import { isUuid } from '../utils/isUuid';

const secretKey = () => process.env.JWT_SECRET_KEY || 'default_secret_key';

export const verifyJwtToken = async (req: any, res: any, next: any) => {
  try {
    const { token } = req.body;

    const resetTokenEntry: any = await db.PasswordResetToken.findOne({
      where: { token, used: false, expiresAt: { [Op.gt]: new Date() } },
      include: { model: db.User, as: 'user' },
    });

    if (!resetTokenEntry || !resetTokenEntry.user) {
      return next(new AppError('Invalid or expired token', constant.msgCode.unAuthorizedUser));
    }

    const u = resetTokenEntry.user;
    req.user = { ...(typeof u?.get === 'function' ? u.get({ plain: true }) : u), resetTokenEntry };
    next();
  } catch (err) {
    console.error(err);
    next(new AppError('Unauthorized access', constant.msgCode.unAuthorizedUser));
  }
};

export const jwtAuthMiddleware = (allowedRoles: string[]) =>
  catchAsyncError(async (req: any, res: any, next: any) => {
    const authHeader = req.headers.authorization;
    const bearerToken = authHeader?.split(' ')[1];

    if (!bearerToken) {
      return res.status(401).json({
        status: constant.msgType.failedStatus,
        code: constant.msgCode.unAuthorizedUser,
        message: constant.msg.invalidToken,
      });
    }

    let decoded: JwtPayload & { id?: unknown };
    try {
      const result = jwt.verify(bearerToken, secretKey());
      if (typeof result === 'string' || result === null || typeof result !== 'object') {
        return next(new AppError('Invalid token', constant.msgCode.forbidden));
      }
      decoded = result as JwtPayload & { id?: unknown };
    } catch (e: unknown) {
      const name = e && typeof e === 'object' && 'name' in e ? (e as { name: string }).name : '';
      if (name === 'TokenExpiredError') {
        // Do not delete the DB session row — refresh-token rotation needs it intact.
        return next(new AppError('Token has expired. Please log in again.', constant.msgCode.unAuthorizedUser));
      }
      return next(new AppError('Invalid token', constant.msgCode.forbidden));
    }

    const userId = typeof decoded.id === 'string' && isUuid(decoded.id) ? decoded.id : null;
    if (!userId) {
      return next(new AppError('Invalid token', constant.msgCode.forbidden));
    }

    const tokenSession = await verifyTokenInDb(authHeader);
    if (!tokenSession) {
      return res.status(401).json({
        status: constant.msgType.failedStatus,
        code: constant.msgCode.unAuthorizedUser,
        message: constant.msg.invalidToken,
      });
    }

    const user = await db.User.findByPk(userId);
    if (!user || !user.status) {
      return res.status(401).json({
        status: constant.msgType.failedStatus,
        code: constant.msgCode.unAuthorizedUser,
        message: constant.msg.invalidToken,
      });
    }

    const userJson: Record<string, unknown> = { ...user.toJSON() };
    delete userJson.password;

    if (allowedRoles.includes('all') || allowedRoles.includes(userJson.role as string)) {
      req.user = userJson;
      return next();
    }

    next(new AppError(`Access denied. ${allowedRoles} privileges required.`, constant.msgCode.forbidden));
  });
