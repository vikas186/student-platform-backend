import path from 'path';
import { Op, Sequelize, fn } from 'sequelize';
import { db } from '../config/database';
import AppError from '../utils/errorHandler';
import { APPLICATION_STATUSES } from '../models/Application.model';
import { PAYMENT_STATUSES } from '../models/Payment.model';
import { USER_ROLES, type UserRole } from '../models/User.model';
import { normalizeApplicationReference } from '../utils/applicationRef';
import { normalizeOfferReference } from '../utils/offerRef';
import { isUuid } from '../utils/isUuid';
import {
  backendApplicationStatusToUi,
  normalizeApplicationStatusInput,
} from '../utils/adminUiStatus';

const applicationWhereByIdOrRef = (idOrRef: string) => {
  const t = idOrRef.trim();
  if (isUuid(t)) {
    return { id: t };
  }
  const ref = normalizeApplicationReference(t);
  if (!ref) {
    throw new AppError('Invalid application id or reference (use UUID or APP-12345)', 400);
  }
  return { applicationNumber: ref };
};

export const getApplicationForAdmin = async (idOrRef: string) => {
  const app = await db.Application.findOne({
    where: applicationWhereByIdOrRef(idOrRef),
    include: [
      {
        model: db.StudentProfile,
        as: 'studentProfile',
        required: false,
        include: [{ model: db.User, as: 'user', attributes: ['id', 'name', 'email', 'phone', 'role'] }],
      },
      {
        model: db.AgentProfile,
        as: 'agentProfile',
        required: false,
        include: [{ model: db.User, as: 'user', attributes: ['id', 'name', 'email'] }],
      },
      {
        model: db.Course,
        as: 'course',
        required: false,
        include: [{ model: db.University, as: 'university', required: false }],
      },
    ],
  });
  if (!app) {
    throw new AppError('Application not found', 404);
  }
  return app;
};

export const listApplicationsForAdmin = async (query: {
  search?: string;
  status?: string;
  page?: string | number;
  limit?: string | number;
}) => {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
  const offset = (page - 1) * limit;

  const andParts: object[] = [];

  if (query.status?.trim()) {
    const resolved = normalizeApplicationStatusInput(query.status.trim());
    if (!resolved) {
      throw new AppError(
        'Invalid status filter — use a backend value (e.g. under_review) or Enroll UI label (e.g. Review)',
        400,
      );
    }
    andParts.push({ status: resolved });
  }

  if (query.search?.trim()) {
    const q = `%${query.search.trim()}%`;
    const matchingStudents = await db.StudentProfile.findAll({
      attributes: ['id'],
      include: [
        {
          model: db.User,
          as: 'user',
          required: true,
          where: {
            [Op.or]: [{ name: { [Op.iLike]: q } }, { email: { [Op.iLike]: q } }],
          },
        },
      ],
    });
    const studentIds = matchingStudents.map(s => s.id);

    andParts.push({
      [Op.or]: [
        { universityName: { [Op.iLike]: q } },
        { programName: { [Op.iLike]: q } },
        { notes: { [Op.iLike]: q } },
        { country: { [Op.iLike]: q } },
        { applicationNumber: { [Op.iLike]: q } },
        ...(studentIds.length ? [{ studentId: { [Op.in]: studentIds } }] : []),
      ],
    });
  }

  const where = andParts.length ? { [Op.and]: andParts } : {};

  const { rows, count } = await db.Application.findAndCountAll({
    where,
    order: [['updatedAt', 'DESC']],
    limit,
    offset,
    distinct: true,
    include: [
      {
        model: db.StudentProfile,
        as: 'studentProfile',
        required: false,
        include: [{ model: db.User, as: 'user', attributes: ['id', 'name', 'email', 'phone'] }],
      },
      {
        model: db.Course,
        as: 'course',
        required: false,
        include: [{ model: db.University, as: 'university', required: false }],
      },
    ],
  });

  const data = rows.map((a: any) => {
    const plain = a.get ? a.get({ plain: true }) : a;
    return {
      ...plain,
      statusLabel: backendApplicationStatusToUi(plain.status),
    };
  });

  return { data, page, limit, total: count };
};

export const updateApplicationStatusForAdmin = async (
  idOrRef: string,
  status: (typeof APPLICATION_STATUSES)[number],
) => {
  if (!(APPLICATION_STATUSES as readonly string[]).includes(status)) {
    throw new AppError('Invalid application status', 400);
  }
  const app = await db.Application.findOne({ where: applicationWhereByIdOrRef(idOrRef) });
  if (!app) {
    throw new AppError('Application not found', 404);
  }
  app.status = status;
  await app.save();
  return getApplicationForAdmin(app.id);
};

export const updateApplicationStatusFromUiForAdmin = async (idOrRef: string, uiStatus: string) => {
  const resolved = normalizeApplicationStatusInput(uiStatus);
  if (!resolved) {
    throw new AppError('Invalid status — use an Enroll label (e.g. Review) or backend enum (e.g. under_review)', 400);
  }
  return updateApplicationStatusForAdmin(idOrRef, resolved);
};

export const getApplicationStatusOptionsForAdmin = () => {
  return (APPLICATION_STATUSES as readonly string[]).map(s => ({
    value: s,
    uiLabel: backendApplicationStatusToUi(s),
  }));
};

export const listUniversitiesForAdmin = async () => {
  return db.University.findAll({ order: [['name', 'ASC']] });
};

export const listCoursesForAdmin = async (universityId: number) => {
  if (!Number.isFinite(universityId) || universityId < 1) {
    throw new AppError('Invalid universityId', 400);
  }
  return db.Course.findAll({
    where: { universityId },
    include: [{ model: db.University, as: 'university', attributes: ['id', 'name', 'country'] }],
    order: [['courseName', 'ASC']],
  });
};

/**
 * Matches Enroll admin "Add intake row" (free-text university) — creates university/course if needed.
 */
export const createIntakeRowForAdmin = async (body: {
  universityName: string;
  country?: string;
  intakeLabel: string;
  applicationDeadline?: string;
  scholarshipDeadline?: string;
  depositDeadline?: string;
  intakeStart?: string;
}) => {
  const name = body.universityName.trim();
  if (!name) {
    throw new AppError('universityName is required', 400);
  }
  if (!body.intakeLabel?.trim()) {
    throw new AppError('intakeLabel is required', 400);
  }
  const country = (body.country || 'General').trim() || 'General';
  let uni = await db.University.findOne({
    where: { name: { [Op.iLike]: name } },
  });
  if (!uni) {
    uni = await db.University.create({ name, country, status: true });
  }
  let course = await db.Course.findOne({
    where: { universityId: uni.id },
    order: [['id', 'ASC']],
  });
  if (!course) {
    course = await db.Course.create({
      universityId: uni.id,
      courseName: 'General programs',
      degree: 'Various',
      fee: 0,
      duration: 'N/A',
    });
  }
  const dateMatrix: Record<string, string | null> = {
    applicationDeadline: body.applicationDeadline?.trim() || null,
    scholarshipDeadline: body.scholarshipDeadline?.trim() || null,
    depositDeadline: body.depositDeadline?.trim() || null,
    intakeStart: body.intakeStart?.trim() || null,
  };
  const primary =
    dateMatrix.applicationDeadline ||
    dateMatrix.depositDeadline ||
    dateMatrix.scholarshipDeadline ||
    dateMatrix.intakeStart ||
    new Date().toISOString().slice(0, 10);
  const row = await db.Deadline.create({
    universityId: uni.id,
    courseId: course.id,
    deadlineDate: new Date(primary),
    intakeLabel: body.intakeLabel.trim(),
    dateMatrix,
  });
  return row.reload({
    include: [
      { model: db.University, as: 'university', attributes: ['id', 'name', 'country'] },
      { model: db.Course, as: 'course', attributes: ['id', 'courseName', 'degree'] },
    ],
  });
};

export const findApplicationForOfferMatch = async (opts: {
  studentName: string;
  program: string;
  university: string;
}) => {
  const sn = opts.studentName.trim();
  const prog = opts.program.trim();
  const uni = opts.university.trim();
  if (!sn || !prog || !uni) {
    throw new AppError('studentName, program, and university are required', 400);
  }
  const qStudent = `%${sn}%`;
  const qProg = `%${prog}%`;
  const qUni = `%${uni}%`;

  const app = await db.Application.findOne({
    where: {
      [Op.and]: [
        { programName: { [Op.iLike]: qProg } },
        { universityName: { [Op.iLike]: qUni } },
      ],
    },
    include: [
      {
        model: db.StudentProfile,
        as: 'studentProfile',
        required: true,
        include: [
          {
            model: db.User,
            as: 'user',
            required: true,
            where: { name: { [Op.iLike]: qStudent } },
          },
        ],
      },
    ],
    order: [['updatedAt', 'DESC']],
  });
  if (!app) {
    throw new AppError(
      'No matching application — ensure student name, program, and university match an existing application, or pass applicationId instead.',
      404,
    );
  }
  return app;
};

export const uploadOfferLetterByMatchForAdmin = async (
  file: Express.Multer.File,
  fields: { studentName: string; program: string; university: string },
) => {
  if (!file) {
    throw new AppError('File is required', 400);
  }
  const app = await findApplicationForOfferMatch(fields);
  let letter = await db.OfferLetter.findOne({ where: { applicationId: app.id } });
  if (!letter) {
    const student = await db.StudentProfile.findByPk((app as any).studentId, {
      include: [{ model: db.User, as: 'user', attributes: ['name'] }],
    });
    const user = (student as any)?.user;
    letter = await db.OfferLetter.create({
      applicationId: app.id,
      fileUrl: null,
      uploadedAt: new Date(),
      status: 'pending',
      universityName: (app as any).universityName,
      programName: (app as any).programName,
      studentDisplayName: user?.name || null,
      expiresAt: null,
      notes: null,
    });
  }
  const url = file.path.replace(/\\/g, '/');
  letter.fileUrl = url;
  letter.status = 'active';
  letter.uploadedAt = new Date();
  await letter.save();
  return letter;
};

export const createCommissionSlabRichForAdmin = async (body: {
  universityName: string;
  partnerCommissionPercent: number;
  rates?: Partial<Record<string, number>>;
  country?: string;
}) => {
  const name = body.universityName.trim();
  if (!name) {
    throw new AppError('universityName is required', 400);
  }
  let uni = await db.University.findOne({
    where: { name: { [Op.iLike]: name } },
  });
  if (!uni) {
    uni = await db.University.create({
      name,
      country: (body.country || 'General').trim() || 'General',
      status: true,
    });
  }
  const slabDetails = JSON.stringify({
    partnerCommissionPercent: Number(body.partnerCommissionPercent),
    rates: body.rates ?? {},
    source: 'admin-ui',
  });
  return db.Commission.create({
    universityId: uni.id,
    percentage: Number(body.partnerCommissionPercent),
    slabDetails,
  });
};

export const patchAgentSubscriptionForAdmin = async (
  agentProfileId: number,
  subscriptionPlanId: number | null,
) => {
  const agent = await db.AgentProfile.findByPk(agentProfileId);
  if (!agent) {
    throw new AppError('Agent profile not found', 404);
  }
  if (subscriptionPlanId != null) {
    const plan = await db.SubscriptionPlan.findByPk(subscriptionPlanId);
    if (!plan) {
      throw new AppError('Subscription plan not found', 404);
    }
  }
  agent.subscriptionPlanId = subscriptionPlanId;
  await agent.save();
  return agent.reload({
    include: [{ model: db.SubscriptionPlan, as: 'subscriptionPlan', required: false }],
  });
};

export const deleteApplicationForAdmin = async (idOrRef: string) => {
  const app = await db.Application.findOne({ where: applicationWhereByIdOrRef(idOrRef) });
  if (!app) {
    throw new AppError('Application not found', 404);
  }
  await app.destroy();
};

export const listUsersForAdmin = async (query: {
  search?: string;
  role?: string;
  page?: string | number;
  limit?: string | number;
}) => {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
  const offset = (page - 1) * limit;

  const where: Record<string, unknown> = {};

  if (query.role?.trim()) {
    const r = query.role.trim().toLowerCase();
    if (!(USER_ROLES as readonly string[]).includes(r)) {
      throw new AppError('Invalid role filter', 400);
    }
    where.role = r;
  }

  if (query.search?.trim()) {
    const q = `%${query.search.trim()}%`;
    (where as any)[Op.or] = [
      { name: { [Op.iLike]: q } },
      { email: { [Op.iLike]: q } },
      Sequelize.where(Sequelize.cast(Sequelize.col('User.role'), 'TEXT'), { [Op.iLike]: q }),
    ];
  }

  const { rows, count } = await db.User.findAndCountAll({
    where,
    attributes: { exclude: ['password'] },
    order: [['createdAt', 'DESC']],
    limit,
    offset,
  });

  return { data: rows, page, limit, total: count };
};

type CreateAdminUserBody = {
  fullName: string;
  email: string;
  password: string;
  role: UserRole;
  phone?: string | null;
  agencyName?: string | null;
  targetCountries?: string[];
};

export const createUserForAdmin = async (body: CreateAdminUserBody) => {
  const email = String(body.email).trim().toLowerCase();
  if (await db.User.findOne({ where: { email } })) {
    throw new AppError('Email already taken', 400);
  }

  const role = body.role;
  if (!(USER_ROLES as readonly string[]).includes(role)) {
    throw new AppError('Invalid role', 400);
  }

  const user = await db.User.create({
    name: String(body.fullName).trim(),
    email,
    password: body.password,
    role,
    phone: body.phone?.trim() || null,
    status: true,
  });

  if (role === 'student') {
    await db.StudentProfile.create({
      userId: user.id,
      academicDetails: null,
      preferredCountry: null,
      targetCountries: Array.isArray(body.targetCountries) ? body.targetCountries : [],
    });
  } else if (role === 'agent') {
    const agency = body.agencyName?.trim() || 'Agency';
    await db.AgentProfile.create({
      userId: user.id,
      agencyName: agency,
      primaryMarket: null,
    });
  }

  return user.toSafeObject();
};

export const updateUserRoleForAdmin = async (
  userId: string,
  newRole: UserRole,
  actorUserId: string,
) => {
  if (userId === actorUserId) {
    throw new AppError('You cannot change your own role', 400);
  }
  if (!(USER_ROLES as readonly string[]).includes(newRole)) {
    throw new AppError('Invalid role', 400);
  }

  const user = await db.User.findByPk(userId);
  if (!user) {
    throw new AppError('User not found', 404);
  }

  if (user.role === 'admin' && newRole !== 'admin') {
    const adminCount = await db.User.count({ where: { role: 'admin' } });
    if (adminCount <= 1) {
      throw new AppError('Cannot remove the last administrator', 400);
    }
  }

  const prev = user.role;
  user.role = newRole;
  await user.save();

  if (newRole === 'student' && !(await db.StudentProfile.findOne({ where: { userId } }))) {
    await db.StudentProfile.create({
      userId,
      academicDetails: null,
      preferredCountry: null,
      targetCountries: [],
    });
  }
  if (newRole === 'agent' && !(await db.AgentProfile.findOne({ where: { userId } }))) {
    await db.AgentProfile.create({
      userId,
      agencyName: 'Agency',
      primaryMarket: null,
    });
  }

  void prev;

  return user.toSafeObject();
};

export const deleteUserForAdmin = async (userId: string, actorUserId: string) => {
  if (userId === actorUserId) {
    throw new AppError('You cannot delete your own account', 400);
  }
  const user = await db.User.findByPk(userId);
  if (!user) {
    throw new AppError('User not found', 404);
  }
  if (user.role === 'admin') {
    const adminCount = await db.User.count({ where: { role: 'admin' } });
    if (adminCount <= 1) {
      throw new AppError('Cannot delete the last administrator', 400);
    }
  }
  await user.destroy();
};

export const listDeadlinesForAdmin = async (query: { search?: string; page?: number; limit?: number }) => {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(200, Math.max(1, Number(query.limit) || 50));
  const offset = (page - 1) * limit;

  const all = await db.Deadline.findAll({
    include: [
      { model: db.University, as: 'university', attributes: ['id', 'name', 'country'] },
      { model: db.Course, as: 'course', attributes: ['id', 'courseName', 'degree'] },
    ],
    order: [['deadlineDate', 'ASC']],
    limit: 2000,
  });

  const q = query.search?.trim().toLowerCase();
  const filtered = q
    ? all.filter(r => {
        const uni = (r as any).university?.name?.toLowerCase() || '';
        const intake = String((r as any).intakeLabel || '').toLowerCase();
        const cn = (r as any).course?.courseName?.toLowerCase() || '';
        return uni.includes(q) || intake.includes(q) || cn.includes(q);
      })
    : all;

  const total = filtered.length;
  const data = filtered.slice(offset, offset + limit);
  return { data, page, limit, total };
};

export const createDeadlineForAdmin = async (body: {
  universityId: number;
  courseId: number;
  deadlineDate: string;
  intakeLabel?: string | null;
  dateMatrix?: Record<string, unknown> | null;
}) => {
  const uni = await db.University.findByPk(body.universityId);
  if (!uni) {
    throw new AppError('University not found', 404);
  }
  const course = await db.Course.findOne({
    where: { id: body.courseId, universityId: body.universityId },
  });
  if (!course) {
    throw new AppError('Course not found for this university', 404);
  }
  return db.Deadline.create({
    universityId: body.universityId,
    courseId: body.courseId,
    deadlineDate: new Date(body.deadlineDate),
    intakeLabel: body.intakeLabel?.trim() || null,
    dateMatrix: body.dateMatrix ?? null,
  });
};

export const updateDeadlineForAdmin = async (
  id: number,
  body: Partial<{
    deadlineDate: string;
    intakeLabel: string | null;
    dateMatrix: Record<string, unknown> | null;
    universityId: number;
    courseId: number;
  }>,
) => {
  const row = await db.Deadline.findByPk(id);
  if (!row) {
    throw new AppError('Deadline not found', 404);
  }
  if (body.deadlineDate !== undefined) {
    row.deadlineDate = new Date(body.deadlineDate);
  }
  if (body.intakeLabel !== undefined) {
    row.intakeLabel = body.intakeLabel === null || body.intakeLabel === '' ? null : String(body.intakeLabel).trim();
  }
  if (body.dateMatrix !== undefined) {
    row.dateMatrix = body.dateMatrix;
  }
  if (body.universityId !== undefined || body.courseId !== undefined) {
    const uniId = body.universityId ?? row.universityId;
    const courseId = body.courseId ?? row.courseId;
    const course = await db.Course.findOne({ where: { id: courseId, universityId: uniId } });
    if (!course) {
      throw new AppError('Course not found for this university', 404);
    }
    row.universityId = uniId;
    row.courseId = courseId;
  }
  await row.save();
  return row.reload({
    include: [
      { model: db.University, as: 'university', attributes: ['id', 'name', 'country'] },
      { model: db.Course, as: 'course', attributes: ['id', 'courseName', 'degree'] },
    ],
  });
};

export const deleteDeadlineForAdmin = async (id: number) => {
  const row = await db.Deadline.findByPk(id);
  if (!row) {
    throw new AppError('Deadline not found', 404);
  }
  await row.destroy();
};

const offerLetterClause = (param: string): { id?: number; referenceCode?: string } => {
  const t = param.trim();
  if (/^\d+$/.test(t)) {
    return { id: parseInt(t, 10) };
  }
  const ref = normalizeOfferReference(t);
  if (ref) {
    return { referenceCode: ref };
  }
  throw new AppError('Invalid offer letter id (numeric id or OFR-123)', 400);
};

export const listOfferLettersForAdmin = async (query: { search?: string }) => {
  const rows = await db.OfferLetter.findAll({
    include: [
      {
        model: db.Application,
        as: 'application',
        required: false,
        attributes: ['id', 'applicationNumber'],
        include: [
          {
            model: db.StudentProfile,
            as: 'studentProfile',
            required: false,
            include: [{ model: db.User, as: 'user', attributes: ['name', 'email'] }],
          },
        ],
      },
    ],
    order: [['createdAt', 'DESC']],
    limit: 500,
  });

  const mapped = rows.map((letter: any) => {
    const plain = letter.get ? letter.get({ plain: true }) : letter;
    const fileName = plain.fileUrl ? path.basename(String(plain.fileUrl)) : null;
    return { ...plain, fileName };
  });

  if (!query.search?.trim()) {
    return mapped;
  }
  const q = query.search.trim().toLowerCase();
  return mapped.filter(
    (r: any) =>
      String(r.referenceCode || '').toLowerCase().includes(q) ||
      String(r.studentDisplayName || '').toLowerCase().includes(q) ||
      String(r.universityName || '').toLowerCase().includes(q) ||
      String(r.programName || '').toLowerCase().includes(q) ||
      String(r.fileName || '').toLowerCase().includes(q),
  );
};

export const createOfferLetterForAdmin = async (body: {
  applicationId: string;
  universityName?: string | null;
  programName?: string | null;
  studentDisplayName?: string | null;
  notes?: string | null;
  expiresAt?: string | null;
}) => {
  const app = await getApplicationForAdmin(body.applicationId);
  const existing = await db.OfferLetter.findOne({ where: { applicationId: app.id } });
  if (existing) {
    throw new AppError('An offer letter already exists for this application', 409);
  }
  const student = await db.StudentProfile.findByPk((app as any).studentId, {
    include: [{ model: db.User, as: 'user', attributes: ['name'] }],
  });
  const user = (student as any)?.user;

  return db.OfferLetter.create({
    applicationId: app.id,
    fileUrl: null,
    uploadedAt: new Date(),
    status: 'pending',
    universityName: body.universityName?.trim() || (app as any).universityName,
    programName: body.programName?.trim() || (app as any).programName,
    studentDisplayName: body.studentDisplayName?.trim() || user?.name || null,
    expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
    notes: body.notes?.trim() || null,
  });
};

export const uploadOfferLetterFileForAdmin = async (param: string, file: Express.Multer.File) => {
  if (!file) {
    throw new AppError('File is required', 400);
  }
  const clause = offerLetterClause(param);
  const letter = await db.OfferLetter.findOne({ where: clause });
  if (!letter) {
    throw new AppError('Offer letter not found', 404);
  }
  const url = file.path.replace(/\\/g, '/');
  letter.fileUrl = url;
  letter.status = 'active';
  letter.uploadedAt = new Date();
  await letter.save();
  return letter;
};

export const deleteOfferLetterForAdmin = async (param: string) => {
  const clause = offerLetterClause(param);
  const letter = await db.OfferLetter.findOne({ where: clause });
  if (!letter) {
    throw new AppError('Offer letter not found', 404);
  }
  await letter.destroy();
};

export const listAgentsForAdmin = async (query: { search?: string; sort?: string }) => {
  const profiles = await db.AgentProfile.findAll({
    include: [
      { model: db.User, as: 'user', attributes: ['id', 'name', 'email', 'phone', 'status'] },
      { model: db.AgentRanking, as: 'ranking', required: false },
      { model: db.SubscriptionPlan, as: 'subscriptionPlan', required: false, attributes: ['id', 'name', 'price'] },
    ],
    order: [['agencyName', 'ASC']],
  });

  const enriched = await Promise.all(
    profiles.map(async p => {
      const pid = p.id;
      const totalApps = await db.Application.count({ where: { agentId: pid } });
      const successStatuses = ['enrolled', 'visa_approved', 'deposit_paid'];
      const won = await db.Application.count({
        where: { agentId: pid, status: { [Op.in]: successStatuses } },
      });
      const conversionRate = totalApps ? Math.round((won / totalApps) * 1000) / 10 : 0;

      const tier =
        conversionRate >= 70 ? 'Gold' : conversionRate >= 50 ? 'Silver' : totalApps > 0 ? 'Bronze' : 'Bronze';

      return {
        id: p.id,
        agencyName: p.agencyName,
        primaryMarket: p.primaryMarket,
        logoUrl: p.logoUrl,
        user: (p as any).user,
        ranking: (p as any).ranking,
        subscriptionPlan: (p as any).subscriptionPlan,
        studentCount: await db.StudentProfile.count({ where: { agentProfileId: pid } }),
        applicationCount: totalApps,
        conversionRate,
        tier,
      };
    }),
  );

  let rows = enriched;
  if (query.search?.trim()) {
    const q = query.search.trim().toLowerCase();
    rows = enriched.filter(
      r =>
        r.agencyName.toLowerCase().includes(q) ||
        String(r.primaryMarket || '').toLowerCase().includes(q) ||
        String((r.user as any)?.name || '')
          .toLowerCase()
          .includes(q),
    );
  }

  if (query.sort === 'conversion') {
    rows = [...rows].sort((a, b) => b.conversionRate - a.conversionRate);
  }

  return rows;
};

export const getDashboardForAdmin = async () => {
  const [userCounts, appStatusRows, paymentPending, agents] = await Promise.all([
    db.User.findAll({
      attributes: ['role', [fn('COUNT', Sequelize.col('User.id')), 'count']],
      group: ['User.role'],
      raw: true,
      subQuery: false,
    }) as unknown as Promise<{ role: string; count: string }[]>,
    db.Application.findAll({
      attributes: ['status', [fn('COUNT', Sequelize.col('Application.id')), 'count']],
      group: ['Application.status'],
      raw: true,
      subQuery: false,
    }) as unknown as Promise<{ status: string; count: string }[]>,
    db.Payment.count({ where: { status: 'pending' } }),
    db.AgentProfile.count(),
  ]);

  return {
    usersByRole: Object.fromEntries(userCounts.map(r => [r.role, parseInt(r.count, 10)])),
    applicationsByStatus: Object.fromEntries(appStatusRows.map(r => [r.status, parseInt(r.count, 10)])),
    pendingPayments: paymentPending,
    agentAccounts: agents,
  };
};

export const listPaymentsForAdmin = async (query: { status?: string; page?: number; limit?: number }) => {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 30));
  const offset = (page - 1) * limit;
  const where: Record<string, unknown> = {};
  if (query.status) {
    if (!(PAYMENT_STATUSES as readonly string[]).includes(query.status as (typeof PAYMENT_STATUSES)[number])) {
      throw new AppError('Invalid payment status filter', 400);
    }
    where.status = query.status;
  }
  const { rows, count } = await db.Payment.findAndCountAll({
    where,
    include: [
      { model: db.User, as: 'user', attributes: ['id', 'name', 'email'] },
      { model: db.Application, as: 'application', attributes: ['id', 'applicationNumber'], required: false },
      { model: db.AgentProfile, as: 'agentProfile', attributes: ['id', 'agencyName'], required: false },
    ],
    order: [['createdAt', 'DESC']],
    limit,
    offset,
  });
  const data = rows.map(p => {
    const plain = p.get ? p.get({ plain: true }) : p;
    const st = (plain as { status?: string }).status;
    const statusUi = st === 'success' ? 'paid' : st;
    return { ...plain, statusUi };
  });
  return { data, page, limit, total: count };
};

export const listCommissionsForAdmin = async () => {
  const rows = await db.Commission.findAll({
    include: [{ model: db.University, as: 'university', attributes: ['id', 'name', 'country'] }],
    order: [['universityId', 'ASC']],
  });
  return rows.map(c => {
    const plain = c.get ? c.get({ plain: true }) : c;
    let parsedSlab: Record<string, unknown> | null = null;
    const raw = (plain as { slabDetails?: string | null }).slabDetails;
    if (raw && typeof raw === 'string' && raw.trim().startsWith('{')) {
      try {
        parsedSlab = JSON.parse(raw) as Record<string, unknown>;
      } catch {
        parsedSlab = null;
      }
    }
    return { ...plain, parsedSlab };
  });
};

export const createCommissionForAdmin = async (body: {
  universityId: number;
  percentage: number;
  slabDetails?: string | null;
}) => {
  const uni = await db.University.findByPk(body.universityId);
  if (!uni) {
    throw new AppError('University not found', 404);
  }
  return db.Commission.create({
    universityId: body.universityId,
    percentage: Number(body.percentage),
    slabDetails: body.slabDetails?.trim() || null,
  });
};

export const updateCommissionForAdmin = async (
  id: number,
  body: Partial<{ percentage: number; slabDetails: string | null }>,
) => {
  const row = await db.Commission.findByPk(id);
  if (!row) {
    throw new AppError('Commission slab not found', 404);
  }
  if (body.percentage !== undefined) {
    row.percentage = Number(body.percentage);
  }
  if (body.slabDetails !== undefined) {
    row.slabDetails = body.slabDetails === null || body.slabDetails === '' ? null : String(body.slabDetails).trim();
  }
  await row.save();
  return row.reload({
    include: [{ model: db.University, as: 'university', attributes: ['id', 'name', 'country'] }],
  });
};

export const deleteCommissionForAdmin = async (id: number) => {
  const row = await db.Commission.findByPk(id);
  if (!row) {
    throw new AppError('Commission slab not found', 404);
  }
  await row.destroy();
};

export const listSubscriptionPlansForAdmin = async () => {
  return db.SubscriptionPlan.findAll({ order: [['id', 'ASC']] });
};

export const createSubscriptionPlanForAdmin = async (body: { name: string; price: number; features?: string | null }) => {
  return db.SubscriptionPlan.create({
    name: body.name.trim(),
    price: body.price,
    features: body.features?.trim() || null,
  });
};

export const updateSubscriptionPlanForAdmin = async (
  id: number,
  body: Partial<{ name: string; price: number; features: string | null }>,
) => {
  const row = await db.SubscriptionPlan.findByPk(id);
  if (!row) {
    throw new AppError('Subscription plan not found', 404);
  }
  if (body.name !== undefined) {
    row.name = String(body.name).trim();
  }
  if (body.price !== undefined) {
    row.price = Number(body.price);
  }
  if (body.features !== undefined) {
    row.features = body.features === null || body.features === '' ? null : String(body.features).trim();
  }
  await row.save();
  return row;
};

export const deleteSubscriptionPlanForAdmin = async (id: number) => {
  const row = await db.SubscriptionPlan.findByPk(id);
  if (!row) {
    throw new AppError('Subscription plan not found', 404);
  }
  await row.destroy();
};

export const createUniversityForAdmin = async (body: { name: string; country: string; status?: boolean }) => {
  return db.University.create({
    name: body.name.trim(),
    country: body.country.trim(),
    status: body.status !== false,
  });
};

export const updateUniversityForAdmin = async (
  id: number,
  body: Partial<{ name: string; country: string; status: boolean }>,
) => {
  const row = await db.University.findByPk(id);
  if (!row) {
    throw new AppError('University not found', 404);
  }
  if (body.name !== undefined) {
    row.name = String(body.name).trim();
  }
  if (body.country !== undefined) {
    row.country = String(body.country).trim();
  }
  if (body.status !== undefined) {
    row.status = Boolean(body.status);
  }
  await row.save();
  return row;
};

export const deleteUniversityForAdmin = async (id: number) => {
  const row = await db.University.findByPk(id);
  if (!row) {
    throw new AppError('University not found', 404);
  }
  await row.destroy();
};

export const adminGlobalSearch = async (q: string) => {
  if (!q.trim()) {
    return { applications: [], users: [], universities: [] };
  }
  const qq = `%${q.trim()}%`;

  const applications = await db.Application.findAll({
    where: {
      [Op.or]: [
        { universityName: { [Op.iLike]: qq } },
        { programName: { [Op.iLike]: qq } },
        { applicationNumber: { [Op.iLike]: qq } },
      ],
    },
    limit: 15,
    attributes: ['id', 'applicationNumber', 'universityName', 'programName', 'status'],
  });

  const users = await db.User.findAll({
    where: {
      [Op.or]: [{ name: { [Op.iLike]: qq } }, { email: { [Op.iLike]: qq } }],
    },
    limit: 15,
    attributes: ['id', 'name', 'email', 'role'],
  });

  const universities = await db.University.findAll({
    where: { name: { [Op.iLike]: qq } },
    limit: 10,
    attributes: ['id', 'name', 'country'],
  });

  return { applications, users, universities };
};

export const getRolesMetadataForAdmin = () => ({
  roles: [...USER_ROLES],
  descriptions: {
    student: 'Student applicant',
    agent: 'Recruitment partner / agency',
    admin: 'Platform administrator',
    university: 'Institution portal user',
  },
});
