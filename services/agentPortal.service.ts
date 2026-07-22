import fs from 'fs';
import path from 'path';
import { randomBytes } from 'crypto';
import { fn, Op, QueryTypes, Sequelize, type Transaction } from 'sequelize';
import { db } from '../config/database';
import AppError from '../utils/errorHandler';
import { APPLICATION_STATUSES } from '../models/Application.model';
import { DOCUMENT_STATUSES } from '../models/Document.model';
import { OFFER_LETTER_STATUSES } from '../models/OfferLetter.model';
import { normalizeApplicationReference } from '../utils/applicationRef';
import { normalizeOfferReference } from '../utils/offerRef';
import { isUuid } from '../utils/isUuid';
import { readAgentAgreementPdf, resolveAgentAgreementPdfPath } from './agent-agreement.service';

const CHECKLIST_TYPES: { key: string; label: string }[] = [
  { key: 'passport_id', label: 'Passport / ID' },
  { key: 'academic_transcripts', label: 'Academic transcripts' },
  { key: 'statement_of_purpose', label: 'Statement of purpose' },
  { key: 'income_tax_return', label: 'Income tax return (ITR)' },
  { key: 'bank_statements', label: 'Bank statements (3–6 months)' },
  { key: 'financial_sponsor_letter', label: 'Other financial / sponsor letter' },
];

/**
 * `$studentProfile.*$` in WHERE does not reliably JOIN `student_profiles` (COUNT/subqueries → PG error
 * "missing FROM-clause entry for table studentProfile"). Use EXISTS instead.
 * @param applicationTableAlias Sequelize SQL alias for `applications` in this query (root vs nested include).
 */
const linkedStudentMatchesAgentExists = (agentProfileId: number, applicationTableAlias: string) => {
  const aid = Number(agentProfileId);
  if (!Number.isFinite(aid)) {
    throw new AppError('Invalid agent scope', 400);
  }
  return Sequelize.literal(
    `(EXISTS (SELECT 1 FROM student_profiles AS sp WHERE sp.id = ${applicationTableAlias}."student_id" AND sp.agent_profile_id = ${aid}))`,
  );
};

/** Root query on Application — alias is typically "Application". */
const applicationScopeForAgent = (agentProfileId: number) => ({
  [Op.or]: [{ agentId: Number(agentProfileId) }, linkedStudentMatchesAgentExists(agentProfileId, '"Application"')],
});

/** Application included as association `as: 'application'` — alias is "application". */
const applicationScopeOnIncludedApplication = (agentProfileId: number) => ({
  [Op.or]: [{ agentId: Number(agentProfileId) }, linkedStudentMatchesAgentExists(agentProfileId, '"application"')],
});

const applicationWhereForAgent = (agentProfileId: number, idOrRef: string) => {
  const t = idOrRef.trim();
  const idOrRefClause = isUuid(t)
    ? { id: t }
    : (() => {
        const ref = normalizeApplicationReference(t);
        if (!ref) {
          throw new AppError('Invalid application id or reference (use UUID or APP-12345)', 400);
        }
        return { applicationNumber: ref };
      })();
  return {
    [Op.and]: [idOrRefClause, applicationScopeForAgent(agentProfileId)],
  };
};

const applicationIncludeForScope = {
  model: db.StudentProfile,
  as: 'studentProfile',
  required: false,
};

async function assertStudentInAgentScope(
  agentProfileId: number,
  studentProfileId: number,
  transaction?: Transaction,
): Promise<void> {
  const sp = await db.StudentProfile.findByPk(studentProfileId, { transaction });
  if (!sp) {
    throw new AppError('Student profile not found', 404);
  }
  if (sp.agentProfileId === agentProfileId) {
    return;
  }
  const n = await db.Application.count({
    where: {
      [Op.and]: [{ studentId: studentProfileId }, applicationScopeForAgent(agentProfileId)],
    },
    transaction,
  });
  if (n > 0) {
    return;
  }
  throw new AppError('Student is not in your portfolio', 403);
}

export type CreateAgentStudentInput = {
  email: string;
  password?: string | null;
  fullName: string;
  phone?: string | null;
  targetCountries?: string[];
  countryOfResidence?: string | null;
  dateOfBirth?: string | null;
  nationality?: string | null;
};

/** Creates a student user + profile linked to this agent (same pattern as signup). */
export const createStudentForAgent = async (
  agentProfileId: number,
  body: CreateAgentStudentInput,
  options?: { transaction?: Transaction },
): Promise<{
  studentProfile: InstanceType<typeof db.StudentProfile>;
  user: Record<string, unknown>;
  temporaryPassword?: string;
}> => {
  const t = options?.transaction;
  const email = String(body.email).trim().toLowerCase();
  if (await db.User.findOne({ where: { email }, transaction: t })) {
    throw new AppError('Email already taken', 400);
  }

  let plainPassword = body.password?.trim();
  let temporaryPassword: string | undefined;
  if (!plainPassword) {
    plainPassword = randomBytes(12).toString('base64url').slice(0, 16);
    temporaryPassword = plainPassword;
  }

  const academicDetails =
    body.dateOfBirth || body.nationality
      ? {
          ...(body.dateOfBirth ? { dateOfBirth: String(body.dateOfBirth).trim() } : {}),
          ...(body.nationality ? { nationality: String(body.nationality).trim() } : {}),
        }
      : null;

  const user = await db.User.create(
    {
      name: String(body.fullName).trim(),
      email,
      password: plainPassword,
      role: 'student',
      phone: body.phone?.trim() || null,
      status: true,
      emailVerified: true,
    },
    { transaction: t },
  );

  const studentProfile = await db.StudentProfile.create(
    {
      userId: user.id,
      academicDetails,
      preferredCountry: null,
      targetCountries: Array.isArray(body.targetCountries) ? body.targetCountries : [],
      countryOfResidence: body.countryOfResidence?.trim() || null,
      agentProfileId,
    },
    { transaction: t },
  );

  return {
    studentProfile,
    user: user.toSafeObject(),
    ...(temporaryPassword ? { temporaryPassword } : {}),
  };
};

export type AgentContext = {
  ownProfile: InstanceType<typeof db.AgentProfile>;
  /** Owner agency used for applications / students / payments scope. */
  effectiveProfile: InstanceType<typeof db.AgentProfile>;
  isStaff: boolean;
  canViewCommission: boolean;
  canViewDeposits: boolean;
  canViewDeadlines: boolean;
};

export const resolveAgentContext = async (userId: string): Promise<AgentContext> => {
  const ownProfile = await db.AgentProfile.findOne({ where: { userId } });
  if (!ownProfile) {
    throw new AppError('Agent profile not found', 404);
  }

  const parentId = ownProfile.parentAgentProfileId;
  if (parentId != null) {
    const parent = await db.AgentProfile.findByPk(parentId);
    if (!parent) {
      throw new AppError('Parent agency not found for this staff account', 404);
    }
    if (parent.parentAgentProfileId != null) {
      throw new AppError('Invalid staff hierarchy', 500);
    }
    return {
      ownProfile,
      effectiveProfile: parent,
      isStaff: true,
      canViewCommission: Boolean(ownProfile.canViewCommission),
      canViewDeposits: Boolean(ownProfile.canViewDeposits),
      canViewDeadlines: ownProfile.canViewDeadlines !== false,
    };
  }

  return {
    ownProfile,
    effectiveProfile: ownProfile,
    isStaff: false,
    canViewCommission: ownProfile.canViewCommission !== false,
    canViewDeposits: ownProfile.canViewDeposits !== false,
    canViewDeadlines: ownProfile.canViewDeadlines !== false,
  };
};

/** Own row for this user (staff or owner). Prefer resolveAgentContext for portal logic. */
export const requireOwnAgentProfile = async (userId: string) => {
  const profile = await db.AgentProfile.findOne({ where: { userId } });
  if (!profile) {
    throw new AppError('Agent profile not found', 404);
  }
  return profile;
};

/**
 * Effective agency profile for data scoping (owner when caller is staff).
 * Prefer resolveAgentContext when you also need permission flags.
 */
export const requireAgentProfile = async (userId: string) => {
  const ctx = await resolveAgentContext(userId);
  return ctx.effectiveProfile;
};

export const assertCanViewCommission = async (userId: string) => {
  const ctx = await resolveAgentContext(userId);
  if (!ctx.canViewCommission) {
    throw new AppError('You do not have access to commission.', 403);
  }
};

export const assertCanViewDeposits = async (userId: string) => {
  const ctx = await resolveAgentContext(userId);
  if (!ctx.canViewDeposits) {
    throw new AppError('You do not have access to deposit payments.', 403);
  }
};

export const assertCanViewDeadlines = async (userId: string) => {
  const ctx = await resolveAgentContext(userId);
  if (!ctx.canViewDeadlines) {
    throw new AppError('You do not have access to deadlines.', 403);
  }
};

export const assertIsAgencyOwner = async (userId: string) => {
  const ctx = await resolveAgentContext(userId);
  if (ctx.isStaff) {
    throw new AppError('Only the main agent can manage staff.', 403);
  }
  return ctx;
};

const AGREEMENT_PENDING_MESSAGE =
  'We have sent the partnership agreement to your email. Please sign and upload the signed copy to continue.';
const AGREEMENT_SUBMITTED_MESSAGE =
  'Your signed agreement has been received and is pending admin approval. The dashboard will unlock once it is approved.';
const AGREEMENT_REJECTED_MESSAGE =
  'Your signed agreement was rejected. Please review the rejection reason and re-upload a corrected copy.';
const AGREEMENT_APPROVED_MESSAGE = 'Your partnership agreement is approved. You have full access to the portal.';

const messageForAgreementStatus = (status: string): string => {
  switch (status) {
    case 'submitted':
      return AGREEMENT_SUBMITTED_MESSAGE;
    case 'rejected':
      return AGREEMENT_REJECTED_MESSAGE;
    case 'approved':
      return AGREEMENT_APPROVED_MESSAGE;
    default:
      return AGREEMENT_PENDING_MESSAGE;
  }
};

const buildAgreementSummary = (profile: InstanceType<typeof db.AgentProfile>) => ({
  status: profile.agreementStatus,
  message: messageForAgreementStatus(profile.agreementStatus),
  canUpload: profile.agreementStatus === 'pending' || profile.agreementStatus === 'rejected',
  portalUnlocked: profile.agreementStatus === 'approved',
  agreementSentAt: profile.agreementSentAt ?? null,
  agreementEmailSentAt: profile.agreementEmailSentAt ?? null,
  signedAgreementUrl: profile.signedAgreementUrl ?? null,
  agreementUploadedAt: profile.agreementUploadedAt ?? null,
  agreementApprovedAt: profile.agreementApprovedAt ?? null,
  agreementRejectionReason: profile.agreementRejectionReason ?? null,
});

/** Public-to-agent: returns the current agreement workflow state for the gating UI. */
export const getAgentAgreementStatus = async (userId: string) => {
  const ctx = await resolveAgentContext(userId);
  const summary = buildAgreementSummary(ctx.effectiveProfile);
  if (ctx.isStaff) {
    return {
      ...summary,
      canUpload: false,
      isStaff: true,
      message: summary.portalUnlocked
        ? 'Your agency partnership agreement is approved. You have access to the portal.'
        : 'Portal access depends on your agency owner completing the partnership agreement.',
    };
  }
  return { ...summary, isStaff: false };
};

/** Download the unsigned B2B partnership agreement template (pending agents). */
export const getAgentAgreementTemplateFile = async () => {
  const filePath = resolveAgentAgreementPdfPath();
  const buffer = readAgentAgreementPdf();
  return {
    filePath,
    buffer,
    fileName: path.basename(filePath),
  };
};

/** Agent uploads the signed agreement PDF. Allowed only when status is `pending` or `rejected`. */
export const uploadAgentSignedAgreement = async (userId: string, file: Express.Multer.File) => {
  if (!file) {
    throw new AppError('File is required (field name: file)', 400);
  }
  const ctx = await resolveAgentContext(userId);
  if (ctx.isStaff) {
    throw new AppError('Only the main agent can upload the partnership agreement.', 403);
  }
  const profile = ctx.ownProfile;
  if (profile.agreementStatus === 'submitted') {
    throw new AppError('Your signed agreement is already under review.', 400);
  }
  if (profile.agreementStatus === 'approved') {
    throw new AppError('Your agreement has already been approved.', 400);
  }
  const fileUrl = file.path.replace(/\\/g, '/');
  profile.signedAgreementUrl = fileUrl;
  profile.agreementUploadedAt = new Date();
  profile.agreementStatus = 'submitted';
  /** Clear any prior rejection reason so re-uploads start clean. */
  profile.agreementRejectionReason = null;
  await profile.save();
  return buildAgreementSummary(profile);
};

/**
 * Express middleware-style guard: throws 403 if the agent's agreement is not yet `approved`.
 * Apply on the agent router AFTER the agreement endpoints so those remain reachable.
 */
export const assertAgentAgreementApproved = async (userId: string): Promise<void> => {
  const ctx = await resolveAgentContext(userId);
  if (ctx.effectiveProfile.agreementStatus !== 'approved') {
    throw new AppError(
      'Portal locked until your partnership agreement is approved.',
      403,
    );
  }
};

const offerLetterWhereClause = (param: string): { id?: number; referenceCode?: string } => {
  const t = param.trim();
  if (/^\d+$/.test(t)) {
    return { id: parseInt(t, 10) };
  }
  const ref = normalizeOfferReference(t);
  if (ref) {
    return { referenceCode: ref };
  }
  throw new AppError('Invalid offer letter id (use numeric id or OFR-123)', 400);
};

export const getApplicationForAgent = async (agentProfileId: number, idOrRef: string) => {
  const app = await db.Application.findOne({
    where: applicationWhereForAgent(agentProfileId, idOrRef),
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
  if (!app) {
    throw new AppError('Application not found', 404);
  }
  return app;
};

export const listAgentApplications = async (
  agentProfileId: number,
  query: {
    search?: string;
    status?: string;
    country?: string;
    page?: string | number;
    limit?: string | number;
    applicationNumber?: string;
    id?: string;
  },
) => {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
  const offset = (page - 1) * limit;

  const andParts: object[] = [applicationScopeForAgent(agentProfileId)];

  if (query.status) {
    if (!(APPLICATION_STATUSES as readonly string[]).includes(query.status)) {
      throw new AppError('Invalid status filter', 400);
    }
    andParts.push({ status: query.status });
  }
  if (query.country && query.country.trim()) {
    andParts.push({ country: { [Op.iLike]: `%${query.country.trim()}%` } });
  }
  if (query.id && isUuid(query.id)) {
    andParts.push({ id: query.id });
  }
  if (query.applicationNumber && query.applicationNumber.trim()) {
    const ref = normalizeApplicationReference(query.applicationNumber.trim());
    if (!ref) {
      throw new AppError('Invalid applicationNumber (expected APP-12345)', 400);
    }
    andParts.push({ applicationNumber: ref });
  }
  if (query.search && query.search.trim()) {
    const q = `%${query.search.trim()}%`;
    andParts.push({
      [Op.or]: [
        { universityName: { [Op.iLike]: q } },
        { programName: { [Op.iLike]: q } },
        { notes: { [Op.iLike]: q } },
        { country: { [Op.iLike]: q } },
        { applicationNumber: { [Op.iLike]: q } },
      ],
    });
  }

  const where = { [Op.and]: andParts };

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

  return { data: rows, page, limit, total: count };
};

export type CreateAgentApplicationBody = {
  studentProfileId?: number;
  student?: CreateAgentStudentInput;
  universityName?: string | null;
  programName?: string | null;
  country?: string | null;
  courseId?: number | null;
  notes?: string | null;
  commissionAmount?: number | string | null;
  commissionSlab?: string | null;
  metadata?: Record<string, unknown> | null;
};

export const createAgentApplication = async (
  agentProfileId: number,
  body: CreateAgentApplicationBody,
): Promise<{
  application: InstanceType<typeof db.Application>;
  temporaryPassword?: string;
}> => {
  return db.sequelize.transaction(async transaction => {
    let studentProfileId = body.studentProfileId;
    let temporaryPassword: string | undefined;

    if (body.student) {
      const created = await createStudentForAgent(agentProfileId, body.student, { transaction });
      studentProfileId = created.studentProfile.id;
      temporaryPassword = created.temporaryPassword;
    }

    if (studentProfileId == null || typeof studentProfileId !== 'number') {
      throw new AppError('Either studentProfileId or student is required', 400);
    }

    const sp = await db.StudentProfile.findByPk(studentProfileId, { transaction });
    if (!sp) {
      throw new AppError('Student profile not found', 404);
    }
    const count = await db.Application.count({
      where: { studentId: studentProfileId },
      transaction,
    });
    if (count >= 3) {
      throw new AppError('This student has already reached the application limit of 3 applications.', 400);
    }

    await assertStudentInAgentScope(agentProfileId, studentProfileId, transaction);

    const agentProfile = await db.AgentProfile.findByPk(agentProfileId, { transaction });
    if (!agentProfile) {
      throw new AppError('Agent profile not found', 404);
    }
    const { ensureAgentMembershipId } = await import('../utils/ensureAgentMembershipId');
    await ensureAgentMembershipId(agentProfile);

    const baseMeta =
      body.metadata && typeof body.metadata === 'object' && !Array.isArray(body.metadata)
        ? { ...body.metadata }
        : {};
    const metadata = {
      ...baseMeta,
      agencyLabel:
        typeof baseMeta.agencyLabel === 'string' && baseMeta.agencyLabel.trim()
          ? baseMeta.agencyLabel
          : agentProfile.agencyName,
      agentMembershipId: agentProfile.membershipId,
    };

    const application = await db.Application.create(
      {
        studentId: studentProfileId,
        agentId: agentProfileId,
        courseId: body.courseId ?? null,
        universityName: body.universityName?.trim() || null,
        programName: body.programName?.trim() || null,
        notes: body.notes?.trim() || null,
        country: body.country?.trim() || null,
        commissionAmount: body.commissionAmount ?? null,
        commissionSlab: body.commissionSlab?.trim() || null,
        metadata,
        status: 'draft',
      },
      { transaction },
    );

    return {
      application,
      ...(temporaryPassword ? { temporaryPassword } : {}),
    };
  });
};

export const updateAgentApplication = async (
  agentProfileId: number,
  idOrRef: string,
  body: Record<string, unknown>,
) => {
  const app = await db.Application.findOne({
    where: applicationWhereForAgent(agentProfileId, idOrRef),
    include: [applicationIncludeForScope],
  });
  if (!app) {
    throw new AppError('Application not found', 404);
  }
  if (app.status !== 'draft') {
    throw new AppError('Only draft applications can be edited', 400);
  }

  if (body.universityName !== undefined) {
    app.universityName =
      body.universityName === null || body.universityName === ''
        ? null
        : String(body.universityName).trim();
  }
  if (body.programName !== undefined) {
    app.programName =
      body.programName === null || body.programName === '' ? null : String(body.programName).trim();
  }
  if (body.notes !== undefined) {
    app.notes = body.notes === null || body.notes === '' ? null : String(body.notes).trim();
  }
  if (body.country !== undefined) {
    app.country = body.country === null || body.country === '' ? null : String(body.country).trim();
  }
  if (body.commissionSlab !== undefined) {
    app.commissionSlab =
      body.commissionSlab === null || body.commissionSlab === ''
        ? null
        : String(body.commissionSlab).trim();
  }
  if (body.commissionAmount !== undefined) {
    app.commissionAmount =
      body.commissionAmount === null || body.commissionAmount === '' ? null : body.commissionAmount;
  }
  if (body.metadata !== undefined) {
    if (body.metadata !== null && typeof body.metadata !== 'object') {
      throw new AppError('metadata must be an object', 400);
    }
    app.metadata = body.metadata as Record<string, unknown> | null;
  }
  if (body.courseId !== undefined) {
    if (body.courseId === null || body.courseId === '') {
      app.courseId = null;
    } else {
      const n = Number(body.courseId);
      if (Number.isNaN(n)) {
        throw new AppError('Invalid courseId', 400);
      }
      app.courseId = n;
    }
  }

  await app.save();
  return getApplicationForAgent(agentProfileId, app.id);
};

export const submitAgentApplication = async (agentProfileId: number, idOrRef: string) => {
  const app = await db.Application.findOne({
    where: applicationWhereForAgent(agentProfileId, idOrRef),
    include: [applicationIncludeForScope],
  });
  if (!app) {
    throw new AppError('Application not found', 404);
  }
  if (app.status !== 'draft') {
    throw new AppError('Application is not a draft', 400);
  }
  const uni = app.universityName?.trim();
  const prog = app.programName?.trim();
  if (!uni || !prog) {
    throw new AppError('University and program are required to submit', 400);
  }

  await db.Document.findAll({ where: { applicationId: app.id } });
  // Student completes DigiLocker verification and submits from the student portal.
  const previousStatus = app.status;
  app.status = 'submitted';
  await app.save();
  const { notifyApplicationStatusChange } = await import('./application-email.service');
  notifyApplicationStatusChange(app.id, previousStatus, 'submitted');
  return getApplicationForAgent(agentProfileId, app.id);
};

export const deleteAgentApplication = async (agentProfileId: number, idOrRef: string) => {
  const app = await db.Application.findOne({
    where: applicationWhereForAgent(agentProfileId, idOrRef),
    include: [applicationIncludeForScope],
  });
  if (!app) {
    throw new AppError('Application not found', 404);
  }
  if (app.status !== 'draft') {
    throw new AppError('Only draft applications can be deleted', 400);
  }
  await app.destroy();
};

export const listAgentDocuments = async (
  agentProfileId: number,
  query: { applicationId?: string },
) => {
  const whereDoc: Record<string, unknown> = {};
  if (query.applicationId?.trim()) {
    const app = await db.Application.findOne({
      where: applicationWhereForAgent(agentProfileId, query.applicationId.trim()),
      include: [applicationIncludeForScope],
    });
    if (!app) {
      throw new AppError('Application not found', 404);
    }
    whereDoc.applicationId = app.id;
  }

  return db.Document.findAll({
    where: whereDoc,
    include: [
      {
        model: db.Application,
        as: 'application',
        required: true,
        where: applicationScopeOnIncludedApplication(agentProfileId),
        attributes: ['id', 'applicationNumber'],
        include: [applicationIncludeForScope],
      },
      {
        model: db.StudentProfile,
        as: 'studentProfile',
        include: [{ model: db.User, as: 'user', attributes: ['name', 'email'] }],
      },
    ],
    order: [['createdAt', 'DESC']],
  });
};

export const createAgentDocument = async (
  agentProfileId: number,
  file: Express.Multer.File,
  opts: {
    applicationRef?: string | null;
    studentProfileId?: number | null;
    documentType?: string;
  },
) => {
  if (!file) {
    throw new AppError('File is required', 400);
  }

  let appRow: InstanceType<typeof db.Application> | null = null;

  if (opts.applicationRef?.trim()) {
    appRow = await db.Application.findOne({
      where: applicationWhereForAgent(agentProfileId, opts.applicationRef.trim()),
      include: [applicationIncludeForScope],
    });
    if (!appRow) {
      throw new AppError('Application not found', 404);
    }
  } else if (opts.studentProfileId != null && opts.studentProfileId > 0) {
    await assertStudentInAgentScope(agentProfileId, opts.studentProfileId);
    appRow = await db.Application.findOne({
      where: {
        [Op.and]: [{ studentId: opts.studentProfileId }, applicationScopeForAgent(agentProfileId)],
      },
      include: [applicationIncludeForScope],
      order: [['updatedAt', 'DESC']],
    });
    if (!appRow) {
      throw new AppError(
        'No application found for this student — create an application first or pass applicationId / applicationNumber',
        400,
      );
    }
  } else {
    throw new AppError(
      'applicationId, applicationNumber (or application_id), or studentProfileId is required',
      400,
    );
  }

  const fileUrl = file.path.replace(/\\/g, '/');
  const rawType = (opts.documentType || 'general').trim();
  const {
    normalizeDocumentType,
    isDigilockerImportableType,
    isVerificationDocumentType,
    DOCUMENT_TYPE_LABELS,
  } = await import('../src/modules/document-verification/document-types');
  const { isDigilockerConfigured, isDigilockerDocumentsImportEnabled } = await import(
    '../src/modules/digilocker/digilocker.config'
  );
  const normalizedType = normalizeDocumentType(rawType);
  const manualAllowed = Boolean(appRow.manualUploadAllowed);
  if (
    !manualAllowed &&
    isDigilockerConfigured() &&
    isDigilockerDocumentsImportEnabled() &&
    isDigilockerImportableType(normalizedType)
  ) {
    throw new AppError(
      `${DOCUMENT_TYPE_LABELS[normalizedType] || normalizedType} must be verified by the student via DigiLocker after they log in. Academic certificates cannot be uploaded manually unless an admin enables manual upload for this application.`,
      400,
    );
  }

  const doc = await db.Document.create({
    studentProfileId: appRow.studentId,
    applicationId: appRow.id,
    fileUrl,
    originalFileName: file.originalname,
    type: normalizedType.slice(0, 64),
    fileSize: file.size,
    status: 'pending',
  });

  // Queue admin review (Open original document) for passport / bank / ITR, same as student uploads.
  if (isVerificationDocumentType(normalizedType)) {
    const student = await db.StudentProfile.findByPk(appRow.studentId, {
      include: [{ model: db.User, as: 'user', attributes: ['id', 'email'] }],
    });
    const studentUser = (student as { user?: { id?: string; email?: string } } | null)?.user;
    const studentUserId = studentUser?.id;
    if (studentUserId) {
      const { processVerificationUpload } = await import(
        '../src/modules/document-verification/document-verification.processor'
      );
      await processVerificationUpload({
        userId: studentUserId,
        userEmail: studentUser?.email ?? null,
        documentId: doc.id,
        fileUrl,
        documentType: normalizedType,
      });
    }
  }

  return doc;
};

export const patchAgentDocument = async (
  agentProfileId: number,
  documentId: string,
  body: { status?: (typeof DOCUMENT_STATUSES)[number] },
) => {
  if (!isUuid(documentId)) {
    throw new AppError('Invalid document id', 400);
  }
  const doc = await db.Document.findOne({
    where: { id: documentId },
    include: [
      {
        model: db.Application,
        as: 'application',
        required: true,
        where: applicationScopeOnIncludedApplication(agentProfileId),
        include: [applicationIncludeForScope],
      },
    ],
  });
  if (!doc) {
    throw new AppError('Document not found', 404);
  }
  if (body.status) {
    if (!(DOCUMENT_STATUSES as readonly string[]).includes(body.status)) {
      throw new AppError('Invalid status', 400);
    }
    doc.status = body.status;
  }
  await doc.save();
  return doc;
};

export const deleteAgentDocument = async (agentProfileId: number, documentId: string) => {
  if (!isUuid(documentId)) {
    throw new AppError('Invalid document id', 400);
  }
  const doc = await db.Document.findOne({
    where: { id: documentId },
    include: [
      {
        model: db.Application,
        as: 'application',
        required: true,
        where: applicationScopeOnIncludedApplication(agentProfileId),
        include: [applicationIncludeForScope],
      },
    ],
  });
  if (!doc) {
    throw new AppError('Document not found', 404);
  }

  try {
    if (doc.fileUrl && !doc.fileUrl.startsWith('http')) {
      const abs = path.isAbsolute(doc.fileUrl) ? doc.fileUrl : path.join(process.cwd(), doc.fileUrl);
      if (fs.existsSync(abs)) {
        fs.unlinkSync(abs);
      }
    }
  } catch {
    /* ignore */
  }

  await doc.destroy();
};

export const runDocumentVerificationDemo = async (
  agentProfileId: number,
  applicationIdOrRef: string,
) => {
  const app = await getApplicationForAgent(agentProfileId, applicationIdOrRef);
  const docs = await db.Document.findAll({ where: { applicationId: app.id } });
  const byType = new Map(docs.map(d => [d.type.toLowerCase(), d]));

  const checklist = CHECKLIST_TYPES.map(({ key, label }) => {
    const d = byType.get(key.toLowerCase());
    return {
      key,
      label,
      status: d ? d.status : 'pending',
      documentId: d?.id ?? null,
    };
  });

  return {
    applicationId: app.id,
    applicationNumber: app.applicationNumber,
    checklist,
  };
};

export const getOfferLetterForAgent = async (agentProfileId: number, param: string) => {
  const clause = offerLetterWhereClause(param);
  const letter = await db.OfferLetter.findOne({
    where: clause,
    include: [
      {
        model: db.Application,
        as: 'application',
        required: true,
        where: applicationScopeOnIncludedApplication(agentProfileId),
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
  });
  if (!letter) {
    throw new AppError('Offer letter not found', 404);
  }
  return letter;
};

export const listOfferLetters = async (agentProfileId: number) => {
  return db.OfferLetter.findAll({
    include: [
      {
        model: db.Application,
        as: 'application',
        required: true,
        where: applicationScopeOnIncludedApplication(agentProfileId),
        include: [
          {
            model: db.StudentProfile,
            as: 'studentProfile',
            include: [{ model: db.User, as: 'user', attributes: ['name', 'email'] }],
          },
        ],
      },
    ],
    order: [['createdAt', 'DESC']],
  });
};

export const createOfferLetter = async (
  agentProfileId: number,
  body: {
    applicationId: string;
    fileUrl?: string | null;
    expiresAt?: string | null;
    notes?: string | null;
    universityName?: string | null;
    programName?: string | null;
  },
) => {
  const app = await getApplicationForAgent(agentProfileId, body.applicationId);
  const existing = await db.OfferLetter.findOne({ where: { applicationId: app.id } });
  if (existing) {
    throw new AppError('An offer letter already exists for this application', 409);
  }
  const student = await db.StudentProfile.findByPk(app.studentId, {
    include: [{ model: db.User, as: 'user', attributes: ['name'] }],
  });
  const user = (student as any)?.user;

  return db.OfferLetter.create({
    applicationId: app.id,
    fileUrl: body.fileUrl?.trim() || null,
    uploadedAt: new Date(),
    status: body.fileUrl?.trim() ? 'active' : 'pending',
    universityName: body.universityName?.trim() || app.universityName,
    programName: body.programName?.trim() || app.programName,
    studentDisplayName: user?.name || null,
    expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
    notes: body.notes?.trim() || null,
  });
};

export const patchOfferLetter = async (
  agentProfileId: number,
  param: string,
  body: Partial<{
    fileUrl: string | null;
    signedFileUrl: string | null;
    status: (typeof OFFER_LETTER_STATUSES)[number];
    expiresAt: string | null;
    notes: string | null;
  }>,
) => {
  const letter = await getOfferLetterForAgent(agentProfileId, param);
  const updates: Record<string, any> = {};
  if (body.fileUrl !== undefined) {
    updates.fileUrl = body.fileUrl === null || body.fileUrl === '' ? null : String(body.fileUrl).trim();
  }
  if (body.signedFileUrl !== undefined) {
    updates.signedFileUrl =
      body.signedFileUrl === null || body.signedFileUrl === ''
        ? null
        : String(body.signedFileUrl).trim();
  }
  if (body.status !== undefined) {
    if (!(OFFER_LETTER_STATUSES as readonly string[]).includes(body.status)) {
      throw new AppError('Invalid offer letter status', 400);
    }
    updates.status = body.status;
  }
  if (body.expiresAt !== undefined) {
    updates.expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;
  }
  if (body.notes !== undefined) {
    updates.notes = body.notes === null || body.notes === '' ? null : String(body.notes).trim();
  }
  await letter.update(updates);
  return letter;
};

export const uploadSignedOfferFile = async (
  agentProfileId: number,
  param: string,
  file: Express.Multer.File,
) => {
  if (!file) {
    throw new AppError('File is required', 400);
  }
  const letter = await getOfferLetterForAgent(agentProfileId, param);
  const url = file.path.replace(/\\/g, '/');
  await letter.update({
    signedFileUrl: url,
    status: 'signed',
  });
  const { notifyAdminSignedOfferUploaded } = await import('./offer-letter-notify.service');
  notifyAdminSignedOfferUploaded(letter, 'agent');
  return letter;
};

export const uploadOfferLetterFile = async (
  agentProfileId: number,
  param: string,
  file: Express.Multer.File,
) => {
  if (!file) {
    throw new AppError('File is required', 400);
  }
  const letter = await getOfferLetterForAgent(agentProfileId, param);
  const url = file.path.replace(/\\/g, '/');
  await letter.update({
    fileUrl: url,
    status: 'active',
  });
  return letter;
};

export const sendOfferLetter = async (agentProfileId: number, param: string) => {
  const letter = await getOfferLetterForAgent(agentProfileId, param);
  await letter.update({ status: 'sent' });
  return letter;
};

const parseSlabDetailsJson = (raw: string | null | undefined): Record<string, unknown> | null => {
  if (!raw || typeof raw !== 'string' || !raw.trim().startsWith('{')) {
    return null;
  }
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
};

export type AgentCommissionCalculatorUniversity = {
  universityId: number | null;
  universityName: string;
  commissionPercent: number | null;
  commissionId: number | null;
  slabLabel: string | null;
  slabDetails: string | null;
  parsedSlab: Record<string, unknown> | null;
  /** True if this university appears on at least one of the agent's applications */
  inPipeline?: boolean;
};

const calculatorEntryFromCommissionRow = (
  row: InstanceType<typeof db.Commission>,
  opts?: { inPipeline?: boolean },
): AgentCommissionCalculatorUniversity => {
  const u = (row as any).university as { id?: number; name?: string } | undefined;
  const name = u?.name || `University ${row.universityId}`;
  const parsed = parseSlabDetailsJson(row.slabDetails ?? undefined);
  const pct = Number(row.percentage);
  const slabLabel =
    typeof parsed?.label === 'string' ? parsed.label : `${name} — ${pct}% partner rate`;
  return {
    universityId: row.universityId,
    universityName: name,
    commissionPercent: pct != null && !Number.isNaN(pct) ? pct : null,
    commissionId: row.id,
    slabLabel,
    slabDetails: row.slabDetails ?? null,
    parsedSlab: parsed,
    ...(opts?.inPipeline ? { inPipeline: true } : { inPipeline: false }),
  };
};

/** Latest admin Commission row per university (for calculator — all slabs admin configured). */
const fetchLatestCommissionEntryByUniversity = async (): Promise<Map<number, AgentCommissionCalculatorUniversity>> => {
  const rows = await db.Commission.findAll({
    include: [{ model: db.University, as: 'university', attributes: ['id', 'name', 'country'] }],
    order: [['id', 'DESC']],
  });
  const m = new Map<number, AgentCommissionCalculatorUniversity>();
  for (const row of rows) {
    if (m.has(row.universityId)) {
      continue;
    }
    m.set(row.universityId, calculatorEntryFromCommissionRow(row, { inPipeline: false }));
  }
  return m;
};

/** Universities referenced on the agent's applications (may lack admin slab). */
const buildCommissionCalculatorPayload = async (
  apps: InstanceType<typeof db.Application>[],
): Promise<AgentCommissionCalculatorUniversity[]> => {
  const byId = new Map<number, string>();
  const unresolvedNames = new Set<string>();

  for (const a of apps) {
    const cuni = (a as any).course?.university as { id?: number; name?: string } | undefined;
    if (cuni?.id != null) {
      byId.set(Number(cuni.id), String(cuni.name || `University ${cuni.id}`));
    } else if (a.universityName?.trim()) {
      unresolvedNames.add(a.universityName.trim());
    }
  }

  const freeTextMatched = new Set<string>();
  if (unresolvedNames.size > 0) {
    const nameList = [...unresolvedNames];
    const candidates = await db.University.findAll({
      where: { [Op.or]: nameList.map(n => ({ name: { [Op.iLike]: n } })) },
      attributes: ['id', 'name'],
    });
    for (const n of nameList) {
      const match =
        candidates.find(c => c.name.toLowerCase() === n.toLowerCase()) ||
        candidates.find(
          c => c.name.toLowerCase().includes(n.toLowerCase()) || n.toLowerCase().includes(c.name.toLowerCase()),
        );
      if (match) {
        byId.set(match.id, match.name);
        freeTextMatched.add(n);
      }
    }
  }

  const ids = [...byId.keys()];
  const commissionRows =
    ids.length > 0
      ? await db.Commission.findAll({
          where: { universityId: { [Op.in]: ids } },
          include: [{ model: db.University, as: 'university', attributes: ['id', 'name', 'country'] }],
          order: [['id', 'DESC']],
        })
      : [];

  const latestCommissionByUni = new Map<number, InstanceType<typeof db.Commission>>();
  for (const row of commissionRows) {
    if (!latestCommissionByUni.has(row.universityId)) {
      latestCommissionByUni.set(row.universityId, row);
    }
  }

  const withSlab = ids
    .map(uid => {
      const comm = latestCommissionByUni.get(uid);
      const parsed = comm ? parseSlabDetailsJson(comm.slabDetails ?? undefined) : null;
      const pct = comm != null ? Number(comm.percentage) : null;
      const slabLabel =
        comm != null
          ? (typeof parsed?.label === 'string' ? parsed.label : `${byId.get(uid)} — ${pct}% partner rate`)
          : null;
      return {
        universityId: uid,
        universityName: byId.get(uid) || `University ${uid}`,
        commissionPercent: pct != null && !Number.isNaN(pct) ? pct : null,
        commissionId: comm?.id ?? null,
        slabLabel,
        slabDetails: comm?.slabDetails ?? null,
        parsedSlab: parsed,
        inPipeline: true,
      };
    })
    .sort((a, b) => a.universityName.localeCompare(b.universityName, undefined, { sensitivity: 'base' }));

  const orphanRows = [...unresolvedNames]
    .filter(n => !freeTextMatched.has(n))
    .map(n => ({
      universityId: null as number | null,
      universityName: n,
      commissionPercent: null as number | null,
      commissionId: null as number | null,
      slabLabel: null as string | null,
      slabDetails: null as string | null,
      parsedSlab: null as Record<string, unknown> | null,
      inPipeline: true,
    }));

  const orphanDedup = new Map<string, (typeof orphanRows)[0]>();
  for (const o of orphanRows) {
    orphanDedup.set(o.universityName.toLowerCase(), o);
  }

  return [...withSlab, ...[...orphanDedup.values()].sort((a, b) => a.universityName.localeCompare(b.universityName))];
};

/** Union: every admin commission slab + pipeline-only universities (no duplicate per university / orphan name). */
const mergeCalculatorPipelineWithAllAdminSlabs = async (
  pipelineEntries: AgentCommissionCalculatorUniversity[],
): Promise<AgentCommissionCalculatorUniversity[]> => {
  const fromAdmin = await fetchLatestCommissionEntryByUniversity();
  const byKey = new Map<string, AgentCommissionCalculatorUniversity>();

  for (const [, entry] of fromAdmin) {
    byKey.set(`id:${entry.universityId}`, { ...entry, inPipeline: entry.inPipeline ?? false });
  }

  for (const p of pipelineEntries) {
    const key =
      p.universityId != null ? `id:${p.universityId}` : `orphan:${p.universityName.toLowerCase()}`;
    const existing = byKey.get(key);
    if (existing) {
      existing.inPipeline = true;
    } else {
      byKey.set(key, { ...p, inPipeline: true });
    }
  }

  return [...byKey.values()].sort((a, b) =>
    a.universityName.localeCompare(b.universityName, undefined, { sensitivity: 'base' }),
  );
};

export const getAgentCommission = async (agentProfileId: number) => {
  const apps = await db.Application.findAll({
    where: applicationScopeForAgent(agentProfileId),
    attributes: ['id', 'applicationNumber', 'status', 'commissionAmount', 'commissionSlab', 'universityName'],
    include: [
      {
        model: db.StudentProfile,
        as: 'studentProfile',
        required: false,
        include: [{ model: db.User, as: 'user', attributes: ['name'] }],
      },
      {
        model: db.Course,
        as: 'course',
        required: false,
        include: [{ model: db.University, as: 'university', attributes: ['id', 'name', 'country'] }],
      },
    ],
    order: [['updatedAt', 'DESC']],
  });

  let earned = 0;
  let projected = 0;
  const earnedStatuses = ['enrolled', 'deposit_paid', 'visa_approved', 'agent_invoice_received', 'commission_paid'];

  for (const a of apps) {
    const amt = parseFloat(String((a as any).commissionAmount ?? 0));
    if (Number.isNaN(amt)) {
      continue;
    }
    if (earnedStatuses.includes(a.status)) {
      earned += amt;
    } else {
      projected += amt;
    }
  }

  const sampleRate = apps.length ? projected / apps.length : 0;

  const pipelineOnly = await buildCommissionCalculatorPayload(apps);
  const calculatorUniversities = await mergeCalculatorPipelineWithAllAdminSlabs(pipelineOnly);

  return {
    summary: {
      earnedThisCycle: earned,
      projectedTotal: projected,
      defaultEnrolledRateSample: sampleRate,
    },
    /** All admin commission slabs + any pipeline universities without a slab (inPipeline flag). */
    calculator: {
      universities: calculatorUniversities,
      hint:
        'Lists every admin-configured slab (commissionPercent). Rows with inPipeline also appear on your applications. estimatedCommission = tuition * (commissionPercent / 100) when percent is set.',
    },
    rows: apps.map(a => ({
      applicationId: a.id,
      applicationNumber: a.applicationNumber,
      studentName: (a as any).studentProfile?.user?.name ?? null,
      university: (a as any).course?.university?.name ?? a.universityName ?? null,
      universityId: (a as any).course?.university?.id ?? null,
      status: a.status,
      slabSource: a.commissionSlab ?? 'Default rate card',
      amount: a.commissionAmount ?? null,
    })),
  };
};

export const createDepositPayLink = async (
  agentProfileId: number,
  body: { applicationId: string; amount: number | string; currency?: string; studentEmail?: string | null },
) => {
  const app = await getApplicationForAgent(agentProfileId, body.applicationId);
  const sp = await db.StudentProfile.findByPk(app.studentId, {
    include: [{ model: db.User, as: 'user' }],
  });
  if (!sp) {
    throw new AppError('Student profile missing', 404);
  }
  const user = (sp as any).user as { id: string; name?: string | null; email?: string | null };
  const amount = typeof body.amount === 'number' ? body.amount : Number(body.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new AppError('Amount must be a positive number', 400);
  }

  const { createFlywirePayLink, resolveFlywirePaymentDestination } = await import(
    '../src/modules/flywire/flywire.service'
  );
  const { flywireConfig } = await import('../src/modules/flywire/flywire.config');
  const { currencyCodeForCountry } = await import('../utils/universityCatalogImport');

  const paymentDestination = await resolveFlywirePaymentDestination(app as any);
  const nameParts = String(user.name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  const courseUni = (app as any).course?.university as
    | { country?: string | null; name?: string | null }
    | undefined;
  const uniName = String(app.universityName || courseUni?.name || '').trim();
  const explicitCountry =
    String(app.country || '').trim() || String(courseUni?.country || '').trim();
  const destinationCountry =
    explicitCountry ||
    (() => {
      const n = uniName.toLowerCase();
      if (/new zealand|auckland|otago|waikato|massey|wellington|canterbury|lincoln university|\baut\b/.test(n)) {
        return 'New Zealand';
      }
      if (/united kingdom|london|manchester|edinburgh|oxford|cambridge/.test(n)) return 'United Kingdom';
      if (/australia|sydney|melbourne|brisbane|perth|monash|unsw/.test(n)) return 'Australia';
      if (/canada|toronto|vancouver|montreal|mcgill/.test(n)) return 'Canada';
      if (/ireland|dublin|cork|galway/.test(n)) return 'Ireland';
      if (/germany|berlin|munich|hamburg|bremen/.test(n)) return 'Germany';
      if (/france|paris|lyon/.test(n)) return 'France';
      if (/italy|milan|rome|florence|bocconi/.test(n)) return 'Italy';
      if (/spain|madrid|barcelona/.test(n)) return 'Spain';
      if (/netherlands|amsterdam|holland/.test(n)) return 'Netherlands';
      if (/singapore/.test(n)) return 'Singapore';
      if (/korea|seoul|yonsei|kaist/.test(n)) return 'South Korea';
      if (/luxembourg/.test(n)) return 'Luxembourg';
      if (/\busa\b|united states|california|harvard|stanford/.test(n)) return 'USA';
      return '';
    })();

  return createFlywirePayLink({
    userId: user.id,
    applicationId: app.id,
    agentProfileId,
    amount,
    currency:
      (body.currency || '').trim().toUpperCase() || currencyCodeForCountry(destinationCountry),
    type: 'deposit',
    studentEmail: body.studentEmail?.trim() || user.email || null,
    payerFirstName: nameParts[0] || 'Student',
    payerLastName: nameParts.slice(1).join(' ') || nameParts[0] || 'Payer',
    payerCountry: explicitCountry || destinationCountry || null,
    paymentDestination,
    returnUrl: `${flywireConfig().frontendUrl}/agent/deposit-payments`,
  });
};

export const listDeadlines = async (query: { search?: string }) => {
  const q = query.search?.trim().toLowerCase();
  const rows = await db.Deadline.findAll({
    include: [
      { model: db.University, as: 'university', attributes: ['id', 'name', 'country'] },
      { model: db.Course, as: 'course', attributes: ['id', 'courseName', 'degree'] },
    ],
    order: [['deadlineDate', 'ASC']],
    limit: 500,
  });

  if (!q) {
    return rows;
  }

  return rows.filter(r => {
    const uni = (r as any).university?.name?.toLowerCase() || '';
    const intake = String((r as any).intakeLabel || '').toLowerCase();
    const cn = (r as any).course?.courseName?.toLowerCase() || '';
    return uni.includes(q) || intake.includes(q) || cn.includes(q);
  });
};

export const discoveryUniversities = async (q?: string) => {
  const where =
    q && q.trim()
      ? {
          name: { [Op.iLike]: `%${q.trim()}%` },
        }
      : {};
  return db.University.findAll({ where, limit: 100, order: [['name', 'ASC']] });
};

export const discoveryCourses = async (q?: string) => {
  const where =
    q && q.trim()
      ? {
          courseName: { [Op.iLike]: `%${q.trim()}%` },
        }
      : {};
  return db.Course.findAll({
    where,
    limit: 100,
    include: [{ model: db.University, as: 'university', attributes: ['id', 'name', 'country'] }],
    order: [['courseName', 'ASC']],
  });
};

export const agentGlobalSearch = async (agentProfileId: number, q: string) => {
  if (!q.trim()) {
    return { applications: [], documents: [], courses: [] };
  }
  const qq = `%${q.trim()}%`;

  const applications = await db.Application.findAll({
    where: {
      [Op.and]: [
        applicationScopeForAgent(agentProfileId),
        {
          [Op.or]: [
            { universityName: { [Op.iLike]: qq } },
            { programName: { [Op.iLike]: qq } },
            { applicationNumber: { [Op.iLike]: qq } },
          ],
        },
      ],
    },
    limit: 15,
    attributes: ['id', 'applicationNumber', 'universityName', 'programName', 'status'],
  });

  const documents = await db.Document.findAll({
    where: { originalFileName: { [Op.iLike]: qq } },
    include: [
      {
        model: db.Application,
        as: 'application',
        required: true,
        where: applicationScopeOnIncludedApplication(agentProfileId),
        attributes: ['id', 'applicationNumber'],
        include: [applicationIncludeForScope],
      },
    ],
    limit: 15,
    attributes: ['id', 'originalFileName', 'applicationId'],
  });

  const courses = await db.Course.findAll({
    where: { courseName: { [Op.iLike]: qq } },
    limit: 10,
    include: [{ model: db.University, as: 'university', attributes: ['name'] }],
  });

  return { applications, documents, courses };
};

export const getAgentDashboard = async (agentProfileId: number) => {
  const statusRows = await db.Application.findAll({
    attributes: ['status', [fn('COUNT', '*'), 'count']],
    where: applicationScopeForAgent(agentProfileId),
    group: ['Application.status'],
    subQuery: false,
    raw: true,
  });

  const recentApplications = await db.Application.findAll({
    where: applicationScopeForAgent(agentProfileId),
    order: [['updatedAt', 'DESC']],
    limit: 8,
    attributes: ['id', 'applicationNumber', 'status', 'updatedAt', 'universityName', 'programName'],
    include: [
      {
        model: db.StudentProfile,
        as: 'studentProfile',
        required: false,
        include: [{ model: db.User, as: 'user', attributes: ['name'] }],
      },
    ],
  });

  return { statusCounts: statusRows, recentApplications };
};

export const getAgentPortalProfile = async (userId: string) => {
  const user = await db.User.findByPk(userId);
  if (!user) {
    throw new AppError('User not found', 404);
  }
  const ctx = await resolveAgentContext(userId);
  const { ensureAgentMembershipId } = await import('../utils/ensureAgentMembershipId');
  if (!ctx.isStaff) {
    await ensureAgentMembershipId(ctx.effectiveProfile);
  }
  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
    },
    agency: {
      id: ctx.effectiveProfile.id,
      agencyName: ctx.effectiveProfile.agencyName,
      primaryMarket: ctx.effectiveProfile.primaryMarket,
      logoUrl: ctx.effectiveProfile.logoUrl,
      membershipId: ctx.effectiveProfile.membershipId,
    },
    isStaff: ctx.isStaff,
    canViewCommission: ctx.canViewCommission,
    canViewDeposits: ctx.canViewDeposits,
    canViewDeadlines: ctx.canViewDeadlines,
    canManageStaff: !ctx.isStaff,
  };
};

export const patchAgentPortalProfile = async (userId: string, body: Record<string, unknown>) => {
  const user = await db.User.findByPk(userId);
  const ctx = await resolveAgentContext(userId);
  if (!user) {
    throw new AppError('User not found', 404);
  }

  const fullName = (body.fullName as string) || (body.name as string);
  if (fullName !== undefined && fullName !== null && String(fullName).trim() !== '') {
    user.name = String(fullName).trim();
  }

  if (ctx.isStaff) {
    await user.save();
    return getAgentPortalProfile(userId);
  }

  const profile = ctx.ownProfile;
  if (typeof body.agencyName === 'string' && body.agencyName.trim()) {
    profile.agencyName = body.agencyName.trim();
  }
  if (body.primaryMarket !== undefined) {
    profile.primaryMarket =
      body.primaryMarket === null || body.primaryMarket === ''
        ? null
        : String(body.primaryMarket).trim();
  }
  if (body.logoUrl !== undefined) {
    profile.logoUrl =
      body.logoUrl === null || body.logoUrl === '' ? null : String(body.logoUrl).trim();
  }

  await user.save();
  await profile.save();
  return getAgentPortalProfile(userId);
};

export const listAgencyStaff = async (ownerUserId: string) => {
  const ctx = await assertIsAgencyOwner(ownerUserId);
  const rows = await db.AgentProfile.findAll({
    where: { parentAgentProfileId: ctx.effectiveProfile.id },
    include: [{ model: db.User, as: 'user', attributes: ['id', 'name', 'email', 'phone', 'status'] }],
    order: [['createdAt', 'DESC']],
  });
  return rows.map(r => {
    const u = (r as any).user;
    return {
      userId: r.userId,
      name: u?.name ?? '',
      email: u?.email ?? '',
      phone: u?.phone ?? null,
      status: u?.status ?? true,
      canViewCommission: Boolean(r.canViewCommission),
      canViewDeposits: Boolean(r.canViewDeposits),
      canViewDeadlines: r.canViewDeadlines !== false,
      createdAt: r.createdAt,
    };
  });
};

type StaffAccessFlags = {
  canViewCommission?: boolean;
  canViewDeposits?: boolean;
  canViewDeadlines?: boolean;
};

export const createAgencyStaff = async (
  ownerUserId: string,
  body: {
    fullName: string;
    email: string;
    password: string;
    phone?: string | null;
  } & StaffAccessFlags,
) => {
  const ctx = await assertIsAgencyOwner(ownerUserId);
  const email = String(body.email).trim().toLowerCase();
  if (await db.User.findOne({ where: { email } })) {
    throw new AppError('Email already taken', 400);
  }
  const password = String(body.password);
  if (password.length < 8) {
    throw new AppError('Password must be at least 8 characters', 400);
  }

  const canViewCommission = body.canViewCommission === true;
  const canViewDeposits = body.canViewDeposits === true;
  const canViewDeadlines = body.canViewDeadlines !== false;

  const user = await db.User.create({
    name: String(body.fullName).trim(),
    email,
    password,
    role: 'agent',
    phone: body.phone?.trim() || null,
    status: true,
    emailVerified: true,
  });

  await db.AgentProfile.create({
    userId: user.id,
    agencyName: ctx.effectiveProfile.agencyName,
    primaryMarket: ctx.effectiveProfile.primaryMarket,
    parentAgentProfileId: ctx.effectiveProfile.id,
    membershipId: null,
    canViewCommission,
    canViewDeposits,
    canViewDeadlines,
    agreementStatus: 'approved',
    subscriptionPlanId: ctx.effectiveProfile.subscriptionPlanId,
  });

  return {
    userId: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    canViewCommission,
    canViewDeposits,
    canViewDeadlines,
  };
};

export const patchAgencyStaffAccess = async (
  ownerUserId: string,
  staffUserId: string,
  body: StaffAccessFlags,
) => {
  const ctx = await assertIsAgencyOwner(ownerUserId);
  const staffProfile = await db.AgentProfile.findOne({
    where: { userId: staffUserId, parentAgentProfileId: ctx.effectiveProfile.id },
    include: [{ model: db.User, as: 'user', attributes: ['id', 'name', 'email', 'phone', 'status'] }],
  });
  if (!staffProfile) {
    throw new AppError('Staff member not found', 404);
  }

  if (typeof body.canViewCommission === 'boolean') {
    staffProfile.canViewCommission = body.canViewCommission;
  }
  if (typeof body.canViewDeposits === 'boolean') {
    staffProfile.canViewDeposits = body.canViewDeposits;
  }
  if (typeof body.canViewDeadlines === 'boolean') {
    staffProfile.canViewDeadlines = body.canViewDeadlines;
  }
  await staffProfile.save();

  const u = (staffProfile as any).user;
  return {
    userId: staffProfile.userId,
    name: u?.name ?? '',
    email: u?.email ?? '',
    phone: u?.phone ?? null,
    status: u?.status ?? true,
    canViewCommission: Boolean(staffProfile.canViewCommission),
    canViewDeposits: Boolean(staffProfile.canViewDeposits),
    canViewDeadlines: staffProfile.canViewDeadlines !== false,
    createdAt: staffProfile.createdAt,
  };
};

export const deleteAgencyStaff = async (ownerUserId: string, staffUserId: string) => {
  const ctx = await assertIsAgencyOwner(ownerUserId);
  const staffProfile = await db.AgentProfile.findOne({
    where: { userId: staffUserId, parentAgentProfileId: ctx.effectiveProfile.id },
  });
  if (!staffProfile) {
    throw new AppError('Staff member not found', 404);
  }
  await db.User.destroy({ where: { id: staffUserId } });
};

/** Admin helper: create staff under an owner agency profile id. */
export const createStaffUnderOwnerProfile = async (
  ownerAgentProfileId: number,
  body: { fullName: string; email: string; password: string; phone?: string | null },
) => {
  const owner = await db.AgentProfile.findByPk(ownerAgentProfileId);
  if (!owner) {
    throw new AppError('Parent agency not found', 404);
  }
  if (owner.parentAgentProfileId != null) {
    throw new AppError('Cannot attach staff to another staff account — pick the main agent.', 400);
  }
  return createAgencyStaff(owner.userId, body);
};

export const listOwnerAgenciesForAdmin = async () => {
  const rows = await db.AgentProfile.findAll({
    where: { parentAgentProfileId: null },
    include: [{ model: db.User, as: 'user', attributes: ['id', 'name', 'email'] }],
    order: [['agencyName', 'ASC']],
    limit: 500,
  });
  return rows.map(r => {
    const u = (r as any).user;
    return {
      id: r.id,
      agencyName: r.agencyName,
      membershipId: r.membershipId,
      userId: r.userId,
      ownerName: u?.name ?? '',
      ownerEmail: u?.email ?? '',
    };
  });
};

export const listAgentStudents = async (agentProfileId: number, query: { search?: string }) => {
  const sub = await db.sequelize.query<{ student_id: number }>(
    `
    SELECT DISTINCT sp.id AS student_id
    FROM student_profiles sp
    LEFT JOIN applications a ON a.student_id = sp.id
    WHERE sp.agent_profile_id = :aid OR a.agent_id = :aid
    `,
    { replacements: { aid: agentProfileId }, type: QueryTypes.SELECT },
  );
  const ids = sub.map(r => r.student_id);

  if (!ids.length) {
    return [];
  }

  const profiles = await db.StudentProfile.findAll({
    where: { id: { [Op.in]: ids } },
    include: [{ model: db.User, as: 'user', attributes: ['id', 'name', 'email', 'phone'] }],
    order: [['id', 'DESC']],
    limit: 200,
  });

  const q = query.search?.trim().toLowerCase();
  if (!q) {
    return profiles;
  }

  return profiles.filter(p => {
    const u = (p as any).user;
    return (
      u &&
      ((u.name && String(u.name).toLowerCase().includes(q)) ||
        (u.email && String(u.email).toLowerCase().includes(q)))
    );
  });
};

function csvEscape(s: string | null | undefined): string {
  if (s == null) {
    return '';
  }
  const t = String(s);
  if (/[",\n]/.test(t)) {
    return `"${t.replace(/"/g, '""')}"`;
  }
  return t;
}

export const buildApplicationsCsv = async (
  agentProfileId: number,
  query: Parameters<typeof listAgentApplications>[1],
) => {
  const { data } = await listAgentApplications(agentProfileId, {
    ...query,
    page: 1,
    limit: 10000,
  });

  const headers = [
    'applicationNumber',
    'studentName',
    'studentEmail',
    'programName',
    'universityName',
    'country',
    'status',
    'updatedAt',
  ];
  const lines = [headers.join(',')];

  for (const a of data) {
    const u = (a as any).studentProfile?.user;
    lines.push(
      [
        csvEscape(a.applicationNumber),
        csvEscape(u?.name),
        csvEscape(u?.email),
        csvEscape(a.programName),
        csvEscape(a.universityName),
        csvEscape(a.country),
        csvEscape(a.status),
        a.updatedAt ? new Date(a.updatedAt).toISOString() : '',
      ].join(','),
    );
  }

  return lines.join('\n');
};
