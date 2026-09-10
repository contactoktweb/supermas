import { purchaseService } from '../services/purchase.service'
import { purchaseCalculationService } from '../services/purchase-calculation.service'
import { costService } from '../services/cost.service'
import { db } from '@/lib/supabase'
import { UserPermissionContext } from '../types'

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

  // TEST 3: Creación de Compra y Estado Inicial
  console.log('\n[Test 3] Creación de Compra a Proveedor')
  const newPurchase = await purchaseService.createPurchase({
    supplierId: 'sup-001',
    supplierInvoiceNumber: 'FAC-TEST-001',
    destinationLocationId: 'loc-001',
    date: '2026-09-10',
    paymentType: 'CREDITO',
    dueDate: '2026-10-10',
    notes: 'Compra de prueba automatizada',
    items: [
      {
        productId: 'prod-001',
        productName: 'Arroz Diana Premium Extra 5kg',
        sku: 'ABA-ARR-001',
        unitOfMeasure: 'PAQ',
        quantity: 20,
        unitCost: 15000,
        discountPercent: 0,
        taxCode: 'EXENTO',
        taxRatePercent: 0,
      },
    ],
  })

  if (!newPurchase.purchaseNumber.startsWith('COM-')) {
    throw new Error(`Código de compra inválido: ${newPurchase.purchaseNumber}`)
  }
  if (newPurchase.status !== 'PENDING_RECEPTION') {
    throw new Error(`Estado inicial incorrecto: ${newPurchase.status}`)
  }
  if (newPurchase.pendingBalance !== 300000) {
    throw new Error(`Saldo pendiente incorrecto: ${newPurchase.pendingBalance}`)
  }
  console.log(`✓ Compra ${newPurchase.purchaseNumber} creada con saldo $${newPurchase.pendingBalance}`)

  // TEST 4: Recepción Física e Invariante de Kardex
  console.log('\n[Test 4] Recepción Física en Bodega y Movimiento de Kardex')
  const movementsBefore = db.inventoryMovements.length
  const receivedPurchase = await purchaseService.receivePurchase(
    newPurchase.id,
    'Mercancía verificada en muelle de descargue'
  )

  if (receivedPurchase.status !== 'PAYMENT_PENDING') {
    throw new Error(
      `Estado después de recibir compra a crédito debería ser PAYMENT_PENDING, obtenido: ${receivedPurchase.status}`
    )
  }
  if (db.inventoryMovements.length <= movementsBefore) {
    throw new Error('No se generó el movimiento de Kardex en inventory_movements.json')
  }

  const latestMovement = (db.inventoryMovements as any[])[0]
  if (latestMovement.type !== 'COMPRA' && latestMovement.movementType !== 'COMPRA') {
    throw new Error(`Tipo de movimiento en Kardex debería ser COMPRA, obtenido: ${latestMovement.type || latestMovement.movementType}`)
  }
  if (latestMovement.documentRef !== receivedPurchase.purchaseNumber && latestMovement.sourceDocumentNumber !== receivedPurchase.supplierInvoiceNumber) {
    throw new Error(`Documento origen en Kardex incorrecto: ${latestMovement.documentRef}`)
  }
  console.log(`✓ Recepción física confirmada. Movimiento Kardex generado: ${latestMovement.id} (Tipo: ${latestMovement.movementType || latestMovement.type})`)

  // TEST 5: Registro de Pago y Actualización de Saldo Pendiente
  console.log('\n[Test 5] Registro de Abonos y Liquidación de Factura')
  const partialPayment = await purchaseService.registerPayment({
    purchaseId: receivedPurchase.id,
    amount: 100000,
    paymentMethod: 'TRANSFERENCIA',
    reference: 'TRANSF-BANC-00192',
    notes: 'Abono parcial inicial',
  })

  if (partialPayment.pendingBalance !== 200000) {
    throw new Error(`Saldo pendiente tras abono parcial incorrecto: ${partialPayment.pendingBalance}`)
  }
  if (partialPayment.status !== 'PAYMENT_PENDING') {
    throw new Error(`Estado debería continuar en PAYMENT_PENDING tras abono parcial`)
  }
  console.log(`✓ Abono parcial aplicado. Nuevo saldo: $${partialPayment.pendingBalance}`)

  // Pago restante para liquidar totalmente
  const finalPayment = await purchaseService.registerPayment({
    purchaseId: receivedPurchase.id,
    amount: 200000,
    paymentMethod: 'TRANSFERENCIA',
    reference: 'TRANSF-BANC-00193',
    notes: 'Pago final total',
  })

  if (finalPayment.pendingBalance !== 0) {
    throw new Error(`Saldo debería ser 0 tras pago total, obtenido: ${finalPayment.pendingBalance}`)
  }
  if (finalPayment.status !== 'PAID') {
    throw new Error(`Estado debería ser PAID tras liquidar saldo, obtenido: ${finalPayment.status}`)
  }
  console.log(`✓ Factura liquidada totalmente. Estado final: ${finalPayment.status}`)

  // TEST 6: Control de Permisos RBAC y Confidencialidad de Costos
  console.log('\n[Test 6] Control de Permisos RBAC y Ocultación de Costos')
  const restrictedContext: UserPermissionContext = {
    userId: 'user-aux-01',
    userName: 'Auxiliar Operativo',
    userRole: 'AUXILIAR',
    permissions: ['purchase.read'], // No tiene cost.read ni purchase.create
  }

  const listResponse = await purchaseService.list({ page: 1, pageSize: 5 }, restrictedContext)
  if (!listResponse.isCostRedacted) {
    throw new Error('isCostRedacted debería ser true para usuarios sin cost.read')
  }

  try {
    await purchaseService.createPurchase(
      {
        supplierId: 'sup-001',
        supplierInvoiceNumber: 'FAC-FAIL',
        destinationLocationId: 'loc-001',
        date: '2026-09-10',
        paymentType: 'CONTADO',
        items: [],
      },
      restrictedContext
    )
    throw new Error('Debería rechazar createPurchase sin permiso purchase.create')
  } catch (err: any) {
    if (err.message.includes('Debería rechazar')) throw err
    console.log('✓ Permiso purchase.create validado en el servicio')
  }

  // TEST 7: Guardas de Anulación
  console.log('\n[Test 7] Guardas de Anulación y Auditoría')
  try {
    // Intentar anular una compra ya recibida y pagada
    await purchaseService.cancelPurchase(receivedPurchase.id, 'Intento de anulación indebida')
    throw new Error('No debe permitir anular una compra que ya fue recibida en inventario')
  } catch (err: any) {
    if (err.message.includes('No debe permitir')) throw err
    console.log('✓ Anulación bloqueada para compra con inventario recibido')
  }

  console.log('\n======================================================')
  console.log('>>> TODOS LOS TESTS DE COMPRAS PASARON EXITOSAMENTE <<<')
  console.log('======================================================\n')
}

runTests().catch((err) => {
  console.error('\n❌ ERROR EN TEST DE COMPRAS:', err)
  process.exit(1)
})
