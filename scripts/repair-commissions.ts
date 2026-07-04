import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { Op } from 'sequelize';

const nodeEnv = process.env.NODE_ENV || 'development';
dotenv.config({ path: path.join(__dirname, '..', 'config', `.env.${nodeEnv}`) });

import { db } from '../config/database';
import {
  buildColumnIndexMap,
  findCatalogHeaderRowIndex,
  readCatalogSpreadsheetToMatrix,
  rowToFeeRanges,
  parseCommissionValue,
} from '../utils/universityCatalogImport';

async function repair() {
  console.log('Starting commission repair script...');
  const dir = path.join(__dirname, '..', 'uploads', 'admin-university-catalog');
  if (!fs.existsSync(dir)) {
    console.error(`Directory not found: ${dir}`);
    return;
  }

  const files = fs.readdirSync(dir).filter(f => f.endsWith('.xlsx'));
  if (files.length === 0) {
    console.log('No catalog files found to process.');
    return;
  }

  let totalProcessed = 0;
  let totalCommissionsCreated = 0;
  let totalCommissionsUpdated = 0;

  for (const file of files) {
    const filePath = path.join(dir, file);
    console.log(`\nProcessing file: ${file}`);
    try {
      const matrix = await readCatalogSpreadsheetToMatrix(filePath);
      if (matrix.length < 2) {
        console.log(`Skipping file ${file} - no data rows`);
        continue;
      }

      const headerIdx = findCatalogHeaderRowIndex(matrix);
      const headerRow = (matrix[headerIdx] ?? []).map(c => String(c));
      const colIndex = buildColumnIndexMap(headerRow);

      if (colIndex.university == null) {
        console.log(`Skipping file ${file} - could not find university column`);
        continue;
      }

      for (let r = headerIdx + 1; r < matrix.length; r++) {
        const row = matrix[r];
        if (!row || row.every(c => !String(c ?? '').trim())) {
          continue;
        }

        const parsed = rowToFeeRanges(row.map(c => String(c ?? '')), colIndex);
        if (!parsed || !parsed.name.trim()) {
          continue;
        }

        const parsedName = parsed.name.trim();
        const country = parsed.country.trim() || 'United Kingdom';

        // Find the university in database
        const uni = await db.University.findOne({
          where: {
            name: { [Op.iLike]: parsedName },
            country: { [Op.iLike]: country }
          }
        });

        if (!uni) {
          console.log(`University not found in DB: "${parsedName}" (${country})`);
          continue;
        }

        totalProcessed++;

        if (parsed.commission || Object.keys(parsed.rates).length > 0) {
          const pct = parseCommissionValue(parsed.commission) ?? 0;
          const slabDetails = JSON.stringify({
            partnerCommissionPercent: pct,
            rates: parsed.rates,
            source: 'catalog-repair',
            rawFormat: parsed.commission ? parsed.commission.trim() : '',
          });

          const existingComm = await db.Commission.findOne({
            where: { universityId: uni.id }
          });

          if (existingComm) {
            await existingComm.update({
              percentage: pct,
              slabDetails,
            });
            totalCommissionsUpdated++;
            console.log(`Updated commission for "${uni.name}" to ${pct}%`);
          } else {
            await db.Commission.create({
              universityId: uni.id,
              percentage: pct,
              slabDetails,
            });
            totalCommissionsCreated++;
            console.log(`Created commission for "${uni.name}": ${pct}%`);
          }
        }
      }
    } catch (err) {
      console.error(`Error processing file ${file}:`, err);
    }
  }

  console.log(`\nRepair completed.`);
  console.log(`Total universities matched and processed: ${totalProcessed}`);
  console.log(`Total commission slabs created: ${totalCommissionsCreated}`);
  console.log(`Total commission slabs updated: ${totalCommissionsUpdated}`);
}

repair()
  .catch(err => {
    console.error('Error running repair script:', err);
  })
  .finally(async () => {
    await db.sequelize.close();
  });
