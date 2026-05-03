import { Model, DataTypes, Sequelize } from 'sequelize';

export default (sequelize: Sequelize) => {
  class SubscriptionPlan extends Model {
    public id!: number;
    public name!: string;
    public price!: number;
    public features?: string | null;
    public readonly createdAt!: Date;
    public readonly updatedAt!: Date;

    static associate(models: any) {
      SubscriptionPlan.hasMany(models.AgentProfile, { foreignKey: 'subscriptionPlanId', as: 'agentProfiles' });
    }
  }

  SubscriptionPlan.init(
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      name: { type: DataTypes.STRING, allowNull: false },
      price: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
      features: { type: DataTypes.TEXT, allowNull: true },
    },
    {
      sequelize,
      modelName: 'SubscriptionPlan',
      tableName: 'subscription_plans',
      timestamps: true,
    },
  );

  return SubscriptionPlan;
};
