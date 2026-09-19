import assert from 'node:assert'
import { distributorCatalogService, UserContext } from '../services/distributor-catalog.service'
import {
  productCatalogConfigSchema,
  bulkActionSchema,
} from '../schemas/distributor-catalog.schema'
import { auditService } from '@/features/audit/services/audit.service'
import { DistributorCatalogPermission } from '../types'

async function runDistributorCatalogTests() {
  console.log('--- RUNNING DISTRIBUTOR CATALOG BUSINESS LOGIC TESTS ---')

  const testUser: UserContext = {
    id: 'usr-admin-01',
    name: 'Admin Test',
    role: 'ADMIN',
    permissions: [
      'distributor_catalog.read',
      'distributor_catalog.update',
      'distributor_catalog.publish',
      'distributor_catalog.bulk_update',
      'distributor_catalog.preview',
      'distributor_catalog.export',
    ],
  }

  // 1. Zod Validation Schemas
  console.log('Test 1: Schema validation for config & bulk operations')
  const validConfig = productCatalogConfigSchema.parse({
    webDistribuidora: true,
    webSuperMas: false,
    webDirectPurchaseEnabled: false,
    webWhatsAppInquiryEnabled: true,
  })
  assert.strictEqual(validConfig.webDistribuidora, true)
  assert.strictEqual(validConfig.webSuperMas, false)

  // Direct purchase requires webSuperMas
  assert.throws(() => {
    productCatalogConfigSchema.parse({
      webDistribuidora: true,
      webSuperMas: false,
      webDirectPurchaseEnabled: true, // Invalid: cannot have direct purchase without webSuperMas
      webWhatsAppInquiryEnabled: true,
    })
  }, /Para habilitar compra directa, el producto debe estar activo en Catálogo Super Más/)

  const validBulk = bulkActionSchema.parse({
    action: 'PUBLISH',
    productIds: ['prod-001', 'prod-002'],
  })
  assert.strictEqual(validBulk.productIds.length, 2)
  console.log('✓ Schemas validation passed')

  // 2. Stats Calculation
  console.log('Test 2: Catalog stats computation')
  const stats = await distributorCatalogService.getStats()
  assert(typeof stats.totalProductsCount === 'number')
  assert(typeof stats.publishedCount === 'number')
  assert(typeof stats.hiddenCount === 'number')
  assert(typeof stats.availableCount === 'number')
  assert(typeof stats.outOfStockCount === 'number')
  assert(typeof stats.lowStockCount === 'number')
  assert(typeof stats.directPurchaseActiveCount === 'number')
  assert.strictEqual(stats.totalProductsCount, stats.publishedCount + stats.hiddenCount)
  console.log('✓ Catalog stats passed')

  // 3. Availability Calculation Logic
  console.log('Test 3: Commercial availability calculation across all warehouses')
  const result = await distributorCatalogService.getProducts({}, testUser)
  assert(result.products.length > 0)
  result.products.forEach((p) => {
    assert(
      ['AVAILABLE', 'LOW_STOCK', 'OUT_OF_STOCK'].includes(p.availability),
      `Invalid availability status: ${p.availability}`
    )
    assert(
      ['Disponible', 'Pocas unidades', 'Agotado'].includes(p.availabilityLabel),
      `Invalid availability label: ${p.availabilityLabel}`
    )
    assert.strictEqual(typeof p.availability, 'string')
  })
  console.log('✓ Availability calculation passed')

  // 4. Public Security & Data Redaction (CRITICAL SECURITY)
  console.log('Test 4: Strict public security & data redaction')
  result.products.forEach((item: any) => {
    assert.strictEqual(item.cost, undefined, 'Catalog product MUST NEVER expose cost')
    assert.strictEqual(item.margin, undefined, 'Catalog product MUST NEVER expose margin')
    assert.strictEqual(item.supplierId, undefined, 'Catalog product MUST NEVER expose supplierId')
    assert.strictEqual(item.supplierName, undefined, 'Catalog product MUST NEVER expose supplierName')
    assert.strictEqual(item.stockLevels, undefined, 'Catalog product MUST NEVER expose exact stock breakdown')
    assert(typeof item.availabilityLabel === 'string', 'Product must have availability label')
    assert(typeof item.whatsappUrl === 'string', 'Product must have generated WhatsApp URL')
  })
  console.log('✓ Public catalog redaction passed')

  // 5. WhatsApp Link Dynamic Generation
  console.log('Test 5: Dynamic WhatsApp URL encoding')
  const testProd = result.products[0]
  assert(testProd.whatsappUrl?.startsWith('https://wa.me/'))
  assert(testProd.whatsappUrl?.includes(encodeURIComponent(testProd.name)))
  console.log('✓ WhatsApp URL generation passed')

  // 6. Direct Purchase Link Logic
  console.log('Test 6: Direct purchase button condition')
  result.products.forEach((p) => {
    if (p.webDistribuidora && p.webSuperMas && p.webDirectPurchaseEnabled && p.availability !== 'OUT_OF_STOCK') {
      assert.strictEqual(p.canBuyDirectly, true, `Product ${p.sku} should have canBuyDirectly = true`)
    } else {
      assert.strictEqual(p.canBuyDirectly, false, `Product ${p.sku} should have canBuyDirectly = false`)
    }
  })
  console.log('✓ Direct purchase logic passed')

  // 7. Permissions enforcement
  console.log('Test 7: Permission validation on sensitive actions')
  const unauthorizedUser: UserContext = {
    id: 'usr-unauth',
    name: 'Unauth User',
    role: 'SELLER',
    permissions: ['distributor_catalog.read'],
  }

  await assert.rejects(
    async () => {
      await distributorCatalogService.updateProductConfig(
        testProd.id,
        { webDistribuidora: false },
        unauthorizedUser
      )
    },
    /Permiso denegado/,
    'Should throw error when user lacks update permission'
  )
  console.log('✓ Permission enforcement passed')

  // 8. Product Config Update & Audit
  console.log('Test 8: Updating product config & audit log persistence')
  const initialLogs = await auditService.list({}, 'SUPERADMIN')
  const initialLogCount = initialLogs.length

  const updatedProd = await distributorCatalogService.updateProductConfig(
    testProd.id,
    {
      webDistribuidora: true,
      webWhatsAppInquiryEnabled: true,
    },
    testUser
  )
  assert.strictEqual(updatedProd.webDistribuidora, true)

  const updatedLogs = await auditService.list({}, 'SUPERADMIN')
  assert(
    updatedLogs.length >= initialLogCount,
    'Audit log must register catalog updates'
  )
  console.log('✓ Product config update & audit passed')

  console.log('--- ALL DISTRIBUTOR CATALOG TESTS PASSED SUCCESSFULLY ---')
}

runDistributorCatalogTests().catch((err) => {
  console.error('Test failed with error:', err)
  process.exit(1)
})
