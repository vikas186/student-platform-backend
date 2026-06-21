import { Sequelize } from 'sequelize';
import AppError from '../utils/errorHandler';

const {
  DB_HOST,
  DB_USERNAME,
  DB_PASSWORD,
  DB_NAME,
  DB_PORT,
  POOL_MAX,
  POOL_MIN,
  POOL_ACQUIRE,
  POOL_IDLE,
} = process.env;

if (!DB_HOST || !DB_USERNAME || !DB_PASSWORD || !DB_NAME) {
  throw new AppError('Missing necessary database environment variables.', 400);
}

const port = parseInt(DB_PORT || '5432', 10);

const sequelizeOptions: any = {
  host: DB_HOST,
  port,
  dialect: 'postgres',
  logging: false,
  define: {
    underscored: true,
  },
  pool: {
    max: parseInt(POOL_MAX as string, 10),
    min: parseInt(POOL_MIN as string, 10),
    acquire: parseInt(POOL_ACQUIRE as string, 10),
    idle: parseInt(POOL_IDLE as string, 10),
  },
};

const sequelize = new Sequelize(DB_NAME as string, DB_USERNAME as string, DB_PASSWORD as string, sequelizeOptions);

import { db } from '../models';

/**
 * `sync({ alter: true })` does not reliably change `applications.id` from INTEGER to UUID.
 * If we detect a legacy integer PK, drop dependent tables so sync can recreate the correct schema.
 */
async function repairLegacyApplicationUuidSchema(): Promise<void> {
  try {
    const [rows] = await sequelize.query(`
      SELECT data_type
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'applications'
        AND column_name = 'id'
    `);
    const first = (rows as { data_type: string }[])[0];
    if (!first) return;
    if (first.data_type === 'uuid') return;

    console.warn(
      `[DB] applications.id is ${first.data_type}, not uuid — dropping applications-related tables to recreate with UUID PK.`,
    );
    await sequelize.query('DROP TABLE IF EXISTS documents CASCADE');
    await sequelize.query('DROP TABLE IF EXISTS offer_letters CASCADE');
    await sequelize.query('DROP TABLE IF EXISTS applications CASCADE');
  } catch (e) {
    console.error('[DB] repairLegacyApplicationUuidSchema:', e);
  }
}

/**
 * `sync({ alter: true })` may run `ADD COLUMN application_number ... NOT NULL UNIQUE` while rows
 * already exist — PostgreSQL stores NULL for new rows and the ALTER fails (23502).
 * Ensure the column exists, backfill NULLs from `application_number_seq`, then NOT NULL + unique index.
 */
async function repairApplicationNumberColumn(): Promise<void> {
  await sequelize.query(`
    CREATE SEQUENCE IF NOT EXISTS application_number_seq
      INCREMENT BY 1
      MINVALUE 1
      NO MAXVALUE
      CACHE 1;
  `);

  const [[tableExists]]: any = await sequelize.query(`
    SELECT EXISTS (
      SELECT FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'applications'
    ) AS e
  `);
  if (!tableExists?.e) {
    return;
  }

  const [[colExists]]: any = await sequelize.query(`
    SELECT 1 AS ok
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'applications'
      AND column_name = 'application_number'
    LIMIT 1
  `);

  if (!colExists) {
    await sequelize.query(`ALTER TABLE applications ADD COLUMN application_number VARCHAR(32);`);
  }

  const start = parseInt(process.env.APPLICATION_REF_START || '10241', 10);
  const [[mxRow]]: any = await sequelize.query(`
    SELECT COALESCE(MAX(CAST(SUBSTRING(application_number FROM 5) AS BIGINT)), 0)::bigint AS mx
    FROM applications
    WHERE application_number IS NOT NULL
      AND application_number ~ '^APP-[0-9]+$'
  `);
  const mx = Number(mxRow?.mx ?? 0);
  const floor = Math.max(mx, Math.max(0, start - 1));
  await sequelize.query(`SELECT setval('application_number_seq', ${floor}, true)`);

  await sequelize.query(`
    UPDATE applications
    SET application_number = 'APP-' || nextval('application_number_seq')::text
    WHERE application_number IS NULL;
  `);

  try {
    await sequelize.query(`
      ALTER TABLE applications ALTER COLUMN application_number SET NOT NULL;
    `);
  } catch {
    /* already NOT NULL */
  }

  await sequelize.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS applications_application_number_uq
    ON applications (application_number);
  `);
}

async function ensureOfferLetterReferenceSequence(): Promise<void> {
  await sequelize.query(`
    CREATE SEQUENCE IF NOT EXISTS offer_letter_ref_seq
      INCREMENT BY 1
      MINVALUE 1
      NO MAXVALUE
      CACHE 1;
  `);
  const start = parseInt(process.env.OFFER_REF_START || '201', 10);
  const [[row]]: any = await sequelize.query(`
    SELECT COALESCE(MAX(CAST(SUBSTRING(reference_code FROM 5) AS BIGINT)), 0)::bigint AS mx
    FROM offer_letters
    WHERE reference_code ~ '^OFR-[0-9]+$'
  `);
  const mx = Number(row?.mx ?? 0);
  const floor = Math.max(mx, Math.max(0, start - 1));
  await sequelize.query(`SELECT setval('offer_letter_ref_seq', ${floor}, true)`);
}

async function ensureApplicationNumberSequence(): Promise<void> {
  await sequelize.query(`
    CREATE SEQUENCE IF NOT EXISTS application_number_seq
      INCREMENT BY 1
      MINVALUE 1
      NO MAXVALUE
      CACHE 1;
  `);
  const start = parseInt(process.env.APPLICATION_REF_START || '10241', 10);
  const [[row]]: any = await sequelize.query(`
    SELECT COALESCE(MAX(CAST(SUBSTRING(application_number FROM 5) AS BIGINT)), 0)::bigint AS mx
    FROM applications
    WHERE application_number ~ '^APP-[0-9]+$'
  `);
  const mx = Number(row?.mx ?? 0);
  const floor = Math.max(mx, Math.max(0, start - 1));
  await sequelize.query(`SELECT setval('application_number_seq', ${floor}, true)`);
}

const isWorkerProcess = process.argv.some(arg => /workers[\\/]/.test(arg.replace(/\\/g, '/')));
const shouldSyncDb = process.env.SKIP_DB_SYNC !== '1' && !isWorkerProcess;

if (shouldSyncDb) {
  void (async () => {
    try {
      await repairLegacyApplicationUuidSchema();
      await repairApplicationNumberColumn();
      await sequelize.sync({ alter: true });
      await ensureApplicationNumberSequence();
      await ensureOfferLetterReferenceSequence();
      const { ensureAdminHasAllCatalogPermissions, ensureUniversityPortalPermissions, ensureStudentAndAgentDefaultPermissions } = await import(
        '../services/rolePermissions.service'
      );
      await ensureAdminHasAllCatalogPermissions();
      await ensureUniversityPortalPermissions();
      await ensureStudentAndAgentDefaultPermissions();
      console.log('Database & tables synced successfully.');
    } catch (error: any) {
      console.error('Error syncing database:', error?.message || error);
      const pg = error?.parent ?? error?.original;
      if (pg?.message) {
        console.error('[PostgreSQL]', pg.message);
      }
      if (process.env.NODE_ENV === 'development') {
        console.error(error);
      }
    }
  })();
}

export { sequelize, db };
