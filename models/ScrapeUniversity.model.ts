import { Model, DataTypes, Sequelize } from 'sequelize';
export const UNIVERSITY_CLEANING_STATUSES = ['high_quality', 'needs_review', 'rejected', 'duplicate'] as const;
export type UniversityCleaningStatus = (typeof UNIVERSITY_CLEANING_STATUSES)[number];

export default (sequelize: Sequelize) => {
  class ScrapeUniversity extends Model {
    public id!: string;
    public jobId!: string;
    public rawBatchId!: string | null;
    public source!: string;
    public universityName!: string;
    public country!: string | null;
    public city!: string | null;
    public ranking!: string | null;
    public overview!: string | null;
    public websiteUrl!: string | null;
    public sourceUrl!: string | null;
    public logoUrl!: string | null;
    public faculties!: string[];
    public departments!: string[];
    public popularCourses!: string[];
    public qualityScore!: number;
    public cleaningStatus!: UniversityCleaningStatus | null;
    public isDuplicate!: boolean;
    public duplicateOf!: string | null;
    public recordStatus!: string;
    public aiSummary!: string | null;
    public subjectTags!: string[];
    public rankingTags!: string[];
    public scrapedAt!: Date;
    public intakes!: string | null;
    public courses!: string | null;
    public costOfStudy!: string | null;
    public scholarships!: string | null;
    public admissionRequirements!: string | null;
    public acceptanceCriteria!: string | null;
    public readonly createdAt!: Date;
    public readonly updatedAt!: Date;

    static associate(models: any) {
      ScrapeUniversity.belongsTo(models.ScrapeJob, { foreignKey: 'jobId', as: 'job', onDelete: 'CASCADE' });
      ScrapeUniversity.belongsTo(models.ScrapeUniversity, {
        foreignKey: 'duplicateOf',
        as: 'duplicateReference',
        onDelete: 'SET NULL',
      });
    }
  }

  ScrapeUniversity.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      jobId: { type: DataTypes.UUID, allowNull: false, field: 'job_id', references: { model: 'scrape_jobs', key: 'id' } },
      rawBatchId: { type: DataTypes.UUID, allowNull: true, field: 'raw_batch_id' },
      source: { type: DataTypes.STRING(128), allowNull: false },
      universityName: { type: DataTypes.STRING(512), allowNull: false, field: 'university_name' },
      country: { type: DataTypes.STRING(128), allowNull: true },
      city: { type: DataTypes.STRING(256), allowNull: true },
      ranking: { type: DataTypes.STRING(128), allowNull: true },
      overview: { type: DataTypes.TEXT, allowNull: true },
      websiteUrl: { type: DataTypes.STRING(2048), allowNull: true, field: 'website_url' },
      sourceUrl: { type: DataTypes.STRING(2048), allowNull: true, field: 'source_url' },
      logoUrl: { type: DataTypes.STRING(2048), allowNull: true, field: 'logo_url' },
      faculties: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
      departments: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
      popularCourses: { type: DataTypes.JSONB, allowNull: false, defaultValue: [], field: 'popular_courses' },
      qualityScore: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: 'quality_score' },
      cleaningStatus: { type: DataTypes.STRING(32), allowNull: true, field: 'cleaning_status' },
      isDuplicate: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'is_duplicate' },
      duplicateOf: { type: DataTypes.UUID, allowNull: true, field: 'duplicate_of', references: { model: 'scrape_universities', key: 'id' } },
      recordStatus: { type: DataTypes.STRING(32), allowNull: false, defaultValue: 'cleaned', field: 'record_status' },
      aiSummary: { type: DataTypes.TEXT, allowNull: true, field: 'ai_summary' },
      subjectTags: { type: DataTypes.JSONB, allowNull: false, defaultValue: [], field: 'subject_tags' },
      rankingTags: { type: DataTypes.JSONB, allowNull: false, defaultValue: [], field: 'ranking_tags' },
      scrapedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: 'scraped_at' },
      intakes: { type: DataTypes.TEXT, allowNull: true },
      courses: { type: DataTypes.TEXT, allowNull: true },
      costOfStudy: { type: DataTypes.TEXT, allowNull: true, field: 'cost_of_study' },
      scholarships: { type: DataTypes.TEXT, allowNull: true },
      admissionRequirements: { type: DataTypes.TEXT, allowNull: true, field: 'admission_requirements' },
      acceptanceCriteria: { type: DataTypes.TEXT, allowNull: true, field: 'acceptance_criteria' },
    },
    { sequelize, modelName: 'ScrapeUniversity', tableName: 'scrape_universities', timestamps: true },
  );

  return ScrapeUniversity;
};
