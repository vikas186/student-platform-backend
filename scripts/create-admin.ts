import dotenv from 'dotenv';
import path from 'path';

// Load environment variables based on NODE_ENV
const nodeEnv = process.env.NODE_ENV || 'production';
dotenv.config({ path: path.join(__dirname, '..', 'config', `.env.${nodeEnv}`) });

import { db } from '../config/database';

async function main() {
  const args = process.argv.slice(2);
  let email = '';
  let password = '';
  let name = '';

  for (const arg of args) {
    if (arg.startsWith('--email=')) email = arg.split('=')[1];
    if (arg.startsWith('--password=')) password = arg.split('=')[1];
    if (arg.startsWith('--name=')) name = arg.split('=')[1];
  }

  if (!email || !password || !name) {
    console.error('Error: Missing required arguments.');
    console.log('Usage:');
    console.log('  npm run prod:create-admin -- --email=<email> --password=<password> --name="<name>"');
    process.exit(1);
  }

  console.log(`Connecting to database for environment: ${nodeEnv}...`);
  await db.sequelize.authenticate();

  const targetEmail = email.trim().toLowerCase();
  let user = await db.User.findOne({ where: { email: targetEmail } });

  if (!user) {
    user = await db.User.create({
      name: name.trim(),
      email: targetEmail,
      password: password,
      role: 'admin',
      phone: null,
      status: true,
    });
    console.log(`Successfully created new admin user: ${targetEmail}`);
  } else {
    console.log(`User with email "${targetEmail}" already exists. Promoting to admin and updating password...`);
    user.set('role', 'admin');
    user.set('password', password);
    user.set('name', name.trim());
    user.set('status', true);
    await user.save();
    console.log(`Successfully updated admin user: ${targetEmail}`);
  }

  process.exit(0);
}

main().catch(err => {
  console.error('Error creating admin:', err);
  process.exit(1);
});
