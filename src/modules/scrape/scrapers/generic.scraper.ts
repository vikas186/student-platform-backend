import type { SourceConfig } from '../config/scrape-sources';
import type { ScrapePipelineResult, ScrapeRunOptions } from '../extractors/types';
import { runPipelineScrape } from './pipeline.scraper';

import { scrapeStudiesOverseas } from './studies-overseas.scraper';

export const scrapeWebsite = async (
  config: SourceConfig,
  options?: ScrapeRunOptions,
): Promise<ScrapePipelineResult> => {
  if (config.source === 'STUDIES_OVERSEAS') {
    return scrapeStudiesOverseas(config, options);
  }
  return runPipelineScrape(config, options);
};
