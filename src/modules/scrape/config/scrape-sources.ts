import type { ScrapePreset } from '../../../../models/ScrapeJob.model';

export type SourceConfig = {
  source: string;
  baseUrl: string;
  seeds: string[];
  maxPages: number;
  maxDetailPages: number;
  /** Short UI label for admin scrape hub. */
  label?: string;
};

/**
 * AECC study destinations available on search.aeccglobal.com/courses/all/all/{slug}.
 * Override with comma-separated SCRAPE_AECC_DESTINATIONS (e.g. australia,canada,united-kingdom).
 */
export const AECC_DESTINATION_SLUGS = [
  'australia',
  'canada',
  'united-kingdom',
  'united-states',
  'new-zealand',
  'ireland',
  'germany',
  'singapore',
] as const;

const aeccDestinationSeeds = (): string[] => {
  const fromEnv = (process.env.SCRAPE_AECC_DESTINATIONS || '')
    .split(',')
    .map(s => s.trim().toLowerCase())
    .filter(Boolean);
  const slugs = fromEnv.length > 0 ? fromEnv : [...AECC_DESTINATION_SLUGS];
  return slugs.map(slug => `https://search.aeccglobal.com/courses/all/all/${slug}`);
};

const partnerMaxPages = (): number => parseInt(process.env.SCRAPE_CUSTOM_MAX_PAGES || '0', 10);
const partnerMaxDetail = (): number => parseInt(process.env.SCRAPE_CUSTOM_MAX_DETAIL || '0', 10);

/** Generic partner / consultancy sites — homepage seed + link discovery (no special extractor). */
const partnerPreset = (source: string, label: string, baseUrl: string): SourceConfig => ({
  source,
  label,
  baseUrl,
  seeds: [baseUrl],
  maxPages: partnerMaxPages(),
  maxDetailPages: partnerMaxDetail(),
});

/**
 * Full preset catalog (used by scrapers/scripts).
 * Admin hub only exposes STUDIES_OVERSEAS via SCRAPE_PRESETS / listScrapePresets.
 */
export const PRESET_CONFIG: Record<string, SourceConfig> = {
  IDP: {
    source: 'IDP',
    label: 'IDP',
    baseUrl: 'https://www.idp.com/india/find-a-course/?lang=en',
    seeds: ['https://www.idp.com/india/find-a-course/?lang=en'],
    maxPages: parseInt(process.env.SCRAPE_IDP_MAX_PAGES || '0', 10),
    maxDetailPages: parseInt(process.env.SCRAPE_IDP_MAX_DETAIL || '0', 10),
  },
  AECC: {
    source: 'AECC',
    label: 'AECC',
    baseUrl: 'https://search.aeccglobal.com/courses/all/all/australia',
    seeds: aeccDestinationSeeds(),
    maxPages: parseInt(process.env.SCRAPE_AECC_MAX_PAGES || '0', 10),
    maxDetailPages: parseInt(process.env.SCRAPE_AECC_MAX_DETAIL || '0', 10),
  },
  STUDIES_OVERSEAS: {
    source: 'STUDIES_OVERSEAS',
    label: 'Studies Overseas',
    baseUrl: 'https://www.studies-overseas.com/universities',
    seeds: ['https://www.studies-overseas.com/universities'],
    // Listing is a single catalog page; detail pages are sampled across countries (default 400).
    maxPages: parseInt(process.env.SCRAPE_STUDIES_OVERSEAS_MAX_PAGES || '1', 10),
    maxDetailPages: parseInt(process.env.SCRAPE_STUDIES_OVERSEAS_MAX_DETAIL || '400', 10),
  },
  EDWISE: partnerPreset('EDWISE', 'Edwise', 'https://www.edwiseinternational.com/'),
  CHOPRAS: partnerPreset('CHOPRAS', 'The Chopras', 'https://www.thechopras.com/'),
  GLOBAL_DEGREES: partnerPreset('GLOBAL_DEGREES', 'Global Degrees', 'https://globaldegrees.in/'),
  GEEBEE: partnerPreset('GEEBEE', 'Geebee World', 'https://www.geebeeworld.com/'),
  EDVOY: partnerPreset('EDVOY', 'Edvoy', 'https://edvoy.com/'),
};

export const getPresetConfig = (preset: ScrapePreset | string): SourceConfig => {
  const cfg = PRESET_CONFIG[preset];
  if (!cfg) {
    throw new Error(`Unknown scrape preset: ${preset}`);
  }
  return cfg;
};

/** @deprecated use getPresetConfig */
export const getSourceConfig = getPresetConfig;
