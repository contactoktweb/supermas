/**
 * SUPER MÁS ERP/POS — APLICA migraciones 058, 059 y 060 + datos de habilitación de Super Más
 *
 * ⚠️ MODIFICA LA BASE DE DATOS. Úselo solo después de:
 *   1. Confirmar que DATABASE_URL es la base correcta (desarrollo/staging de habilitación).
 *   2. Tener un backup (Supabase → Database → Backups, o pg_dump).
 *   3. Haber corrido antes la auditoría de solo lectura: pnpm exec tsx scripts/dian-audit-db.ts
 *
 * Ejecutar:
 *   pnpm exec tsx scripts/apply-dian-habilitacion.ts --confirmo-backup
 *
 * Qué aplica (cada archivo en su propia transacción; si uno falla, ese se revierte completo):
 *   - supabase/migrations/058_dian_habilitacion_numbering_and_guards.sql
 *   - supabase/migrations/059_sale_payments_bank_accounts_puc.sql
 *   - supabase/migrations/060_dian_credit_debit_notes_and_iva_treatment.sql (notas crédito/débito, exento/excluido)
 *   - supabase/seeds/2026-10-21_super_mas_dian_habilitacion.sql  (datos RUT, software, resolución SETP, PUC 11200501)
 *
 * No toca usuarios, roles ni facturas existentes. Los archivos se pueden re-ejecutar.
 * Datos que sí completa: productos con IVA > 0 quedan como GRAVADOS (los de 0 % quedan SIN clasificar).
 */

import { Client } from 'pg'
import * as fs from 'fs'

const FILES = [
  'supabase/migrations/058_dian_habilitacion_numbering_and_guards.sql',
  'supabase/migrations/059_sale_payments_bank_accounts_puc.sql',
  'supabase/migrations/060_dian_credit_debit_notes_and_iva_treatment.sql',
  'supabase/seeds/2026-10-21_super_mas_dian_habilitacion.sql',
]

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

async function main() {
  if (!process.argv.includes('--confirmo-backup')) {
    console.log('No se aplicó nada. Este script modifica la base de datos.')
    console.log('Haga un backup y ejecute: pnpm exec tsx scripts/apply-dian-habilitacion.ts --confirmo-backup')
    process.exit(2)
  }
  const env = { ...loadEnvLocal(), ...process.env } as Record<string, string | undefined>
  const conn = env.DIRECT_URL || env.DATABASE_URL
  if (!conn) throw new Error('No hay DIRECT_URL ni DATABASE_URL en .env.local')
  const isLocal = /@(localhost|127\.0\.0\.1)[:/]/.test(conn)
  const client = new Client({ connectionString: conn, ssl: isLocal ? false : { rejectUnauthorized: false } })
  await client.connect()
  console.log(`Conectado a ${conn.replace(/^.*@/, '').replace(/[:/].*$/, '')}`)

  try {
    for (const file of FILES) {
      const sql = fs.readFileSync(file, 'utf8')
      process.stdout.write(`Aplicando ${file} ... `)
      try {
        await client.query(sql)
        console.log('OK')
      } catch (e: any) {
        await client.query('ROLLBACK').catch(() => undefined)
        console.log('FALLÓ (revertido)')
        throw new Error(`${file}: ${e.message}`)
      }
    }
  } finally {
    await client.end()
  }
  console.log('\nListo. Ahora ejecute la auditoría de solo lectura y revise el resultado:')
  console.log('  pnpm exec tsx scripts/dian-audit-db.ts')
}

main().catch((e) => {
  console.error('Error:', e?.message || e)
  process.exit(1)
})
