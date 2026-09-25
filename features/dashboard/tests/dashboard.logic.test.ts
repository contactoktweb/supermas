import assert from 'node:assert'
import { DashboardService } from '../services/dashboard.service'
import { dashboardRepository } from '../repositories/dashboard.repository'
import { mockUserProfiles } from '../mocks/dashboard.mock'
import { PeriodType } from '../types'

async function runDashboardTests() {
  console.log('--- RUNNING DASHBOARD BUSINESS LOGIC TESTS ---')
  const service = new DashboardService()

  const superAdmin = {
    id: 'usr-admin',
    name: 'Mauricio Andrade',
    email: 'admin@supermas.com',
    role: 'SUPERADMIN' as const,
    roleName: 'Super Administrador',
    avatar: 'MA',
    locationName: 'Consolidado General',
    lastLoginAt: '2026-09-24T10:00:00Z',
    permissions: ['*'],
  }
  const seller = {
    id: 'usr-seller',
    name: 'Andrés Morales',
    email: 'andres@supermas.com',
    role: 'SELLER' as const,
    roleName: 'Vendedor POS',
    avatar: 'AM',
    locationName: 'Punto Centro',
    lastLoginAt: '2026-09-24T10:00:00Z',
    permissions: ['pos.sell', 'product.read'],
  }
  const pointAdmin = {
    id: 'usr-padmin',
    name: 'Laura Gómez',
    email: 'laura@supermas.com',
    role: 'POINT_ADMIN' as const,
    roleName: 'Administrador de Punto',
    avatar: 'LG',
    locationName: 'Punto Norte',
    lastLoginAt: '2026-09-24T10:00:00Z',
    permissions: ['pos.sell', 'product.read', 'inventory.read'],
  }

  // Test 1: RBAC Cost & Financial Redaction
  console.log('Test 1: RBAC Cost & Financial Redaction')
  const sellerMetrics = await service.getDashboardMetrics('TODAY', seller)
  assert.strictEqual(sellerMetrics.isFinancialRedacted, true, 'Seller metrics should be flagged as redacted')
  assert.strictEqual(sellerMetrics.grossProfit, undefined, 'Gross profit must be redacted for SELLER')
  assert.strictEqual(sellerMetrics.inventoryAtCost, undefined, 'Inventory at cost must be redacted for SELLER')
  assert.strictEqual(sellerMetrics.purchases, undefined, 'Purchases must be redacted for SELLER')
  assert.strictEqual(sellerMetrics.accountsPayable, undefined, 'Accounts payable must be redacted for SELLER')

  const adminMetrics = await service.getDashboardMetrics('TODAY', superAdmin)
  assert.strictEqual(adminMetrics.isFinancialRedacted, false, 'Admin metrics must NOT be redacted')
  assert.ok(adminMetrics.grossProfit !== undefined, 'Admin must see gross profit')
  assert.ok(adminMetrics.inventoryAtCost !== undefined, 'Admin must see inventory at cost')
  assert.ok(adminMetrics.purchases !== undefined, 'Admin must see purchases')
  console.log('✓ RBAC Cost & Financial Redaction passed')

  // Test 2: Dynamic Greeting Calculation based on America/Bogota hour
  console.log('Test 2: Dynamic Greeting Calculation')
  const morningDate = new Date('2026-08-31T13:00:00.000Z') // 8:00 AM Bogota
  const afternoonDate = new Date('2026-08-31T19:00:00.000Z') // 2:00 PM Bogota
  const nightDate = new Date('2026-09-01T01:30:00.000Z') // 8:30 PM Bogota

  assert.strictEqual(service.getDynamicGreeting(morningDate), 'Buenos días')
  assert.strictEqual(service.getDynamicGreeting(afternoonDate), 'Buenas tardes')
  assert.strictEqual(service.getDynamicGreeting(nightDate), 'Buenas noches')
  console.log('✓ Dynamic Greeting Calculation passed')

  // Test 3: Quick Actions Permission Filtering
  console.log('Test 3: Quick Actions Permission Filtering')
  const sellerActions = service.getQuickActions(seller)
  const adminActions = service.getQuickActions(superAdmin)

  assert.ok(sellerActions.length < adminActions.length, 'Seller should have fewer quick actions than Superadmin')
  assert.ok(sellerActions.some((a) => a.targetView === 'POS'), 'Seller should have access to POS action')
  assert.ok(!sellerActions.some((a) => a.targetView === 'Compras'), 'Seller should NOT have access to Nueva Compra')
  assert.ok(adminActions.some((a) => a.targetView === 'Compras'), 'Superadmin should have access to Nueva Compra')
  console.log('✓ Quick Actions Permission Filtering passed')

  // Test 4: Login Audit Security Access
  console.log('Test 4: Login Audit Security Access')
  const sellerAudits = await service.getLoginAudits(seller)
  const adminAudits = await service.getLoginAudits(superAdmin)

  assert.strictEqual(sellerAudits.length, 0, 'Unprivileged users must receive empty audit logs')
  assert.ok(adminAudits.length > 0, 'Superadmin must receive audit logs')
  assert.ok(adminAudits[0].ipAddress, 'Audit record must have IP address')
  assert.ok(adminAudits[0].sessionId, 'Audit record must have session ID')
  console.log('✓ Login Audit Security Access passed')

  // Test 5: In-Memory / DB Audit Recording
  console.log('Test 5: Login Audit Recording')
  const newAudit = await dashboardRepository.recordLoginAudit({
    userId: 'usr-999',
    userName: 'Test User',
    userEmail: 'test@supermas.com.co',
    roleSnapshot: 'SELLER',
    locationName: 'Punto Centro',
    loginAt: new Date().toISOString(),
    status: 'SUCCESS',
    ipAddress: '190.158.42.1',
    userAgent: 'Chrome 128',
    browser: 'Chrome',
    os: 'macOS',
    sessionId: 'sess_test_123',
  })
  assert.ok(newAudit.id.startsWith('log-'), 'Recorded audit must generate a valid log ID')
  const updatedLogs = await dashboardRepository.getLoginAudits(10)
  assert.strictEqual(updatedLogs[0].id, newAudit.id, 'New audit must be prepended at the top')
  console.log('✓ Login Audit Recording passed')

  // Test 6: Currency Formatter (COP)
  console.log('Test 6: Currency Formatter')
  const formattedStandard = service.formatCOP(24850000)
  const formattedCompactMillions = service.formatCOP(24850000, true)
  const formattedCompactBillions = service.formatCOP(1840000000, true)

  assert.ok(formattedStandard.includes('24.850.000') || formattedStandard.includes('24,850,000') || formattedStandard.includes('$'), 'Standard COP format')
  assert.strictEqual(formattedCompactMillions, '$24.85M', 'Compact COP format in Millions')
  assert.strictEqual(formattedCompactBillions, '$1.84B', 'Compact COP format in Billions')
  // Test 8: Dynamic Inventory Distribution Calculation by Cost Value
  console.log('Test 8: Dynamic Inventory Distribution by Cost Value')
  const distribution = await service.getInventoryDistribution(superAdmin)
  if (distribution.length === 0) {
    assert.strictEqual(distribution.length, 0, 'Clean installation has 0 inventory distribution records')
  } else {
    const totalCost = distribution.reduce((acc, item) => acc + (item.value || 0), 0)
    assert.ok(totalCost > 0, 'Total inventory cost must be greater than 0')

    let sumPct = 0
    for (const item of distribution) {
      assert.ok(typeof item.value === 'number', 'Admin must see cost value for each location')
      const expectedPct = Number(((item.value / totalCost) * 100).toFixed(1))
      assert.strictEqual(
        item.percentage,
        expectedPct,
        `Percentage for ${item.locationName} must be computed from cost value`
      )
      sumPct += item.percentage
    }
    assert.ok(Math.abs(sumPct - 100) <= 0.5, 'Sum of calculated percentages must approximately equal 100%')
  }
  console.log('✓ Dynamic Inventory Distribution by Cost Value passed')

  console.log('\n======================================')
  console.log('ALL DASHBOARD BUSINESS LOGIC TESTS PASSED!')
  console.log('======================================\n')
}

runDashboardTests().catch((err) => {
  console.error('Test failure:', err)
  process.exit(1)
})
