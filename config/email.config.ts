export type EmailTransportMode = 'api' | 'smtp' | 'disabled';

export type EmailConfig = {
  enabled: boolean;
  mode: EmailTransportMode;
  apiKey: string;
  smtpHost: string;
  smtpPort: number;
  smtpLogin: string;
  smtpPass: string;
  from: string;
  fromName: string;
  frontendUrl: string;
  brandName: string;
};

const readKey = () => process.env.BREVO_API_KEY?.trim() || '';

export const resolveEmailTransportMode = (apiKey: string): EmailTransportMode => {
  if (!apiKey) return 'disabled';
  if (apiKey.startsWith('xkeysib-')) return 'api';
  if (apiKey.startsWith('xsmtpsib-')) return 'smtp';
  return 'smtp';
};

/** Returns a user-facing configuration error, or null when email can send. */
export const validateEmailConfig = (cfg: EmailConfig): string | null => {
  if (!cfg.enabled) return 'BREVO_API_KEY is not set in config/.env.development';
  if (cfg.mode === 'api') return null;
  if (!cfg.smtpLogin) {
    return (
      'BREVO_SMTP_LOGIN is missing. In Brevo go to SMTP & API → SMTP tab and copy the SMTP login ' +
      '(format like 123abc@smtp-brevo.com). It is not the same as EMAIL_FROM.'
    );
  }
  return null;
};

export const emailConfig = (): EmailConfig => {
  const from = process.env.EMAIL_FROM?.trim() || 'info@educratsglobal.com';
  const apiKey = readKey();
  const mode = resolveEmailTransportMode(apiKey);
  const smtpLogin =
    process.env.BREVO_SMTP_LOGIN?.trim() ||
    process.env.BREVO_SMTP_USER?.trim() ||
    '';

  return {
    enabled: Boolean(apiKey),
    mode,
    apiKey,
    smtpHost: process.env.BREVO_SMTP_HOST?.trim() || 'smtp-relay.brevo.com',
    smtpPort: Number(process.env.BREVO_SMTP_PORT || 587),
    smtpLogin,
    smtpPass: apiKey,
    from,
    fromName: process.env.EMAIL_FROM_NAME?.trim() || 'Uniwizer',
    frontendUrl: (process.env.FRONTEND_URL || 'http://localhost:8080').replace(/\/$/, ''),
    brandName: process.env.EMAIL_BRAND_NAME?.trim() || 'Uniwizer',
  };
};
