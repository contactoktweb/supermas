import { purchaseCalculationService } from '../services/purchase-calculation.service'
import { costService } from '../services/cost.service'
import { createPurchaseSchema, updatePurchaseSchema, purchaseItemInputSchema } from '../schemas/purchase.schema'

console.log('--- EJECUTANDO TESTS DE LÓGICA DE NEGOCIO - MÓDULO COMPRAS ---')

async function runTests() {
  // TEST 1: Cálculos Tributarios y Líneas de Compra
  console.log('\n[Test 1] Cálculos Tributarios DIAN y Líneas de Compra')
  const lineItem = purchaseCalculationService.calculateLineItem({
    productId: 'prod-001',
    productName: 'Arroz Diana',
    sku: 'ABA-ARR-001',
    unitOfMeasure: 'PAQ',
    quantity: 100,
    unitCost: 10000,
    discountPercent: 10, // 10% de descuento -> Base = 900.000
    taxCode: 'IVA_19',
    taxRatePercent: 19,  // IVA 19% de 900.000 = 171.000
  })

  if (lineItem.subtotal !== 1000000) {
    throw new Error(`Subtotal incorrecto. Esperado: 1.000.000, Obtenido: ${lineItem.subtotal}`)
  }
  if (lineItem.discountAmount !== 100000) {
    throw new Error(`Descuento incorrecto. Esperado: 100.000, Obtenido: ${lineItem.discountAmount}`)
  }
  if (lineItem.taxAmount !== 171000) {
    throw new Error(`IVA incorrecto. Esperado: 171.000, Obtenido: ${lineItem.taxAmount}`)
  }
  if (lineItem.total !== 1071000) {
    throw new Error(`Total de línea incorrecto. Esperado: 1.071.000, Obtenido: ${lineItem.total}`)
  }
  console.log('✓ Línea de compra calculada correctamente con descuentos e IVA DIAN')

  // TEST 2: Cálculo de Costo Promedio Ponderado
  console.log('\n[Test 2] Costo Promedio Ponderado en costService')
  // 100 unidades actuales a $10.000 c/u + 100 unidades nuevas a $12.000 c/u
  // Total = (100 * 10.000 + 100 * 12.000) / 200 = 2.200.000 / 200 = $11.000
  const nuevoCosto = costService.calculateWeightedAverageCost(100, 10000, 100, 12000)
  if (nuevoCosto !== 11000) {
    throw new Error(`Costo promedio incorrecto. Esperado: 11.000, Obtenido: ${nuevoCosto}`)
  }
  console.log('✓ Fórmula de Costo Promedio Ponderado verificada matemáticamente')

  // TEST 3: Totales Consolidados y Desglose Tributario Multi-tarifa
  console.log('\n[Test 3] Totales Consolidados y Desglose Tributario Multi-tarifa')
  const lineItem2 = purchaseCalculationService.calculateLineItem({
    productId: 'prod-002',
    productName: 'Aceite Vegetal 1L',
    sku: 'ABA-ACE-002',
    unitOfMeasure: 'UND',
    quantity: 50,
    unitCost: 8000,
    discountPercent: 5, // subtotal = 400.000, desc = 20.000, base = 380.000
    taxCode: 'IVA_5',
    taxRatePercent: 5,  // IVA 5% de 380.000 = 19.000
  })

  const totals = purchaseCalculationService.calculateTotals([lineItem, lineItem2])
  if (totals.subtotal !== 1400000) {
    throw new Error(`Subtotal consolidado incorrecto. Esperado: 1.400.000, Obtenido: ${totals.subtotal}`)
  }
  if (totals.discountTotal !== 120000) {
    throw new Error(`Descuento total incorrecto. Esperado: 120.000, Obtenido: ${totals.discountTotal}`)
  }
  if (totals.taxTotal !== 190000) {
    throw new Error(`Impuestos totales incorrectos. Esperado: 190.000, Obtenido: ${totals.taxTotal}`)
  }
  if (totals.total !== 1470000) {
    throw new Error(`Total consolidado incorrecto. Esperado: 1.470.000, Obtenido: ${totals.total}`)
  }
  console.log('✓ Totales consolidados y desglose multi-tarifa DIAN correctos')

  // TEST 4: Validación Zod de Creación y Edición de Compras
  console.log('\n[Test 4] Validación Zod de Esquemas de Compra')
  const validPayload = {
    supplierId: '00000000-0000-0000-0000-000000000001',
    destinationLocationId: '00000000-0000-0000-0000-000000000002',
    supplierInvoiceNumber: 'FAC-12345',
    date: '2026-10-02',
    paymentType: 'CREDITO' as const,
    dueDate: '2026-11-02',
    notes: 'Compra de prueba',
    saveAsDraft: false,
    items: [
      {
        productId: '00000000-0000-0000-0000-000000000003',
        productName: 'Producto Test',
        sku: 'TEST-SKU',
        quantity: 10,
        unitCost: 5000,
        discountPercent: 0,
        taxCode: 'IVA_19',
        taxRatePercent: 19,
      },
    ],
  }

  createPurchaseSchema.parse(validPayload)
  updatePurchaseSchema.parse(validPayload)
  console.log('✓ Esquemas createPurchaseSchema y updatePurchaseSchema validados')

  // TEST 5: Bloqueo de Datos Inválidos en Esquemas
  console.log('\n[Test 5] Bloqueo de Datos Inválidos (Zod Guard)')
  try {
    purchaseItemInputSchema.parse({
      productId: 'p1',
      productName: 'P',
      sku: 'SKU',
      quantity: -5,
      unitCost: 1000,
    })
    throw new Error('Debería rechazar cantidad negativa')
  } catch (err: any) {
    if (err.message.includes('Debería rechazar')) throw err
    console.log('✓ Cantidad <= 0 rechazada correctamente por Zod')
  }

  try {
    purchaseItemInputSchema.parse({
      productId: 'p1',
      productName: 'P',
      sku: 'SKU',
      quantity: 10,
      unitCost: -500,
    })
    throw new Error('Debería rechazar costo unitario negativo')
  } catch (err: any) {
    if (err.message.includes('Debería rechazar')) throw err
    console.log('✓ Costo negativo rechazado correctamente por Zod')
  }

  try {
    createPurchaseSchema.parse({
      ...validPayload,
      items: [],
    })
    throw new Error('Debería rechazar compra sin líneas')
  } catch (err: any) {
    if (err.message.includes('Debería rechazar')) throw err
    console.log('✓ Compra sin líneas rechazada correctamente')
  }

  console.log('\n======================================================')
  console.log('>>> TODOS LOS TESTS DE COMPRAS PASARON EXITOSAMENTE <<<')
  console.log('======================================================\n')
}

runTests().catch((err) => {
  console.error('\n❌ ERROR EN TEST DE COMPRAS:', err)
  process.exit(1)
})
