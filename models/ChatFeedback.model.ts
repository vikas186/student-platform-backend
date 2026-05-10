import { Model, DataTypes, Sequelize } from 'sequelize';

export default (sequelize: Sequelize) => {
  class ChatFeedback extends Model {
    public id!: number;
    public userId!: string;
    public messageId!: number;
    public rating!: number;
    public comment?: string | null;
    public readonly createdAt!: Date;

    static associate(models: any) {
      ChatFeedback.belongsTo(models.User, { foreignKey: 'userId', as: 'user', onDelete: 'CASCADE' });
      ChatFeedback.belongsTo(models.AssistantChatMessage, { foreignKey: 'messageId', as: 'message', onDelete: 'CASCADE' });
    }
  }

  ChatFeedback.init(
    {
      id: { type: DataTypes.BIGINT, autoIncrement: true, primaryKey: true },
      userId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
      },
      messageId: {
        type: DataTypes.BIGINT,
        allowNull: false,
        references: { model: 'chat_messages', key: 'id' },
        onDelete: 'CASCADE',
      },
      rating: { type: DataTypes.SMALLINT, allowNull: false },
      comment: { type: DataTypes.TEXT, allowNull: true },
    },
    {
      sequelize,
      modelName: 'ChatFeedback',
      tableName: 'chat_feedback',
      timestamps: true,
      updatedAt: false,
      underscored: true,
    },
  );

  return ChatFeedback;
};
