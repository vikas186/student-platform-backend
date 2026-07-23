import fs from 'fs';
import path from 'path';
import { Op } from 'sequelize';
import { db } from '../config/database';
import AppError from '../utils/errorHandler';
import { APPLICATION_STATUSES } from '../models/Application.model';
import { normalizeApplicationReference } from '../utils/applicationRef';
import { normalizeOfferReference } from '../utils/offerRef';
import { isUuid } from '../utils/isUuid';

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

/**
 * If `universityName` matches an active admin-uploaded university (case-insensitive, trimmed),
 * return that university's country as the canonical value. Otherwise return null and let
 * caller fall back to the body value. Prevents the frontend from "defaulting" the country
 * to e.g. the student's targetCountries[0] when they've actually picked a university.
 */
const resolveCountryFromUniversityName = async (
  universityName: string | null | undefined,
): Promise<string | null> => {
  const name = typeof universityName === 'string' ? universityName.trim() : '';
  if (!name) return null;
  const uni = await db.University.findOne({
    where: { name: { [Op.iLike]: name }, status: true },
    attributes: ['id', 'country'],
  });
  return uni?.country?.trim() || null;
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
        { where: { studentId: profile.getDataValue('id') as number, agentId: null } },
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
    include: [{ model: db.Course, as: 'course', attributes: ['id', 'courseName', 'degree', 'fee'], required: false }],
  });
};

export const createStudentApplication = async (
  studentProfileId: number,
  body: {
    universityName?: string | null;
    programName?: string | null;
    notes?: string | null;
    country?: string | null;
    courseId?: number | null;
  },
) => {
  const count = await db.Application.count({ where: { studentId: studentProfileId } });
  if (count >= 3) {
    throw new AppError('Application limit reached. You cannot create more than 3 applications.', 400);
  }

  const sp = await db.StudentProfile.findByPk(studentProfileId);
  const linkedAgentId = sp?.agentProfileId ?? null;
  const uniName = body.universityName?.trim() || null;
  const progName = body.programName?.trim() || null;
  const requestedCourseId =
    body.courseId != null && String(body.courseId).trim() !== ''
      ? Number(body.courseId)
      : null;
  const courseId =
    requestedCourseId != null && Number.isFinite(requestedCourseId) && requestedCourseId > 0
      ? requestedCourseId
      : null;

  const { applyCatalogLinkToApplication } = await import('../utils/linkApplicationCatalog');
  const draft = {
    courseId,
    universityName: uniName,
    programName: progName,
    country: body.country?.trim() || null,
  };
  await applyCatalogLinkToApplication(draft);

  if (!draft.country && uniName) {
    draft.country = await resolveCountryFromUniversityName(uniName);
  }

  return db.Application.create({
    studentId: studentProfileId,
    agentId: linkedAgentId,
    courseId: draft.courseId,
    universityName: draft.universityName,
    programName: draft.programName,
    notes: body.notes?.trim() || null,
    country: draft.country,
    status: 'draft',
  });
};

export const getStudentApplication = async (studentProfileId: number, idOrRef: string) => {
  const app = await db.Application.findOne({
    where: applicationLookupWhere(studentProfileId, idOrRef),
    include: [
      {
        model: db.Course,
        as: 'course',
        attributes: ['id', 'courseName', 'degree', 'fee'],
        required: false,
        include: [{ model: db.University, as: 'university', required: false }],
      },
    ],
  });
  if (!app) throw new AppError('Application not found', 404);
  return app;
};

export const updateStudentApplication = async (
  studentProfileId: number,
  idOrRef: string,
  body: {
    universityName?: string | null;
    programName?: string | null;
    notes?: string | null;
    country?: string | null;
    courseId?: number | null;
  },
) => {
  const app = await getStudentApplication(studentProfileId, idOrRef);
  if (app.getDataValue('status') !== 'draft') {
    throw new AppError('Only draft applications can be edited', 400);
  }
  if (body.universityName !== undefined) app.universityName = body.universityName?.trim() || null;
  if (body.programName !== undefined) app.programName = body.programName?.trim() || null;
  if (body.notes !== undefined) app.notes = body.notes?.trim() || null;
  if (body.country !== undefined) app.country = body.country?.trim() || null;
  if (body.courseId !== undefined) {
    if (body.courseId === null || body.courseId === ('' as unknown as number)) {
      app.courseId = null;
    } else {
      const n = Number(body.courseId);
      if (Number.isNaN(n) || n < 1) throw new AppError('Invalid courseId', 400);
      app.courseId = n;
    }
  }

  const { applyCatalogLinkToApplication } = await import('../utils/linkApplicationCatalog');
  await applyCatalogLinkToApplication(app);

  // If university is set/changed and matches an admin university, the country must follow it
  // (avoids the frontend leaking targetCountries[0] / stale defaults like "Canada" into a
  // submission for a non-Canadian university).
  if (app.universityName && !app.country) {
    const uniCountry = await resolveCountryFromUniversityName(app.universityName);
    if (uniCountry) {
      app.country = uniCountry;
    }
  }

  await app.save();
  return app;
};

export const submitStudentApplication = async (studentProfileId: number, idOrRef: string) => {
  const app = await getStudentApplication(studentProfileId, idOrRef);
  if (app.getDataValue('status') !== 'draft') {
    throw new AppError('Application is not a draft', 400);
  }
  const uni = app.getDataValue('universityName')?.trim?.() ?? String(app.universityName ?? '').trim();
  const prog = app.getDataValue('programName')?.trim?.() ?? String(app.programName ?? '').trim();
  if (!uni || !prog) {
    throw new AppError('University and program are required to submit', 400);
  }
  const sp = await db.StudentProfile.findByPk(studentProfileId);
  if (!sp) {
    throw new AppError('Student profile not found', 404);
  }
  if (sp.agentProfileId && app.agentId == null) {
    app.agentId = sp.agentProfileId;
  }

  const docs = await db.Document.findAll({ where: { applicationId: app.id } });
  if (docs.length === 0) {
    throw new AppError(
      app.manualUploadAllowed
        ? 'Please upload at least one document before submitting.'
        : 'Please import DigiLocker documents or upload at least one file before submitting.',
      400,
    );
  }

  // Any document linked to the application is enough to submit. Live DigiLocker
  // re-checks at submit time were blocking drafts that already had imported or
  // manually uploaded files (session expiry / DigiLocker API errors).

  // Final guard at submit time: pin country + courseId to the catalog university/program
  // so the partner portal can see and decide on this application.
  const { applyCatalogLinkToApplication } = await import('../utils/linkApplicationCatalog');
  await applyCatalogLinkToApplication(app);
  if (!app.country) {
    const uniCountry = await resolveCountryFromUniversityName(app.universityName);
    if (uniCountry) {
      app.country = uniCountry;
    }
  }

  const previousStatus = app.status;
  app.status = 'submitted';
  await app.save();
  const { notifyApplicationStatusChange } = await import('./application-email.service');
  notifyApplicationStatusChange(app.id, previousStatus, 'submitted');
  return app;
};

export const deleteStudentApplication = async (studentProfileId: number, idOrRef: string) => {
  const app = await getStudentApplication(studentProfileId, idOrRef);
  if (app.getDataValue('status') !== 'draft') {
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
  opts: {
    applicationRef?: string | null;
    documentType?: string;
    standalone?: boolean;
    userId?: string;
    userEmail?: string | null;
  },
) => {
  if (!file) throw new AppError('File is required', 400);

  let applicationId: string | null = null;
  let manualUploadAllowed = false;
  if (opts.applicationRef && String(opts.applicationRef).trim()) {
    const raw = String(opts.applicationRef).trim();
    const app = await db.Application.findOne({
      where: applicationLookupWhere(studentProfileId, raw),
    });
    if (!app) throw new AppError('Application not found', 404);
    applicationId = app.id;
    manualUploadAllowed = Boolean(app.manualUploadAllowed);
  } else if (!opts.standalone) {
    const latest = await db.Application.findOne({
      where: { studentId: studentProfileId },
      order: [['updatedAt', 'DESC']],
    });
    if (latest) {
      applicationId = latest.id;
      manualUploadAllowed = Boolean(latest.manualUploadAllowed);
    }
  }

  const {
    validateVerificationDocumentType,
    processVerificationUpload,
  } = await import('../src/modules/document-verification/document-verification.processor');
  const {
    isVerificationDocumentType,
    normalizeDocumentType,
    DOCUMENT_TYPE_LABELS,
  } = await import('../src/modules/document-verification/document-types');

  const rawType = opts.documentType?.trim();
  if (rawType && rawType !== 'general') {
    validateVerificationDocumentType(rawType);
  }
  const normalizedType = normalizeDocumentType(rawType);

  const { isDigilockerImportableType } = await import(
    '../src/modules/document-verification/document-types'
  );
  const {
    isDigilockerConfigured,
    isDigilockerDocumentsImportEnabled,
    hasDigilockerDocumentScope,
  } = await import('../src/modules/digilocker/digilocker.config');
  if (
    !manualUploadAllowed &&
    isDigilockerConfigured() &&
    isDigilockerDocumentsImportEnabled() &&
    isDigilockerImportableType(normalizedType)
  ) {
    // Only block manual academics when DigiLocker can actually import certificates.
    // AVS/KYC-only partner apps (scopes like avs_parent) must fall back to file upload.
    let digilockerCanImportCertificates = true;
    if (opts.userId) {
      const connection = await db.DigiLockerConnection.findByPk(opts.userId);
      const scopes = (connection?.getDataValue('scopes') as string | null) ?? null;
      if (scopes && !hasDigilockerDocumentScope(scopes)) {
        digilockerCanImportCertificates = false;
      }
    }
    if (digilockerCanImportCertificates) {
      throw new AppError(
        `${DOCUMENT_TYPE_LABELS[normalizedType] || normalizedType} must be imported from DigiLocker. Connect your DigiLocker account and import the document — manual upload is not allowed unless an admin enables it for this application.`,
        400,
      );
    }
  }

  const fileUrl = file.path.replace(/\\/g, '/');
  const doc = await db.Document.create({
    studentProfileId,
    applicationId,
    fileUrl,
    originalFileName: file.originalname,
    type: normalizedType.slice(0, 64),
    fileSize: file.size,
    status: 'pending',
  });

  let verification: Awaited<ReturnType<typeof processVerificationUpload>> | null = null;
  if (opts.userId && isVerificationDocumentType(normalizedType)) {
    verification = await processVerificationUpload({
      userId: opts.userId,
      userEmail: opts.userEmail ?? null,
      documentId: doc.id,
      fileUrl,
      documentType: normalizedType,
    });
  }

  return { doc, verification };
};

/** Attach a pre-verified document (e.g. imported from DigiLocker). */
export const attachVerifiedStudentDocument = async (
  studentProfileId: number,
  opts: {
    applicationId: string;
    fileUrl: string;
    originalFileName: string;
    documentType: string;
    fileSize: number;
    verificationSource?: string;
    verificationMeta?: Record<string, unknown>;
  },
) => {
  const app = await db.Application.findOne({
    where: applicationLookupWhere(studentProfileId, opts.applicationId),
  });
  if (!app) throw new AppError('Application not found', 404);

  const { validateVerificationDocumentType } = await import(
    '../src/modules/document-verification/document-verification.processor'
  );
  const { normalizeDocumentType } = await import('../src/modules/document-verification/document-types');
  validateVerificationDocumentType(opts.documentType);
  const normalizedType = normalizeDocumentType(opts.documentType);

  const doc = await db.Document.create({
    studentProfileId,
    applicationId: app.getDataValue('id'),
    fileUrl: opts.fileUrl,
    originalFileName: opts.originalFileName.slice(0, 255),
    type: normalizedType.slice(0, 64),
    fileSize: opts.fileSize,
    status: 'verified',
  });

  return doc.get({ plain: true });
};

/** Offer letters visible to the student (same application scope as the rest of the portal). */
export const listStudentOfferLetters = async (studentProfileId: number) => {
  return db.OfferLetter.findAll({
    include: [
      {
        model: db.Application,
        as: 'application',
        required: true,
        where: { studentId: studentProfileId },
        attributes: ['id', 'applicationNumber', 'status', 'universityName', 'programName'],
      },
    ],
    order: [['updatedAt', 'DESC']],
    attributes: [
      'id',
      'referenceCode',
      'applicationId',
      'fileUrl',
      'signedFileUrl',
      'uploadedAt',
      'status',
      'universityName',
      'programName',
      'studentDisplayName',
      'expiresAt',
      'createdAt',
      'updatedAt',
    ],
  });
};

export const getStudentOfferLetterForApplication = async (
  studentProfileId: number,
  applicationIdOrRef: string,
) => {
  const app = await getStudentApplication(studentProfileId, applicationIdOrRef);
  const letter = await db.OfferLetter.findOne({
    where: { applicationId: app.id },
    include: [
      {
        model: db.Application,
        as: 'application',
        required: true,
        where: { studentId: studentProfileId },
        attributes: ['id', 'applicationNumber', 'status', 'universityName', 'programName'],
      },
    ],
    attributes: [
      'id',
      'referenceCode',
      'applicationId',
      'fileUrl',
      'signedFileUrl',
      'uploadedAt',
      'status',
      'universityName',
      'programName',
      'studentDisplayName',
      'expiresAt',
      'createdAt',
      'updatedAt',
    ],
  });
  if (!letter) {
    throw new AppError('Offer letter not found for this application', 404);
  }
  return letter;
};

export const getStudentOfferLetterByIdOrRef = async (studentProfileId: number, param: string) => {
  const clause = offerLetterWhereClause(param);
  const letter = await db.OfferLetter.findOne({
    where: clause,
    include: [
      {
        model: db.Application,
        as: 'application',
        required: true,
        where: { studentId: studentProfileId },
        attributes: ['id', 'applicationNumber', 'status', 'universityName', 'programName'],
      },
    ],
    attributes: [
      'id',
      'referenceCode',
      'applicationId',
      'fileUrl',
      'signedFileUrl',
      'uploadedAt',
      'status',
      'universityName',
      'programName',
      'studentDisplayName',
      'expiresAt',
      'createdAt',
      'updatedAt',
    ],
  });
  if (!letter) {
    throw new AppError('Offer letter not found', 404);
  }
  return letter;
};

const assertOfficialOfferPresent = (letter: { fileUrl?: string | null }) => {
  if (!letter.fileUrl?.trim()) {
    throw new AppError(
      'The official offer letter is not available yet. Wait until it is uploaded, then submit your signed copy.',
      400,
    );
  }
};

/** Student uploads signed offer PDF; same row is visible to admin/agent lists (`signedFileUrl`, status `signed`). */
export const uploadStudentSignedOfferLetterByIdOrRef = async (
  studentProfileId: number,
  offerLetterParam: string,
  file: Express.Multer.File,
) => {
  if (!file) {
    throw new AppError('File is required', 400);
  }
  const letter = await getStudentOfferLetterByIdOrRef(studentProfileId, offerLetterParam);
  assertOfficialOfferPresent(letter);
  const url = file.path.replace(/\\/g, '/');
  await letter.update({
    signedFileUrl: url,
    status: 'signed',
  });
  const { notifyAdminSignedOfferUploaded } = await import('./offer-letter-notify.service');
  notifyAdminSignedOfferUploaded(letter, 'student');
  return letter;
};

export const uploadStudentSignedOfferLetterForApplication = async (
  studentProfileId: number,
  applicationIdOrRef: string,
  file: Express.Multer.File,
) => {
  if (!file) {
    throw new AppError('File is required', 400);
  }
  const letter = await getStudentOfferLetterForApplication(studentProfileId, applicationIdOrRef);
  assertOfficialOfferPresent(letter);
  const url = file.path.replace(/\\/g, '/');
  await letter.update({
    signedFileUrl: url,
    status: 'signed',
  });
  const { notifyAdminSignedOfferUploaded } = await import('./offer-letter-notify.service');
  notifyAdminSignedOfferUploaded(letter, 'student');
  return letter;
};

/** Public-facing university fields a student is allowed to see (excludes admin agreement/contract internals). */
const STUDENT_UNIVERSITY_ATTRIBUTES = [
  'id',
  'name',
  'country',
  'status',
  'programFeeRanges',
  'createdAt',
  'updatedAt',
] as const;

/**
 * List active universities uploaded by admin. Visible to authenticated students for browsing
 * before creating an application. Supports pagination, free-text search (name/country) and a country filter.
 */
export const listStudentUniversities = async (query: {
  search?: string;
  country?: string;
  page?: string | number;
  limit?: string | number;
}) => {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(200, Math.max(1, Number(query.limit) || 50));
  const offset = (page - 1) * limit;

  const where: Record<string, unknown> = { status: true };
  const andClauses: Record<string, unknown>[] = [];

  if (query.country && String(query.country).trim()) {
    andClauses.push({ country: { [Op.iLike]: `%${String(query.country).trim()}%` } });
  }
  if (query.search && String(query.search).trim()) {
    const q = `%${String(query.search).trim()}%`;
    andClauses.push({
      [Op.or]: [{ name: { [Op.iLike]: q } }, { country: { [Op.iLike]: q } }],
    });
  }
  if (andClauses.length > 0) {
    (where as any)[Op.and] = andClauses;
  }

  const { rows, count } = await db.University.findAndCountAll({
    where,
    attributes: STUDENT_UNIVERSITY_ATTRIBUTES as unknown as string[],
    order: [['name', 'ASC']],
    limit,
    offset,
  });

  const universities = await Promise.all(
    rows.map(async uni => {
      const plain = uni.get({ plain: true }) as Record<string, unknown>;
      const programsCount = await db.Course.count({ where: { universityId: uni.id } });
      return { ...plain, programsCount };
    }),
  );

  return { universities, page, limit, total: count };
};

/** Single active university details + its course catalog (read-only) for the student portal. */
export const getStudentUniversityById = async (universityId: number) => {
  if (!Number.isFinite(universityId) || universityId < 1) {
    throw new AppError('Invalid university id', 400);
  }
  const uni = await db.University.findOne({
    where: { id: universityId, status: true },
    attributes: STUDENT_UNIVERSITY_ATTRIBUTES as unknown as string[],
  });
  if (!uni) throw new AppError('University not found', 404);

  const courses = await db.Course.findAll({
    where: { universityId: uni.id },
    attributes: ['id', 'courseName', 'degree', 'fee', 'duration', 'admissionRequirements'],
    order: [['courseName', 'ASC']],
  });

  return {
    ...(uni.get({ plain: true }) as Record<string, unknown>),
    programsCount: courses.length,
    courses,
  };
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

export const createTuitionPayLink = async (
  studentProfileId: number,
  userId: string,
  body: { applicationId: string; amount?: number | string | null; currency?: string },
) => {
  const app = await db.Application.findOne({
    where: applicationLookupWhere(studentProfileId, body.applicationId),
    include: [
      {
        model: db.Course,
        as: 'course',
        attributes: ['id', 'courseName', 'degree', 'fee'],
        required: false,
        include: [{ model: db.University, as: 'university', required: false }],
      },
    ],
  });
  if (!app) throw new AppError('Application not found', 404);
  if (app.status === 'draft') {
    throw new AppError('Submit the application before creating a tuition payment link', 400);
  }

  const user = await db.User.findByPk(userId);
  if (!user) throw new AppError('User not found', 404);

  const courseFee = (app as any).course?.fee;
  let amount: number;
  if (body.amount !== undefined && body.amount !== null && String(body.amount).trim() !== '') {
    amount = typeof body.amount === 'number' ? body.amount : Number(body.amount);
  } else if (typeof courseFee === 'number' && Number.isFinite(courseFee) && courseFee > 0) {
    amount = courseFee;
  } else {
    throw new AppError('Amount is required when the program has no catalog fee', 400);
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new AppError('Amount must be a positive number', 400);
  }

  const { createFlywirePayLink, resolveFlywirePaymentDestination } = await import(
    '../src/modules/flywire/flywire.service'
  );
  const { flywireConfig } = await import('../src/modules/flywire/flywire.config');

  const paymentDestination = await resolveFlywirePaymentDestination(app as any);
  const nameParts = String(user.name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  return createFlywirePayLink({
    userId: user.id,
    applicationId: app.id,
    agentProfileId: app.agentId ?? null,
    amount,
    currency: body.currency || 'USD',
    type: 'tuition',
    studentEmail: user.email || null,
    payerFirstName: nameParts[0] || 'Student',
    payerLastName: nameParts.slice(1).join(' ') || nameParts[0] || 'Payer',
    payerCountry: app.country || null,
    paymentDestination,
    returnUrl: `${flywireConfig().frontendUrl}/student/applications/${app.id}`,
  });
};
