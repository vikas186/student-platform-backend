import { Model, DataTypes, Sequelize } from 'sequelize';

export const ASSISTANT_CHAT_ROLES = ['user', 'assistant', 'system'] as const;
export type AssistantChatRole = (typeof ASSISTANT_CHAT_ROLES)[number];

export default (sequelize: Sequelize) => {
  class AssistantChatMessage extends Model {
    public id!: number;
    public sessionId!: string;
    public role!: AssistantChatRole;
    public content!: string;
    public metadata?: Record<string, unknown> | null;
    public readonly createdAt!: Date;
    public readonly updatedAt!: Date;

    static associate(models: any) {
      AssistantChatMessage.belongsTo(models.ChatSession, { foreignKey: 'sessionId', as: 'session', onDelete: 'CASCADE' });
      AssistantChatMessage.hasMany(models.ChatFeedback, { foreignKey: 'messageId', as: 'feedback', onDelete: 'CASCADE' });
    }
  }

  AssistantChatMessage.init(
    {
      id: { type: DataTypes.BIGINT, autoIncrement: true, primaryKey: true },
      sessionId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'chat_sessions', key: 'id' },
        onDelete: 'CASCADE',
      },
      role: {
        type: DataTypes.STRING(16),
        allowNull: false,
        validate: { isIn: [ASSISTANT_CHAT_ROLES] },
      },
      content: { type: DataTypes.TEXT, allowNull: false },
      metadata: { type: DataTypes.JSONB, allowNull: true },
    },
    {
      sequelize,
      modelName: 'AssistantChatMessage',
      tableName: 'chat_messages',
      timestamps: true,
      underscored: true,
    },
  );

  return AssistantChatMessage;
};
