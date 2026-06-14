import { Model, DataTypes, Sequelize } from 'sequelize';

export default (sequelize: Sequelize) => {
  class CounsellorAvailability extends Model {
    public id!: number;
    public adminUserId!: string;
    public dayOfWeek!: number;
    public startTime!: string;
    public endTime!: string;
    public timezone!: string;
    public readonly createdAt!: Date;
    public readonly updatedAt!: Date;

    static associate(models: any) {
      CounsellorAvailability.belongsTo(models.User, { foreignKey: 'adminUserId', as: 'admin', onDelete: 'CASCADE' });
    }
  }

  CounsellorAvailability.init(
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      adminUserId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: 'admin_user_id',
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
      },
      dayOfWeek: { type: DataTypes.SMALLINT, allowNull: false, field: 'day_of_week' },
      startTime: { type: DataTypes.TIME, allowNull: false, field: 'start_time' },
      endTime: { type: DataTypes.TIME, allowNull: false, field: 'end_time' },
      timezone: { type: DataTypes.STRING(64), allowNull: false, defaultValue: 'Asia/Kolkata' },
    },
    {
      sequelize,
      modelName: 'CounsellorAvailability',
      tableName: 'counsellor_availability',
      timestamps: true,
    },
  );

  return CounsellorAvailability;
};
