import dotenv from 'dotenv';
dotenv.config({ path: `config/.env.${process.env.NODE_ENV || 'development'}` });

import { db } from '../config/database';
import { processCleaningJob } from '../src/modules/scrape/scrape.processor';

const jobId = process.argv[2];
if (!jobId) {
  console.error('Usage: ts-node scripts/retry-cleaning.ts <jobId>');
  process.exit(1);
}

async function main() {
  await db.sequelize.authenticate();
  const batch = await db.RawScrapeBatch.findOne({ where: { jobId } });
  if (!batch) throw new Error(`No raw batch for job ${jobId}`);

  await batch.update({ status: 'pending_cleaning', errorMessage: null });
  await db.ScrapeJob.update({ status: 'pending_cleaning', errorMessage: null }, { where: { id: jobId } });

  console.log('Retrying cleaning', { jobId, rawBatchId: batch.rawBatchId });
  await processCleaningJob({ jobId, rawBatchId: batch.rawBatchId, retryCount: 0 });

  const job = await db.ScrapeJob.findByPk(jobId);
  const courseCount = await db.ScrapedCourse.count();
  console.log('Done', {
    status: job?.status,
    errorMessage: job?.errorMessage,
    persisted: (job?.stats as { persisted?: unknown })?.persisted,
    courseCount,
  });
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Retry failed:', err);
    process.exit(1);
  });
