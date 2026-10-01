import { Client } from 'pg'
import * as fs from 'fs'
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

async function applyMigration027() {
  const client = new Client({
    connectionString: process.env.DIRECT_URL,
    ssl: { rejectUnauthorized: false },
  })

  await client.connect()
  console.log('--- APLICANDO MIGRACIÓN 027 A POSTGRESQL (STAGING) ---')
  await client.query('BEGIN;')

  try {
    const sql = fs.readFileSync('supabase/migrations/027_locations_audit_trigger.sql', 'utf-8')
    await client.query(sql)
    await client.query('COMMIT;')
    console.log('✅ MIGRACIÓN 027 APLICADA EXITOSAMENTE EN STAGING.')
  } catch (err) {
    await client.query('ROLLBACK;')
    console.error('❌ Error aplicando migración 027:', err)
    throw err
  } finally {
    await client.end()
  }
}

applyMigration027().catch(() => process.exit(1))
