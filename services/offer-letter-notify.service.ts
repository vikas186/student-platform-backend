import { dispatchEmail, sendSignedOfferAdminNotifyEmail } from './email.service';
import { db } from '../config/database';

/** Fire-and-forget admin email when a signed offer PDF is uploaded. */
export const notifyAdminSignedOfferUploaded = (
  offerLetter: {
    applicationId?: string | null;
    get?: (opts: { plain: true }) => Record<string, unknown>;
  },
  uploadedBy: 'student' | 'agent',
): void => {
  dispatchEmail(async () => {
    const plain =
      typeof offerLetter.get === 'function'
        ? offerLetter.get({ plain: true })
        : (offerLetter as unknown as Record<string, unknown>);
    const applicationId = String(plain.applicationId ?? '');
    if (!applicationId) return;

    const app = await db.Application.findByPk(applicationId, {
      include: [
        {
          model: db.StudentProfile,
          as: 'studentProfile',
          include: [{ model: db.User, as: 'user', attributes: ['name', 'email'] }],
        },
      ],
    });
    if (!app) return;
    const a = app.get({ plain: true }) as {
      applicationNumber?: string;
      universityName?: string | null;
      programName?: string | null;
      studentProfile?: { user?: { name?: string; email?: string } };
    };
    await sendSignedOfferAdminNotifyEmail({
      studentName: a.studentProfile?.user?.name?.trim() || 'Student',
      studentEmail: a.studentProfile?.user?.email?.trim() || '—',
      applicationNumber: a.applicationNumber || applicationId.slice(0, 8),
      universityName: a.universityName?.trim() || '—',
      programName: a.programName?.trim() || '—',
      uploadedBy,
    });
  }, 'signed offer admin notify');
};
