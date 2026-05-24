import dotenv from 'dotenv';
dotenv.config({ path: `config/.env.${process.env.NODE_ENV || 'development'}` });

import { db } from '../config/database';

const DEV_ADMIN_EMAIL = (process.env.DEV_ADMIN_EMAIL || 'admin@example.com').trim().toLowerCase();
const DEV_ADMIN_PASSWORD = process.env.DEV_ADMIN_PASSWORD || 'SecurePass1';
const DEV_ADMIN_NAME = process.env.DEV_ADMIN_NAME || 'Platform Admin';

async function main() {
  await db.sequelize.authenticate();

  let user = await db.User.findOne({ where: { email: DEV_ADMIN_EMAIL } });

  if (!user) {
    user = await db.User.create({
      name: DEV_ADMIN_NAME,
      email: DEV_ADMIN_EMAIL,
      password: DEV_ADMIN_PASSWORD,
      role: 'admin',
      phone: null,
      status: true,
    });
    console.log(`Created admin: ${DEV_ADMIN_EMAIL}`);
  } else if (user.role !== 'admin') {
    throw new Error(`${DEV_ADMIN_EMAIL} exists but role is "${user.role}", not admin`);
  } else {
    user.password = DEV_ADMIN_PASSWORD;
    user.status = true;
    await user.save();
    console.log(`Reset password for admin: ${DEV_ADMIN_EMAIL}`);
  }

  console.log(`Admin login: ${DEV_ADMIN_EMAIL} / ${DEV_ADMIN_PASSWORD}`);
  console.log('Endpoints: POST /api/v1/auth/admin/login or POST /api/v1/admin/login');
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
