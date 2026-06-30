import { Model, DataTypes, Sequelize } from 'sequelize';

export default (sequelize: Sequelize) => {
  class ActivityLog extends Model {
    public id!: number;
    public userId?: string | null;
    public fullName?: string | null;
    public email?: string | null;
    public role?: string | null;
    public activity!: string;
    public action!: string;
    public method!: string;
    public endpoint!: string;
    public module!: string;
    public entityId?: string | null;
    public entityName?: string | null;
    public ipAddress?: string | null;
    public userAgent?: string | null;
    public browser?: string | null;
    public os?: string | null;
    public device?: string | null;
    public requestId?: string | null;
    public statusCode!: number;
    public status!: string;
    public errorMessage?: string | null;
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
      fullName: { type: DataTypes.STRING, allowNull: true },
      email: { type: DataTypes.STRING, allowNull: true },
      role: { type: DataTypes.STRING, allowNull: true },
      activity: { type: DataTypes.STRING, allowNull: false },
      action: { type: DataTypes.STRING, allowNull: false },
      method: { type: DataTypes.STRING, allowNull: false },
      endpoint: { type: DataTypes.STRING, allowNull: false },
      module: { type: DataTypes.STRING, allowNull: false },
      entityId: { type: DataTypes.STRING, allowNull: true },
      entityName: { type: DataTypes.STRING, allowNull: true },
      ipAddress: { type: DataTypes.STRING, allowNull: true },
      userAgent: { type: DataTypes.TEXT, allowNull: true },
      browser: { type: DataTypes.STRING, allowNull: true },
      os: { type: DataTypes.STRING, allowNull: true },
      device: { type: DataTypes.STRING, allowNull: true },
      requestId: { type: DataTypes.UUID, allowNull: true },
      statusCode: { type: DataTypes.INTEGER, allowNull: false },
      status: { type: DataTypes.STRING, allowNull: false },
      errorMessage: { type: DataTypes.TEXT, allowNull: true },
      metadata: { type: DataTypes.JSONB, allowNull: true },
    },
    {
      sequelize,
      modelName: 'ActivityLog',
      tableName: 'activity_logs',
      timestamps: true,
      indexes: [
        { fields: ['created_at'] },
        { fields: ['user_id'] },
        { fields: ['role'] },
        { fields: ['activity'] },
        { fields: ['module'] },
      ],
    },
  );

  return ActivityLog;
};
