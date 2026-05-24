import { Model, DataTypes, Sequelize } from 'sequelize';
export const FEE_CLEANING_STATUSES = ['high_quality', 'needs_review', 'rejected', 'duplicate'] as const;
export type FeeCleaningStatus = (typeof FEE_CLEANING_STATUSES)[number];

export default (sequelize: Sequelize) => {
  class ScrapeFee extends Model {
    public id!: string;
    public jobId!: string;
    public rawBatchId!: string | null;
    public source!: string;
    public country!: string | null;
    public studyLevel!: string | null;
    public tuitionFee!: string | null;
    public livingCost!: string | null;
    public accommodationCost!: string | null;
    public currency!: string | null;
    public description!: string | null;
    public sourceUrl!: string | null;
    public qualityScore!: number;
    public cleaningStatus!: FeeCleaningStatus | null;
    public isDuplicate!: boolean;
    public duplicateOf!: string | null;
    public recordStatus!: string;
    public scrapedAt!: Date;
    public readonly createdAt!: Date;
    public readonly updatedAt!: Date;

    static associate(models: any) {
      ScrapeFee.belongsTo(models.ScrapeJob, { foreignKey: 'jobId', as: 'job', onDelete: 'CASCADE' });
      ScrapeFee.belongsTo(models.ScrapeFee, { foreignKey: 'duplicateOf', as: 'duplicateReference', onDelete: 'SET NULL' });
    }
  }

  ScrapeFee.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      jobId: { type: DataTypes.UUID, allowNull: false, field: 'job_id', references: { model: 'scrape_jobs', key: 'id' } },
      rawBatchId: { type: DataTypes.UUID, allowNull: true, field: 'raw_batch_id' },
      source: { type: DataTypes.STRING(128), allowNull: false },
      country: { type: DataTypes.STRING(128), allowNull: true },
      studyLevel: { type: DataTypes.STRING(128), allowNull: true, field: 'study_level' },
      tuitionFee: { type: DataTypes.STRING(256), allowNull: true, field: 'tuition_fee' },
      livingCost: { type: DataTypes.STRING(256), allowNull: true, field: 'living_cost' },
      accommodationCost: { type: DataTypes.STRING(256), allowNull: true, field: 'accommodation_cost' },
      currency: { type: DataTypes.STRING(16), allowNull: true },
      description: { type: DataTypes.TEXT, allowNull: true },
      sourceUrl: { type: DataTypes.STRING(2048), allowNull: true, field: 'source_url' },
      qualityScore: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: 'quality_score' },
      cleaningStatus: { type: DataTypes.STRING(32), allowNull: true, field: 'cleaning_status' },
      isDuplicate: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'is_duplicate' },
      duplicateOf: { type: DataTypes.UUID, allowNull: true, field: 'duplicate_of', references: { model: 'scrape_fees', key: 'id' } },
      recordStatus: { type: DataTypes.STRING(32), allowNull: false, defaultValue: 'cleaned', field: 'record_status' },
      scrapedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: 'scraped_at' },
    },
    { sequelize, modelName: 'ScrapeFee', tableName: 'scrape_fees', timestamps: true },
  );

  return ScrapeFee;
};
