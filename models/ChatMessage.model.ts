import { Model, DataTypes, Sequelize } from 'sequelize';

export const CHAT_MESSAGE_TYPES = ['text', 'file', 'ai'] as const;

export default (sequelize: Sequelize) => {
  class ChatMessage extends Model {
    public id!: number;
    public senderId!: string;
    public receiverId!: string;
    public message!: string;
    public messageType!: (typeof CHAT_MESSAGE_TYPES)[number];
    public readonly createdAt!: Date;
    public readonly updatedAt!: Date;

    static associate(models: any) {
      ChatMessage.belongsTo(models.User, { foreignKey: 'senderId', as: 'sender', onDelete: 'CASCADE' });
      ChatMessage.belongsTo(models.User, { foreignKey: 'receiverId', as: 'receiver', onDelete: 'CASCADE' });
    }
  }

  ChatMessage.init(
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      senderId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
      },
      receiverId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
      },
      message: { type: DataTypes.TEXT, allowNull: false },
      messageType: {
        type: DataTypes.ENUM(...CHAT_MESSAGE_TYPES),
        allowNull: false,
        defaultValue: 'text',
      },
    },
    {
      sequelize,
      modelName: 'ChatMessage',
      tableName: 'chat_messages',
      timestamps: true,
    },
  );

  return ChatMessage;
};
