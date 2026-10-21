/**
 * SUPER MÁS ERP/POS — AUDITORÍA DIAN / PUC DE LA BASE DE DATOS (SOLO LECTURA)
 *
 * Ejecutar en la raíz del proyecto:
 *   pnpm exec tsx scripts/dian-audit-db.ts
 *
 * - Usa DATABASE_URL (o DIRECT_URL) de .env.local.
 * - Abre una transacción READ ONLY: no puede modificar nada.
 * - No imprime secretos (PIN, clave técnica, certificado, contraseñas) ni números bancarios completos.
 * - Copie la salida completa y péguela en la conversación.
 */

import { Client } from 'pg'
import * as fs from 'fs'

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

const env = { ...loadEnvLocal(), ...process.env } as Record<string, string | undefined>
const section = (t: string) => console.log(`\n=== ${t} ===`)

async function main() {
  const conn = env.DATABASE_URL || env.DIRECT_URL
  if (!conn) throw new Error('No hay DATABASE_URL ni DIRECT_URL en .env.local')
  const host = conn.replace(/^.*@/, '').replace(/[:/].*$/, '')
  console.log('SUPER MÁS — Auditoría DIAN/PUC (solo lectura)')
  console.log(`Fecha: ${new Date().toISOString()}  Host BD: ${host}`)

  section('Variables DIAN del servidor (.env.local) — solo si tienen valor')
  for (const k of [
    'DIAN_ENVIRONMENT',
    'DIAN_SOFTWARE_PIN',
    'DIAN_TEST_TECHNICAL_KEY',
    'DIAN_CERTIFICATE_BASE64',
    'DIAN_CERTIFICATE_PASSWORD',
    'SUPABASE_SERVICE_ROLE_KEY',
  ]) {
    const v = env[k]
    const shown = k === 'DIAN_ENVIRONMENT' ? v || '(vacía)' : v ? `CON VALOR (${v.length} caracteres)` : 'VACÍA'
    console.log(`${k.padEnd(28)} ${shown}`)
  }
  const legacy = ['DIAN_NIT', 'DIAN_DV', 'DIAN_SOFTWARE_ID', 'DIAN_TEST_SET_ID', 'DIAN_TEST_PREFIX'].filter((k) => env[k])
  if (legacy.length) console.log(`Variables antiguas que ya no se usan (datos viven en BD): ${legacy.join(', ')}`)

  const isLocal = /@(localhost|127\.0\.0\.1)[:/]/.test(conn)
  const client = new Client({ connectionString: conn, ssl: isLocal ? false : { rejectUnauthorized: false } })
  await client.connect()
  await client.query('BEGIN TRANSACTION READ ONLY')
  const q = async (sql: string, params: any[] = []) => (await client.query(sql, params)).rows
  const table = (rows: any[]) => (rows.length ? console.table(rows) : console.log('(sin filas)'))

  try {
    section('Migraciones DIAN / PUC aplicadas (objetos existentes)')
    const fns = await q(
      `SELECT p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = 'public' AND p.proname = ANY($1)`,
      [[
        'fn_create_electronic_invoice_from_sale',
        'fn_guard_electronic_invoice_fiscal_fields',
        'fn_execute_pos_sale_with_payments',
        'fn_register_sale_payments',
        'fn_set_bank_account_ledger',
        'fn_list_payment_bank_accounts',
        'fn_cause_sale_accounting',
        'fn_cause_sale_accounting_internal',
        'fn_create_electronic_note',
        'fn_sale_item_set_iva_treatment',
      ]]
    )
    const have = new Set(fns.map((r: any) => r.proname))
    console.log(`058 (numeración DIAN + blindaje): ${have.has('fn_create_electronic_invoice_from_sale') && have.has('fn_guard_electronic_invoice_fiscal_fields') ? 'APLICADA' : 'NO APLICADA'}`)
    console.log(`059 (pagos por cuenta bancaria + PUC): ${have.has('fn_execute_pos_sale_with_payments') && have.has('fn_set_bank_account_ledger') ? 'APLICADA' : 'NO APLICADA'}`)
    console.log(`060 (notas crédito/débito + exento/excluido): ${have.has('fn_create_electronic_note') && have.has('fn_sale_item_set_iva_treatment') ? 'APLICADA' : 'NO APLICADA'}`)
    const cols053 = await q(`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='electronic_invoices' AND column_name IN ('idempotency_key','xml_signed','environment')`)
    console.log(`053 (esquema DIAN base): ${cols053.length === 3 ? 'APLICADA' : 'NO APLICADA'}`)
    const has057 = await q(`SELECT 1 FROM public.roles WHERE code = 'FACTURACION_POS'`)
    console.log(`057 (RBAC 7 roles): ${has057.length ? 'APLICADA' : 'NO APLICADA'}`)

    section('Empresa emisora (companies)')
    table(
      await q(`SELECT business_name, tax_id, verification_digit AS dv, city, department, address,
                      to_jsonb(c) ->> 'dian_municipality_code' AS dane_mpio,
                      to_jsonb(c) ->> 'dian_tax_level_codes' AS tax_level,
                      to_jsonb(c) ->> 'rut_responsibilities' AS rut_resp
               FROM public.companies c`)
    )

    section('Software propio (dian_software_config)')
    try {
      table(
        await q(`SELECT environment, '••••' || RIGHT(software_id, 4) AS software_id, CASE WHEN test_set_id IS NULL THEN 'FALTA' ELSE '••••' || RIGHT(test_set_id, 4) END AS test_set_id, is_active
                 FROM public.dian_software_config`)
      )
    } catch (e: any) {
      console.log(`Tabla no disponible: ${e.message}`)
    }

    section('Resoluciones DIAN (dian_resolutions) — sin clave técnica')
    table(
      await q(`SELECT environment, document_type, dian_prefix, resolution_number, resolution_date, valid_from, valid_to,
                      initial_range, final_range, current_number, to_jsonb(r) ->> 'last_assigned_number' AS ultimo_asignado,
                      is_active, (technical_key IS NOT NULL) AS clave_tecnica_en_bd
               FROM public.dian_resolutions r ORDER BY environment, dian_prefix`)
    )

    section('Facturas electrónicas por estado')
    table(
      await q(`SELECT document_type, prefix, dian_status::text AS dian_status,
                      COALESCE(to_jsonb(e) ->> 'transmission_state', '—') AS transmision,
                      COUNT(*) AS cantidad,
                      COUNT(*) FILTER (WHERE (to_jsonb(e) ->> 'application_response_xml') IS NULL) AS sin_respuesta_dian
               FROM public.electronic_invoices e GROUP BY 1,2,3,4 ORDER BY 1,2,3`)
    )
    const fake = await q(`SELECT COUNT(*)::int AS n FROM public.electronic_invoices e
                          WHERE dian_status = 'ACCEPTED' AND (to_jsonb(e) ->> 'application_response_xml') IS NULL`)
    console.log(`Facturas marcadas ACEPTADAS sin respuesta real de la DIAN (simulación anterior): ${fake[0].n}`)

    section('PUC: cuentas de caja y bancos (1105 / 1110 / 1120)')
    table(
      await q(`SELECT code, name, level, is_active FROM public.accounting_accounts
               WHERE code LIKE '1105%' OR code LIKE '1110%' OR code LIKE '1120%' ORDER BY code`)
    )

    section('PUC: cuentas usadas por la causación de ventas (accounting_default_accounts)')
    try {
      table(
        await q(`SELECT d.purpose, a.code, a.name FROM public.accounting_default_accounts d
                 JOIN public.accounting_accounts a ON a.id = d.accounting_account_id ORDER BY d.purpose`)
      )
    } catch (e: any) {
      console.log(`Tabla no disponible (migración 059 no aplicada): ${e.message.split('\n')[0]}`)
    }

    section('Cuentas bancarias → subcuenta PUC (solo últimos 4 dígitos)')
    table(
      await q(`SELECT b.bank_name, b.account_type, '••••' || RIGHT(b.account_number, 4) AS cuenta, b.is_active,
                      a.code AS puc, a.name AS puc_nombre
               FROM public.bank_accounts b LEFT JOIN public.accounting_accounts a ON a.id = b.accounting_account_id
               ORDER BY b.account_type, b.bank_name`)
    )

    section('Ventas por medio de pago y contabilización')
    table(
      await q(`SELECT s.payment_method::text AS medio, COUNT(*) AS ventas,
                      COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM public.accounting_entries ae
                                                     WHERE ae.document_type = 'SALE' AND ae.document_reference = s.sale_number)) AS con_asiento
               FROM public.sales s GROUP BY 1 ORDER BY 1`)
    )

    section('Productos al 0 % de IVA: exento / excluido (requerido para facturar)')
    try {
      table(
        await q(`SELECT COALESCE(iva_treatment, 'SIN CLASIFICAR') AS tratamiento, COUNT(*) AS productos
                 FROM public.products WHERE is_active = true AND (COALESCE(tax_rate_percent, 0) = 0 OR is_tax_exempt = true)
                 GROUP BY 1 ORDER BY 1`)
      )
      const pend = await q(`SELECT sku, name FROM public.products
                            WHERE is_active = true AND (COALESCE(tax_rate_percent, 0) = 0 OR is_tax_exempt = true) AND iva_treatment IS NULL
                            ORDER BY name LIMIT 30`)
      if (pend.length) {
        console.log('Primeros productos sin clasificar (clasifíquelos en Productos → Tributación):')
        table(pend)
      }
    } catch (e: any) {
      console.log(`Columna iva_treatment no disponible (migración 060 no aplicada): ${e.message.split('\n')[0]}`)
    }

    section('Notas crédito / débito: consecutivos')
    try {
      table(await q(`SELECT environment, document_type, prefix, last_number FROM public.dian_note_sequences ORDER BY 1, 2`))
    } catch (e: any) {
      console.log(`Tabla no disponible (migración 060 no aplicada): ${e.message.split('\n')[0]}`)
    }

    section('Usuarios y roles (sin modificar nada)')
    table(await q(`SELECT r.code AS rol, COUNT(*) AS usuarios FROM public.users u JOIN public.roles r ON r.id = u.role_id GROUP BY 1 ORDER BY 1`))

    section('Permisos de facturación por rol')
    table(
      await q(`SELECT r.code AS rol, string_agg(p.code, ', ' ORDER BY p.code) AS permisos
               FROM public.roles r JOIN public.role_permissions rp ON rp.role_id = r.id JOIN public.permissions p ON p.id = rp.permission_id
               WHERE p.code LIKE 'invoices.%' OR p.code LIKE 'dian.%' OR p.code IN ('pos.access','sales.create','accounting.post','users.create')
               -- invoices.create = factura electrónica; invoices.cancel = notas crédito/débito
               GROUP BY 1 ORDER BY 1`)
    )
  } finally {
    await client.query('ROLLBACK')
    await client.end()
  }
  console.log('\nFin de la auditoría (no se modificó la base de datos).')
}

main().catch((e) => {
  console.error('Error en la auditoría:', e?.message || e)
  process.exit(1)
})
