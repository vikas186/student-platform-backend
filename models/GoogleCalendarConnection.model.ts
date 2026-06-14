import { Model, DataTypes, Sequelize } from 'sequelize';

export default (sequelize: Sequelize) => {
  class GoogleCalendarConnection extends Model {
    public userId!: string;
    public googleEmail!: string;
    public calendarId!: string;
    public refreshTokenEnc!: string;
    public accessToken!: string | null;
    public accessTokenExpiresAt!: Date | null;
    public scopes!: string | null;
    public connectedAt!: Date;
    public readonly createdAt!: Date;
    public readonly updatedAt!: Date;

    static associate(models: any) {
      GoogleCalendarConnection.belongsTo(models.User, { foreignKey: 'userId', as: 'user', onDelete: 'CASCADE' });
    }
  }

  GoogleCalendarConnection.init(
    {
      userId: {
        type: DataTypes.UUID,
        primaryKey: true,
        field: 'user_id',
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
      },
      googleEmail: { type: DataTypes.STRING(255), allowNull: false, field: 'google_email' },
      calendarId: { type: DataTypes.STRING(255), allowNull: false, defaultValue: 'primary', field: 'calendar_id' },
      refreshTokenEnc: { type: DataTypes.TEXT, allowNull: false, field: 'refresh_token_enc' },
      accessToken: { type: DataTypes.TEXT, allowNull: true, field: 'access_token' },
      accessTokenExpiresAt: { type: DataTypes.DATE, allowNull: true, field: 'access_token_expires_at' },
      scopes: { type: DataTypes.TEXT, allowNull: true },
      connectedAt: { type: DataTypes.DATE, allowNull: false, field: 'connected_at' },
    },
    {
      sequelize,
      modelName: 'GoogleCalendarConnection',
      tableName: 'google_calendar_connections',
      timestamps: true,
    },
  );

  return GoogleCalendarConnection;
};
