import AppError from '../../../utils/errorHandler';

export type FlywireEnv = 'demo' | 'production';

export const flywireConfig = () => {
  const envRaw = (process.env.FLYWIRE_ENV || 'demo').trim().toLowerCase();
  const env: FlywireEnv = envRaw === 'production' || envRaw === 'prod' ? 'production' : 'demo';
  const gatewayBase =
    env === 'production'
      ? 'https://gateway.flywire.com/v1/transfers.json'
      : 'https://gateway.demo.flywire.com/v1/transfers.json';

  const callbackBase = (
    process.env.FLYWIRE_CALLBACK_BASE_URL ||
    process.env.BACKEND_URL ||
    process.env.APP_URL ||
    `http://localhost:${process.env.PORT || '4001'}`
  )
    .trim()
    .replace(/\/$/, '');

  return {
    env,
    sharedSecret: process.env.FLYWIRE_SHARED_SECRET?.trim() || '',
    paymentDestination: process.env.FLYWIRE_PAYMENT_DESTINATION?.trim() || '',
    gatewayUrl: process.env.FLYWIRE_GATEWAY_URL?.trim() || gatewayBase,
    callbackUrl: `${callbackBase}/api/v1/flywire/webhook`,
    frontendUrl: (process.env.FRONTEND_URL || 'http://localhost:8080').replace(/\/$/, ''),
  };
};

export const isFlywireConfigured = (): boolean => {
  const c = flywireConfig();
  return Boolean(c.sharedSecret && c.paymentDestination);
};

export const assertFlywireConfigured = (): void => {
  if (!isFlywireConfigured()) {
    throw new AppError(
      'Flywire is not configured. Set FLYWIRE_SHARED_SECRET and FLYWIRE_PAYMENT_DESTINATION.',
      503,
    );
  }
};
