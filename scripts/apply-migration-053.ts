import { Client } from 'pg'
import * as fs from 'fs'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

async function applyMigration053() {
  const connStr = process.env.DATABASE_URL || process.env.DIRECT_URL
  if (!connStr) {
    throw new Error('No DATABASE_URL or DIRECT_URL defined in environment.')
  }

  const client = new Client({
    connectionString: connStr,
    ssl: { rejectUnauthorized: false },
  })

  await client.connect()
  console.log('--- INICIANDO APLICACIÓN DE MIGRACIÓN 053 EN POSTGRESQL (STAGING) ---')
  await client.query('BEGIN;')

  try {
    const sql = fs.readFileSync('supabase/migrations/053_dian_electronic_invoicing_schema.sql', 'utf-8')
    await client.query(sql)
    await client.query('COMMIT;')
    console.log('✅ MIGRACIÓN 053 APLICADA EXITOSAMENTE EN POSTGRESQL (STAGING).')
  } catch (err) {
    await client.query('ROLLBACK;')
    console.error('❌ Error aplicando migración 053 (TRANSACCIÓN REVERTIDA):', err)
    throw err
  } finally {
    await client.end()
  }
}

applyMigration053().catch((err) => {
  console.error(err)
  process.exit(1)
})
