export const COURSE_SCRAPING_QUEUE = 'course_scraping_queue';
export const COURSE_SCRAPING_RETRY_QUEUE = 'course_scraping_retry_queue';
export const COURSE_SCRAPING_DLQ = 'course_scraping_dead_letter_queue';

export const COURSE_CLEANING_QUEUE = 'course_cleaning_queue';
export const COURSE_CLEANING_RETRY_QUEUE = 'course_cleaning_retry_queue';
export const COURSE_CLEANING_DLQ = 'course_cleaning_dead_letter_queue';

export const SCRAPE_USER_AGENT =
  process.env.SCRAPE_USER_AGENT ||
  'UniwizerPlatformBot/1.0 (+https://uniwizer.com; course-research)';

export const SCRAPE_MAX_RETRIES = parseInt(process.env.SCRAPE_MAX_RETRIES || '3', 10);
export const CLEAN_MAX_RETRIES = parseInt(
  process.env.CLEAN_MAX_RETRIES || process.env.SCRAPE_MAX_RETRIES || '3',
  10,
);
export const SCRAPE_TIMEOUT_MS = parseInt(process.env.SCRAPE_TIMEOUT_MS || '120000', 10);
export const SCRAPE_DELAY_MS = parseInt(process.env.SCRAPE_RATE_LIMIT_MS || '2000', 10);
export const SCRAPE_MAX_PAGES = parseInt(process.env.SCRAPE_MAX_PAGES || '25', 10);
export const SCRAPE_MAX_DETAIL_PAGES = parseInt(process.env.SCRAPE_MAX_DETAIL_PAGES || '15', 10);
export const SCRAPE_MAX_API_RESPONSES = parseInt(process.env.SCRAPE_MAX_API_RESPONSES || '24', 10);
export const SCRAPE_PAGE_RETRIES = parseInt(process.env.SCRAPE_PAGE_RETRIES || '3', 10);
export const SCRAPE_PAGE_WAIT_MS = parseInt(process.env.SCRAPE_PAGE_WAIT_MS || '3000', 10);
export const SCRAPE_RANDOM_DELAY_MIN_MS = parseInt(process.env.SCRAPE_RANDOM_DELAY_MIN_MS || '1000', 10);
export const SCRAPE_RANDOM_DELAY_MAX_MS = parseInt(process.env.SCRAPE_RANDOM_DELAY_MAX_MS || '3000', 10);

export const SCRAPE_USER_AGENTS = [
  process.env.SCRAPE_USER_AGENT ||
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0',
];

export const pickRandomUserAgent = (): string =>
  SCRAPE_USER_AGENTS[Math.floor(Math.random() * SCRAPE_USER_AGENTS.length)];

export const randomScrapeDelay = (): number =>
  SCRAPE_RANDOM_DELAY_MIN_MS +
  Math.floor(Math.random() * (SCRAPE_RANDOM_DELAY_MAX_MS - SCRAPE_RANDOM_DELAY_MIN_MS + 1));
