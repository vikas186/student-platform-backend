import { Model, DataTypes, Sequelize } from 'sequelize';

export const PASSPORT_VERIFICATION_STATUSES = [
  'pending',
  'verified',
  'needs_review',
  'rejected',
] as const;

export type PassportVerificationStatus = (typeof PASSPORT_VERIFICATION_STATUSES)[number];

export default (sequelize: Sequelize) => {
  class PassportVerification extends Model {
    public id!: string;
    public userId!: string;
    public documentId?: string | null;
    public verificationSessionId?: string | null;
    public verificationId?: string | null;
    public status!: PassportVerificationStatus;
    public confidenceScore?: number | null;
    public passportNumber?: string | null;
    public fullName?: string | null;
    public nationality?: string | null;
    public dateOfBirth?: string | null;
    public rawResponse?: Record<string, unknown> | null;
    public readonly createdAt!: Date;
    public readonly updatedAt!: Date;

    static associate(models: any) {
      PassportVerification.belongsTo(models.User, { foreignKey: 'userId', as: 'user', onDelete: 'CASCADE' });
      PassportVerification.belongsTo(models.Document, { foreignKey: 'documentId', as: 'document', onDelete: 'SET NULL' });
      PassportVerification.belongsTo(models.VerificationSession, {
        foreignKey: 'verificationSessionId',
        as: 'verificationSession',
        onDelete: 'SET NULL',
      });
    }
  }

  PassportVerification.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      userId: { type: DataTypes.UUID, allowNull: false, field: 'user_id', references: { model: 'users', key: 'id' } },
      documentId: { type: DataTypes.UUID, allowNull: true, field: 'document_id', references: { model: 'documents', key: 'id' } },
      verificationSessionId: {
        type: DataTypes.UUID,
        allowNull: true,
        field: 'verification_session_id',
        references: { model: 'verification_sessions', key: 'id' },
      },
      verificationId: { type: DataTypes.TEXT, allowNull: true, field: 'verification_id' },
      status: { type: DataTypes.STRING(32), allowNull: false, defaultValue: 'pending' },
      confidenceScore: { type: DataTypes.DECIMAL(5, 2), allowNull: true, field: 'confidence_score' },
      passportNumber: { type: DataTypes.TEXT, allowNull: true, field: 'passport_number' },
      fullName: { type: DataTypes.TEXT, allowNull: true, field: 'full_name' },
      nationality: { type: DataTypes.TEXT, allowNull: true },
      dateOfBirth: { type: DataTypes.DATEONLY, allowNull: true, field: 'date_of_birth' },
      rawResponse: { type: DataTypes.JSONB, allowNull: true, field: 'raw_response' },
    },
    {
      sequelize,
      modelName: 'PassportVerification',
      tableName: 'passport_verifications',
      timestamps: true,
      underscored: true,
    },
  );

  return PassportVerification;
};
