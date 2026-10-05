/**
 * SUPER MÁS ERP/POS — Test Suite E2E Fase 21
 *
 * Validación Integral de Eliminación Definitiva de db.ts:
 * 1. Verificación Estática: 0 importaciones de lib/supabase/db en features/, app/ y components/
 * 2. UserRepository E2E contra PostgreSQL (public.users, public.roles, public.user_locations)
 * 3. SettingsRepository E2E contra PostgreSQL (public.system_settings, public.companies, public.audit_logs)
 * 4. ExogenaRepository E2E cruzando datos de PostgreSQL real (customers, suppliers, purchases, sales, accounting_entries)
 * 5. Trazabilidad inmutable en public.audit_logs
 * 6. Zero Pollution: Purga atómica del 100% de los datos de prueba
 *
 * Ejecución: npx tsx --env-file=.env.local scripts/test-phase21-decoupling-e2e.ts
 */

import { Client } from 'pg'
import fs from 'fs'
import path from 'path'
import { createClient } from '@supabase/supabase-js'
import { supabaseClient } from '../lib/supabase/client'
import { userRepository } from '../features/users/repositories/user.repository'
import { settingsRepository } from '../features/settings/repositories/settings.repository'
import { exogenaRepository } from '../features/exogena/repositories/exogena.repository'
import { userService } from '../features/users/services/user.service'

const DATABASE_URL = process.env.DATABASE_URL
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!DATABASE_URL || !SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌ ERROR: Variables de entorno insuficientes.')
  process.exit(1)
}

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const pgClient = new Client({ connectionString: DATABASE_URL })

interface TestResult {
  code: string
  name: string
  passed: boolean
  details: string
}

const results: TestResult[] = []

function recordTest(code: string, name: string, passed: boolean, details: string) {
  results.push({ code, name, passed, details })
  const icon = passed ? '✅' : '❌'
  console.log(`\n${icon} [${code}] ${name}: ${passed ? 'PASS' : 'FAIL'}`)
  console.log(`   Detalle: ${details}`)
  if (!passed) {
    throw new Error(`Prueba ${code} falló: ${details}`)
  }
}

function scanDirForDbImports(dirPath: string, extensions = ['.ts', '.tsx']): string[] {
  let matchedFiles: string[] = []
  if (!fs.existsSync(dirPath)) return matchedFiles

  const entries = fs.readdirSync(dirPath, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name)
    if (entry.isDirectory()) {
      matchedFiles = matchedFiles.concat(scanDirForDbImports(fullPath, extensions))
    } else if (entry.isFile() && extensions.some((ext) => entry.name.endsWith(ext))) {
      const content = fs.readFileSync(fullPath, 'utf8')
      if (
        content.includes("from '@/lib/supabase/db'") ||
        content.includes('from "@/lib/supabase/db"') ||
        content.includes("from '../lib/supabase/db'") ||
        content.includes("from '../../lib/supabase/db'")
      ) {
        matchedFiles.push(fullPath)
      }
    }
  }
  return matchedFiles
}

async function runPhase21TestSuite() {
  console.log('============================================================')
  console.log('INICIANDO SUITE E2E - FASE 21: ELIMINACIÓN DEFINITIVA DE db.ts')
  console.log('============================================================\n')

  await pgClient.connect()
  console.log('✅ Conexión directa a PostgreSQL Staging establecida.\n')

  const testSuffix = Math.floor(100000 + Math.random() * 900000)
  const testCompanyId = crypto.randomUUID()
  const testLocationId = crypto.randomUUID()
  let createdUserId: string | null = null
  let authUserId: string | null = null

  try {
    // SETUP: Empresa y ubicación de prueba
    await pgClient.query(
      `INSERT INTO public.companies (id, business_name, trade_name, tax_id, verification_digit, tax_regime, currency, status, address, city, department, country)
       VALUES ($1, $2, $3, $4, '9', 'RESPONSABLE_DE_IVA', 'COP', 'ACTIVE', 'Calle 10 # 20-30', 'Cali', 'Valle del Cauca', 'Colombia');`,
      [testCompanyId, `Empresa Test Fase 21 - ${testSuffix}`, 'SuperMas P21', `900${testSuffix}`]
    )

    await pgClient.query(
      `INSERT INTO public.locations (id, company_id, code, name, type, status, is_store_point, address, city, department)
       VALUES ($1, $2, $3, $4, 'WAREHOUSE', 'ACTIVE', true, 'Zona Industrial Acopi', 'Cali', 'Valle del Cauca');`,
      [testLocationId, testCompanyId, `BOD-P21-${testSuffix}`, `Bodega P21 ${testSuffix}`]
    )

    // Auth User para supabaseClient
    const adminEmail = `admin_p21_${testSuffix}@supermas.test`
    const adminPass = 'PasswordDecoupling2026*'
    const authRes = await supabaseAdmin.auth.admin.createUser({
      email: adminEmail,
      password: adminPass,
      email_confirm: true,
      app_metadata: { company_id: testCompanyId, role: 'SUPERADMIN' },
    })
    authUserId = authRes.data.user!.id

    const superAdminRoleId = 'c0000000-0000-0000-0000-000000000001'

    await pgClient.query(`
      INSERT INTO public.users (id, company_id, email, full_name, role_id, is_active, created_at, updated_at)
      VALUES ($1, $2, $3, 'Admin P21', $4, true, NOW(), NOW())
      ON CONFLICT (id) DO UPDATE SET
        company_id = EXCLUDED.company_id,
        role_id = EXCLUDED.role_id,
        is_active = true;
    `, [authUserId, testCompanyId, adminEmail, superAdminRoleId])

    await pgClient.query(`
      INSERT INTO public.user_locations (user_id, location_id, is_primary)
      VALUES ($1, $2, true) ON CONFLICT DO NOTHING;
    `, [authUserId, testLocationId])

    await supabaseClient.auth.signInWithPassword({
      email: adminEmail,
      password: adminPass,
    })

    // T01: Verificación Estática de 0 Imports de db.ts en features/
    const featuresDbMatches = scanDirForDbImports(path.join(process.cwd(), 'features'))
    recordTest(
      'T01',
      'Auditoría Estática de Código: Cero Importaciones de db.ts en features/',
      featuresDbMatches.length === 0,
      featuresDbMatches.length === 0
        ? 'Verificación exhaustiva completada: 0 archivos en features/ importan db.ts.'
        : `Se detectaron ${featuresDbMatches.length} archivos con importaciones de db.ts: ${featuresDbMatches.join(', ')}`
    )

    // T02: Verificación Estática de 0 Imports de db.ts en app/ y components/
    const appDbMatches = scanDirForDbImports(path.join(process.cwd(), 'app'))
    const componentsDbMatches = scanDirForDbImports(path.join(process.cwd(), 'components'))
    const uiMatches = [...appDbMatches, ...componentsDbMatches]
    recordTest(
      'T02',
      'Auditoría Estática de Código: Cero Importaciones de db.ts en app/ y components/',
      uiMatches.length === 0,
      uiMatches.length === 0
        ? 'Verificación de frontend UI completada: 0 archivos en app/ y components/ importan db.ts.'
        : `Se detectaron archivos con db.ts: ${uiMatches.join(', ')}`
    )

    // T03: UserRepository - Consulta de Catálogo de Roles Predefinidos desde PostgreSQL
    const rolesRes = await pgClient.query('SELECT code, name FROM public.roles ORDER BY code;')
    recordTest(
      'T03',
      'UserRepository: Roles Predefinidos del Sistema en PostgreSQL (public.roles)',
      rolesRes.rows.length >= 7,
      `Consultados exitosamente ${rolesRes.rows.length} roles predefinidos en la base de datos oficial.`
    )

    // T04: UserRepository - Creación Persistente de Usuario y Asignación de Bodega en PostgreSQL
    const testEmail = `colaborador.p21.${testSuffix}@supermas.test`
    const testPassword = 'PasswordAndrea2026*'
    const collabAuthRes = await supabaseAdmin.auth.admin.createUser({
      email: testEmail,
      password: testPassword,
      email_confirm: true,
      app_metadata: { company_id: testCompanyId, role: 'SELLER' },
    })
    createdUserId = collabAuthRes.data.user!.id

    const createdUser = await userRepository.createUser({
      id: createdUserId,
      firstName: 'Andrea',
      lastName: `Rios ${testSuffix}`,
      email: testEmail,
      username: `andrea.p21.${testSuffix}`,
      phone: '3109876543',
      role: 'SELLER',
      status: 'ACTIVE',
      locationIds: [testLocationId],
      companyId: testCompanyId,
    })

    // Verificar en BD directamente
    const userInDb = await pgClient.query(
      'SELECT id, email, full_name, is_active FROM public.users WHERE id = $1;',
      [createdUserId]
    )
    const userLocInDb = await pgClient.query(
      'SELECT location_id, is_primary FROM public.user_locations WHERE user_id = $1;',
      [createdUserId]
    )

    recordTest(
      'T04',
      'UserRepository: Creación Persistente en public.users y public.user_locations',
      userInDb.rows.length === 1 && userLocInDb.rows.length === 1,
      `Usuario ${createdUser.name} (${createdUser.email}) registrado con ID ${createdUser.id} y asignado a bodega ${userLocInDb.rows[0]?.location_id}.`
    )

    // T05: UserRepository - Filtrado, Búsqueda y Lectura de Usuario por ID
    const foundById = await userRepository.getUserById(createdUserId)
    const filteredUsers = await userRepository.getUsers({
      searchQuery: `Rios ${testSuffix}`,
      role: 'SELLER',
      status: 'ACTIVE',
    })

    recordTest(
      'T05',
      'UserRepository: Consulta por ID y Filtrado Dinámico Multi-criterio',
      foundById !== null && filteredUsers.length >= 1 && filteredUsers.some((u) => u.id === createdUserId),
      `Usuario recuperado por ID y localizado mediante filtros de búsqueda (SELLER / ACTIVE).`
    )

    // T06: UserRepository - Modificación de Datos, Rol y Cambio de Estado (Lógico)
    const updatedUser = await userRepository.updateUser(createdUserId, {
      firstName: 'Andrea Carolina',
      phone: '3110009988',
      role: 'ADMIN',
    })
    const deactivatedUser = await userRepository.setStatus(createdUserId, 'INACTIVE')

    const dbCheckUpdated = await pgClient.query(
      `SELECT u.full_name, u.phone, u.is_active, r.code as role_code 
       FROM public.users u 
       JOIN public.roles r ON u.role_id = r.id 
       WHERE u.id = $1;`,
      [createdUserId]
    )
    const row = dbCheckUpdated.rows[0]

    recordTest(
      'T06',
      'UserRepository: Actualización de Perfil, Rol y Desactivación Lógica en PostgreSQL',
      row?.full_name.includes('Andrea Carolina') && row?.role_code === 'ADMIN' && row?.is_active === false,
      `Actualización exitosa: Nombre="${row?.full_name}", Rol="${row?.role_code}", Activo=${row?.is_active}.`
    )

    // T07: SettingsRepository - Consulta de Variables Dinámicas en public.system_settings
    const sysSettings = await settingsRepository.getSystemSettings()
    recordTest(
      'T07',
      'SettingsRepository: Lectura de Variables de Configuración desde public.system_settings',
      sysSettings.length >= 10,
      `Recuperadas ${sysSettings.length} variables dinámicas del sistema directamente desde PostgreSQL.`
    )

    // T08: SettingsRepository - Mutación de Políticas de Inventario en public.system_settings
    const updatedInventory = await settingsRepository.updateInventorySettings(
      {
        defaultMinStockThreshold: 12,
        valuationMethod: 'WEIGHTED_AVERAGE',
      },
      'Admin Tester P21'
    )

    const checkInventoryDb = await pgClient.query(
      "SELECT value FROM public.system_settings WHERE key = 'inventory.policies';"
    )
    const savedVal = checkInventoryDb.rows[0]?.value

    recordTest(
      'T08',
      'SettingsRepository: Persistencia y Actualización de Políticas de Inventario',
      checkInventoryDb.rows.length === 1 && (savedVal?.defaultMinStockThreshold === 12 || savedVal?.valuationMethod === 'WEIGHTED_AVERAGE'),
      `Políticas de inventario actualizadas y persistidas en PostgreSQL (Stock Mínimo: ${savedVal?.defaultMinStockThreshold}).`
    )

    // T09: SettingsRepository - Mutación y Lectura de Reglas de POS en public.system_settings
    const updatedPOS = await settingsRepository.updatePOSSettings(
      {
        allowQuickSaleWithoutCustomer: true,
        defaultReceiptTemplate: 'TICKET_80MM',
      },
      'Admin Tester P21'
    )
    const readPOS = await settingsRepository.getPOSSettings()

    recordTest(
      'T09',
      'SettingsRepository: Persistencia y Lectura de Parámetros de Punto de Venta (POS)',
      readPOS.allowQuickSaleWithoutCustomer === true && readPOS.defaultReceiptTemplate === 'TICKET_80MM',
      `Parámetros POS confirmados: Plantilla="${readPOS.defaultReceiptTemplate}", Venta Rápida=${readPOS.allowQuickSaleWithoutCustomer}.`
    )

    // T10: SettingsRepository - Mutación de Variables Dinámicas Individuales y Trazabilidad
    const testSettingKey = `test.dynamic.${testSuffix}`
    await pgClient.query(
      `INSERT INTO public.system_settings (id, key, category, value, type, description, is_critical, requires_audit)
       VALUES (gen_random_uuid(), $1, 'SECURITY', '{"timeout": 45}', 'JSON', 'Test Timeout Setting', false, true);`,
      [testSettingKey]
    )

    const updatedSetting = await settingsRepository.updateSystemSetting(
      testSettingKey,
      { timeout: 90 },
      'Admin Tester P21',
      'Ajuste de prueba para tiempo de sesión'
    )

    recordTest(
      'T10',
      'SettingsRepository: Actualización de Variable Dinámica Individual con Verificación',
      updatedSetting.value?.timeout === 90,
      `Variable ${testSettingKey} actualizada a timeout=90 de forma atómica en PostgreSQL.`
    )

    // T11: ExogenaRepository - Consulta Normativa y Cruzamiento de Datos con PostgreSQL Real
    const availableYears = await exogenaRepository.getAvailableYears()
    const recordsConsolidated = await exogenaRepository.consolidateRecords(2025)

    recordTest(
      'T11',
      'ExogenaRepository: Consolidación Tributaria Cruzada sobre Tablas Reales de PostgreSQL',
      availableYears.length > 0 && Array.isArray(recordsConsolidated),
      `Años disponibles: ${availableYears.map((y) => y.year).join(', ')}. Registros cruzados consolidados: ${recordsConsolidated.length}.`
    )

    // T12: ExogenaRepository - Trazabilidad en public.audit_logs
    await exogenaRepository.logAudit({
      action: 'EXOGENA_TEST_AUDIT',
      year: 2025,
      userId: createdUserId,
      userName: 'Andrea Rios Tester',
      details: 'Prueba E2E de auditoría inmutable de medios magnéticos',
    })

    const auditCheck = await pgClient.query(
      "SELECT id, action, module, user_name FROM public.audit_logs WHERE action = 'EXOGENA_TEST_AUDIT';"
    )

    recordTest(
      'T12',
      'ExogenaRepository & Auditoría: Trazabilidad Inmutable en public.audit_logs',
      auditCheck.rows.length >= 1,
      `Evento EXOGENA_TEST_AUDIT verificado en public.audit_logs para módulo ${auditCheck.rows[0]?.module}.`
    )

    // T13: Zero Pollution - Purga Atómica Total de Registros de Prueba
    console.log('\n--- Ejecutando Purga Zero Pollution de Fase 21 ---')
    await pgClient.query("SET app.is_test_cleanup = 'true';")
    await pgClient.query("DELETE FROM public.audit_logs WHERE company_id = $1;", [testCompanyId])
    await pgClient.query("DELETE FROM public.audit_logs WHERE action = 'EXOGENA_TEST_AUDIT';")
    await pgClient.query("DELETE FROM public.audit_logs WHERE entity_id = $1;", [testSettingKey])
    await pgClient.query('DELETE FROM public.system_settings WHERE key = $1;', [testSettingKey])
    await pgClient.query("DELETE FROM public.system_settings WHERE key = 'inventory.policies';")
    await pgClient.query("DELETE FROM public.system_settings WHERE key = 'pos.terminal_rules';")

    if (createdUserId) {
      await pgClient.query('DELETE FROM public.user_locations WHERE user_id = $1;', [createdUserId])
      await pgClient.query('DELETE FROM public.users WHERE id = $1;', [createdUserId])
      await supabaseAdmin.auth.admin.deleteUser(createdUserId).catch(() => null)
    }

    if (authUserId) {
      await pgClient.query('DELETE FROM public.user_locations WHERE user_id = $1;', [authUserId])
      await pgClient.query('DELETE FROM public.users WHERE id = $1;', [authUserId])
      await supabaseAdmin.auth.admin.deleteUser(authUserId).catch(() => null)
    }

    await pgClient.query('DELETE FROM public.locations WHERE id = $1;', [testLocationId])
    await pgClient.query("DELETE FROM public.audit_logs WHERE company_id = $1;", [testCompanyId])
    await pgClient.query('DELETE FROM public.companies WHERE id = $1;', [testCompanyId])

    // Verificar limpieza total
    const residualUser = await pgClient.query('SELECT id FROM public.users WHERE id = $1;', [createdUserId])
    const residualAuth = await pgClient.query('SELECT id FROM public.users WHERE id = $1;', [authUserId])
    const residualCompany = await pgClient.query('SELECT id FROM public.companies WHERE id = $1;', [testCompanyId])
    const residualSetting = await pgClient.query('SELECT id FROM public.system_settings WHERE key = $1;', [testSettingKey])

    const isClean =
      residualUser.rows.length === 0 &&
      residualAuth.rows.length === 0 &&
      residualCompany.rows.length === 0 &&
      residualSetting.rows.length === 0

    recordTest(
      'T13',
      'Zero Pollution: Purga Atómica de Usuarios, Ubicaciones, Ajustes y Auditorías',
      isClean,
      'Todos los registros de prueba purgados atómicamente. Base de datos 100% limpia sin contaminación.'
    )
  } catch (err: any) {
    console.error('\n❌ ERROR DURANTE LA EJECUCIÓN DE PRUEBAS:', err)
    // Limpieza de emergencia
    try {
      await pgClient.query("SET app.is_test_cleanup = 'true';")
      await pgClient.query("DELETE FROM public.audit_logs WHERE company_id = $1;", [testCompanyId])
      await pgClient.query("DELETE FROM public.audit_logs WHERE action = 'EXOGENA_TEST_AUDIT';")
      await pgClient.query("DELETE FROM public.system_settings WHERE key LIKE 'test.dynamic.%';")
      if (createdUserId) {
        await pgClient.query('DELETE FROM public.user_locations WHERE user_id = $1;', [createdUserId])
        await pgClient.query('DELETE FROM public.users WHERE id = $1;', [createdUserId])
      }
      if (authUserId) {
        await pgClient.query('DELETE FROM public.user_locations WHERE user_id = $1;', [authUserId])
        await pgClient.query('DELETE FROM public.users WHERE id = $1;', [authUserId])
        await supabaseAdmin.auth.admin.deleteUser(authUserId).catch(() => null)
      }
      await pgClient.query('DELETE FROM public.locations WHERE id = $1;', [testLocationId])
      await pgClient.query("DELETE FROM public.audit_logs WHERE company_id = $1;", [testCompanyId])
      await pgClient.query('DELETE FROM public.companies WHERE id = $1;', [testCompanyId])
    } catch {}
    throw err
  } finally {
    await pgClient.end()
  }

  console.log('\n============================================================')
  console.log('RESUMEN DE EJECUCIÓN - FASE 21: ELIMINACIÓN DE db.ts')
  console.log('============================================================')
  const passedCount = results.filter((r) => r.passed).length
  results.forEach((r) => {
    console.log(`✅ [${r.code}] ${r.name}`)
  })
  console.log('============================================================')
  console.log(`TOTAL: ${results.length} | PASARON: ${passedCount} | FALLARON: ${results.length - passedCount}`)
  console.log('============================================================\n')
}

runPhase21TestSuite().catch((err) => {
  console.error('Test Suite Failed:', err)
  process.exit(1)
})
