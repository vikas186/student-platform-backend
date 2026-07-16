import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '..', 'config', `.env.${process.env.NODE_ENV || 'development'}`) });

import { randomUUID } from 'crypto';
import { db } from '../config/database';
import { scrapeStudiesOverseas } from '../src/modules/scrape/scrapers/studies-overseas.scraper';
import { processEnrichmentPipeline } from '../src/modules/scrape/orchestrator/enrichment.orchestrator';
import { getPresetConfig } from '../src/modules/scrape/config/scrape-sources';
import { closePlaywrightBrowser } from '../src/modules/scrape/scrapers/playwright.util';

async function main() {
  process.env.SKIP_COURSE_AI_ENRICHMENT = 'true';
  console.log('Connecting to database...');
  await db.sequelize.authenticate();

  console.log('Clearing existing scraped data...');
  await db.ScrapedCourse.destroy({ where: {} });
  await db.ScrapeFee.destroy({ where: {} });
  await db.ScrapeScholarship.destroy({ where: {} });
  await db.ScrapeAiMeta.destroy({ where: {} });
  await db.ScrapeRejectedPage.destroy({ where: {} });
  await db.RawScrapeBatch.destroy({ where: {} });
  await db.ScrapeJob.destroy({ where: {} });
  await db.ScrapeUniversity.destroy({ where: {} });

  const jobId = randomUUID();
  const rawBatchId = randomUUID();
  const source = 'STUDIES_OVERSEAS';

  // 1. Create Scrape Job
  console.log('Creating ScrapeJob...');
  const job = await db.ScrapeJob.create({
    id: jobId,
    source,
    targetUrl: 'https://www.studies-overseas.com/universities',
    targetName: 'Studies Overseas',
    seedUrls: ['https://www.studies-overseas.com/universities'],
    status: 'scraping',
    triggerType: 'manual',
    startedAt: new Date(),
    stats: {
      maxPages: 1,
      maxDetailPages: 0,
    }
  });

  const preset = getPresetConfig(source);
  const config = {
    source,
    baseUrl: preset.baseUrl,
    seeds: preset.seeds,
    maxPages: 1,
    maxDetailPages: 0,
  };

  console.log('Running scraper in-process for ALL universities (unlimited)...');
  const result = await scrapeStudiesOverseas(config);

  console.log(`Scraper completed. Visited pages: ${result.pagesVisited}`);
  console.log(`Found ${result.universities.length} universities, ${result.courses.length} courses.`);

  // 2. Save Raw Scrape Batch
  console.log('Saving RawScrapeBatch...');
  await db.RawScrapeBatch.create({
    jobId,
    rawBatchId,
    source,
    rawPayload: {
      targetUrl: config.baseUrl,
      targetName: 'Studies Overseas',
      pagesVisited: result.pagesVisited,
      apiResponseCount: result.apiResponseCount,
    },
    rawCourses: result.courses,
    rawUniversities: result.universities,
    rawFees: result.fees,
    rawScholarships: result.scholarships,
    rejectedPages: result.rejectedPages,
    status: 'pending_cleaning',
  });

  await job.update({
    status: 'cleaning',
    stats: {
      totalPages: result.pagesVisited,
      coursesFound: result.courses.length,
      universitiesFound: result.universities.length,
      feesFound: result.fees.length,
      scholarshipsFound: result.scholarships.length,
      rejectedPages: result.rejectedPages.length,
      apiResponseCount: result.apiResponseCount,
      maxPages: 1,
      maxDetailPages: 0,
    },
  });

  // 3. Process cleaning/enrichment directly
  console.log('Processing Enrichment/Cleaning Pipeline...');
  const stats = await processEnrichmentPipeline(jobId, rawBatchId, source, {
    courses: result.courses,
    universities: result.universities,
    scholarships: result.scholarships,
  });

  await job.update({
    status: 'completed',
    completedAt: new Date(),
    stats: {
      totalPages: result.pagesVisited,
      coursesFound: result.courses.length,
      universitiesFound: result.universities.length,
      feesFound: result.fees.length,
      scholarshipsFound: result.scholarships.length,
      rejectedPages: result.rejectedPages.length,
      apiResponseCount: result.apiResponseCount,
      maxPages: 1,
      maxDetailPages: 0,
      validCount: stats.validCount,
      needsReviewCount: stats.needsReviewCount,
    },
  });

  console.log('Enrichment and duplicate detection complete!');
  console.log(`Successfully completed! Job ID: ${jobId}`);

  await closePlaywrightBrowser();
  await db.sequelize.close();
  process.exit(0);
}

main().catch(async (err) => {
  console.error('Scrape execution failed:', err);
  await closePlaywrightBrowser().catch(() => {});
  await db.sequelize.close().catch(() => {});
  process.exit(1);
});
