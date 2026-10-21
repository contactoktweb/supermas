/**
 * Pruebas de lógica del módulo Ventas que no requieren base de datos:
 * vista previa de cálculo, validación del formulario y control de permisos.
 * La creación real (precios, IVA, stock, pagos, caja, cartera y asiento) la valida el servidor:
 * ver la prueba SQL de la migración 073 (fn_create_sale_with_payments).
 *
 * Ejecutar: npx tsx features/sales/tests/sales.logic.test.ts
 */
import { salesService } from '../services/sales.service'
import { salesCalculationService } from '../services/sales-calculation.service'
import { createSaleSchema, MAX_SALE_DISCOUNT_PERCENT } from '../schemas/sales.schema'
import { SalesUserContext } from '../types'

async function runSalesTests() {
  console.log('Pruebas de lógica del Módulo Ventas')
  let passed = 0
  let failed = 0

  const assert = (condition: boolean, testName: string) => {
    if (condition) {
      console.log(`  PASS: ${testName}`)
      passed++
    } else {
      console.error(`  FAIL: ${testName}`)
      failed++
    }
  }

  const assertThrowsAsync = async (fn: () => Promise<unknown>, testName: string) => {
    try {
      await fn()
      console.error(`  FAIL: ${testName} (se esperaba un error)`)
      failed++
    } catch (e: unknown) {
      console.log(`  PASS: ${testName} -> ${e instanceof Error ? e.message : String(e)}`)
      passed++
    }
  }

  // 1. Vista previa: precios, descuentos e IVA con redondeo a centavos (igual que el servidor)
  console.log('\n1. Vista previa de cálculo')
  const exemptProduct = {
    id: 'prod-001',
    name: 'Arroz Diana Premium Extra 5kg',
    sku: 'ABA-ARR-001',
    normalPrice: 21500,
    wholesalePrice: 18900,
    averageCost: 15400,
    isExempt: true,
    vatRatePercent: 0,
  }
  assert(salesCalculationService.resolveUnitPrice(exemptProduct, 'DEFAULT', 1) === 21500, 'Precio normal')
  assert(salesCalculationService.resolveUnitPrice(exemptProduct, 'WHOLESALE', 1) === 18900, 'Precio mayorista')

  const exemptLine = salesCalculationService.calculateLineItem(
    exemptProduct,
    { productId: 'prod-001', quantity: 10, discountPercent: 5 },
    'WHOLESALE'
  )
  assert(exemptLine.discountAmount === 9450, 'Descuento 5 % = 9.450')
  assert(exemptLine.subtotal === 179550 && exemptLine.total === 179550, 'Exento: total sin IVA')

  const taxedLine = salesCalculationService.calculateLineItem(
    { id: 'prod-002', name: 'Atún', sku: 'ATU-001', normalPrice: 10000, vatRatePercent: 19 },
    { productId: 'prod-002', quantity: 1, discountPercent: 10 }
  )
  assert(taxedLine.subtotal === 9000 && taxedLine.taxAmount === 1710 && taxedLine.total === 10710, 'Gravado 19 % con descuento 10 % = 10.710')

  // 2. Formulario: clave de idempotencia y tope de descuento
  console.log('\n2. Validación del formulario')
  const baseDto = {
    customerId: 'cust-001',
    locationId: 'loc-001',
    paymentMethod: 'EFECTIVO' as const,
    items: [{ productId: 'prod-001', quantity: 1 }],
  }
  assert(!createSaleSchema.safeParse(baseDto).success, 'Rechaza la venta sin clave de idempotencia')
  const key = '0b9d2f63-6f0e-4a0c-9d5c-3f1c1a2b7e10'
  assert(createSaleSchema.safeParse({ ...baseDto, idempotencyKey: key }).success, 'Acepta la venta con clave válida')
  assert(
    !createSaleSchema.safeParse({
      ...baseDto,
      idempotencyKey: key,
      items: [{ productId: 'prod-001', quantity: 1, discountPercent: MAX_SALE_DISCOUNT_PERCENT + 1 }],
    }).success,
    `Rechaza descuentos mayores al ${MAX_SALE_DISCOUNT_PERCENT} %`
  )

  // 3. Permisos: sin sales.create no se intenta registrar la venta
  console.log('\n3. Control de permisos')
  const restrictedUser: SalesUserContext = {
    userId: 'usr-guest',
    userName: 'Usuario Sin Permisos',
    maxAllowedDiscountPercent: 0,
    permissions: [],
  }
  await assertThrowsAsync(
    () => salesService.create({ ...baseDto, idempotencyKey: key }, restrictedUser),
    'Bloquea la creación sin el permiso [sales.create]'
  )
  await assertThrowsAsync(
    () => salesService.cancelSale({ saleId: 'sale-001', reason: 'Intento no autorizado' }, restrictedUser),
    'Bloquea la anulación sin el permiso [sales.cancel]'
  )

  console.log(`\nResumen: ${passed} pasadas | ${failed} fallidas\n`)
  if (failed > 0) {
    process.exit(1)
  }
}

runSalesTests().catch((err) => {
  console.error('Error fatal durante la ejecución de pruebas:', err)
  process.exit(1)
})
