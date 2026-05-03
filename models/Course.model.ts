import { Model, DataTypes, Sequelize } from 'sequelize';

export default (sequelize: Sequelize) => {
  class Course extends Model {
    public id!: number;
    public universityId!: number;
    public courseName!: string;
    public degree!: string;
    public fee!: number;
    public duration!: string;
    public readonly createdAt!: Date;
    public readonly updatedAt!: Date;

    static associate(models: any) {
      Course.belongsTo(models.University, { foreignKey: 'universityId', as: 'university' });
      Course.hasMany(models.Application, { foreignKey: 'courseId', as: 'applications' });
      Course.hasMany(models.Deadline, { foreignKey: 'courseId', as: 'deadlines', onDelete: 'CASCADE' });
    }
  }

  Course.init(
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      universityId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'universities', key: 'id' },
        onDelete: 'CASCADE',
      },
      courseName: { type: DataTypes.STRING, allowNull: false },
      degree: { type: DataTypes.STRING, allowNull: false },
      fee: { type: DataTypes.FLOAT, allowNull: false },
      duration: { type: DataTypes.STRING, allowNull: false },
    },
    {
      sequelize,
      modelName: 'Course',
      tableName: 'courses',
      timestamps: true,
    },
  );

  return Course;
};
