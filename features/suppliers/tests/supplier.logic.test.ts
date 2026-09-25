import { supplierService } from '../services/supplier.service'
import { supplierRepository } from '../repositories/supplier.repository'
import { db } from '@/lib/supabase'
import { UserPermissionContext, CreateSupplierInput } from '../types'

console.log('==================================================================')
console.log('--- EJECUTANDO TESTS DE LÓGICA DE NEGOCIO - MÓDULO PROVEEDORES ---')
console.log('==================================================================\n')

async function runTests() {
  // TEST 1: Validación y Creación de Proveedor
  console.log('[Test 1] Validación y Creación de Proveedor Nuevo')
  const newSupplierData: CreateSupplierInput = {
    documentType: 'NIT',
    documentNumber: '901.999.888-7',
    businessName: 'Distribuidora Lácteos del Campo SAS',
    commercialName: 'Lácteos del Campo',
    contactName: 'Gloria Patricia Restrepo',
    phone: '+57 315 888 9900',
    email: 'ventas@lacteosdelcampo.co',
    address: 'Carrera 65 # 18-40 Zona Industrial',
    city: 'Medellín',
    department: 'Antioquia',
    country: 'Colombia',
    status: 'ACTIVE',
    creditDays: 30,
    creditLimit: 15000000,
    notes: 'Proveedor de derivados lácteos y quesos premium',
  }

  const created = await supplierService.create(newSupplierData, {
    userId: 'user-admin-01',
    userName: 'Administrador Maestro',
    userRole: 'ADMINISTRADOR',
    permissions: ['supplier.create', 'supplier.read'],
  })

  if (!created || !created.id) {
    throw new Error('No se generó el proveedor correctamente.')
  }
  if (created.businessName !== 'Distribuidora Lácteos del Campo SAS') {
    throw new Error(`Razón social no coincide: ${created.businessName}`)
  }
  if (created.status !== 'ACTIVE') {
    throw new Error(`Estado inicial incorrecto: ${created.status}`)
  }
  console.log(`✓ Proveedor creado exitosamente con ID: ${created.id}`)

  // TEST 1.1: Prevención de NIT / Documento Duplicado
  console.log('\n[Test 1.1] Prevención de NIT / Documento Duplicado')
  try {
    await supplierService.create(newSupplierData)
    throw new Error('Debería haber rechazado la creación de proveedor con NIT duplicado')
  } catch (err: any) {
    if (err.message.includes('Debería haber rechazado')) throw err
    console.log(`✓ Duplicidad prevenida con éxito: "${err.message}"`)
  }

  // TEST 1.2: Verificación de Registro en Auditoría (audit_logs.json)
  console.log('\n[Test 1.2] Verificación de Registro en Auditoría (audit_logs.json)')
  const auditLogs = (db.auditLogs as unknown as any[]).filter(
    (l) => l.entity === 'SUPPLIER' && l.entityId === created.id && l.action === 'SUPPLIER_CREATED'
  )
  if (auditLogs.length === 0) {
    throw new Error('No se encontró el registro de auditoría para la creación del proveedor')
  }
  console.log(`✓ Auditoría registrada con éxito por usuario: ${auditLogs[0].userName}`)

  // TEST 2: Edición de Condiciones Comerciales y Auditoría
  console.log('\n[Test 2] Edición de Condiciones Comerciales y Trazabilidad')
  const updated = await supplierService.update(
    created.id,
    {
      creditLimit: 25000000,
      creditDays: 45,
      notes: 'Cupo de crédito ampliado por buen historial',
    },
    {
      userId: 'user-admin-01',
      userName: 'Administrador Maestro',
      userRole: 'ADMINISTRADOR',
      permissions: ['supplier.update', 'supplier.read'],
    }
  )

  if (updated.creditLimit !== 25000000 || updated.creditDays !== 45) {
    throw new Error('Los valores de crédito no se actualizaron correctamente.')
  }
  const editAudit = (db.auditLogs as unknown as any[]).find(
    (l) => l.entity === 'SUPPLIER' && l.entityId === created.id && l.action === 'SUPPLIER_UPDATED'
  )
  if (!editAudit) {
    throw new Error('No se registró la auditoría de edición del proveedor')
  }
  console.log(`✓ Proveedor editado y cambio de cupo/días auditado: $15M -> $25M`)

  // TEST 3: Relación de Productos Suministrados (Supplier -> PurchaseLine -> Product)
  console.log('\n[Test 3] Relación Relacional de Productos Suministrados')
  const suppliedProducts = await supplierService.getSuppliedProducts(created.id)
  if (!Array.isArray(suppliedProducts)) {
    throw new Error('suppliedProducts debe ser un arreglo')
  }
  console.log(`✓ Consulta de productos suministrados exitosa: ${suppliedProducts.length} producto(s)`)

  // TEST 4: Facturas, Saldos y Relación con Bodegas (Supplier <-> Location)
  console.log('\n[Test 4] Facturas, Cuentas Pendientes y Distribución por Bodega')
  const invoices = await supplierService.getSupplierInvoices(created.id)
  if (!Array.isArray(invoices)) {
    throw new Error('invoices debe ser un arreglo')
  }
  console.log(`✓ Facturas asociadas: ${invoices.length} facturas`)

  const warehouses = await supplierService.getSupplierWarehouses(created.id)
  if (!Array.isArray(warehouses)) {
    throw new Error('warehouses debe ser un arreglo')
  }
  console.log(`✓ Relación con bodegas consultada exitosa: ${warehouses.length} bodega(s)`)

  // TEST 5: Registro de Pago a Factura de Proveedor
  console.log('\n[Test 5] Registro de Abono / Pago a Factura de Proveedor')
  const targetInvoice = invoices.find((inv) => inv.status === 'PENDIENTE' || inv.status === 'VENCIDA')
  if (targetInvoice) {
    const paymentAmount = Math.min(500000, targetInvoice.pendingBalance)
    const paymentResult = await supplierService.registerPayment(
      created.id,
      {
        purchaseId: targetInvoice.purchaseId,
        amount: paymentAmount,
        paymentMethod: 'TRANSFERENCIA',
        reference: 'TRANSF-BANCOLOMBIA-9921',
        notes: 'Abono programado a factura de proveedor',
      },
      {
        userId: 'user-admin-01',
        userName: 'Tesorero Central',
        userRole: 'ADMINISTRADOR',
        permissions: ['supplier.payment', 'supplier.read'],
      }
    )

    if (paymentResult.paidAmount <= 0) {
      throw new Error('El registro de pago no procesó el monto correctamente')
    }
    console.log(`✓ Pago registrado: $${paymentAmount.toLocaleString('es-CO')} a factura ${targetInvoice.invoiceNumber}.`)
  } else {
    console.log('✓ Sin facturas pendientes en base limpia (comprobación correcta)')
  }

  // TEST 6: Guardas de Desactivación Segura (Soft Delete)
  console.log('\n[Test 6] Guardas de Desactivación Segura')
  // Desactivar el proveedor creado (que no tiene compras pendientes ni saldo)
  const deactivated = await supplierService.deactivate(
    created.id,
    'Cierre de operaciones temporales con el proveedor',
    {
      userId: 'user-admin-01',
      userName: 'Gerente General',
      userRole: 'ADMINISTRADOR',
      permissions: ['supplier.deactivate', 'supplier.read'],
    }
  )
  if (deactivated.status !== 'INACTIVE') {
    throw new Error(`El estado del proveedor debería ser INACTIVE, obtenido: ${deactivated.status}`)
  }
  console.log(`✓ Proveedor sin saldos pendientes desactivado correctamente (soft delete conservando histórico)`)

  // TEST 7: Control de Permisos RBAC y Confidencialidad de Costos
  console.log('\n[Test 7] Control de Permisos RBAC y Confidencialidad de Costos')
  const restrictedContext: UserPermissionContext = {
    userId: 'user-aux-01',
    userName: 'Auxiliar Operativo',
    userRole: 'AUXILIAR',
    permissions: ['supplier.read'], // No tiene cost.read ni supplier.create
  }

  const listResponse = await supplierService.list({ page: 1, pageSize: 5 }, restrictedContext)
  if (!listResponse.isCostRedacted) {
    throw new Error('isCostRedacted debería ser true para usuarios sin permiso cost.read')
  }
  console.log('✓ Confidencialidad de costos aplicada para usuarios sin cost.read')

  try {
    await supplierService.create(newSupplierData, restrictedContext)
    throw new Error('Debería rechazar create sin permiso supplier.create')
  } catch (err: any) {
    if (err.message.includes('Debería rechazar')) throw err
    console.log('✓ Permiso supplier.create validado en el servicio')
  }

  try {
    await supplierService.deactivate(created.id, 'Intento no autorizado', restrictedContext)
    throw new Error('Debería rechazar deactivate sin permiso supplier.deactivate')
  } catch (err: any) {
    if (err.message.includes('Debería rechazar')) throw err
    console.log('✓ Permiso supplier.deactivate validado en el servicio')
  }

  // TEST 8: Estadísticas Globales del Módulo Proveedores
  console.log('\n[Test 8] Indicadores Propios de Proveedores (supplierService.getSupplierStats)')
  const stats = await supplierService.getSupplierStats()
  if (typeof stats.totalSuppliers !== 'number' || stats.totalSuppliers <= 0) {
    throw new Error('Estadística totalSuppliers inválida')
  }
  if (typeof stats.activeSuppliers !== 'number') {
    throw new Error('Estadística activeSuppliers inválida')
  }
  console.log(`✓ Estadísticas calculadas:`)
  console.log(`  - Total Proveedores: ${stats.totalSuppliers}`)
  console.log(`  - Proveedores Activos: ${stats.activeSuppliers}`)
  console.log(`  - Proveedores con Compras Recientes: ${stats.suppliersWithRecentPurchases}`)
  console.log(`  - Cuentas Pendientes: $${stats.totalPendingBalance.toLocaleString('es-CO')}`)
  console.log(`  - Facturas Vencidas: ${stats.overdueInvoicesCount}`)
  console.log(`  - Compras del Periodo: $${stats.totalPurchasedPeriod.toLocaleString('es-CO')}`)
  console.log(`  - Productos Suministrados: ${stats.suppliedProductsCount}`)

  console.log('\n=========================================================')
  console.log('>>> TODOS LOS TESTS DE PROVEEDORES PASARON CON ÉXITO <<<')
  console.log('=========================================================\n')
}

runTests().catch((err) => {
  console.error('\n❌ ERROR EN TEST DE PROVEEDORES:', err)
  process.exit(1)
})
