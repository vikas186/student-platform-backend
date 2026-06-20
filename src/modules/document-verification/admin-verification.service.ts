import { db } from '../../../config/database';
import AppError from '../../../utils/errorHandler';
import type { VerificationEntityType } from '../../../models/VerificationAuditLog.model';
import { decodeRegistryId, encodeRegistryId, DOCUMENT_TYPE_LABELS } from './document-types';
import { listVerificationAudit, writeVerificationAudit } from './audit.service';

export type AdminVerificationListItem = {
  registryId: string;
  category: VerificationEntityType;
  entityId: string;
  userId: string;
  userName: string | null;
  userEmail: string | null;
  status: string;
  documentType: string | null;
  label: string;
  fileUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

const mapUser = async (userId: string) => {
  const user = await db.User.findByPk(userId, { attributes: ['id', 'name', 'email'] });
  return user ? { name: user.name, email: user.email } : { name: null, email: null };
};

export const listAdminVerifications = async (query: {
  category?: string;
  status?: string;
  userId?: string;
  q?: string;
  page?: number;
  limit?: number;
}) => {
  const page = query.page ?? 1;
  const limit = query.limit ?? 20;
  const category = query.category ?? 'all';
  const items: AdminVerificationListItem[] = [];

  const userFilter = query.userId ? { userId: query.userId } : {};

  if (category === 'all' || category === 'passport') {
    const rows = await db.PassportVerification.findAll({
      where: {
        ...userFilter,
        ...(query.status ? { status: query.status } : {}),
      },
      order: [['updatedAt', 'DESC']],
    });
    for (const r of rows) {
      const u = await mapUser(r.userId);
      items.push({
        registryId: encodeRegistryId('passport', r.id),
        category: 'passport',
        entityId: r.id,
        userId: r.userId,
        userName: u.name ?? null,
        userEmail: u.email ?? null,
        status: r.status,
        documentType: 'passport',
        label: DOCUMENT_TYPE_LABELS.passport,
        fileUrl: null,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
      });
    }
  }

  if (category === 'all' || category === 'academic') {
    const rows = await db.AcademicDocument.findAll({
      where: {
        ...userFilter,
        ...(query.status ? { verificationStatus: query.status } : {}),
      },
      order: [['updatedAt', 'DESC']],
    });
    for (const r of rows) {
      const u = await mapUser(r.userId);
      items.push({
        registryId: encodeRegistryId('academic', r.id),
        category: 'academic',
        entityId: r.id,
        userId: r.userId,
        userName: u.name ?? null,
        userEmail: u.email ?? null,
        status: r.verificationStatus,
        documentType: r.documentType,
        label: DOCUMENT_TYPE_LABELS[r.documentType] ?? r.documentType,
        fileUrl: r.fileUrl ?? null,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
      });
    }
  }

  if (category === 'all' || category === 'bank') {
    const rows = await db.BankStatement.findAll({
      where: {
        ...userFilter,
        ...(query.status ? { verificationStatus: query.status } : {}),
      },
      order: [['updatedAt', 'DESC']],
    });
    for (const r of rows) {
      const u = await mapUser(r.userId);
      items.push({
        registryId: encodeRegistryId('bank', r.id),
        category: 'bank',
        entityId: r.id,
        userId: r.userId,
        userName: u.name ?? null,
        userEmail: u.email ?? null,
        status: r.verificationStatus,
        documentType: 'bank_statement',
        label: DOCUMENT_TYPE_LABELS.bank_statement,
        fileUrl: r.fileUrl ?? null,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
      });
    }
  }

  if (category === 'all' || category === 'itr') {
    const rows = await db.ItrDocument.findAll({
      where: {
        ...userFilter,
        ...(query.status ? { verificationStatus: query.status } : {}),
      },
      order: [['updatedAt', 'DESC']],
    });
    for (const r of rows) {
      const u = await mapUser(r.userId);
      items.push({
        registryId: encodeRegistryId('itr', r.id),
        category: 'itr',
        entityId: r.id,
        userId: r.userId,
        userName: u.name ?? null,
        userEmail: u.email ?? null,
        status: r.verificationStatus,
        documentType: 'itr',
        label: DOCUMENT_TYPE_LABELS.itr,
        fileUrl: r.fileUrl ?? null,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
      });
    }
  }

  let filtered = items;
  if (query.q?.trim()) {
    const q = query.q.trim().toLowerCase();
    filtered = items.filter(
      i =>
        i.userName?.toLowerCase().includes(q) ||
        i.userEmail?.toLowerCase().includes(q) ||
        i.label.toLowerCase().includes(q) ||
        i.status.toLowerCase().includes(q),
    );
  }

  filtered.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const total = filtered.length;
  const start = (page - 1) * limit;
  const data = filtered.slice(start, start + limit);

  return { data, total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) };
};

export const getAdminVerificationDetail = async (registryId: string) => {
  const { entityType, entityId } = decodeRegistryId(registryId);
  const category = entityType as VerificationEntityType;

  if (category === 'passport') {
    const row = await db.PassportVerification.findByPk(entityId, {
      include: [{ model: db.Document, as: 'document', required: false }],
    });
    if (!row) throw new AppError('Verification not found', 404);
    const auditRows = await listVerificationAudit('passport', entityId);
    const u = await mapUser(row.userId);
    const doc = row.get('document') as { fileUrl?: string } | null;
    const record = row.get({ plain: true }) as Record<string, unknown>;
    if (doc?.fileUrl) record.fileUrl = doc.fileUrl;
    return {
      category,
      record,
      audit: auditRows.map(a => a.get({ plain: true })),
      user: u,
      registryId,
    };
  }

  if (category === 'academic') {
    const row = await db.AcademicDocument.findByPk(entityId, {
      include: [{ model: db.Document, as: 'document', required: false }],
    });
    if (!row) throw new AppError('Verification not found', 404);
    const audit = await listVerificationAudit('academic', entityId);
    const u = await mapUser(row.userId);
    return { category, record: row.get({ plain: true }), audit, user: u, registryId };
  }

  if (category === 'bank') {
    const row = await db.BankStatement.findByPk(entityId, {
      include: [{ model: db.Document, as: 'document', required: false }],
    });
    if (!row) throw new AppError('Verification not found', 404);
    const audit = await listVerificationAudit('bank', entityId);
    const u = await mapUser(row.userId);
    return { category, record: row.get({ plain: true }), audit, user: u, registryId };
  }

  if (category === 'itr') {
    const row = await db.ItrDocument.findByPk(entityId, {
      include: [{ model: db.Document, as: 'document', required: false }],
    });
    if (!row) throw new AppError('Verification not found', 404);
    const audit = await listVerificationAudit('itr', entityId);
    const u = await mapUser(row.userId);
    return { category, record: row.get({ plain: true }), audit, user: u, registryId };
  }

  throw new AppError('Invalid verification category', 400);
};

const updateStatus = async (
  registryId: string,
  action: 'approve' | 'reject' | 'request_resubmission',
  actorUserId: string,
  notes?: string,
) => {
  const { entityType, entityId } = decodeRegistryId(registryId);
  const category = entityType as VerificationEntityType;

  if (category === 'passport') {
    const row = await db.PassportVerification.findByPk(entityId);
    if (!row) throw new AppError('Verification not found', 404);
    const status =
      action === 'approve' ? 'verified' : action === 'reject' ? 'rejected' : 'needs_review';
    await row.update({ status });
    if (action === 'approve' && row.documentId) {
      await db.Document.update({ status: 'verified' }, { where: { id: row.documentId } });
    }
    if (action === 'reject' && row.documentId) {
      await db.Document.update({ status: 'rejected' }, { where: { id: row.documentId } });
    }
    await writeVerificationAudit({
      entityType: 'passport',
      entityId,
      action,
      actorUserId,
      notes,
    });
    return row;
  }

  if (category === 'academic') {
    const row = await db.AcademicDocument.findByPk(entityId);
    if (!row) throw new AppError('Verification not found', 404);
    const status =
      action === 'approve'
        ? 'approved'
        : action === 'reject'
          ? 'rejected'
          : 'needs_review';
    await row.update({ verificationStatus: status, reviewNotes: notes ?? row.reviewNotes });
    if (row.documentId) {
      await db.Document.update(
        { status: action === 'approve' ? 'verified' : action === 'reject' ? 'rejected' : 'pending' },
        { where: { id: row.documentId } },
      );
    }
    await writeVerificationAudit({ entityType: 'academic', entityId, action, actorUserId, notes });
    return row;
  }

  if (category === 'bank') {
    const row = await db.BankStatement.findByPk(entityId);
    if (!row) throw new AppError('Verification not found', 404);
    const status =
      action === 'approve'
        ? 'approved'
        : action === 'reject'
          ? 'rejected'
          : 'needs_review';
    await row.update({ verificationStatus: status, reviewNotes: notes ?? row.reviewNotes });
    if (row.documentId) {
      await db.Document.update(
        { status: action === 'approve' ? 'verified' : action === 'reject' ? 'rejected' : 'pending' },
        { where: { id: row.documentId } },
      );
    }
    await writeVerificationAudit({ entityType: 'bank', entityId, action, actorUserId, notes });
    return row;
  }

  if (category === 'itr') {
    const row = await db.ItrDocument.findByPk(entityId);
    if (!row) throw new AppError('Verification not found', 404);
    const status =
      action === 'approve'
        ? 'approved'
        : action === 'reject'
          ? 'rejected'
          : 'needs_review';
    await row.update({ verificationStatus: status, reviewNotes: notes ?? row.reviewNotes });
    if (row.documentId) {
      await db.Document.update(
        { status: action === 'approve' ? 'verified' : action === 'reject' ? 'rejected' : 'pending' },
        { where: { id: row.documentId } },
      );
    }
    await writeVerificationAudit({ entityType: 'itr', entityId, action, actorUserId, notes });
    return row;
  }

  throw new AppError('Invalid verification category', 400);
};

export const approveVerification = (registryId: string, actorUserId: string, notes?: string) =>
  updateStatus(registryId, 'approve', actorUserId, notes);

export const rejectVerification = (registryId: string, actorUserId: string, notes?: string) =>
  updateStatus(registryId, 'reject', actorUserId, notes);

export const requestVerificationResubmission = (
  registryId: string,
  actorUserId: string,
  notes: string,
) => updateStatus(registryId, 'request_resubmission', actorUserId, notes);
