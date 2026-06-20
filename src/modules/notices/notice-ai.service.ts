import { Op } from 'sequelize';
import Parser from 'rss-parser';
import { db } from '../../../config/database';
import { getOpenAiClient, rateLimitAi, scrapeAiModel } from '../scrape/enrichment/openai.client';

const TICKER_CATEGORIES = [
  'Policy watch',
  'Immigration desk',
  'Edu wire',
  'Embassy round-up',
  'EU brief',
] as const;

const STUDY_KEYWORDS = [
  'student',
  'visa',
  'immigration',
  'study abroad',
  'international student',
  'university',
  'scholarship',
  'pgwp',
  'post-study',
  'work permit',
  'embassy',
  'consulate',
  'tuition',
  'enrolment',
  'enrollment',
  'higher education',
  'graduate',
  'undergraduate',
  'f-1',
  'tier 4',
  'ircc',
  'home office',
  'schengen',
];

const DEFAULT_FEEDS = [
  'https://www.gov.uk/government/organisations/uk-visas-and-immigration.atom',
  'https://www.thepienews.com/feed/',
  'https://www.studyinternational.com/feed/',
];

type FeedEntry = {
  externalId: string;
  title: string;
  summary: string;
  link: string | null;
  publishedAt: Date | null;
};

type AiTickerResult = {
  title: string;
  source: string;
  skip?: boolean;
};

export type NoticeAiSyncResult = {
  feedsChecked: number;
  candidates: number;
  inserted: number;
  skipped: number;
  deactivated: number;
  errors: string[];
};

const parser = new Parser({
  timeout: 20_000,
  headers: {
    'User-Agent': 'UniwizerPlatformBot/1.0 (+https://uniwizer.com; notice-ticker)',
  },
});

function noticeAiEnabled(): boolean {
  return process.env.NOTICE_AI_ENABLED !== 'false' && !!process.env.OPENAI_API_KEY?.trim();
}

function feedUrls(): string[] {
  const raw = process.env.NOTICE_RSS_FEEDS?.trim();
  const urls = raw
    ? raw.split(',').map(s => s.trim()).filter(Boolean)
    : DEFAULT_FEEDS;
  return [...new Set(urls)];
}

function maxAgeHours(): number {
  return Math.max(1, parseInt(process.env.NOTICE_AI_MAX_AGE_HOURS || '72', 10));
}

function maxNewPerRun(): number {
  return Math.max(1, parseInt(process.env.NOTICE_AI_MAX_ITEMS || '5', 10));
}

function maxActive(): number {
  return Math.max(1, parseInt(process.env.NOTICE_AI_MAX_ACTIVE || '10', 10));
}

function retentionDays(): number {
  return Math.max(1, parseInt(process.env.NOTICE_AI_RETENTION_DAYS || '30', 10));
}

function isRelevant(text: string): boolean {
  const lower = text.toLowerCase();
  return STUDY_KEYWORDS.some(kw => lower.includes(kw));
}

function normalizeExternalId(link: string | null, guid: string | undefined, title: string): string {
  const base = (link || guid || title).trim();
  return base.slice(0, 500);
}

async function fetchFeedEntries(url: string): Promise<FeedEntry[]> {
  const feed = await parser.parseURL(url);
  return (feed.items ?? []).map(item => {
    const title = (item.title || '').trim();
    const summary = [item.contentSnippet, item.content, item.summary].find(Boolean)?.trim() || title;
    const link = item.link?.trim() || null;
    const publishedAt = item.isoDate ? new Date(item.isoDate) : item.pubDate ? new Date(item.pubDate) : null;
    return {
      externalId: normalizeExternalId(link, item.guid, title),
      title,
      summary: summary.slice(0, 4000),
      link,
      publishedAt,
    };
  }).filter(e => e.title.length > 0 && e.externalId.length > 0);
}

async function summarizeForTicker(entry: FeedEntry): Promise<AiTickerResult | null> {
  await rateLimitAi();
  const client = getOpenAiClient();

  const response = await client.chat.completions.create({
    model: scrapeAiModel(),
    temperature: 0.2,
    max_tokens: 180,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: [
          'You rewrite study-abroad and immigration news headlines for a dashboard ticker.',
          'Rules:',
          '- Only use facts present in the source text. Do not invent policy changes or dates.',
          '- title: max 120 characters, clear and factual.',
          `- source: exactly one of: ${TICKER_CATEGORIES.join(', ')}.`,
          '- If the item is not relevant to international students, visas, or study abroad, set skip to true.',
          'Respond with JSON: {"title":"...","source":"...","skip":false}',
        ].join('\n'),
      },
      {
        role: 'user',
        content: `Headline: ${entry.title}\n\nSummary: ${entry.summary.slice(0, 2500)}`,
      },
    ],
  });

  const raw = response.choices[0]?.message?.content?.trim();
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as AiTickerResult;
    if (parsed.skip) return null;
    const title = parsed.title?.trim();
    const source = parsed.source?.trim();
    if (!title || !source) return null;
    if (!TICKER_CATEGORIES.includes(source as (typeof TICKER_CATEGORIES)[number])) return null;
    return { title: title.slice(0, 500), source: source.slice(0, 120) };
  } catch {
    return null;
  }
}

async function existingExternalIds(ids: string[]): Promise<Set<string>> {
  if (!ids.length) return new Set();
  const rows = await db.NoticeTickerItem.findAll({
    where: { externalId: { [Op.in]: ids } },
    attributes: ['externalId'],
  });
  return new Set(rows.map(r => (r as { externalId: string }).externalId).filter(Boolean));
}

async function insertAiNotice(input: {
  title: string;
  source: string;
  externalId: string;
  sourceUrl: string | null;
  expiresAt: Date;
}) {
  const maxSort = (await db.NoticeTickerItem.max('sortOrder')) as number | null;
  return db.NoticeTickerItem.create({
    title: input.title,
    source: input.source,
    href: input.sourceUrl,
    externalId: input.externalId,
    sourceUrl: input.sourceUrl,
    generatedBy: 'ai',
    expiresAt: input.expiresAt,
    sortOrder: (Number(maxSort) || 0) + 1,
    isActive: true,
  });
}

async function refreshSortOrderByRecency() {
  const rows = await db.NoticeTickerItem.findAll({
    where: { isActive: true },
    order: [['createdAt', 'DESC']],
  });
  await Promise.all(
    rows.map((row, index) =>
      db.NoticeTickerItem.update({ sortOrder: index + 1 }, { where: { id: row.id } }),
    ),
  );
}

async function deactivateExpiredAndExcess(): Promise<number> {
  const now = new Date();
  const cutoff = new Date(now.getTime() - retentionDays() * 24 * 60 * 60 * 1000);

  const [expiredCount] = await db.NoticeTickerItem.update(
    { isActive: false },
    {
      where: {
        isActive: true,
        [Op.or]: [
          { expiresAt: { [Op.lt]: now } },
          { createdAt: { [Op.lt]: cutoff } },
        ],
      },
    },
  );

  const activeRows = await db.NoticeTickerItem.findAll({
    where: { isActive: true },
    order: [
      ['sortOrder', 'ASC'],
      ['createdAt', 'DESC'],
    ],
  });

  const excess = activeRows.length - maxActive();
  if (excess > 0) {
    const toDeactivate = activeRows.slice(maxActive());
    await db.NoticeTickerItem.update(
      { isActive: false },
      { where: { id: { [Op.in]: toDeactivate.map(r => r.id) } } },
    );
  }

  return expiredCount + Math.max(0, excess);
}

export async function syncNoticesFromAi(): Promise<NoticeAiSyncResult> {
  const result: NoticeAiSyncResult = {
    feedsChecked: 0,
    candidates: 0,
    inserted: 0,
    skipped: 0,
    deactivated: 0,
    errors: [],
  };

  if (!noticeAiEnabled()) {
    result.errors.push('Notice AI sync disabled (set OPENAI_API_KEY and NOTICE_AI_ENABLED=true)');
    return result;
  }

  const urls = feedUrls();
  if (!urls.length) {
    result.errors.push('No RSS feeds configured (NOTICE_RSS_FEEDS)');
    return result;
  }

  const ageMs = maxAgeHours() * 60 * 60 * 1000;
  const minDate = new Date(Date.now() - ageMs);
  const expiresAt = new Date(Date.now() + retentionDays() * 24 * 60 * 60 * 1000);

  const allEntries: FeedEntry[] = [];
  for (const url of urls) {
    try {
      const entries = await fetchFeedEntries(url);
      allEntries.push(...entries);
      result.feedsChecked += 1;
    } catch (err) {
      result.errors.push(`${url}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const recent = allEntries.filter(entry => {
    if (entry.publishedAt && entry.publishedAt < minDate) return false;
    const blob = `${entry.title} ${entry.summary}`;
    return isRelevant(blob);
  });

  result.candidates = recent.length;

  const knownIds = await existingExternalIds(recent.map(e => e.externalId));
  const fresh = recent.filter(e => !knownIds.has(e.externalId));

  let inserted = 0;
  for (const entry of fresh) {
    if (inserted >= maxNewPerRun()) break;
    try {
      const ai = await summarizeForTicker(entry);
      if (!ai) {
        result.skipped += 1;
        continue;
      }
      await insertAiNotice({
        title: ai.title,
        source: ai.source,
        externalId: entry.externalId,
        sourceUrl: entry.link,
        expiresAt,
      });
      inserted += 1;
      result.inserted += 1;
    } catch (err) {
      result.skipped += 1;
      result.errors.push(`${entry.title.slice(0, 60)}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  await refreshSortOrderByRecency();
  result.deactivated = await deactivateExpiredAndExcess();

  return result;
}
