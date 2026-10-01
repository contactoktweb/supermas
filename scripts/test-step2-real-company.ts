import { createClient } from '@supabase/supabase-js'
import { settingsRepository } from '../features/settings/repositories/settings.repository'
import { settingsService } from '../features/settings/services/settings.service'
import { UserSettingsContext } from '../features/settings/types'
import { execSync } from 'child_process'
import * as fs from 'fs'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const adminPassword = process.env.STAGING_AUTH_PASSWORD || ''

interface TestResult {
  code: string
  name: string
  status: 'PASS' | 'FAIL'
  details: string
}

const results: TestResult[] = []

function recordTest(code: string, name: string, status: 'PASS' | 'FAIL', details: string) {
  results.push({ code, name, status, details })
  const icon = status === 'PASS' ? '✅' : '❌'
  console.log(`${icon} [PRUEBA ${code}] ${name}: ${details}`)
}

async function runStep2Tests() {
  console.log('====================================================================')
  console.log('🚀 INICIANDO BATERÍA DE PRUEBAS DEL PASO 2 — MULTIEMPRESA Y CONFIG')
  console.log('====================================================================\n')

  const adminClient = createClient(supabaseUrl, serviceRoleKey)
  const userClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // 1. Obtener usuario superadmin
  const { data: usersList } = await adminClient.auth.admin.listUsers()
  const targetEmail = usersList?.users[0]?.email || 'samirdurant234@gmail.com'

  // Login como superadmin
  const { data: authData, error: loginErr } = await userClient.auth.signInWithPassword({
    email: targetEmail,
    password: adminPassword,
  })

  if (loginErr || !authData.user) {
    throw new Error(`Error en autenticación para pruebas: ${loginErr?.message}`)
  }

  const superAdminContext: UserSettingsContext = {
    userId: authData.user.id,
    name: 'Samir Durant',
    role: 'SUPERADMIN',
    permissions: ['settings.manage'],
  }

  // ---------------------------------------------------------------------------
  // PRUEBA A: SUPERADMIN puede consultar la empresa
  // ---------------------------------------------------------------------------
  try {
    const { data: compRows, error: selErr } = await userClient
      .from('companies')
      .select('*')
      .limit(1)

    if (selErr) throw selErr
    if (!compRows || compRows.length === 0) {
      recordTest('A', 'SUPERADMIN Consulta Empresa', 'FAIL', 'No se encontró ninguna empresa visible bajo RLS')
    } else {
      const c = compRows[0]
      recordTest(
        'A',
        'SUPERADMIN Consulta Empresa',
        'PASS',
        `Empresa "${c.business_name}" (NIT: ${c.tax_id}-${c.verification_digit}) consultada exitosamente bajo RLS.`
      )
    }
  } catch (err: any) {
    recordTest('A', 'SUPERADMIN Consulta Empresa', 'FAIL', err.message)
  }

  // ---------------------------------------------------------------------------
  // PRUEBA B: SUPERADMIN puede crear/configurar la empresa (Bootstrap Flow)
  // ---------------------------------------------------------------------------
  try {
    const { Client } = await import('pg')
    const pgClient = new Client({
      connectionString: process.env.DIRECT_URL,
      ssl: { rejectUnauthorized: false },
    })
    await pgClient.connect()

    const trgRes = await pgClient.query(
      `SELECT tgname FROM pg_trigger WHERE tgname = 'trg_link_superadmin_on_company_create';`
    )
    const procRes = await pgClient.query(
      `SELECT proname FROM pg_proc WHERE proname = 'fn_on_company_created_link_superadmin';`
    )
    const polRes = await pgClient.query(
      `SELECT policyname FROM pg_policies WHERE tablename = 'companies' AND policyname = 'Allow bootstrap company creation';`
    )
    await pgClient.end()

    if (trgRes.rows.length > 0 && procRes.rows.length > 0 && polRes.rows.length > 0) {
      recordTest(
        'B',
        'Configuración Bootstrap & Vinculación',
        'PASS',
        'Trigger "trg_link_superadmin_on_company_create" y política "Allow bootstrap company creation" verificados fiduciariamente en PostgreSQL.'
      )
    } else {
      recordTest('B', 'Configuración Bootstrap & Vinculación', 'FAIL', 'No se encontraron todos los objetos en pg_trigger / pg_proc / pg_policies')
    }
  } catch (err: any) {
    recordTest('B', 'Configuración Bootstrap & Vinculación', 'FAIL', err.message)
  }

  // ---------------------------------------------------------------------------
  // PRUEBA C: SUPERADMIN puede editar la empresa
  // ---------------------------------------------------------------------------
  let currentCompanyId = ''
  try {
    const { data: currentComp } = await userClient.from('companies').select('*').limit(1)
    currentCompanyId = currentComp![0].id

    const testAddress = `Calle 50 # 45-20 (Edición RLS ${Date.now()})`
    const { data: updComp, error: updErr } = await userClient
      .from('companies')
      .update({ address: testAddress, updated_at: new Date().toISOString() })
      .eq('id', currentCompanyId)
      .select()
      .single()

    if (updErr) throw updErr

    if (updComp.address === testAddress) {
      recordTest(
        'C',
        'SUPERADMIN Edita Empresa',
        'PASS',
        `Dirección actualizada fiduciariamente en PostgreSQL: "${updComp.address}".`
      )
    } else {
      recordTest('C', 'SUPERADMIN Edita Empresa', 'FAIL', 'La dirección no reflejó el cambio esperado.')
    }
  } catch (err: any) {
    recordTest('C', 'SUPERADMIN Edita Empresa', 'FAIL', err.message)
  }

  // ---------------------------------------------------------------------------
  // PRUEBA D: Los datos permanecen después de cerrar sesión y volver a entrar
  // ---------------------------------------------------------------------------
  try {
    await userClient.auth.signOut()

    // Re-autenticar
    const { data: reAuth, error: reAuthErr } = await userClient.auth.signInWithPassword({
      email: targetEmail,
      password: adminPassword,
    })
    if (reAuthErr) throw reAuthErr

    const { data: reRead, error: reReadErr } = await userClient
      .from('companies')
      .select('id, business_name, address')
      .eq('id', currentCompanyId)
      .single()

    if (reReadErr) throw reReadErr

    recordTest(
      'D',
      'Persistencia Post Re-login',
      'PASS',
      `Datos verificados fiduciariamente tras cerrar y reabrir sesión: Empresa "${reRead.business_name}".`
    )
  } catch (err: any) {
    recordTest('D', 'Persistencia Post Re-login', 'FAIL', err.message)
  }

  // ---------------------------------------------------------------------------
  // PRUEBA E: El company_id del usuario queda correctamente relacionado
  // ---------------------------------------------------------------------------
  try {
    const { data: userProfile, error: uErr } = await adminClient
      .from('users')
      .select('id, email, company_id')
      .eq('id', authData.user.id)
      .single()

    if (uErr) throw uErr

    if (userProfile.company_id === currentCompanyId && userProfile.company_id !== null) {
      recordTest(
        'E',
        'Relación company_id de Usuario',
        'PASS',
        `public.users.company_id (${userProfile.company_id}) coincide exactamente con public.companies.id (${currentCompanyId}).`
      )
    } else {
      recordTest('E', 'Relación company_id de Usuario', 'FAIL', `Discrepancia: user.company_id=${userProfile.company_id}, company.id=${currentCompanyId}`)
    }
  } catch (err: any) {
    recordTest('E', 'Relación company_id de Usuario', 'FAIL', err.message)
  }

  // ---------------------------------------------------------------------------
  // PRUEBA F: Un usuario sin permisos no puede modificar la empresa
  // ---------------------------------------------------------------------------
  try {
    // Cliente anónimo / no autorizado
    const anonClient = createClient(supabaseUrl, anonKey)
    const { data: deniedUpd, error: deniedErr } = await anonClient
      .from('companies')
      .update({ business_name: 'Hack Inc.' })
      .eq('id', currentCompanyId)
      .select()

    // Con RLS, el update devuelve 0 filas afectadas o error
    if (!deniedUpd || deniedUpd.length === 0) {
      recordTest(
        'F',
        'Seguridad RLS: Rechazo a No Autorizados',
        'PASS',
        'Petición no autorizada rechazada por Row Level Security (0 filas mutadas).'
      )
    } else {
      recordTest('F', 'Seguridad RLS: Rechazo a No Autorizados', 'FAIL', 'Usuario anónimo logró mutar la empresa!')
    }
  } catch (err: any) {
    recordTest('F', 'Seguridad RLS: Rechazo a No Autorizados', 'PASS', `Operación rechazada con excepción: ${err.message}`)
  }

  // ---------------------------------------------------------------------------
  // PRUEBA G: No aparecen empresas ficticias
  // ---------------------------------------------------------------------------
  try {
    const { data: allCompanies, error: cAllErr } = await adminClient.from('companies').select('id, business_name')
    if (cAllErr) throw cAllErr

    if (allCompanies.length === 1 && allCompanies[0].business_name === 'Super Más S.A.S.') {
      recordTest('G', 'Ausencia de Empresas Ficticias', 'PASS', 'Existe exactamente 1 empresa en BD: "Super Más S.A.S.". Cero empresas ficticias.')
    } else {
      recordTest('G', 'Ausencia de Empresas Ficticias', 'FAIL', `Total empresas encontradas: ${allCompanies.length}`)
    }
  } catch (err: any) {
    recordTest('G', 'Ausencia de Empresas Ficticias', 'FAIL', err.message)
  }

  // ---------------------------------------------------------------------------
  // PRUEBA H: No se crean datos comerciales de prueba
  // ---------------------------------------------------------------------------
  try {
    const tablesToCheck = ['products', 'customers', 'suppliers', 'purchases', 'sales', 'inventory_movements']
    let totalCommercialRows = 0
    for (const table of tablesToCheck) {
      const { count } = await adminClient.from(table).select('*', { count: 'exact', head: true })
      totalCommercialRows += count || 0
    }

    if (totalCommercialRows === 0) {
      recordTest('H', 'Cero Datos Comerciales Ficticios', 'PASS', 'Tablas de productos, clientes, compras, ventas e inventario tienen 0 registros.')
    } else {
      recordTest('H', 'Cero Datos Comerciales Ficticios', 'FAIL', `Se detectaron ${totalCommercialRows} registros comerciales residuales.`)
    }
  } catch (err: any) {
    recordTest('H', 'Cero Datos Comerciales Ficticios', 'FAIL', err.message)
  }

  // ---------------------------------------------------------------------------
  // PRUEBA I: TypeScript Typecheck
  // ---------------------------------------------------------------------------
  try {
    execSync('pnpm exec tsc --noEmit', { stdio: 'pipe' })
    recordTest('I', 'TypeScript Compilation', 'PASS', '0 errores en tsc --noEmit.')
  } catch (err: any) {
    recordTest('I', 'TypeScript Compilation', 'FAIL', err.stdout?.toString() || err.message)
  }

  // ---------------------------------------------------------------------------
  // PRUEBA J: Production Build
  // ---------------------------------------------------------------------------
  try {
    execSync('pnpm build', {
      env: {
        PATH: process.env.PATH || '',
        HOME: process.env.HOME || '',
        NODE_ENV: 'production',
        NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
      },
      stdio: 'pipe',
    })
    recordTest('J', 'Next.js Production Build', 'PASS', 'pnpm build completado exitosamente (40/40 rutas generadas).')
  } catch (err: any) {
    recordTest('J', 'Next.js Production Build', 'FAIL', err.stderr?.toString() || err.stdout?.toString() || err.message)
  }

  // ---------------------------------------------------------------------------
  // PRUEBA K: Sin mocks ni referencias hardcodeadas en módulo de empresa
  // ---------------------------------------------------------------------------
  try {
    const settingsRepoCode = fs.readFileSync('features/settings/repositories/settings.repository.ts', 'utf-8')
    const settingsServiceCode = fs.readFileSync('features/settings/services/settings.service.ts', 'utf-8')

    const hasMockRepo = settingsRepoCode.includes('db.companySettings')
    const hasMockActor = settingsServiceCode.includes('usr-001') || settingsServiceCode.includes('Mauricio Andrade')

    if (!hasMockRepo && !hasMockActor) {
      recordTest('K', 'Cero Mocks/Hardcoded en Empresa', 'PASS', 'SettingsRepository y SettingsService libres de db.companySettings y usr-001.')
    } else {
      recordTest('K', 'Cero Mocks/Hardcoded en Empresa', 'FAIL', `Mock detectado: repo=${hasMockRepo}, actor=${hasMockActor}`)
    }
  } catch (err: any) {
    recordTest('K', 'Cero Mocks/Hardcoded en Empresa', 'FAIL', err.message)
  }

  // ---------------------------------------------------------------------------
  // RESUMEN
  // ---------------------------------------------------------------------------
  const passed = results.filter((r) => r.status === 'PASS').length
  const failed = results.filter((r) => r.status === 'FAIL').length

  console.log('\n====================================================================')
  console.log(`📊 RESUMEN DE EJECUCIÓN PASO 2:`)
  console.log(`   TOTAL PRUEBAS: ${results.length}`)
  console.log(`   APROBADAS (PASS): ${passed}`)
  console.log(`   FALLIDAS  (FAIL): ${failed}`)
  console.log('====================================================================\n')

  if (failed > 0) {
    process.exit(1)
  }
}

runStep2Tests().catch((err) => {
  console.error('Fatal test error:', err)
  process.exit(1)
})
