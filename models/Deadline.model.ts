import { Model, DataTypes, Sequelize } from 'sequelize';

export default (sequelize: Sequelize) => {
  class Deadline extends Model {
    declare id: number;
    declare universityId: number;
    declare courseId: number;
    declare deadlineDate: Date;
    /** e.g. Fall 2026 — UI intake label */
    declare intakeLabel: string | null;
    /** { applicationDeadline, scholarshipDeadline, depositDeadline, intakeStart } ISO date strings */
    declare dateMatrix: Record<string, unknown> | null;
    declare createdAt: Date;
    declare updatedAt: Date;

    static associate(models: any) {
      Deadline.belongsTo(models.University, { foreignKey: 'universityId', as: 'university', onDelete: 'CASCADE' });
      Deadline.belongsTo(models.Course, { foreignKey: 'courseId', as: 'course', onDelete: 'CASCADE' });
    }
  }

  Deadline.init(
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      universityId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'universities', key: 'id' },
        onDelete: 'CASCADE',
      },
      courseId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'courses', key: 'id' },
        onDelete: 'CASCADE',
      },
      deadlineDate: { type: DataTypes.DATE, allowNull: false },
      intakeLabel: { type: DataTypes.STRING, allowNull: true },
      dateMatrix: { type: DataTypes.JSONB, allowNull: true },
    },
    {
      sequelize,
      modelName: 'Deadline',
      tableName: 'deadlines',
      timestamps: true,
    },
  );

  return Deadline;
};
