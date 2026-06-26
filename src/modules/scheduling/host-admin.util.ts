import { db } from '../../../config/database';
import AppError from '../../../utils/errorHandler';
import { schedulingConfig } from './scheduling.config';
import { resolveHostAdminUserId } from './google-oauth.service';

export type HostAdminDetails = {
  adminUserId: string;
  counsellorName: string;
  counsellorEmail: string;
  counsellorTitle: string;
};

export const getHostAdminDetails = async (adminUserId: string): Promise<HostAdminDetails> => {
  const [user, connection] = await Promise.all([
    db.User.findByPk(adminUserId),
    db.GoogleCalendarConnection.findByPk(adminUserId),
  ]);

  return {
    adminUserId,
    counsellorName: user?.name?.trim() || 'Uniwizer counsellor',
    counsellorEmail: connection?.googleEmail?.trim() || user?.email?.trim() || '',
    counsellorTitle: 'Admissions counsellor',
  };
};

/** Resolve counsellor for slot listing — availability is enough; Google only required at booking. */
export const resolveHostAdminForSlots = async (): Promise<string> => {
  const defaultId = schedulingConfig().defaultCounsellorAdminUserId;
  if (defaultId) {
    const [weeklyCount, dateCount] = await Promise.all([
      db.CounsellorAvailability.count({ where: { adminUserId: defaultId } }),
      db.CounsellorAvailabilityDate.count({ where: { adminUserId: defaultId } }),
    ]);
    if (weeklyCount > 0 || dateCount > 0) return defaultId;
    const conn = await db.GoogleCalendarConnection.findByPk(defaultId);
    if (conn) return defaultId;
  }

  const withAvailability = await db.CounsellorAvailability.findOne({
    order: [['updatedAt', 'DESC']],
  });
  if (withAvailability) {
    const adminUserId = withAvailability.getDataValue('adminUserId') as string;
    if (adminUserId) return adminUserId;
  }

  const withDateAvailability = await db.CounsellorAvailabilityDate.findOne({
    order: [['updatedAt', 'DESC']],
  });
  if (withDateAvailability) {
    const adminUserId = withDateAvailability.getDataValue('adminUserId') as string;
    if (adminUserId) return adminUserId;
  }

  try {
    return await resolveHostAdminUserId();
  } catch {
    throw new AppError('No counsellor availability configured yet', 503);
  }
};
