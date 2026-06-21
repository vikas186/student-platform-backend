import { Model, DataTypes, Sequelize } from 'sequelize';

export default (sequelize: Sequelize) => {
  class NoticeTickerItem extends Model {
    declare id: number;
    declare title: string;
    declare source: string;
    declare href: string | null;
    declare externalId: string | null;
    declare sourceUrl: string | null;
    declare generatedBy: string;
    declare expiresAt: Date | null;
    declare sortOrder: number;
    declare isActive: boolean;
    declare readonly createdAt: Date;
    declare readonly updatedAt: Date;
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
