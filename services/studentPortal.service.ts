import fs from 'fs';
import path from 'path';
import { Op } from 'sequelize';
import { db } from '../config/database';
import AppError from '../utils/errorHandler';
import { APPLICATION_STATUSES } from '../models/Application.model';
import { normalizeApplicationReference } from '../utils/applicationRef';
import { isUuid } from '../utils/isUuid';

const applicationLookupWhere = (
  studentProfileId: number,
  idOrRef: string,
): { studentId: number; id?: string; applicationNumber?: string } => {
  const t = idOrRef.trim();
  if (isUuid(t)) {
    return { studentId: studentProfileId, id: t };
  }
  const ref = normalizeApplicationReference(t);
  if (!ref) {
    throw new AppError('Invalid application id or reference (use UUID or APP-12345)', 400);
  }
  return { studentId: studentProfileId, applicationNumber: ref };
};

const requireStudentProfile = async (userId: string) => {
  const profile = await db.StudentProfile.findOne({ where: { userId } });
  if (!profile) {
    throw new AppError('Student profile not found', 404);
  }
  return profile;
};

const buildMergedProfile = (user: any, profile: any) => ({
  id: user.id,
  fullName: user.name,
  email: user.email,
  phone: user.phone,
  role: user.role,
  countryOfResidence: profile.countryOfResidence ?? null,
  targetCountries: profile.targetCountries ?? [],
  highestEducation: profile.highestEducation ?? null,
  gradeGpa: profile.gradeGpa ?? null,
  academicDetails: profile.academicDetails ?? null,
  preferredCountry: profile.preferredCountry ?? null,
  /** When set, new applications are tied to this agent and appear in their portal */
  linkedAgentProfileId: profile.agentProfileId ?? null,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

export const getStudentPortalProfile = async (userId: string) => {
  const user = await db.User.findByPk(userId);
  if (!user) throw new AppError('User not found', 404);
  const profile = await requireStudentProfile(userId);
  return buildMergedProfile(user, profile);
};

export const updateStudentPortalProfile = async (userId: string, body: Record<string, unknown>) => {
  const user = await db.User.findByPk(userId);
  const profile = await requireStudentProfile(userId);
  if (!user) throw new AppError('User not found', 404);

  const nextEmail = typeof body.email === 'string' ? body.email.trim() : undefined;
  if (nextEmail && nextEmail !== user.email) {
    if (await db.User.findOne({ where: { email: nextEmail } })) {
      throw new AppError('Email already in use', 400);
    }
    user.email = nextEmail;
  }

  const fullName = (body.fullName as string) || (body.name as string);
  if (fullName !== undefined && fullName !== null && String(fullName).trim() !== '') {
    user.name = String(fullName).trim();
  }
  if (body.phone !== undefined) {
    user.phone = body.phone === '' || body.phone === null ? null : String(body.phone);
  }
  if (typeof body.password === 'string' && body.password.length > 0) {
    user.password = body.password;
  }

  if (body.countryOfResidence !== undefined) {
    profile.countryOfResidence =
      body.countryOfResidence === '' || body.countryOfResidence === null
        ? null
        : String(body.countryOfResidence).trim();
  }
  if (body.targetCountries !== undefined) {
    profile.targetCountries = Array.isArray(body.targetCountries) ? (body.targetCountries as string[]) : [];
  }
  if (body.highestEducation !== undefined) {
    profile.highestEducation =
      body.highestEducation === '' || body.highestEducation === null
        ? null
        : String(body.highestEducation).trim();
  }
  if (body.gradeGpa !== undefined) {
    profile.gradeGpa =
      body.gradeGpa === '' || body.gradeGpa === null ? null : String(body.gradeGpa).trim();
  }

  if (body.linkedAgentProfileId !== undefined || body.agentProfileId !== undefined) {
    const raw = body.linkedAgentProfileId ?? body.agentProfileId;
    if (raw === null || raw === '') {
      profile.agentProfileId = null;
    } else {
      const n = typeof raw === 'number' ? raw : parseInt(String(raw), 10);
      if (Number.isNaN(n) || n < 1) {
        throw new AppError('Invalid linkedAgentProfileId', 400);
      }
      const agent = await db.AgentProfile.findByPk(n);
      if (!agent) {
        throw new AppError('Agent profile not found', 404);
      }
      profile.agentProfileId = n;
      await db.Application.update(
        { agentId: n },
        { where: { studentId: profile.id, agentId: null } },
      );
    }
  }

  await user.save();
  await profile.save();

  return getStudentPortalProfile(userId);
};

export const listStudentApplications = async (
  studentProfileId: number,
  query: { search?: string; status?: string; country?: string; id?: string; applicationNumber?: string },
) => {
  const where: Record<string, unknown> = { studentId: studentProfileId };

  if (query.status) {
    if (!(APPLICATION_STATUSES as readonly string[]).includes(query.status)) {
      throw new AppError('Invalid status filter', 400);
    }
    where.status = query.status;
  }
  if (query.country && query.country.trim()) {
    where.country = { [Op.iLike]: `%${query.country.trim()}%` };
  }
  if (query.id && isUuid(query.id)) {
    where.id = query.id;
  }
  if (query.applicationNumber && query.applicationNumber.trim()) {
    const ref = normalizeApplicationReference(query.applicationNumber.trim());
    if (!ref) {
      throw new AppError('Invalid applicationNumber (expected APP-12345)', 400);
    }
    where.applicationNumber = ref;
  }
  if (query.search && query.search.trim()) {
    const q = `%${query.search.trim()}%`;
    (where as any)[Op.or] = [
      { universityName: { [Op.iLike]: q } },
      { programName: { [Op.iLike]: q } },
      { notes: { [Op.iLike]: q } },
      { country: { [Op.iLike]: q } },
      { applicationNumber: { [Op.iLike]: q } },
    ];
  }

  return db.Application.findAll({
    where,
    order: [['updatedAt', 'DESC']],
    include: [{ model: db.Course, as: 'course', attributes: ['id', 'courseName', 'degree'], required: false }],
  });
};

export const createStudentApplication = async (
  studentProfileId: number,
  body: { universityName?: string | null; programName?: string | null; notes?: string | null; country?: string | null },
) => {
  const sp = await db.StudentProfile.findByPk(studentProfileId);
  const linkedAgentId = sp?.agentProfileId ?? null;
  return db.Application.create({
    studentId: studentProfileId,
    agentId: linkedAgentId,
    courseId: null,
    universityName: body.universityName?.trim() || null,
    programName: body.programName?.trim() || null,
    notes: body.notes?.trim() || null,
    country: body.country?.trim() || null,
    status: 'draft',
  });
};

export const getStudentApplication = async (studentProfileId: number, idOrRef: string) => {
  const app = await db.Application.findOne({
    where: applicationLookupWhere(studentProfileId, idOrRef),
    include: [{ model: db.Course, as: 'course', attributes: ['id', 'courseName', 'degree'], required: false }],
  });
  if (!app) throw new AppError('Application not found', 404);
  return app;
};

export const updateStudentApplication = async (
  studentProfileId: number,
  idOrRef: string,
  body: { universityName?: string | null; programName?: string | null; notes?: string | null; country?: string | null },
) => {
  const app = await getStudentApplication(studentProfileId, idOrRef);
  if (app.status !== 'draft') {
    throw new AppError('Only draft applications can be edited', 400);
  }
  if (body.universityName !== undefined) app.universityName = body.universityName?.trim() || null;
  if (body.programName !== undefined) app.programName = body.programName?.trim() || null;
  if (body.notes !== undefined) app.notes = body.notes?.trim() || null;
  if (body.country !== undefined) app.country = body.country?.trim() || null;
  await app.save();
  return app;
};

export const submitStudentApplication = async (studentProfileId: number, idOrRef: string) => {
  const app = await getStudentApplication(studentProfileId, idOrRef);
  if (app.status !== 'draft') {
    throw new AppError('Application is not a draft', 400);
  }
  const uni = app.universityName?.trim();
  const prog = app.programName?.trim();
  if (!uni || !prog) {
    throw new AppError('University and program are required to submit', 400);
  }
  const sp = await db.StudentProfile.findByPk(studentProfileId);
  if (sp?.agentProfileId && app.agentId == null) {
    app.agentId = sp.agentProfileId;
  }
  app.status = 'submitted';
  await app.save();
  return app;
};

export const deleteStudentApplication = async (studentProfileId: number, idOrRef: string) => {
  const app = await getStudentApplication(studentProfileId, idOrRef);
  if (app.status !== 'draft') {
    throw new AppError('Only draft applications can be deleted', 400);
  }
  await app.destroy();
};

export const listStudentDocuments = async (studentProfileId: number) => {
  return db.Document.findAll({
    where: { studentProfileId },
    order: [['createdAt', 'DESC']],
    attributes: ['id', 'applicationId', 'fileUrl', 'originalFileName', 'type', 'fileSize', 'status', 'createdAt', 'updatedAt'],
  });
};

export const createStudentDocument = async (
  studentProfileId: number,
  file: Express.Multer.File,
  opts: { applicationId?: string | null; documentType?: string },
) => {
  if (!file) throw new AppError('File is required', 400);

  let applicationId: string | null = null;
  if (opts.applicationId && String(opts.applicationId).trim()) {
    const raw = String(opts.applicationId).trim();
    const app = await db.Application.findOne({
      where: applicationLookupWhere(studentProfileId, raw),
    });
    if (!app) throw new AppError('Application not found', 404);
    applicationId = app.id;
  }

  const fileUrl = file.path.replace(/\\/g, '/');
  return db.Document.create({
    studentProfileId,
    applicationId,
    fileUrl,
    originalFileName: file.originalname,
    type: (opts.documentType || 'general').slice(0, 64),
    fileSize: file.size,
    status: 'pending',
  });
};

export const deleteStudentDocument = async (studentProfileId: number, documentId: string) => {
  if (!isUuid(documentId)) throw new AppError('Invalid document id', 400);
  const doc = await db.Document.findOne({
    where: { id: documentId, studentProfileId },
  });
  if (!doc) throw new AppError('Document not found', 404);

  try {
    if (doc.fileUrl && !doc.fileUrl.startsWith('http')) {
      const abs = path.isAbsolute(doc.fileUrl) ? doc.fileUrl : path.join(process.cwd(), doc.fileUrl);
      if (fs.existsSync(abs)) fs.unlinkSync(abs);
    }
  } catch {
    /* ignore missing file */
  }

  await doc.destroy();
};
