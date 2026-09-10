import { customerService } from '../services/customer.service'
import { customerRepository } from '../repositories/customer.repository'
import { CustomerUserContext } from '../types'

async function runCustomerTests() {
  console.log('🚀 Iniciando pruebas automatizadas del Módulo Clientes...')
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

  // 1. Estadísticas de clientes
  console.log('\n📊 Test 1: Estadísticas de Clientes (KPIs)...')
  const stats = await customerService.getCustomerStats()
  assert(stats.totalCustomers >= 6, `Total clientes >= 6 (obtenido: ${stats.totalCustomers})`)
  assert(stats.activeCustomers > 0, `Clientes activos > 0 (obtenido: ${stats.activeCustomers})`)
  assert(stats.totalSalesAmount > 0, `Total vendido a clientes > 0 (obtenido: $${stats.totalSalesAmount.toLocaleString()})`)
  assert(Boolean(stats.topBuyer?.name), `Cliente con mayor compra identificado: ${stats.topBuyer?.name}`)

  // 2. Listado con filtros y paginación
  console.log('\n🔍 Test 2: Listado y Filtros...')
  const listAll = await customerService.list({ page: 1, pageSize: 10 })
  assert(listAll.items.length > 0, `Listado retorna ${listAll.items.length} clientes`)
  assert(listAll.total >= 6, `Total general de clientes es ${listAll.total}`)

  // Filtro por documento
  const listByDoc = await customerService.list({ documentNumber: '901442118' })
  assert(listByDoc.items.length === 1 && Boolean(listByDoc.items[0].businessName?.includes('El Sol')), 'Filtro por documento/NIT funciona')

  // Filtro por tipo de cliente
  const listCompanies = await customerService.list({ customerType: 'COMPANY' })
  assert(listCompanies.items.every((c) => c.customerType === 'COMPANY'), 'Filtro por tipo COMPANY retorna solo empresas')

  // Filtro por lista de precios
  const listWholesale = await customerService.list({ priceList: 'WHOLESALE' })
  assert(listWholesale.items.every((c) => c.priceList === 'WHOLESALE'), 'Filtro por lista de precios WHOLESALE funciona')

  // 3. Detalle relacional completo
  console.log('\n🔗 Test 3: Detalle Relacional (Sales, Invoices, Remissions, Web Orders, Payments, Documents)...')
  const detail = await customerService.getById('cust-001')
  assert(detail.id === 'cust-001', 'Detalle de cliente cargado correctamente')
  assert(Array.isArray(detail.sales), `Historial de ventas presente (${detail.sales.length} ventas)`)
  assert(Array.isArray(detail.invoices), `Historial de facturas presente (${detail.invoices.length} facturas)`)
  assert(Array.isArray(detail.remissions), `Historial de remisiones presente (${detail.remissions.length} remisiones)`)
  assert(Array.isArray(detail.webOrders), `Historial de pedidos web presente (${detail.webOrders.length} pedidos)`)
  assert(Array.isArray(detail.payments), `Historial de pagos/cartera presente (${detail.payments.length} pagos)`)
  assert(Array.isArray(detail.documents), `Expediente de documentos presente (${detail.documents.length} documentos)`)
  assert(Array.isArray(detail.auditLogs), `Historial de auditoría cargado (${detail.auditLogs.length} logs)`)

  // 4. Creación de cliente con Zod & Prevención de duplicados
  console.log('\n➕ Test 4: Creación de Cliente...')
  const testDocNumber = `TEST-${Date.now().toString().slice(-6)}`
  const createdCustomer = await customerService.create({
    customerType: 'NATURAL',
    documentType: 'CC',
    documentNumber: testDocNumber,
    firstName: 'Juan Pablo',
    lastName: 'Montoya',
    email: 'jp.montoya@testmotors.com',
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
  assert(createdCustomer.displayName === 'Juan Pablo Montoya', 'Cliente creado con displayName compuesto')
  assert(createdCustomer.documentNumber === testDocNumber, 'Número de documento asignado correctamente')

  // Intento de duplicar documento
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

  // 5. Actualización de cliente
  console.log('\n✏️ Test 5: Edición de Cliente...')
  const updatedCustomer = await customerService.update(createdCustomer.id, {
    firstName: 'Juan Pablo',
    lastName: 'Montoya Roldán',
    city: 'Bogotá',
    priceList: 'VIP',
    notes: 'Actualizado en suite de tests',
  })
  assert(updatedCustomer.displayName === 'Juan Pablo Montoya Roldán', 'DisplayName actualizado correctamente')
  assert(updatedCustomer.priceList === 'VIP', 'Lista de precios actualizada a VIP')
  assert(updatedCustomer.city === 'Bogotá', 'Ciudad actualizada a Bogotá')

  // 6. Pagos / Cartera y Documentos
  console.log('\n💰 Test 6: Abonos a Cartera y Expediente Digital...')
  const payment = await customerService.addPayment({
    customerId: createdCustomer.id,
    amount: 150000,
    paymentMethod: 'TRANSFERENCIA',
    reference: 'BANC-TEST-88492',
    notes: 'Abono de prueba unitaria',
  })
  assert(payment.amount === 150000, `Pago registrado por valor de $${payment.amount}`)
  assert(payment.reference === 'BANC-TEST-88492', 'Referencia bancaria guardada')

  const document = await customerService.addDocument({
    customerId: createdCustomer.id,
    fileName: 'RUT_2026_Actualizado.pdf',
    category: 'RUT',
    fileSize: '1.4 MB',
    fileType: 'application/pdf',
    notes: 'RUT verificado',
  })
  assert(document.fileName === 'RUT_2026_Actualizado.pdf', 'Documento RUT adjuntado exitosamente')

  // 7. Desactivación segura (Control de saldo)
  console.log('\n🛡️ Test 7: Desactivación Segura con Control Financiero...')
  // Cliente con saldo (ej. cust-001 o cust-002)
  const clientWithDebt = await customerRepository.findById('cust-001')
  if (clientWithDebt && clientWithDebt.currentBalance > 0) {
    await assertThrowsAsync(async () => {
      await customerService.deactivate('cust-001', 'Intento de desactivar con deuda')
    }, 'Bloquea desactivación si el cliente posee saldo pendiente en cartera')
  }

  // Cliente sin saldo (createdCustomer)
  const deactivated = await customerService.deactivate(createdCustomer.id, 'Prueba de desactivación')
  assert(deactivated.status === 'INACTIVE', 'Cliente sin deuda desactivado correctamente (Soft delete)')

  // Reactivación
  const reactivated = await customerService.reactivate(createdCustomer.id)
  assert(reactivated.status === 'ACTIVE', 'Cliente reactivado satisfactoriamente')

  // 8. Integración POS
  console.log('\n🛒 Test 8: Búsqueda Rápida para POS...')
  const posResults = await customerService.searchForPos('El Sol')
  assert(posResults.length > 0 && Boolean(posResults[0].businessName?.includes('El Sol')), 'Búsqueda POS por nombre de empresa exitosa')

  const posByDoc = await customerService.searchForPos('222222222222')
  assert(posByDoc.length > 0 && posByDoc[0].documentNumber === '222222222222', 'Búsqueda POS encuentra Consumidor Final')

  // 9. Integración Ecommerce / Web
  console.log('\n🌐 Test 9: Integración con Tienda Web / Ecommerce...')
  const webCustomer = await customerService.getOrCreateWebCustomer({
    documentNumber: '1098765432',
    fullName: 'María Fernanda Aristizábal',
    email: 'maria.fe@ecommerce.co',
    phone: '3187766554',
    address: 'Carrera 7 # 120-45',
    city: 'Bogotá',
    department: 'Bogotá D.C.',
  })
  assert(webCustomer.displayName === 'María Fernanda Aristizábal', 'Cliente Web recuperado o creado con éxito')

  // 10. Seguridad y Permisos RBAC
  console.log('\n🔒 Test 10: Control de Permisos RBAC...')
  const restrictedUser: CustomerUserContext = {
    userId: 'usr-guest-01',
    userName: 'Invitado Sin Permisos',
    permissions: [],
  }
  await assertThrowsAsync(async () => {
    await customerService.create({
      customerType: 'NATURAL',
      documentType: 'CC',
      documentNumber: '999999999',
      firstName: 'Hacker',
      email: 'hacker@test.com',
      phone: '3001234567',
      address: 'Calle 1',
      city: 'Cali',
      department: 'Valle',
    }, restrictedUser)
  }, 'Bloquea creación cuando el usuario no tiene el permiso [customer.create]')

  await assertThrowsAsync(async () => {
    await customerService.deactivate('cust-001', 'Sin permiso', restrictedUser)
  }, 'Bloquea desactivación cuando el usuario no tiene el permiso [customer.deactivate]')

  console.log(`\n========================================`)
  console.log(`Resumen de Pruebas: ${passed} Pasadas | ${failed} Fallidas`)
  console.log(`========================================\n`)

  if (failed > 0) {
    process.exit(1)
  }
}

runCustomerTests().catch((err) => {
  console.error('Error fatal durante la ejecución de pruebas:', err)
  process.exit(1)
})
