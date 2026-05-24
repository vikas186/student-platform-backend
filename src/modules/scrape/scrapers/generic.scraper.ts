import type { SourceConfig } from '../config/scrape-sources';
import type { ScrapePipelineResult, ScrapeRunOptions } from '../extractors/types';
import { runPipelineScrape } from './pipeline.scraper';

export const scrapeWebsite = async (
  config: SourceConfig,
  options?: ScrapeRunOptions,
): Promise<ScrapePipelineResult> => runPipelineScrape(config, options);
