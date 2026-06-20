import { Model, DataTypes, Sequelize } from 'sequelize';

export const ACADEMIC_VERIFICATION_STATUSES = [
  'pending',
  'pre_verified',
  'needs_review',
  'approved',
  'rejected',
] as const;

export type AcademicVerificationStatus = (typeof ACADEMIC_VERIFICATION_STATUSES)[number];

export default (sequelize: Sequelize) => {
  class AcademicDocument extends Model {
    public id!: string;
    public userId!: string;
    public documentId?: string | null;
    public documentType!: string;
    public fileUrl?: string | null;
    public fileHash?: string | null;
    public ocrText?: string | null;
    public studentName?: string | null;
    public institutionName?: string | null;
    public degree?: string | null;
    public course?: string | null;
    public passingYear?: string | null;
    public cgpa?: string | null;
    public ocrConfidence?: number | null;
    public verificationStatus!: AcademicVerificationStatus;
    public duplicateOfId?: string | null;
    public reviewNotes?: string | null;
    public readonly createdAt!: Date;
    public readonly updatedAt!: Date;

    static associate(models: any) {
      AcademicDocument.belongsTo(models.User, { foreignKey: 'userId', as: 'user', onDelete: 'CASCADE' });
      AcademicDocument.belongsTo(models.Document, { foreignKey: 'documentId', as: 'document', onDelete: 'SET NULL' });
      AcademicDocument.belongsTo(models.AcademicDocument, {
        foreignKey: 'duplicateOfId',
        as: 'duplicateOf',
        onDelete: 'SET NULL',
      });
    }
  }

  AcademicDocument.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      userId: { type: DataTypes.UUID, allowNull: false, field: 'user_id', references: { model: 'users', key: 'id' } },
      documentId: { type: DataTypes.UUID, allowNull: true, field: 'document_id', references: { model: 'documents', key: 'id' } },
      documentType: { type: DataTypes.TEXT, allowNull: false, field: 'document_type' },
      fileUrl: { type: DataTypes.TEXT, allowNull: true, field: 'file_url' },
      fileHash: { type: DataTypes.TEXT, allowNull: true, field: 'file_hash' },
      ocrText: { type: DataTypes.TEXT, allowNull: true, field: 'ocr_text' },
      studentName: { type: DataTypes.TEXT, allowNull: true, field: 'student_name' },
      institutionName: { type: DataTypes.TEXT, allowNull: true, field: 'institution_name' },
      degree: { type: DataTypes.TEXT, allowNull: true },
      course: { type: DataTypes.TEXT, allowNull: true },
      passingYear: { type: DataTypes.TEXT, allowNull: true, field: 'passing_year' },
      cgpa: { type: DataTypes.TEXT, allowNull: true },
      ocrConfidence: { type: DataTypes.DECIMAL(5, 2), allowNull: true, field: 'ocr_confidence' },
      verificationStatus: { type: DataTypes.STRING(32), allowNull: false, defaultValue: 'pending', field: 'verification_status' },
      duplicateOfId: { type: DataTypes.UUID, allowNull: true, field: 'duplicate_of_id' },
      reviewNotes: { type: DataTypes.TEXT, allowNull: true, field: 'review_notes' },
    },
    {
      sequelize,
      modelName: 'AcademicDocument',
      tableName: 'academic_documents',
      timestamps: true,
      underscored: true,
    },
  );

  return AcademicDocument;
};
