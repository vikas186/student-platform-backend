import { Model, DataTypes, Sequelize } from 'sequelize';

export default (sequelize: Sequelize) => {
  class ScrapeAiMeta extends Model {
    public id!: string;
    public entityType!: 'course' | 'university' | 'scholarship';
    public entityId!: string;
    public jobId!: string | null;
    public source!: string;
    public subjectTags!: string[];
    public careerTags!: string[];
    public ieltsRequired!: boolean | null;
    public ieltsScore!: string | null;
    public aiSummary!: string | null;
    public pageCategory!: string | null;
    public parserOutput!: Record<string, unknown>;
    public categorizerOutput!: Record<string, unknown>;
    public model!: string | null;
    public enrichedAt!: Date;
    public readonly createdAt!: Date;
    public readonly updatedAt!: Date;
  }

  ScrapeAiMeta.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      entityType: { type: DataTypes.STRING(32), allowNull: false, field: 'entity_type' },
      entityId: { type: DataTypes.UUID, allowNull: false, field: 'entity_id' },
      jobId: {
        type: DataTypes.UUID,
        allowNull: true,
        field: 'job_id',
        references: { model: 'scrape_jobs', key: 'id' },
        onDelete: 'SET NULL',
      },
      source: { type: DataTypes.STRING(128), allowNull: false },
      subjectTags: { type: DataTypes.JSONB, allowNull: false, defaultValue: [], field: 'subject_tags' },
      careerTags: { type: DataTypes.JSONB, allowNull: false, defaultValue: [], field: 'career_tags' },
      ieltsRequired: { type: DataTypes.BOOLEAN, allowNull: true, field: 'ielts_required' },
      ieltsScore: { type: DataTypes.STRING(32), allowNull: true, field: 'ielts_score' },
      aiSummary: { type: DataTypes.TEXT, allowNull: true, field: 'ai_summary' },
      pageCategory: { type: DataTypes.STRING(64), allowNull: true, field: 'page_category' },
      parserOutput: { type: DataTypes.JSONB, allowNull: false, defaultValue: {}, field: 'parser_output' },
      categorizerOutput: { type: DataTypes.JSONB, allowNull: false, defaultValue: {}, field: 'categorizer_output' },
      model: { type: DataTypes.STRING(64), allowNull: true },
      enrichedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: 'enriched_at' },
    },
    { sequelize, modelName: 'ScrapeAiMeta', tableName: 'scrape_ai_meta', timestamps: true },
  );

  return ScrapeAiMeta;
};
