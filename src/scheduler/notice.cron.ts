import cron from 'node-cron';
import { syncNoticesFromAi } from '../modules/notices/notice-ai.service';
import {
  getNoticeRetentionDays,
  purgeNoticesOlderThanRetention,
} from '../modules/notices/notice.service';

async function runNoticePurge(): Promise<void> {
  const deleted = await purgeNoticesOlderThanRetention();
  if (deleted > 0) {
    console.log('[notices] Purged old notices', {
      deleted,
      retentionDays: getNoticeRetentionDays(),
    });
  }
}

export const registerNoticeCron = (): void => {
  const retentionDays = getNoticeRetentionDays();
  const purgeSchedule = process.env.CRON_NOTICES_PURGE_SCHEDULE || '0 2 * * *';

  void runNoticePurge().catch(err => {
    console.error(
      '[notices] Startup purge failed:',
      err instanceof Error ? err.message : err,
    );
  });

  cron.schedule(purgeSchedule, async () => {
    try {
      await runNoticePurge();
    } catch (err) {
      console.error('[notices] Purge cron failed:', err instanceof Error ? err.message : err);
    }
  });

  console.log('[notices] Notice purge cron registered', { purgeSchedule, retentionDays });

  if (process.env.CRON_NOTICES_ENABLED !== 'true') {
    console.log('[notices] Notice AI cron disabled (set CRON_NOTICES_ENABLED=true)');
    return;
  }

  const schedule = process.env.CRON_NOTICES_SCHEDULE || '0 */6 * * *';

  cron.schedule(schedule, async () => {
    try {
      const result = await syncNoticesFromAi();
      console.log('[notices] AI sync finished', {
        schedule,
        inserted: result.inserted,
        deactivated: result.deactivated,
        errors: result.errors.length,
      });
      if (result.errors.length) {
        console.warn('[notices] AI sync warnings:', result.errors.slice(0, 5));
      }
    } catch (err) {
      console.error('[notices] AI sync cron failed:', err instanceof Error ? err.message : err);
    }
  });

  console.log('[notices] Notice AI cron registered', { schedule });
};
