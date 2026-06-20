import { Model, DataTypes, Sequelize } from 'sequelize';

export const VERIFICATION_AUDIT_ACTIONS = [
  'approve',
  'reject',
  'request_resubmission',
  'auto_pre_verified',
  'auto_financial_verified',
  'auto_needs_review',
  'webhook_update',
  'ocr_processed',
] as const;

export type VerificationAuditAction = (typeof VERIFICATION_AUDIT_ACTIONS)[number];

export const VERIFICATION_ENTITY_TYPES = ['passport', 'academic', 'bank', 'itr'] as const;
export type VerificationEntityType = (typeof VERIFICATION_ENTITY_TYPES)[number];

export default (sequelize: Sequelize) => {
  class VerificationAuditLog extends Model {
    public id!: string;
    public entityType!: VerificationEntityType;
    public entityId!: string;
    public action!: VerificationAuditAction;
    public actorUserId?: string | null;
    public notes?: string | null;
    public metadata?: Record<string, unknown> | null;
    public readonly createdAt!: Date;

    static associate(models: any) {
      VerificationAuditLog.belongsTo(models.User, { foreignKey: 'actorUserId', as: 'actor', onDelete: 'SET NULL' });
    }
  }

  VerificationAuditLog.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      entityType: { type: DataTypes.STRING(32), allowNull: false, field: 'entity_type' },
      entityId: { type: DataTypes.UUID, allowNull: false, field: 'entity_id' },
      action: { type: DataTypes.STRING(64), allowNull: false },
      actorUserId: { type: DataTypes.UUID, allowNull: true, field: 'actor_user_id', references: { model: 'users', key: 'id' } },
      notes: { type: DataTypes.TEXT, allowNull: true },
      metadata: { type: DataTypes.JSONB, allowNull: true },
      createdAt: { type: DataTypes.DATE, allowNull: false, field: 'created_at', defaultValue: DataTypes.NOW },
    },
    {
      sequelize,
      modelName: 'VerificationAuditLog',
      tableName: 'verification_audit_log',
      timestamps: false,
      underscored: true,
    },
  );

  return VerificationAuditLog;
};
