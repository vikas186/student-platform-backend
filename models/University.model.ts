import { Model, DataTypes, Sequelize } from 'sequelize';

export default (sequelize: Sequelize) => {
  class University extends Model {
    public id!: number;
    public name!: string;
    public country!: string;
    public status!: boolean;
    public readonly createdAt!: Date;
    public readonly updatedAt!: Date;

    static associate(models: any) {
      University.hasMany(models.Course, { foreignKey: 'universityId', as: 'courses', onDelete: 'CASCADE' });
      University.hasMany(models.Deadline, { foreignKey: 'universityId', as: 'deadlines', onDelete: 'CASCADE' });
      University.hasMany(models.Commission, { foreignKey: 'universityId', as: 'commissions', onDelete: 'CASCADE' });
    }
  }

  University.init(
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      name: { type: DataTypes.STRING, allowNull: false },
      country: { type: DataTypes.STRING, allowNull: false },
      status: { type: DataTypes.BOOLEAN, defaultValue: true },
    },
    {
      sequelize,
      modelName: 'University',
      tableName: 'universities',
      timestamps: true,
    },
  );

  return University;
};
