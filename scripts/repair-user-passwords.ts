/**
 * Repair users whose password column is missing, empty, or not a bcrypt hash.
 * Re-hashes known dev defaults for example.com accounts; others need manual reset.
 *
 * Usage: npm run repair:passwords
 */
import dotenv from 'dotenv';
dotenv.config({ path: `config/.env.${process.env.NODE_ENV || 'development'}` });

import bcrypt from 'bcrypt';
import { db } from '../config/database';

const saltRounds = parseInt(process.env.BCRYPT_SALTROUNDS as string, 10) || 10;

const DEV_DEFAULTS: Record<string, string> = {
  'admin@example.com': process.env.DEV_ADMIN_PASSWORD || 'SecurePass1',
  'agent@example.com': process.env.DEV_AGENT_PASSWORD || 'SecurePass1',
  'student@example.com': process.env.DEV_STUDENT_PASSWORD || 'SecurePass1',
  'university@example.com': process.env.DEV_UNIVERSITY_PASSWORD || 'SecurePass1',
};

function isBcryptHash(value: unknown): value is string {
  return typeof value === 'string' && /^\$2[aby]\$\d{2}\$/.test(value);
}

async function main() {
  await db.sequelize.authenticate();
  const users = await db.User.findAll();
  let fixed = 0;
  let skipped = 0;

  for (const user of users) {
    const email = String(user.getDataValue('email') || '')
      .trim()
      .toLowerCase();
    const current = user.getDataValue('password');

    if (isBcryptHash(current)) {
      skipped += 1;
      continue;
    }

    const plain = DEV_DEFAULTS[email];
    if (!plain) {
      console.warn(`[skip] ${email} — invalid password hash and no dev default; use forgot-password or admin reset`);
      continue;
    }

    const hash = await bcrypt.hash(plain, saltRounds);
    await db.sequelize.query('UPDATE users SET password = :hash, updated_at = NOW() WHERE id = :id', {
      replacements: { hash, id: user.getDataValue('id') },
    });
    console.log(`[fixed] ${email} → bcrypt hash (password: ${plain})`);
    fixed += 1;
  }

  console.log(`Done. fixed=${fixed} already_ok=${skipped} total=${users.length}`);
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
