import dotenv from 'dotenv';
dotenv.config({ path: 'config/.env.development' });
import { sequelize } from '../config/database';

async function main() {
  try {
    console.log('Dropping table activity_logs...');
    await sequelize.query('DROP TABLE IF EXISTS activity_logs CASCADE;');
    console.log('Table dropped successfully.');
  } catch (err) {
    console.error('Failed to drop table:', err);
  } finally {
    await sequelize.close();
  }
}

void main();
