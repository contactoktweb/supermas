import assert from 'node:assert'
import { superCatalogService, UserContext } from '../services/super-catalog.service'
import {
  superProductConfigSchema,
  superProductPriceSchema,
  superBulkActionSchema,
} from '../schemas/super-catalog.schema'
import { auditService } from '@/features/audit/services/audit.service'
import { SuperCatalogPermission } from '../types'

async function runSuperCatalogTests() {
  console.log('--- RUNNING SUPER CATALOG BUSINESS LOGIC TESTS ---')

  const testUser: UserContext = {
    id: 'usr-admin-super',
    name: 'SuperAdmin Test',
    role: 'SUPERADMIN',
    permissions: [
      'super_catalog.read',
      'super_catalog.update',
      'super_catalog.publish',
      'super_catalog.price',
      'super_catalog.images',
      'super_catalog.bulk_update',
      'super_catalog.export',
    ],
  }

  // 1. Zod Schemas Validation
  console.log('Test 1: Schema validation for config, prices and bulk actions')
  const validConfig = superProductConfigSchema.parse({
    webSuperMas: true,
    webDirectPurchaseEnabled: true,
    price: 24500,
    showPrice: true,
    webLowStockThreshold: 25,
  })
  assert.strictEqual(validConfig.price, 24500)
  assert.strictEqual(validConfig.webDirectPurchaseEnabled, true)

  // Direct purchase requires webSuperMas: true
  assert.throws(() => {
    superProductConfigSchema.parse({
      webSuperMas: false,
      webDirectPurchaseEnabled: true, // Invalid: cannot have direct purchase if unpublished
      price: 24500,
      showPrice: true,
      webLowStockThreshold: 25,
    })
  }, /Para activar la compra directa, el producto debe estar publicado en el Catálogo Super Más/)

  const validPrice = superProductPriceSchema.parse({
    price: 19900,
    showPrice: true,
    taxConfigId: 'tax-19',
  })
  assert.strictEqual(validPrice.price, 19900)

  const validBulk = superBulkActionSchema.parse({
    action: 'PUBLISH',
    productIds: ['prod-001', 'prod-002'],
  })
  assert.strictEqual(validBulk.productIds.length, 2)
  console.log('✓ Schemas validation passed')

  // 2. Stats & Analytics Computation
  console.log('Test 2: Super Catalog stats computation and web insights')
  const stats = await superCatalogService.getStats(testUser)
  assert(typeof stats.totalProductsCount === 'number')
  assert(typeof stats.publishedCount === 'number')
  assert(typeof stats.hiddenCount === 'number')
  assert(typeof stats.availableCount === 'number')
  assert(typeof stats.lowStockCount === 'number')
  assert(typeof stats.outOfStockCount === 'number')
  assert(typeof stats.totalSalesFromWeb === 'number')
  assert.strictEqual(stats.totalProductsCount, stats.publishedCount + stats.hiddenCount)
  if (stats.topSellingProduct) {
    assert(typeof stats.topSellingProduct.soldUnits === 'number')
    assert(typeof stats.topSellingProduct.name === 'string')
  }
  if (stats.mostViewedProduct) {
    assert(typeof stats.mostViewedProduct.views === 'number')
    assert(typeof stats.mostViewedProduct.name === 'string')
  }
  console.log('✓ Catalog stats passed')

  // 3. Multi-warehouse Availability Calculation & Configurable Low Stock Threshold
  console.log('Test 3: Commercial availability calculation with dynamic low-stock threshold')
  const result = await superCatalogService.getProducts({}, testUser)
  assert(result.products.length > 0)
  result.products.forEach((p) => {
    assert(
      ['AVAILABLE', 'LOW_STOCK', 'OUT_OF_STOCK'].includes(p.availability),
      `Invalid availability: ${p.availability}`
    )
    assert(
      ['Disponible', 'Pocas unidades', 'Agotado'].includes(p.availabilityLabel),
      `Invalid label: ${p.availabilityLabel}`
    )
    assert(p.webLowStockThreshold > 0, 'Threshold must be positive')
    assert(Array.isArray(p.warehouseStockSummary), 'Warehouse summary must be an array')
  })

  // Verify out-of-stock product is NOT deleted
  const outOfStockProd = result.products.find((p) => p.availability === 'OUT_OF_STOCK')
  if (outOfStockProd) {
    assert.strictEqual(outOfStockProd.availabilityLabel, 'Agotado')
    assert.strictEqual(outOfStockProd.canBuyDirectly, false, 'Out-of-stock product cannot be bought directly')
  }
  console.log('✓ Multi-warehouse availability passed')

  // 4. Public Security & Data Redaction
  console.log('Test 4: Strict public data privacy and cost redaction')
  result.products.forEach((item: any) => {
    assert.strictEqual(item.averageCost, undefined, 'Catalog product MUST NEVER expose averageCost')
    assert.strictEqual(item.inventoryValueAtCost, undefined, 'Catalog product MUST NEVER expose inventoryValueAtCost')
    assert.strictEqual(item.profitMarginAmount, undefined, 'Catalog product MUST NEVER expose profitMarginAmount')
    assert.strictEqual(item.profitMarginPercent, undefined, 'Catalog product MUST NEVER expose profitMarginPercent')
    assert.strictEqual(item.supplierId, undefined, 'Catalog product MUST NEVER expose supplierId')
    assert.strictEqual(item.supplierName, undefined, 'Catalog product MUST NEVER expose supplierName')
  })
  console.log('✓ Public security & redaction passed')

  // 5. Price and Tax Profile Update
  console.log('Test 5: Updating web price and tax profile')
  const testProd = result.products[0]
  const newPrice = 22900
  const updatedWithPrice = await superCatalogService.updatePrice(
    testProd.id,
    newPrice,
    true,
    'tax-19',
    testUser
  )
  assert.strictEqual(updatedWithPrice.price, newPrice)
  assert.strictEqual(updatedWithPrice.vatRatePercent, 19)
  assert.strictEqual(updatedWithPrice.isExempt, false)
  console.log('✓ Price and tax update passed')

  // 6. Cart & Direct Purchase Simulation
  console.log('Test 6: Web cart simulation and order readiness')
  // For published product with direct buy
  const buyableProd = result.products.find((p) => p.canBuyDirectly)
  if (buyableProd) {
    const cartRes = await superCatalogService.simulateAddToCart(buyableProd.id, 2)
    assert.strictEqual(cartRes.success, true)
    assert(cartRes.cartItem !== undefined)
    assert.strictEqual(cartRes.cartItem.quantity, 2)
    assert.strictEqual(cartRes.cartItem.subtotal, buyableProd.price * 2)
  }

  // If product has canBuyDirectly false, cart addition must be rejected
  const nonBuyableProd = result.products.find((p) => !p.canBuyDirectly)
  if (nonBuyableProd) {
    const cartRes = await superCatalogService.simulateAddToCart(nonBuyableProd.id, 1)
    assert.strictEqual(cartRes.success, false)
  }
  console.log('✓ Cart simulation passed')

  // 7. Role & Permission Enforcement
  console.log('Test 7: Permission check on sensitive actions')
  const unauthorizedUser: UserContext = {
    id: 'usr-seller-01',
    name: 'Seller User',
    role: 'SELLER',
    permissions: ['super_catalog.read'],
  }

  await assert.rejects(
    async () => {
      await superCatalogService.updateProductConfig(
        testProd.id,
        { webSuperMas: false },
        unauthorizedUser
      )
    },
    /Permiso denegado/,
    'Should reject configuration update for unauthorized role'
  )
  console.log('✓ Permission enforcement passed')

  // 8. Bulk Update & Audit Logging
  console.log('Test 8: Bulk update and audit log persistence')
  const initialLogs = await auditService.list({}, 'SUPERADMIN')
  const initialLogCount = initialLogs.length

  const bulkRes = await superCatalogService.bulkUpdate(
    ['prod-001', 'prod-002'],
    'ENABLE_PURCHASE',
    testUser
  )
  assert.strictEqual(bulkRes.updatedCount, 2)

  const updatedLogs = await auditService.list({}, 'SUPERADMIN')
  assert(
    updatedLogs.length > initialLogCount,
    'Audit log must register bulk updates'
  )
  console.log('✓ Bulk update and audit passed')

  console.log('--- ALL SUPER CATALOG TESTS PASSED SUCCESSFULLY ---')
}

runSuperCatalogTests().catch((err) => {
  console.error('Test failed with error:', err)
  process.exit(1)
})
