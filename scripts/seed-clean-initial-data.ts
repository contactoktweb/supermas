/**
 * ==============================================================================
 * SCRIPT DE INSTALACIÓN LIMPIA: CONFIGURACIÓN INICIAL DEL SISTEMA
 * ERP SUPER MÁS S.A.S.
 * ==============================================================================
 *
 * Objetivo:
 * Inicializar en Supabase PostgreSQL ÚNICAMENTE las tablas de configuración,
 * perfiles tributarios DIAN, estructura PUC base y usuario administrador inicial.
 *
 * PROHIBIDO:
 * NO crea productos, ni clientes, ni proveedores, ni ventas, ni compras,
 * ni inventario, ni movimientos de Kardex.
 *
 * Ejecución:
 * npx tsx scripts/seed-clean-initial-data.ts
 */

import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.log('ℹ️ Para ejecutar este script contra Supabase en producción:')
  console.log('   Configura NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en tu entorno.')
  console.log('   Si estás operando en desarrollo con base vacía simulada, la app ya está lista.')
  process.exit(0)
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const MOCK_DIR = path.join(process.cwd(), 'lib/supabase/mock-db')

function readJson<T = any>(filename: string): T {
  const filePath = path.join(MOCK_DIR, filename)
  if (!fs.existsSync(filePath)) {
    return [] as unknown as T
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'))
}

async function seedCleanBootstrap() {
  console.log('====================================================================')
  console.log('🚀 INICIALIZACIÓN LIMPIA DE SUPABASE POSTGRESQL — ERP SUPER MÁS')
  console.log('====================================================================')
  console.log('🔒 REGLA: Cero datos comerciales (0 productos, 0 clientes, 0 inventario)')

  try {
    // 1. Configuración de Empresa Matriz
    console.log('\n[1/6] Configurando empresa principal (company_settings)...')
    const compData = readJson('company_settings.json')
    const { error: compErr } = await supabase.from('company_settings').upsert({
      id: compData.id || 'comp-supermas-001',
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
      phone: compData.phone || '+57 (604) 448-9200',
      email: compData.email || 'contacto@supermas.com.co',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    if (compErr) console.warn('   ⚠️ Error o tabla omitida en company_settings:', compErr.message)
    else console.log('   ✅ Empresa principal configurada.')

    // 2. Parámetros Generales del Sistema
    console.log('\n[2/6] Configurando parámetros operativos y reglas del ERP...')
    const settingsList = readJson('settings.json')
    if (Array.isArray(settingsList) && settingsList.length > 0) {
      const { error: settErr } = await supabase.from('settings').upsert(
        settingsList.map((s: any) => ({
          key: s.key,
          value: s.value,
          description: s.description,
          category: s.category,
          updated_at: new Date().toISOString(),
        }))
      )
      if (settErr) console.warn('   ⚠️ Error o tabla omitida en settings:', settErr.message)
      else console.log(`   ✅ ${settingsList.length} parámetros del sistema registrados.`)
    }

    // 3. Tarifas e Impuestos DIAN
    console.log('\n[3/6] Configurando estructura tributaria DIAN (tax_configs)...')
    const taxList = readJson('tax_configs.json')
    if (Array.isArray(taxList) && taxList.length > 0) {
      const { error: taxErr } = await supabase.from('tax_configs').upsert(
        taxList.map((t: any) => ({
          id: t.id,
          code: t.code,
          name: t.name,
          rate: t.rate,
          tax_type: t.taxType,
          is_active: t.isActive,
          description: t.description,
        }))
      )
      if (taxErr) console.warn('   ⚠️ Error o tabla omitida en tax_configs:', taxErr.message)
      else console.log(`   ✅ ${taxList.length} configuraciones impositivas DIAN creadas.`)
    }

    // 4. Estructura PUC Base (Plan Único de Cuentas)
    console.log('\n[4/6] Configurando estructura de cuentas contables PUC...')
    const pucs = readJson('accounting_accounts.json')
    if (Array.isArray(pucs) && pucs.length > 0) {
      const { error: pucErr } = await supabase.from('accounting_accounts').upsert(
        pucs.map((a: any) => ({
          id: a.id,
          code: a.code,
          name: a.name,
          level: a.level,
          nature: a.nature,
          account_type: a.accountType,
          parent_id: a.parentId || null,
          requires_third_party: a.requiresThirdParty ?? false,
          requires_cost_center: a.requiresCostCenter ?? false,
          is_active: a.isActive ?? true,
        }))
      )
      if (pucErr) console.warn('   ⚠️ Error o tabla omitida en accounting_accounts:', pucErr.message)
      else console.log(`   ✅ ${pucs.length} cuentas PUC creadas.`)
    }

    // 5. Período Contable Inicial
    console.log('\n[5/6] Configurando período fiscal vigente...')
    const periods = readJson('accounting_periods.json')
    if (Array.isArray(periods) && periods.length > 0) {
      const { error: perErr } = await supabase.from('accounting_periods').upsert(
        periods.map((p: any) => ({
          id: p.id,
          year: p.year,
          month: p.month,
          name: p.name,
          status: p.status,
          start_date: p.startDate,
          end_date: p.endDate,
        }))
      )
      if (perErr) console.warn('   ⚠️ Error o tabla omitida en accounting_periods:', perErr.message)
      else console.log(`   ✅ ${periods.length} períodos contables inicializados.`)
    }

    // 6. Usuario Administrador Inicial
    console.log('\n[6/6] Creando usuario administrador inicial...')
    const users = readJson('users.json')
    const admin = users.find((u: any) => u.role === 'SUPERADMIN') || {
      id: 'usr-admin-001',
      name: 'Mauricio Andrade',
      email: 'admin@supermas.com.co',
      role: 'SUPERADMIN',
      status: 'ACTIVE',
    }
    const { error: usrErr } = await supabase.from('users').upsert({
      id: admin.id,
      name: admin.name,
      email: admin.email,
      role: admin.role,
      status: admin.status,
      created_at: new Date().toISOString(),
    })
    if (usrErr) console.warn('   ⚠️ Error o tabla omitida en users:', usrErr.message)
    else console.log(`   ✅ Administrador inicial listo: ${admin.email}`)

    console.log('\n====================================================================')
    console.log('✅ INSTALACIÓN LIMPIA Y CONFIGURACIÓN INICIAL DE SISTEMA COMPLETADA.')
    console.log('🚫 NO SE INSERTARON PRODUCTOS, CLIENTES, PROVEEDORES, VENTAS, COMPRAS NI STOCK.')
    console.log('====================================================================')
  } catch (err: any) {
    console.error('❌ Error general durante el inicio limpio:', err.message)
  }
}

seedCleanBootstrap()
