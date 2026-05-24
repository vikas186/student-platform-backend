import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { db } from '../config/database';

const accessExpiresDefault = (): jwt.SignOptions['expiresIn'] =>
  (process.env.JWT_ACCESS_EXPIRES as jwt.SignOptions['expiresIn']) || '15m';

const refreshTtlMs = (): number => {
  const days = parseInt(process.env.JWT_REFRESH_DAYS || '7', 10);
  return Math.max(1, days) * 24 * 60 * 60 * 1000;
};

const generateOpaqueRefreshToken = (): string => crypto.randomBytes(48).toString('hex');

const secretKey = () => process.env.JWT_SECRET_KEY || 'default_secret_key';

const generateToken = async (user: any, expireTime?: jwt.SignOptions['expiresIn']) => {
  const payload = {
    id: user.id,
    email: user.email,
    role: user.role,
  };

  const expiresIn = expireTime ?? accessExpiresDefault();

  const token = jwt.sign(payload, secretKey(), {
    expiresIn,
  });

  return token;
};

/** Resolve DB session for a Bearer JWT (exact match, then active session for same user). */
const resolveSessionForBearer = async (bearerToken: string | null | undefined) => {
  if (!bearerToken) return null;

  const direct = await db.Token.findOne({ where: { token: bearerToken } });
  if (direct) return direct;

  // After refresh the access JWT in DB is replaced; the previous JWT may still be within exp.
  try {
    const decoded = jwt.verify(bearerToken, secretKey());
    if (typeof decoded === 'string' || decoded === null || typeof decoded !== 'object') return null;
    const userId = (decoded as jwt.JwtPayload & { id?: string }).id;
    if (!userId || typeof userId !== 'string') return null;

    return db.Token.findOne({
      where: { userId },
      order: [['updatedAt', 'DESC']],
    });
  } catch {
    return null;
  }
};

const verifyTokenInDb = async (authHeader: string | undefined) => {
  const token = authHeader?.split(' ')[1];
  return resolveSessionForBearer(token);
};

const handleExpiredToken = async (authHeader: any) => {
  const token = authHeader?.split(' ')[1];
  if (token) {
    const deleted = await db.Token.destroy({ where: { token } });
    console.log(deleted ? 'Expired token removed.' : 'Expired token not found.');
  }
};

export {
  generateToken,
  verifyTokenInDb,
  resolveSessionForBearer,
  handleExpiredToken,
  generateOpaqueRefreshToken,
  refreshTtlMs,
  accessExpiresDefault,
};
