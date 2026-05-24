import { URL } from 'url';
import { SCRAPE_USER_AGENT } from '../config/scrape.constants';

type RobotsRule = { allow: boolean; path: string };

const cache = new Map<string, { fetchedAt: number; rules: RobotsRule[] }>();
const CACHE_TTL_MS = 60 * 60 * 1000;

const parseRobots = (body: string, agent: string): RobotsRule[] => {
  const lines = body.split('\n').map(l => l.trim());
  const groups: { agents: string[]; rules: RobotsRule[] }[] = [];
  let current: { agents: string[]; rules: RobotsRule[] } | null = null;

  for (const line of lines) {
    if (!line || line.startsWith('#')) continue;
    const [directive, ...rest] = line.split(':');
    if (!directive?.trim()) continue;
    const value = rest.join(':').trim();
    const key = directive.trim().toLowerCase();
    if (key === 'user-agent') {
      current = { agents: [(value || '*').toLowerCase()], rules: [] };
      groups.push(current);
    } else if (current && (key === 'allow' || key === 'disallow')) {
      current.rules.push({ allow: key === 'allow', path: value || '/' });
    }
  }

  const agentLower = (agent || '*').toLowerCase();
  const matched =
    groups.find(g => g.agents.includes(agentLower)) ||
    groups.find(g => g.agents.includes('*')) ||
    groups[0];
  return matched?.rules ?? [];
};

const pathMatches = (rulePath: string, requestPath: string): boolean => {
  if (rulePath === '/') return requestPath.startsWith('/');
  return requestPath.startsWith(rulePath);
};

const evaluateRules = (rules: RobotsRule[], pathname: string): boolean => {
  if (!rules.length) return true;
  let allowed = true;
  for (const rule of rules) {
    if (pathMatches(rule.path, pathname)) allowed = rule.allow;
  }
  return allowed;
};

const AECC_SEARCH_HOST = 'search.aeccglobal.com';

export const isAllowedByRobots = async (
  targetUrl: string,
  options?: { source?: string },
): Promise<boolean> => {
  const parsed = new URL(targetUrl);
  if (
    options?.source === 'AECC' &&
    parsed.hostname.toLowerCase().includes(AECC_SEARCH_HOST)
  ) {
    return true;
  }
  const origin = `${parsed.protocol}//${parsed.host}`;
  const now = Date.now();
  const cached = cache.get(origin);
  if (cached && now - cached.fetchedAt < CACHE_TTL_MS) {
    return evaluateRules(cached.rules, parsed.pathname);
  }

  try {
    const res = await fetch(`${origin}/robots.txt`, {
      headers: { 'User-Agent': SCRAPE_USER_AGENT },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      cache.set(origin, { fetchedAt: now, rules: [] });
      return true;
    }
    const rules = parseRobots(await res.text(), SCRAPE_USER_AGENT);
    cache.set(origin, { fetchedAt: now, rules });
    return evaluateRules(rules, parsed.pathname);
  } catch {
    return true;
  }
};
