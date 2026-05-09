import { db } from '../config/database';
import AppError from '../utils/errorHandler';
import type { UserRole } from '../models/User.model';
import {
  buildFullAccessForCatalog,
  DEFAULT_PERMISSION_MATRIX,
  MATRIX_ROLES,
  PERMISSION_CATALOG,
  totalPermissionCells,
} from '../config/permissionCatalog';

const totalCells = totalPermissionCells();

const flattenDefaults = () => {
  const rows: { role: UserRole; moduleKey: string; actionKey: string; allowed: boolean }[] = [];
  for (const role of MATRIX_ROLES) {
    for (const mod of PERMISSION_CATALOG) {
      for (const act of mod.actions) {
        const allowed = Boolean(DEFAULT_PERMISSION_MATRIX[role][mod.moduleKey]?.[act.key]);
        rows.push({ role, moduleKey: mod.moduleKey, actionKey: act.key, allowed });
      }
    }
  }
  return rows;
};

export const seedRolePermissionsIfEmpty = async (): Promise<void> => {
  const n = await db.RolePermission.count();
  if (n > 0) {
    return;
  }
  await db.RolePermission.bulkCreate(flattenDefaults());
};

/** Every catalog cell for `admin` is `allowed: true` (creates missing rows after catalog changes). */
export const ensureAdminHasAllCatalogPermissions = async (): Promise<void> => {
  await seedRolePermissionsIfEmpty();
  for (const mod of PERMISSION_CATALOG) {
    for (const act of mod.actions) {
      const [row] = await db.RolePermission.findOrCreate({
        where: { role: 'admin', moduleKey: mod.moduleKey, actionKey: act.key },
        defaults: { allowed: true },
      });
      if (!row.allowed) {
        await row.update({ allowed: true });
      }
    }
  }
};

/** Portal review + commission read for role `university` (aligned with DEFAULT_PERMISSION_MATRIX). */
export const ensureUniversityPortalPermissions = async (): Promise<void> => {
  await seedRolePermissionsIfEmpty();
  const cells: { moduleKey: string; actionKey: string }[] = [
    { moduleKey: 'applications', actionKey: 'view' },
    { moduleKey: 'applications', actionKey: 'edit' },
    { moduleKey: 'commission_slabs', actionKey: 'view' },
  ];
  for (const c of cells) {
    const [row] = await db.RolePermission.findOrCreate({
      where: { role: 'university', moduleKey: c.moduleKey, actionKey: c.actionKey },
      defaults: { allowed: true },
    });
    await row.update({ allowed: true });
  }
};

const cloneRoleMatrix = (m: Record<string, Record<string, boolean>>): Record<string, Record<string, boolean>> => {
  const o: Record<string, Record<string, boolean>> = {};
  for (const k of Object.keys(m)) {
    o[k] = { ...m[k] };
  }
  return o;
};

const rowsToMatrix = (
  rows: { role: string; moduleKey: string; actionKey: string; allowed: boolean }[],
): Record<UserRole, Record<string, Record<string, boolean>>> => {
  const matrix = {} as Record<UserRole, Record<string, Record<string, boolean>>>;
  for (const role of MATRIX_ROLES) {
    matrix[role] = {};
    for (const mod of PERMISSION_CATALOG) {
      matrix[role][mod.moduleKey] = {};
      for (const act of mod.actions) {
        matrix[role][mod.moduleKey][act.key] = false;
      }
    }
  }
  for (const r of rows) {
    const role = r.role as UserRole;
    if (!matrix[role]?.[r.moduleKey]) {
      continue;
    }
    if (r.actionKey in matrix[role][r.moduleKey]) {
      matrix[role][r.moduleKey][r.actionKey] = Boolean(r.allowed);
    }
  }
  return matrix;
};

const loadFullMatrixFromDb = async (): Promise<Record<UserRole, Record<string, Record<string, boolean>>>> => {
  await seedRolePermissionsIfEmpty();
  const rows = await db.RolePermission.findAll({
    attributes: ['role', 'moduleKey', 'actionKey', 'allowed'],
  });
  return rowsToMatrix(
    rows.map(r => ({
      role: r.role,
      moduleKey: r.moduleKey,
      actionKey: r.actionKey,
      allowed: r.allowed,
    })),
  );
};

/**
 * Merge PUT `matrix` with what is already stored. Omitted roles/modules/actions keep DB values
 * (so disabling a toggle is not undone by missing keys or by default-matrix fill).
 */
export const mergeMatrixPayloadWithExisting = (
  body: Record<string, Record<string, Record<string, unknown>>>,
  existing: Record<UserRole, Record<string, Record<string, boolean>>>,
): Record<UserRole, Record<string, Record<string, boolean>>> => {
  if (!body || typeof body !== 'object') {
    throw new AppError('matrix payload is required', 400);
  }
  const out = {} as Record<UserRole, Record<string, Record<string, boolean>>>;
  for (const role of MATRIX_ROLES) {
    const bodyRole = body[role];
    if (!bodyRole || typeof bodyRole !== 'object') {
      out[role] = cloneRoleMatrix(existing[role]);
      continue;
    }
    out[role] = {};
    for (const mod of PERMISSION_CATALOG) {
      const bodyMod = bodyRole[mod.moduleKey];
      const existingMod = existing[role][mod.moduleKey] ?? {};
      if (!bodyMod || typeof bodyMod !== 'object') {
        out[role][mod.moduleKey] = { ...existingMod };
        continue;
      }
      out[role][mod.moduleKey] = {};
      for (const act of mod.actions) {
        const v = bodyMod[act.key];
        out[role][mod.moduleKey][act.key] =
          typeof v === 'boolean' ? v : Boolean(existingMod[act.key]);
      }
    }
  }
  return out;
};

/** One role’s module × action booleans (for login / refresh `user.permissions`). Admins always get full catalog (matches `roleHasPermission`). */
export const getPermissionMatrixSliceForRole = async (
  role: UserRole,
): Promise<Record<string, Record<string, boolean>>> => {
  if (role === 'admin') {
    return buildFullAccessForCatalog();
  }
  await seedRolePermissionsIfEmpty();
  const rows = await db.RolePermission.findAll({
    where: { role },
    attributes: ['moduleKey', 'actionKey', 'allowed'],
  });
  const slice: Record<string, Record<string, boolean>> = {};
  for (const mod of PERMISSION_CATALOG) {
    slice[mod.moduleKey] = {};
    for (const act of mod.actions) {
      slice[mod.moduleKey][act.key] = false;
    }
  }
  for (const r of rows) {
    if (slice[r.moduleKey] && r.actionKey in slice[r.moduleKey]) {
      slice[r.moduleKey][r.actionKey] = Boolean(r.allowed);
    }
  }
  return slice;
};

export const getPermissionMatrixForAdmin = async () => {
  await seedRolePermissionsIfEmpty();
  const rows = await db.RolePermission.findAll({
    attributes: ['role', 'moduleKey', 'actionKey', 'allowed'],
  });
  const plain = rows.map(r => ({
    role: r.role,
    moduleKey: r.moduleKey,
    actionKey: r.actionKey,
    allowed: r.allowed,
  }));
  const matrix = rowsToMatrix(plain);
  const summary = MATRIX_ROLES.map(role => {
    const granted = plain.filter(r => r.role === role && r.allowed).length;
    return {
      role,
      granted,
      total: totalCells,
      percent: totalCells ? Math.round((granted / totalCells) * 1000) / 10 : 0,
    };
  });
  return {
    catalog: PERMISSION_CATALOG,
    matrix,
    summary,
    totalPermissionCells: totalCells,
  };
};

export const replacePermissionMatrixForAdmin = async (
  matrix: Record<string, Record<string, Record<string, boolean>>>,
) => {
  const existing = await loadFullMatrixFromDb();
  const normalized = mergeMatrixPayloadWithExisting(matrix, existing);
  const rows: { role: UserRole; moduleKey: string; actionKey: string; allowed: boolean }[] = [];
  for (const role of MATRIX_ROLES) {
    for (const mod of PERMISSION_CATALOG) {
      for (const act of mod.actions) {
        rows.push({
          role,
          moduleKey: mod.moduleKey,
          actionKey: act.key,
          allowed: normalized[role][mod.moduleKey][act.key],
        });
      }
    }
  }
  await db.sequelize.transaction(async t => {
    await db.RolePermission.destroy({ where: {}, transaction: t });
    await db.RolePermission.bulkCreate(rows, { transaction: t });
  });
  return getPermissionMatrixForAdmin();
};

export const resetPermissionMatrixToDefaults = async () => {
  await db.sequelize.transaction(async t => {
    await db.RolePermission.destroy({ where: {}, transaction: t });
    await db.RolePermission.bulkCreate(flattenDefaults(), { transaction: t });
  });
  return getPermissionMatrixForAdmin();
};

/** Runtime check for middleware / guards (loads from DB, seeds if empty). */
export const roleHasPermission = async (
  role: UserRole,
  moduleKey: string,
  actionKey: string,
): Promise<boolean> => {
  if (role === 'admin') {
    return true;
  }
  await seedRolePermissionsIfEmpty();
  const row = await db.RolePermission.findOne({
    where: { role, moduleKey, actionKey },
  });
  return Boolean(row?.allowed);
};
