import { Client } from 'pg';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config({ path: '.env.local' });

async function main() {
  const client = new Client({
    connectionString: process.env.DIRECT_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  console.log('Aplicando migración 024_accounting_periods_puc_and_financial_reports.sql...');

  const sqlPath = path.join(process.cwd(), 'supabase', 'migrations', '024_accounting_periods_puc_and_financial_reports.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  await client.query('BEGIN');
  try {
    await client.query(sql);

    await client.query(`
      INSERT INTO supabase_migrations.schema_migrations (version, name)
      VALUES ('024', 'accounting_periods_puc_and_financial_reports')
      ON CONFLICT (version) DO NOTHING;
    `);

    await client.query('COMMIT');
    console.log('✅ Migración 024 aplicada con éxito.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Error aplicando migración 024:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
