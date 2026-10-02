import { Client } from 'pg'
import * as fs from 'fs'
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

async function applyMigration033() {
  const client = new Client({
    connectionString: process.env.DIRECT_URL,
    ssl: { rejectUnauthorized: false },
  })

  await client.connect()
  console.log('--- APLICANDO MIGRACIÓN 033 A POSTGRESQL (STAGING) ---')
  await client.query('BEGIN;')

  try {
    const sql = fs.readFileSync('supabase/migrations/033_customers_cxc_and_collections.sql', 'utf-8')
    await client.query(sql)
    await client.query('COMMIT;')
    console.log('✅ MIGRACIÓN 033 APLICADA EXITOSAMENTE EN STAGING.')
  } catch (err) {
    await client.query('ROLLBACK;')
    console.error('❌ Error aplicando migración 033:', err)
    throw err
  } finally {
    await client.end()
  }
}

applyMigration033().catch(() => process.exit(1))
