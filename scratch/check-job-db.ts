import dotenv from 'dotenv';
dotenv.config({ path: `config/.env.${process.env.NODE_ENV || 'development'}` });

import { db } from '../models';

async function main() {
  await db.sequelize.authenticate();
  
  const jobId = 'aa222dc2-a653-4d5f-a027-3ae6f890215a';
  console.log('Querying ScrapeJob details for:', jobId);
  const job = await db.ScrapeJob.findByPk(jobId);
  if (job) {
    console.log('Job found:');
    console.log('  Status:', job.status);
    console.log('  ErrorMessage:', job.errorMessage);
    console.log('  Stats:', JSON.stringify(job.stats, null, 2));
    console.log('  CompletedAt:', job.completedAt);
  } else {
    console.log('Job NOT found in DB');
  }

  // Let's also check RawScrapeBatch count and status
  const batch = await db.RawScrapeBatch.findOne({ where: { jobId } });
  if (batch) {
    console.log('\nRawScrapeBatch found:');
    console.log('  Status:', batch.status);
    console.log('  Courses count:', (batch.rawCourses || []).length);
    console.log('  Universities count:', (batch.rawUniversities || []).length);
    console.log('  Scholarships count:', (batch.rawScholarships || []).length);
    console.log('  Fees count:', (batch.rawFees || []).length);
  }

  await db.sequelize.close();
}

main().catch(console.error);
