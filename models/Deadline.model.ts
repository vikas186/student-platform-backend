import { Model, DataTypes, Sequelize } from 'sequelize';

export default (sequelize: Sequelize) => {
  class Deadline extends Model {
    public id!: number;
    public universityId!: number;
    public courseId!: number;
    public deadlineDate!: Date;
    /** e.g. Fall 2026 — UI intake label */
    public intakeLabel?: string | null;
    /** { applicationDeadline, scholarshipDeadline, depositDeadline, intakeStart } ISO date strings */
    public dateMatrix?: Record<string, unknown> | null;
    public readonly createdAt!: Date;
    public readonly updatedAt!: Date;

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
