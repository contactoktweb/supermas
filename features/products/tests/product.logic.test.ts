import assert from 'node:assert'
import { productService } from '../services/product.service'
import { productRepository } from '../repositories/product.repository'
import { UserPermissionContext, CreateProductInput } from '../types'

async function runTests() {
  console.log('--- RUNNING PRODUCTS MODULE BUSINESS LOGIC TESTS ---')

  await productRepository.resetMocks()

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

  // Test 3: Duplicate SKU Prevention
  console.log('Test 3: Duplicate SKU Prevention')
  const duplicateInput: CreateProductInput = {
    name: 'Producto Duplicado Test',
    sku: 'ABA-ARR-001', // Existing SKU in mock
    barcode: '7709999999999',
    category: 'Abarrotes y Despensa',
    brand: 'Diana',
    unitOfMeasure: 'UND',
    status: 'ACTIVE',
    taxProfile: 'IVA_19',
    vatRatePercent: 19,
    prices: [{ code: 'NORMAL', name: 'Precio Normal', price: 10000 }],
    webSuperMas: true,
    webDistribuidora: false,
  }

  let errorThrown = false
  try {
    await productService.createProduct(duplicateInput)
  } catch (err: any) {
    errorThrown = true
    assert.ok(err.message.includes('ya se encuentra registrado'))
  }
  assert.strictEqual(errorThrown, true, 'Debe arrojar error al intentar crear SKU duplicado')
  console.log('✓ Duplicate SKU Prevention passed')

  // Test 4: RBAC Cost Privacy Protection
  console.log('Test 4: RBAC Cost Privacy Protection')
  const sellerContext: UserPermissionContext = {
    userId: 'usr-seller',
    userName: 'Vendedor Mostrador',
    userRole: 'SELLER',
    permissions: ['product.read', 'sale.create'], // No cost.read
  }

  const responseSeller = await productService.listProducts({}, sellerContext)
  assert.strictEqual(responseSeller.isCostRedacted, true)
  assert.strictEqual(responseSeller.items[0].averageCost, 0)
  assert.strictEqual(responseSeller.items[0].profitMarginPercent, 0)

  const adminContext: UserPermissionContext = {
    userId: 'usr-admin',
    userName: 'Administrador General',
    userRole: 'ADMIN',
    permissions: ['*'],
  }

  const responseAdmin = await productService.listProducts({}, adminContext)
  assert.strictEqual(responseAdmin.isCostRedacted, false)
  assert.ok(responseAdmin.items[0].averageCost > 0)
  assert.ok(responseAdmin.items[0].profitMarginPercent > 0)
  console.log('✓ RBAC Cost Privacy Protection passed')

  // Test 5: Safe Deactivation (Soft Delete)
  console.log('Test 5: Safe Deactivation (Soft Delete)')
  const deactivated = await productService.deactivateProduct(
    'prod-001',
    'Retiro temporal del catálogo por cambio de empaque',
    adminContext
  )

  assert.strictEqual(deactivated.status, 'INACTIVE')
  assert.strictEqual(deactivated.webSuperMas, false)
  assert.strictEqual(deactivated.webDistribuidora, false)
  assert.ok(deactivated.auditTrail && deactivated.auditTrail.length > 0)
  assert.strictEqual(deactivated.auditTrail[0].fieldChanged, 'DESACTIVACION')
  console.log('✓ Safe Deactivation passed')

  // Test 6: Global Stats with RBAC
  console.log('Test 6: Global Stats with RBAC')
  const statsSeller = await productService.getGlobalStats(sellerContext)
  assert.strictEqual(statsSeller.isCostRedacted, true)
  assert.strictEqual(statsSeller.totalInventoryValueAtCost, 0)

  const statsAdmin = await productService.getGlobalStats(adminContext)
  assert.strictEqual(statsAdmin.isCostRedacted, false)
  assert.ok(statsAdmin.totalInventoryValueAtCost > 0)
  console.log('✓ Global Stats with RBAC passed')

  console.log('\n======================================')
  console.log('ALL PRODUCTS MODULE BUSINESS LOGIC TESTS PASSED!')
  console.log('======================================\n')
}

runTests().catch((err) => {
  console.error('Test execution failed:', err)
  process.exit(1)
})
