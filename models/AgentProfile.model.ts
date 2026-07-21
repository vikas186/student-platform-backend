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
    /** Stable partner code shown in the portal and stamped on applications (e.g. AGT-00042). */
    declare membershipId: string | null;
    /** Onboarding partnership agreement workflow (mirrors `University.countersignedContractUrl`). */
    declare agreementStatus: AgentAgreementStatus;
    declare signedAgreementUrl: string | null;
    declare agreementSentAt: Date | null;
    declare agreementEmailSentAt: Date | null;
    declare agreementReminder1SentAt: Date | null;
    declare agreementReminder2SentAt: Date | null;
    declare agreementReminder3SentAt: Date | null;
    declare agreementReminder4SentAt: Date | null;
    declare agreementUploadedAt: Date | null;
    declare agreementApprovedAt: Date | null;
    declare agreementApprovedByUserId: string | null;
    declare agreementRejectionReason: string | null;
    /** Staff accounts point at the owner agency profile; null = agency owner. */
    declare parentAgentProfileId: number | null;
    declare canViewCommission: boolean;
    declare canViewDeposits: boolean;
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
      AgentProfile.belongsTo(models.AgentProfile, {
        foreignKey: 'parentAgentProfileId',
        as: 'parentAgency',
        onDelete: 'CASCADE',
      });
      AgentProfile.hasMany(models.AgentProfile, {
        foreignKey: 'parentAgentProfileId',
        as: 'staffMembers',
        onDelete: 'CASCADE',
      });
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
      membershipId: {
        type: DataTypes.STRING(32),
        allowNull: true,
        unique: true,
        field: 'membership_id',
      },
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
      agreementReminder1SentAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'agreement_reminder_1_sent_at',
      },
      agreementReminder2SentAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'agreement_reminder_2_sent_at',
      },
      agreementReminder3SentAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'agreement_reminder_3_sent_at',
      },
      agreementReminder4SentAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'agreement_reminder_4_sent_at',
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
      parentAgentProfileId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: 'parent_agent_profile_id',
        references: { model: 'agent_profiles', key: 'id' },
        onDelete: 'CASCADE',
      },
      canViewCommission: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        field: 'can_view_commission',
      },
      canViewDeposits: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        field: 'can_view_deposits',
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
