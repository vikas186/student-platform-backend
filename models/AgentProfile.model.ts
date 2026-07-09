import { Model, DataTypes, Sequelize } from 'sequelize';

export const AGENT_AGREEMENT_STATUSES = ['pending', 'submitted', 'approved', 'rejected'] as const;
export type AgentAgreementStatus = (typeof AGENT_AGREEMENT_STATUSES)[number];

export default (sequelize: Sequelize) => {
  class AgentProfile extends Model {
    declare id: number;
    declare userId: string;
    declare agencyName: string;
    declare primaryMarket: string | null;
    declare logoUrl: string | null;
    declare subscriptionPlanId: number | null;
    /** Onboarding partnership agreement workflow (mirrors `University.countersignedContractUrl`). */
    declare agreementStatus: AgentAgreementStatus;
    declare signedAgreementUrl: string | null;
    declare agreementSentAt: Date | null;
    declare agreementEmailSentAt: Date | null;
    declare agreementUploadedAt: Date | null;
    declare agreementApprovedAt: Date | null;
    declare agreementApprovedByUserId: string | null;
    declare agreementRejectionReason: string | null;
    declare readonly createdAt: Date;
    declare readonly updatedAt: Date;

    static associate(models: any) {
      AgentProfile.belongsTo(models.User, { foreignKey: 'userId', as: 'user', onDelete: 'CASCADE' });
      AgentProfile.belongsTo(models.User, {
        foreignKey: 'agreementApprovedByUserId',
        as: 'agreementApprovedBy',
        onDelete: 'SET NULL',
      });
      AgentProfile.belongsTo(models.SubscriptionPlan, { foreignKey: 'subscriptionPlanId', as: 'subscriptionPlan' });
      AgentProfile.hasMany(models.StudentProfile, { foreignKey: 'agentProfileId', as: 'linkedStudents', onDelete: 'SET NULL' });
      AgentProfile.hasMany(models.Application, { foreignKey: 'agentId', as: 'applications' });
      AgentProfile.hasMany(models.Payment, { foreignKey: 'agentProfileId', as: 'payments', onDelete: 'SET NULL' });
      AgentProfile.hasOne(models.AgentRanking, { foreignKey: 'agentId', as: 'ranking' });
    }
  }

  AgentProfile.init(
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      userId: {
        type: DataTypes.UUID,
        allowNull: false,
        unique: true,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
      },
      agencyName: { type: DataTypes.STRING, allowNull: false },
      primaryMarket: { type: DataTypes.STRING, allowNull: true },
      logoUrl: { type: DataTypes.STRING, allowNull: true },
      subscriptionPlanId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: 'subscription_plans', key: 'id' },
        onDelete: 'SET NULL',
      },
      agreementStatus: {
        type: DataTypes.ENUM(...AGENT_AGREEMENT_STATUSES),
        allowNull: false,
        defaultValue: 'pending',
        field: 'agreement_status',
      },
      signedAgreementUrl: {
        type: DataTypes.STRING(2048),
        allowNull: true,
        field: 'signed_agreement_url',
      },
      agreementSentAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'agreement_sent_at',
      },
      agreementEmailSentAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'agreement_email_sent_at',
      },
      agreementUploadedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'agreement_uploaded_at',
      },
      agreementApprovedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'agreement_approved_at',
      },
      agreementApprovedByUserId: {
        type: DataTypes.UUID,
        allowNull: true,
        field: 'agreement_approved_by_user_id',
        references: { model: 'users', key: 'id' },
        onDelete: 'SET NULL',
      },
      agreementRejectionReason: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: 'agreement_rejection_reason',
      },
    },
    {
      sequelize,
      modelName: 'AgentProfile',
      tableName: 'agent_profiles',
      timestamps: true,
    },
  );

  return AgentProfile;
};
