import assert from 'node:assert'
import { warehouseFormSchema, createTransferSchema } from '../schemas/warehouse.schema'
import { WarehouseService } from '../services/warehouse.service'

// Unit test suite for critical business rules in Warehouses module
async function runTests() {
  console.log('--- RUNNING WAREHOUSE BUSINESS LOGIC TESTS ---')
  const service = new WarehouseService()

  // 1. Zod Schema: Code Normalization and Validation
  console.log('Test 1: Code normalization to uppercase and hyphenation')
  const validParsed = warehouseFormSchema.parse({
    name: 'Bodega Occidente',
    code: 'bod 009',
    type: 'WAREHOUSE',
    status: 'ACTIVE',
    address: 'Calle 10 # 20-30',
    city: 'Medellín',
    department: 'Antioquia',
    settings: {
      allowInventoryOperations: true,
      allowSales: true,
      allowPurchases: true,
      allowTransfers: true,
      isStorePoint: false,
      isEcommerceProcessingSource: false,
      lowStockAlertThresholdPercent: 15,
      autoBlockOnZeroStock: false,
    },
  })
  assert.strictEqual(validParsed.code, 'BOD-009', 'Code must be uppercase and hyphenated')
  console.log('✓ Code normalization passed')

  // 2. Transfer Schema: Origin and Destination must not be equal
  console.log('Test 2: Transfer schema prevents same origin and destination')
  assert.throws(() => {
    createTransferSchema.parse({
      originLocationId: 'loc-001',
      destinationLocationId: 'loc-001',
      items: [{ productId: 'prod-001', units: 10 }],
    })
  }, /origen y destino no pueden ser la misma/)
  console.log('✓ Transfer validation passed')

  // 3. Cost Privacy: Users without permission should receive redacted cost
  console.log('Test 3: Permission-based cost privacy redaction')
  const sellerList = await service.listWarehouses({}, 'SELLER')
  sellerList.data.forEach((loc) => {
    assert.strictEqual(
      loc.inventoryValueAtCost,
      0,
      'Seller role must NOT receive real inventory cost value'
    )
    assert.strictEqual(
      loc.estimatedProfit,
      0,
      'Seller role must NOT receive estimated profit'
    )
  })

  const adminList = await service.listWarehouses({}, 'SUPERADMIN')
  const principalWh = adminList.data.find((l) => l.code === 'BOD-001')
  assert(
    principalWh && principalWh.inventoryValueAtCost > 0,
    'Superadmin MUST receive real inventory cost'
  )
  console.log('✓ Cost privacy enforcement passed')

  // 4. Safe Deactivation Blocking Checks
  console.log('Test 4: Safe deactivation validation blocks on pending transfers or open cash registers')
  const deactCheck = await service.validateDeactivation('loc-001')
  // loc-001 has 3 pending transfers in mock
  assert.strictEqual(
    deactCheck.canDeactivate,
    false,
    'Warehouse with pending transfers must NOT be deactivatable directly'
  )
  assert(
    deactCheck.blockingReasons.length > 0,
    'Must provide explicit blocking reasons'
  )
  console.log('✓ Safe deactivation blocking passed')

  // 5. Kardex Inmutable Adjustment
  console.log('Test 5: Stock adjustment creates Kardex movement and updates stock level')
  const adjustResult = await service.adjustStock(
    {
      locationId: 'loc-001',
      productId: 'prod-001',
      type: 'AJUSTE_POSITIVO',
      quantity: 20,
      reason: 'CONTEO_FISICO',
      documentRef: 'AUD-TEST-01',
      notes: 'Ajuste de prueba por auditoría física',
    },
    { id: 'usr-admin', name: 'Tester' }
  )

  assert.strictEqual(
    adjustResult.movement.type,
    'AJUSTE_POSITIVO',
    'Movement must record AJUSTE_POSITIVO'
  )
  assert.strictEqual(
    adjustResult.movement.quantityIn,
    20,
    'Movement quantityIn must match'
  )
  assert(
    adjustResult.updatedItem.currentStock >= 20,
    'Inventory item stock must be updated'
  )
  console.log('✓ Kardex ledger creation passed')

  // 6. Negative Adjustment Block when exceeding balance
  console.log('Test 6: Negative adjustment exceeding balance is blocked')
  await assert.rejects(
    async () => {
      await service.adjustStock(
        {
          locationId: 'loc-001',
          productId: 'prod-001',
          type: 'AJUSTE_NEGATIVO',
          quantity: 999999,
          reason: 'MERMA_ROTURA',
          notes: 'Intento de ajuste excesivo',
        },
        { id: 'usr-admin', name: 'Tester' }
      )
    },
    /No puedes realizar un ajuste negativo/
  )
  console.log('✓ Negative stock prevention passed')

  console.log('\n======================================')
  console.log('ALL WAREHOUSE BUSINESS LOGIC TESTS PASSED!')
  console.log('======================================\n')
}

runTests().catch((err) => {
  console.error('Test failure:', err)
  process.exit(1)
})
