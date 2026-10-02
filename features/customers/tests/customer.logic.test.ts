import { supabaseClient } from '@/lib/supabase/client'
import { customerService } from '../services/customer.service'
import { customerRepository } from '../repositories/customer.repository'
import { CustomerUserContext } from '../types'

async function runCustomerTests() {
  console.log('🚀 Iniciando pruebas unitarias y lógicas del Módulo Clientes...')
  let passed = 0
  let failed = 0

  const assert = (condition: boolean, testName: string) => {
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`)
      passed++
    } else {
      console.error(`  ❌ FAIL: ${testName}`)
      failed++
    }
  }

  const assertThrowsAsync = async (fn: () => Promise<unknown>, testName: string) => {
    try {
      await fn()
      console.error(`  ❌ FAIL: ${testName} (Expected exception but none was thrown)`)
      failed++
    } catch (e: any) {
      console.log(`  ✅ PASS: ${testName} -> Error capturado: ${e.message}`)
      passed++
    }
  }

  // Autenticar en staging para probar contexto real con RLS
  const { data: authData, error: authErr } = await supabaseClient.auth.signInWithPassword({
    email: process.env.STAGING_AUTH_EMAIL!,
    password: process.env.STAGING_AUTH_PASSWORD!,
  })
  if (authErr) {
    throw new Error(`Fallo de autenticación en staging: ${authErr.message}`)
  }
  console.log(`✅ Sesión autenticada para pruebas: ${authData.user?.email}`)

  const testRunId = Date.now().toString().slice(-6)
  const testDocNumber = `TEST-${testRunId}`
  let createdCustomerId = ''

  try {
    // 1. Creación de cliente de prueba con Zod
    console.log('\n➕ Preparación: Creación de Cliente de prueba...')
    const createdCustomer = await customerService.create({
      customerType: 'NATURAL',
      documentType: 'CC',
      documentNumber: testDocNumber,
      firstName: 'Juan Pablo',
      lastName: 'Montoya',
      email: `jp.montoya.${testRunId}@testmotors.com`,
      phone: '3159988776',
      address: 'Autopista Norte Km 18',
      city: 'Chía',
      department: 'Cundinamarca',
      category: 'FREQUENT',
      priceList: 'DEFAULT',
      creditLimit: 5000000,
      creditDays: 30,
      notes: 'Cliente de prueba automatizada',
    })
    createdCustomerId = createdCustomer.id
    assert(createdCustomer.displayName === 'Juan Pablo Montoya', 'Cliente creado con displayName compuesto')
    assert(createdCustomer.documentNumber === testDocNumber, 'Número de documento asignado correctamente')

    // 2. Estadísticas de clientes
    console.log('\n📊 Test 1: Estadísticas de Clientes (KPIs)...')
    const stats = await customerService.getCustomerStats()
    assert(stats.totalCustomers >= 1, `Total clientes >= 1 (obtenido: ${stats.totalCustomers})`)
    assert(stats.activeCustomers >= 1, `Clientes activos >= 1 (obtenido: ${stats.activeCustomers})`)
    assert(stats.totalSalesAmount >= 0, `Total vendido a clientes >= 0 (obtenido: $${stats.totalSalesAmount.toLocaleString()})`)

    // 3. Listado con filtros y paginación
    console.log('\n🔍 Test 2: Listado y Filtros...')
    const listAll = await customerService.list({ page: 1, pageSize: 10 })
    assert(listAll.items.length >= 1, `Listado retorna ${listAll.items.length} clientes`)
    assert(listAll.total >= 1, `Total general de clientes es ${listAll.total}`)

    // Filtro por documento
    const listByDoc = await customerService.list({ documentNumber: testDocNumber })
    assert(listByDoc.items.length === 1 && listByDoc.items[0].documentNumber === testDocNumber, 'Filtro por documento/NIT funciona')

    // 4. Detalle relacional completo
    console.log('\n🔗 Test 3: Detalle Relacional...')
    const detail = await customerService.getById(createdCustomer.id)
    assert(detail.id === createdCustomer.id, 'Detalle de cliente cargado correctamente')
    assert(Array.isArray(detail.sales), 'Historial de ventas es un arreglo')
    assert(Array.isArray(detail.payments), 'Historial de pagos es un arreglo')
    assert(Array.isArray(detail.auditLogs), 'Historial de auditoría cargado')

    // 5. Prevención de duplicados
    console.log('\n➕ Test 4: Prevención de Duplicados...')
    await assertThrowsAsync(async () => {
      await customerService.create({
        customerType: 'NATURAL',
        documentType: 'CC',
        documentNumber: testDocNumber,
        firstName: 'Duplicado',
        lastName: 'Test',
        email: 'duplicado@test.com',
        phone: '3000000000',
        address: 'Calle 100',
        city: 'Bogotá',
        department: 'Bogotá D.C.',
      })
    }, 'Previene la creación de clientes con documento duplicado')

    // 6. Actualización de cliente
    console.log('\n✏️ Test 5: Edición de Cliente...')
    const updatedCustomer = await customerService.update(createdCustomer.id, {
      firstName: 'Juan Pablo',
      lastName: 'Montoya Roldán',
      city: 'Bogotá',
      priceList: 'VIP',
      notes: 'Actualizado en suite de tests',
    })
    assert(updatedCustomer.displayName === 'Juan Pablo Montoya Roldán', 'DisplayName actualizado correctamente')
    assert(updatedCustomer.city === 'Bogotá', 'Ciudad actualizada a Bogotá')

    // 7. Desactivación y reactivación
    console.log('\n🛡️ Test 6: Desactivación y Reactivación...')
    const deactivated = await customerService.deactivate(createdCustomer.id, 'Prueba de desactivación')
    assert(deactivated.status === 'INACTIVE', 'Cliente desactivado correctamente')

    const reactivated = await customerService.reactivate(createdCustomer.id)
    assert(reactivated.status === 'ACTIVE', 'Cliente reactivado satisfactoriamente')

    // 8. Integración POS
    console.log('\n🛒 Test 7: Búsqueda Rápida para POS...')
    const posResults = await customerService.searchForPos('Juan Pablo')
    assert(posResults.length > 0 && posResults[0].firstName === 'Juan Pablo', 'Búsqueda POS por nombre exitosa')

    // 9. Seguridad y Permisos RBAC
    console.log('\n🔒 Test 8: Control de Permisos RBAC...')
    const restrictedUser: CustomerUserContext = {
      userId: 'usr-restricted',
      userName: 'Usuario Restringido',
      permissions: ['other.permission'],
    }
    await assertThrowsAsync(async () => {
      await customerService.create({
        customerType: 'NATURAL',
        documentType: 'CC',
        documentNumber: '999999999',
        firstName: 'Sin Permiso',
        email: 'sinpermiso@test.com',
        phone: '3001234567',
        address: 'Calle 1',
        city: 'Cali',
        department: 'Valle',
      }, restrictedUser)
    }, 'Bloquea creación cuando el usuario no tiene permisos')

    console.log(`\n========================================`)
    console.log(`Resumen de Pruebas: ${passed} Pasadas | ${failed} Fallidas`)
    console.log(`========================================\n`)

  } finally {
    // Teardown Zero Pollution
    if (createdCustomerId) {
      console.log('🧹 Limpiando cliente de prueba...')
      await supabaseClient.from('customers').delete().eq('id', createdCustomerId)
      console.log('✅ Cliente de prueba eliminado.')
    }
  }

  if (failed > 0) {
    process.exit(1)
  }
}

runCustomerTests().catch((err) => {
  console.error('Error fatal durante la ejecución de pruebas:', err)
  process.exit(1)
})
