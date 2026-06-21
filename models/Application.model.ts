import { Model, DataTypes, Sequelize, QueryTypes } from 'sequelize';
import { formatApplicationNumber } from '../utils/applicationRef';

export const APPLICATION_STATUSES = [
  'draft',
  'submitted',
  'under_review',
  'approved',
  'rejected',
  'offer_generated',
  'deposit_paid',
  'visa_approved',
  'enrolled',
] as const;

export default (sequelize: Sequelize) => {
  class Application extends Model {
    declare id: string;
    declare studentId: number;
    declare agentId: number | null;
    declare courseId: number | null;
    declare universityName: string | null;
    declare programName: string | null;
    declare notes: string | null;
    declare country: string | null;
    /** Unique display reference, e.g. APP-10241 (assigned by DB sequence on create) */
    declare applicationNumber: string;
    /** Agent portal: optional projected commission for UI tables */
    declare commissionAmount: unknown;
    declare commissionSlab: string | null;
    /** Multi-step wizard / UI-only payload (steps 1–4, draft fields) */
    declare metadata: Record<string, unknown> | null;
    declare status: (typeof APPLICATION_STATUSES)[number];
    declare readonly createdAt: Date;
    declare readonly updatedAt: Date;

    static associate(models: any) {
      Application.belongsTo(models.StudentProfile, { foreignKey: 'studentId', as: 'studentProfile' });
      Application.belongsTo(models.AgentProfile, { foreignKey: 'agentId', as: 'agentProfile' });
      Application.belongsTo(models.Course, { foreignKey: 'courseId', as: 'course' });
      Application.hasMany(models.Document, { foreignKey: 'applicationId', as: 'documents', onDelete: 'CASCADE' });
      Application.hasOne(models.OfferLetter, { foreignKey: 'applicationId', as: 'offerLetter', onDelete: 'CASCADE' });
      Application.hasMany(models.Payment, { foreignKey: 'applicationId', as: 'payments', onDelete: 'SET NULL' });
    }
  }

  /** Sequelize may run validation twice per save; allocate from the sequence only once. */
  const applicationNumberAllocatedForInstance = new WeakSet<Application>();

  Application.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      studentId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'student_profiles', key: 'id' },
        onDelete: 'CASCADE',
      },
      agentId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: 'agent_profiles', key: 'id' },
        onDelete: 'SET NULL',
      },
      courseId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: { model: 'courses', key: 'id' },
        onDelete: 'SET NULL',
      },
      universityName: { type: DataTypes.STRING, allowNull: true },
      programName: { type: DataTypes.STRING, allowNull: true },
      notes: { type: DataTypes.TEXT, allowNull: true },
      country: { type: DataTypes.STRING, allowNull: true },
      applicationNumber: {
        type: DataTypes.STRING(32),
        allowNull: false,
        unique: true,
      },
      commissionAmount: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: true,
      },
      commissionSlab: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      metadata: { type: DataTypes.JSONB, allowNull: true },
      status: {
        type: DataTypes.ENUM(...APPLICATION_STATUSES),
        allowNull: false,
        defaultValue: 'draft',
      },
    },
    {
      sequelize,
      modelName: 'Application',
      tableName: 'applications',
      timestamps: true,
      hooks: {
        // Must run before Sequelize allowNull validation for applicationNumber.
        // New rows always get the next value from application_number_seq so numbers stay unique
        // (caller-supplied values are ignored — avoids duplicates from crafted payloads).
        beforeValidate: async (instance: Application) => {
          if (!instance.isNewRecord) {
            return;
          }
          if (applicationNumberAllocatedForInstance.has(instance)) {
            return;
          }
          applicationNumberAllocatedForInstance.add(instance);

          const rows = (await sequelize.query(`SELECT nextval('application_number_seq') AS n`, {
            type: QueryTypes.SELECT,
          })) as { n: string | number }[];
          const raw = rows[0]?.n;
          if (raw === null || raw === undefined) {
            throw new Error('Failed to allocate application_number_seq');
          }
          const num = typeof raw === 'string' ? parseInt(raw, 10) : Number(raw);
          instance.setDataValue('applicationNumber', formatApplicationNumber(num));
        },
        beforeUpdate: (instance: Application) => {
          if (instance.changed('applicationNumber')) {
            instance.setDataValue('applicationNumber', instance.previous('applicationNumber'));
          }
        },
      },
    },
  );

  return Application;
};
