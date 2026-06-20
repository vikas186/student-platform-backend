import { Model, DataTypes, Sequelize } from 'sequelize';

export const FINANCIAL_VERIFICATION_STATUSES = [
  'pending',
  'financial_verified',
  'needs_review',
  'approved',
  'rejected',
] as const;

export type FinancialVerificationStatus = (typeof FINANCIAL_VERIFICATION_STATUSES)[number];

export default (sequelize: Sequelize) => {
  class BankStatement extends Model {
    public id!: string;
    public userId!: string;
    public documentId?: string | null;
    public fileUrl?: string | null;
    public fileHash?: string | null;
    public ocrText?: string | null;
    public accountHolderName?: string | null;
    public bankName?: string | null;
    public statementDate?: string | null;
    public openingBalance?: string | null;
    public closingBalance?: string | null;
    public ocrConfidence?: number | null;
    public verificationStatus!: FinancialVerificationStatus;
    public reviewNotes?: string | null;
    public readonly createdAt!: Date;
    public readonly updatedAt!: Date;

    static associate(models: any) {
      BankStatement.belongsTo(models.User, { foreignKey: 'userId', as: 'user', onDelete: 'CASCADE' });
      BankStatement.belongsTo(models.Document, { foreignKey: 'documentId', as: 'document', onDelete: 'SET NULL' });
    }
  }

  BankStatement.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      userId: { type: DataTypes.UUID, allowNull: false, field: 'user_id', references: { model: 'users', key: 'id' } },
      documentId: { type: DataTypes.UUID, allowNull: true, field: 'document_id', references: { model: 'documents', key: 'id' } },
      fileUrl: { type: DataTypes.TEXT, allowNull: true, field: 'file_url' },
      fileHash: { type: DataTypes.TEXT, allowNull: true, field: 'file_hash' },
      ocrText: { type: DataTypes.TEXT, allowNull: true, field: 'ocr_text' },
      accountHolderName: { type: DataTypes.TEXT, allowNull: true, field: 'account_holder_name' },
      bankName: { type: DataTypes.TEXT, allowNull: true, field: 'bank_name' },
      statementDate: { type: DataTypes.DATEONLY, allowNull: true, field: 'statement_date' },
      openingBalance: { type: DataTypes.TEXT, allowNull: true, field: 'opening_balance' },
      closingBalance: { type: DataTypes.TEXT, allowNull: true, field: 'closing_balance' },
      ocrConfidence: { type: DataTypes.DECIMAL(5, 2), allowNull: true, field: 'ocr_confidence' },
      verificationStatus: { type: DataTypes.STRING(32), allowNull: false, defaultValue: 'pending', field: 'verification_status' },
      reviewNotes: { type: DataTypes.TEXT, allowNull: true, field: 'review_notes' },
    },
    {
      sequelize,
      modelName: 'BankStatement',
      tableName: 'bank_statements',
      timestamps: true,
      underscored: true,
    },
  );

  return BankStatement;
};
