import assert from 'node:assert'
import { productService } from '../services/product.service'
import { Product } from '../types'

async function runTests() {
  console.log('--- RUNNING PRODUCTS MODULE BUSINESS LOGIC TESTS ---')

  // Test 1: Profit Margin and VAT Calculation
  console.log('Test 1: Profit Margin and VAT Calculation')
  const marginExempt = productService.calculateProfitMargin(21500, 0, 15400)
  assert.strictEqual(marginExempt.amount, 6100)
  assert.strictEqual(marginExempt.percentage, 28.37)

  const margin19 = productService.calculateProfitMargin(29800, 19, 19800)
  assert.strictEqual(Math.round(margin19.amount), 5242)
  assert.strictEqual(margin19.percentage, 20.93)
  console.log('✓ Profit Margin and VAT Calculation passed')

  // Test 2: Dynamic Web Availability Derivation
  console.log('Test 2: Dynamic Web Availability Derivation')
  assert.strictEqual(productService.deriveWebAvailability(0, 15), 'OUT_OF_STOCK')
  assert.strictEqual(productService.deriveWebAvailability(10, 15), 'LOW_STOCK')
  assert.strictEqual(productService.deriveWebAvailability(15, 15), 'LOW_STOCK')
  assert.strictEqual(productService.deriveWebAvailability(420, 15), 'AVAILABLE')
  console.log('✓ Dynamic Web Availability Derivation passed')

  // Test 3: RBAC Cost Privacy Sanitization
  console.log('Test 3: RBAC Cost Privacy Sanitization')
  const mockProduct: Product = {
    id: 'test-p1',
    companyId: 'comp-1',
    categoryId: 'cat-1',
    brandId: 'brand-1',
    sku: 'TEST-001',
    name: 'Test Product',
    slug: 'test-product',
    unitOfMeasure: 'UND',
    costPrice: 5000,
    publicSalePrice: 10000,
    wholesalePrice: 8000,
    minWholesaleQuantity: 12,
    taxRatePercent: 19,
    isTaxExempt: false,
    minStockThreshold: 10,
    criticalStockThreshold: 5,
    isActive: true,
    isPublishedSupermas: true,
    isPublishedDistributor: true,
    inventoryType: 'MERCHANDISE',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    primaryImageUrl: '',
    secondaryImages: [],
    imageUrl: '',
    images: [],
    description: '',
    status: 'ACTIVE',
    taxProfile: 'IVA_19',
    vatRatePercent: 19,
    isExempt: false,
    prices: [],
    normalPrice: 10000,
    averageCost: 5000,
    inventoryValueAtCost: 50000,
    profitMarginAmount: 3403,
    profitMarginPercent: 40.5,
    totalStock: 10,
    availableUnits: 10,
    stockHealth: 'AVAILABLE',
    webSuperMas: true,
    webDistribuidora: true,
    webAvailability: 'AVAILABLE',
    warehouseStock: [],
  }

  const sanitizedSeller = (productService as any).sanitizeProductForUser(mockProduct, false)
  assert.strictEqual(sanitizedSeller.averageCost, 0)
  assert.strictEqual(sanitizedSeller.costPrice, 0)
  assert.strictEqual(sanitizedSeller.profitMarginAmount, 0)
  assert.strictEqual(sanitizedSeller.profitMarginPercent, 0)
  assert.strictEqual(sanitizedSeller.inventoryValueAtCost, 0)

  const sanitizedAdmin = (productService as any).sanitizeProductForUser(mockProduct, true)
  assert.strictEqual(sanitizedAdmin.averageCost, 5000)
  assert.strictEqual(sanitizedAdmin.costPrice, 5000)
  assert.strictEqual(sanitizedAdmin.profitMarginAmount, 3403)
  console.log('✓ RBAC Cost Privacy Sanitization passed')

  // Test 4: Currency Formatter
  console.log('Test 4: Currency Formatter')
  assert.strictEqual(productService.formatCurrency(15000).replace(/\u00a0/g, ' '), '$ 15.000')
  console.log('✓ Currency Formatter passed')

  // Test 5: Slug Generation
  console.log('Test 5: Slug Generation')
  assert.strictEqual(
    (productService as any).slugify('Arroz Diana Extra 1000g'),
    'arroz-diana-extra-1000g'
  )
  console.log('✓ Slug Generation passed')

  console.log('\n======================================')
  console.log('ALL PRODUCTS MODULE BUSINESS LOGIC TESTS PASSED!')
  console.log('======================================\n')
}

runTests().catch((err) => {
  console.error('Test execution failed:', err)
  process.exit(1)
})
