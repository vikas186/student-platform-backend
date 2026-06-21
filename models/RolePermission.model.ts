import { Model, DataTypes, Sequelize } from 'sequelize';
import { USER_ROLES } from './User.model';

export default (sequelize: Sequelize) => {
  class RolePermission extends Model {
    declare id: number;
    declare role: (typeof USER_ROLES)[number];
    declare moduleKey: string;
    declare actionKey: string;
    declare allowed: boolean;
    declare readonly createdAt: Date;
    declare readonly updatedAt: Date;
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
