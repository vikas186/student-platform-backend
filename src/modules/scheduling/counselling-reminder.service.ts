import { Op } from 'sequelize';
import { db } from '../../../config/database';
import {
  dispatchEmail,
  formatAppointmentWhen,
  sendAppointmentReminderEmail,
} from '../../../services/email.service';

type ReminderKind = '24h' | '1h';

const REMINDER_WINDOWS: Record<ReminderKind, { msBefore: number; toleranceMs: number; label: string; field: 'reminder24hSentAt' | 'reminder1hSentAt' }> = {
  '24h': { msBefore: 24 * 60 * 60 * 1000, toleranceMs: 20 * 60 * 1000, label: '24 hours', field: 'reminder24hSentAt' },
  '1h': { msBefore: 60 * 60 * 1000, toleranceMs: 20 * 60 * 1000, label: '1 hour', field: 'reminder1hSentAt' },
};

const sessionLabel = (type: string) => (type === 'counselling' ? 'Counselling session' : 'Mock interview');

export const processCounsellingReminders = async (): Promise<{ sent: number }> => {
  const now = Date.now();
  let sent = 0;

  for (const kind of ['24h', '1h'] as ReminderKind[]) {
    const window = REMINDER_WINDOWS[kind];
    const targetStart = now + window.msBefore - window.toleranceMs;
    const targetEnd = now + window.msBefore + window.toleranceMs;

    const rows = await db.Appointment.findAll({
      where: {
        status: 'scheduled',
        type: { [Op.in]: ['counselling', 'mock_interview'] },
        startsAt: { [Op.between]: [new Date(targetStart), new Date(targetEnd)] },
        [window.field]: null,
      },
      include: [
        { model: db.User, as: 'studentUser', attributes: ['name', 'email'] },
        { model: db.User, as: 'hostAdmin', attributes: ['name', 'email'] },
      ],
    });

    for (const row of rows) {
      const plain = row.get({ plain: true }) as {
        id: string;
        type: string;
        startsAt: Date;
        timezone: string;
        meetLink?: string | null;
        studentUser?: { name?: string; email?: string };
        hostAdmin?: { name?: string; email?: string };
      };

      const when = formatAppointmentWhen(new Date(plain.startsAt), plain.timezone);
      const label = sessionLabel(plain.type);

      const recipients: { name: string; email: string; context: string }[] = [];
      if (plain.studentUser?.email) {
        recipients.push({
          name: plain.studentUser.name?.trim() || 'there',
          email: plain.studentUser.email,
          context: `reminder ${kind} student`,
        });
      }
      if (plain.hostAdmin?.email) {
        recipients.push({
          name: plain.hostAdmin.name?.trim() || 'there',
          email: plain.hostAdmin.email,
          context: `reminder ${kind} host`,
        });
      }

      for (const recipient of recipients) {
        dispatchEmail(
          () =>
            sendAppointmentReminderEmail({
              to: recipient.email,
              name: recipient.name,
              sessionLabel: label,
              whenLabel: when,
              leadTimeLabel: window.label,
              meetLink: plain.meetLink ?? null,
            }),
          recipient.context,
        );
        sent += 1;
      }

      await row.update({ [window.field]: new Date() });
    }
  }

  return { sent };
};
