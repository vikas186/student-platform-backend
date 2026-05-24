import { Model, DataTypes, Sequelize } from 'sequelize';
export const SCHOLARSHIP_CLEANING_STATUSES = ['high_quality', 'needs_review', 'rejected', 'duplicate'] as const;
export type ScholarshipCleaningStatus = (typeof SCHOLARSHIP_CLEANING_STATUSES)[number];

export default (sequelize: Sequelize) => {
  class ScrapeScholarship extends Model {
    public id!: string;
    public jobId!: string;
    public rawBatchId!: string | null;
    public source!: string;
    public scholarshipName!: string;
    public universityName!: string | null;
    public country!: string | null;
    public amount!: string | null;
    public eligibility!: string | null;
    public deadline!: string | null;
    public description!: string | null;
    public sourceUrl!: string | null;
    public qualityScore!: number;
    public cleaningStatus!: ScholarshipCleaningStatus | null;
    public isDuplicate!: boolean;
    public duplicateOf!: string | null;
    public recordStatus!: string;
    public aiSummary!: string | null;
    public subjectTags!: string[];
    public scrapedAt!: Date;
    public readonly createdAt!: Date;
    public readonly updatedAt!: Date;

    static associate(models: any) {
      ScrapeScholarship.belongsTo(models.ScrapeJob, { foreignKey: 'jobId', as: 'job', onDelete: 'CASCADE' });
      ScrapeScholarship.belongsTo(models.ScrapeScholarship, {
        foreignKey: 'duplicateOf',
        as: 'duplicateReference',
        onDelete: 'SET NULL',
      });
    }
  }

  ScrapeScholarship.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      jobId: { type: DataTypes.UUID, allowNull: false, field: 'job_id', references: { model: 'scrape_jobs', key: 'id' } },
      rawBatchId: { type: DataTypes.UUID, allowNull: true, field: 'raw_batch_id' },
      source: { type: DataTypes.STRING(128), allowNull: false },
      scholarshipName: { type: DataTypes.STRING(512), allowNull: false, field: 'scholarship_name' },
      universityName: { type: DataTypes.STRING(512), allowNull: true, field: 'university_name' },
      country: { type: DataTypes.STRING(128), allowNull: true },
      amount: { type: DataTypes.STRING(256), allowNull: true },
      eligibility: { type: DataTypes.TEXT, allowNull: true },
      deadline: { type: DataTypes.STRING(128), allowNull: true },
      description: { type: DataTypes.TEXT, allowNull: true },
      sourceUrl: { type: DataTypes.STRING(2048), allowNull: true, field: 'source_url' },
      qualityScore: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: 'quality_score' },
      cleaningStatus: { type: DataTypes.STRING(32), allowNull: true, field: 'cleaning_status' },
      isDuplicate: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'is_duplicate' },
      duplicateOf: { type: DataTypes.UUID, allowNull: true, field: 'duplicate_of', references: { model: 'scrape_scholarships', key: 'id' } },
      recordStatus: { type: DataTypes.STRING(32), allowNull: false, defaultValue: 'cleaned', field: 'record_status' },
      aiSummary: { type: DataTypes.TEXT, allowNull: true, field: 'ai_summary' },
      subjectTags: { type: DataTypes.JSONB, allowNull: false, defaultValue: [], field: 'subject_tags' },
      scrapedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: 'scraped_at' },
    },
    { sequelize, modelName: 'ScrapeScholarship', tableName: 'scrape_scholarships', timestamps: true },
  );

  return ScrapeScholarship;
};
