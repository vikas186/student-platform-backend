import { Model, DataTypes, Sequelize } from 'sequelize';

export default (sequelize: Sequelize) => {
  class ChatSession extends Model {
    public id!: string;
    public userId!: string;
    public title?: string | null;
    public readonly createdAt!: Date;
    public readonly updatedAt!: Date;

    static associate(models: any) {
      ChatSession.belongsTo(models.User, { foreignKey: 'userId', as: 'user', onDelete: 'CASCADE' });
      ChatSession.hasMany(models.AssistantChatMessage, { foreignKey: 'sessionId', as: 'messages', onDelete: 'CASCADE' });
    }
  }

  ChatSession.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      userId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
      },
      title: { type: DataTypes.TEXT, allowNull: true },
    },
    {
      sequelize,
      modelName: 'ChatSession',
      tableName: 'chat_sessions',
      timestamps: true,
      underscored: true,
    },
  );

  return ChatSession;
};
