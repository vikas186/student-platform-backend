/**
 * Stops full local dev stack: workers + API + port 4001 + RabbitMQ (optional).
 *
 * Usage:
 *   npm run dev:stop              # stop processes + RabbitMQ docker
 *   npm run dev:stop -- --jobs    # also cancel in-flight scrape jobs in DB
 *   KEEP_DOCKER=1 npm run dev:stop  # leave RabbitMQ container running
 */
const { spawnSync } = require('child_process');
const path = require('path');

const isWin = process.platform === 'win32';
const projectRoot = path.resolve(__dirname, '..');
const API_PORT = process.env.PORT || '4001';
const cancelJobs = process.argv.includes('--jobs') || process.env.CANCEL_SCRAPE_JOBS === '1';

const freePort = port => {
  if (isWin) {
    const result = spawnSync('netstat', ['-ano'], { encoding: 'utf8', shell: true });
    const pids = new Set();
    for (const line of (result.stdout || '').split('\n')) {
      if (!line.includes('LISTENING') || !line.includes(`:${port}`)) continue;
      const parts = line.trim().split(/\s+/);
      const pid = parts[parts.length - 1];
      if (pid && /^\d+$/.test(pid) && pid !== '0') pids.add(pid);
    }
    for (const pid of pids) {
      console.log(`[dev:stop] Freeing port ${port} (PID ${pid})`);
      spawnSync('taskkill', ['/PID', pid, '/F'], { stdio: 'ignore', shell: true });
    }
    return;
  }

  spawnSync('sh', ['-c', `lsof -ti:${port} | xargs kill -9 2>/dev/null || true`], { stdio: 'ignore' });
};

const killProjectNodeProcesses = () => {
  if (isWin) {
    const ps = `
Get-CimInstance Win32_Process -Filter "name='node.exe'" |
  Where-Object {
    $_.CommandLine -match 'student-paltform-backend' -or
    $_.CommandLine -match 'scripts\\\\dev-start\\.js'
  } |
  ForEach-Object {
    Write-Host "[dev:stop] Killing node PID $($_.ProcessId)"
    Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
  }
`;
    spawnSync('powershell', ['-NoProfile', '-Command', ps], { stdio: 'inherit' });
    return;
  }

  spawnSync(
    'sh',
    [
      '-c',
      "pkill -f 'student-paltform-backend' 2>/dev/null || true; pkill -f 'scripts/dev-start.js' 2>/dev/null || true",
    ],
    { stdio: 'inherit' },
  );
};

const stopDocker = () => {
  if (process.env.KEEP_DOCKER === '1') {
    console.log('[dev:stop] KEEP_DOCKER=1 — RabbitMQ container left running');
    return;
  }
  console.log('[dev:stop] Stopping RabbitMQ (docker compose stop rabbitmq)...');
  spawnSync('docker', ['compose', 'stop', 'rabbitmq'], {
    cwd: projectRoot,
    stdio: 'inherit',
    shell: isWin,
  });
};

const cancelScrapeJobs = () => {
  if (!cancelJobs) return;
  console.log('[dev:stop] Cancelling active scrape jobs...');
  spawnSync('npm', ['run', 'scrape:cancel'], { cwd: projectRoot, stdio: 'inherit', shell: true });
};

console.log('[dev:stop] Stopping Enroll dev stack...');
cancelScrapeJobs();
killProjectNodeProcesses();
freePort(API_PORT);
stopDocker();
console.log('[dev:stop] Done. Start again with: npm run dev');
