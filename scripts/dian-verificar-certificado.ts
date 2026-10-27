/**
 * SUPER MÁS ERP/POS — VERIFICACIÓN DEL CERTIFICADO DIGITAL (y consulta opcional a la DIAN)
 *
 * Ejecutar en la raíz del proyecto, después de poner el certificado en .env.local:
 *   pnpm exec tsx scripts/dian-verificar-certificado.ts
 *       → abre el certificado con la contraseña y muestra titular, emisor y vigencia. No llama a la DIAN.
 *
 *   pnpm exec tsx scripts/dian-verificar-certificado.ts --consultar-dian
 *       → además llama a GetNumberingRange (ambiente de HABILITACIÓN) firmando con el certificado:
 *         prueba que la DIAN acepta el certificado y muestra los rangos autorizados al software,
 *         comparándolos con la resolución guardada en la base de datos. La clave técnica sale enmascarada.
 *
 *   pnpm exec tsx scripts/dian-verificar-certificado.ts --consultar-dian --mostrar-clave
 *       → igual, pero muestra la clave técnica completa para copiarla a DIAN_TEST_TECHNICAL_KEY.
 *         Solo en su computador; no la pegue en chats ni la suba a Git.
 *
 * Nunca imprime la contraseña ni la llave privada. No modifica la base de datos (consulta READ ONLY).
 */

import { Client } from 'pg'
import { loadSigningCertificate, describeCertificate } from '../features/invoices/services/dian/dian-certificate'
import { DianSoapAdapter } from '../features/invoices/services/dian/dian-soap.adapter'
import { DIAN_HABILITACION_WS_ENDPOINT } from '../features/invoices/services/dian/dian.config'
import { loadEnvLocal } from './load-env-local'

const env = { ...loadEnvLocal(), ...process.env } as Record<string, string | undefined>
const args = process.argv.slice(2)
const flag = (name: string) => args.includes(name)
const mask = (v: string | null) => (v ? `${v.slice(0, 4)}••••${v.slice(-4)} (${v.length} caracteres)` : '—')

async function readCompanyAndSoftware(): Promise<{ nit: string | null; softwareId: string | null; resolutions: any[] }> {
  const conn = env.DATABASE_URL || env.DIRECT_URL
  if (!conn) return { nit: null, softwareId: null, resolutions: [] }
  const isLocal = /@(localhost|127\.0\.0\.1)[:/]/.test(conn)
  const client = new Client({ connectionString: conn, ssl: isLocal ? false : { rejectUnauthorized: false } })
  await client.connect()
  try {
    await client.query('BEGIN TRANSACTION READ ONLY')
    const c = (await client.query(`SELECT tax_id FROM public.companies ORDER BY created_at LIMIT 1`)).rows[0]
    const sw = (await client.query(`SELECT software_id FROM public.dian_software_config WHERE environment = 'HABILITACION' AND is_active = true LIMIT 1`)).rows[0]
    const res = (await client.query(
      `SELECT resolution_number, dian_prefix, initial_range, final_range, valid_from::text, valid_to::text
       FROM public.dian_resolutions WHERE environment = 'HABILITACION' AND is_active = true`
    )).rows
    await client.query('ROLLBACK')
    return { nit: c?.tax_id ? String(c.tax_id).replace(/[^0-9]/g, '') : null, softwareId: sw?.software_id || null, resolutions: res }
  } finally {
    await client.end()
  }
}

async function main() {
  console.log('SUPER MÁS — Verificación del certificado digital DIAN\n')

  // 1. Abrir el certificado
  let cert
  try {
    cert = loadSigningCertificate(env.DIAN_CERTIFICATE_BASE64, env.DIAN_CERTIFICATE_PASSWORD)
  } catch (e: any) {
    console.log(`❌ ${e.message}`)
    console.log('\nRevise en .env.local: DIAN_CERTIFICATE_BASE64 (el .p12 en Base64, una sola línea) y DIAN_CERTIFICATE_PASSWORD.')
    process.exit(1)
  }
  const d = describeCertificate(cert)
  const days = Math.floor((cert.notAfter.getTime() - Date.now()) / 86400000)
  console.log('✅ El certificado abre correctamente con la contraseña.')
  console.log(`   Titular (CN):  ${d.subject}`)
  console.log(`   Sujeto:        ${d.subjectName}`)
  console.log(`   Emisor:        ${d.issuer}`)
  console.log(`   Serial:        ${d.serialNumber}`)
  console.log(`   Vigencia:      ${d.validFrom} a ${d.validTo} (${days} días restantes)`)
  if (days < 30) console.log('   ⚠️  El certificado vence en menos de 30 días.')

  const db = await readCompanyAndSoftware().catch((e) => {
    console.log(`\n(No se pudo leer la base de datos: ${e.message.split('\n')[0]})`)
    return { nit: null, softwareId: null, resolutions: [] as any[] }
  })
  const nit = (args.find((a) => a.startsWith('--nit='))?.slice(6) || db.nit || '').replace(/[^0-9]/g, '')
  const softwareId = args.find((a) => a.startsWith('--software-id='))?.slice(14) || db.softwareId || ''

  if (nit) {
    const inSubject = d.subjectName.replace(/[^0-9]/g, ' ').split(/\s+/).some((t: string) => t.startsWith(nit))
    console.log(inSubject
      ? `✅ El NIT ${nit} aparece en el sujeto del certificado.`
      : `⚠️  El NIT ${nit} no aparece en el sujeto del certificado. Verifique que el certificado sea de la empresa (persona jurídica) y no de una persona natural.`)
  }

  if (!flag('--consultar-dian')) {
    console.log('\nPara probar el certificado contra la DIAN (habilitación): agregue --consultar-dian')
    return
  }

  // 2. Consulta a la DIAN (habilitación): GetNumberingRange firmado con el certificado
  if (!nit || !softwareId) {
    console.log('\n❌ Falta el NIT o el Software ID (aplique las migraciones y el seed, o pase --nit=... --software-id=...).')
    process.exit(1)
  }
  console.log(`\nConsultando a la DIAN (habilitación) los rangos del software ${softwareId.slice(0, 8)}… para el NIT ${nit}…`)
  const adapter = new DianSoapAdapter(env.DIAN_HABILITACION_WS_URL || DIAN_HABILITACION_WS_ENDPOINT, cert, Number(env.DIAN_HTTP_TIMEOUT_MS || 60000))
  let res
  try {
    res = await adapter.getNumberingRange(nit, softwareId)
  } catch (e: any) {
    console.log(`❌ ${e.message}`)
    process.exit(1)
  }
  if (res.fault) {
    console.log(`❌ La DIAN rechazó la solicitud: ${res.fault}`)
    console.log('   Suele significar que el certificado no corresponde al NIT o no está habilitado para el software.')
    process.exit(1)
  }
  console.log(`✅ La DIAN respondió (código ${res.operationCode ?? '—'}: ${res.operationDescription ?? 'sin descripción'}). El certificado fue aceptado.`)
  if (!res.ranges.length) {
    console.log('   La DIAN no devolvió rangos para este software.')
    return
  }
  const showKey = flag('--mostrar-clave')
  console.table(
    res.ranges.map((r) => ({
      resolucion: r.resolutionNumber,
      prefijo: r.prefix,
      desde: r.fromNumber,
      hasta: r.toNumber,
      vigencia: `${r.validDateFrom} a ${r.validDateTo}`,
      clave_tecnica: showKey ? r.technicalKey : mask(r.technicalKey),
      coincide_con_BD: db.resolutions.some(
        (x: any) =>
          String(x.resolution_number) === String(r.resolutionNumber) &&
          String(x.dian_prefix) === String(r.prefix) &&
          String(x.initial_range) === String(r.fromNumber) &&
          String(x.final_range) === String(r.toNumber)
      )
        ? 'sí'
        : 'NO',
    }))
  )
  const configured = env.DIAN_TEST_TECHNICAL_KEY || ''
  const setp = res.ranges.find((r) => r.prefix === 'SETP')
  if (setp?.technicalKey) {
    console.log(configured
      ? configured === setp.technicalKey
        ? '✅ DIAN_TEST_TECHNICAL_KEY de .env.local coincide con la clave técnica del rango SETP.'
        : '❌ DIAN_TEST_TECHNICAL_KEY de .env.local NO coincide con la clave técnica del rango SETP.'
      : 'DIAN_TEST_TECHNICAL_KEY está vacía: cópiela con --mostrar-clave.')
  }
}

main().catch((e) => {
  console.error('Error:', e?.message || e)
  process.exit(1)
})
