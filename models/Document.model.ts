import { Model, DataTypes, Sequelize } from 'sequelize';

export const DOCUMENT_STATUSES = ['pending', 'verified', 'rejected'] as const;

export default (sequelize: Sequelize) => {
  class Document extends Model {
    public id!: string;
    public studentProfileId!: number;
    public applicationId?: string | null;
    public fileUrl!: string;
    public originalFileName!: string;
    public type!: string;
    public fileSize!: number;
    public status!: (typeof DOCUMENT_STATUSES)[number];
    public readonly createdAt!: Date;
    public readonly updatedAt!: Date;

    static associate(models: any) {
      Document.belongsTo(models.StudentProfile, { foreignKey: 'studentProfileId', as: 'studentProfile', onDelete: 'CASCADE' });
      Document.belongsTo(models.Application, { foreignKey: 'applicationId', as: 'application', onDelete: 'CASCADE' });
    }
  }

  Document.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      studentProfileId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'student_profiles', key: 'id' },
        onDelete: 'CASCADE',
      },
      applicationId: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: 'applications', key: 'id' },
        onDelete: 'CASCADE',
      },
      fileUrl: { type: DataTypes.STRING, allowNull: false },
      originalFileName: { type: DataTypes.STRING, allowNull: false },
      type: { type: DataTypes.STRING, allowNull: false },
      fileSize: { type: DataTypes.INTEGER, allowNull: false },
      status: {
        type: DataTypes.ENUM(...DOCUMENT_STATUSES),
        allowNull: false,
        defaultValue: 'pending',
      },
    },
    {
      sequelize,
      modelName: 'Document',
      tableName: 'documents',
      timestamps: true,
    },
  );

  return Document;
};
