import fs from 'fs';
import path from 'path';
import pg from 'pg';

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL is not set.');
    process.exit(1);
  }

  const pool = new pg.Pool({ connectionString });
  const client = await pool.connect();

  try {
    const sqlPath = path.resolve(__dirname, '../supabase/migrations/042_fix_transfer_kardex_movements.sql');
    console.log(`Reading SQL from ${sqlPath}...`);
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('Applying migration 042...');
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    console.log('✅ Migration 042 applied successfully.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Failed to apply migration 042:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
