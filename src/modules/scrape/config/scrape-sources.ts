import type { ScrapePreset } from '../../../../models/ScrapeJob.model';

export type SourceConfig = {
  source: string;
  baseUrl: string;
  seeds: string[];
  maxPages: number;
  maxDetailPages: number;
};

export const PRESET_CONFIG: Record<ScrapePreset, SourceConfig> = {
  IDP: {
    source: 'IDP',
    baseUrl: 'https://www.idp.com/india/',
    seeds: [
      'https://www.idp.com/india/',
      'https://www.idp.com/india/search/',
      'https://www.idp.com/india/universities/',
    ],
    maxPages: parseInt(process.env.SCRAPE_IDP_MAX_PAGES || '25', 10),
    maxDetailPages: parseInt(process.env.SCRAPE_IDP_MAX_DETAIL || '15', 10),
  },
  AECC: {
    source: 'AECC',
    baseUrl: 'https://search.aeccglobal.com',
    seeds: ['https://search.aeccglobal.com/courses'],
    maxPages: parseInt(process.env.SCRAPE_AECC_MAX_PAGES || '22', 10),
    maxDetailPages: parseInt(process.env.SCRAPE_AECC_MAX_DETAIL || '15', 10),
  },
};

export const getPresetConfig = (preset: ScrapePreset): SourceConfig => PRESET_CONFIG[preset];

/** @deprecated use getPresetConfig */
export const getSourceConfig = getPresetConfig;
