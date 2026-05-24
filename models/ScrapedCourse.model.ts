import { Model, DataTypes, Sequelize } from 'sequelize';

export const COURSE_CLEANING_STATUSES = [
  'high_quality',
  'needs_review',
  'low_quality',
  'rejected',
  'duplicate',
] as const;

export type CourseCleaningStatus = (typeof COURSE_CLEANING_STATUSES)[number];

export default (sequelize: Sequelize) => {
  class ScrapedCourse extends Model {
    public id!: string;
    public jobId!: string;
    public rawBatchId!: string | null;
    public source!: string;
    public universityName!: string;
    public courseName!: string;
    public country!: string | null;
    public city!: string | null;
    public studyLevel!: string | null;
    public duration!: string | null;
    public tuitionFee!: string | null;
    public intake!: string | null;
    public ieltsRequirement!: string | null;
    public academicRequirement!: string | null;
    public applicationFee!: string | null;
    public scholarship!: string | null;
    public courseUrl!: string | null;
    public normalizedTuition!: Record<string, unknown> | null;
    public normalizedDuration!: Record<string, unknown> | null;
    public normalizedIntakes!: string[] | null;
    public normalizedRequirements!: Record<string, unknown> | null;
    public qualityScore!: number;
    public cleaningStatus!: CourseCleaningStatus | null;
    public isDuplicate!: boolean;
    public duplicateOf!: string | null;
    public recordStatus!: string;
    public aiSummary!: string | null;
    public subjectTags!: string[];
    public careerTags!: string[];
    public scrapedAt!: Date;
    public readonly createdAt!: Date;
    public readonly updatedAt!: Date;

    static associate(models: any) {
      ScrapedCourse.belongsTo(models.ScrapeJob, { foreignKey: 'jobId', as: 'job', onDelete: 'CASCADE' });
      ScrapedCourse.belongsTo(models.ScrapedCourse, {
        foreignKey: 'duplicateOf',
        as: 'duplicateReference',
        onDelete: 'SET NULL',
      });
    }
  }

  ScrapedCourse.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      jobId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: 'job_id',
        references: { model: 'scrape_jobs', key: 'id' },
      },
      rawBatchId: { type: DataTypes.UUID, allowNull: true, field: 'raw_batch_id' },
      source: { type: DataTypes.STRING(128), allowNull: false },
      universityName: { type: DataTypes.STRING(512), allowNull: false, field: 'university_name' },
      courseName: { type: DataTypes.STRING(512), allowNull: false, field: 'course_name' },
      country: { type: DataTypes.STRING(128), allowNull: true },
      city: { type: DataTypes.STRING(256), allowNull: true },
      studyLevel: { type: DataTypes.STRING(128), allowNull: true, field: 'study_level' },
      duration: { type: DataTypes.STRING(128), allowNull: true },
      tuitionFee: { type: DataTypes.STRING(256), allowNull: true, field: 'tuition_fee' },
      intake: { type: DataTypes.STRING(256), allowNull: true },
      ieltsRequirement: { type: DataTypes.TEXT, allowNull: true, field: 'ielts_requirement' },
      academicRequirement: { type: DataTypes.TEXT, allowNull: true, field: 'academic_requirement' },
      applicationFee: { type: DataTypes.STRING(128), allowNull: true, field: 'application_fee' },
      scholarship: { type: DataTypes.TEXT, allowNull: true },
      courseUrl: { type: DataTypes.STRING(2048), allowNull: true, field: 'course_url' },
      normalizedTuition: { type: DataTypes.JSONB, allowNull: true, field: 'normalized_tuition' },
      normalizedDuration: { type: DataTypes.JSONB, allowNull: true, field: 'normalized_duration' },
      normalizedIntakes: { type: DataTypes.JSONB, allowNull: true, field: 'normalized_intakes' },
      normalizedRequirements: {
        type: DataTypes.JSONB,
        allowNull: true,
        field: 'normalized_requirements',
      },
      qualityScore: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: 'quality_score' },
      cleaningStatus: { type: DataTypes.STRING(32), allowNull: true, field: 'cleaning_status' },
      isDuplicate: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'is_duplicate' },
      duplicateOf: {
        type: DataTypes.UUID,
        allowNull: true,
        field: 'duplicate_of',
        references: { model: 'scraped_courses', key: 'id' },
      },
      recordStatus: {
        type: DataTypes.STRING(32),
        allowNull: false,
        defaultValue: 'cleaned',
        field: 'record_status',
      },
      aiSummary: { type: DataTypes.TEXT, allowNull: true, field: 'ai_summary' },
      subjectTags: { type: DataTypes.JSONB, allowNull: false, defaultValue: [], field: 'subject_tags' },
      careerTags: { type: DataTypes.JSONB, allowNull: false, defaultValue: [], field: 'career_tags' },
      scrapedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: 'scraped_at' },
    },
    { sequelize, modelName: 'ScrapedCourse', tableName: 'scraped_courses', timestamps: true },
  );

  return ScrapedCourse;
};
