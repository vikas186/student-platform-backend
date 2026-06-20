import { Model, DataTypes, Sequelize } from 'sequelize';
import { FINANCIAL_VERIFICATION_STATUSES, type FinancialVerificationStatus } from './BankStatement.model';

export { FINANCIAL_VERIFICATION_STATUSES, type FinancialVerificationStatus };

export default (sequelize: Sequelize) => {
  class ItrDocument extends Model {
    public id!: string;
    public userId!: string;
    public documentId?: string | null;
    public fileUrl?: string | null;
    public fileHash?: string | null;
    public ocrText?: string | null;
    public pan?: string | null;
    public taxpayerName?: string | null;
    public assessmentYear?: string | null;
    public totalIncome?: string | null;
    public ocrConfidence?: number | null;
    public verificationStatus!: FinancialVerificationStatus;
    public reviewNotes?: string | null;
    public readonly createdAt!: Date;
    public readonly updatedAt!: Date;

    static associate(models: any) {
      ItrDocument.belongsTo(models.User, { foreignKey: 'userId', as: 'user', onDelete: 'CASCADE' });
      ItrDocument.belongsTo(models.Document, { foreignKey: 'documentId', as: 'document', onDelete: 'SET NULL' });
    }
  }

  ItrDocument.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      userId: { type: DataTypes.UUID, allowNull: false, field: 'user_id', references: { model: 'users', key: 'id' } },
      documentId: { type: DataTypes.UUID, allowNull: true, field: 'document_id', references: { model: 'documents', key: 'id' } },
      fileUrl: { type: DataTypes.TEXT, allowNull: true, field: 'file_url' },
      fileHash: { type: DataTypes.TEXT, allowNull: true, field: 'file_hash' },
      ocrText: { type: DataTypes.TEXT, allowNull: true, field: 'ocr_text' },
      pan: { type: DataTypes.TEXT, allowNull: true },
      taxpayerName: { type: DataTypes.TEXT, allowNull: true, field: 'taxpayer_name' },
      assessmentYear: { type: DataTypes.TEXT, allowNull: true, field: 'assessment_year' },
      totalIncome: { type: DataTypes.TEXT, allowNull: true, field: 'total_income' },
      ocrConfidence: { type: DataTypes.DECIMAL(5, 2), allowNull: true, field: 'ocr_confidence' },
      verificationStatus: { type: DataTypes.STRING(32), allowNull: false, defaultValue: 'pending', field: 'verification_status' },
      reviewNotes: { type: DataTypes.TEXT, allowNull: true, field: 'review_notes' },
    },
    {
      sequelize,
      modelName: 'ItrDocument',
      tableName: 'itr_documents',
      timestamps: true,
      underscored: true,
    },
  );

  return ItrDocument;
};
