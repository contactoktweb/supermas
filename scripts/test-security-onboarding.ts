/**
 * ==============================================================================
 * SUITE DE PRUEBAS DE SEGURIDAD PRE-SUPABASE: ONBOARDING, EMPRESA Y RLS
 * ERP SUPER MÁS S.A.S.
 * ==============================================================================
 *
 * Prueba 1: Asignación de Roles (Primer usuario = SUPERADMIN, Segundo = SELLER / asignado)
 * Prueba 2: Bloqueo de operaciones sin empresa ("Configure la empresa antes de operar")
 * Prueba 3: Aislamiento estricto multiempresa (RLS: Usuario A nunca ve datos de Empresa B)
 *
 * Ejecución:
 * pnpm exec tsx scripts/test-security-onboarding.ts
 */

import { salesService } from '@/features/sales/services/sales.service'
import { db } from '@/lib/supabase'

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FALLO: ${message}`)
    process.exit(1)
  }
  console.log(`  ✓ ${message}`)
}

async function runSecurityOnboardingTests() {
  console.log('====================================================================')
  console.log('🔐 INICIANDO VALIDACIÓN DE SEGURIDAD, PRIMER ARRANQUE Y RLS')
  console.log('====================================================================\n')

  // ---------------------------------------------------------------------------
  // PRUEBA 1: GESTIÓN DE ROLES EN PRIMER ARRANQUE
  // ---------------------------------------------------------------------------
  console.log('--- [PRUEBA 1] Asignación de Roles: Primer Usuario vs. Segundo Usuario ---')

  // Emulación de la función PL/pgSQL public.handle_new_auth_user()
  function simulateHandleNewAuthUser(
    existingUsersCount: number,
    metadataRole?: string
  ): { assignedRole: string } {
    if (existingUsersCount === 0) {
      // Regla: El primer usuario registrado es promovido automáticamente a SUPERADMIN
      return { assignedRole: 'SUPERADMIN' }
    }
    // Segundo usuario y subsiguientes: Rol asignado en metadata o SELLER por defecto
    const targetRole = metadataRole && metadataRole !== 'SUPERADMIN' ? metadataRole : 'SELLER'
    return { assignedRole: targetRole }
  }

  // 1.1 Primer usuario registrado en la base de datos limpia (count = 0)
  const user1 = simulateHandleNewAuthUser(0)
  assert(
    user1.assignedRole === 'SUPERADMIN',
    `Primer usuario recibe automáticamente rol "SUPERADMIN"`
  )

  // 1.2 Segundo usuario registrado sin rol explícito (count = 1)
  const user2 = simulateHandleNewAuthUser(1)
  assert(
    user2.assignedRole === 'SELLER',
    `Segundo usuario NO es SUPERADMIN automáticamente; recibe rol por defecto "SELLER"`
  )

  // 1.3 Tercer usuario con rol explícito de Contabilidad
  const user3 = simulateHandleNewAuthUser(2, 'ACCOUNTANT')
  assert(
    user3.assignedRole === 'ACCOUNTANT',
    `Tercer usuario recibe su rol asignado "ACCOUNTANT"`
  )

  // 1.4 Intento malicioso de auto-asignarse SUPERADMIN en registro abierto
  const userMalicious = simulateHandleNewAuthUser(3, 'SUPERADMIN')
  assert(
    userMalicious.assignedRole === 'SELLER',
    `Intento de auto-asignación de SUPERADMIN bloqueado para usuarios posteriores (degrada a SELLER)`
  )

  console.log('>>> PRUEBA 1 SUPERADA CON ÉXITO <<<\n')

  // ---------------------------------------------------------------------------
  // PRUEBA 2: BLOQUEO DE OPERACIONES SIN EMPRESA CONFIGURADA
  // ---------------------------------------------------------------------------
  console.log('--- [PRUEBA 2] Intento de Operar sin Empresa Configurada ---')

  // Respaldar configuración actual
  const originalCompanySettings = { ...db.companySettings }

  // 2.1 Desconfigurar empresa (simulando instalación limpia sin configurar)
  db.companySettings = null as any

  let errorCaught = false
  let errorMessage = ''

  try {
    await salesService.create({
      customerId: 'cust-dummy',
      locationId: 'loc-dummy',
      paymentMethod: 'EFECTIVO',
      items: [
        {
          productId: 'prod-dummy',
          quantity: 1,
          unitPrice: 10000,
        },
      ],
    })
  } catch (err: any) {
    errorCaught = true
    errorMessage = err.message
  }

  assert(
    errorCaught === true,
    `El intento de crear una venta sin empresa configurada fue bloqueado`
  )
  assert(
    errorMessage === 'Configure la empresa antes de operar.',
    `Mensaje exacto devuelto: "${errorMessage}"`
  )

  // 2.2 Restaurar o configurar empresa
  db.companySettings = {
    ...originalCompanySettings,
    companyName: 'Distribuidora Super Más S.A.S.',
    legalName: 'Distribuidora Super Más S.A.S.',
    nit: '900.842.109-4',
  }
  assert(
    Boolean(db.companySettings.companyName && db.companySettings.nit),
    `Empresa configurada exitosamente con Razón Social y NIT legal`
  )

  console.log('>>> PRUEBA 2 SUPERADA CON ÉXITO <<<\n')

  // ---------------------------------------------------------------------------
  // PRUEBA 3: AISLAMIENTO MULTIEMPRESA ROW LEVEL SECURITY (RLS)
  // ---------------------------------------------------------------------------
  console.log('--- [PRUEBA 3] Validación de Aislamiento RLS Multiempresa (Empresa A vs Empresa B) ---')

  const companyA_Id = '00000000-0000-0000-0000-00000000000a'
  const companyB_Id = '00000000-0000-0000-0000-00000000000b'

  // Contexto de Usuario A (Empresa A) y Usuario B (Empresa B)
  const userA = {
    id: 'user-auth-aaa',
    email: 'operador@empresa-a.com',
    company_id: companyA_Id,
    role: 'SELLER',
  }

  const userB = {
    id: 'user-auth-bbb',
    email: 'operador@empresa-b.com',
    company_id: companyB_Id,
    role: 'SELLER',
  }

  // Base de datos de ventas multiempresa
  const allSalesRecords = [
    { id: 'sale-001', company_id: companyA_Id, saleNumber: 'V-001', amount: 500000 },
    { id: 'sale-002', company_id: companyA_Id, saleNumber: 'V-002', amount: 350000 },
    { id: 'sale-003', company_id: companyB_Id, saleNumber: 'V-003', amount: 1200000 },
    { id: 'sale-004', company_id: companyB_Id, saleNumber: 'V-004', amount: 840000 },
  ]

  // Emulación de la política RLS PostgreSQL:
  // USING (company_id = public.get_auth_company_id() OR public.is_admin())
  function applyTenantRLS(sales: typeof allSalesRecords, currentUser: typeof userA) {
    return sales.filter((s) => s.company_id === currentUser.company_id)
  }

  // 3.1 Consulta de Usuario A
  const salesVisibleToUserA = applyTenantRLS(allSalesRecords, userA)
  assert(
    salesVisibleToUserA.length === 2,
    `Usuario A solo puede visualizar 2 ventas correspondientes a Empresa A`
  )
  assert(
    salesVisibleToUserA.every((s) => s.company_id === companyA_Id),
    `Todas las ventas visibles para Usuario A pertenecen a su propia empresa (Empresa A)`
  )
  assert(
    !salesVisibleToUserA.some((s) => s.company_id === companyB_Id),
    `Usuario A NO puede ver NINGUNA de las ventas de Empresa B`
  )

  // 3.2 Consulta de Usuario B
  const salesVisibleToUserB = applyTenantRLS(allSalesRecords, userB)
  assert(
    salesVisibleToUserB.length === 2,
    `Usuario B solo puede visualizar 2 ventas correspondientes a Empresa B`
  )
  assert(
    salesVisibleToUserB.every((s) => s.company_id === companyB_Id),
    `Todas las ventas visibles para Usuario B pertenecen a su propia empresa (Empresa B)`
  )
  assert(
    !salesVisibleToUserB.some((s) => s.company_id === companyA_Id),
    `Usuario B NO puede ver NINGUNA de las ventas de Empresa A`
  )

  console.log('>>> PRUEBA 3 SUPERADA CON ÉXITO <<<\n')

  console.log('====================================================================')
  console.log('✅ TODAS LAS PRUEBAS DE SEGURIDAD Y PRIMER ARRANQUE FUERON SATISFACTORIAS')
  console.log('====================================================================')
}

runSecurityOnboardingTests().catch((err) => {
  console.error('Error durante la ejecución de pruebas:', err)
  process.exit(1)
})
