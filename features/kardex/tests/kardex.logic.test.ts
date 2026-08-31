import { kardexService } from '../services/kardex.service'
import { UserPermissionContext } from '../types'

console.log('--- RUNNING KARDEX BUSINESS LOGIC TESTS ---')

async function runTests() {
  // Test 1: Balance Invariant Check
  console.log('Test 1: Stock Balance Invariant Verification (resultingStock === previousStock + In - Out)')
  const res = await kardexService.listMovements({ pageSize: 50 })
  for (const m of res.items) {
    const expected = m.previousStock + m.quantityIn - m.quantityOut
    if (m.resultingStock !== expected) {
      throw new Error(
        `Balance invariant violated on movement ${m.movementNumber}: previous=${m.previousStock}, in=${m.quantityIn}, out=${m.quantityOut}, expected resulting=${expected}, got=${m.resultingStock}`
      )
    }
  }
  console.log('✓ Stock Balance Invariant verified for all records')

  // Test 2: Filter by Location and Type
  console.log('Test 2: Multi-filter by Location and Movement Type')
  const filteredLoc = await kardexService.listMovements({
    locationId: 'loc-01',
    movementType: 'COMPRA',
  })
  if (filteredLoc.items.some((m) => m.locationId !== 'loc-01' || m.type !== 'COMPRA')) {
    throw new Error('Filter by location and type failed to filter strictly')
  }
  console.log('✓ Location and type filtering passed')

  // Test 3: RBAC Cost Redaction
  console.log('Test 3: RBAC Cost Privacy Protection')
  const sellerContext: UserPermissionContext = {
    userId: 'seller-1',
    userRole: 'SELLER',
    assignedLocationId: 'loc-02',
    permissions: ['kardex.read'], // No cost.read
  }
  const sellerResult = await kardexService.listMovements({}, sellerContext)
  if (!sellerResult.isCostRedacted) {
    throw new Error('Expected isCostRedacted to be true for seller')
  }
  if (sellerResult.items.some((m) => m.unitCost !== 0 || m.totalValue !== 0)) {
    throw new Error('Cost values were not redacted for unauthorized seller')
  }

  const sellerStats = await kardexService.getGlobalStats({}, sellerContext)
  if (!sellerStats.isCostRedacted || sellerStats.totalValueInAtCost !== 0) {
    throw new Error('Financial statistics were not redacted for seller')
  }
  console.log('✓ RBAC Cost Privacy Protection passed')

  // Test 4: Compensating Reversion Creation
  console.log('Test 4: Compensating Reversion Creation (Immutable Ledger)')
  const original = res.items[0]
  const reversion = await kardexService.createReversion(
    {
      originalMovementId: original.id,
      reason: 'Error de prueba en digitación de unidades',
    },
    { userId: 'admin-1', userRole: 'ADMIN', permissions: ['kardex.revert'] }
  )

  if (!reversion.isReversion || reversion.type !== 'REVERSION') {
    throw new Error('Reversion movement was not created as REVERSION')
  }
  if (reversion.originalMovementId !== original.id) {
    throw new Error('Reversion is not linked to original movement ID')
  }
  console.log('✓ Compensating Reversion Creation passed')

  // Test 5: CSV Export with RBAC
  console.log('Test 5: CSV Export with RBAC masking')
  const csvAdmin = kardexService.exportToCsv([original], false)
  if (!csvAdmin.includes(original.totalValue.toString())) {
    throw new Error('Admin CSV should include unredacted total value')
  }

  const csvSeller = kardexService.exportToCsv([original], true)
  if (!csvSeller.includes('••••••••')) {
    throw new Error('Seller CSV must mask financial amounts with dots')
  }
  console.log('✓ CSV Export with RBAC passed')

  console.log('\n======================================')
  console.log('ALL KARDEX BUSINESS LOGIC TESTS PASSED!')
  console.log('======================================\n')
}

runTests().catch((err) => {
  console.error('KARDEX TEST FAILED:', err)
  process.exit(1)
})
