import { randomUUID } from 'crypto';
import { db } from '../../../config/database';
import type { ScrapeTrigger } from '../../../models/ScrapeJob.model';
import { toSourceConfig, resolveJobSource, type ResolvedScrapeTarget } from './config/scrape-target.util';
import { saveRawScrapeJson } from './debug/scrape-debug.util';
import { CLEAN_MAX_RETRIES, SCRAPE_MAX_RETRIES } from './config/scrape.constants';
import { scrapeLogger } from './logger';
import {
  publishCleaningDeadLetter,
  publishCleaningJob,
  publishCleaningRetryJob,
  publishScrapeDeadLetter,
  publishScrapeRetryJob,
} from './queues/scrape.queue';
import { scrapeWebsite } from './scrapers/generic.scraper';
import type { CleaningJobMessage, ScrapeJobMessage } from './scrapers/types';
import { closePlaywrightBrowser } from './scrapers/playwright.util';
import { processEnrichmentPipeline } from './orchestrator/enrichment.orchestrator';

const ACTIVE_STATUSES = ['pending', 'running', 'scraping', 'pending_cleaning', 'cleaning'] as const;

export const processScrapeJob = async (payload: ScrapeJobMessage): Promise<void> => {
  const { jobId } = payload;
  const retryCount = payload.retryCount ?? 0;
  const t0 = Date.now();

  const job = await db.ScrapeJob.findByPk(jobId);
  if (!job) {
    scrapeLogger.warn('Scrape job not found', { jobId });
    return;
  }

  const targetUrl = job.targetUrl || job.seedUrls?.[0] || '';
  const source = resolveJobSource(job);

  if (!targetUrl) {
    scrapeLogger.warn('Scrape job missing target URL', { jobId });
    await job.update({ status: 'failed', errorMessage: 'Missing target URL', completedAt: new Date() });
    return;
  }

  const config = toSourceConfig({
    source,
    targetUrl,
    targetName: job.targetName || source,
    seedUrls: job.seedUrls?.length ? job.seedUrls : [targetUrl],
    maxPages: Number((job.stats as { maxPages?: number })?.maxPages) || parseInt(process.env.SCRAPE_MAX_PAGES || '25', 10),
    maxDetailPages:
      Number((job.stats as { maxDetailPages?: number })?.maxDetailPages) ||
      parseInt(process.env.SCRAPE_MAX_DETAIL_PAGES || '15', 10),
  });

  try {
    await job.update({ status: 'scraping', startedAt: job.startedAt || new Date(), errorMessage: null });

    scrapeLogger.info('Scrape job started', {
      jobId,
      source,
      targetUrl,
      maxPages: config.maxPages,
      maxDetailPages: config.maxDetailPages,
      retryAttempt: retryCount,
    });

    const baseStats = (job.stats as Record<string, unknown>) || {};

    const result = await scrapeWebsite(config, {
      onProgress: async progress => {
        await job.update({
          updatedAt: new Date(),
          stats: {
            ...baseStats,
            totalPages: progress.totalPages ?? baseStats.totalPages,
            coursesFound: progress.coursesFound ?? 0,
            universitiesFound: progress.universitiesFound ?? 0,
            feesFound: progress.feesFound ?? 0,
            scholarshipsFound: progress.scholarshipsFound ?? 0,
            rejectedPages: progress.rejectedPages ?? 0,
            currentPage: progress.currentPage,
            currentUrl: progress.currentUrl,
          },
        });
      },
    });
    const rawBatchId = randomUUID();
    const totalEntities =
      result.courses.length +
      result.universities.length +
      result.fees.length +
      result.scholarships.length;

    await saveRawScrapeJson(source, jobId, result, job.targetUrl);

    scrapeLogger.info('Scrape completed', {
      source,
      targetUrl: job.targetUrl,
      jobId,
      totalPages: result.pagesVisited,
      coursesFound: result.courses.length,
      universitiesFound: result.universities.length,
      feesFound: result.fees.length,
      scholarshipsFound: result.scholarships.length,
      rejectedPages: result.rejectedPages.length,
      durationSec: Math.round((Date.now() - t0) / 1000),
      retryAttempt: retryCount,
    });

    const batch = await db.RawScrapeBatch.create({
      jobId,
      rawBatchId,
      source,
      rawPayload: {
        targetUrl: job.targetUrl,
        targetName: job.targetName,
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
      status: 'pending_cleaning',
      stats: {
        totalPages: result.pagesVisited,
        coursesFound: result.courses.length,
        universitiesFound: result.universities.length,
        feesFound: result.fees.length,
        scholarshipsFound: result.scholarships.length,
        rejectedPages: result.rejectedPages.length,
        apiResponseCount: result.apiResponseCount,
      },
    });

    await publishCleaningJob({ jobId, rawBatchId, retryCount: 0 });
    scrapeLogger.info('Raw scrape saved, cleaning queued', { jobId, rawBatchId, batchId: batch.id, totalEntities });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    scrapeLogger.error('Scrape job failed', {
      jobId,
      source,
      targetUrl,
      errorMessage: message,
      retryAttempt: retryCount,
    });

    if (retryCount + 1 < SCRAPE_MAX_RETRIES) {
      await publishScrapeRetryJob({ ...payload, retryCount: retryCount + 1 });
      await job.update({ status: 'pending', errorMessage: message });
      return;
    }

    await publishScrapeDeadLetter(payload, message);
    await job.update({ status: 'failed', errorMessage: message, completedAt: new Date() });
  } finally {
    await closePlaywrightBrowser();
  }
};

export const processCleaningJob = async (payload: CleaningJobMessage): Promise<void> => {
  const { jobId, rawBatchId } = payload;
  const retryCount = payload.retryCount ?? 0;
  const t0 = Date.now();

  const job = await db.ScrapeJob.findByPk(jobId);
  const batch = await db.RawScrapeBatch.findOne({ where: { jobId, rawBatchId } });

  if (!job || !batch) {
    scrapeLogger.warn('Cleaning job missing batch', { jobId, rawBatchId });
    return;
  }

  const source = resolveJobSource(job, batch);
  if (!job.source?.trim()) {
    await job.update({ source });
  }

  scrapeLogger.info('Cleaning job started', {
    jobId,
    rawBatchId,
    source,
    courses: (batch.rawCourses || []).length,
    universities: (batch.rawUniversities || []).length,
    scholarships: (batch.rawScholarships || []).length,
    retryAttempt: retryCount,
  });

  try {
    await job.update({ status: 'cleaning' });
    await batch.update({ status: 'cleaning' });

    const stats = await processEnrichmentPipeline(jobId, rawBatchId, source, {
      courses: batch.rawCourses || [],
      universities: batch.rawUniversities || [],
      scholarships: batch.rawScholarships || [],
      fees: batch.rawFees || [],
      rejectedPages: batch.rejectedPages || [],
    });

    const totalFound =
      stats.coursesFound + stats.universitiesFound + stats.feesFound + stats.scholarshipsFound;
    const hasPersisted =
      (stats.persisted?.courses ?? 0) > 0 ||
      (stats.persisted?.universities ?? 0) > 0 ||
      (stats.persisted?.scholarships ?? 0) > 0 ||
      (stats.persisted?.fees ?? 0) > 0;
    const hasReviewable = (stats.validCount ?? 0) > 0 || (stats.needsReviewCount ?? 0) > 0;
    const jobCompleted = hasPersisted || hasReviewable;

    await batch.update({ status: 'cleaned', errorMessage: null });
    await job.update({
      status: jobCompleted ? 'completed' : 'failed',
      completedAt: new Date(),
      errorMessage: jobCompleted
        ? null
        : totalFound > 0
          ? 'All scraped entities failed validation'
          : 'Scraper returned zero entities',
      stats: {
        totalPages: (job.stats as { totalPages?: number })?.totalPages ?? 0,
        coursesFound: stats.coursesFound,
        universitiesFound: stats.universitiesFound,
        feesFound: stats.feesFound,
        scholarshipsFound: stats.scholarshipsFound,
        rejectedPages: stats.rejectedPages,
        validCount: stats.validCount,
        needsReviewCount: stats.needsReviewCount,
        rejectedCount: stats.rejectedCount,
        duplicates: stats.duplicates,
        persisted: stats.persisted,
      },
    });

    scrapeLogger.info('Cleaning job summary', {
      source,
      targetUrl: job.targetUrl,
      jobId,
      ...stats,
      durationSec: Math.round((Date.now() - t0) / 1000),
      retryAttempt: retryCount,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await batch.update({ status: 'failed', errorMessage: message }).catch(() => undefined);

    if (retryCount + 1 < CLEAN_MAX_RETRIES) {
      await publishCleaningRetryJob({ ...payload, retryCount: retryCount + 1 });
      await job.update({ status: 'pending_cleaning', errorMessage: message });
      return;
    }

    await publishCleaningDeadLetter(payload, message);
    await job.update({ status: 'failed', errorMessage: message, completedAt: new Date() });
  }
};

export const startScrapeJob = async (
  target: ResolvedScrapeTarget,
  trigger: ScrapeTrigger = 'manual',
): Promise<{ jobId: string }> => {
  const running = await db.ScrapeJob.findOne({
    where: { targetUrl: target.targetUrl, status: [...ACTIVE_STATUSES] },
  });
  if (running) {
    throw new Error(`A scrape job for ${target.targetUrl} is already in progress`);
  }

  const job = await db.ScrapeJob.create({
    source: target.source,
    targetUrl: target.targetUrl,
    targetName: target.targetName,
    seedUrls: target.seedUrls,
    status: 'pending',
    triggerType: trigger,
    stats: { maxPages: target.maxPages, maxDetailPages: target.maxDetailPages },
  });

  const { publishScrapeJob } = await import('./queues/scrape.queue');
  await publishScrapeJob({ jobId: job.id, retryCount: 0 });
  await job.update({ status: 'running' });

  return { jobId: job.id };
};
