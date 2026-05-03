import { Model, DataTypes, Sequelize } from 'sequelize';

export default (sequelize: Sequelize) => {
  class ActivityLog extends Model {
    public id!: number;
    public userId?: string | null;
    public action!: string;
    public entityType!: string;
    public entityId!: number;
    public metadata?: Record<string, unknown> | null;
    public readonly createdAt!: Date;
    public readonly updatedAt!: Date;

    static associate(models: any) {
      ActivityLog.belongsTo(models.User, { foreignKey: 'userId', as: 'user', onDelete: 'SET NULL' });
    }
  }

  ActivityLog.init(
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      userId: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onDelete: 'SET NULL',
      },
      action: { type: DataTypes.STRING, allowNull: false },
      entityType: { type: DataTypes.STRING, allowNull: false },
      entityId: { type: DataTypes.INTEGER, allowNull: false },
      metadata: { type: DataTypes.JSONB, allowNull: true },
    },
    {
      sequelize,
      modelName: 'ActivityLog',
      tableName: 'activity_logs',
      timestamps: true,
    },
  );

  return ActivityLog;
};
