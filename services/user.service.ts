import { db } from '../config/database';
import AppError from '../utils/errorHandler';

const updateProfileService = async (userId: string, updates: any, _profilePhoto: any) => {
  const { name, phone, password } = updates;

  const user = await db.User.findByPk(userId);
  if (!user) throw new Error('User not found');

  if (name) user.name = name;
  if (phone !== undefined) user.phone = phone;
  if (password) user.password = password;

  await user.save();

  return user.toSafeObject();
};

const deleteAccountById = async (userId: string) => {
  const user = await db.User.findByPk(userId);
  if (!user) {
    throw new AppError('User not found', 404);
  }
  await user.destroy();
};

export default { updateProfileService, deleteAccountById };
