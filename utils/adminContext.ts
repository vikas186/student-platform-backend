import { db } from '../config/database';
import AppError from './errorHandler';

export type AdminContext = {
  userId: string;
  name: string;
  email: string;
  isPrimaryAdmin: boolean;
  parentAdminUserId: string | null;
};

/** Resolve primary vs sub-admin for an admin user. Existing admins default to primary. */
export const resolveAdminContext = async (userId: string): Promise<AdminContext> => {
  const user = await db.User.findByPk(userId, {
    attributes: ['id', 'name', 'email', 'role', 'isPrimaryAdmin', 'parentAdminUserId'],
  });
  if (!user || user.role !== 'admin') {
    throw new AppError('Admin access required', 403);
  }
  const plain = user.get({ plain: true }) as {
    id: string;
    name: string;
    email: string;
    isPrimaryAdmin?: boolean | null;
    parentAdminUserId?: string | null;
  };
  // Missing column / null → treat as primary so production stays open.
  const isPrimaryAdmin = plain.isPrimaryAdmin !== false;
  return {
    userId: plain.id,
    name: plain.name,
    email: plain.email,
    isPrimaryAdmin,
    parentAdminUserId: plain.parentAdminUserId ?? null,
  };
};

export const assertPrimaryAdmin = async (userId: string): Promise<AdminContext> => {
  const ctx = await resolveAdminContext(userId);
  if (!ctx.isPrimaryAdmin) {
    throw new AppError('Only the primary admin can perform this action', 403);
  }
  return ctx;
};

/** Sub-admins under this primary, plus other admin accounts when listing assignees. */
export const listAllocatableSubAdmins = async (primaryUserId: string) => {
  await assertPrimaryAdmin(primaryUserId);
  const rows = await db.User.findAll({
    where: { role: 'admin', status: true },
    attributes: ['id', 'name', 'email', 'isPrimaryAdmin', 'parentAdminUserId'],
    order: [['name', 'ASC']],
  });
  return rows.map(r => {
    const p = r.get({ plain: true }) as {
      id: string;
      name: string;
      email: string;
      isPrimaryAdmin?: boolean | null;
      parentAdminUserId?: string | null;
    };
    return {
      id: p.id,
      name: p.name,
      email: p.email,
      isPrimaryAdmin: p.isPrimaryAdmin !== false,
      parentAdminUserId: p.parentAdminUserId ?? null,
      isSelf: p.id === primaryUserId,
    };
  });
};
