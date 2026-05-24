import { Model, DataTypes, Sequelize } from 'sequelize';

/** Built-in catalog presets (optional shortcuts). Custom URLs use hostname as source label. */
export const SCRAPE_PRESETS = ['IDP', 'AECC'] as const;
export type ScrapePreset = (typeof SCRAPE_PRESETS)[number];

export const SCRAPE_JOB_STATUSES = [
  'pending',
  'running',
  'scraping',
  'pending_cleaning',
  'cleaning',
  'completed',
  'failed',
] as const;

export type ScrapeJobStatus = (typeof SCRAPE_JOB_STATUSES)[number];

export const SCRAPE_TRIGGERS = ['manual', 'cron'] as const;
export type ScrapeTrigger = (typeof SCRAPE_TRIGGERS)[number];

/** @deprecated use string source label; presets are IDP | AECC */
export type ScrapeSource = ScrapePreset | string;

export default (sequelize: Sequelize) => {
  class ScrapeJob extends Model {
    public id!: string;
    public source!: string;
    public targetUrl!: string;
    public targetName!: string | null;
    public seedUrls!: string[];
    public status!: ScrapeJobStatus;
    public triggerType!: ScrapeTrigger;
    public stats!: Record<string, unknown>;
    public errorMessage!: string | null;
    public startedAt!: Date | null;
    public completedAt!: Date | null;
    public readonly createdAt!: Date;
    public readonly updatedAt!: Date;

    static associate(models: any) {
      ScrapeJob.hasMany(models.RawScrapeBatch, { foreignKey: 'jobId', as: 'rawBatches', onDelete: 'CASCADE' });
      ScrapeJob.hasMany(models.ScrapedCourse, { foreignKey: 'jobId', as: 'courses', onDelete: 'CASCADE' });
      ScrapeJob.hasMany(models.ScrapeUniversity, { foreignKey: 'jobId', as: 'universities', onDelete: 'CASCADE' });
      ScrapeJob.hasMany(models.ScrapeFee, { foreignKey: 'jobId', as: 'fees', onDelete: 'CASCADE' });
      ScrapeJob.hasMany(models.ScrapeScholarship, { foreignKey: 'jobId', as: 'scholarships', onDelete: 'CASCADE' });
      ScrapeJob.hasMany(models.ScrapeRejectedPage, { foreignKey: 'jobId', as: 'rejectedPages', onDelete: 'CASCADE' });
      ScrapeJob.hasMany(models.ScrapeAiMeta, { foreignKey: 'jobId', as: 'aiMeta', onDelete: 'SET NULL' });
    }
  }

  ScrapeJob.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      source: { type: DataTypes.STRING(128), allowNull: false },
      targetUrl: { type: DataTypes.STRING(2048), allowNull: false, field: 'target_url' },
      targetName: { type: DataTypes.STRING(256), allowNull: true, field: 'target_name' },
      seedUrls: { type: DataTypes.JSONB, allowNull: false, defaultValue: [], field: 'seed_urls' },
      status: {
        type: DataTypes.ENUM(...SCRAPE_JOB_STATUSES),
        allowNull: false,
        defaultValue: 'pending',
      },
      triggerType: {
        type: DataTypes.ENUM(...SCRAPE_TRIGGERS),
        allowNull: false,
        defaultValue: 'manual',
        field: 'trigger_type',
      },
      stats: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
      errorMessage: { type: DataTypes.TEXT, allowNull: true, field: 'error_message' },
      startedAt: { type: DataTypes.DATE, allowNull: true, field: 'started_at' },
      completedAt: { type: DataTypes.DATE, allowNull: true, field: 'completed_at' },
    },
    { sequelize, modelName: 'ScrapeJob', tableName: 'scrape_jobs', timestamps: true },
  );

  return ScrapeJob;
};
