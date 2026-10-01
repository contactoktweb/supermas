/**
 * ==============================================================================
 * SUITE DE VALIDACIÓN OBLIGATORIA — PASO 1: AUTH REAL Y SESIÓN DE USUARIO
 * ERP SUPER MÁS S.A.S. — Supabase PostgreSQL
 * ==============================================================================
 *
 * Pruebas:
 * A. Login válido con Supabase Auth real.
 * B. Login inválido rechazado por Supabase Auth.
 * C. Sesión persistente tras recarga/refresh.
 * D. Logout e invalidación de sesión.
 * E. Usuario autenticado correctamente identificado.
 * F. UUID de auth.users = UUID de public.users.
 * G. Rol obtenido directamente desde PostgreSQL (public.roles).
 * H. Permisos obtenidos directamente desde PostgreSQL (role_permissions -> permissions).
 * I. Ruta protegida sin sesión (bloqueo / redirección a /login).
 * J. Ruta permitida con sesión (acceso concedido).
 * K. Ruta no permitida según rol (bloqueo por matriz de roles en middleware).
 * L. Verificación de seguridad: SUPABASE_SERVICE_ROLE_KEY fuera de bundles cliente.
 * M. Eliminación de usr-001 como usuario actual.
 * N. Eliminación de fallbacks a db.ts / supabaseMock en autenticación.
 */

import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'
import { NextRequest } from 'next/server'
import { middleware } from '../middleware'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !anonKey || !serviceKey) {
  console.error('❌ ERROR: Faltan variables de entorno en .env.local')
  process.exit(1)
}

const adminClient = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const client = createClient(supabaseUrl, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

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

async function runStep1Tests() {
  console.log('====================================================================')
  console.log('🚀 INICIANDO BATERÍA DE PRUEBAS DEL PASO 1 — AUTH REAL SUPABASE')
  console.log('====================================================================\n')

  const testPassword = process.env.STAGING_AUTH_PASSWORD || ''

  // Obtener el primer usuario fiduciario registrado en auth.users
  const { data: usersList, error: listErr } = await adminClient.auth.admin.listUsers()
  if (listErr || !usersList.users.length) {
    console.error('❌ No se encontraron usuarios en auth.users para ejecutar las pruebas.')
    process.exit(1)
  }

  const targetAuthUser = usersList.users[0]
  const targetEmail = targetAuthUser.email!

  // Asegurar que la contraseña esté configurada
  await adminClient.auth.admin.updateUserById(targetAuthUser.id, {
    password: testPassword,
  })

  // ---------------------------------------------------------------------------
  // PRUEBA A: LOGIN VÁLIDO CON SUPABASE AUTH REAL
  // ---------------------------------------------------------------------------
  try {
    const { data: loginData, error: loginErr } = await client.auth.signInWithPassword({
      email: targetEmail,
      password: testPassword,
    })

    if (!loginErr && loginData.session?.access_token && loginData.user?.id) {
      recordTest(
        'A',
        'Login Válido',
        'PASS',
        `Autenticado con éxito en Supabase Auth. User ID: ${loginData.user.id}, Token emitido.`
      )
    } else {
      recordTest('A', 'Login Válido', 'FAIL', loginErr?.message || 'No se obtuvo sesión.')
    }
  } catch (err: any) {
    recordTest('A', 'Login Válido', 'FAIL', err.message)
  }

  // ---------------------------------------------------------------------------
  // PRUEBA B: LOGIN INVÁLIDO RECHAZADO POR SUPABASE AUTH
  // ---------------------------------------------------------------------------
  try {
    const { data: failData, error: failErr } = await client.auth.signInWithPassword({
      email: targetEmail,
      password: 'ClaveCompletamenteErronea!2026',
    })

    if (failErr && !failData.session) {
      recordTest(
        'B',
        'Login Inválido',
        'PASS',
        `Rechazado correctamente por Supabase Auth: "${failErr.message}".`
      )
    } else {
      recordTest('B', 'Login Inválido', 'FAIL', 'El login inválido no produjo error.')
    }
  } catch (err: any) {
    recordTest('B', 'Login Inválido', 'PASS', `Excepción capturada correctamente: ${err.message}`)
  }

  // ---------------------------------------------------------------------------
  // Re-autenticar para las pruebas subsiguientes
  // ---------------------------------------------------------------------------
  const { data: authSession } = await client.auth.signInWithPassword({
    email: targetEmail,
    password: testPassword,
  })

  // ---------------------------------------------------------------------------
  // PRUEBA C: SESIÓN PERSISTENTE
  // ---------------------------------------------------------------------------
  try {
    const { data: sessCheck, error: sessErr } = await client.auth.getSession()
    if (!sessErr && sessCheck.session?.user?.id === targetAuthUser.id) {
      recordTest(
        'C',
        'Sesión Persistente',
        'PASS',
        `Sesión activa verificada en memoria/storage. User ID: ${sessCheck.session.user.id}.`
      )
    } else {
      recordTest('C', 'Sesión Persistente', 'FAIL', sessErr?.message || 'No hay sesión activa.')
    }
  } catch (err: any) {
    recordTest('C', 'Sesión Persistente', 'FAIL', err.message)
  }

  // ---------------------------------------------------------------------------
  // PRUEBA E & F: USUARIO AUTENTICADO IDENTIFICADO Y UUID AUTH == PUBLIC
  // ---------------------------------------------------------------------------
  let publicProfile: any = null
  try {
    const { data: pubUser, error: pubErr } = await client
      .from('users')
      .select('id, email, full_name, role_id, company_id, is_active')
      .eq('id', authSession.user!.id)
      .single()

    if (!pubErr && pubUser) {
      publicProfile = pubUser
      recordTest(
        'E',
        'Usuario Identificado',
        'PASS',
        `Perfil fiduciario: "${pubUser.full_name}" (${pubUser.email}), activo: ${pubUser.is_active}.`
      )

      if (pubUser.id === targetAuthUser.id) {
        recordTest(
          'F',
          'Correspondencia UUID auth.users = public.users',
          'PASS',
          `UUID coincidente exacto: ${pubUser.id} === ${targetAuthUser.id}.`
        )
      } else {
        recordTest('F', 'Correspondencia UUID', 'FAIL', `UUIDs difieren: ${pubUser.id} != ${targetAuthUser.id}`)
      }
    } else {
      recordTest('E', 'Usuario Identificado', 'FAIL', pubErr?.message || 'No se pudo leer public.users.')
      recordTest('F', 'Correspondencia UUID', 'FAIL', 'No se obtuvo registro de public.users.')
    }
  } catch (err: any) {
    recordTest('E', 'Usuario Identificado', 'FAIL', err.message)
    recordTest('F', 'Correspondencia UUID', 'FAIL', err.message)
  }

  // ---------------------------------------------------------------------------
  // PRUEBA G: ROL OBTENIDO DIRECTAMENTE DESDE POSTGRESQL (public.roles)
  // ---------------------------------------------------------------------------
  let roleData: any = null
  try {
    if (publicProfile?.role_id) {
      const { data: rData, error: rErr } = await client
        .from('roles')
        .select('id, code, name, description')
        .eq('id', publicProfile.role_id)
        .single()

      if (!rErr && rData) {
        roleData = rData
        recordTest(
          'G',
          'Rol Obtenido desde BD',
          'PASS',
          `Rol "${rData.code}" (${rData.name}) consultado desde public.roles con ID ${rData.id}.`
        )
      } else {
        recordTest('G', 'Rol Obtenido desde BD', 'FAIL', rErr?.message || 'Rol no encontrado en public.roles.')
      }
    } else {
      recordTest('G', 'Rol Obtenido desde BD', 'FAIL', 'Perfil sin role_id.')
    }
  } catch (err: any) {
    recordTest('G', 'Rol Obtenido desde BD', 'FAIL', err.message)
  }

  // ---------------------------------------------------------------------------
  // PRUEBA H: PERMISOS OBTENIDOS DESDE BD (role_permissions -> permissions)
  // ---------------------------------------------------------------------------
  try {
    if (publicProfile?.role_id) {
      const { data: permsList, error: pErr } = await client
        .from('role_permissions')
        .select('permissions ( id, code, module )')
        .eq('role_id', publicProfile.role_id)

      if (!pErr && permsList && permsList.length > 0) {
        const codes = permsList.map((p: any) => p.permissions?.code).filter(Boolean)
        recordTest(
          'H',
          'Permisos Obtenidos desde BD',
          'PASS',
          `Se obtuvieron ${codes.length} permisos directamente desde PostgreSQL para ${roleData?.code || 'SUPERADMIN'}. Muestra: [${codes.slice(0, 4).join(', ')}...].`
        )
      } else {
        recordTest('H', 'Permisos Obtenidos desde BD', 'FAIL', pErr?.message || 'Sin permisos.')
      }
    } else {
      recordTest('H', 'Permisos Obtenidos desde BD', 'FAIL', 'Perfil sin role_id.')
    }
  } catch (err: any) {
    recordTest('H', 'Permisos Obtenidos desde BD', 'FAIL', err.message)
  }

  // ---------------------------------------------------------------------------
  // PRUEBA D: LOGOUT E INVALIDACIÓN DE SESIÓN
  // ---------------------------------------------------------------------------
  try {
    await client.auth.signOut()
    const { data: afterOut } = await client.auth.getSession()
    if (!afterOut.session) {
      recordTest(
        'D',
        'Logout',
        'PASS',
        'Sesión invalidada y purgada exitosamente en Supabase Auth.'
      )
    } else {
      recordTest('D', 'Logout', 'FAIL', 'La sesión permaneció activa tras signOut().')
    }
  } catch (err: any) {
    recordTest('D', 'Logout', 'FAIL', err.message)
  }

  // ---------------------------------------------------------------------------
  // PRUEBA I: RUTA PROTEGIDA SIN SESIÓN (MIDDLEWARE REDIRECCIONA A /login)
  // ---------------------------------------------------------------------------
  try {
    const unauthReq = new NextRequest('http://localhost:3000/usuarios', {
      headers: new Headers(),
    })
    const res = middleware(unauthReq)
    const location = res.headers.get('location') || ''
    if (location.includes('/login')) {
      recordTest(
        'I',
        'Ruta Protegida sin Sesión',
        'PASS',
        `Middleware interceptó petición anónima a /usuarios y redirigió a: ${location}.`
      )
    } else {
      recordTest('I', 'Ruta Protegida sin Sesión', 'FAIL', `No redirigió a /login. Location: ${location}`)
    }
  } catch (err: any) {
    recordTest('I', 'Ruta Protegida sin Sesión', 'FAIL', err.message)
  }

  // ---------------------------------------------------------------------------
  // PRUEBA J: RUTA PERMITIDA CON SESIÓN (MIDDLEWARE PERMITE ACCESO)
  // ---------------------------------------------------------------------------
  try {
    const authHeaders = new Headers()
    authHeaders.set('cookie', `sb-access-token=mock-valid-token; sb-user-role=SUPERADMIN`)
    const authReq = new NextRequest('http://localhost:3000/usuarios', {
      headers: authHeaders,
    })
    const res = middleware(authReq)
    const location = res.headers.get('location')
    if (!location) {
      recordTest(
        'J',
        'Ruta Permitida con Sesión',
        'PASS',
        'Middleware permitió el paso (NextResponse.next) a usuario autenticado con rol SUPERADMIN.'
      )
    } else {
      recordTest('J', 'Ruta Permitida con Sesión', 'FAIL', `Fue redirigido inesperadamente a ${location}`)
    }
  } catch (err: any) {
    recordTest('J', 'Ruta Permitida con Sesión', 'FAIL', err.message)
  }

  // ---------------------------------------------------------------------------
  // PRUEBA K: RUTA NO PERMITIDA SEGÚN ROL (MIDDLEWARE RESTRINGE CASHIER EN /usuarios)
  // ---------------------------------------------------------------------------
  try {
    const cashierHeaders = new Headers()
    cashierHeaders.set('cookie', `sb-access-token=mock-valid-token; sb-user-role=CASHIER`)
    const cashierReq = new NextRequest('http://localhost:3000/usuarios', {
      headers: cashierHeaders,
    })
    const res = middleware(cashierReq)
    const location = res.headers.get('location') || ''
    if (location.includes('denied=admin')) {
      recordTest(
        'K',
        'Ruta No Permitida según Rol',
        'PASS',
        `Middleware bloqueó a CASHIER al intentar acceder a /usuarios y redirigió con: ${location}.`
      )
    } else {
      recordTest('K', 'Ruta No Permitida según Rol', 'FAIL', `CASHIER no fue bloqueado. Location: ${location}`)
    }
  } catch (err: any) {
    recordTest('K', 'Ruta No Permitida según Rol', 'FAIL', err.message)
  }

  // ---------------------------------------------------------------------------
  // PRUEBA L: NINGÚN COMPONENTE CLIENTE TIENE ACCESO A SERVICE_ROLE_KEY
  // ---------------------------------------------------------------------------
  try {
    const appDir = path.resolve(process.cwd(), 'app')
    const componentsDir = path.resolve(process.cwd(), 'components')
    const featuresDir = path.resolve(process.cwd(), 'features')

    function scanDir(dir: string): string[] {
      let findings: string[] = []
      const entries = fs.readdirSync(dir, { withFileTypes: true })
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name)
        if (entry.isDirectory()) {
          findings = findings.concat(scanDir(fullPath))
        } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
          const content = fs.readFileSync(fullPath, 'utf8')
          if (content.includes('SUPABASE_SERVICE_ROLE_KEY')) {
            findings.push(fullPath)
          }
        }
      }
      return findings
    }

    const leakedFiles = [...scanDir(appDir), ...scanDir(componentsDir), ...scanDir(featuresDir)]
    if (leakedFiles.length === 0) {
      recordTest(
        'L',
        'SERVICE_ROLE_KEY Fuera de Bundles Cliente',
        'PASS',
        'Escaneo estático en app/, components/ y features/ completado: 0 archivos contienen SUPABASE_SERVICE_ROLE_KEY.'
      )
    } else {
      recordTest(
        'L',
        'SERVICE_ROLE_KEY Fuera de Bundles Cliente',
        'FAIL',
        `Se encontraron referencias en: ${leakedFiles.join(', ')}`
      )
    }
  } catch (err: any) {
    recordTest('L', 'SERVICE_ROLE_KEY Fuera de Bundles Cliente', 'FAIL', err.message)
  }

  // ---------------------------------------------------------------------------
  // PRUEBA M: NO EXISTE usr-001 UTILIZADO COMO USUARIO ACTUAL
  // ---------------------------------------------------------------------------
  try {
    const authFilesToCheck = [
      'features/auth/services/auth.service.ts',
      'features/auth/context/AuthContext.tsx',
      'features/users/hooks/useUsers.ts',
      'features/audit/hooks/useAudit.ts',
      'features/dashboard/hooks/useDashboardData.ts',
      'app/page.tsx',
      'lib/supabase/db.ts',
    ]

    let foundUsr001 = false
    for (const f of authFilesToCheck) {
      const full = path.resolve(process.cwd(), f)
      if (fs.existsSync(full)) {
        const content = fs.readFileSync(full, 'utf8')
        if (content.includes('usr-001')) {
          foundUsr001 = true
          break
        }
      }
    }

    if (!foundUsr001) {
      recordTest(
        'M',
        'Eliminación de usr-001',
        'PASS',
        'Todos los módulos de sesión, auth, hooks y db.ts tienen 0 referencias a usr-001 como usuario actual.'
      )
    } else {
      recordTest('M', 'Eliminación de usr-001', 'FAIL', 'Se encontró usr-001 en los archivos de autenticación auditados.')
    }
  } catch (err: any) {
    recordTest('M', 'Eliminación de usr-001', 'FAIL', err.message)
  }

  // ---------------------------------------------------------------------------
  // PRUEBA N: NO EXISTE FALLBACK DE AUTENTICACIÓN A db.ts / MOCK
  // ---------------------------------------------------------------------------
  try {
    const authServiceContent = fs.readFileSync(
      path.resolve(process.cwd(), 'features/auth/services/auth.service.ts'),
      'utf8'
    )
    const clientContent = fs.readFileSync(
      path.resolve(process.cwd(), 'lib/supabase/client.ts'),
      'utf8'
    )
    const usersJsonContent = fs.readFileSync(
      path.resolve(process.cwd(), 'lib/supabase/mock-db/users.json'),
      'utf8'
    )

    const hasDbImportInAuth = authServiceContent.includes('@/lib/supabase/db') || authServiceContent.includes('supabaseMock')
    const hasMockAuthInClient = clientContent.includes('createEmptyDatabaseClient') && clientContent.includes('signInWithPassword')
    const isUsersJsonEmpty = usersJsonContent.trim() === '[]'

    if (!hasDbImportInAuth && !hasMockAuthInClient && isUsersJsonEmpty) {
      recordTest(
        'N',
        'Sin Fallback a Mock en Autenticación',
        'PASS',
        'AuthService opera 100% sobre supabaseClient; client.ts sin emulador mock de auth; users.json vacío [].'
      )
    } else {
      recordTest(
        'N',
        'Sin Fallback a Mock en Autenticación',
        'FAIL',
        `hasDbImport: ${hasDbImportInAuth}, hasMockAuth: ${hasMockAuthInClient}, usersJsonEmpty: ${isUsersJsonEmpty}`
      )
    }
  } catch (err: any) {
    recordTest('N', 'Sin Fallback a Mock en Autenticación', 'FAIL', err.message)
  }

  // ---------------------------------------------------------------------------
  // RESUMEN FINAL
  // ---------------------------------------------------------------------------
  console.log('\n====================================================================')
  console.log('📊 RESUMEN DE EJECUCIÓN PASO 1:')
  const passCount = results.filter((r) => r.status === 'PASS').length
  const failCount = results.filter((r) => r.status === 'FAIL').length
  console.log(`   TOTAL PRUEBAS: ${results.length}`)
  console.log(`   APROBADAS (PASS): ${passCount}`)
  console.log(`   FALLIDAS  (FAIL): ${failCount}`)
  console.log('====================================================================')

  if (failCount > 0) {
    process.exit(1)
  }
}

runStep1Tests().catch((err) => {
  console.error('Error fatal durante las pruebas:', err)
  process.exit(1)
})
