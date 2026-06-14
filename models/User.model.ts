import { Model, DataTypes, Sequelize } from 'sequelize';
import bcrypt from 'bcrypt';

const saltRounds: number = parseInt(process.env.BCRYPT_SALTROUNDS as string, 10) || 10;

export const USER_ROLES = ['student', 'agent', 'admin', 'university'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export default (sequelize: Sequelize) => {
  class User extends Model {
    public id!: string;
    public name!: string;
    public email!: string;
    public password!: string;
    public role!: UserRole;
    public phone?: string | null;
    public status!: boolean;
    public readonly createdAt!: Date;
    public readonly updatedAt!: Date;

    static associate(models: any) {
      User.hasOne(models.StudentProfile, { foreignKey: 'userId', as: 'studentProfile', onDelete: 'CASCADE' });
      User.hasOne(models.AgentProfile, { foreignKey: 'userId', as: 'agentProfile', onDelete: 'CASCADE' });
      User.hasOne(models.UniversityProfile, { foreignKey: 'userId', as: 'universityProfile', onDelete: 'CASCADE' });
      User.hasMany(models.Token, { foreignKey: 'userId', onDelete: 'CASCADE' });
      User.hasMany(models.PasswordResetToken, { foreignKey: 'userId', as: 'resetTokens', onDelete: 'CASCADE' });
      User.hasMany(models.Payment, { foreignKey: 'userId', onDelete: 'CASCADE' });
      User.hasMany(models.Notification, { foreignKey: 'userId', onDelete: 'CASCADE' });
      User.hasMany(models.ActivityLog, { foreignKey: 'userId', onDelete: 'SET NULL' });
      User.hasMany(models.ChatMessage, { foreignKey: 'senderId', as: 'sentMessages', onDelete: 'CASCADE' });
      User.hasMany(models.ChatMessage, { foreignKey: 'receiverId', as: 'receivedMessages', onDelete: 'CASCADE' });
      User.hasMany(models.ChatSession, { foreignKey: 'userId', as: 'chatSessions', onDelete: 'CASCADE' });
      User.hasMany(models.ChatFeedback, { foreignKey: 'userId', as: 'chatFeedback', onDelete: 'CASCADE' });
      User.hasOne(models.GoogleCalendarConnection, { foreignKey: 'userId', as: 'googleCalendarConnection', onDelete: 'CASCADE' });
      User.hasMany(models.CounsellorAvailability, { foreignKey: 'adminUserId', as: 'counsellorAvailability', onDelete: 'CASCADE' });
    }

    async login(password: string): Promise<boolean> {
      return bcrypt.compare(password, this.password);
    }

    toSafeObject(): Record<string, unknown> {
      const userObj = this.get({ plain: true }) as Record<string, unknown>;
      delete userObj.password;
      return userObj;
    }
  }

  User.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        validate: { isEmail: true },
      },
      password: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      role: {
        type: DataTypes.ENUM(...USER_ROLES),
        allowNull: false,
      },
      phone: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      status: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
      },
    },
    {
      sequelize,
      modelName: 'User',
      tableName: 'users',
      timestamps: true,
      indexes: [{ unique: true, fields: ['email'] }],
      hooks: {
        beforeCreate: async (user: User) => {
          if (user.password) {
            user.password = await bcrypt.hash(user.password, saltRounds);
          }
        },
        beforeUpdate: async (user: User) => {
          if (user.changed('password')) {
            user.password = await bcrypt.hash(user.password as string, saltRounds);
          }
        },
      },
    },
  );

  return User;
};
