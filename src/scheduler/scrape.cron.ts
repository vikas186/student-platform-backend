import cron from 'node-cron';
import type { ScrapePreset } from '../../models/ScrapeJob.model';
import { SCRAPE_PRESETS } from '../../models/ScrapeJob.model';
import { resolveScrapeTarget } from '../modules/scrape/config/scrape-target.util';
import { scrapeLogger } from '../modules/scrape/logger';
import { startScrapeJob } from '../modules/scrape/scrape.processor';

export const registerScrapeCron = (): void => {
  if (process.env.CRON_SCRAPE_ENABLED !== 'true') {
    scrapeLogger.info('Scrape cron disabled (set CRON_SCRAPE_ENABLED=true)');
    return;
  }

  const schedule = process.env.CRON_SCRAPE_SCHEDULE || '0 2 * * *';
  const presets = (process.env.CRON_SCRAPE_SOURCES || 'IDP,AECC')
    .split(',')
    .map(s => s.trim().toUpperCase())
    .filter((s): s is ScrapePreset => (SCRAPE_PRESETS as readonly string[]).includes(s));

  cron.schedule(schedule, async () => {
    scrapeLogger.info('Cron scrape started', { schedule, presets });
    for (const preset of presets) {
      try {
        const target = resolveScrapeTarget({ source: preset });
        const { jobId } = await startScrapeJob(target, 'cron');
        scrapeLogger.info('Cron scrape job queued', { preset, jobId, targetUrl: target.targetUrl });
      } catch (err) {
        scrapeLogger.warn('Cron scrape skipped', {
          preset,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  });

  scrapeLogger.info('Scrape cron registered', { schedule, presets });
};
