import { Model, DataTypes, Sequelize } from 'sequelize';

export const PAYMENT_STATUSES = ['pending', 'success', 'failed'] as const;

export default (sequelize: Sequelize) => {
  class Payment extends Model {
    public id!: number;
    public userId!: string;
    public amount!: number;
    public type!: string;
    public status!: (typeof PAYMENT_STATUSES)[number];
    public applicationId?: string | null;
    public agentProfileId?: number | null;
    public payLink?: string | null;
    public currency!: string;
    public studentEmail?: string | null;
    public gateway?: string | null;
    public gatewayExternalRef?: string | null;
    public gatewayPaymentId?: string | null;
    public readonly createdAt!: Date;
    public readonly updatedAt!: Date;

    static associate(models: any) {
      Payment.belongsTo(models.User, { foreignKey: 'userId', as: 'user', onDelete: 'CASCADE' });
      Payment.belongsTo(models.Application, { foreignKey: 'applicationId', as: 'application', onDelete: 'SET NULL' });
      Payment.belongsTo(models.AgentProfile, { foreignKey: 'agentProfileId', as: 'agentProfile', onDelete: 'SET NULL' });
    }
  }

  Payment.init(
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      userId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
      },
      applicationId: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: 'applications', key: 'id' },
        onDelete: 'SET NULL',
      },
      agentProfileId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: 'agent_profiles', key: 'id' },
        onDelete: 'SET NULL',
      },
      amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
      type: { type: DataTypes.STRING, allowNull: false },
      currency: { type: DataTypes.STRING(8), allowNull: false, defaultValue: 'USD' },
      payLink: { type: DataTypes.TEXT, allowNull: true },
      studentEmail: { type: DataTypes.STRING, allowNull: true },
      gateway: { type: DataTypes.STRING(32), allowNull: true },
      gatewayExternalRef: {
        type: DataTypes.STRING(120),
        allowNull: true,
        field: 'gateway_external_ref',
      },
      gatewayPaymentId: {
        type: DataTypes.STRING(120),
        allowNull: true,
        field: 'gateway_payment_id',
      },
      status: {
        type: DataTypes.ENUM(...PAYMENT_STATUSES),
        allowNull: false,
        defaultValue: 'pending',
      },
    },
    {
      sequelize,
      modelName: 'Payment',
      tableName: 'payments',
      timestamps: true,
    },
  );

  return Payment;
};
