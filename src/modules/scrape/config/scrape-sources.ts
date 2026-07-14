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

const partnerMaxPages = (): number => parseInt(process.env.SCRAPE_CUSTOM_MAX_PAGES || '25', 10);
const partnerMaxDetail = (): number => parseInt(process.env.SCRAPE_CUSTOM_MAX_DETAIL || '15', 10);

/** Generic partner / consultancy sites — homepage seed + link discovery (no special extractor). */
const partnerPreset = (source: ScrapePreset, label: string, baseUrl: string): SourceConfig => ({
  source,
  label,
  baseUrl,
  seeds: [baseUrl],
  maxPages: partnerMaxPages(),
  maxDetailPages: partnerMaxDetail(),
});

export const PRESET_CONFIG: Record<ScrapePreset, SourceConfig> = {
  IDP: {
    source: 'IDP',
    label: 'IDP',
    // Prefer country-scoped find-a-course with lang=en (allowed by IDP robots.txt).
    // Avoid /india/search (empty marketing) and root /find-a-course/?page=1 (disallowed).
    baseUrl: 'https://www.idp.com/india/find-a-course/?lang=en',
    seeds: ['https://www.idp.com/india/find-a-course/?lang=en'],
    maxPages: parseInt(process.env.SCRAPE_IDP_MAX_PAGES || '25', 10),
    maxDetailPages: parseInt(process.env.SCRAPE_IDP_MAX_DETAIL || '15', 10),
  },
  AECC: {
    source: 'AECC',
    label: 'AECC',
    // Use a destination listing as base so normalizeSeedUrls does not prepend the empty homepage.
    baseUrl: 'https://search.aeccglobal.com/courses/all/all/australia',
    // One seed per destination so the catalog is not popularity-skewed to US/AU only.
    seeds: aeccDestinationSeeds(),
    // Max listing pages **per destination** (pagination enqueue + queue budget use this).
    maxPages: parseInt(process.env.SCRAPE_AECC_MAX_PAGES || '80', 10),
    maxDetailPages: parseInt(process.env.SCRAPE_AECC_MAX_DETAIL || '15', 10),
  },
  STUDIES_OVERSEAS: {
    source: 'STUDIES_OVERSEAS',
    label: 'Studies Overseas',
    baseUrl: 'https://www.studies-overseas.com/universities',
    seeds: ['https://www.studies-overseas.com/universities'],
    maxPages: parseInt(process.env.SCRAPE_STUDIES_OVERSEAS_MAX_PAGES || '50', 10),
    maxDetailPages: parseInt(process.env.SCRAPE_STUDIES_OVERSEAS_MAX_DETAIL || '700', 10),
  },
  EDWISE: partnerPreset('EDWISE', 'Edwise', 'https://www.edwiseinternational.com/'),
  CHOPRAS: partnerPreset('CHOPRAS', 'The Chopras', 'https://www.thechopras.com/'),
  GLOBAL_DEGREES: partnerPreset('GLOBAL_DEGREES', 'Global Degrees', 'https://globaldegrees.in/'),
  GEEBEE: partnerPreset('GEEBEE', 'Geebee World', 'https://www.geebeeworld.com/'),
  EDVOY: partnerPreset('EDVOY', 'Edvoy', 'https://edvoy.com/'),
};

export const getPresetConfig = (preset: ScrapePreset): SourceConfig => PRESET_CONFIG[preset];

/** @deprecated use getPresetConfig */
export const getSourceConfig = getPresetConfig;
