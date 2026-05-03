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

const generateToken = async (user: any, expireTime?: jwt.SignOptions['expiresIn']) => {
  const payload = {
    id: user.id,
    email: user.email,
    role: user.role,
  };

  const secretKey = process.env.JWT_SECRET_KEY || 'default_secret_key';
  const expiresIn = expireTime ?? accessExpiresDefault();

  const token = jwt.sign(payload, secretKey, {
    expiresIn,
  });

  return token;
};

const verifyTokenInDb = async (authHeader: any) => {
  const token = authHeader?.split(' ')[1];
  return token && (await db.Token.findOne({ where: { token } }));
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
  handleExpiredToken,
  generateOpaqueRefreshToken,
  refreshTtlMs,
  accessExpiresDefault,
};
