import { getPresetConfig } from '../config/scrape-sources';
import { scrapeWebsite } from './generic.scraper';
import type { ScrapeResult } from './types';

export const scrapeIdp = async (): Promise<ScrapeResult> => scrapeWebsite(getPresetConfig('IDP'));
