import winston from 'winston';

const logLevel = process.env.SCRAPE_LOG_LEVEL || 'info';

export const scrapeLogger = winston.createLogger({
  level: logLevel,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      const extra = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
      return `${timestamp} [scrape] ${level}: ${message}${extra}`;
    }),
  ),
  transports: [
    new winston.transports.Console({
      // stderr flushes more reliably in Windows + concurrently multiplexed terminals
      stderrLevels: ['error', 'warn', 'info', 'debug'],
    }),
    new winston.transports.File({ 
      filename: process.env.SCRAPE_LOG_FILE || 'debug/logs/scrape.log' 
    }),
  ],
});
