import { Model, DataTypes, Sequelize } from 'sequelize';

export default (sequelize: Sequelize) => {
  class AgentRanking extends Model {
    public id!: number;
    public agentId!: number;
    public totalApplications!: number;
    public deposits!: number;
    public visaSuccessRate!: number;
    public enrollments!: number;
    public readonly createdAt!: Date;
    public readonly updatedAt!: Date;

    static associate(models: any) {
      AgentRanking.belongsTo(models.AgentProfile, { foreignKey: 'agentId', as: 'agentProfile', onDelete: 'CASCADE' });
    }
  }

  AgentRanking.init(
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      agentId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        unique: true,
        references: { model: 'agent_profiles', key: 'id' },
        onDelete: 'CASCADE',
      },
      totalApplications: { type: DataTypes.INTEGER, defaultValue: 0 },
      deposits: { type: DataTypes.INTEGER, defaultValue: 0 },
      visaSuccessRate: { type: DataTypes.FLOAT, defaultValue: 0 },
      enrollments: { type: DataTypes.INTEGER, defaultValue: 0 },
    },
    {
      sequelize,
      modelName: 'AgentRanking',
      tableName: 'agent_rankings',
      timestamps: true,
    },
  );

  return AgentRanking;
};
