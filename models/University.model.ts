import { Model, DataTypes, Sequelize } from 'sequelize';

export default (sequelize: Sequelize) => {
  class University extends Model {
    declare id: number;
    declare name: string;
    declare country: string;
    declare status: boolean;
    declare agreementPackageReference: string | null;
    declare agreementDispatchedAt: Date | null;
    declare countersignedContractUrl: string | null;
    declare countersignedUploadedAt: Date | null;
    declare countersignedVerifiedAt: Date | null;
    /** USA-style fee matrix from admin catalog upload (UG/PG × Business, STEM, CS). */
    declare programFeeRanges: Record<string, unknown> | null;
    /** Flywire PayEx portal subdomain / payment_destination override for this university. */
    declare flywirePaymentDestination: string | null;
    /** Admissions team inbox — used when admin forwards an approved application pack by email. */
    declare admissionsEmail: string | null;
    declare readonly createdAt: Date;
    declare readonly updatedAt: Date;

    static associate(models: any) {
      University.hasMany(models.Course, { foreignKey: 'universityId', as: 'courses', onDelete: 'CASCADE' });
      University.hasMany(models.Deadline, { foreignKey: 'universityId', as: 'deadlines', onDelete: 'CASCADE' });
      University.hasMany(models.Commission, { foreignKey: 'universityId', as: 'commissions', onDelete: 'CASCADE' });
      University.hasMany(models.UniversityProfile, { foreignKey: 'universityId', as: 'universityProfiles', onDelete: 'CASCADE' });
    }
  }

  University.init(
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      name: { type: DataTypes.STRING, allowNull: false },
      country: { type: DataTypes.STRING, allowNull: false },
      status: { type: DataTypes.BOOLEAN, defaultValue: true },
      agreementPackageReference: {
        type: DataTypes.STRING(120),
        allowNull: true,
        field: 'agreement_package_reference',
      },
      agreementDispatchedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'agreement_dispatched_at',
      },
      countersignedContractUrl: {
        type: DataTypes.STRING(2048),
        allowNull: true,
        field: 'countersigned_contract_url',
      },
      countersignedUploadedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'countersigned_uploaded_at',
      },
      countersignedVerifiedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'countersigned_verified_at',
      },
      programFeeRanges: {
        type: DataTypes.JSONB,
        allowNull: true,
        field: 'program_fee_ranges',
      },
      flywirePaymentDestination: {
        type: DataTypes.STRING(120),
        allowNull: true,
        field: 'flywire_payment_destination',
      },
      admissionsEmail: {
        type: DataTypes.STRING(320),
        allowNull: true,
        field: 'admissions_email',
      },
    },
    {
      sequelize,
      modelName: 'University',
      tableName: 'universities',
      timestamps: true,
    },
  );

  return University;
};
