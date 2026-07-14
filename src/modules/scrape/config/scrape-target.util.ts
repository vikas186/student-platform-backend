import AppError from '../../../../utils/errorHandler';
import type { ScrapePreset, ScrapeTrigger } from '../../../../models/ScrapeJob.model';
import { SCRAPE_PRESETS } from '../../../../models/ScrapeJob.model';
import { getPresetConfig, type SourceConfig } from '../config/scrape-sources';
import { normalizeScrapeUrl, normalizeSeedUrls, sourceLabelFromUrl } from '../scrapers/url-security.util';

export type ResolvedScrapeTarget = {
  source: string;
  targetUrl: string;
  targetName: string;
  seedUrls: string[];
  maxPages: number;
  maxDetailPages: number;
};

export type StartScrapeBody =
  | { source: ScrapePreset; name?: string; seeds?: string[] }
  | { url: string; name?: string; seeds?: string[] };

export const isScrapePreset = (value: string): value is ScrapePreset =>
  (SCRAPE_PRESETS as readonly string[]).includes(value);

export const resolveScrapeTarget = (body: StartScrapeBody): ResolvedScrapeTarget => {
  if ('source' in body && body.source) {
    const preset = getPresetConfig(body.source);
    const targetUrl = normalizeScrapeUrl(preset.baseUrl);
    const seedUrls = normalizeSeedUrls(targetUrl, [...preset.seeds, ...(body.seeds || [])]);
    return {
      source: body.source,
      targetUrl,
      targetName: body.name?.trim() || body.source,
      seedUrls,
      maxPages: preset.maxPages,
      maxDetailPages: preset.maxDetailPages,
    };
  }

  if ('url' in body && body.url) {
    const targetUrl = normalizeScrapeUrl(body.url);
    const source = sourceLabelFromUrl(targetUrl);
    const seedUrls = normalizeSeedUrls(targetUrl, body.seeds || []);
    const maxPages = parseInt(process.env.SCRAPE_CUSTOM_MAX_PAGES || '25', 10);
    const maxDetailPages = parseInt(process.env.SCRAPE_CUSTOM_MAX_DETAIL || '15', 10);
    return {
      source,
      targetUrl,
      targetName: body.name?.trim() || source,
      seedUrls,
      maxPages,
      maxDetailPages,
    };
  }

  throw new AppError(
    'Provide either a source preset (IDP, AECC, STUDIES_OVERSEAS, …) or url',
    400,
  );
};

export const toSourceConfig = (target: ResolvedScrapeTarget): SourceConfig => ({
  source: target.source,
  baseUrl: target.targetUrl,
  seeds: target.seedUrls,
  maxPages: target.maxPages,
  maxDetailPages: target.maxDetailPages,
});

type JobSourceFields = {
  source?: string | null;
  targetUrl?: string | null;
  targetName?: string | null;
  seedUrls?: string[] | null;
};

/** Resolve a stable source label for DB writes (job row, batch, upserts). */
export const resolveJobSource = (
  job: JobSourceFields,
  batch?: { source?: string | null } | null,
): string => {
  const targetUrl = job.targetUrl || job.seedUrls?.[0] || '';
  const fromBatch = batch?.source?.trim();
  const fromJob = job.source?.trim();
  const fromName = job.targetName?.trim();
  const fromUrl = targetUrl ? sourceLabelFromUrl(targetUrl) : '';
  return fromBatch || fromJob || fromName || fromUrl || 'custom';
};

export type { ScrapeTrigger };
