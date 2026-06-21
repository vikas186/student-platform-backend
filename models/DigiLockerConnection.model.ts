import { Model, DataTypes, Sequelize } from 'sequelize';

export default (sequelize: Sequelize) => {
  class DigiLockerConnection extends Model {
    declare userId: string;
    declare digilockerName: string | null;
    declare accessTokenEnc: string;
    declare refreshTokenEnc: string | null;
    declare accessTokenExpiresAt: Date | null;
    declare scopes: string | null;
    declare connectedAt: Date;
    declare readonly createdAt: Date;
    declare readonly updatedAt: Date;

    static associate(models: any) {
      DigiLockerConnection.belongsTo(models.User, { foreignKey: 'userId', as: 'user', onDelete: 'CASCADE' });
    }
  }

  DigiLockerConnection.init(
    {
      userId: {
        type: DataTypes.UUID,
        primaryKey: true,
        field: 'user_id',
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
      },
      digilockerName: { type: DataTypes.TEXT, allowNull: true, field: 'digilocker_name' },
      accessTokenEnc: { type: DataTypes.TEXT, allowNull: false, field: 'access_token_enc' },
      refreshTokenEnc: { type: DataTypes.TEXT, allowNull: true, field: 'refresh_token_enc' },
      accessTokenExpiresAt: { type: DataTypes.DATE, allowNull: true, field: 'access_token_expires_at' },
      scopes: { type: DataTypes.TEXT, allowNull: true },
      connectedAt: { type: DataTypes.DATE, allowNull: false, field: 'connected_at' },
    },
    {
      sequelize,
      modelName: 'DigiLockerConnection',
      tableName: 'digilocker_connections',
      timestamps: true,
    },
  );

  return DigiLockerConnection;
};
