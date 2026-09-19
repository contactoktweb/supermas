/**
 * ==============================================================================
 * SCRIPT DE MIGRACIÓN: MOCK-DB -> SUPABASE POSTGRESQL
 * ERP SUPER MÁS S.A.S.
 * ==============================================================================
 *
 * Ejecución: npx tsx scripts/migrate-mock-data.ts
 *
 * Requiere en .env.local:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ ERROR: Faltan variables de entorno NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.')
  console.error('Asegúrate de configurarlas en tu archivo .env.local antes de ejecutar la migración.')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const MOCK_DIR = path.join(process.cwd(), 'lib/supabase/mock-db')

function readJson<T = any>(filename: string): T {
  const filePath = path.join(MOCK_DIR, filename)
  if (!fs.existsSync(filePath)) {
    console.warn(`⚠️ Archivo no encontrado: ${filename}, se retornará array vacío.`)
    return [] as unknown as T
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'))
}

async function runMigration() {
  console.log('🚀 INICIANDO MIGRACIÓN TRANSACCIONAL DE DATOS HACIA SUPABASE POSTGRESQL...')

  try {
    // 1. Empresa matriz
    console.log('\n[1/13] Migrando empresa principal (company_settings)...')
    const compData = readJson('company_settings.json')
    const companyPayload = {
      business_name: compData.businessName || 'Distribuidora Super Más S.A.S.',
      trade_name: compData.tradeName || 'Super Más',
      tax_id: compData.nit || '900.842.109-4',
      verification_digit: compData.dv || '4',
      tax_regime: compData.taxRegime || 'RESPONSABLE_DE_IVA',
      economic_activity_code: compData.economicActivityCode || '4711',
      legal_representative_name: compData.legalRepresentative || 'Mauricio Andrade',
      legal_representative_doc: compData.legalRepresentativeDoc || '71.284.920',
      address: compData.address || 'Calle 50 # 45-28',
      city: compData.city || 'Medellín',
      department: compData.department || 'Antioquia',
      country: 'Colombia',
      phone: compData.phone || '+57 604 444 8920',
      email: compData.email || 'contacto@supermas.com.co',
      currency: compData.currency || 'COP',
      status: 'ACTIVE',
    }

    const { data: insertedCompany, error: compErr } = await supabase
      .from('companies')
      .upsert([companyPayload], { onConflict: 'tax_id' })
      .select()
      .single()

    if (compErr) throw new Error(`Error al migrar empresa: ${compErr.message}`)
    const companyId = insertedCompany?.id
    console.log(`✓ Empresa migrada exitosamente (ID: ${companyId})`)

    // 2. Categorías
    console.log('\n[2/13] Migrando categorías de productos...')
    const categories = readJson<any[]>('categories.json')
    if (categories.length > 0) {
      const catPayload = categories.map((c) => ({
        name: c.name,
        slug: c.slug || c.name.toLowerCase().replace(/\s+/g, '-'),
        code: c.code || c.id,
        is_active: true,
      }))
      const { error: catErr } = await supabase.from('categories').upsert(catPayload, { onConflict: 'slug' })
      if (catErr) console.warn(`Nota en categorías: ${catErr.message}`)
      else console.log(`✓ ${catPayload.length} categorías sincronizadas.`)
    }

    // 3. Marcas
    console.log('\n[3/13] Migrando marcas comerciales...')
    const brands = readJson<any[]>('brands.json')
    if (brands.length > 0) {
      const brandPayload = brands.map((b) => ({
        name: b.name,
        slug: b.slug || b.name.toLowerCase().replace(/\s+/g, '-'),
        is_active: true,
      }))
      const { error: bErr } = await supabase.from('brands').upsert(brandPayload, { onConflict: 'name' })
      if (bErr) console.warn(`Nota en marcas: ${bErr.message}`)
      else console.log(`✓ ${brandPayload.length} marcas sincronizadas.`)
    }

    // 4. Ubicaciones / Bodegas
    console.log('\n[4/13] Migrando sedes logísticas (locations)...')
    const locations = readJson<any[]>('locations.json')
    if (locations.length > 0) {
      const locPayload = locations.map((loc) => ({
        company_id: companyId,
        code: loc.code,
        name: loc.name,
        type: loc.type || 'WAREHOUSE',
        status: loc.status || 'ACTIVE',
        address: loc.address || 'Medellín',
        city: loc.city || 'Medellín',
        department: loc.department || 'Antioquia',
        phone: loc.phone || '',
        email: loc.email || '',
        manager_name: loc.managerName || '',
        is_ecommerce_source: Boolean(loc.settings?.isEcommerceProcessingSource),
        is_store_point: Boolean(loc.settings?.isStorePoint),
      }))
      const { error: locErr } = await supabase.from('locations').upsert(locPayload, { onConflict: 'code' })
      if (locErr) throw new Error(`Error en ubicaciones: ${locErr.message}`)
      console.log(`✓ ${locPayload.length} bodegas migradas.`)
    }

    // 5. Clientes
    console.log('\n[5/13] Migrando clientes y terceros...')
    const customers = readJson<any[]>('customers.json')
    if (customers.length > 0) {
      const custPayload = customers.map((c) => ({
        document_type: c.documentType || 'NIT',
        document_number: c.documentNumber,
        verification_digit: c.verificationDigit || null,
        first_name: c.firstName || '',
        last_name: c.lastName || '',
        company_name: c.companyName || `${c.firstName || ''} ${c.lastName || ''}`.trim(),
        customer_type: c.customerType || 'COMPANY',
        customer_category: c.customerCategory || 'RETAIL',
        email: c.email,
        phone: c.phone,
        address: c.address,
        city: c.city || 'Medellín',
        credit_limit: c.creditLimit || 0,
        is_active: true,
      }))
      const { error: custErr } = await supabase.from('customers').upsert(custPayload, { onConflict: 'document_number' })
      if (custErr) console.warn(`Nota en clientes: ${custErr.message}`)
      else console.log(`✓ ${custPayload.length} clientes sincronizados.`)
    }

    // 6. Proveedores
    console.log('\n[6/13] Migrando proveedores...')
    const suppliers = readJson<any[]>('suppliers.json')
    if (suppliers.length > 0) {
      const suppPayload = suppliers.map((s) => ({
        tax_id: s.taxId || s.nit,
        verification_digit: s.verificationDigit || null,
        name: s.name,
        legal_name: s.legalName || s.name,
        contact_name: s.contactName,
        email: s.email,
        phone: s.phone,
        address: s.address,
        payment_terms_days: s.paymentTermsDays || 30,
        is_active: true,
      }))
      const { error: sErr } = await supabase.from('suppliers').upsert(suppPayload, { onConflict: 'tax_id' })
      if (sErr) console.warn(`Nota en proveedores: ${sErr.message}`)
      else console.log(`✓ ${suppPayload.length} proveedores sincronizados.`)
    }

    // 7. Productos maestros
    console.log('\n[7/13] Migrando catálogo único de productos...')
    const products = readJson<any[]>('products.json')
    if (products.length > 0) {
      const prodPayload = products.map((p) => ({
        sku: p.sku,
        barcode: p.barcode || null,
        name: p.name,
        slug: p.slug || p.sku.toLowerCase(),
        short_description: p.shortDescription || '',
        unit_of_measure: p.unitOfMeasure || 'UND',
        cost_price: p.costPrice || 0,
        public_sale_price: p.publicSalePrice || p.price || 0,
        wholesale_price: p.wholesalePrice || 0,
        tax_rate_percent: p.taxRatePercent || 19,
        is_active: p.isActive !== false,
        is_published_supermas: p.isPublishedSupermas !== false,
        is_published_distributor: p.isPublishedDistributor !== false,
      }))
      const { error: pErr } = await supabase.from('products').upsert(prodPayload, { onConflict: 'sku' })
      if (pErr) throw new Error(`Error en productos: ${pErr.message}`)
      console.log(`✓ ${prodPayload.length} productos maestros migrados.`)
    }

    // 8. Parámetros del sistema
    console.log('\n[8/13] Migrando parámetros globales de configuración...')
    const settings = readJson<any[]>('settings.json')
    if (settings.length > 0) {
      const settPayload = settings.map((st) => ({
        key: st.key,
        category: st.category,
        value: st.value,
        type: st.type || 'STRING',
        description: st.description,
        is_critical: Boolean(st.isCritical),
      }))
      const { error: stErr } = await supabase.from('system_settings').upsert(settPayload, { onConflict: 'key' })
      if (stErr) console.warn(`Nota en parámetros: ${stErr.message}`)
      else console.log(`✓ ${settPayload.length} configuraciones migradas.`)
    }

    console.log('\n🎉 ¡MIGRACIÓN DE DATOS INICIALES COMPLETADA CON ÉXITO EN SUPABASE!')
  } catch (err: any) {
    console.error('\n❌ ERROR DURANTE LA MIGRACIÓN:', err.message)
    process.exit(1)
  }
}

runMigration()
