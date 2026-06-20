import { db } from '../config/database';
import { backendApplicationStatusToUi } from '../utils/adminUiStatus';
import type { APPLICATION_STATUSES } from '../models/Application.model';
import { dispatchEmail, sendApplicationStatusEmail } from './email.service';

type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

const loadApplicationRecipients = async (applicationId: string) => {
  const app = await db.Application.findByPk(applicationId, {
    include: [
      {
        model: db.StudentProfile,
        as: 'studentProfile',
        required: false,
        include: [{ model: db.User, as: 'user', attributes: ['name', 'email'] }],
      },
      {
        model: db.AgentProfile,
        as: 'agentProfile',
        required: false,
        include: [{ model: db.User, as: 'user', attributes: ['name', 'email'] }],
      },
    ],
  });
  if (!app) return null;

  const plain = app.get({ plain: true }) as {
    id: string;
    applicationNumber: string;
    universityName?: string | null;
    programName?: string | null;
    status: ApplicationStatus;
    studentProfile?: { user?: { name?: string; email?: string } };
    agentProfile?: { user?: { name?: string; email?: string } };
  };

  const studentUser = plain.studentProfile?.user;
  const agentUser = plain.agentProfile?.user;

  return {
    applicationId: plain.id,
    applicationNumber: plain.applicationNumber,
    universityName: plain.universityName?.trim() || 'University',
    programName: plain.programName?.trim() || 'Program',
    status: plain.status,
    student: studentUser?.email
      ? { name: studentUser.name?.trim() || 'there', email: studentUser.email }
      : null,
    agent: agentUser?.email
      ? { name: agentUser.name?.trim() || 'there', email: agentUser.email }
      : null,
  };
};

/** Notify student (and linked agent) when an application status changes. */
export const notifyApplicationStatusChange = (
  applicationId: string,
  previousStatus: ApplicationStatus,
  newStatus: ApplicationStatus,
): void => {
  if (previousStatus === newStatus || newStatus === 'draft') return;

  void (async () => {
    const ctx = await loadApplicationRecipients(applicationId);
    if (!ctx) return;

    const statusLabel = backendApplicationStatusToUi(newStatus);
    const base = {
      applicationNumber: ctx.applicationNumber,
      universityName: ctx.universityName,
      programName: ctx.programName,
      statusLabel,
      statusKey: newStatus,
      applicationId: ctx.applicationId,
    };

    if (ctx.student) {
      dispatchEmail(
        () =>
          sendApplicationStatusEmail({
            to: ctx.student!.email,
            name: ctx.student!.name,
            ...base,
          }),
        `application status (${newStatus}) student`,
      );
    }

    if (ctx.agent && ctx.agent.email !== ctx.student?.email) {
      dispatchEmail(
        () =>
          sendApplicationStatusEmail({
            to: ctx.agent!.email,
            name: ctx.agent!.name,
            ...base,
          }),
        `application status (${newStatus}) agent`,
      );
    }
  })().catch(err => {
    console.error('[email] application status notify failed:', err instanceof Error ? err.message : err);
  });
};
