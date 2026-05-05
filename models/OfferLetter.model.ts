import { Model, DataTypes, Sequelize, QueryTypes } from 'sequelize';
import { formatOfferReference } from '../utils/offerRef';

export const OFFER_LETTER_STATUSES = ['pending', 'active', 'signed', 'sent', 'expired'] as const;

export default (sequelize: Sequelize) => {
  class OfferLetter extends Model {
    public id!: number;
    public applicationId!: string;
    public referenceCode!: string;
    public fileUrl?: string | null;
    public signedFileUrl?: string | null;
    public uploadedAt!: Date;
    public status!: (typeof OFFER_LETTER_STATUSES)[number];
    public universityName?: string | null;
    public programName?: string | null;
    public studentDisplayName?: string | null;
    public expiresAt?: Date | null;
    public notes?: string | null;
    public readonly createdAt!: Date;
    public readonly updatedAt!: Date;

    static associate(models: any) {
      OfferLetter.belongsTo(models.Application, { foreignKey: 'applicationId', as: 'application', onDelete: 'CASCADE' });
    }
  }

  OfferLetter.init(
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      referenceCode: {
        type: DataTypes.STRING(24),
        allowNull: false,
        unique: true,
      },
      applicationId: {
        type: DataTypes.UUID,
        allowNull: false,
        unique: true,
        references: { model: 'applications', key: 'id' },
        onDelete: 'CASCADE',
      },
      fileUrl: { type: DataTypes.STRING, allowNull: true },
      signedFileUrl: { type: DataTypes.STRING, allowNull: true },
      uploadedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      status: {
        type: DataTypes.ENUM(...OFFER_LETTER_STATUSES),
        allowNull: false,
        defaultValue: 'pending',
      },
      universityName: { type: DataTypes.STRING, allowNull: true },
      programName: { type: DataTypes.STRING, allowNull: true },
      studentDisplayName: { type: DataTypes.STRING, allowNull: true },
      expiresAt: { type: DataTypes.DATE, allowNull: true },
      notes: { type: DataTypes.TEXT, allowNull: true },
    },
    {
      sequelize,
      modelName: 'OfferLetter',
      tableName: 'offer_letters',
      timestamps: true,
      hooks: {
        // Must run before validation: Sequelize validates (notNull) before `beforeCreate`.
        beforeValidate: async (instance: OfferLetter) => {
          if (!instance.isNewRecord) {
            return;
          }
          if (instance.getDataValue('referenceCode')) {
            return;
          }
          const rows = (await sequelize.query(`SELECT nextval('offer_letter_ref_seq') AS n`, {
            type: QueryTypes.SELECT,
          })) as { n: string | number }[];
          const raw = rows[0]?.n;
          if (raw === null || raw === undefined) {
            throw new Error('Failed to allocate offer_letter_ref_seq');
          }
          const num = typeof raw === 'string' ? parseInt(raw, 10) : Number(raw);
          instance.setDataValue('referenceCode', formatOfferReference(num));
        },
      },
    },
  );

  return OfferLetter;
};
