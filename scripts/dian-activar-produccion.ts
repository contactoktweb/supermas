/**
 * SUPER MÁS ERP/POS — PASO A PRODUCCIÓN DE LA FACTURACIÓN ELECTRÓNICA (SOFTWARE PROPIO)
 *
 * Ejecutar en la raíz del proyecto:
 *   pnpm dian:produccion
 *       → SOLO CONSULTA. Pide a la DIAN (WebService de PRODUCCIÓN, firmado con el certificado) los rangos
 *         de numeración asociados al software y muestra el estado actual de la base de datos.
 *         La clave técnica sale enmascarada. No modifica nada.
 *
 *   pnpm dian:produccion --mostrar-clave
 *       → igual, pero muestra la clave técnica completa para copiarla a DIAN_PRODUCTION_TECHNICAL_KEY.
 *         Solo en su computador; no la pegue en chats ni la suba a Git.
 *
 *   pnpm dian:produccion --aplicar --prefijo=FE --prefijo-nc=NC --prefijo-nd=ND --confirmo-backup [--desde=N] [--resolucion=R]
 *       → en UNA transacción: registra la resolución de producción tal como la devuelve la DIAN para ese
 *         prefijo, crea los consecutivos de notas crédito/débito y deja activa la configuración de
 *         PRODUCCION (desactiva la de habilitación). La clave técnica NO se guarda en la base de datos.
 *         Solo usa rangos vigentes hoy; si hay varios con ese prefijo, --resolucion=R elige cuál.
 *         --desde=N: primer número a usar si parte del rango ya se usó con otro sistema.
 *
 * Después de --aplicar, la emisión queda detenida hasta que DIAN_ENVIRONMENT=PRODUCCION y
 * DIAN_PRODUCTION_TECHNICAL_KEY estén configuradas en el servidor: si el ambiente del servidor y el de la
 * base de datos no coinciden, la base de datos rechaza la factura.
 */

import { Client } from 'pg'
import { loadSigningCertificate } from '../features/invoices/services/dian/dian-certificate'
import { DianNumberingRange, DianSoapAdapter } from '../features/invoices/services/dian/dian-soap.adapter'
import { DIAN_PRODUCCION_WS_ENDPOINT } from '../features/invoices/services/dian/dian.config'
import { loadEnvLocal } from './load-env-local'

const env = { ...loadEnvLocal(), ...process.env } as Record<string, string | undefined>
const args = process.argv.slice(2)
const flag = (name: string) => args.includes(name)
const option = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3).trim() || ''
const mask = (v: string | null) => (v ? `••••${v.slice(-4)} (${v.length} caracteres)` : '—')
const todayBogota = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date())
const PREFIX_PATTERN = /^[A-Z0-9]{1,4}$/

function fail(message: string): never {
  console.log(`ERROR: ${message}`)
  process.exit(1)
}

async function connect(): Promise<Client> {
  const conn = env.DATABASE_URL || env.DIRECT_URL
  if (!conn) fail('Falta DATABASE_URL en .env.local.')
  const isLocal = /@(localhost|127\.0\.0\.1)[:/]/.test(conn)
  const client = new Client({ connectionString: conn, ssl: isLocal ? false : { rejectUnauthorized: false } })
  await client.connect()
  return client
}

async function main() {
  console.log('SUPER MÁS — Paso a producción de la facturación electrónica\n')

  const cert = (() => {
    try {
      return loadSigningCertificate(env.DIAN_CERTIFICATE_BASE64, env.DIAN_CERTIFICATE_PASSWORD)
    } catch (e: any) {
      return fail(e.message)
    }
  })()

  const client = await connect()
  try {
    const company = (await client.query(`SELECT id, tax_id FROM public.companies ORDER BY created_at LIMIT 1`)).rows[0]
    if (!company) fail('No hay empresa registrada en la base de datos.')
    const nit = String(company.tax_id || '').replace(/[^0-9]/g, '')
    const software = (await client.query(
      `SELECT environment, software_id, software_name, is_active FROM public.dian_software_config WHERE company_id = $1 ORDER BY environment`,
      [company.id]
    )).rows
    const softwareId = software.find((s) => s.software_id)?.software_id as string | undefined
    if (!nit || !softwareId) fail('Falta el NIT de la empresa o el Software ID en dian_software_config.')

    console.log('Estado actual en la base de datos:')
    console.table(software.map((s) => ({ ambiente: s.environment, activo: s.is_active, software: `${String(s.software_id).slice(0, 8)}…` })))

    console.log(`Consultando a la DIAN (PRODUCCIÓN) los rangos del software ${softwareId.slice(0, 8)}… para el NIT ${nit}…`)
    const adapter = new DianSoapAdapter(DIAN_PRODUCCION_WS_ENDPOINT, cert, Number(env.DIAN_HTTP_TIMEOUT_MS || 60000))
    const res = await adapter.getNumberingRange(nit, softwareId).catch((e: any) => fail(e.message))
    if (res.fault) fail(`La DIAN rechazó la solicitud: ${res.fault}`)
    console.log(`La DIAN respondió (código ${res.operationCode ?? '—'}: ${res.operationDescription ?? 'sin descripción'}).`)
    if (!res.ranges.length) {
      console.log('\nLa DIAN aún no tiene un prefijo de producción asociado a este software.')
      console.log('En el portal de facturación: solicite la resolución de numeración y asocie su prefijo al software propio.')
      return
    }

    const showKey = flag('--mostrar-clave')
    console.table(res.ranges.map((r) => ({
      resolucion: r.resolutionNumber,
      fecha: r.resolutionDate,
      prefijo: r.prefix,
      desde: r.fromNumber,
      hasta: r.toNumber,
      vigencia: `${r.validDateFrom} a ${r.validDateTo}`,
      clave_tecnica: showKey ? r.technicalKey : mask(r.technicalKey),
    })))

    if (!flag('--aplicar')) {
      console.log('\nSolo consulta: no se modificó nada. Para registrar la resolución use --aplicar (ver encabezado del script).')
      return
    }

    await apply(client, company.id, softwareId, res.ranges)
  } finally {
    await client.end()
  }
}

async function apply(client: Client, companyId: string, softwareId: string, ranges: DianNumberingRange[]) {
  if (!flag('--confirmo-backup')) fail('Haga un respaldo de la base de datos y agregue --confirmo-backup.')
  const prefix = option('prefijo').toUpperCase()
  const creditPrefix = option('prefijo-nc').toUpperCase()
  const debitPrefix = option('prefijo-nd').toUpperCase()
  for (const [name, value] of [['--prefijo', prefix], ['--prefijo-nc', creditPrefix], ['--prefijo-nd', debitPrefix]]) {
    if (!PREFIX_PATTERN.test(value)) fail(`${name} es obligatorio: de 1 a 4 letras o números (ej. ${name}=FE).`)
  }
  if (new Set([prefix, creditPrefix, debitPrefix]).size !== 3) fail('Los prefijos de factura, nota crédito y nota débito deben ser distintos.')

  const today = todayBogota()
  const resolution = option('resolucion')
  const candidates = ranges.filter((r) =>
    r.prefix === prefix && (!resolution || r.resolutionNumber === resolution) &&
    String(r.validDateFrom) <= today && today <= String(r.validDateTo))
  if (candidates.length === 0) {
    fail(`La DIAN no tiene una resolución vigente hoy (${today}) con el prefijo ${prefix}${resolution ? ` y número ${resolution}` : ''} asociada a este software.`)
  }
  if (candidates.length > 1) {
    fail(`Hay ${candidates.length} resoluciones vigentes con el prefijo ${prefix}: indique cuál con --resolucion= (${candidates.map((r) => r.resolutionNumber).join(', ')}).`)
  }
  const range = candidates[0]

  // El consecutivo de la base de datos parte del mayor número ya usado con ese prefijo en cualquier ambiente.
  const used = (await client.query(`SELECT COUNT(*)::int AS n FROM public.electronic_invoices WHERE prefix = $1`, [prefix])).rows[0].n
  if (used > 0) fail(`Ya existen ${used} documentos con el prefijo ${prefix} (por ejemplo de pruebas): use un prefijo de producción distinto.`)

  const configuredKey = env.DIAN_PRODUCTION_TECHNICAL_KEY?.trim()
  if (configuredKey && configuredKey !== range.technicalKey) {
    fail('DIAN_PRODUCTION_TECHNICAL_KEY no coincide con la clave técnica de esta resolución. Corríjala antes de activar.')
  }
  const from = Number(range.fromNumber)
  const to = Number(range.toNumber)
  const start = option('desde') ? Number(option('desde')) : from
  if (!Number.isInteger(start) || start < from || start > to) fail(`--desde debe estar entre ${from} y ${to}.`)

  await client.query('BEGIN')
  try {
    await client.query(
      `INSERT INTO public.dian_resolutions
         (company_id, dian_prefix, resolution_number, resolution_date, valid_from, valid_to,
          initial_range, final_range, current_number, last_assigned_number, document_type, environment, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'ELECTRONICA', 'PRODUCCION', true)`,
      [companyId, prefix, range.resolutionNumber, range.resolutionDate, range.validDateFrom, range.validDateTo,
        from, to, start, start > from ? start - 1 : null]
    )
    for (const [documentType, notePrefix] of [['CREDIT_NOTE', creditPrefix], ['DEBIT_NOTE', debitPrefix]]) {
      await client.query(
        `INSERT INTO public.dian_note_sequences (company_id, environment, document_type, prefix)
         VALUES ($1, 'PRODUCCION', $2, $3)
         ON CONFLICT (company_id, environment, document_type) DO UPDATE SET prefix = EXCLUDED.prefix, updated_at = NOW()`,
        [companyId, documentType, notePrefix]
      )
    }
    await client.query(`UPDATE public.dian_software_config SET is_active = false, updated_at = NOW() WHERE company_id = $1`, [companyId])
    await client.query(
      `INSERT INTO public.dian_software_config (company_id, software_id, software_name, environment, operation_mode, is_active)
       SELECT company_id, software_id, software_name, 'PRODUCCION', operation_mode, true
       FROM public.dian_software_config WHERE company_id = $1 AND software_id = $2 AND environment = 'HABILITACION'
       ON CONFLICT (company_id, environment) DO UPDATE SET software_id = EXCLUDED.software_id, is_active = true, updated_at = NOW()`,
      [companyId, softwareId]
    )
    const active = (await client.query(`SELECT public.fn_dian_active_environment($1) AS env`, [companyId])).rows[0]?.env
    if (active !== 'PRODUCCION') throw new Error(`El ambiente activo quedó en ${active}.`)
    await client.query('COMMIT')
  } catch (e: any) {
    await client.query('ROLLBACK')
    fail(`No se aplicó ningún cambio: ${e.message}`)
  }

  console.log(`\nListo: resolución ${range.resolutionNumber} (${prefix} ${start}–${to}) registrada; notas ${creditPrefix}/${debitPrefix}; configuración de PRODUCCION activa.`)
  console.log('Falta en el servidor (Vercel): DIAN_ENVIRONMENT=PRODUCCION y DIAN_PRODUCTION_TECHNICAL_KEY (use --mostrar-clave), y volver a desplegar.')
}

main().catch((e) => fail(e?.message || String(e)))
