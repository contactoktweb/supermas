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

  console.log('Aplicando migración 022_sales_invoicing_and_stock_guard.sql...');

  const sqlPath = path.join(process.cwd(), 'supabase', 'migrations', '022_sales_invoicing_and_stock_guard.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  await client.query('BEGIN');
  try {
    await client.query(sql);

    // Registrar en supabase_migrations.schema_migrations
    await client.query(`
      INSERT INTO supabase_migrations.schema_migrations (version, name)
      VALUES ('022', 'sales_invoicing_and_stock_guard')
      ON CONFLICT (version) DO NOTHING;
    `);

    await client.query('COMMIT');
    console.log('✅ Migración 022 aplicada con éxito.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Error aplicando migración 022:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
