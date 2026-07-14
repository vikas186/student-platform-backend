import dotenv from 'dotenv';
dotenv.config({ path: `config/.env.${process.env.NODE_ENV || 'development'}` });

import { db } from '../models';
import { startScrapeJob } from '../src/modules/scrape/scrape.processor';
import { connectRabbitMqWithRetry, closeRabbitMq } from '../src/modules/scrape/queues/scrape.queue';

async function main() {
  console.log('Connecting to database...');
  await db.sequelize.authenticate();
  
  console.log('Connecting to RabbitMQ...');
  await connectRabbitMqWithRetry();

  const target = {
    source: 'STUDIES_OVERSEAS',
    targetUrl: 'https://www.studies-overseas.com/universities',
    targetName: 'Studies Overseas',
    seedUrls: ['https://www.studies-overseas.com/universities'],
    maxPages: 43,
    maxDetailPages: 6,
  };

  console.log('Starting scrape job for:', target.targetName);
  try {
    const result = await startScrapeJob(target, 'manual');
    console.log('Scrape job successfully queued!', result);
  } catch (err) {
    console.error('Failed to start scrape job:', err);
  }

  // Allow some time for RabbitMQ message to dispatch
  await new Promise(r => setTimeout(r, 2000));
  await closeRabbitMq();
  await db.sequelize.close();
  console.log('Done!');
}

main().catch(console.error);
