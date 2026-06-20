import { Model, DataTypes, Sequelize } from 'sequelize';

export default (sequelize: Sequelize) => {
  class NoticeTickerItem extends Model {
    public id!: number;
    public title!: string;
    public source!: string;
    public href?: string | null;
    public externalId?: string | null;
    public sourceUrl?: string | null;
    public generatedBy!: string;
    public expiresAt?: Date | null;
    public sortOrder!: number;
    public isActive!: boolean;
    public readonly createdAt!: Date;
    public readonly updatedAt!: Date;
  }

  NoticeTickerItem.init(
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      title: { type: DataTypes.STRING(500), allowNull: false },
      source: { type: DataTypes.STRING(120), allowNull: false },
      href: { type: DataTypes.STRING(500), allowNull: true },
      externalId: { type: DataTypes.STRING(500), allowNull: true },
      sourceUrl: { type: DataTypes.STRING(500), allowNull: true },
      generatedBy: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'ai' },
      expiresAt: { type: DataTypes.DATE, allowNull: true },
      sortOrder: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    },
    {
      sequelize,
      modelName: 'NoticeTickerItem',
      tableName: 'notice_ticker_items',
      timestamps: true,
    },
  );

  return NoticeTickerItem;
};
