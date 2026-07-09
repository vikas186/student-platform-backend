import cron from 'node-cron';
import { processAgentAgreementReminders } from '../modules/agent-agreement/agent-agreement-reminder.service';

export const registerAgentAgreementReminderCron = (): void => {
  if (process.env.CRON_AGENT_AGREEMENT_REMINDERS_ENABLED !== 'true') {
    console.log(
      '[email] Agent agreement reminder cron disabled (set CRON_AGENT_AGREEMENT_REMINDERS_ENABLED=true)',
    );
    return;
  }

  const schedule = process.env.CRON_AGENT_AGREEMENT_REMINDERS_SCHEDULE || '*/30 * * * *';

  cron.schedule(schedule, async () => {
    try {
      const result = await processAgentAgreementReminders();
      if (result.sent > 0) {
        console.log(`[email] Agent agreement reminders sent: ${result.sent}`);
      }
    } catch (err) {
      console.error(
        '[email] Agent agreement reminder cron failed:',
        err instanceof Error ? err.message : err,
      );
    }
  });

  console.log('[email] Agent agreement reminder cron registered', { schedule });
};
