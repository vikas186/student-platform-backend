import { Op } from 'sequelize';
import { db } from '../../../config/database';
import { scrapeLogger } from './logger';
import { publishCleaningJob, publishScrapeJob } from './queues/scrape.queue';

const staleCutoff = (): Date => {
  const ms = parseInt(process.env.SCRAPE_STALE_JOB_MS || '120000', 10);
  return new Date(Date.now() - Math.max(30_000, ms));
};

/** Re-queue scrape jobs left in active states after a worker crash or dev restart. */
export const recoverStaleScrapeJobs = async (): Promise<number> => {
  const cutoff = staleCutoff();
  const stuck = await db.ScrapeJob.findAll({
    where: {
      status: { [Op.in]: ['pending', 'running', 'scraping'] },
      updatedAt: { [Op.lt]: cutoff },
    },
    order: [['updatedAt', 'ASC']],
  });

  for (const job of stuck) {
    scrapeLogger.warn('Recovering stale scrape job', {
      jobId: job.id,
      status: job.status,
      source: job.source,
      updatedAt: job.updatedAt,
    });
    await publishScrapeJob({ jobId: job.id, retryCount: 0 });
    await job.update({
      status: 'running',
      errorMessage: 'Recovered after worker restart',
    });
  }

  if (stuck.length) {
    scrapeLogger.info('Stale scrape jobs re-queued', { count: stuck.length });
  }
  return stuck.length;
};

/** Re-queue cleaning jobs stuck after scraper finished but enricher died. */
export const recoverStaleCleaningJobs = async (): Promise<number> => {
  const cutoff = staleCutoff();
  const stuck = await db.ScrapeJob.findAll({
    where: {
      status: { [Op.in]: ['pending_cleaning', 'cleaning'] },
      updatedAt: { [Op.lt]: cutoff },
    },
    order: [['updatedAt', 'ASC']],
  });

  let recovered = 0;
  for (const job of stuck) {
    const batch = await db.RawScrapeBatch.findOne({
      where: { jobId: job.id, status: { [Op.in]: ['pending_cleaning', 'cleaning', 'failed'] } },
      order: [['createdAt', 'DESC']],
    });
    if (!batch) {
      scrapeLogger.warn('Stale cleaning job has no batch — marking failed', { jobId: job.id });
      await job.update({
        status: 'failed',
        errorMessage: 'Cleaning batch missing after worker restart',
        completedAt: new Date(),
      });
      continue;
    }

    scrapeLogger.warn('Recovering stale cleaning job', {
      jobId: job.id,
      rawBatchId: batch.rawBatchId,
      status: job.status,
    });
    await batch.update({ status: 'pending_cleaning', errorMessage: null });
    await publishCleaningJob({ jobId: job.id, rawBatchId: batch.rawBatchId, retryCount: 0 });
    await job.update({
      status: 'pending_cleaning',
      errorMessage: 'Recovered after worker restart',
    });
    recovered++;
  }

  if (recovered) {
    scrapeLogger.info('Stale cleaning jobs re-queued', { count: recovered });
  }
  return recovered;
};
