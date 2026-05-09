import { Model, DataTypes, Sequelize } from 'sequelize';

export default (sequelize: Sequelize) => {
  class UniversityProfile extends Model {
    public id!: number;
    public userId!: string;
    public universityId!: number;
    public jobTitle!: string | null;
    public readonly createdAt!: Date;
    public readonly updatedAt!: Date;

    static associate(models: any) {
      UniversityProfile.belongsTo(models.User, { foreignKey: 'userId', as: 'user', onDelete: 'CASCADE' });
      UniversityProfile.belongsTo(models.University, { foreignKey: 'universityId', as: 'university', onDelete: 'CASCADE' });
    }
  }

  UniversityProfile.init(
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      userId: {
        type: DataTypes.UUID,
        allowNull: false,
        unique: true,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
      },
      universityId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'universities', key: 'id' },
        onDelete: 'CASCADE',
      },
      jobTitle: { type: DataTypes.STRING(200), allowNull: true },
    },
    {
      sequelize,
      modelName: 'UniversityProfile',
      tableName: 'university_profiles',
      timestamps: true,
      indexes: [{ unique: true, fields: ['user_id'] }],
    },
  );

  return UniversityProfile;
};
