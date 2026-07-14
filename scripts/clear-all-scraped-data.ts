import dotenv from 'dotenv';
import path from 'path';

// Configure dotenv before importing any modules that depend on process.env
dotenv.config({ path: path.join(__dirname, '..', 'config', `.env.${process.env.NODE_ENV || 'development'}`) });

import fs from 'fs';
import { db } from '../config/database';

async function clearDirectories() {
  console.log('Clearing scraping file directories...');
  const dirsToClear = [
    { dir: path.join(__dirname, '..', 'raw'), pattern: /\.json$/ },
    { dir: path.join(__dirname, '..', 'debug', 'screenshots'), pattern: /\.png$/ },
    { dir: path.join(__dirname, '..', 'debug', 'html'), pattern: /\.html$/ },
    { dir: path.join(__dirname, '..', 'debug', 'logs'), pattern: /\.log$/ }
  ];

  for (const item of dirsToClear) {
    if (fs.existsSync(item.dir)) {
      const files = fs.readdirSync(item.dir);
      let count = 0;
      for (const file of files) {
        if (item.pattern.test(file)) {
          if (file.toLowerCase().includes('sample')) {
            continue;
          }
          try {
            fs.unlinkSync(path.join(item.dir, file));
            count++;
          } catch (err: any) {
            console.error(`Failed to delete file ${file}:`, err.message);
          }
        }
      }
      console.log(`Cleared ${count} files from: ${item.dir}`);
    } else {
      console.log(`Directory does not exist, skipping: ${item.dir}`);
    }
  }
}

async function clearDatabase() {
  console.log('Connecting to database...');
  await db.sequelize.authenticate();
  console.log('Database connected successfully.');

  // Fetch all tables in the public schema
  const [results]: any = await db.sequelize.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
  `);

  const existingTables: string[] = results.map((row: any) => row.table_name);
  console.log('Found tables in database:', existingTables);

  // Identify scraping-related tables to truncate
  const tablesToTruncate = existingTables.filter(tableName => {
    const lowerName = tableName.toLowerCase();
    return (
      lowerName.startsWith('scrape_') ||
      lowerName.startsWith('scraped_') ||
      lowerName.includes('scrape') ||
      [
        'raw_scraped_data',
        'university_programs',
        'university_scholarships',
        'scraping_logs',
        'university_sources'
      ].includes(lowerName)
    );
  });

  if (tablesToTruncate.length === 0) {
    console.log('No scraping-related tables found to truncate.');
    return;
  }

  console.log('Scraping tables identified for truncation:', tablesToTruncate);

  // We should truncate tables. Note: truncate order doesn't strictly matter with CASCADE, 
  // but let's run them in a transaction or individually.
  for (const table of tablesToTruncate) {
    try {
      console.log(`Truncating table "${table}" with CASCADE...`);
      await db.sequelize.query(`TRUNCATE TABLE "${table}" CASCADE;`);
      console.log(`Successfully truncated table "${table}".`);
    } catch (err: any) {
      console.error(`Error truncating table "${table}":`, err.message || err);
    }
  }
}

async function main() {
  try {
    await clearDatabase();
    await clearDirectories();
    console.log('\nAll scrap data has been cleared successfully.');
    process.exit(0);
  } catch (err) {
    console.error('Failure clearing scrap data:', err);
    process.exit(1);
  }
}

main();
