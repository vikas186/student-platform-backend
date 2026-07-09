import { Model, DataTypes, Sequelize } from 'sequelize';

export const EMAIL_VERIFICATION_KINDS = ['link', 'otp'] as const;
export type EmailVerificationKind = (typeof EMAIL_VERIFICATION_KINDS)[number];

export default (sequelize: Sequelize) => {
  class EmailVerificationToken extends Model {
    declare id: string;
    declare userId: string;
    declare token: string | null;
    declare otp: string | null;
    declare kind: EmailVerificationKind;
    declare used: boolean;
    declare expiresAt: Date;
    declare readonly createdAt: Date;
    declare readonly updatedAt: Date;

    static associate(models: any) {
      EmailVerificationToken.belongsTo(models.User, {
        foreignKey: 'userId',
        as: 'user',
        onDelete: 'CASCADE',
      });
    }
  }

  EmailVerificationToken.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      userId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id',
        },
        onDelete: 'CASCADE',
      },
      token: {
        type: DataTypes.STRING(512),
        allowNull: true,
      },
      otp: {
        type: DataTypes.STRING(6),
        allowNull: true,
      },
      kind: {
        type: DataTypes.ENUM(...EMAIL_VERIFICATION_KINDS),
        allowNull: false,
      },
      used: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      expiresAt: {
        type: DataTypes.DATE,
        allowNull: false,
      },
    },
    {
      sequelize,
      modelName: 'EmailVerificationToken',
      tableName: 'email_verification_tokens',
      timestamps: true,
    },
  );

  return EmailVerificationToken;
};
