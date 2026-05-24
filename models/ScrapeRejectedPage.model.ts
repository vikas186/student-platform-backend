import { Model, DataTypes, Sequelize } from 'sequelize';

export default (sequelize: Sequelize) => {
  class ScrapeRejectedPage extends Model {
    public id!: string;
    public jobId!: string;
    public rawBatchId!: string | null;
    public source!: string;
    public url!: string;
    public pageTitle!: string | null;
    public classification!: string;
    public reason!: string | null;
    public readonly createdAt!: Date;

    static associate(models: any) {
      ScrapeRejectedPage.belongsTo(models.ScrapeJob, { foreignKey: 'jobId', as: 'job', onDelete: 'CASCADE' });
    }
  }

  ScrapeRejectedPage.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      jobId: { type: DataTypes.UUID, allowNull: false, field: 'job_id', references: { model: 'scrape_jobs', key: 'id' } },
      rawBatchId: { type: DataTypes.UUID, allowNull: true, field: 'raw_batch_id' },
      source: { type: DataTypes.STRING(128), allowNull: false },
      url: { type: DataTypes.STRING(2048), allowNull: false },
      pageTitle: { type: DataTypes.STRING(512), allowNull: true, field: 'page_title' },
      classification: { type: DataTypes.STRING(32), allowNull: false, defaultValue: 'reject' },
      reason: { type: DataTypes.TEXT, allowNull: true },
    },
    { sequelize, modelName: 'ScrapeRejectedPage', tableName: 'scrape_rejected_pages', timestamps: true, updatedAt: false },
  );

  return ScrapeRejectedPage;
};
