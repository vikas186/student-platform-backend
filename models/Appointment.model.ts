import { Model, DataTypes, Sequelize } from 'sequelize';

export const APPOINTMENT_TYPES = ['counselling', 'mock_interview'] as const;
export type AppointmentType = (typeof APPOINTMENT_TYPES)[number];

export const APPOINTMENT_STATUSES = ['scheduled', 'completed', 'cancelled', 'no_show'] as const;
export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];

export default (sequelize: Sequelize) => {
  class Appointment extends Model {
    declare id: string;
    declare studentProfileId: number;
    declare studentUserId: string;
    declare hostAdminUserId: string;
    declare type: AppointmentType;
    declare status: AppointmentStatus;
    declare startsAt: Date;
    declare endsAt: Date;
    declare timezone: string;
    declare googleEventId: string | null;
    declare meetLink: string | null;
    declare notes: string | null;
    declare cancelledAt: Date | null;
    declare completedAt: Date | null;
    declare reminder24hSentAt: Date | null;
    declare reminder1hSentAt: Date | null;
    declare readonly createdAt: Date;
    declare readonly updatedAt: Date;

    static associate(models: any) {
      Appointment.belongsTo(models.StudentProfile, {
        foreignKey: 'studentProfileId',
        as: 'studentProfile',
        onDelete: 'CASCADE',
      });
      Appointment.belongsTo(models.User, { foreignKey: 'studentUserId', as: 'studentUser', onDelete: 'CASCADE' });
      Appointment.belongsTo(models.User, { foreignKey: 'hostAdminUserId', as: 'hostAdmin', onDelete: 'RESTRICT' });
    }
  }

  Appointment.init(
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      studentProfileId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: 'student_profile_id',
        references: { model: 'student_profiles', key: 'id' },
        onDelete: 'CASCADE',
      },
      studentUserId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: 'student_user_id',
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
      },
      hostAdminUserId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: 'host_admin_user_id',
        references: { model: 'users', key: 'id' },
      },
      type: { type: DataTypes.ENUM(...APPOINTMENT_TYPES), allowNull: false },
      status: { type: DataTypes.ENUM(...APPOINTMENT_STATUSES), allowNull: false, defaultValue: 'scheduled' },
      startsAt: { type: DataTypes.DATE, allowNull: false, field: 'starts_at' },
      endsAt: { type: DataTypes.DATE, allowNull: false, field: 'ends_at' },
      timezone: { type: DataTypes.STRING(64), allowNull: false, defaultValue: 'Asia/Kolkata' },
      googleEventId: { type: DataTypes.STRING(255), allowNull: true, field: 'google_event_id' },
      meetLink: { type: DataTypes.TEXT, allowNull: true, field: 'meet_link' },
      notes: { type: DataTypes.TEXT, allowNull: true },
      cancelledAt: { type: DataTypes.DATE, allowNull: true, field: 'cancelled_at' },
      completedAt: { type: DataTypes.DATE, allowNull: true, field: 'completed_at' },
      reminder24hSentAt: { type: DataTypes.DATE, allowNull: true, field: 'reminder_24h_sent_at' },
      reminder1hSentAt: { type: DataTypes.DATE, allowNull: true, field: 'reminder_1h_sent_at' },
    },
    {
      sequelize,
      modelName: 'Appointment',
      tableName: 'appointments',
      timestamps: true,
    },
  );

  return Appointment;
};
