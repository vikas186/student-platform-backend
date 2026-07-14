import dotenv from 'dotenv';
dotenv.config({ path: `config/.env.${process.env.NODE_ENV || 'development'}` });

import { db } from '../models';

async function main() {
  await db.sequelize.authenticate();
  
  const count = await db.ScrapedCourse.count();
  console.log('Total Scraped Courses in DB:', count);

  const courses = await db.ScrapedCourse.findAll({
    limit: 10,
    attributes: ['id', 'courseName', 'universityName', 'cleaningStatus']
  });

  console.log('First 10 courses:');
  for (const c of courses) {
    console.log(`- ${c.courseName} | ${c.universityName} | Status: ${c.cleaningStatus}`);
  }

  await db.sequelize.close();
}

main().catch(console.error);
