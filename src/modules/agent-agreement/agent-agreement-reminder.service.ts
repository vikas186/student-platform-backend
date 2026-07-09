import { Op } from 'sequelize';
import { db } from '../../../config/database';
import type { AgentAgreementStatus } from '../../../models/AgentProfile.model';
import { readAgentAgreementPdf, resolveAgentAgreementPdfPath } from '../../../services/agent-agreement.service';
import path from 'path';
import { sendAgentAgreementReminderEmail } from '../../../services/email.service';

const HOUR_MS = 60 * 60 * 1000;

type ReminderKind = 1 | 2 | 3 | 4;

const REMINDER_SCHEDULE: Record<
  ReminderKind,
  {
    /** Hours after the initial agreement email was sent. */
    hoursAfterAgreementEmail: number;
    sentField:
      | 'agreementReminder1SentAt'
      | 'agreementReminder2SentAt'
      | 'agreementReminder3SentAt'
      | 'agreementReminder4SentAt';
    label: string;
  }
> = {
  1: { hoursAfterAgreementEmail: 48, sentField: 'agreementReminder1SentAt', label: 'first' },
  2: { hoursAfterAgreementEmail: 120, sentField: 'agreementReminder2SentAt', label: 'second' },
  3: { hoursAfterAgreementEmail: 192, sentField: 'agreementReminder3SentAt', label: 'third' },
  4: { hoursAfterAgreementEmail: 264, sentField: 'agreementReminder4SentAt', label: 'final' },
};

const needsSignedAgreement = (status: AgentAgreementStatus, signedUrl: string | null): boolean => {
  if (status === 'approved' || status === 'submitted') return false;
  if (status === 'rejected') return true;
  return !signedUrl;
};

const priorReminderSent = (
  profile: InstanceType<typeof db.AgentProfile>,
  kind: ReminderKind,
): boolean => {
  if (kind === 1) return true;
  const prior = (kind - 1) as ReminderKind;
  const field = REMINDER_SCHEDULE[prior].sentField;
  return Boolean(profile.getDataValue(field));
};

const isReminderDue = (
  agreementEmailSentAt: Date,
  kind: ReminderKind,
  nowMs: number,
): boolean => {
  const { hoursAfterAgreementEmail } = REMINDER_SCHEDULE[kind];
  const dueAt = agreementEmailSentAt.getTime() + hoursAfterAgreementEmail * HOUR_MS;
  return nowMs >= dueAt;
};

const nextReminderKind = (profile: InstanceType<typeof db.AgentProfile>): ReminderKind | null => {
  for (const kind of [1, 2, 3, 4] as ReminderKind[]) {
    const { sentField } = REMINDER_SCHEDULE[kind];
    if (profile.getDataValue(sentField)) continue;
    if (!priorReminderSent(profile, kind)) return null;
    return kind;
  }
  return null;
};

export const processAgentAgreementReminders = async (): Promise<{ sent: number }> => {
  const nowMs = Date.now();
  let sent = 0;

  const profiles = await db.AgentProfile.findAll({
    where: {
      agreementStatus: { [Op.in]: ['pending', 'rejected'] },
      agreementEmailSentAt: { [Op.ne]: null },
    },
    include: [{ model: db.User, as: 'user', attributes: ['id', 'name', 'email'] }],
  });

  let pdfBuffer: Buffer | null = null;
  let pdfFileName: string | null = null;

  const loadPdf = () => {
    if (!pdfBuffer) {
      pdfBuffer = readAgentAgreementPdf();
      pdfFileName = path.basename(resolveAgentAgreementPdfPath());
    }
    return { pdfBuffer: pdfBuffer!, fileName: pdfFileName! };
  };

  for (const profile of profiles) {
    const status = profile.getDataValue('agreementStatus') as AgentAgreementStatus;
    const signedUrl = profile.getDataValue('signedAgreementUrl') as string | null;
    if (!needsSignedAgreement(status, signedUrl)) continue;

    const agreementEmailSentAt = profile.getDataValue('agreementEmailSentAt') as Date | null;
    if (!agreementEmailSentAt) continue;

    const kind = nextReminderKind(profile);
    if (!kind) continue;
    if (!isReminderDue(agreementEmailSentAt, kind, nowMs)) continue;

    const user = profile.get('user') as InstanceType<typeof db.User> | null;
    const email = user?.email?.trim();
    if (!email) continue;

    const { label } = REMINDER_SCHEDULE[kind];
    const { pdfBuffer: pdf, fileName } = loadPdf();

    await sendAgentAgreementReminderEmail({
      to: email,
      name: user?.name?.trim() || 'there',
      agencyName: profile.agencyName,
      reminderLabel: label,
      reminderNumber: kind,
      reupload: status === 'rejected',
      pdfBuffer: pdf,
      fileName,
    });

    const { sentField } = REMINDER_SCHEDULE[kind];
    profile.setDataValue(sentField, new Date());
    await profile.save();

    sent += 1;
  }

  return { sent };
};
