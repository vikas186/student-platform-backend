import dotenv from 'dotenv';
import path from 'path';

const nodeEnv = process.env.NODE_ENV || 'development';
dotenv.config({ path: path.join(__dirname, '..', 'config', `.env.${nodeEnv}`) });

import { db } from '../config/database';

async function checkDb() {
  try {
    const uniCount = await db.University.count();
    const commCount = await db.Commission.count();
    console.log(`Total universities in DB: ${uniCount}`);
    console.log(`Total commissions in DB: ${commCount}`);

    const latestUnis = await db.University.findAll({
      order: [['id', 'DESC']],
      limit: 5,
      raw: true,
    });
    console.log('Latest 5 universities:', latestUnis);

    const latestComms = await db.Commission.findAll({
      include: [{ model: db.University, as: 'university', attributes: ['name'] }],
      order: [['id', 'DESC']],
      limit: 5,
    });
    console.log('Latest 5 commissions:', latestComms.map((c: any) => c.get({ plain: true })));

  } catch (err) {
    console.error('Error checking DB:', err);
  } finally {
    await db.sequelize.close();
  }
}

checkDb();
