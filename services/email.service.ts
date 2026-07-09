import nodemailer from 'nodemailer';
import { BrevoClient } from '@getbrevo/brevo';
import type Mail from 'nodemailer/lib/mailer';
import { emailConfig, validateEmailConfig } from '../config/email.config';
import {
  agentStudentCredentialsTemplate,
  appointmentCancelledTemplate,
  appointmentConfirmationTemplate,
  appointmentReminderTemplate,
  applicationStatusTemplate,
  agentEmailVerificationTemplate,
  agentPartnershipAgreementTemplate,
  passwordResetTemplate,
  promotionTemplate,
  studentEmailVerificationLinkTemplate,
  studentEmailVerificationOtpTemplate,
  welcomeTemplate,
} from './email.templates';

let smtpTransporter: nodemailer.Transporter | null = null;
let brevoClient: BrevoClient | null = null;

const getSmtpTransporter = () => {
  if (smtpTransporter) return smtpTransporter;
  const cfg = emailConfig();
  smtpTransporter = nodemailer.createTransport({
    host: cfg.smtpHost,
    port: cfg.smtpPort,
    secure: cfg.smtpPort === 465,
    requireTLS: cfg.smtpPort === 587,
    auth: {
      user: cfg.smtpLogin,
      pass: cfg.smtpPass,
    },
  });
  return smtpTransporter;
};

const getBrevoClient = () => {
  if (brevoClient) return brevoClient;
  const cfg = emailConfig();
  brevoClient = new BrevoClient({ apiKey: cfg.apiKey });
  return brevoClient;
};

const sendViaApi = async (options: {
  to: string;
  subject: string;
  html: string;
  text?: string;
  attachments?: { name: string; content: string }[];
}): Promise<void> => {
  const cfg = emailConfig();
  const client = getBrevoClient();
  try {
    await client.transactionalEmails.sendTransacEmail({
      subject: options.subject,
      htmlContent: options.html,
      textContent: options.text,
      sender: { name: cfg.fromName, email: cfg.from },
      to: [{ email: options.to }],
      ...(options.attachments?.length ? { attachment: options.attachments } : {}),
    });
  } catch (err: unknown) {
    const detail =
      err && typeof err === 'object' && 'response' in err
        ? JSON.stringify(
            (err as { response?: { body?: unknown; data?: unknown } }).response?.body ??
              (err as { response?: { data?: unknown } }).response?.data,
          )
        : err instanceof Error
          ? err.message
          : String(err);
    console.error(`[email] Brevo API error → ${options.to}:`, detail);
    throw err;
  }
};

const sendViaSmtp = async (options: Mail.Options): Promise<void> => {
  const cfg = emailConfig();
  const transport = getSmtpTransporter();
  await transport.sendMail({
    from: `"${cfg.fromName}" <${cfg.from}>`,
    ...options,
  });
};

const sendMail = async (options: Mail.Options): Promise<void> => {
  const cfg = emailConfig();
  const configError = validateEmailConfig(cfg);
  if (configError) {
    throw new Error(configError);
  }

  const to = typeof options.to === 'string' ? options.to : Array.isArray(options.to) ? String(options.to[0]) : '';
  if (!to) throw new Error('Email recipient (to) is required');

  if (cfg.mode === 'api') {
    const attachments = Array.isArray(options.attachments)
      ? options.attachments
          .filter((a): a is { filename: string; content: Buffer } => {
            return Boolean(a && typeof a === 'object' && 'filename' in a && Buffer.isBuffer(a.content));
          })
          .map(a => ({
            name: a.filename,
            content: a.content.toString('base64'),
          }))
      : undefined;
    await sendViaApi({
      to,
      subject: String(options.subject ?? ''),
      html: String(options.html ?? ''),
      text: options.text ? String(options.text) : undefined,
      attachments,
    });
    console.log(`[email] sent via Brevo API → ${to} (${options.subject})`);
    return;
  }

  const result = await sendViaSmtp(options);
  console.log(`[email] sent via Brevo SMTP → ${to} (${options.subject})`);
  return result;
};
export const dispatchEmail = (task: () => Promise<void>, context: string): void => {
  void task().catch(err => {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[email] ${context} failed:`, msg);
  });
};

export const verifyEmailTransport = async (): Promise<{ ok: boolean; message: string }> => {
  const cfg = emailConfig();
  const configError = validateEmailConfig(cfg);
  if (configError) return { ok: false, message: configError };

  try {
    if (cfg.mode === 'api') {
      return { ok: true, message: 'Brevo REST API key configured' };
    }
    const transport = getSmtpTransporter();
    await transport.verify();
    return { ok: true, message: `Brevo SMTP verified as ${cfg.smtpLogin}` };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      message:
        `${msg}. Check BREVO_SMTP_LOGIN (from Brevo SMTP tab) and BREVO_API_KEY (xsmtpsib SMTP key).`,
    };
  }
};

export const formatAppointmentWhen = (startsAt: Date, timezone: string): string =>
  startsAt.toLocaleString('en-IN', {
    timeZone: timezone,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

export const buildPasswordResetUrl = (token: string): string => {
  const cfg = emailConfig();
  return `${cfg.frontendUrl}/reset-password?token=${encodeURIComponent(token)}`;
};

export const buildEmailVerificationUrl = (token: string): string => {
  const cfg = emailConfig();
  return `${cfg.frontendUrl}/verify-email?token=${encodeURIComponent(token)}`;
};

export const buildStudentEmailVerificationUrl = (token: string): string => {
  const cfg = emailConfig();
  return `${cfg.frontendUrl}/verify-email/student?token=${encodeURIComponent(token)}`;
};

export const buildStudentVerifyEmailUrl = (email: string): string => {
  const cfg = emailConfig();
  return `${cfg.frontendUrl}/verify-email/student?email=${encodeURIComponent(email)}`;
};

export const buildLoginUrl = (): string => `${emailConfig().frontendUrl}/login`;

export const buildStudentPortalUrl = (): string => `${emailConfig().frontendUrl}/student`;

export const buildApplicationUrl = (applicationId: string): string =>
  `${emailConfig().frontendUrl}/student/applications/${encodeURIComponent(applicationId)}`;

export const buildCounsellingUrl = (): string => `${emailConfig().frontendUrl}/student/counselling`;

export const sendPasswordResetEmail = async (params: {
  to: string;
  name: string;
  resetUrl: string;
}): Promise<void> => {
  const cfg = emailConfig();
  const tpl = passwordResetTemplate(cfg, params.name, params.resetUrl);
  await sendMail({ to: params.to, subject: tpl.subject, html: tpl.html, text: tpl.text });
};

export const sendStudentEmailVerificationOtpEmail = async (params: {
  to: string;
  name: string;
  otp: string;
}): Promise<void> => {
  const cfg = emailConfig();
  const tpl = studentEmailVerificationOtpTemplate(cfg, params.name, params.otp);
  await sendMail({ to: params.to, subject: tpl.subject, html: tpl.html, text: tpl.text });
};

export const sendStudentEmailVerificationLinkEmail = async (params: {
  to: string;
  name: string;
  verifyUrl: string;
}): Promise<void> => {
  const cfg = emailConfig();
  const tpl = studentEmailVerificationLinkTemplate(cfg, params.name, params.verifyUrl);
  await sendMail({ to: params.to, subject: tpl.subject, html: tpl.html, text: tpl.text });
};

export const sendAgentEmailVerificationEmail = async (params: {
  to: string;
  name: string;
  verifyUrl: string;
}): Promise<void> => {
  const cfg = emailConfig();
  const tpl = agentEmailVerificationTemplate(cfg, params.name, params.verifyUrl);
  await sendMail({ to: params.to, subject: tpl.subject, html: tpl.html, text: tpl.text });
};

export const sendAgentPartnershipAgreementEmail = async (params: {
  to: string;
  name: string;
  agencyName: string;
  pdfBuffer: Buffer;
  fileName: string;
}): Promise<void> => {
  const cfg = emailConfig();
  const loginUrl = `${cfg.frontendUrl}/login`;
  const tpl = agentPartnershipAgreementTemplate(cfg, params.name, params.agencyName, loginUrl);
  await sendMail({
    to: params.to,
    subject: tpl.subject,
    html: tpl.html,
    text: tpl.text,
    attachments: [
      {
        filename: params.fileName,
        content: params.pdfBuffer,
      },
    ],
  });
};

export const sendWelcomeEmail = async (params: {
  to: string;
  name: string;
  role: 'student' | 'agent' | 'university' | 'admin';
}): Promise<void> => {
  const cfg = emailConfig();
  const roleLabels: Record<typeof params.role, string> = {
    student: 'student',
    agent: 'agent',
    university: 'university',
    admin: 'admin',
  };
  const tpl = welcomeTemplate(cfg, params.name, roleLabels[params.role], buildLoginUrl());
  await sendMail({ to: params.to, subject: tpl.subject, html: tpl.html, text: tpl.text });
};

export const sendAgentStudentCredentialsEmail = async (params: {
  to: string;
  name: string;
  email: string;
  password: string;
  agencyName?: string | null;
}): Promise<void> => {
  const cfg = emailConfig();
  const tpl = agentStudentCredentialsTemplate(
    cfg,
    params.name,
    params.email,
    params.password,
    params.agencyName ?? null,
    buildLoginUrl(),
  );
  await sendMail({ to: params.to, subject: tpl.subject, html: tpl.html, text: tpl.text });
};

export const sendAppointmentConfirmationEmail = async (params: {
  to: string;
  name: string;
  sessionLabel: string;
  whenLabel: string;
  meetLink?: string | null;
}): Promise<void> => {
  const cfg = emailConfig();
  const tpl = appointmentConfirmationTemplate(
    cfg,
    params.name,
    params.sessionLabel,
    params.whenLabel,
    params.meetLink ?? null,
    buildStudentPortalUrl(),
  );
  await sendMail({ to: params.to, subject: tpl.subject, html: tpl.html, text: tpl.text });
};

export const sendAppointmentCancelledEmail = async (params: {
  to: string;
  name: string;
  sessionLabel: string;
  whenLabel: string;
}): Promise<void> => {
  const cfg = emailConfig();
  const tpl = appointmentCancelledTemplate(
    cfg,
    params.name,
    params.sessionLabel,
    params.whenLabel,
    buildStudentPortalUrl(),
  );
  await sendMail({ to: params.to, subject: tpl.subject, html: tpl.html, text: tpl.text });
};

export const sendApplicationStatusEmail = async (params: {
  to: string;
  name: string;
  applicationNumber: string;
  universityName: string;
  programName: string;
  statusLabel: string;
  statusKey: string;
  applicationId: string;
}): Promise<void> => {
  const cfg = emailConfig();
  const tpl = applicationStatusTemplate(
    cfg,
    params.name,
    params.applicationNumber,
    params.universityName,
    params.programName,
    params.statusLabel,
    params.statusKey,
    buildApplicationUrl(params.applicationId),
  );
  await sendMail({ to: params.to, subject: tpl.subject, html: tpl.html, text: tpl.text });
};

export const sendAppointmentReminderEmail = async (params: {
  to: string;
  name: string;
  sessionLabel: string;
  whenLabel: string;
  leadTimeLabel: string;
  meetLink?: string | null;
}): Promise<void> => {
  const cfg = emailConfig();
  const tpl = appointmentReminderTemplate(
    cfg,
    params.name,
    params.sessionLabel,
    params.whenLabel,
    params.leadTimeLabel,
    params.meetLink ?? null,
    buildCounsellingUrl(),
  );
  await sendMail({ to: params.to, subject: tpl.subject, html: tpl.html, text: tpl.text });
};

export const sendPromotionEmail = async (params: {
  to: string;
  name: string;
  subject: string;
  headline: string;
  messageHtml: string;
  ctaLabel?: string | null;
  ctaUrl?: string | null;
}): Promise<void> => {
  const cfg = emailConfig();
  const tpl = promotionTemplate(
    cfg,
    params.name,
    params.headline,
    params.messageHtml,
    params.ctaLabel ?? null,
    params.ctaUrl ?? null,
  );
  await sendMail({
    to: params.to,
    subject: params.subject,
    html: tpl.html,
    text: tpl.text,
  });
};
