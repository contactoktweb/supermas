/**
 * SUPER MÁS ERP/POS — Batería de Pruebas: BLINDAJE MULTIEMPRESA ESTRICTO
 *
 * Demuestra matemáticamente y de forma NO destructiva:
 * 1. Usuario sin sesión -> Error controlado, NUNCA fallback a companies.limit(1).
 * 2. Usuario con company_id = NULL -> Error controlado, NUNCA fallback.
 * 3. Usuario inactivo -> Error controlado.
 * 4. Usuario de Empresa A -> Solo puede resolver Empresa A.
 * 5. Usuario de Empresa A intentando acceder a Empresa B -> Error de violación multi-tenant.
 * 6. Usuario de Empresa B -> Solo puede resolver Empresa B.
 * 7. Todos los 11 repositorios delegando en la resolución canónica estricta.
 * 8. ZERO POLLUTION garantizado.
 */

import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { supabaseClient } from '../lib/supabase/client'
import { resolveUserCompanyId, getAuthenticatedCompany } from '../lib/supabase/tenant'
import { productRepository } from '../features/products/repositories/product.repository'
import { warehouseRepository } from '../features/warehouses/repositories/warehouse.repository'
import { categoryRepository } from '../features/categories/repositories/category.repository'
import { brandRepository } from '../features/brands/repositories/brand.repository'
import { inventoryRepository } from '../features/inventory/repositories/inventory.repository'
import { kardexRepository } from '../features/kardex/repositories/kardex.repository'
import { posRepository } from '../features/pos/repositories/pos.repository'
import { invoiceRepository } from '../features/invoices/repositories/invoice.repository'
import { supplierRepository } from '../features/suppliers/repositories/supplier.repository'
import { customerRepository } from '../features/customers/repositories/customer.repository'
import { salesRepository } from '../features/sales/repositories/sales.repository'

const adminPassword = process.env.STAGING_AUTH_PASSWORD || ''

interface TestRecord {
  name: string
  status: 'PASS' | 'FAIL'
  details: string
}

const tests: TestRecord[] = []

function assert(condition: boolean, name: string, passDetails: string, failDetails: string) {
  if (condition) {
    tests.push({ name, status: 'PASS', details: passDetails })
    console.log(`✅ [PASS] ${name}: ${passDetails}`)
  } else {
    tests.push({ name, status: 'FAIL', details: failDetails })
    console.error(`❌ [FAIL] ${name}: ${failDetails}`)
  }
}

async function runMultitenancyTests() {
  console.log('====================================================================')
  console.log('🛡️  PRUEBA DE BLINDAJE MULTIEMPRESA ESTRICTO (ZERO FALLBACKS)')
  console.log('====================================================================\n')

  // --- PRUEBA 1: Sin sesión activa -> Error controlado, NO fallback ---
  await supabaseClient.auth.signOut()

  let errNoSession: any = null
  try {
    await resolveUserCompanyId(supabaseClient)
  } catch (err: any) {
    errNoSession = err
  }

  assert(
    errNoSession !== null && errNoSession.message.includes('No hay una sesión activa'),
    '1. Sin sesión de usuario',
    `Lanzó error controlado esperado: "${errNoSession?.message}". CERO fallback a companies.limit(1).`,
    `No lanzó error o retornó empresa indebidamente: ${errNoSession?.message}`
  )

  // --- PRUEBA 2: Simulación de cliente con usuario sin company_id (NULL) ---
  const mockClientNullCompany = {
    auth: {
      getUser: async () => ({
        data: { user: { id: '00000000-0000-0000-0000-000000000001' } },
        error: null,
      }),
    },
    from: (_table: string) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: { company_id: null, is_active: true },
            error: null,
          }),
        }),
      }),
    }),
  } as any

  let errNullCompany: any = null
  try {
    await resolveUserCompanyId(mockClientNullCompany)
  } catch (err: any) {
    errNullCompany = err
  }

  assert(
    errNullCompany !== null && errNullCompany.message.includes('no tiene una empresa asociada'),
    '2. Usuario con company_id = NULL',
    `Lanzó error controlado: "${errNullCompany?.message}". No se seleccionó la primera empresa de la BD.`,
    `Fallback detectado o error inesperado: ${errNullCompany?.message}`
  )

  // --- PRUEBA 3: Simulación de usuario inactivo (is_active: false) ---
  const mockClientInactiveUser = {
    auth: {
      getUser: async () => ({
        data: { user: { id: '00000000-0000-0000-0000-000000000002' } },
        error: null,
      }),
    },
    from: (_table: string) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: { company_id: '11111111-1111-1111-1111-111111111111', is_active: false },
            error: null,
          }),
        }),
      }),
    }),
  } as any

  let errInactive: any = null
  try {
    await resolveUserCompanyId(mockClientInactiveUser)
  } catch (err: any) {
    errInactive = err
  }

  assert(
    errInactive !== null && errInactive.message.includes('inactiva'),
    '3. Usuario inactivo suspendido',
    `Lanzó error controlado: "${errInactive?.message}". Acceso bloqueado.`,
    `Acceso no bloqueado para usuario inactivo: ${errInactive?.message}`
  )

  // --- PRUEBA 4: Autenticación real de Usuario Empresa A ---
  const { data: authData, error: authError } = await supabaseClient.auth.signInWithPassword({
    email: 'samirdurant234@gmail.com',
    password: adminPassword,
  })

  if (authError || !authData.user) {
    throw new Error(`Error en autenticación para pruebas: ${authError?.message}`)
  }

  const { data: userProfile } = await supabaseClient
    .from('users')
    .select('id, full_name, company_id')
    .eq('id', authData.user.id)
    .single()

  const realCompanyA = userProfile?.company_id
  console.log(`\n🏢 Sesión real iniciada para Usuario A: Empresa asignada = ${realCompanyA}`)

  const resolvedCompanyA = await resolveUserCompanyId(supabaseClient)
  assert(
    resolvedCompanyA === realCompanyA,
    '4. Usuario Empresa A resuelve exclusivamente Empresa A',
    `Resolvió idéntico al perfil real (${resolvedCompanyA}).`,
    `Discrepancia: esperado ${realCompanyA}, obtenido ${resolvedCompanyA}`
  )

  // --- PRUEBA 5: Usuario A intenta forzar resolución de Empresa B (foreign UUID) ---
  const foreignCompanyB = 'ffffffff-ffff-ffff-ffff-ffffffffffff'
  let errCrossTenant: any = null
  try {
    await resolveUserCompanyId(supabaseClient, foreignCompanyB)
  } catch (err: any) {
    errCrossTenant = err
  }

  assert(
    errCrossTenant !== null && errCrossTenant.message.includes('Violación de aislamiento multiempresa'),
    '5. Usuario A intenta acceder a Empresa B',
    `Bloqueado de inmediato con error: "${errCrossTenant?.message}".`,
    `Aislamiento vulnerado: permitió preferredCompanyId foráneo sin pertenencia`
  )

  // --- PRUEBA 6: Simulación de Usuario Empresa B ---
  const companyB_Id = '22222222-2222-2222-2222-222222222222'
  const mockClientUserB = {
    auth: {
      getUser: async () => ({
        data: { user: { id: '00000000-0000-0000-0000-000000000003' } },
        error: null,
      }),
    },
    from: (_table: string) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: { company_id: companyB_Id, is_active: true },
            error: null,
          }),
        }),
      }),
    }),
  } as any

  const resolvedCompanyB = await resolveUserCompanyId(mockClientUserB)
  assert(
    resolvedCompanyB === companyB_Id,
    '6. Usuario Empresa B resuelve exclusivamente Empresa B',
    `Resolvió correctamente Empresa B (${resolvedCompanyB}).`,
    `Fallo en resolución de Empresa B`
  )

  let errUserB_CrossTenant: any = null
  try {
    await resolveUserCompanyId(mockClientUserB, realCompanyA)
  } catch (err: any) {
    errUserB_CrossTenant = err
  }

  assert(
    errUserB_CrossTenant !== null && errUserB_CrossTenant.message.includes('Violación de aislamiento multiempresa'),
    '7. Usuario B intentando forzar Empresa A es bloqueado',
    `Bloqueado con error: "${errUserB_CrossTenant?.message}".`,
    `Aislamiento vulnerado para Usuario B`
  )

  // --- PRUEBA 8: Verificación en los 11 Repositorios ---
  console.log('\n--- Verificación en los 11 Repositorios del ERP ---')

  const r1 = await productRepository.resolveCompanyId()
  assert(r1 === realCompanyA, '8.1 ProductRepository.resolveCompanyId', `Resuelve ${r1}`, 'Error')

  const r2 = await (warehouseRepository as any).resolveCompanyId()
  assert(r2 === realCompanyA, '8.2 WarehouseRepository.resolveCompanyId', `Resuelve ${r2}`, 'Error')

  const r3 = await categoryRepository.resolveCompanyId()
  assert(r3 === realCompanyA, '8.3 CategoryRepository.resolveCompanyId', `Resuelve ${r3}`, 'Error')

  const r4 = await brandRepository.resolveCompanyId()
  assert(r4 === realCompanyA, '8.4 BrandRepository.resolveCompanyId', `Resuelve ${r4}`, 'Error')

  const r5 = await (inventoryRepository as any).resolveCompanyId()
  assert(r5 === realCompanyA, '8.5 InventoryRepository.resolveCompanyId', `Resuelve ${r5}`, 'Error')

  const r6 = await (kardexRepository as any).resolveCompanyId()
  assert(r6 === realCompanyA, '8.6 KardexRepository.resolveCompanyId', `Resuelve ${r6}`, 'Error')

  const r7 = await (posRepository as any).resolveCompanyId()
  assert(r7 === realCompanyA, '8.7 POSRepository.resolveCompanyId', `Resuelve ${r7}`, 'Error')

  const r8 = await (invoiceRepository as any).resolveCompanyId()
  assert(r8 === realCompanyA, '8.8 InvoiceRepository.resolveCompanyId', `Resuelve ${r8}`, 'Error')

  const r9 = await (supplierRepository as any).resolveCompanyId()
  assert(r9 === realCompanyA, '8.9 SupplierRepository.resolveCompanyId', `Resuelve ${r9}`, 'Error')

  const r10 = await (customerRepository as any).resolveCompanyId()
  assert(r10 === realCompanyA, '8.10 CustomerRepository.resolveCompanyId', `Resuelve ${r10}`, 'Error')

  const r11 = await salesRepository.resolveCompanyId()
  assert(r11 === realCompanyA, '8.11 SalesRepository.resolveCompanyId', `Resuelve ${r11}`, 'Error')

  // --- PRUEBA 9: getAuthenticatedCompany retorna la empresa de Usuario A ---
  const companyData = await getAuthenticatedCompany()
  assert(
    companyData?.id === realCompanyA,
    '9. getAuthenticatedCompany filtra por la empresa del usuario autenticado',
    `Retornó empresa correcta: ${companyData?.business_name || companyData?.trade_name} (ID: ${companyData?.id})`,
    'getAuthenticatedCompany no retornó la empresa correcta'
  )

  // Resumen final
  console.log('\n====================================================================')
  console.log('📊 RESUMEN DE PRUEBAS MULTIEMPRESA')
  console.log('====================================================================')
  const passed = tests.filter((t) => t.status === 'PASS').length
  const failed = tests.filter((t) => t.status === 'FAIL').length
  console.log(`Total: ${tests.length} | Aprobadas: ${passed} | Fallidas: ${failed}`)

  if (failed > 0) {
    process.exit(1)
  }
}

runMultitenancyTests().catch((err) => {
  console.error('Error fatal ejecutando pruebas multiempresa:', err)
  process.exit(1)
})
