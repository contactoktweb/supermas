/**
 * ==============================================================================
 * SCRIPT DE INICIALIZACIÓN BASE: PARÁMETROS TRIBUTARIOS Y CONTABLES
 * ERP SUPER MÁS S.A.S. — Supabase PostgreSQL
 * ==============================================================================
 *
 * Objetivo:
 * Cargar ÚNICAMENTE los catálogos regulatorios y estructurales en Supabase:
 * - Tarifas e impuestos oficiales DIAN (tax_configs)
 * - Plan Único de Cuentas PUC (accounting_accounts)
 * - Periodo contable fiscal inicial (accounting_periods)
 * - Parámetros técnicos del sistema (settings)
 *
 * REGLAS DE SEGURIDAD Y PUREZA:
 * 1. NO crea credenciales de usuario ni toca public.users (el primer usuario
 *    se registra directamente en Supabase Auth y el trigger le asigna SUPERADMIN).
 * 2. NO crea empresas (se configura por el administrador desde la UI /configuracion).
 * 3. NO crea bodegas, ni productos, ni clientes, ni proveedores, ni inventario, ni ventas.
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
  console.log('ℹ️ Para ejecutar este script contra Supabase:')
  console.log('   Configura NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en tu .env.local.')
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
  console.log('🚀 INICIALIZACIÓN BASE REGULATORIA — ERP SUPER MÁS')
  console.log('====================================================================')
  console.log('🔒 REGLAS ACTIVAS:')
  console.log('   - CERO usuarios creados por seed (Autenticación exclusiva vía Supabase Auth)')
  console.log('   - CERO empresas creadas por seed (Configuración en UI por el usuario)')
  console.log('   - CERO datos comerciales (0 productos, 0 bodegas, 0 clientes, 0 stock)')

  try {
    // 1. Tarifas e Impuestos DIAN
    console.log('\n[1/4] Configurando estructura tributaria DIAN (tax_configs)...')
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

    // 2. Estructura PUC Base (Plan Único de Cuentas)
    console.log('\n[2/4] Configurando estructura de cuentas contables PUC...')
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

    // 3. Período Contable Inicial
    console.log('\n[3/4] Configurando período fiscal inicial (accounting_periods)...')
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

    // 4. Parámetros Técnicos del Sistema
    console.log('\n[4/4] Configurando parámetros operativos y reglas del ERP (settings)...')
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
      else console.log(`   ✅ ${settingsList.length} parámetros técnicos registrados.`)
    }

    console.log('\n====================================================================')
    console.log('✅ CARGA DE PARÁMETROS REGULATORIOS COMPLETADA.')
    console.log('🔒 CERO CREDENCIALES, CERO EMPRESAS Y CERO DATOS COMERCIALES INSERTADOS.')
    console.log('👉 Siguiente paso: Registrar el primer administrador vía Supabase Auth.')
    console.log('====================================================================')
  } catch (err: any) {
    console.error('❌ Error general durante la inicialización:', err.message)
  }
}

seedCleanBootstrap()
