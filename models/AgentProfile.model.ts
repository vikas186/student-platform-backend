import { Model, DataTypes, Sequelize } from 'sequelize';

export default (sequelize: Sequelize) => {
  class AgentProfile extends Model {
    public id!: number;
    public userId!: string;
    public agencyName!: string;
    public primaryMarket?: string | null;
    public logoUrl?: string | null;
    public subscriptionPlanId?: number | null;
    public readonly createdAt!: Date;
    public readonly updatedAt!: Date;

    static associate(models: any) {
      AgentProfile.belongsTo(models.User, { foreignKey: 'userId', as: 'user', onDelete: 'CASCADE' });
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
