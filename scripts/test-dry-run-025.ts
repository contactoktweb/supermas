import { Client } from 'pg';
import * as fs from 'fs';

async function dryRunMigration() {
  const client = new Client({
    connectionString: process.env.DIRECT_URL,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();
  console.log('--- TEST DRY-RUN: MIGRACIÓN 025 (BEGIN / ROLLBACK) ---');

  await client.query('BEGIN;');

  try {
    const sql = fs.readFileSync('supabase/migrations/025_pre_production_hardening.sql', 'utf-8');
    await client.query(sql);
    console.log('✅ DRY-RUN EXITOSO: Todas las sentencias SQL de 025 compilaron y ejecutaron perfectamente.');
  } catch (err) {
    console.error('❌ Error en dry-run:', err);
    throw err;
  } finally {
    await client.query('ROLLBACK;');
    console.log('🔒 Transacción revertida con ROLLBACK (Cero cambios en base de datos).');
    await client.end();
  }
}

dryRunMigration().catch(() => process.exit(1));
