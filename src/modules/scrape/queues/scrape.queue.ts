import amqp, { Channel, ChannelModel, ConsumeMessage } from 'amqplib';
import {
  COURSE_CLEANING_DLQ,
  COURSE_CLEANING_QUEUE,
  COURSE_CLEANING_RETRY_QUEUE,
  COURSE_SCRAPING_DLQ,
  COURSE_SCRAPING_QUEUE,
  COURSE_SCRAPING_RETRY_QUEUE,
} from '../config/scrape.constants';
import { scrapeLogger } from '../logger';
import type { CleaningJobMessage, ScrapeJobMessage } from '../scrapers/types';

let connection: ChannelModel | null = null;
let channel: Channel | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let reconnectAttempt = 0;
let shuttingDown = false;

type ConsumerHandler = (payload: unknown) => Promise<void>;

const consumerRegistrations: Array<{ queueName: string; handler: ConsumerHandler }> = [];

const rabbitUrl = () => process.env.RABBITMQ_URL || 'amqp://guest:guest@127.0.0.1:5672';

/** Match server heartbeat (docker/rabbitmq.conf sets heartbeat=0). */
const rabbitHeartbeat = (): number => parseInt(process.env.RABBITMQ_HEARTBEAT ?? '0', 10);

const RECONNECT_BASE_MS = 3_000;
const RECONNECT_MAX_MS = 60_000;

const resetConnectionState = (): void => {
  channel = null;
  connection = null;
};

const scheduleReconnect = (): void => {
  if (shuttingDown || reconnectTimer || consumerRegistrations.length === 0) return;

  const delay = Math.min(RECONNECT_BASE_MS * 2 ** reconnectAttempt, RECONNECT_MAX_MS);
  reconnectAttempt += 1;

  scrapeLogger.warn('RabbitMQ reconnect scheduled', { delayMs: delay, attempt: reconnectAttempt });

  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    void reconnectAndResubscribe();
  }, delay);
};

const reconnectAndResubscribe = async (): Promise<void> => {
  if (shuttingDown) return;

  try {
    resetConnectionState();
    await connectRabbitMq();
    await registerAllConsumers();
    reconnectAttempt = 0;
    scrapeLogger.info('RabbitMQ reconnected and consumers restored');
  } catch (err) {
    scrapeLogger.error('RabbitMQ reconnect failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    scheduleReconnect();
  }
};

export const connectRabbitMq = async (): Promise<Channel> => {
  if (channel) return channel;

  connection = await amqp.connect(rabbitUrl(), { heartbeat: rabbitHeartbeat() });

  connection.on('error', err => {
    scrapeLogger.error('RabbitMQ connection error', { error: err?.message || String(err) });
  });

  connection.on('close', () => {
    scrapeLogger.warn('RabbitMQ connection closed');
    resetConnectionState();
    scheduleReconnect();
  });

  channel = await connection.createChannel();
  await assertQueues(channel);
  return channel;
};

/** Connect with retries — used on worker boot when RabbitMQ may still be starting. */
export const connectRabbitMqWithRetry = async (): Promise<Channel> => {
  const maxAttempts = parseInt(process.env.RABBITMQ_CONNECT_RETRIES || '60', 10);
  const delayMs = parseInt(process.env.RABBITMQ_CONNECT_DELAY_MS || '5000', 10);
  let lastErr: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      resetConnectionState();
      return await connectRabbitMq();
    } catch (err) {
      lastErr = err;
      scrapeLogger.warn('RabbitMQ connect failed', {
        attempt,
        maxAttempts,
        error: err instanceof Error ? err.message : String(err),
      });
      if (attempt < maxAttempts) {
        await new Promise(r => setTimeout(r, delayMs));
      }
    }
  }

  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
};

export const assertQueues = async (ch: Channel): Promise<void> => {
  await ch.assertQueue(COURSE_SCRAPING_DLQ, { durable: true });
  await ch.assertQueue(COURSE_SCRAPING_RETRY_QUEUE, {
    durable: true,
    deadLetterExchange: '',
    deadLetterRoutingKey: COURSE_SCRAPING_DLQ,
  });
  await ch.assertQueue(COURSE_SCRAPING_QUEUE, {
    durable: true,
    deadLetterExchange: '',
    deadLetterRoutingKey: COURSE_SCRAPING_RETRY_QUEUE,
  });

  await ch.assertQueue(COURSE_CLEANING_DLQ, { durable: true });
  await ch.assertQueue(COURSE_CLEANING_RETRY_QUEUE, {
    durable: true,
    deadLetterExchange: '',
    deadLetterRoutingKey: COURSE_CLEANING_DLQ,
  });
  await ch.assertQueue(COURSE_CLEANING_QUEUE, {
    durable: true,
    deadLetterExchange: '',
    deadLetterRoutingKey: COURSE_CLEANING_RETRY_QUEUE,
  });
};

const safeAck = (ch: Channel, msg: ConsumeMessage): void => {
  try {
    ch.ack(msg);
  } catch (err) {
    scrapeLogger.warn('Failed to ack message (connection may have dropped)', {
      error: err instanceof Error ? err.message : String(err),
    });
  }
};

const safeNack = (ch: Channel, msg: ConsumeMessage): void => {
  try {
    ch.nack(msg, false, false);
  } catch {
    /* connection gone — message will be redelivered when consumer reconnects */
  }
};

const registerConsumer = async (queueName: string, handler: ConsumerHandler): Promise<void> => {
  const ch = await connectRabbitMq();
  await ch.prefetch(1);
  await ch.consume(queueName, async (msg: ConsumeMessage | null) => {
    if (!msg) return;

    let payload: unknown;
    try {
      payload = JSON.parse(msg.content.toString());
    } catch {
      safeNack(ch, msg);
      return;
    }

    try {
      await handler(payload);
      safeAck(ch, msg);
    } catch (err) {
      scrapeLogger.error('Queue job failed', {
        queue: queueName,
        error: err instanceof Error ? err.message : String(err),
      });
      safeNack(ch, msg);
    }
  });
};

const registerAllConsumers = async (): Promise<void> => {
  for (const { queueName, handler } of consumerRegistrations) {
    await registerConsumer(queueName, handler);
  }
};

const subscribe = async (handler: ConsumerHandler, queueName: string): Promise<void> => {
  const existing = consumerRegistrations.find(c => c.queueName === queueName);
  if (!existing) {
    consumerRegistrations.push({ queueName, handler });
  }
  await registerConsumer(queueName, handler);
};

export const publishScrapeJob = async (payload: ScrapeJobMessage): Promise<void> => {
  const ch = await connectRabbitMq();
  ch.sendToQueue(COURSE_SCRAPING_QUEUE, Buffer.from(JSON.stringify(payload)), {
    persistent: true,
    contentType: 'application/json',
  });
};

export const publishScrapeRetryJob = async (payload: ScrapeJobMessage): Promise<void> => {
  const ch = await connectRabbitMq();
  ch.sendToQueue(COURSE_SCRAPING_RETRY_QUEUE, Buffer.from(JSON.stringify(payload)), {
    persistent: true,
    contentType: 'application/json',
    expiration: String(30_000),
  });
};

export const publishScrapeDeadLetter = async (payload: ScrapeJobMessage, error: string): Promise<void> => {
  const ch = await connectRabbitMq();
  ch.sendToQueue(
    COURSE_SCRAPING_DLQ,
    Buffer.from(JSON.stringify({ ...payload, error })),
    { persistent: true, contentType: 'application/json' },
  );
};

export const publishCleaningJob = async (payload: CleaningJobMessage): Promise<void> => {
  const ch = await connectRabbitMq();
  ch.sendToQueue(COURSE_CLEANING_QUEUE, Buffer.from(JSON.stringify(payload)), {
    persistent: true,
    contentType: 'application/json',
  });
};

export const publishCleaningRetryJob = async (payload: CleaningJobMessage): Promise<void> => {
  const ch = await connectRabbitMq();
  ch.sendToQueue(COURSE_CLEANING_RETRY_QUEUE, Buffer.from(JSON.stringify(payload)), {
    persistent: true,
    contentType: 'application/json',
    expiration: String(30_000),
  });
};

export const publishCleaningDeadLetter = async (
  payload: CleaningJobMessage,
  error: string,
): Promise<void> => {
  const ch = await connectRabbitMq();
  ch.sendToQueue(
    COURSE_CLEANING_DLQ,
    Buffer.from(JSON.stringify({ ...payload, error })),
    { persistent: true, contentType: 'application/json' },
  );
};

export const consumeScrapeJobs = (
  handler: (payload: ScrapeJobMessage) => Promise<void>,
  queue = COURSE_SCRAPING_QUEUE,
) => subscribe(handler as ConsumerHandler, queue);

export const consumeCleaningJobs = (
  handler: (payload: CleaningJobMessage) => Promise<void>,
  queue = COURSE_CLEANING_QUEUE,
) => subscribe(handler as ConsumerHandler, queue);

export const closeRabbitMq = async (): Promise<void> => {
  shuttingDown = true;
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  try {
    await channel?.close();
  } catch {
    /* ignore */
  }
  try {
    await connection?.close();
  } catch {
    /* ignore */
  }
  resetConnectionState();
  consumerRegistrations.length = 0;
};
