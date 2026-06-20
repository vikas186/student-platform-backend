import { Op } from 'sequelize';
import { db } from '../config/database';
import { dispatchEmail, sendPromotionEmail } from './email.service';

export const PROMOTION_AUDIENCES = ['students', 'agents', 'all_users', 'test'] as const;
export type PromotionAudience = (typeof PROMOTION_AUDIENCES)[number];

export type SendPromotionInput = {
  subject: string;
  headline: string;
  message: string;
  audience: PromotionAudience;
  ctaLabel?: string | null;
  ctaUrl?: string | null;
  testEmail?: string | null;
};

const messageToHtml = (message: string) =>
  message
    .split(/\n{2,}/)
    .map(p => `<p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#3d4f72;">${p.replace(/\n/g, '<br/>')}</p>`)
    .join('');

const resolveRecipients = async (input: SendPromotionInput) => {
  if (input.audience === 'test') {
    const email = input.testEmail?.trim().toLowerCase();
    if (!email) return [];
    return [{ name: 'there', email }];
  }

  const roles =
    input.audience === 'students'
      ? ['student']
      : input.audience === 'agents'
        ? ['agent']
        : ['student', 'agent', 'university', 'admin'];

  const users = await db.User.findAll({
    where: { role: { [Op.in]: roles }, status: true },
    attributes: ['name', 'email'],
    order: [['email', 'ASC']],
  });

  const seen = new Set<string>();
  return users
    .map(u => {
      const plain = u.get({ plain: true }) as { name?: string; email?: string };
      const email = plain.email?.trim().toLowerCase();
      if (!email || seen.has(email)) return null;
      seen.add(email);
      return { name: plain.name?.trim() || 'there', email };
    })
    .filter((r): r is { name: string; email: string } => r !== null);
};

export const queuePromotionEmails = async (input: SendPromotionInput): Promise<{ queued: number }> => {
  const recipients = await resolveRecipients(input);
  const messageHtml = messageToHtml(input.message.trim());
  const headline = input.headline.trim() || input.subject.trim();
  const subject = input.subject.trim() || headline;

  for (const recipient of recipients) {
    dispatchEmail(
      () =>
        sendPromotionEmail({
          to: recipient.email,
          name: recipient.name,
          subject,
          headline,
          messageHtml,
          ctaLabel: input.ctaLabel?.trim() || null,
          ctaUrl: input.ctaUrl?.trim() || null,
        }),
      `promotion (${input.audience})`,
    );
  }

  return { queued: recipients.length };
};
