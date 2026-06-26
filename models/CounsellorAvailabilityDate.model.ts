import { Model, DataTypes, Sequelize } from 'sequelize';

export default (sequelize: Sequelize) => {
  class CounsellorAvailabilityDate extends Model {
    declare id: number;
    declare adminUserId: string;
    declare availabilityDate: string;
    declare startTime: string;
    declare endTime: string;
    declare timezone: string;
    declare readonly createdAt: Date;
    declare readonly updatedAt: Date;

    static associate(models: any) {
      CounsellorAvailabilityDate.belongsTo(models.User, {
        foreignKey: 'adminUserId',
        as: 'admin',
        onDelete: 'CASCADE',
      });
    }
  }

  CounsellorAvailabilityDate.init(
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      adminUserId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: 'admin_user_id',
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
      },
      availabilityDate: {
        type: DataTypes.DATEONLY,
        allowNull: false,
        field: 'availability_date',
      },
      startTime: { type: DataTypes.TIME, allowNull: false, field: 'start_time' },
      endTime: { type: DataTypes.TIME, allowNull: false, field: 'end_time' },
      timezone: { type: DataTypes.STRING(64), allowNull: false, defaultValue: 'Asia/Kolkata' },
    },
    {
      sequelize,
      modelName: 'CounsellorAvailabilityDate',
      tableName: 'counsellor_availability_dates',
      timestamps: true,
    },
  );

  return CounsellorAvailabilityDate;
};
