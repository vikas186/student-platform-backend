import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '..', 'config', `.env.${process.env.NODE_ENV || 'development'}`) });

import { randomUUID } from 'crypto';
import { db } from '../config/database';
import { scrapeStudiesOverseas } from '../src/modules/scrape/scrapers/studies-overseas.scraper';
import { processEnrichmentPipeline } from '../src/modules/scrape/orchestrator/enrichment.orchestrator';
import { closePlaywrightBrowser } from '../src/modules/scrape/scrapers/playwright.util';

/** Top up to 50 universities by scraping the next catalog entries after the first 50. */
async function main() {
  process.env.SKIP_COURSE_AI_ENRICHMENT = 'true';
  await db.sequelize.authenticate();

  const existingCount = await db.ScrapeUniversity.count();
  const need = Math.max(0, 50 - existingCount);
  console.log(`Existing universities: ${existingCount}. Need ${need} more.`);
  if (need === 0) {
    await db.sequelize.close();
    process.exit(0);
  }

  // First 50 attempted (46 ok + 4 failed). Pull the next batch as replacements.
  const result = await scrapeStudiesOverseas({
    source: 'STUDIES_OVERSEAS',
    baseUrl: 'https://www.studies-overseas.com/universities',
    seeds: ['https://www.studies-overseas.com/universities'],
    maxPages: 1,
    maxDetailPages: need + 4,
    detailOffset: 50,
  } as any);

  console.log(
    `Top-up scrape got ${result.universities.length} universities, ${result.courses.length} courses.`,
  );

  if (result.universities.length === 0) {
    console.log('No universities scraped in top-up window.');
    await closePlaywrightBrowser();
    await db.sequelize.close();
    process.exit(1);
  }

  const take = result.universities.slice(0, need);
  const takeNames = new Set(take.map(u => String(u.universityName || '').toLowerCase().trim()));
  const courses = result.courses.filter(c =>
    takeNames.has(String(c.universityName || '').toLowerCase().trim()),
  );
  const scholarships = result.scholarships.filter(s =>
    takeNames.has(String(s.universityName || '').toLowerCase().trim()),
  );

  const job = await db.ScrapeJob.findOne({
    where: { source: 'STUDIES_OVERSEAS' },
    order: [['createdAt', 'DESC']],
  });
  if (!job) throw new Error('No Studies Overseas job found');

  const rawBatchId = randomUUID();
  await db.RawScrapeBatch.create({
    jobId: job.id,
    rawBatchId,
    source: 'STUDIES_OVERSEAS',
    rawPayload: {
      targetUrl: 'https://www.studies-overseas.com/universities',
      targetName: 'Studies Overseas (top-up to 50)',
      pagesVisited: result.pagesVisited,
    },
    rawCourses: courses,
    rawUniversities: take,
    rawFees: [],
    rawScholarships: scholarships,
    rejectedPages: result.rejectedPages,
    status: 'pending_cleaning',
  });

  const stats = await processEnrichmentPipeline(job.id, rawBatchId, 'STUDIES_OVERSEAS', {
    courses,
    universities: take,
    scholarships,
  });

  const total = await db.ScrapeUniversity.count();
  const valid = await db.ScrapeUniversity.count({ where: { cleaningStatus: 'high_quality' } });
  const prev = (job.stats as Record<string, unknown>) || {};
  await job.update({
    status: 'completed',
    completedAt: new Date(),
    stats: {
      ...prev,
      universitiesFound: total,
      coursesFound: await db.ScrapedCourse.count(),
      scholarshipsFound: await db.ScrapeScholarship.count(),
      validCount: Number(prev.validCount || 0) + Number(stats.validCount || 0),
      needsReviewCount: Number(prev.needsReviewCount || 0) + Number(stats.needsReviewCount || 0),
    },
  });

  console.log(`Done. Universities in DB: ${total} (valid: ${valid}). Job: ${job.id}`);
  await closePlaywrightBrowser();
  await db.sequelize.close();
  process.exit(0);
}

main().catch(async err => {
  console.error(err);
  await closePlaywrightBrowser().catch(() => {});
  await db.sequelize.close().catch(() => {});
  process.exit(1);
});
