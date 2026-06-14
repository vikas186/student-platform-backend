import { Op, fn, Sequelize } from 'sequelize';
import { db } from '../../../config/database';
import { applicationScopeForUniversity } from '../../../utils/universityApplicationScope';
import type { ChatUserContext } from './chat.types';

const LIST_LIMIT = 25;
const MAX_CONTEXT_CHARS = 14_000;

const linkedStudentMatchesAgentExists = (agentProfileId: number, applicationTableAlias: string) => {
  const aid = Number(agentProfileId);
  return Sequelize.literal(
    `(EXISTS (SELECT 1 FROM student_profiles AS sp WHERE sp.id = ${applicationTableAlias}."student_id" AND sp.agent_profile_id = ${aid}))`,
  );
};

const applicationScopeForAgent = (agentProfileId: number) => ({
  [Op.or]: [{ agentId: Number(agentProfileId) }, linkedStudentMatchesAgentExists(agentProfileId, '"Application"')],
});

const applicationScopeOnIncludedApplication = (agentProfileId: number) => ({
  [Op.or]: [{ agentId: Number(agentProfileId) }, linkedStudentMatchesAgentExists(agentProfileId, '"application"')],
});

const trimContext = (text: string): string => {
  if (text.length <= MAX_CONTEXT_CHARS) {
    return text;
  }
  return `${text.slice(0, MAX_CONTEXT_CHARS)}\n…(context truncated)`;
};

const section = (title: string, payload: unknown): string =>
  `### ${title}\n${JSON.stringify(payload, null, 0)}`;

async function buildAdminContext(): Promise<string> {
  const [
    userCounts,
    appStatusRows,
    docStatusRows,
    pendingPayments,
    agentCount,
    uniCount,
    courseCount,
    users,
    pendingDocs,
    recentApps,
    pendingPaymentRows,
    agentsPendingAgreement,
    commissions,
    scrapeJobs,
  ] = await Promise.all([
    db.User.findAll({
      attributes: ['role', [fn('COUNT', Sequelize.col('User.id')), 'count']],
      group: ['User.role'],
      raw: true,
    }) as unknown as Promise<{ role: string; count: string }[]>,
    db.Application.findAll({
      attributes: ['status', [fn('COUNT', Sequelize.col('Application.id')), 'count']],
      group: ['Application.status'],
      raw: true,
    }) as unknown as Promise<{ status: string; count: string }[]>,
    db.Document.findAll({
      attributes: ['status', [fn('COUNT', Sequelize.col('Document.id')), 'count']],
      group: ['Document.status'],
      raw: true,
    }) as unknown as Promise<{ status: string; count: string }[]>,
    db.Payment.count({ where: { status: 'pending' } }),
    db.AgentProfile.count(),
    db.University.count(),
    db.Course.count(),
    db.User.findAll({
      attributes: ['id', 'name', 'email', 'role', 'status', 'createdAt'],
      order: [['createdAt', 'DESC']],
      limit: LIST_LIMIT,
      raw: true,
    }),
    db.Document.findAll({
      where: { status: 'pending' },
      include: [
        {
          model: db.StudentProfile,
          as: 'studentProfile',
          attributes: ['id'],
          include: [{ model: db.User, as: 'user', attributes: ['name', 'email'] }],
        },
        {
          model: db.Application,
          as: 'application',
          attributes: ['applicationNumber'],
          required: false,
        },
      ],
      order: [['createdAt', 'DESC']],
      limit: LIST_LIMIT,
    }),
    db.Application.findAll({
      attributes: ['applicationNumber', 'status', 'universityName', 'programName', 'country', 'updatedAt'],
      include: [
        {
          model: db.StudentProfile,
          as: 'studentProfile',
          attributes: ['id'],
          include: [{ model: db.User, as: 'user', attributes: ['name', 'email'] }],
        },
      ],
      order: [['updatedAt', 'DESC']],
      limit: LIST_LIMIT,
    }),
    db.Payment.findAll({
      where: { status: 'pending' },
      attributes: ['id', 'amount', 'currency', 'type', 'createdAt'],
      include: [
        { model: db.User, as: 'user', attributes: ['name', 'email'] },
        { model: db.Application, as: 'application', attributes: ['applicationNumber'], required: false },
      ],
      order: [['createdAt', 'DESC']],
      limit: LIST_LIMIT,
    }),
    db.AgentProfile.findAll({
      where: { agreementStatus: { [Op.in]: ['pending', 'submitted'] } },
      attributes: ['id', 'agencyName', 'agreementStatus', 'agreementUploadedAt'],
      include: [{ model: db.User, as: 'user', attributes: ['name', 'email'] }],
      order: [['updatedAt', 'DESC']],
      limit: LIST_LIMIT,
    }),
    db.Commission.findAll({
      attributes: ['percentage', 'slabDetails'],
      include: [{ model: db.University, as: 'university', attributes: ['name', 'country'] }],
      limit: LIST_LIMIT,
    }),
    db.ScrapeJob.findAll({
      attributes: ['id', 'source', 'status', 'createdAt'],
      order: [['createdAt', 'DESC']],
      limit: 10,
    }),
  ]);

  const pendingDocList = pendingDocs.map(d => {
    const plain = d.get({ plain: true }) as {
      id: string;
      type: string;
      originalFileName: string;
      status: string;
      createdAt: Date;
      studentProfile?: { user?: { name: string; email: string } };
      application?: { applicationNumber: string } | null;
    };
    return {
      id: plain.id,
      type: plain.type,
      fileName: plain.originalFileName,
      status: plain.status,
      student: plain.studentProfile?.user?.name ?? 'Unknown',
      studentEmail: plain.studentProfile?.user?.email ?? null,
      applicationRef: plain.application?.applicationNumber ?? null,
      uploadedAt: plain.createdAt,
    };
  });

  const appList = recentApps.map(a => {
    const plain = a.get({ plain: true }) as {
      applicationNumber: string;
      status: string;
      universityName: string | null;
      programName: string | null;
      country: string | null;
      updatedAt: Date;
      studentProfile?: { user?: { name: string; email: string } };
    };
    return {
      ref: plain.applicationNumber,
      status: plain.status,
      university: plain.universityName,
      program: plain.programName,
      country: plain.country,
      student: plain.studentProfile?.user?.name ?? null,
      updatedAt: plain.updatedAt,
    };
  });

  const parts = [
    section('Admin dashboard counts', {
      usersByRole: Object.fromEntries(userCounts.map(r => [r.role, parseInt(r.count, 10)])),
      applicationsByStatus: Object.fromEntries(appStatusRows.map(r => [r.status, parseInt(r.count, 10)])),
      documentsByStatus: Object.fromEntries(docStatusRows.map(r => [r.status, parseInt(r.count, 10)])),
      pendingPayments,
      agentAccounts: agentCount,
      universities: uniCount,
      courses: courseCount,
    }),
    section(`Users (latest ${LIST_LIMIT})`, users),
    section(`Pending document reviews (${pendingDocList.length} shown)`, pendingDocList),
    section(`Recent applications (${appList.length} shown)`, appList),
    section('Pending payments', pendingPaymentRows.map(p => p.get({ plain: true }))),
    section('Agent agreements awaiting review', agentsPendingAgreement.map(a => a.get({ plain: true }))),
    section('Commission slabs (sample)', commissions.map(c => c.get({ plain: true }))),
    section('Recent scrape jobs', scrapeJobs.map(j => j.get({ plain: true }))),
  ];

  return parts.join('\n\n');
}

async function buildStudentContext(ctx: ChatUserContext): Promise<string> {
  if (!ctx.studentProfileId) {
    return section('Student profile', { error: 'No student profile linked to this account.' });
  }

  const [profile, apps, docs, payments, notifications] = await Promise.all([
    db.StudentProfile.findByPk(ctx.studentProfileId, {
      attributes: [
        'preferredCountry',
        'targetCountries',
        'countryOfResidence',
        'highestEducation',
        'gradeGpa',
        'counsellingCompletedAt',
      ],
    }),
    db.Application.findAll({
      where: { studentId: ctx.studentProfileId },
      attributes: ['applicationNumber', 'status', 'universityName', 'programName', 'country', 'notes', 'updatedAt'],
      order: [['updatedAt', 'DESC']],
      limit: LIST_LIMIT,
    }),
    db.Document.findAll({
      where: { studentProfileId: ctx.studentProfileId },
      attributes: ['id', 'type', 'originalFileName', 'status', 'applicationId', 'createdAt'],
      order: [['createdAt', 'DESC']],
      limit: LIST_LIMIT,
    }),
    db.Payment.findAll({
      where: { userId: ctx.userId },
      attributes: ['id', 'amount', 'currency', 'type', 'status', 'createdAt'],
      order: [['createdAt', 'DESC']],
      limit: LIST_LIMIT,
    }),
    db.Notification.findAll({
      where: { userId: ctx.userId },
      attributes: ['message', 'type', 'createdAt'],
      order: [['createdAt', 'DESC']],
      limit: 10,
    }),
  ]);

  const counsellingDone = Boolean(ctx.counsellingCompletedAt);
  const appRows = apps.map(a => {
    const row = a.get({ plain: true }) as Record<string, unknown>;
    if (!counsellingDone) {
      row.universityName = row.universityName ? '[named after counselling]' : row.universityName;
    }
    return row;
  });

  return [
    section('Student profile', profile?.get({ plain: true }) ?? {}),
    section('Your applications', appRows),
    section('Your documents', docs.map(d => d.get({ plain: true }))),
    section('Your payments', payments.map(p => p.get({ plain: true }))),
    section('Recent notifications', notifications.map(n => n.get({ plain: true }))),
    section('Counselling', {
      completed: counsellingDone,
      note: counsellingDone
        ? 'University names are visible in your data.'
        : 'University names are hidden until counselling is completed.',
    }),
  ].join('\n\n');
}

async function buildAgentContext(ctx: ChatUserContext): Promise<string> {
  if (!ctx.agentProfileId) {
    return section('Agent profile', { error: 'No agent profile linked to this account.' });
  }

  const agentId = ctx.agentProfileId;

  const [agentProfile, linkedStudents, apps, pendingDocs, payments, ranking] = await Promise.all([
    db.AgentProfile.findByPk(agentId, {
      attributes: ['agencyName', 'primaryMarket', 'agreementStatus'],
      include: [{ model: db.User, as: 'user', attributes: ['name', 'email'] }],
    }),
    db.StudentProfile.findAll({
      where: { agentProfileId: agentId },
      attributes: ['id', 'preferredCountry', 'targetCountries'],
      include: [{ model: db.User, as: 'user', attributes: ['name', 'email'] }],
      limit: LIST_LIMIT,
    }),
    db.Application.findAll({
      where: applicationScopeForAgent(agentId),
      attributes: ['applicationNumber', 'status', 'universityName', 'programName', 'country', 'updatedAt'],
      include: [
        {
          model: db.StudentProfile,
          as: 'studentProfile',
          attributes: ['id'],
          include: [{ model: db.User, as: 'user', attributes: ['name', 'email'] }],
        },
      ],
      order: [['updatedAt', 'DESC']],
      limit: LIST_LIMIT,
    }),
    db.Document.findAll({
      where: { status: 'pending' },
      include: [
        {
          model: db.Application,
          as: 'application',
          required: true,
          where: applicationScopeOnIncludedApplication(agentId),
          attributes: ['applicationNumber'],
        },
        {
          model: db.StudentProfile,
          as: 'studentProfile',
          include: [{ model: db.User, as: 'user', attributes: ['name', 'email'] }],
        },
      ],
      order: [['createdAt', 'DESC']],
      limit: LIST_LIMIT,
    }),
    db.Payment.findAll({
      where: { agentProfileId: agentId },
      attributes: ['id', 'amount', 'currency', 'type', 'status', 'createdAt'],
      order: [['createdAt', 'DESC']],
      limit: LIST_LIMIT,
    }),
    db.AgentRanking.findOne({
      where: { agentId },
      attributes: ['totalApplications', 'deposits', 'visaSuccessRate', 'enrollments'],
    }),
  ]);

  const commissions = await db.Commission.findAll({
    attributes: ['percentage'],
    include: [{ model: db.University, as: 'university', attributes: ['name', 'country'] }],
    limit: LIST_LIMIT,
  });

  const docList = pendingDocs.map(d => {
    const plain = d.get({ plain: true }) as {
      id: string;
      type: string;
      originalFileName: string;
      application?: { applicationNumber: string };
      studentProfile?: { user?: { name: string } };
    };
    return {
      id: plain.id,
      type: plain.type,
      fileName: plain.originalFileName,
      applicationRef: plain.application?.applicationNumber,
      student: plain.studentProfile?.user?.name,
    };
  });

  return [
    section('Agent profile', agentProfile?.get({ plain: true }) ?? {}),
    section('Linked students', linkedStudents.map(s => s.get({ plain: true }))),
    section('Applications in your scope', apps.map(a => a.get({ plain: true }))),
    section('Pending document reviews in your scope', docList),
    section('Payments', payments.map(p => p.get({ plain: true }))),
    section('Agent ranking', ranking?.get({ plain: true }) ?? null),
    section('Commission reference (all universities)', commissions.map(c => c.get({ plain: true }))),
  ].join('\n\n');
}

async function buildUniversityContext(ctx: ChatUserContext): Promise<string> {
  if (ctx.universityId === null || !ctx.universityName) {
    return section('University profile', { error: 'No university linked to this account.' });
  }

  const scope = applicationScopeForUniversity(ctx.universityId, ctx.universityName);

  const [uni, statusRows, reviewApps, pendingDocs, courses, deadlines] = await Promise.all([
    db.University.findByPk(ctx.universityId, {
      attributes: [
        'name',
        'country',
        'agreementPackageReference',
        'countersignedContractUrl',
        'countersignedVerifiedAt',
      ],
    }),
    db.Application.findAll({
      attributes: ['status', [fn('COUNT', Sequelize.col('Application.id')), 'count']],
      where: scope,
      group: ['Application.status'],
      raw: true,
    }) as unknown as Promise<{ status: string; count: string }[]>,
    db.Application.findAll({
      where: {
        [Op.and]: [scope, { status: { [Op.in]: ['submitted', 'under_review'] } }],
      },
      attributes: ['applicationNumber', 'status', 'programName', 'country', 'updatedAt'],
      include: [
        {
          model: db.StudentProfile,
          as: 'studentProfile',
          attributes: ['id'],
          include: [{ model: db.User, as: 'user', attributes: ['name', 'email'] }],
        },
      ],
      order: [['updatedAt', 'DESC']],
      limit: LIST_LIMIT,
    }),
    db.Document.findAll({
      where: { status: 'pending' },
      include: [
        {
          model: db.Application,
          as: 'application',
          required: true,
          where: scope,
          attributes: ['applicationNumber', 'status'],
        },
        {
          model: db.StudentProfile,
          as: 'studentProfile',
          include: [{ model: db.User, as: 'user', attributes: ['name', 'email'] }],
        },
      ],
      order: [['createdAt', 'DESC']],
      limit: LIST_LIMIT,
    }),
    db.Course.findAll({
      where: { universityId: ctx.universityId },
      attributes: ['courseName', 'degree', 'fee', 'duration'],
      limit: LIST_LIMIT,
    }),
    db.Deadline.findAll({
      where: { universityId: ctx.universityId },
      attributes: ['deadlineDate', 'intakeLabel'],
      include: [{ model: db.Course, as: 'course', attributes: ['courseName'] }],
      order: [['deadlineDate', 'ASC']],
      limit: LIST_LIMIT,
    }),
  ]);

  let commission: unknown = null;
  const uniPlain = uni?.get({ plain: true }) as { countersignedContractUrl?: string | null; countersignedVerifiedAt?: Date | null } | undefined;
  if (uniPlain?.countersignedContractUrl?.trim() || uniPlain?.countersignedVerifiedAt) {
    const cm = await db.Commission.findOne({
      where: { universityId: ctx.universityId },
      attributes: ['percentage', 'slabDetails'],
    });
    commission = cm?.get({ plain: true }) ?? null;
  }

  return [
    section('Your institution', uni?.get({ plain: true }) ?? {}),
    section('Application counts by status', Object.fromEntries(statusRows.map(r => [r.status, parseInt(r.count, 10)]))),
    section('Applications awaiting review', reviewApps.map(a => a.get({ plain: true }))),
    section('Pending document verifications', pendingDocs.map(d => d.get({ plain: true }))),
    section('Your courses (sample)', courses.map(c => c.get({ plain: true }))),
    section('Upcoming deadlines', deadlines.map(d => d.get({ plain: true }))),
    section('Your commission slab', commission),
  ].join('\n\n');
}

/** Role-scoped live database snapshot injected into every chat completion. */
export async function buildPlatformDataContext(ctx: ChatUserContext): Promise<string> {
  let body: string;
  switch (ctx.role) {
    case 'admin':
      body = await buildAdminContext();
      break;
    case 'student':
      body = await buildStudentContext(ctx);
      break;
    case 'agent':
      body = await buildAgentContext(ctx);
      break;
    case 'university':
      body = await buildUniversityContext(ctx);
      break;
    default:
      body = section('Platform', { role: ctx.role, note: 'Limited context for this role.' });
  }

  return trimContext(
    `Role: ${ctx.role}\nUse ONLY this live database context for operational questions (users, documents, applications, payments, etc.). Do not claim you lack access when the data appears below.\n\n${body}`,
  );
}
