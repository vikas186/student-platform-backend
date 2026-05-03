import { Model, DataTypes, Sequelize } from 'sequelize';

export default (sequelize: Sequelize) => {
  class StudentProfile extends Model {
    public id!: number;
    public userId!: string;
    public academicDetails?: Record<string, unknown> | null;
    public preferredCountry?: string | null;
    public targetCountries?: string[] | null;
    public countryOfResidence?: string | null;
    public highestEducation?: string | null;
    public gradeGpa?: string | null;
    /** Counsellor / agency this student is linked to — applications inherit this for the agent portal */
    public agentProfileId?: number | null;
    public readonly createdAt!: Date;
    public readonly updatedAt!: Date;

    static associate(models: any) {
      StudentProfile.belongsTo(models.User, { foreignKey: 'userId', as: 'user', onDelete: 'CASCADE' });
      StudentProfile.belongsTo(models.AgentProfile, { foreignKey: 'agentProfileId', as: 'linkedAgent', onDelete: 'SET NULL' });
      StudentProfile.hasMany(models.Application, { foreignKey: 'studentId', as: 'applications' });
      StudentProfile.hasMany(models.Document, { foreignKey: 'studentProfileId', as: 'documents', onDelete: 'CASCADE' });
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
