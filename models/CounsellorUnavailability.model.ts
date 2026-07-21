import { Model, DataTypes, Sequelize } from 'sequelize';

export default (sequelize: Sequelize) => {
  class CounsellorUnavailability extends Model {
    declare id: number;
    declare adminUserId: string;
    declare startsAt: Date;
    declare endsAt: Date;
    declare reason: string | null;
    declare readonly createdAt: Date;
    declare readonly updatedAt: Date;

    static associate(models: any) {
      CounsellorUnavailability.belongsTo(models.User, {
        foreignKey: 'adminUserId',
        as: 'admin',
        onDelete: 'CASCADE',
      });
    }
  }

  CounsellorUnavailability.init(
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      adminUserId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: 'admin_user_id',
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
      },
      startsAt: { type: DataTypes.DATE, allowNull: false, field: 'starts_at' },
      endsAt: { type: DataTypes.DATE, allowNull: false, field: 'ends_at' },
      reason: { type: DataTypes.STRING(255), allowNull: true },
    },
    {
      sequelize,
      modelName: 'CounsellorUnavailability',
      tableName: 'counsellor_unavailability',
      timestamps: true,
    },
  );

  return CounsellorUnavailability;
};
