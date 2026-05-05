import type { UserRole } from '../models/User.model';

export type PermissionActionDef = { key: string; label: string };

export type PermissionModuleDef = {
  moduleKey: string;
  moduleLabel: string;
  actions: PermissionActionDef[];
};

/** Matrix modules × actions (admin Roles & permissions UI). */
export const PERMISSION_CATALOG: PermissionModuleDef[] = [
  {
    moduleKey: 'applications',
    moduleLabel: 'Applications',
    actions: [
      { key: 'view', label: 'VIEW' },
      { key: 'create', label: 'CREATE' },
      { key: 'edit', label: 'EDIT' },
      { key: 'approve', label: 'APPROVE' },
    ],
  },
  {
    moduleKey: 'users',
    moduleLabel: 'Users',
    actions: [
      { key: 'view', label: 'VIEW' },
      { key: 'create', label: 'CREATE' },
      { key: 'edit', label: 'EDIT' },
      { key: 'delete', label: 'DELETE' },
    ],
  },
  {
    moduleKey: 'commission_slabs',
    moduleLabel: 'Commission slabs',
    actions: [
      { key: 'view', label: 'VIEW' },
      { key: 'create', label: 'CREATE' },
      { key: 'edit', label: 'EDIT' },
      { key: 'delete', label: 'DELETE' },
    ],
  },
  {
    moduleKey: 'subscriptions',
    moduleLabel: 'Subscriptions',
    actions: [
      { key: 'view', label: 'VIEW' },
      { key: 'create', label: 'CREATE' },
      { key: 'edit', label: 'EDIT' },
      { key: 'delete', label: 'DELETE' },
    ],
  },
  {
    moduleKey: 'deadlines',
    moduleLabel: 'Deadlines',
    actions: [
      { key: 'view', label: 'VIEW' },
      { key: 'create', label: 'CREATE' },
      { key: 'edit', label: 'EDIT' },
      { key: 'delete', label: 'DELETE' },
    ],
  },
  {
    moduleKey: 'payments',
    moduleLabel: 'Payments',
    actions: [
      { key: 'view', label: 'VIEW' },
      { key: 'create', label: 'CREATE' },
      { key: 'edit', label: 'EDIT' },
      { key: 'approve', label: 'APPROVE' },
    ],
  },
  {
    moduleKey: 'agent_ranking',
    moduleLabel: 'Agent ranking',
    actions: [
      { key: 'view', label: 'VIEW' },
      { key: 'approve', label: 'APPROVE' },
    ],
  },
  {
    moduleKey: 'roles_permissions',
    moduleLabel: 'Roles & permissions',
    actions: [
      { key: 'view', label: 'VIEW' },
      { key: 'edit', label: 'EDIT' },
    ],
  },
];

export const MATRIX_ROLES: UserRole[] = ['student', 'agent', 'admin', 'university'];

export const totalPermissionCells = (): number =>
  PERMISSION_CATALOG.reduce((sum, m) => sum + m.actions.length, 0);

/** Every catalog action enabled — used for `admin` defaults and resets. */
export const buildFullAccessForCatalog = (): Record<string, Record<string, boolean>> => {
  const o: Record<string, Record<string, boolean>> = {};
  for (const mod of PERMISSION_CATALOG) {
    const actions: Record<string, boolean> = {};
    for (const act of mod.actions) {
      actions[act.key] = true;
    }
    o[mod.moduleKey] = actions;
  }
  return o;
};

/** Default grants matching the standard Enroll admin matrix (university = no admin workspace access by default). */
export const DEFAULT_PERMISSION_MATRIX: Record<UserRole, Record<string, Record<string, boolean>>> = {
  student: {
    applications: { view: true, create: true, edit: true, approve: false },
    users: { view: false, create: false, edit: false, delete: false },
    commission_slabs: { view: false, create: false, edit: false, delete: false },
    subscriptions: { view: false, create: false, edit: false, delete: false },
    deadlines: { view: false, create: false, edit: false, delete: false },
    payments: { view: false, create: false, edit: false, approve: false },
    agent_ranking: { view: false, approve: false },
    roles_permissions: { view: false, edit: false },
  },
  agent: {
    applications: { view: true, create: true, edit: true, approve: false },
    users: { view: false, create: false, edit: false, delete: false },
    commission_slabs: { view: true, create: false, edit: false, delete: false },
    subscriptions: { view: false, create: false, edit: false, delete: false },
    deadlines: { view: true, create: false, edit: false, delete: false },
    payments: { view: true, create: true, edit: false, approve: false },
    agent_ranking: { view: true, approve: false },
    roles_permissions: { view: false, edit: false },
  },
  admin: buildFullAccessForCatalog(),
  university: {
    applications: { view: true, create: false, edit: false, approve: false },
    users: { view: false, create: false, edit: false, delete: false },
    commission_slabs: { view: false, create: false, edit: false, delete: false },
    subscriptions: { view: false, create: false, edit: false, delete: false },
    deadlines: { view: false, create: false, edit: false, delete: false },
    payments: { view: false, create: false, edit: false, approve: false },
    agent_ranking: { view: false, approve: false },
    roles_permissions: { view: false, edit: false },
  },
};
