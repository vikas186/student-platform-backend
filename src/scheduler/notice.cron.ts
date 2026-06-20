import cron from 'node-cron';
import { syncNoticesFromAi } from '../modules/notices/notice-ai.service';

export const registerNoticeCron = (): void => {
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
