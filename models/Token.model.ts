import { Model, DataTypes, Sequelize } from 'sequelize';

export default (sequelize: Sequelize) => {
  class Token extends Model {
    public id!: number;
    /** Access (Bearer) JWT — stored for session validation */
    public token!: string;
    /** Opaque refresh token; issued at login, reused until expiry */
    public refreshToken?: string | null;
    public refreshExpiresAt?: Date | null;
    public userId!: string;
    public readonly createdAt!: Date;
    public readonly updatedAt!: Date;

    static associate(models: any) {
      Token.belongsTo(models.User, { foreignKey: 'userId', onDelete: 'CASCADE' });
    }
  }

  Token.init(
    {
      token: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      refreshToken: {
        type: DataTypes.TEXT,
        allowNull: true,
        unique: true,
      },
      refreshExpiresAt: {
        type: DataTypes.DATE,
        allowNull: true,
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
    },
    {
      sequelize,
      modelName: 'Token',
      tableName: 'tokens',
      timestamps: true,
    },
  );

  return Token;
};
