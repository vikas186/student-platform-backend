import { Model, DataTypes, Sequelize } from 'sequelize';

export const VERIFICATION_STATUSES = [
  'not_started',
  'pending',
  'verified',
  'rejected',
  'failed',
] as const;

export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

export default (sequelize: Sequelize) => {
  class VerificationSession extends Model {
    public id!: string;
    public userId!: string;
    public diditSessionId!: string;
    public diditVerificationId?: string | null;
    public status!: VerificationStatus;
    public verificationUrl?: string | null;
    public documentType?: string | null;
    public verificationData?: Record<string, unknown> | null;
    public processedWebhookEvents?: string[] | null;
    public readonly createdAt!: Date;
    public readonly updatedAt!: Date;

    static associate(models: any) {
      VerificationSession.belongsTo(models.User, {
        foreignKey: 'userId',
        as: 'user',
        onDelete: 'CASCADE',
      });
    }
  }

  VerificationSession.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      userId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: 'user_id',
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
      },
      diditSessionId: {
        type: DataTypes.TEXT,
        allowNull: false,
        unique: true,
        field: 'didit_session_id',
      },
      diditVerificationId: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: 'didit_verification_id',
      },
      status: {
        type: DataTypes.STRING(32),
        allowNull: false,
        defaultValue: 'pending',
      },
      verificationUrl: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: 'verification_url',
      },
      documentType: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: 'document_type',
      },
      verificationData: {
        type: DataTypes.JSONB,
        allowNull: true,
        field: 'verification_data',
      },
      processedWebhookEvents: {
        type: DataTypes.JSONB,
        allowNull: true,
        defaultValue: [],
        field: 'processed_webhook_events',
      },
    },
    {
      sequelize,
      modelName: 'VerificationSession',
      tableName: 'verification_sessions',
      timestamps: true,
      underscored: true,
    },
  );

  return VerificationSession;
};
