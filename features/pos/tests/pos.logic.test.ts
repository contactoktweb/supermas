import { posService } from '../services/pos.service'
import { posRepository } from '../repositories/pos.repository'
import { POSUserContext, POSCartItem, POSCustomer } from '../types'
import { db } from '@/lib/supabase'

async function runPOSTests() {
  console.log('🧪 Iniciando pruebas unitarias y de integración para Módulo POS...\n')

  let passed = 0
  let failed = 0

  const assert = (condition: boolean, testName: string, extraInfo?: string) => {
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`)
      passed++
    } else {
      console.error(`  ❌ FAIL: ${testName} ${extraInfo ? `-> ${extraInfo}` : ''}`)
      failed++
    }
  }

  const cashierContext: POSUserContext = {
    userId: 'usr-cajero-01',
    userName: 'Cajero Centro',
    userRole: 'Cajero Operativo',
    locationId: 'loc-003', // Punto de Venta Centro
    locationName: 'Punto de Venta Centro',
    cashRegisterNumber: 'CAJA-01',
    permissions: [
      'pos.access',
      'pos.create_sale',
      'pos.discount',
      'pos.view_history',
    ],
  }

  // TEST 1: Data Isolation & Sanitization (No acquisition costs or profit margins in POS view)
  console.log('--- Test 1: Seguridad & Aislamiento de Datos Sensibles ---')
  const products = await posService.getProducts('loc-003', '', 'ALL', cashierContext)
  assert(products.length > 0, 'Se obtienen productos para el punto de venta')
  
  const sample = products[0] as any
  assert(sample.averageCost === undefined, 'El producto POS NO contiene averageCost (costo promedio oculto)')
  assert(sample.profitMarginPercent === undefined, 'El producto POS NO contiene margen de ganancia porcentual')
  assert(sample.supplierId === undefined, 'El producto POS NO contiene referencias a proveedores')
  assert(typeof sample.normalPrice === 'number' && sample.normalPrice > 0, 'El producto contiene precio de venta normal válido')

  // TEST 2: Barcode Scan Lookup
  console.log('\n--- Test 2: Búsqueda y Escaneo de Código de Barras ---')
  const firstProductWithBarcode = db.products.find((p) => p.barcode && p.status === 'ACTIVE')
  if (firstProductWithBarcode) {
    const scanned = await posService.scanBarcode(firstProductWithBarcode.barcode, 'loc-003', cashierContext)
    assert(scanned !== null, `Escaneo por código de barras "${firstProductWithBarcode.barcode}" encuentra el producto`)
    assert(scanned?.id === firstProductWithBarcode.id, 'El ID del producto escaneado coincide con el catálogo')
  }

  // TEST 3: Pricing Resolution (Normal vs Wholesale)
  console.log('\n--- Test 3: Resolución de Listas de Precios (Normal vs Mayorista) ---')
  const retailCustomer: POSCustomer = {
    id: 'cust-retail',
    displayName: 'Consumidor Final',
    documentType: 'CC',
    documentNumber: '222222222222',
    phone: '',
    priceList: 'DEFAULT',
    creditLimit: 0,
    currentBalance: 0,
  }

  const wholesaleCustomer: POSCustomer = {
    id: 'cust-wholesale',
    displayName: 'Supermercado El Ahorro',
    documentType: 'NIT',
    documentNumber: '900123456-1',
    phone: '3001234567',
    priceList: 'WHOLESALE',
    creditLimit: 5000000,
    currentBalance: 0,
  }

  const testProduct = products.find((p) => p.wholesalePrice && p.wholesalePrice < p.normalPrice) || products[0]
  const retailPrice = posService.resolveUnitPrice(testProduct, retailCustomer)
  const wholesalePrice = posService.resolveUnitPrice(testProduct, wholesaleCustomer)

  assert(retailPrice === testProduct.normalPrice, `Precio para Consumidor Final es precio normal ($${retailPrice})`)
  if (testProduct.wholesalePrice) {
    assert(wholesalePrice === testProduct.wholesalePrice, `Precio para Mayorista aplica lista Mayorista ($${wholesalePrice})`)
    assert(wholesalePrice <= retailPrice, 'El precio mayorista es menor o igual al precio normal')
  }

  // TEST 4: Stock Validation & Overselling Prevention
  console.log('\n--- Test 4: Control de Stock y Prevención de Venta Sin Existencia ---')
  const inStockProduct = products.find((p) => p.availableStock > 0)
  if (inStockProduct) {
    const validCheck = posService.validateStockAvailability(inStockProduct, 1)
    assert(validCheck.allowed === true, `Permite vender 1 unidad cuando hay ${inStockProduct.availableStock} disponibles`)

    const invalidCheck = posService.validateStockAvailability(inStockProduct, inStockProduct.availableStock + 100)
    assert(invalidCheck.allowed === false, 'Bloquea venta si la cantidad excede el stock disponible')
    assert(invalidCheck.message === 'Existencia insuficiente.', 'Mensaje de error es seguro ("Existencia insuficiente.")')
  }

  // TEST 5: Totals, Discounts & Change Calculation
  console.log('\n--- Test 5: Cálculo de Totals, Descuentos y Cambio en Efectivo ---')
  const mockCartItem: POSCartItem = {
    id: 'cart-1',
    productId: testProduct.id,
    productName: testProduct.name,
    sku: testProduct.sku,
    barcode: testProduct.barcode,
    unitOfMeasure: testProduct.unitOfMeasure,
    imageUrl: testProduct.imageUrl || '',
    quantity: 2,
    unitPrice: 10000,
    discountPercent: 10, // 10%
    discountAmount: 2000,
    taxRatePercent: 19,
    taxAmount: 3420, // 18000 * 0.19
    subtotal: 18000,
    total: 21420,
    availableStock: 50,
  }

  const totals = posService.calculateTotals([mockCartItem])
  assert(totals.totalUnits === 2, 'Contador de unidades en carrito es 2')
  assert(totals.subtotal === 18000, 'Subtotal con descuento aplicado es $18.000')
  assert(totals.discountTotal === 2000, 'Monto de descuento es $2.000')
  assert(totals.totalAmount === 21420, 'Total a pagar con IVA es $21.420')

  const changeCalc = posService.calculateChange(21420, 50000)
  assert(changeCalc.isValid === true, 'Pago de $50.000 para total $21.420 es válido')
  assert(changeCalc.change === 28580, 'Cambio calculado es $28.580')

  const insufficientChange = posService.calculateChange(21420, 20000)
  assert(insufficientChange.isValid === false, 'Pago de $20.000 es insuficiente')
  assert(insufficientChange.change === 0, 'Cambio para pago insuficiente es 0')

  // TEST 6: Transaction Execution (Sales + Invoices + Kardex Movements + Audit Logs)
  console.log('\n--- Test 6: Transacción de Venta POS (Venta, Factura POS, Movimiento SALE_OUT y Auditoría) ---')
  const initialMovementsCount = db.inventoryMovements.length
  const initialSalesCount = db.sales.length
  const initialAuditCount = db.auditLogs.length

  const genericCustomer = await posService.getGenericCustomer()
  const saleItemProduct = products.find((p) => p.availableStock >= 3) || products[0]

  const receipt = await posService.processSale(
    {
      customerId: genericCustomer.id,
      locationId: cashierContext.locationId,
      paymentMethod: 'EFECTIVO',
      amountPaid: 100000,
      items: [
        {
          productId: saleItemProduct.id,
          quantity: 2,
          discountPercent: 0,
        },
      ],
    },
    cashierContext
  )

  assert(Boolean(receipt.invoiceNumber), `Factura POS emitida: ${receipt.invoiceNumber}`)
  assert(Boolean(receipt.saleNumber), `Venta POS creada: ${receipt.saleNumber}`)
  assert(receipt.cashierName === cashierContext.userName, 'Cajero asignado coincide con el contexto')
  assert(receipt.items.length === 1, 'Recibo contiene el ítem vendido')
  assert(db.sales.length === initialSalesCount + 1, 'Se insertó 1 registro en sales.json')
  assert(db.inventoryMovements.length >= initialMovementsCount + 1, 'Se generó movimiento de inventario en inventory_movements.json')

  const latestMovement = db.inventoryMovements[0]
  assert(latestMovement.type === 'SALE_OUT', 'El tipo de movimiento en el Kardex es estrictamente SALE_OUT')
  assert(latestMovement.productId === saleItemProduct.id, 'El Kardex registra el producto correcto')
  assert(latestMovement.quantityOut === 2, 'El Kardex registra la cantidad salida (2)')
  assert(db.auditLogs.length > initialAuditCount, 'Se registró evento en audit_logs.json')

  // TEST 7: Cashier Shift Daily Sales Filtering
  console.log('\n--- Test 7: Ventas del Día para el Cajero ---')
  const dailySales = await posService.getDailySales(cashierContext.userName, cashierContext.locationId, cashierContext)
  assert(dailySales.length > 0, `Se listan las ventas del cajero ${cashierContext.userName} (${dailySales.length} ventas)`)
  const onlyCurrentCashier = dailySales.every((s) => s.cashierName === cashierContext.userName)
  assert(onlyCurrentCashier === true, 'La vista operativa NO mezcla ventas de otros cajeros')

  // TEST 8: RBAC Permission Guard
  console.log('\n--- Test 8: Seguridad RBAC en POS ---')
  const unauthorizedContext: POSUserContext = {
    userId: 'usr-unauthorized',
    userName: 'Usuario Sin Permiso',
    userRole: 'Visitante',
    locationId: 'loc-003',
    locationName: 'Punto de Venta',
    cashRegisterNumber: 'CAJA-99',
    permissions: [],
  }

  let accessBlocked = false
  try {
    await posService.getProducts('loc-003', '', 'ALL', unauthorizedContext)
  } catch (err: any) {
    accessBlocked = true
  }
  assert(accessBlocked, 'Usuario sin permiso "pos.access" es bloqueado para cargar catálogo')

  console.log(`\n========================================`)
  console.log(`🎉 Resumen de Pruebas POS: ${passed} PASSED, ${failed} FAILED`)
  console.log(`========================================\n`)

  if (failed > 0) {
    process.exit(1)
  }
}

runPOSTests().catch((err) => {
  console.error('Error durante ejecución de tests POS:', err)
  process.exit(1)
})
