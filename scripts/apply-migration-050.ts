import { Client } from 'pg'
import * as fs from 'fs'
import * as path from 'path'

async function run() {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    console.error('DATABASE_URL no configurada')
    process.exit(1)
  }

  const client = new Client({ connectionString: databaseUrl })
  await client.connect()
  console.log('Conectado a PostgreSQL Staging...')

  const sqlPath = path.join(process.cwd(), 'supabase/migrations/050_web_orders_and_catalogs_hardening.sql')
  const sql = fs.readFileSync(sqlPath, 'utf8')

  console.log('Aplicando migración 050...')
  await client.query(sql)
  console.log('✅ Migración 050 aplicada exitosamente.')

  await client.end()
}

run().catch((e) => {
  console.error('Error aplicando migración 050:', e)
  process.exit(1)
})
