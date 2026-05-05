import { Model, DataTypes, Sequelize } from 'sequelize';
import { USER_ROLES } from './User.model';

export default (sequelize: Sequelize) => {
  class RolePermission extends Model {
    public id!: number;
    public role!: (typeof USER_ROLES)[number];
    public moduleKey!: string;
    public actionKey!: string;
    public allowed!: boolean;
    public readonly createdAt!: Date;
    public readonly updatedAt!: Date;
  }

  RolePermission.init(
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      role: {
        type: DataTypes.ENUM(...USER_ROLES),
        allowNull: false,
      },
      moduleKey: {
        type: DataTypes.STRING(64),
        allowNull: false,
        field: 'module_key',
      },
      actionKey: {
        type: DataTypes.STRING(64),
        allowNull: false,
        field: 'action_key',
      },
      allowed: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
    },
    {
      sequelize,
      modelName: 'RolePermission',
      tableName: 'role_permissions',
      timestamps: true,
      indexes: [{ unique: true, fields: ['role', 'module_key', 'action_key'] }],
    },
  );

  return RolePermission;
};
