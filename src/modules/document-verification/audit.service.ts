import { db } from '../../../config/database';
import type { VerificationAuditAction, VerificationEntityType } from '../../../models/VerificationAuditLog.model';

export const writeVerificationAudit = async (input: {
  entityType: VerificationEntityType;
  entityId: string;
  action: VerificationAuditAction;
  actorUserId?: string | null;
  notes?: string | null;
  metadata?: Record<string, unknown> | null;
}): Promise<void> => {
  await db.VerificationAuditLog.create({
    entityType: input.entityType,
    entityId: input.entityId,
    action: input.action,
    actorUserId: input.actorUserId ?? null,
    notes: input.notes ?? null,
    metadata: input.metadata ?? null,
  });
};

export const listVerificationAudit = async (entityType: VerificationEntityType, entityId: string) => {
  return db.VerificationAuditLog.findAll({
    where: { entityType, entityId },
    order: [['createdAt', 'DESC']],
    include: [{ model: db.User, as: 'actor', attributes: ['id', 'name', 'email'], required: false }],
  });
};
