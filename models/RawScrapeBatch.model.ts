import { Model, DataTypes, Sequelize } from 'sequelize';

export const RAW_BATCH_STATUSES = ['pending_cleaning', 'cleaning', 'cleaned', 'failed'] as const;
export type RawBatchStatus = (typeof RAW_BATCH_STATUSES)[number];

export default (sequelize: Sequelize) => {
  class RawScrapeBatch extends Model {
    public id!: string;
    public jobId!: string;
    public rawBatchId!: string;
    public source!: string;
    public rawPayload!: Record<string, unknown>;
    public rawCourses!: unknown[];
    public rawUniversities!: unknown[];
    public rawFees!: unknown[];
    public rawScholarships!: unknown[];
    public rejectedPages!: unknown[];
    public status!: RawBatchStatus;
    public errorMessage!: string | null;
    public readonly createdAt!: Date;
    public readonly updatedAt!: Date;

    static associate(models: any) {
      RawScrapeBatch.belongsTo(models.ScrapeJob, { foreignKey: 'jobId', as: 'job', onDelete: 'CASCADE' });
    }
  }

  RawScrapeBatch.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      jobId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: 'job_id',
        references: { model: 'scrape_jobs', key: 'id' },
      },
      rawBatchId: { type: DataTypes.UUID, allowNull: false, field: 'raw_batch_id' },
      source: { type: DataTypes.STRING(128), allowNull: false },
      rawPayload: { type: DataTypes.JSONB, allowNull: false, defaultValue: {}, field: 'raw_payload' },
      rawCourses: { type: DataTypes.JSONB, allowNull: false, defaultValue: [], field: 'raw_courses' },
      rawUniversities: { type: DataTypes.JSONB, allowNull: false, defaultValue: [], field: 'raw_universities' },
      rawFees: { type: DataTypes.JSONB, allowNull: false, defaultValue: [], field: 'raw_fees' },
      rawScholarships: { type: DataTypes.JSONB, allowNull: false, defaultValue: [], field: 'raw_scholarships' },
      rejectedPages: { type: DataTypes.JSONB, allowNull: false, defaultValue: [], field: 'rejected_pages' },
      status: {
        type: DataTypes.ENUM(...RAW_BATCH_STATUSES),
        allowNull: false,
        defaultValue: 'pending_cleaning',
      },
      errorMessage: { type: DataTypes.TEXT, allowNull: true, field: 'error_message' },
    },
    { sequelize, modelName: 'RawScrapeBatch', tableName: 'raw_scrape_batches', timestamps: true },
  );

  return RawScrapeBatch;
};
