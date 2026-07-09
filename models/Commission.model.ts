import { Model, DataTypes, Sequelize } from 'sequelize';

export default (sequelize: Sequelize) => {
  class Commission extends Model {
    declare id: number;
    declare universityId: number;
    declare percentage: number;
    declare slabDetails: string | null;
    declare createdAt: Date;
    declare updatedAt: Date;

    static associate(models: any) {
      Commission.belongsTo(models.University, { foreignKey: 'universityId', as: 'university', onDelete: 'CASCADE' });
    }
  }

  Commission.init(
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      universityId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'universities', key: 'id' },
        onDelete: 'CASCADE',
      },
      percentage: { type: DataTypes.FLOAT, allowNull: false },
      slabDetails: { type: DataTypes.TEXT, allowNull: true },
    },
    {
      sequelize,
      modelName: 'Commission',
      tableName: 'commissions',
      timestamps: true,
    },
  );

  return Commission;
};
