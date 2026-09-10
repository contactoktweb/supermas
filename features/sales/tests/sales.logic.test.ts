import { salesService } from '../services/sales.service'
import { salesCalculationService } from '../services/sales-calculation.service'
import { salesRepository } from '../repositories/sales.repository'
import { SalesUserContext } from '../types'
import { db } from '@/lib/supabase'

async function runSalesTests() {
  console.log('🚀 Iniciando pruebas automatizadas del Módulo Ventas...')
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

  // 1. Servicio de Cálculo de Precios, Impuestos y Descuentos
  console.log('\n🧮 Test 1: Servicio de Cálculo (Precios, Impuestos y Márgenes)...')
  const mockProduct = {
    id: 'prod-001',
    name: 'Arroz Diana Premium Extra 5kg',
    sku: 'ABA-ARR-001',
    normalPrice: 21500,
    wholesalePrice: 18900,
    distributorPrice: 17800,
    averageCost: 15400,
    isExempt: true,
    vatRatePercent: 0,
  }

  const defaultPrice = salesCalculationService.resolveUnitPrice(mockProduct as any, 'DEFAULT', 1)
  assert(defaultPrice === 21500, 'Precio Normal resuelto correctamente ($21,500)')

  const wholesalePrice = salesCalculationService.resolveUnitPrice(mockProduct as any, 'WHOLESALE', 1)
  assert(wholesalePrice === 18900, 'Precio Mayorista resuelto correctamente ($18,900)')

  const calculatedLine = salesCalculationService.calculateLineItem(
    mockProduct as any,
    { productId: 'prod-001', quantity: 10, discountPercent: 5 },
    'WHOLESALE'
  )
  assert(calculatedLine.unitPrice === 18900, 'Línea de venta con precio mayorista')
  assert(calculatedLine.discountAmount === 9450, 'Descuento 5% calculado: $9,450')
  assert(calculatedLine.subtotal === 179550, 'Subtotal neto calculado: $179,550')
  assert(calculatedLine.total === 179550, 'Total con IVA 0% (Exento) calculado: $179,550')

  // 2. Estadísticas Agregadas de Ventas (KPIs)
  console.log('\n📊 Test 2: Estadísticas de Ventas (KPIs)...')
  const stats = await salesService.getSalesStats()
  assert(stats.periodTotalSales > 0, `Total vendido del periodo > 0 (obtenido: $${stats.periodTotalSales.toLocaleString('es-CO')})`)
  assert(stats.periodSalesCount >= 5, `Total de ventas >= 5 (obtenido: ${stats.periodSalesCount})`)
  assert(stats.averageTicket > 0, `Ticket promedio calculado: $${stats.averageTicket.toLocaleString('es-CO')}`)
  assert(stats.totalUnitsSold > 0, `Unidades vendidas: ${stats.totalUnitsSold}`)
  assert(stats.uniqueCustomersServed > 0, `Clientes únicos atendidos: ${stats.uniqueCustomersServed}`)
  assert(stats.cancelledSalesCount >= 1, `Ventas anuladas contabilizadas: ${stats.cancelledSalesCount}`)

  // 3. Listado con Filtros y Paginación
  console.log('\n🔍 Test 3: Listado y Filtros...')
  const listAll = await salesService.list({ page: 1, pageSize: 10 })
  assert(listAll.items.length > 0, `Listado retorna ${listAll.items.length} ventas`)
  assert(listAll.total >= 7, `Total general de ventas es ${listAll.total}`)

  // Filtro por estado
  const listInvoiced = await salesService.list({ status: 'INVOICED' })
  assert(listInvoiced.items.every((s) => s.status === 'INVOICED'), 'Filtro por estado INVOICED funciona')

  // Filtro por método de pago
  const listCredit = await salesService.list({ paymentMethod: 'CREDITO' })
  assert(listCredit.items.every((s) => s.paymentMethod === 'CREDITO'), 'Filtro por pago CREDITO funciona')

  // Filtro por documento
  const listFE = await salesService.list({ documentType: 'FACTURA_ELECTRONICA' })
  assert(listFE.items.every((s) => s.documentType === 'FACTURA_ELECTRONICA'), 'Filtro por Factura Electrónica funciona')

  // 4. Detalle Relacional Completo
  console.log('\n🔗 Test 4: Detalle Relacional (Customer, Invoice, Remission, Kardex, Audit)...')
  const detail = await salesService.getById('sale-001')
  assert(detail.id === 'sale-001', 'Detalle de venta cargado por ID')
  assert(Boolean(detail.customer?.displayName), `Cliente relacional cargado: ${detail.customer?.displayName}`)
  assert(Boolean(detail.invoice?.invoiceNumber), `Factura asociada cargada: ${detail.invoice?.invoiceNumber}`)
  assert(Boolean(detail.remission?.remissionNumber), `Remisión asociada cargada: ${detail.remission?.remissionNumber}`)
  assert(Array.isArray(detail.items) && detail.items.length > 0, `Ítems de venta presentes (${detail.items.length} líneas)`)

  // 5. Creación de Venta con Validación de Stock y Movimientos Kardex
  console.log('\n➕ Test 5: Creación de Venta & Kardex...')
  const initialMovementsCount = db.inventoryMovements.length

  const createdSale = await salesService.create({
    customerId: 'cust-001',
    locationId: 'loc-001',
    paymentMethod: 'EFECTIVO',
    documentTypeToGenerate: 'FACTURA_POS',
    notes: 'Venta de prueba automatizada',
    items: [
      {
        productId: 'prod-001',
        quantity: 5,
        discountPercent: 0,
      },
    ],
  })

  assert(Boolean(createdSale.saleNumber), `Venta creada exitosamente: ${createdSale.saleNumber}`)
  assert(createdSale.status === 'INVOICED', 'Venta registrada con estado INVOICED por emisión de Factura POS')
  assert(Boolean(createdSale.invoiceNumber), `Factura POS generada automáticamente: ${createdSale.invoiceNumber}`)
  assert(db.inventoryMovements.length > initialMovementsCount, 'Movimiento SALE_OUT registrado en Kardex')

  // 6. Validación de Stock Insuficiente (Protección contra Overselling)
  console.log('\n🛡️ Test 6: Control de Stock Insuficiente...')
  await assertThrowsAsync(async () => {
    await salesService.create({
      customerId: 'cust-001',
      locationId: 'loc-001',
      paymentMethod: 'EFECTIVO',
      items: [
        {
          productId: 'prod-001',
          quantity: 999999, // Excede stock
        },
      ],
    })
  }, 'Bloquea venta si la cantidad solicitada supera el stock disponible en la bodega')

  // 7. Control de Límites de Descuento Autorizado
  console.log('\n💰 Test 7: Límite de Descuentos Autorizados...')
  const userWithLowDiscountLimit: SalesUserContext = {
    userId: 'usr-cajero-01',
    userName: 'Cajero Junior',
    maxAllowedDiscountPercent: 5, // Límite 5%
    permissions: ['sales.create', 'sales.read'],
  }

  await assertThrowsAsync(async () => {
    await salesService.create(
      {
        customerId: 'cust-001',
        locationId: 'loc-001',
        paymentMethod: 'EFECTIVO',
        items: [
          {
            productId: 'prod-001',
            quantity: 2,
            discountPercent: 20, // 20% > 5% permitido
          },
        ],
      },
      userWithLowDiscountLimit
    )
  }, 'Bloquea venta si el descuento aplicado supera el límite del usuario sin permiso sales.discount')

  // 8. Control de Cupo de Crédito
  console.log('\n💳 Test 8: Control de Cupo de Crédito...')
  // Cliente cust-004 tiene creditLimit = 2,000,000
  await assertThrowsAsync(async () => {
    await salesService.create({
      customerId: 'cust-004',
      locationId: 'loc-001',
      paymentMethod: 'CREDITO',
      items: [
        {
          productId: 'prod-001',
          quantity: 150, // 150 * 21,500 = $3,225,000 > $2,000,000
        },
      ],
    })
  }, 'Bloquea venta a crédito si excede el cupo aprobado del cliente')

  // 9. Anulación de Venta con Reversión de Stock en Kardex
  console.log('\n↩️ Test 9: Anulación de Venta & Reversión de Inventario...')
  const movementsBeforeCancel = db.inventoryMovements.length

  const cancelledSale = await salesService.cancelSale({
    saleId: createdSale.id,
    reason: 'Prueba de anulación y reversión de inventario',
  })

  assert(cancelledSale.status === 'CANCELLED', 'Estado de la venta cambiado a CANCELLED')
  assert(cancelledSale.cancellationReason === 'Prueba de anulación y reversión de inventario', 'Motivo de anulación registrado')
  assert(db.inventoryMovements.length > movementsBeforeCancel, 'Movimiento de reversión SALE_RETURN generado en Kardex')

  // Intento de anular dos veces
  await assertThrowsAsync(async () => {
    await salesService.cancelSale({
      saleId: createdSale.id,
      reason: 'Reintento de anulación',
    })
  }, 'Previene anular una venta que ya fue cancelada')

  // 10. Emisión de Factura y Remisión a Venta Existente
  console.log('\n📄 Test 10: Emisión de Documentos Posteriores (Factura & Remisión)...')
  // Venta sale-007 está PENDING sin factura
  const invoicedSale = await salesService.generateInvoiceForSale({
    saleId: 'sale-007',
    type: 'FACTURA_ELECTRONICA',
  })
  assert(Boolean(invoicedSale.invoiceNumber), `Factura Electrónica emitida: ${invoicedSale.invoiceNumber}`)
  assert(invoicedSale.status === 'INVOICED', 'Estado actualizado a INVOICED')

  const remittedSale = await salesService.generateRemissionForSale({
    saleId: 'sale-007',
    driverName: 'Conductor Test',
    deliveredBy: 'Camión Express',
  })
  assert(Boolean(remittedSale.remissionNumber), `Guía de remisión generada: ${remittedSale.remissionNumber}`)

  // 11. Seguridad y Permisos RBAC
  console.log('\n🔒 Test 11: Control de Permisos RBAC...')
  const restrictedUser: SalesUserContext = {
    userId: 'usr-guest',
    userName: 'Usuario Sin Permisos',
    maxAllowedDiscountPercent: 0,
    permissions: [],
  }

  await assertThrowsAsync(async () => {
    await salesService.create(
      {
        customerId: 'cust-001',
        locationId: 'loc-001',
        paymentMethod: 'EFECTIVO',
        items: [{ productId: 'prod-001', quantity: 1 }],
      },
      restrictedUser
    )
  }, 'Bloquea creación cuando falta el permiso [sales.create]')

  await assertThrowsAsync(async () => {
    await salesService.cancelSale(
      {
        saleId: 'sale-001',
        reason: 'Intento no autorizado',
      },
      restrictedUser
    )
  }, 'Bloquea anulación cuando falta el permiso [sales.cancel]')

  console.log(`\n========================================`)
  console.log(`Resumen de Pruebas: ${passed} Pasadas | ${failed} Fallidas`)
  console.log(`========================================\n`)

  if (failed > 0) {
    process.exit(1)
  }
}

runSalesTests().catch((err) => {
  console.error('Error fatal durante la ejecución de pruebas:', err)
  process.exit(1)
})
