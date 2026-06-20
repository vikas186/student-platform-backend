import dotenv from 'dotenv';
dotenv.config({ path: 'config/.env.development' });
import { emailConfig, validateEmailConfig } from '../config/email.config';
import { sendPasswordResetEmail, verifyEmailTransport } from '../services/email.service';

async function main() {
  const cfg = emailConfig();
  console.log('Mode:', cfg.mode);
  console.log('From:', cfg.from);
  console.log('SMTP login:', cfg.smtpLogin || '(not set)');

  const configError = validateEmailConfig(cfg);
  if (configError) {
    console.error('CONFIG ERROR:', configError);
    process.exit(1);
  }

  const verify = await verifyEmailTransport();
  console.log(verify.ok ? 'VERIFY OK:' : 'VERIFY FAIL:', verify.message);
  if (!verify.ok) process.exit(1);

  const to = process.argv[2] || 'vikas1861997@yopmail.com';
  await sendPasswordResetEmail({
    to,
    name: 'Test User',
    resetUrl: `${cfg.frontendUrl}/reset-password?token=test-token`,
  });
  console.log('Test email dispatched to', to);
}

void main().catch(err => {
  console.error('FAILED:', err instanceof Error ? err.message : err);
  process.exit(1);
});
