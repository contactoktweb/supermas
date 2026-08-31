import assert from 'node:assert'
import { InventoryService } from '../services/inventory.service'
import { InventoryRepository } from '../repositories/inventory.repository'
import { UserPermissionContext } from '../types'

async function runInventoryTests() {
  console.log('--- RUNNING INVENTORY BUSINESS LOGIC TESTS ---')
  const service = new InventoryService()
  const repo = new InventoryRepository()

  const adminCtx: UserPermissionContext = {
    userId: 'usr-admin',
    userRole: 'ADMIN',
    permissions: ['inventory.read', 'inventory.adjust', 'inventory.transfer', 'cost.read'],
  }

  const sellerCtx: UserPermissionContext = {
    userId: 'usr-seller',
    userRole: 'SELLER',
    permissions: ['inventory.read'],
  }

  // Test 1: Consolidated Stock Level Calculation
  console.log('Test 1: Consolidated Stock Level Aggregation')
  const consolidated = await service.getConsolidatedStock({}, adminCtx)
  assert.ok(consolidated.total > 0, 'Must return consolidated products')

  const arroz = consolidated.data.find((p) => p.sku === 'ABA-ARR-001')
  assert.ok(arroz, 'Arroz Diana should exist in consolidated list')
  const expectedTotal = arroz.locationBreakdown.reduce((sum, l) => sum + l.stock, 0)
  assert.strictEqual(
    arroz.totalStock,
    expectedTotal,
    'Consolidated totalStock must equal sum of all warehouse stocks'
  )
  console.log('✓ Consolidated Stock Level Aggregation passed')

  // Test 2: Stock Health Determination Rule
  console.log('Test 2: Stock Health Status Rule (OUT_OF_STOCK, CRITICAL, LOW_STOCK, AVAILABLE)')
  assert.strictEqual(repo.calculateStockHealth(0, 50, 20), 'OUT_OF_STOCK')
  assert.strictEqual(repo.calculateStockHealth(15, 50, 20), 'CRITICAL')
  assert.strictEqual(repo.calculateStockHealth(45, 50, 20), 'LOW_STOCK')
  assert.strictEqual(repo.calculateStockHealth(120, 50, 20), 'AVAILABLE')
  console.log('✓ Stock Health Status Rule passed')

  // Test 3: RBAC Cost Redaction for Unprivileged Users
  console.log('Test 3: RBAC Cost Privacy Protection (cost.read)')
  const sellerKPIs = await service.getKPIs(sellerCtx)
  assert.strictEqual(sellerKPIs.isCostRedacted, true, 'isCostRedacted must be true for seller')
  assert.strictEqual(sellerKPIs.totalValueAtCost, 0, 'Total value at cost must be 0 for seller')

  const adminKPIs = await service.getKPIs(adminCtx)
  assert.strictEqual(adminKPIs.isCostRedacted, false, 'Admin must see cost')
  assert.ok(adminKPIs.totalValueAtCost > 0, 'Admin totalValueAtCost must be greater than 0')

  const sellerStock = await service.getStockLevelsByLocation({}, sellerCtx)
  for (const item of sellerStock.data) {
    assert.strictEqual(item.averageCost, 0, 'averageCost must be redacted for seller')
    assert.strictEqual(item.totalValueAtCost, 0, 'totalValueAtCost must be redacted for seller')
  }
  console.log('✓ RBAC Cost Privacy Protection passed')

  // Test 4: Stock Adjustment Transaction & Balance Invariant
  console.log('Test 4: Stock Adjustment Transaction (creates Kardex and updates level)')
  const initialStock = (await repo.getStockLevelsByLocation({ locationId: 'loc-01' })).data.find(
    (i) => i.productId === 'prod-001'
  )!.currentStock

  const adjustmentResult = await service.adjustStock(
    {
      locationId: 'loc-01',
      productId: 'prod-001',
      type: 'IN',
      quantity: 18,
      reason: 'Ajuste de inventario físico verificado',
      responsibleUserId: adminCtx.userId,
      responsibleUserName: 'Mauricio Admin',
    },
    adminCtx
  )

  assert.strictEqual(adjustmentResult.previousStock, initialStock)
  assert.strictEqual(adjustmentResult.resultingStock, initialStock + 18)
  assert.ok(adjustmentResult.movementId.startsWith('mov-'), 'Must create valid Kardex movement ID')
  console.log('✓ Stock Adjustment Transaction passed')

  // Test 5: Negative Balance Prevention on Outward Adjustment
  console.log('Test 5: Negative Stock Prevention on Adjustment Out')
  try {
    await service.adjustStock(
      {
        locationId: 'loc-01',
        productId: 'prod-001',
        type: 'OUT',
        quantity: 999999, // Exceeds current stock
        reason: 'Salida no permitida',
      },
      adminCtx
    )
    assert.fail('Should have thrown error on negative stock adjustment')
  } catch (err: any) {
    assert.ok(err.message.includes('No se puede realizar un ajuste de salida'), 'Must throw descriptive error')
  }
  console.log('✓ Negative Stock Prevention passed')

  // Test 6: Physical Count Session & Discrepancy Application
  console.log('Test 6: Physical Count Session and Discrepancies')
  const session = await service.startPhysicalCountSession('loc-02', 'Punto Centro')
  assert.ok(session.items.length > 0, 'Must load items for location')
  assert.strictEqual(session.status, 'IN_PROGRESS')

  // Simulate discrepancy on first item: 45 system vs 40 physical (-5 difference)
  session.items[0].physicalStock = session.items[0].systemStock - 5
  session.items[0].difference = -5

  const applyResult = await service.applyPhysicalCountAdjustments(session, adminCtx)
  assert.strictEqual(applyResult.appliedCount, 1, 'Must apply exactly 1 adjustment for the difference')
  console.log('✓ Physical Count Session and Discrepancies passed')

  console.log('\n======================================')
  console.log('ALL INVENTORY BUSINESS LOGIC TESTS PASSED!')
  console.log('======================================\n')
}

runInventoryTests().catch((err) => {
  console.error('Test failure:', err)
  process.exit(1)
})
