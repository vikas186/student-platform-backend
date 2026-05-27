/**
 * Starts full local stack: RabbitMQ (optional) + API + scraper + enricher workers.
 *
 * Stop everything: npm run dev:stop
 * In the dev terminal: Ctrl+C also stops all three processes (concurrently -k).
 */
const { spawn, spawnSync } = require('child_process');
const net = require('net');

const isWin = process.platform === 'win32';
const API_PORT = process.env.PORT || '4001';
const RABBIT_PORT = parseInt(process.env.RABBITMQ_PORT || '5672', 10);

const freePort = port => {
  if (process.env.SKIP_PORT_KILL === '1') return;

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
      console.log(`[dev] Stopping stale process ${pid} on port ${port}`);
      spawnSync('taskkill', ['/PID', pid, '/F'], { stdio: 'ignore', shell: true });
    }
    return;
  }

  spawnSync('sh', ['-c', `lsof -ti:${port} | xargs kill -9 2>/dev/null || true`], { stdio: 'ignore' });
};

const startDocker = () => {
  if (process.env.SKIP_DOCKER === '1') {
    console.log('[dev] SKIP_DOCKER=1 — not starting RabbitMQ container');
    return false;
  }
  console.log('[dev] Starting RabbitMQ (docker compose up -d --wait rabbitmq)...');
  const r = spawnSync('docker', ['compose', 'up', '-d', '--wait', 'rabbitmq'], {
    stdio: 'inherit',
    shell: isWin,
  });
  if (r.status !== 0) {
    console.warn('[dev] RabbitMQ docker start failed — ensure Docker is running or set SKIP_DOCKER=1');
    return false;
  }
  return true;
};

const waitForTcp = (host, port, maxMs = 90_000) =>
  new Promise((resolve, reject) => {
    const deadline = Date.now() + maxMs;

    const tryOnce = () => {
      const socket = net.createConnection({ host, port }, () => {
        socket.destroy();
        resolve();
      });
      socket.setTimeout(3_000);
      socket.on('timeout', () => {
        socket.destroy();
        retry();
      });
      socket.on('error', () => {
        socket.destroy();
        retry();
      });
    };

    const retry = () => {
      if (Date.now() >= deadline) {
        reject(new Error(`Timed out waiting for ${host}:${port}`));
        return;
      }
      setTimeout(tryOnce, 2_000);
    };

    tryOnce();
  });

const runConcurrently = () => {
  console.log('[dev] Logs: [api]=server  [scraper]=Playwright worker  [enricher]=AI cleaning worker');
  console.log('[dev] Stop all: Ctrl+C here, or run npm run dev:stop in another terminal');
  const cmd =
    'npx concurrently -k --kill-others-on-fail -t -p time ' +
    '-n api,scraper,enricher -c blue,magenta,cyan ' +
    '"npm run dev:api" "npm run dev:worker" "npm run dev:worker:cleaner"';

  const child = spawn(cmd, { stdio: 'inherit', shell: true, cwd: process.cwd() });

  child.on('exit', code => process.exit(code ?? 0));
};

const waitForDockerRabbitMq = async (maxMs = 120_000) => {
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    const r = spawnSync('docker', ['exec', 'enroll-rabbitmq', 'rabbitmq-diagnostics', '-q', 'ping'], {
      encoding: 'utf8',
      shell: isWin,
    });
    if (r.status === 0) return;
    await new Promise(resolve => setTimeout(resolve, 2_000));
  }
  throw new Error('Timed out waiting for RabbitMQ diagnostics ping');
};

/** Wait until AMQP accepts connections from the host (port open != AMQP ready). */
const waitForAmqp = async (maxMs = 240_000) => {
  const path = require('path');
  require('dotenv').config({
    path: path.join(process.cwd(), 'config', `.env.${process.env.NODE_ENV || 'development'}`),
  });
  const url = process.env.RABBITMQ_URL || 'amqp://guest:guest@127.0.0.1:5672';
  const heartbeat = parseInt(process.env.RABBITMQ_HEARTBEAT || '0', 10);
  const amqp = require('amqplib');
  const deadline = Date.now() + maxMs;
  let attempt = 0;

  while (Date.now() < deadline) {
    attempt += 1;
    try {
      const conn = await amqp.connect(url, { heartbeat });
      await conn.close();
      if (attempt > 1) {
        console.log(`[dev] RabbitMQ AMQP ready after ${attempt} attempt(s)`);
      }
      return;
    } catch {
      await new Promise(resolve => setTimeout(resolve, 3_000));
    }
  }

  throw new Error('Timed out waiting for RabbitMQ AMQP connection');
};

const main = async () => {
  freePort(API_PORT);
  const dockerStarted = startDocker();

  if (dockerStarted) {
    console.log(`[dev] Waiting for RabbitMQ on port ${RABBIT_PORT}...`);
    try {
      await waitForTcp('127.0.0.1', RABBIT_PORT);
      await waitForDockerRabbitMq();
      await waitForAmqp();
      console.log('[dev] RabbitMQ is ready');
    } catch {
      console.warn('[dev] RabbitMQ not ready yet — workers will retry connection');
    }
  }

  runConcurrently();
};

main().catch(err => {
  console.error('[dev] Failed to start:', err);
  process.exit(1);
});
