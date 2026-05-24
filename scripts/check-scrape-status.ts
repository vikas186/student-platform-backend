import dotenv from 'dotenv';
dotenv.config({ path: `config/.env.${process.env.NODE_ENV || 'development'}` });

import { db } from '../config/database';

const jobId = process.argv[2] || 'c3ef6dfa-9360-459c-90ec-b5ae0b1357d1';

async function main() {
  await db.sequelize.authenticate();
  const job = await db.ScrapeJob.findByPk(jobId);
  const batch = await db.RawScrapeBatch.findOne({ where: { jobId } });
  const courseCount = await db.ScrapedCourse.count();
  const recent = await db.ScrapedCourse.findAll({ limit: 5, order: [['scrapedAt', 'DESC']] });

  console.log('JOB', {
    id: job?.id,
    status: job?.status,
    errorMessage: job?.errorMessage,
    stats: job?.stats,
  });
  console.log('BATCH', { status: batch?.status, errorMessage: batch?.errorMessage });
  console.log('SCRAPED_COURSES_COUNT', courseCount);
  console.log(
    'RECENT',
    recent.map(c => ({ courseName: c.courseName, source: c.source, courseUrl: c.courseUrl })),
  );

  const [indexes] = await db.sequelize.query(
    `SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'scraped_courses'`,
  );
  console.log('INDEXES', indexes);
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
