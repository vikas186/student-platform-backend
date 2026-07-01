import dotenv from 'dotenv';
import path from 'path';
import { Sequelize } from 'sequelize';

async function tryClearDb(envName: string, configPath: string) {
  console.log(`\n--- Trying to clear DB using ${envName} config ---`);
  
  // Clean process.env variables related to DB before loading next config
  const dbEnvKeys = ['DB_HOST', 'DB_PORT', 'DB_USERNAME', 'DB_PASSWORD', 'DB_NAME'];
  dbEnvKeys.forEach(k => delete process.env[k]);
  
  dotenv.config({ path: configPath, override: true });
  
  const { DB_HOST, DB_PORT, DB_USERNAME, DB_PASSWORD, DB_NAME } = process.env;
  if (!DB_HOST || !DB_USERNAME || !DB_PASSWORD || !DB_NAME) {
    console.log(`[${envName}] Missing environment variables, skipping.`);
    return false;
  }
  
  console.log(`[${envName}] Host: ${DB_HOST}:${DB_PORT}, User: ${DB_USERNAME}, DB: ${DB_NAME}`);
  
  const sequelize = new Sequelize(DB_NAME, DB_USERNAME, DB_PASSWORD, {
    host: DB_HOST,
    port: parseInt(DB_PORT || '5432', 10),
    dialect: 'postgres',
    logging: false,
  });
  
  try {
    await sequelize.authenticate();
    console.log(`[${envName}] Connection established successfully!`);
    
    // Check if table exists
    const [tableExists]: any = await sequelize.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'universities'
      ) as e
    `);
    
    if (tableExists?.[0]?.e) {
      console.log(`[${envName}] Table 'universities' exists. Truncating with CASCADE...`);
      await sequelize.query('TRUNCATE TABLE universities CASCADE;');
      console.log(`[${envName}] Successfully truncated 'universities' table and cascade dependencies!`);
      return true;
    } else {
      console.log(`[${envName}] Table 'universities' does not exist in this database.`);
      return false;
    }
  } catch (err: any) {
    console.error(`[${envName}] Connection/execution failed:`, err.message || err);
    return false;
  } finally {
    await sequelize.close();
  }
}

async function main() {
  const configs = [
    { name: 'production', path: path.join(__dirname, '..', 'config', '.env.production') },
    { name: 'development', path: path.join(__dirname, '..', 'config', '.env.development') },
    { name: 'staging', path: path.join(__dirname, '..', 'config', '.env.staging') },
  ];
  
  let successCount = 0;
  for (const config of configs) {
    const success = await tryClearDb(config.name, config.path);
    if (success) {
      successCount++;
    }
  }
  
  console.log(`\n--- Execution Summary ---`);
  console.log(`Cleared ${successCount} database(s) successfully.`);
}

void main();
