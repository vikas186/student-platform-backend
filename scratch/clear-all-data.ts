import dotenv from 'dotenv';
dotenv.config({ path: `config/.env.${process.env.NODE_ENV || 'development'}` });

import fs from 'fs';
import path from 'path';
import { db } from '../models';

async function main() {
  console.log('Clearing database scrap and university tables...');
  await db.sequelize.authenticate();

  // Disable triggers / constraint checks during deletion if needed, or delete in topological dependency order:
  // Children first: ScrapedCourse, ScrapeFee, ScrapeScholarship, ScrapeAiMeta, ScrapeRejectedPage, RawScrapeBatch, ScrapeJob, ScrapeUniversity
  const transaction = await db.sequelize.transaction();
  try {
        const courseCount = await db.ScrapedCourse.destroy({ where: {}, force: true, transaction });
    console.log(`Deleted ${courseCount} scraped courses.`);

    const feeCount = await db.ScrapeFee.destroy({ where: {}, force: true, transaction });
    console.log(`Deleted ${feeCount} scraped fees.`);

    const scholarshipCount = await db.ScrapeScholarship.destroy({ where: {}, force: true, transaction });
    console.log(`Deleted ${scholarshipCount} scraped scholarships.`);

    const aiMetaCount = await db.ScrapeAiMeta.destroy({ where: {}, force: true, transaction });
    console.log(`Deleted ${aiMetaCount} AI metadata entries.`);

    const rejectedCount = await db.ScrapeRejectedPage.destroy({ where: {}, force: true, transaction });
    console.log(`Deleted ${rejectedCount} rejected pages.`);

    const batchCount = await db.RawScrapeBatch.destroy({ where: {}, force: true, transaction });
    console.log(`Deleted ${batchCount} raw scrape batches.`);

    const jobCount = await db.ScrapeJob.destroy({ where: {}, force: true, transaction });
    console.log(`Deleted ${jobCount} scrape jobs.`);

    const scrapeUniCount = await db.ScrapeUniversity.destroy({ where: {}, force: true, transaction });
    console.log(`Deleted ${scrapeUniCount} scraped universities.`);

    // Application data
    const paymentCount = await db.Payment.destroy({ where: {}, force: true, transaction });
    console.log(`Deleted ${paymentCount} payments.`);

    const offerLetterCount = await db.OfferLetter.destroy({ where: {}, force: true, transaction });
    console.log(`Deleted ${offerLetterCount} offer letters.`);

    const docCount = await db.Document.destroy({ where: {}, force: true, transaction });
    console.log(`Deleted ${docCount} documents.`);

    const appCount = await db.Application.destroy({ where: {}, force: true, transaction });
    console.log(`Deleted ${appCount} applications.`);

    const deadlineCount = await db.Deadline.destroy({ where: {}, force: true, transaction });
    console.log(`Deleted ${deadlineCount} deadlines.`);

    const commissionCount = await db.Commission.destroy({ where: {}, force: true, transaction });
    console.log(`Deleted ${commissionCount} commissions.`);

    const mainCourseCount = await db.Course.destroy({ where: {}, force: true, transaction });
    console.log(`Deleted ${mainCourseCount} courses.`);

    const uniProfileCount = await db.UniversityProfile.destroy({ where: {}, force: true, transaction });
    console.log(`Deleted ${uniProfileCount} university profiles.`);

    const uniCount = await db.University.destroy({ where: {}, force: true, transaction });
    console.log(`Deleted ${uniCount} universities.`);

    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    throw error;
  }

  console.log('Clearing local scrap raw files and debug folders...');
  const pathsToClear = [
    path.join(__dirname, '../raw'),
    path.join(__dirname, '../debug/screenshots'),
    path.join(__dirname, '../debug/html'),
    path.join(__dirname, '../debug/logs'),
  ];

  for (const dirPath of pathsToClear) {
    if (fs.existsSync(dirPath)) {
      const files = fs.readdirSync(dirPath);
      for (const file of files) {
        if (file === '.gitkeep' || file === '.keep') continue;
        const filePath = path.join(dirPath, file);
        try {
          if (fs.lstatSync(filePath).isDirectory()) {
            fs.rmSync(filePath, { recursive: true, force: true });
          } else {
            fs.unlinkSync(filePath);
          }
          console.log(`Deleted file: ${file} from ${path.basename(dirPath)}`);
        } catch (err) {
          console.error(`Failed to delete ${filePath}:`, err);
        }
      }
    }
  }

  await db.sequelize.close();
  console.log('Cleanup finished successfully!');
}

main().catch(console.error);
