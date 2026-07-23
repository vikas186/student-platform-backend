import { db } from '../config/database';
import { backendApplicationStatusToUi } from '../utils/adminUiStatus';
import { resolveCatalogLink } from '../utils/linkApplicationCatalog';
import type { APPLICATION_STATUSES } from '../models/Application.model';
import {
  dispatchEmail,
  sendApplicationStatusEmail,
  sendUniversityNewApplicationEmail,
} from './email.service';

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
    courseId?: number | null;
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
    courseId: plain.courseId ?? null,
    status: plain.status,
    student: studentUser?.email
      ? { name: studentUser.name?.trim() || 'there', email: studentUser.email }
      : null,
    agent: agentUser?.email
      ? { name: agentUser.name?.trim() || 'there', email: agentUser.email }
      : null,
  };
};

const resolvePartnerUniversityId = async (opts: {
  courseId?: number | null;
  universityName?: string | null;
  programName?: string | null;
}): Promise<number | null> => {
  const link = await resolveCatalogLink(opts);
  return link.universityId;
};

/** Email + in-app notify university portal users when an application is submitted to them. */
export const notifyUniversityPartnersOfSubmission = (applicationId: string): void => {
  void (async () => {
    const ctx = await loadApplicationRecipients(applicationId);
    if (!ctx) return;

    const universityId = await resolvePartnerUniversityId({
      courseId: ctx.courseId,
      universityName: ctx.universityName,
      programName: ctx.programName,
    });
    if (!universityId) {
      console.warn(
        `[email] no catalog university matched for application ${ctx.applicationNumber} (${ctx.universityName}) — partner notify skipped`,
      );
      return;
    }

    const profiles = await db.UniversityProfile.findAll({
      where: { universityId },
      include: [{ model: db.User, as: 'user', attributes: ['id', 'name', 'email'] }],
    });

    if (!profiles.length) {
      console.warn(
        `[email] no university portal users for universityId=${universityId} (app ${ctx.applicationNumber}) — partner notify skipped`,
      );
      return;
    }

    const studentName = ctx.student?.name || 'Student';
    const seen = new Set<string>();

    for (const profile of profiles) {
      const user = (profile as { user?: { id: string; name?: string; email?: string } }).user;
      const email = user?.email?.trim();
      if (!user?.id || !email || seen.has(email.toLowerCase())) continue;
      seen.add(email.toLowerCase());

      const name = user.name?.trim() || 'there';
      dispatchEmail(
        () =>
          sendUniversityNewApplicationEmail({
            to: email,
            name,
            applicationNumber: ctx.applicationNumber,
            studentName,
            programName: ctx.programName,
            universityName: ctx.universityName,
            applicationId: ctx.applicationId,
          }),
        `university new application (${ctx.applicationNumber}) → ${email}`,
      );

      try {
        await db.Notification.create({
          userId: user.id,
          type: 'application_submitted',
          message: `New application ${ctx.applicationNumber} from ${studentName} — ${ctx.programName} is awaiting your review.`,
        });
      } catch (err) {
        console.error(
          '[notification] university application notify failed:',
          err instanceof Error ? err.message : err,
        );
      }
    }
  })().catch(err => {
    console.error(
      '[email] university partner notify failed:',
      err instanceof Error ? err.message : err,
    );
  });
};

/** Notify student (and linked agent) when an application status changes. */
export const notifyApplicationStatusChange = (
  applicationId: string,
  previousStatus: ApplicationStatus,
  newStatus: ApplicationStatus,
): void => {
  if (previousStatus === newStatus || newStatus === 'draft') return;

  if (newStatus === 'submitted') {
    notifyUniversityPartnersOfSubmission(applicationId);
  }

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
