import { Client } from 'pg'
import * as fs from 'fs'
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

async function applyMigration040() {
  const connStr = process.env.DATABASE_URL || process.env.DIRECT_URL
  const client = new Client({
    connectionString: connStr,
    ssl: { rejectUnauthorized: false },
  })

  await client.connect()
  console.log('--- APLICANDO MIGRACIÓN 040 A POSTGRESQL (STAGING) ---')
  await client.query('BEGIN;')

  try {
    const sql = fs.readFileSync('supabase/migrations/040_customer_payments_atomic_rpc.sql', 'utf-8')
    await client.query(sql)
    await client.query('COMMIT;')
    console.log('✅ MIGRACIÓN 040 APLICADA EXITOSAMENTE EN STAGING.')
  } catch (err) {
    await client.query('ROLLBACK;')
    console.error('❌ Error aplicando migración 040:', err)
    throw err
  } finally {
    await client.end()
  }
}

applyMigration040().catch(() => process.exit(1))
