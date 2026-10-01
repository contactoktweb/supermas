import { Client } from 'pg';
import * as fs from 'fs';

async function applyMigration026() {
  const client = new Client({
    connectionString: process.env.DIRECT_URL,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();
  console.log('--- APLICANDO MIGRACIÓN 026 A POSTGRESQL (STAGING) ---');
  await client.query('BEGIN;');

  try {
    const sql = fs.readFileSync('supabase/migrations/026_company_bootstrap_and_link_trigger.sql', 'utf-8');
    await client.query(sql);
    await client.query('COMMIT;');
    console.log('✅ MIGRACIÓN 026 APLICADA EXITOSAMENTE EN STAGING.');
  } catch (err) {
    await client.query('ROLLBACK;');
    console.error('❌ Error aplicando migración 026:', err);
    throw err;
  } finally {
    await client.end();
  }
}

applyMigration026().catch(() => process.exit(1));
