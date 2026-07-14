import dotenv from 'dotenv';
dotenv.config({ path: `config/.env.${process.env.NODE_ENV || 'development'}` });

import { db } from '../models';

async function main() {
  await db.sequelize.authenticate();
  console.log('Resetting active jobs for Studies Overseas...');

  const [affected] = await db.ScrapeJob.update(
    { status: 'failed', errorMessage: 'Reset by admin script' },
    { where: { targetUrl: 'https://www.studies-overseas.com/universities', status: ['pending', 'running', 'scraping', 'pending_cleaning', 'cleaning'] } }
  );

  console.log(`Reset ${affected} jobs.`);
  await db.sequelize.close();
}

main().catch(console.error);
