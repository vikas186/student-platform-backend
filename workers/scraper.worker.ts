import dotenv from 'dotenv';
dotenv.config({ path: `config/.env.${process.env.NODE_ENV || 'development'}` });

import {
  COURSE_SCRAPING_QUEUE,
  COURSE_SCRAPING_RETRY_QUEUE,
} from '../src/modules/scrape/config/scrape.constants';
import { scrapeLogger } from '../src/modules/scrape/logger';
import { consumeScrapeJobs, connectRabbitMqWithRetry, closeRabbitMq } from '../src/modules/scrape/queues/scrape.queue';
import { processScrapeJob } from '../src/modules/scrape/scrape.processor';
import { recoverStaleScrapeJobs } from '../src/modules/scrape/recover-stale-jobs';
import { closePlaywrightBrowser } from '../src/modules/scrape/scrapers/playwright.util';

const start = async (): Promise<void> => {
  scrapeLogger.info('Scraper worker connecting to RabbitMQ...');
  await connectRabbitMqWithRetry();
  await recoverStaleScrapeJobs();

  const handler = async (payload: Parameters<typeof processScrapeJob>[0]) => {
    const retryAttempt = payload.retryCount ?? 0;
    scrapeLogger.info('Scraper worker job started', {
      jobId: payload.jobId,
      retryAttempt,
    });
    const t0 = Date.now();
    await processScrapeJob(payload);
    scrapeLogger.info('Scraper worker job finished', {
      jobId: payload.jobId,
      durationSec: Math.round((Date.now() - t0) / 1000),
      retryAttempt,
    });
  };

  await consumeScrapeJobs(handler, COURSE_SCRAPING_QUEUE);
  await consumeScrapeJobs(handler, COURSE_SCRAPING_RETRY_QUEUE);
  scrapeLogger.info('Scraper worker listening');
};

const shutdown = async () => {
  scrapeLogger.info('Scraper worker shutting down');
  await closePlaywrightBrowser();
  await closeRabbitMq();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

start().catch(err => {
  scrapeLogger.error('Scraper worker fatal', { error: err });
  process.exit(1);
});
