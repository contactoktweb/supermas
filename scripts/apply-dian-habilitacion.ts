/**
 * SUPER MÁS ERP/POS — APLICA migraciones 058, 059 y 060 + datos de habilitación de Super Más
 *
 * ⚠️ MODIFICA LA BASE DE DATOS. Úselo solo después de:
 *   1. Confirmar que la base de .env.local es la correcta (desarrollo/staging de habilitación).
 *   2. Tener un backup (Supabase → Database → Backups, o pg_dump).
 *   3. Haber corrido antes la auditoría de solo lectura: pnpm exec tsx scripts/dian-audit-db.ts
 *
 * Ejecutar (el host debe coincidir EXACTAMENTE con el de la cadena de conexión de .env.local):
 *   pnpm exec tsx scripts/apply-dian-habilitacion.ts --confirmo-backup --host=<host-de-la-base>
 *
 * Conexión: DIRECT_URL (o DATABASE_URL) se leen SOLO de .env.local; las variables del entorno del
 * proceso se ignoran para no aplicar por error sobre otra base.
 *
 * Qué aplica (cada archivo en su propia transacción; si uno falla, ese se revierte completo y se
 * detiene: los anteriores quedan aplicados y se indica cuáles):
 *   - supabase/migrations/058_dian_habilitacion_numbering_and_guards.sql
 *   - supabase/migrations/059_sale_payments_bank_accounts_puc.sql
 *   - supabase/migrations/060_dian_credit_debit_notes_and_iva_treatment.sql (notas crédito/débito, exento/excluido)
 *   - supabase/seeds/2026-10-21_super_mas_dian_habilitacion.sql  (datos RUT, software, resolución SETP, PUC 112005.01)
 *
 * Cada migración aplicada se registra en supabase_migrations.schema_migrations si esa tabla existe.
 * No toca usuarios, roles ni facturas existentes. Los archivos se pueden re-ejecutar.
 * Datos que sí completa: productos con IVA > 0 quedan como GRAVADOS (los de 0 % quedan SIN clasificar);
 * facturas anteriores a la habilitación quedan en estado LEGACY (no se transmiten).
 */

import { Client } from 'pg'
import * as fs from 'fs'
import * as path from 'path'

const FILES = [
  'supabase/migrations/058_dian_habilitacion_numbering_and_guards.sql',
  'supabase/migrations/059_sale_payments_bank_accounts_puc.sql',
  'supabase/migrations/060_dian_credit_debit_notes_and_iva_treatment.sql',
  'supabase/seeds/2026-10-21_super_mas_dian_habilitacion.sql',
]

const LOCK_TIMEOUT = '5s'

function loadEnvLocal(): Record<string, string> {
  const out: Record<string, string> = {}
  if (!fs.existsSync('.env.local')) return out
  for (const line of fs.readFileSync('.env.local', 'utf8').split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const i = t.indexOf('=')
    if (i < 0) continue
    let v = t.slice(i + 1).trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
    out[t.slice(0, i).trim()] = v
  }
  return out
}

/** Host de la cadena de conexión, sin usuario ni contraseña. */
function hostOf(conn: string): string {
  try {
    return new URL(conn).hostname
  } catch {
    return conn.replace(/^.*@/, '').replace(/[:/?].*$/, '')
  }
}

function argValue(name: string): string | undefined {
  const prefix = `--${name}=`
  const arg = process.argv.find((a) => a.startsWith(prefix))
  return arg ? arg.slice(prefix.length).trim() : undefined
}

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

/** Versión y nombre de una migración a partir del archivo (058_nombre.sql → 058 / nombre). */
function migrationIdOf(file: string): { version: string; name: string } | null {
  if (!file.startsWith('supabase/migrations/')) return null
  const m = /^(\d+)_(.+)\.sql$/.exec(path.basename(file))
  return m ? { version: m[1], name: m[2] } : null
}

/**
 * Registra la migración en supabase_migrations.schema_migrations si la tabla existe.
 * Las columnas se inspeccionan en tiempo de ejecución (varían según la versión del CLI de Supabase).
 */
async function registerMigration(client: Client, file: string, sql: string): Promise<string> {
  const id = migrationIdOf(file)
  if (!id) return 'no aplica (datos, no migración)'

  const { rows } = await client.query<{ column_name: string }>(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = 'supabase_migrations' AND table_name = 'schema_migrations'`
  )
  const columns = new Set(rows.map((r) => r.column_name))
  if (!columns.has('version')) return 'tabla supabase_migrations.schema_migrations no existe: no se registró'

  const existing = await client.query('SELECT 1 FROM supabase_migrations.schema_migrations WHERE version = $1', [id.version])
  if (existing.rowCount) return `versión ${id.version} ya estaba registrada`

  const insertColumns = ['version']
  const values: unknown[] = [id.version]
  if (columns.has('name')) {
    insertColumns.push('name')
    values.push(id.name)
  }
  if (columns.has('statements')) {
    insertColumns.push('statements')
    values.push([sql])
  }
  const placeholders = insertColumns.map((_, i) => `$${i + 1}`).join(', ')
  const result = await client.query(
    `INSERT INTO supabase_migrations.schema_migrations (${insertColumns.join(', ')})
     VALUES (${placeholders})
     ON CONFLICT DO NOTHING`,
    values
  )
  return result.rowCount ? `registrada como versión ${id.version}` : `versión ${id.version} ya estaba registrada`
}

async function main() {
  const env = loadEnvLocal()
  const conn = env.DIRECT_URL || env.DATABASE_URL
  if (!conn) throw new Error('No hay DIRECT_URL ni DATABASE_URL en .env.local')
  const expectedHost = hostOf(conn)

  if (!process.argv.includes('--confirmo-backup')) {
    console.log('No se aplicó nada. Este script modifica la base de datos.')
    console.log(`Haga un backup y ejecute: pnpm exec tsx scripts/apply-dian-habilitacion.ts --confirmo-backup --host=${expectedHost}`)
    process.exit(2)
  }

  const requestedHost = argValue('host')
  if (!requestedHost || requestedHost !== expectedHost) {
    console.log('No se aplicó nada. El host indicado no coincide con el de la cadena de conexión de .env.local.')
    console.log(`  Indicado: ${requestedHost || '(ninguno)'}`)
    console.log(`  Esperado: ${expectedHost}`)
    console.log('Si esa es la base correcta, repita con --host=<host esperado>.')
    process.exit(2)
  }

  const isLocal = /^(localhost|127\.0\.0\.1|::1|\[::1\])$/.test(expectedHost)
  const client = new Client({ connectionString: conn, ssl: isLocal ? false : { rejectUnauthorized: false } })
  await client.connect()
  console.log(`Conectado a ${expectedHost}`)
  await client.query(`SET lock_timeout = '${LOCK_TIMEOUT}'`)

  const applied: string[] = []
  try {
    for (const file of FILES) {
      const sql = fs.readFileSync(file, 'utf8')
      process.stdout.write(`Aplicando ${file} ... `)
      try {
        await client.query(sql)
      } catch (e: unknown) {
        await client.query('ROLLBACK').catch(() => undefined)
        console.log('FALLÓ (este archivo se revirtió completo)')
        console.log(`\nError: ${errorMessage(e)}`)
        console.log(`Quedaron aplicados: ${applied.length ? applied.join(', ') : 'ninguno'}`)
        console.log(`No se aplicaron: ${FILES.slice(FILES.indexOf(file)).join(', ')}`)
        process.exitCode = 1
        return
      }
      applied.push(file)
      let registry: string
      try {
        registry = await registerMigration(client, file, sql)
      } catch (e: unknown) {
        registry = `no se pudo registrar en schema_migrations (${errorMessage(e)})`
      }
      console.log(`OK — ${registry}`)
    }
  } finally {
    await client.end()
  }
  console.log('\nListo. Ahora ejecute la auditoría de solo lectura y revise el resultado:')
  console.log('  pnpm exec tsx scripts/dian-audit-db.ts')
}

main().catch((e) => {
  console.error('Error:', errorMessage(e))
  process.exit(1)
})
