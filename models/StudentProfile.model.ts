import { Model, DataTypes, Sequelize } from 'sequelize';

export default (sequelize: Sequelize) => {
  class StudentProfile extends Model {
    declare id: number;
    declare userId: string;
    declare academicDetails: Record<string, unknown> | null;
    declare preferredCountry: string | null;
    declare targetCountries: string[] | null;
    declare countryOfResidence: string | null;
    declare highestEducation: string | null;
    declare gradeGpa: string | null;
    /** Counsellor / agency this student is linked to — applications inherit this for the agent portal */
    declare agentProfileId: number | null;
    /** Sub-admin counsellor allocated by primary admin for counselling + application visibility */
    declare assignedCounsellorUserId: string | null;
    /** When set, student chat/RAG may include concrete university names */
    declare counsellingCompletedAt: Date | null;
    declare readonly createdAt: Date;
    declare readonly updatedAt: Date;

    static associate(models: any) {
      StudentProfile.belongsTo(models.User, { foreignKey: 'userId', as: 'user', onDelete: 'CASCADE' });
      StudentProfile.belongsTo(models.AgentProfile, { foreignKey: 'agentProfileId', as: 'linkedAgent', onDelete: 'SET NULL' });
      StudentProfile.belongsTo(models.User, {
        foreignKey: 'assignedCounsellorUserId',
        as: 'assignedCounsellor',
        onDelete: 'SET NULL',
      });
      StudentProfile.hasMany(models.Application, { foreignKey: 'studentId', as: 'applications' });
      StudentProfile.hasMany(models.Document, { foreignKey: 'studentProfileId', as: 'documents', onDelete: 'CASCADE' });
      StudentProfile.hasMany(models.Appointment, { foreignKey: 'studentProfileId', as: 'appointments', onDelete: 'CASCADE' });
    }
  }

  StudentProfile.init(
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      userId: {
        type: DataTypes.UUID,
        allowNull: false,
        unique: true,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
      },
      academicDetails: { type: DataTypes.JSONB, allowNull: true },
      preferredCountry: { type: DataTypes.STRING, allowNull: true },
      targetCountries: { type: DataTypes.JSONB, allowNull: true },
      countryOfResidence: { type: DataTypes.STRING, allowNull: true },
      highestEducation: { type: DataTypes.STRING, allowNull: true },
      gradeGpa: { type: DataTypes.STRING, allowNull: true },
      agentProfileId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: 'agent_profiles', key: 'id' },
        onDelete: 'SET NULL',
      },
      assignedCounsellorUserId: {
        type: DataTypes.UUID,
        allowNull: true,
        field: 'assigned_counsellor_user_id',
        references: { model: 'users', key: 'id' },
        onDelete: 'SET NULL',
      },
      counsellingCompletedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'counselling_completed_at',
      },
    },
    {
      sequelize,
      modelName: 'StudentProfile',
      tableName: 'student_profiles',
      timestamps: true,
    },
  );

  return StudentProfile;
};
