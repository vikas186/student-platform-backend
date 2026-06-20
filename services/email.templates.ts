import type { EmailConfig } from '../config/email.config';

const layout = (cfg: EmailConfig, title: string, bodyHtml: string) => `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"/><title>${title}</title></head>
<body style="margin:0;padding:0;background:#f5f0e8;font-family:Inter,Segoe UI,Arial,sans-serif;color:#1a2b5e;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f0e8;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e8e2d4;">
        <tr><td style="background:#1a2b5e;padding:20px 24px;">
          <p style="margin:0;font-size:18px;font-weight:600;color:#ffffff;">${cfg.brandName}</p>
          <p style="margin:6px 0 0;font-size:12px;color:#f5a07a;">Global Admissions</p>
        </td></tr>
        <tr><td style="padding:28px 24px;">
          <h1 style="margin:0 0 16px;font-size:20px;font-weight:600;color:#1a2b5e;">${title}</h1>
          ${bodyHtml}
        </td></tr>
        <tr><td style="padding:16px 24px 24px;border-top:1px solid #e8e2d4;">
          <p style="margin:0;font-size:11px;line-height:1.5;color:#6b7a9a;">
            This message was sent by ${cfg.brandName}. If you did not request it, you can ignore this email.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

const button = (href: string, label: string) =>
  `<p style="margin:24px 0 8px;">
    <a href="${href}" style="display:inline-block;background:#c0522a;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:999px;font-weight:600;font-size:14px;">${label}</a>
  </p>`;

export const passwordResetTemplate = (cfg: EmailConfig, name: string, resetUrl: string) => {
  const body = `
    <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#3d4f72;">Hi ${name},</p>
    <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#3d4f72;">
      We received a request to reset your password. Use the button below within the next hour.
    </p>
    ${button(resetUrl, 'Reset password')}
    <p style="margin:16px 0 0;font-size:13px;line-height:1.5;color:#6b7a9a;word-break:break-all;">${resetUrl}</p>
  `;
  return {
    subject: `Reset your ${cfg.brandName} password`,
    html: layout(cfg, 'Reset your password', body),
    text: `Hi ${name},\n\nReset your password: ${resetUrl}\n\nThis link expires in one hour.`,
  };
};

export const welcomeTemplate = (
  cfg: EmailConfig,
  name: string,
  roleLabel: string,
  loginUrl: string,
) => {
  const body = `
    <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#3d4f72;">Hi ${name},</p>
    <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#3d4f72;">
      Welcome to ${cfg.brandName}. Your ${roleLabel} account is ready.
    </p>
    <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#3d4f72;">
      Sign in to explore programs, manage applications, upload documents, and book counselling sessions.
    </p>
    ${button(loginUrl, 'Sign in to your portal')}
  `;
  return {
    subject: `Welcome to ${cfg.brandName}`,
    html: layout(cfg, 'Welcome aboard', body),
    text: `Hi ${name},\n\nWelcome to ${cfg.brandName}. Sign in: ${loginUrl}`,
  };
};

export const agentStudentCredentialsTemplate = (
  cfg: EmailConfig,
  name: string,
  email: string,
  password: string,
  agencyName: string | null,
  loginUrl: string,
) => {
  const agencyLine = agencyName
    ? `<p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#3d4f72;">Your agent <strong>${agencyName}</strong> created a student account for you on ${cfg.brandName}.</p>`
    : `<p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#3d4f72;">A student account was created for you on ${cfg.brandName}.</p>`;
  const body = `
    <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#3d4f72;">Hi ${name},</p>
    ${agencyLine}
    <table style="margin:16px 0;width:100%;border-collapse:collapse;font-size:14px;">
      <tr><td style="padding:8px 0;color:#6b7a9a;">Email</td><td style="padding:8px 0;font-weight:600;">${email}</td></tr>
      <tr><td style="padding:8px 0;color:#6b7a9a;">Temporary password</td><td style="padding:8px 0;font-weight:600;font-family:monospace;">${password}</td></tr>
    </table>
    <p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#3d4f72;">Please sign in and change your password after your first login.</p>
    ${button(loginUrl, 'Sign in')}
  `;
  return {
    subject: `Your ${cfg.brandName} student account`,
    html: layout(cfg, 'Your student account is ready', body),
    text: `Hi ${name},\n\nEmail: ${email}\nTemporary password: ${password}\n\nSign in: ${loginUrl}`,
  };
};

export const appointmentConfirmationTemplate = (
  cfg: EmailConfig,
  name: string,
  sessionLabel: string,
  whenLabel: string,
  meetLink: string | null,
  portalUrl: string,
) => {
  const meetBlock = meetLink
    ? `${button(meetLink, 'Join Google Meet')}`
    : `<p style="margin:16px 0 0;font-size:14px;color:#3d4f72;">Your Meet link will appear in your student portal before the session.</p>`;
  const body = `
    <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#3d4f72;">Hi ${name},</p>
    <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#3d4f72;">
      Your <strong>${sessionLabel}</strong> is confirmed.
    </p>
    <p style="margin:0 0 8px;font-size:15px;line-height:1.6;color:#1a2b5e;"><strong>When:</strong> ${whenLabel} (IST)</p>
    ${meetBlock}
    ${button(portalUrl, 'Open student portal')}
  `;
  return {
    subject: `${sessionLabel} confirmed — ${cfg.brandName}`,
    html: layout(cfg, `${sessionLabel} confirmed`, body),
    text: `Hi ${name},\n\nYour ${sessionLabel} is confirmed for ${whenLabel} (IST).${meetLink ? `\nJoin: ${meetLink}` : ''}\n\nPortal: ${portalUrl}`,
  };
};

export const appointmentCancelledTemplate = (
  cfg: EmailConfig,
  name: string,
  sessionLabel: string,
  whenLabel: string,
  portalUrl: string,
) => {
  const body = `
    <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#3d4f72;">Hi ${name},</p>
    <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#3d4f72;">
      Your <strong>${sessionLabel}</strong> scheduled for <strong>${whenLabel}</strong> (IST) has been cancelled.
    </p>
    <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#3d4f72;">You can book another slot from your portal when ready.</p>
    ${button(portalUrl, 'Book a new session')}
  `;
  return {
    subject: `${sessionLabel} cancelled — ${cfg.brandName}`,
    html: layout(cfg, `${sessionLabel} cancelled`, body),
    text: `Hi ${name},\n\nYour ${sessionLabel} on ${whenLabel} (IST) was cancelled.\n\nPortal: ${portalUrl}`,
  };
};

const STATUS_COPY: Record<string, { headline: string; detail: string }> = {
  submitted: {
    headline: 'Application submitted',
    detail: 'Your application has been submitted and is awaiting review by our admissions team.',
  },
  under_review: {
    headline: 'Application under review',
    detail: 'Your application is now being reviewed. We will notify you when there is an update.',
  },
  approved: {
    headline: 'Application approved',
    detail: 'Great news — your application has been approved. Check your portal for next steps.',
  },
  rejected: {
    headline: 'Application update',
    detail: 'Your application status has been updated to Rejected. Sign in to your portal for details or to explore other options.',
  },
  offer_generated: {
    headline: 'Offer letter available',
    detail: 'An offer has been generated for your application. Review and accept it from your student portal.',
  },
  deposit_paid: {
    headline: 'Deposit confirmed',
    detail: 'Your deposit payment has been recorded. Your application is progressing to the next stage.',
  },
  visa_approved: {
    headline: 'Visa approved',
    detail: 'Your visa status has been marked as approved. Congratulations on this milestone.',
  },
  enrolled: {
    headline: 'You are enrolled',
    detail: 'Congratulations — you are now enrolled. Welcome to your study abroad journey with EduCrats Global.',
  },
};

export const applicationStatusTemplate = (
  cfg: EmailConfig,
  name: string,
  applicationNumber: string,
  universityName: string,
  programName: string,
  statusLabel: string,
  statusKey: string,
  applicationUrl: string,
) => {
  const copy = STATUS_COPY[statusKey] ?? {
    headline: 'Application status updated',
    detail: `Your application status is now ${statusLabel}.`,
  };
  const body = `
    <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#3d4f72;">Hi ${name},</p>
    <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#3d4f72;">${copy.detail}</p>
    <table style="margin:16px 0;width:100%;border-collapse:collapse;font-size:14px;background:#f8f6f1;border-radius:12px;">
      <tr><td style="padding:10px 14px;color:#6b7a9a;">Reference</td><td style="padding:10px 14px;font-weight:600;">${applicationNumber}</td></tr>
      <tr><td style="padding:10px 14px;color:#6b7a9a;">University</td><td style="padding:10px 14px;font-weight:600;">${universityName}</td></tr>
      <tr><td style="padding:10px 14px;color:#6b7a9a;">Program</td><td style="padding:10px 14px;font-weight:600;">${programName}</td></tr>
      <tr><td style="padding:10px 14px;color:#6b7a9a;">Status</td><td style="padding:10px 14px;font-weight:700;color:#1a2b5e;">${statusLabel}</td></tr>
    </table>
    ${button(applicationUrl, 'View application')}
  `;
  return {
    subject: `${copy.headline} — ${applicationNumber}`,
    html: layout(cfg, copy.headline, body),
    text: `Hi ${name},\n\n${copy.detail}\n\n${applicationNumber} — ${universityName} — ${programName}\nStatus: ${statusLabel}\n\n${applicationUrl}`,
  };
};

export const appointmentReminderTemplate = (
  cfg: EmailConfig,
  name: string,
  sessionLabel: string,
  whenLabel: string,
  leadTimeLabel: string,
  meetLink: string | null,
  portalUrl: string,
) => {
  const meetBlock = meetLink
    ? `${button(meetLink, 'Join Google Meet')}`
    : `<p style="margin:16px 0 0;font-size:14px;color:#3d4f72;">Your Meet link is available in your student portal.</p>`;
  const body = `
    <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#3d4f72;">Hi ${name},</p>
    <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#3d4f72;">
      Reminder: your <strong>${sessionLabel}</strong> starts in <strong>${leadTimeLabel}</strong>.
    </p>
    <p style="margin:0 0 8px;font-size:15px;line-height:1.6;color:#1a2b5e;"><strong>When:</strong> ${whenLabel} (IST)</p>
    ${meetBlock}
    ${button(portalUrl, 'Open student portal')}
  `;
  return {
    subject: `Reminder: ${sessionLabel} in ${leadTimeLabel} — ${cfg.brandName}`,
    html: layout(cfg, `${sessionLabel} reminder`, body),
    text: `Hi ${name},\n\nReminder: your ${sessionLabel} is in ${leadTimeLabel} (${whenLabel} IST).${meetLink ? `\nJoin: ${meetLink}` : ''}\n\nPortal: ${portalUrl}`,
  };
};

export const promotionTemplate = (
  cfg: EmailConfig,
  name: string,
  headline: string,
  messageHtml: string,
  ctaLabel: string | null,
  ctaUrl: string | null,
) => {
  const ctaBlock = ctaLabel && ctaUrl ? button(ctaUrl, ctaLabel) : '';
  const body = `
    <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#3d4f72;">Hi ${name},</p>
    <div style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#3d4f72;">${messageHtml}</div>
    ${ctaBlock}
  `;
  return {
    subject: headline,
    html: layout(cfg, headline, body),
    text: `Hi ${name},\n\n${messageHtml.replace(/<[^>]+>/g, '')}${ctaUrl ? `\n\n${ctaLabel ?? 'Learn more'}: ${ctaUrl}` : ''}`,
  };
};
