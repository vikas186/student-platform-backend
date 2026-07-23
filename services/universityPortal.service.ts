import { Op, fn } from 'sequelize';
import { db } from '../config/database';
import AppError from '../utils/errorHandler';
import { APPLICATION_STATUSES } from '../models/Application.model';
import { DOCUMENT_STATUSES } from '../models/Document.model';
import { UNIVERSITY_DOCUMENT_CHECKLIST } from '../config/universityDocumentChecklist';
import { normalizeApplicationReference } from '../utils/applicationRef';
import { isUuid } from '../utils/isUuid';
import { backendApplicationStatusToUi, normalizeApplicationStatusInput } from '../utils/adminUiStatus';
import {
  applicationScopeForUniversity,
  applicationScopeOnIncludedApplicationForUniversity,
} from '../utils/universityApplicationScope';

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

const applicationIncludeForUniversityStudentScope = {
  model: db.StudentProfile,
  as: 'studentProfile',
  required: false,
};

const applicationWhereForUniversity = (
  universityId: number,
  universityName: string,
  idOrRef: string,
) => ({
  [Op.and]: [applicationWhereByIdOrRef(idOrRef), applicationScopeForUniversity(universityId, universityName)],
});

export const requireUniversityProfile = async (userId: string) => {
  const profile = await db.UniversityProfile.findOne({
    where: { userId },
    include: [{ model: db.University, as: 'university', attributes: ['id', 'name', 'country'] }],
  });
  if (!profile) {
    throw new AppError('University profile not found', 404);
  }
  return profile;
};

async function universityScopeFromUser(userId: string): Promise<{
  universityId: number;
  universityName: string;
}> {
  const profile = await requireUniversityProfile(userId);
  const uni = await db.University.findByPk(profile.universityId);
  if (!uni) {
    throw new AppError('University not found', 404);
  }
  return { universityId: uni.id, universityName: uni.name };
}

function commissionUnlocked(uni: { countersignedContractUrl?: string | null }): boolean {
  return Boolean(uni.countersignedContractUrl?.trim());
}

export const getUniversityPartnershipSummary = async (userId: string) => {
  const { universityId } = await universityScopeFromUser(userId);
  const uni = await db.University.findByPk(universityId);
  if (!uni) {
    throw new AppError('University not found', 404);
  }
  const locked = !commissionUnlocked(uni);
  return {
    agreementPackageReference: uni.agreementPackageReference,
    agreementDispatchedAt: uni.agreementDispatchedAt,
    hasCountersigned: Boolean(uni.countersignedContractUrl),
    countersignedUploadedAt: uni.countersignedUploadedAt,
    countersignedVerifiedAt: uni.countersignedVerifiedAt,
    commissionLocked: locked,
  };
};

export const getUniversityDashboard = async (userId: string) => {
  const { universityId, universityName } = await universityScopeFromUser(userId);
  const uni = await db.University.findByPk(universityId);
  if (!uni) {
    throw new AppError('University not found', 404);
  }
  const scope = applicationScopeForUniversity(universityId, universityName);

  const totalApplicants = await db.Application.count({
    where: { [Op.and]: [scope, { status: { [Op.ne]: 'draft' } }] },
  });

  const awaitingDecision = await db.Application.count({
    where: {
      [Op.and]: [scope, { status: { [Op.in]: ['submitted', 'under_review'] } }],
    },
  });

  const offersIssued = await db.Application.count({
    where: { [Op.and]: [scope, { status: 'offer_generated' }] },
  });

  const programs = await db.Course.count({ where: { universityId } });

  const statusRows = (await db.Application.findAll({
    attributes: ['status', [fn('COUNT', '*'), 'count']],
    where: scope,
    group: ['Application.status'],
    subQuery: false,
    raw: true,
  })) as unknown as { status: string; count: string }[];

  const byStatus: Record<string, number> = {};
  for (const r of statusRows) {
    byStatus[r.status] = Number(r.count);
  }

  const locked = !commissionUnlocked(uni);

  return {
    metrics: {
      totalApplicants,
      awaitingDecision,
      offersIssued,
      programs,
    },
    breakdown: { byStatus },
    partnership: {
      agreementPackageReference: uni.agreementPackageReference,
      agreementDispatchedAt: uni.agreementDispatchedAt,
      hasCountersigned: Boolean(uni.countersignedContractUrl),
      countersignedUploadedAt: uni.countersignedUploadedAt,
      commissionLocked: locked,
    },
  };
};

export const getUniversityCommission = async (userId: string) => {
  const { universityId } = await universityScopeFromUser(userId);
  const uni = await db.University.findByPk(universityId);
  if (!uni) {
    throw new AppError('University not found', 404);
  }
  if (!commissionUnlocked(uni)) {
    return {
      locked: true as const,
      reason: 'Locked until signed agreement is uploaded.',
      commissions: [],
    };
  }
  const commissions = await db.Commission.findAll({
    where: { universityId },
    order: [['id', 'ASC']],
  });
  return {
    locked: false as const,
    commissions,
  };
};

export const uploadCountersignedContract = async (userId: string, file: Express.Multer.File) => {
  if (!file) {
    throw new AppError('File is required', 400);
  }
  const { universityId } = await universityScopeFromUser(userId);
  const uni = await db.University.findByPk(universityId);
  if (!uni) {
    throw new AppError('University not found', 404);
  }
  const fileUrl = file.path.replace(/\\/g, '/');
  uni.countersignedContractUrl = fileUrl;
  uni.countersignedUploadedAt = new Date();
  await uni.save();
  return getUniversityPartnershipSummary(userId);
};

export const listUniversityApplications = async (
  userId: string,
  query: {
    search?: string;
    status?: string;
    page?: string | number;
    limit?: string | number;
    applicationNumber?: string;
    id?: string;
  },
) => {
  const { universityId, universityName } = await universityScopeFromUser(userId);
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
  const offset = (page - 1) * limit;

  const andParts: object[] = [applicationScopeForUniversity(universityId, universityName), { status: { [Op.ne]: 'draft' } }];

  if (query.status?.trim()) {
    const resolved = normalizeApplicationStatusInput(query.status.trim());
    if (!resolved) {
      throw new AppError(
        'Invalid status filter — use a backend value (e.g. under_review) or Uniwizer UI label (e.g. Review)',
        400,
      );
    }
    andParts.push({ status: resolved });
  }
  if (query.id && isUuid(query.id)) {
    andParts.push({ id: query.id });
  }
  if (query.applicationNumber?.trim()) {
    const ref = normalizeApplicationReference(query.applicationNumber.trim());
    if (!ref) {
      throw new AppError('Invalid applicationNumber (expected APP-12345)', 400);
    }
    andParts.push({ applicationNumber: ref });
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

  const data = rows.map(a => {
    const plain = a.get({ plain: true }) as Record<string, unknown>;
    return {
      ...plain,
      statusUi: backendApplicationStatusToUi(String(plain.status)),
    };
  });

  return { data, page, limit, total: count };
};

export const getApplicationForUniversity = async (userId: string, idOrRef: string) => {
  const { universityId, universityName } = await universityScopeFromUser(userId);
  const app = await db.Application.findOne({
    where: applicationWhereForUniversity(universityId, universityName, idOrRef),
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
      {
        model: db.Document,
        as: 'documents',
        required: false,
      },
      {
        model: db.AgentProfile,
        as: 'agentProfile',
        required: false,
        include: [{ model: db.User, as: 'user', attributes: ['id', 'name', 'email'] }],
      },
    ],
  });
  if (!app) {
    throw new AppError('Application not found', 404);
  }

  // First university open of a newly submitted application → under review.
  if (app.status === 'submitted') {
    const previousStatus = app.status;
    app.status = 'under_review';
    await app.save();
    const { notifyApplicationStatusChange } = await import('./application-email.service');
    notifyApplicationStatusChange(app.id, previousStatus, 'under_review');
  }

  const plain = app.get({ plain: true }) as Record<string, unknown>;
  return {
    ...plain,
    statusUi: backendApplicationStatusToUi(String(plain.status)),
  };
};

export const getApplicationChecklistForUniversity = async (userId: string, idOrRef: string) => {
  const detail = await getApplicationForUniversity(userId, idOrRef);
  const plain = detail as Record<string, unknown>;
  const applicationId = String(plain.id);
  const applicationNumber = String(plain.applicationNumber ?? '');
  const docs = await db.Document.findAll({ where: { applicationId } });
  const byType = new Map(docs.map(d => [d.type.toLowerCase(), d]));

  const checklist = UNIVERSITY_DOCUMENT_CHECKLIST.map(({ key, label }) => {
    const d = byType.get(key.toLowerCase());
    return {
      key,
      label,
      status: d ? d.status : 'pending',
      documentId: d?.id ?? null,
    };
  });

  return {
    applicationId,
    applicationNumber,
    checklist,
  };
};

export const patchUniversityApplicationStatus = async (userId: string, idOrRef: string, uiOrBackendStatus: string) => {
  const { universityId, universityName } = await universityScopeFromUser(userId);
  const resolved = normalizeApplicationStatusInput(uiOrBackendStatus);
  if (!resolved) {
    throw new AppError('Invalid status — use an Uniwizer label (e.g. Review) or backend enum (e.g. under_review)', 400);
  }
  if (resolved === 'draft') {
    throw new AppError('Cannot set status to draft from the university portal', 400);
  }
  const app = await db.Application.findOne({
    where: applicationWhereForUniversity(universityId, universityName, idOrRef),
    include: [applicationIncludeForUniversityStudentScope],
  });
  if (!app) {
    throw new AppError('Application not found', 404);
  }
  const previousStatus = app.status;
  app.status = resolved;
  await app.save();
  const { notifyApplicationStatusChange } = await import('./application-email.service');
  notifyApplicationStatusChange(app.id, previousStatus, resolved);
  return getApplicationForUniversity(userId, idOrRef);
};

export const patchUniversityDocument = async (
  userId: string,
  documentId: string,
  body: { status?: (typeof DOCUMENT_STATUSES)[number] },
) => {
  if (!isUuid(documentId)) {
    throw new AppError('Invalid document id', 400);
  }
  const { universityId, universityName } = await universityScopeFromUser(userId);
  const doc = await db.Document.findOne({
    where: { id: documentId },
    include: [
      {
        model: db.Application,
        as: 'application',
        required: true,
        where: applicationScopeOnIncludedApplicationForUniversity(universityId, universityName),
        include: [applicationIncludeForUniversityStudentScope],
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

export const listApplicationStatusOptionsForUniversity = () =>
  (APPLICATION_STATUSES as readonly string[]).map(s => ({
    value: s,
    statusUi: backendApplicationStatusToUi(s),
  }));
