import { Model, DataTypes, Sequelize } from 'sequelize';

class ErrorLogs extends Model {
  public id!: number;
  public statusCode!: number;
  public message?: string | null;
  public userEmail?: string | null;
  public apiRoute?: string | null;
  public stack?: string | null;
  public readonly createdAt!: Date;

  static associate(models: any) {
    // Define associations here if needed
  }
}

export default (sequelize: Sequelize) => {
  ErrorLogs.init(
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      statusCode: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      message: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      userEmail: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      apiRoute: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      stack: {
        type: DataTypes.TEXT, // Use TEXT to store potentially large stack traces
        allowNull: true,
      },
      createdAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        allowNull: false,
      },
    },
    {
      sequelize, // The Sequelize instance
      modelName: 'ErrorLogs',
      tableName: 'error_logs', // Custom table name
      timestamps: false, // Disable automatic timestamp columns
    },
  );

  return ErrorLogs;
};
