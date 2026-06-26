import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', 'config', `.env.${process.env.NODE_ENV || 'development'}`) });

const { db } = await import('../models/index.js');

const { rows } = await db.University.findAndCountAll({
  order: [['name', 'ASC']],
  limit: 15,
  offset: 0,
});

for (const uni of rows) {
  const id = uni.id;
  const uid = Number(id);
  const ok = Number.isFinite(uid) && uid >= 1;
  if (!ok) console.log('INVALID', { id, typeof id, name: uni.name });
}
console.log('checked', rows.length, 'first id sample', rows[0]?.id, typeof rows[0]?.id);
