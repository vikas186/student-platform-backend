import dotenv from 'dotenv';
dotenv.config({ path: `config/.env.${process.env.NODE_ENV || 'development'}` });

import {
  COURSE_CLEANING_QUEUE,
  COURSE_CLEANING_RETRY_QUEUE,
} from '../src/modules/scrape/config/scrape.constants';
import { scrapeLogger } from '../src/modules/scrape/logger';
import {
  closeRabbitMq,
  connectRabbitMqWithRetry,
  consumeCleaningJobs,
} from '../src/modules/scrape/queues/scrape.queue';
import { processCleaningJob } from '../src/modules/scrape/scrape.processor';
import { recoverStaleCleaningJobs } from '../src/modules/scrape/recover-stale-jobs';

const start = async (): Promise<void> => {
  scrapeLogger.info('Cleaner worker connecting to RabbitMQ...');
  await connectRabbitMqWithRetry();
  await recoverStaleCleaningJobs();

  const handler = async (payload: Parameters<typeof processCleaningJob>[0]) => {
    const retryAttempt = payload.retryCount ?? 0;
    scrapeLogger.info('Cleaner worker job started', {
      jobId: payload.jobId,
      rawBatchId: payload.rawBatchId,
      retryAttempt,
    });
    const t0 = Date.now();
    await processCleaningJob(payload);
    scrapeLogger.info('Cleaner worker job finished', {
      jobId: payload.jobId,
      durationSec: Math.round((Date.now() - t0) / 1000),
      retryAttempt,
    });
  };

  await consumeCleaningJobs(handler, COURSE_CLEANING_QUEUE);
  await consumeCleaningJobs(handler, COURSE_CLEANING_RETRY_QUEUE);
  scrapeLogger.info('Cleaner worker listening');
};

const shutdown = async () => {
  scrapeLogger.info('Cleaner worker shutting down');
  await closeRabbitMq();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

start().catch(err => {
  scrapeLogger.error('Cleaner worker fatal', { error: err });
  process.exit(1);
});
