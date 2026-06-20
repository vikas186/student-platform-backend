import cron from 'node-cron';
import { processCounsellingReminders } from '../modules/scheduling/counselling-reminder.service';

export const registerCounsellingReminderCron = (): void => {
  if (process.env.CRON_COUNSELLING_REMINDERS_ENABLED !== 'true') {
    console.log('[email] Counselling reminder cron disabled (set CRON_COUNSELLING_REMINDERS_ENABLED=true)');
    return;
  }

  const schedule = process.env.CRON_COUNSELLING_REMINDERS_SCHEDULE || '*/15 * * * *';

  cron.schedule(schedule, async () => {
    try {
      const result = await processCounsellingReminders();
      if (result.sent > 0) {
        console.log(`[email] Counselling reminders sent: ${result.sent}`);
      }
    } catch (err) {
      console.error('[email] Counselling reminder cron failed:', err instanceof Error ? err.message : err);
    }
  });

  console.log('[email] Counselling reminder cron registered', { schedule });
};
