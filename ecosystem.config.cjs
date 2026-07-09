/** PM2 process config — used by GitHub Actions deploy and manual restarts. */
module.exports = {
  apps: [
    {
      name: 'enroll-api',
      script: 'dist/server.js',
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '512M',
      env_production: {
        NODE_ENV: 'production',
        PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD: '1',
      },
      env_staging: {
        NODE_ENV: 'production',
        PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD: '1',
      },
    },
    {
      name: 'enroll-scraper',
      script: 'dist/workers/scraper.worker.js',
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '1536M',
      env_production: {
        NODE_ENV: 'production',
        SKIP_DB_SYNC: '1',
      },
      env_staging: {
        NODE_ENV: 'production',
        SKIP_DB_SYNC: '1',
      },
    },
    {
      name: 'enroll-cleaner',
      script: 'dist/workers/cleaner.worker.js',
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '1024M',
      env_production: {
        NODE_ENV: 'production',
        SKIP_DB_SYNC: '1',
      },
      env_staging: {
        NODE_ENV: 'production',
        SKIP_DB_SYNC: '1',
      },
    },
  ],
};
