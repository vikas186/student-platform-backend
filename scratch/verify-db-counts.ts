import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '..', 'config', `.env.${process.env.NODE_ENV || 'development'}`) });

import { db } from '../config/database';

async function main() {
  await db.sequelize.authenticate();

  const unis = await db.ScrapeUniversity.count();
  const courses = await db.ScrapedCourse.count();
  const scholarships = await db.ScrapeScholarship.count();
  const jobs = await db.ScrapeJob.findAll({
    order: [['createdAt', 'DESC']],
    limit: 3,
    attributes: ['id', 'status', 'source', 'createdAt', 'stats'],
  });

  console.log('=== DB COUNTS ===');
  console.log('Universities:', unis);
  console.log('Courses:', courses);
  console.log('Scholarships:', scholarships);
  console.log('');
  console.log('=== RECENT JOBS ===');
  for (const job of jobs) {
    const j = job.toJSON() as Record<string, unknown>;
    console.log(`  Job ${j.id} | status: ${j.status} | source: ${j.source}`);
    const stats = j.stats as Record<string, unknown> | null;
    if (stats) {
      console.log(`    universitiesFound: ${stats.universitiesFound}, coursesFound: ${stats.coursesFound}, validCount: ${stats.validCount}`);
    }
  }

  // Sample a few universities
  const sampleUnis = await db.ScrapeUniversity.findAll({
    limit: 5,
    attributes: ['universityName', 'country', 'source', 'cleaningStatus', 'websiteUrl', 'logoUrl'],
    order: [['createdAt', 'DESC']],
  });

  console.log('');
  console.log('=== SAMPLE UNIVERSITIES ===');
  for (const u of sampleUnis) {
    const r = u.toJSON() as Record<string, unknown>;
    console.log(`  ${r.universityName} (${r.country}) | status: ${r.cleaningStatus} | logo: ${r.logoUrl ? 'YES' : 'NO'} | website: ${r.websiteUrl || 'N/A'}`);
  }

  await db.sequelize.close();
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
