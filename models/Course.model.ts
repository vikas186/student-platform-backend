import { Model, DataTypes, Sequelize } from 'sequelize';

export default (sequelize: Sequelize) => {
  class Course extends Model {
    declare id: number;
    declare universityId: number;
    declare courseName: string;
    declare degree: string;
    declare fee: number;
    declare duration: string;
    /** Optional structured admission requirements (IELTS, %, work experience, etc.). */
    declare admissionRequirements: Record<string, unknown> | null;
    declare readonly createdAt: Date;
    declare readonly updatedAt: Date;

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
      courseName: { type: DataTypes.TEXT, allowNull: false },
      degree: { type: DataTypes.STRING(255), allowNull: false },
      fee: { type: DataTypes.FLOAT, allowNull: false },
      duration: { type: DataTypes.STRING(255), allowNull: false },
      admissionRequirements: {
        type: DataTypes.JSONB,
        allowNull: true,
        field: 'admission_requirements',
      },
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
