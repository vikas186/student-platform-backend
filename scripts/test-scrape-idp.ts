import dotenv from 'dotenv';
dotenv.config({ path: `config/.env.${process.env.NODE_ENV || 'development'}` });

import { scrapeIdp } from '../src/modules/scrape/scrapers/idp.scraper';
import { closePlaywrightBrowser } from '../src/modules/scrape/scrapers/playwright.util';

const main = async () => {
  const result = await scrapeIdp();
  console.log(JSON.stringify({ ...result, courses: result.courses.slice(0, 5) }, null, 2));
  console.log(`Total courses: ${result.courses.length}, pages: ${result.pagesVisited}`);
  await closePlaywrightBrowser();
};

main().catch(err => {
  console.error(err);
  process.exit(1);
});
