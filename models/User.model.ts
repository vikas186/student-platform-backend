import { Model, DataTypes, Sequelize } from 'sequelize';
import bcrypt from 'bcrypt';

const saltRounds: number = parseInt(process.env.BCRYPT_SALTROUNDS as string, 10) || 10;

export const USER_ROLES = ['student', 'agent', 'admin', 'university'] as const;
export type UserRole = (typeof USER_ROLES)[number];

/** Read password hash without class-field shadowing (Sequelize + TypeScript). */
export function readPasswordHash(user: Model): string | null {
  const hash = user.getDataValue('password');
  return typeof hash === 'string' && hash.length > 0 ? hash : null;
}

export default (sequelize: Sequelize) => {
  class User extends Model {
    declare id: string;
    declare name: string;
    declare email: string;
    declare password: string;
    declare role: UserRole;
    declare phone: string | null;
    declare status: boolean;
    declare emailVerified: boolean;
    /** When role=admin: primary can allocate counselling to sub-admins. Default true. */
    declare isPrimaryAdmin: boolean;
    /** When role=admin and not primary: links to the primary admin user. */
    declare parentAdminUserId: string | null;
    declare readonly createdAt: Date;
    declare readonly updatedAt: Date;

    static associate(models: any) {
      User.hasOne(models.StudentProfile, { foreignKey: 'userId', as: 'studentProfile', onDelete: 'CASCADE' });
      User.hasOne(models.AgentProfile, { foreignKey: 'userId', as: 'agentProfile', onDelete: 'CASCADE' });
      User.hasOne(models.UniversityProfile, { foreignKey: 'userId', as: 'universityProfile', onDelete: 'CASCADE' });
      User.hasMany(models.Token, { foreignKey: 'userId', onDelete: 'CASCADE' });
      User.hasMany(models.PasswordResetToken, { foreignKey: 'userId', as: 'resetTokens', onDelete: 'CASCADE' });
      User.hasMany(models.EmailVerificationToken, {
        foreignKey: 'userId',
        as: 'emailVerificationTokens',
        onDelete: 'CASCADE',
      });
      User.hasMany(models.Payment, { foreignKey: 'userId', onDelete: 'CASCADE' });
      User.hasMany(models.Notification, { foreignKey: 'userId', onDelete: 'CASCADE' });
      User.hasMany(models.ActivityLog, { foreignKey: 'userId', onDelete: 'SET NULL' });
      User.hasMany(models.ChatMessage, { foreignKey: 'senderId', as: 'sentMessages', onDelete: 'CASCADE' });
      User.hasMany(models.ChatMessage, { foreignKey: 'receiverId', as: 'receivedMessages', onDelete: 'CASCADE' });
      User.hasMany(models.ChatSession, { foreignKey: 'userId', as: 'chatSessions', onDelete: 'CASCADE' });
      User.hasMany(models.ChatFeedback, { foreignKey: 'userId', as: 'chatFeedback', onDelete: 'CASCADE' });
      User.hasOne(models.GoogleCalendarConnection, { foreignKey: 'userId', as: 'googleCalendarConnection', onDelete: 'CASCADE' });
      User.hasMany(models.CounsellorAvailability, { foreignKey: 'adminUserId', as: 'counsellorAvailability', onDelete: 'CASCADE' });
      User.hasMany(models.CounsellorAvailabilityDate, { foreignKey: 'adminUserId', as: 'counsellorAvailabilityDates', onDelete: 'CASCADE' });
      User.hasMany(models.VerificationSession, { foreignKey: 'userId', as: 'verificationSessions', onDelete: 'CASCADE' });
      User.belongsTo(models.User, { foreignKey: 'parentAdminUserId', as: 'parentAdmin', onDelete: 'SET NULL' });
      User.hasMany(models.User, { foreignKey: 'parentAdminUserId', as: 'subAdmins', onDelete: 'SET NULL' });
    }

    async login(password: string): Promise<boolean> {
      const plain = typeof password === 'string' ? password : '';
      const hash = readPasswordHash(this);
      if (!plain || !hash) return false;
      try {
        return await bcrypt.compare(plain, hash);
      } catch {
        return false;
      }
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
      emailVerified: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        allowNull: false,
      },
      isPrimaryAdmin: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        field: 'is_primary_admin',
      },
      parentAdminUserId: {
        type: DataTypes.UUID,
        allowNull: true,
        field: 'parent_admin_user_id',
        references: { model: 'users', key: 'id' },
        onDelete: 'SET NULL',
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
          const plain = String(user.getDataValue('password') || '').trim();
          if (!plain) throw new Error('Password is required');
          user.setDataValue('password', await bcrypt.hash(plain, saltRounds));
        },
        beforeUpdate: async (user: User) => {
          if (!user.changed('password')) return;
          const plain = String(user.getDataValue('password') || '').trim();
          if (!plain) throw new Error('Password is required');
          user.setDataValue('password', await bcrypt.hash(plain, saltRounds));
        },
      },
    },
  );

  return User;
};
