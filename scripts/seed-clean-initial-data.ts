/**
 * ==============================================================================
 * SCRIPT DE INICIALIZACIÓN BASE: PARÁMETROS TRIBUTARIOS Y CONTABLES
 * ERP SUPER MÁS S.A.S. — Supabase PostgreSQL
 * ==============================================================================
 *
 * Objetivo:
 * Cargar ÚNICAMENTE los catálogos regulatorios y estructurales en Supabase:
 * - Tarifas e impuestos oficiales DIAN (tax_rates)
 * - Plan Único de Cuentas PUC (accounting_accounts) con account_class e inserción jerárquica
 * - Parámetros técnicos del sistema (system_settings)
 *
 * REGLAS DE SEGURIDAD Y PUREZA:
 * 1. NO crea credenciales de usuario ni toca public.users (el primer usuario
 *    se crea mediante el script seguro de bootstrap o Supabase Auth Admin).
 * 2. NO crea empresas (se configura por el administrador desde la UI /configuracion).
 * 3. NO crea bodegas, ni productos, ni clientes, ni proveedores, ni inventario, ni ventas.
 * 4. NO inserta periodos contables (requieren company_id NOT NULL; se generan al crear la empresa).
 *
 * Ejecución:
 * npx tsx scripts/seed-clean-initial-data.ts
 */

import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'
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

/**
 * Genera un UUID v4 determinista a partir de un código PUC
 * para preservar relaciones parent_id válidas en PostgreSQL.
 */
function codeToDeterministicUuid(code: string): string {
  const hash = crypto.createHash('md5').update('supermas-puc-' + code).digest('hex')
  return [
    hash.substring(0, 8),
    hash.substring(8, 12),
    '4' + hash.substring(13, 16),
    '8' + hash.substring(17, 20),
    hash.substring(20, 32),
  ].join('-')
}

async function seedCleanBootstrap() {
  console.log('====================================================================')
  console.log('🚀 INICIALIZACIÓN BASE REGULATORIA — ERP SUPER MÁS')
  console.log('====================================================================')
  console.log('🔒 REGLAS ACTIVAS:')
  console.log('   - CERO usuarios creados por seed (Autenticación exclusiva vía Supabase Auth/Admin)')
  console.log('   - CERO empresas creadas por seed (Configuración en UI por el usuario)')
  console.log('   - CERO datos comerciales (0 productos, 0 bodegas, 0 clientes, 0 stock)')
  console.log('   - CERO periodos contables en seed (Se generan al crear la primera empresa)')

  try {
    // 1. Tarifas e Impuestos DIAN (public.tax_rates)
    console.log('\n[1/3] Configurando estructura tributaria DIAN (public.tax_rates)...')
    const taxList = readJson('tax_configs.json')
    if (Array.isArray(taxList) && taxList.length > 0) {
      const formattedTaxes = taxList.map((t: any) => ({
        code: t.code,
        name: t.name,
        percentage: Number(t.ratePercent ?? t.rate ?? 19),
        type: t.type ?? t.taxType ?? 'IVA',
        is_active: t.status === 'ACTIVE' || t.isActive === true,
      }))

      const { error: taxErr } = await supabase
        .from('tax_rates')
        .upsert(formattedTaxes, { onConflict: 'code' })

      if (taxErr) {
        console.warn('   ⚠️ Error en tax_rates:', taxErr.message)
      } else {
        console.log(`   ✅ ${formattedTaxes.length} configuraciones impositivas DIAN creadas en tax_rates.`)
      }
    }

    // 2. Estructura PUC Base (public.accounting_accounts) con jerarquía garantizada
    console.log('\n[2/3] Configurando estructura de cuentas contables PUC (public.accounting_accounts)...')
    const rawPucs = readJson('accounting_accounts.json')
    if (Array.isArray(rawPucs) && rawPucs.length > 0) {
      // 2.1 Calcular nivel y clase obligatoria (1: Activo, 2: Pasivo, etc.)
      const parsedPucs = rawPucs.map((a: any) => {
        const cleanCode = String(a.code).trim()
        const level =
          typeof a.level === 'number'
            ? a.level
            : cleanCode.length === 1
            ? 1
            : cleanCode.length === 2
            ? 2
            : cleanCode.length === 4
            ? 3
            : cleanCode.length === 6
            ? 4
            : 5

        const accountClass = parseInt(cleanCode[0], 10) || 1
        const id = codeToDeterministicUuid(cleanCode)

        // Calcular parent_id determinista según código padre
        let parentId: string | null = null
        if (cleanCode.length === 2) parentId = codeToDeterministicUuid(cleanCode.substring(0, 1))
        else if (cleanCode.length === 4) parentId = codeToDeterministicUuid(cleanCode.substring(0, 2))
        else if (cleanCode.length === 6) parentId = codeToDeterministicUuid(cleanCode.substring(0, 4))
        else if (cleanCode.length > 6) parentId = codeToDeterministicUuid(cleanCode.substring(0, 6))

        return {
          id,
          code: cleanCode,
          name: a.name,
          account_class: accountClass,
          level,
          parent_id: parentId,
          nature: a.nature === 'CREDIT' ? 'CREDIT' : 'DEBIT',
          requires_third_party: a.requiresThirdParty ?? false,
          requires_cost_center: a.requiresCostCenter ?? false,
          is_active: a.isActive ?? a.status === 'ACTIVE' ?? true,
        }
      })

      // 2.2 Ordenar estrictamente por level ASC para que clases y grupos se inserten antes que subcuentas
      parsedPucs.sort((a, b) => a.level - b.level)

      // 2.3 Inserción por lotes para respetar foreign keys autoreferenciales
      const levels = [1, 2, 3, 4, 5]
      let totalInserted = 0

      for (const lvl of levels) {
        const batch = parsedPucs.filter((p) => p.level === lvl)
        if (batch.length === 0) continue

        const { error: pucErr } = await supabase
          .from('accounting_accounts')
          .upsert(batch, { onConflict: 'code' })

        if (pucErr) {
          console.warn(`   ⚠️ Error en accounting_accounts (Nivel ${lvl}):`, pucErr.message)
        } else {
          totalInserted += batch.length
        }
      }

      console.log(`   ✅ ${totalInserted} cuentas PUC insertadas jerárquicamente con account_class.`)
    }

    // 3. Parámetros Técnicos del Sistema (public.system_settings)
    console.log('\n[3/3] Configurando parámetros operativos del ERP (public.system_settings)...')
    const settingsList = readJson('settings.json')
    if (Array.isArray(settingsList) && settingsList.length > 0) {
      const formattedSettings = settingsList.map((s: any) => ({
        key: s.key,
        category: s.category || 'GENERAL',
        value: s.value,
        type: s.type || 'STRING',
        description: s.description || null,
        is_critical: s.isCritical ?? false,
        requires_audit: s.requiresAudit ?? true,
        updated_at: new Date().toISOString(),
      }))

      const { error: settErr } = await supabase
        .from('system_settings')
        .upsert(formattedSettings, { onConflict: 'key' })

      if (settErr) {
        console.warn('   ⚠️ Error en system_settings:', settErr.message)
      } else {
        console.log(`   ✅ ${formattedSettings.length} parámetros técnicos registrados en system_settings.`)
      }
    }

    console.log('\n====================================================================')
    console.log('✅ CARGA DE PARÁMETROS REGULATORIOS COMPLETADA SATISFACTORIAMENTE.')
    console.log('🔒 CERO CREDENCIALES, CERO EMPRESAS Y CERO DATOS COMERCIALES INSERTADOS.')
    console.log('👉 Siguiente paso: Crear el primer administrador mediante bootstrap seguro.')
    console.log('====================================================================')
  } catch (err: any) {
    console.error('❌ Error general durante la inicialización:', err.message)
  }
}

seedCleanBootstrap()
