import { transferService } from '../services/transfer.service'
import { UserPermissionContext } from '../types'

console.log('--- RUNNING TRANSFERS BUSINESS LOGIC TESTS ---')

async function runTests() {
  // Test 1: Origin and Destination Equality Validation
  console.log('Test 1: Validation - Origin and Destination must not be equal')
  try {
    await transferService.createTransfer({
      originLocationId: 'loc-01',
      destinationLocationId: 'loc-01',
      items: [{ productId: 'prod-001', units: 5 }],
    })
    throw new Error('Should have failed when origin and destination are the same')
  } catch (err: any) {
    if (err.message.includes('Should have failed')) throw err
    console.log('✓ Same location transfer correctly blocked')
  }

  // Test 2: Stock Availability Validation at Origin
  console.log('Test 2: Stock Availability Validation at Origin')
  try {
    await transferService.createTransfer({
      originLocationId: 'loc-02', // Point Centro has small stock
      destinationLocationId: 'loc-01',
      items: [{ productId: 'prod-001', units: 999999 }], // Exceeds available stock
    })
    throw new Error('Should have failed when requested units exceed stock')
  } catch (err: any) {
    if (err.message.includes('Should have failed')) throw err
    console.log('✓ Insufficient stock correctly prevented')
  }

  // Test 3: Complete Lifecycle: PENDING -> IN_TRANSIT -> RECEIVED
  console.log('Test 3: Complete Lifecycle (PENDING -> IN_TRANSIT -> RECEIVED)')
  const newTransfer = await transferService.createTransfer({
    originLocationId: 'loc-01',
    destinationLocationId: 'loc-02',
    items: [{ productId: 'prod-001', units: 10 }],
    notes: 'Traslado de prueba de ciclo de vida',
  })

  if (newTransfer.status !== 'PENDING') {
    throw new Error(`Expected PENDING status, got ${newTransfer.status}`)
  }
  console.log(`✓ Created transfer ${newTransfer.code} in status PENDING`)

  const dispatched = await transferService.dispatchTransfer({
    transferId: newTransfer.id,
    notes: 'Salida de bodega en orden',
  })

  if (dispatched.status !== 'IN_TRANSIT' || !dispatched.dispatchedAt) {
    throw new Error('Dispatch failed to set IN_TRANSIT status or dispatchedAt date')
  }
  console.log(`✓ Dispatched transfer ${dispatched.code} to status IN_TRANSIT`)

  const received = await transferService.receiveTransfer({
    transferId: dispatched.id,
    receivedItems: [{ productId: 'prod-001', receivedUnits: 10 }],
    notes: 'Recepción conforme',
  })

  if (received.status !== 'RECEIVED' || !received.receivedAt || received.totalUnitsReceived !== 10) {
    throw new Error('Receive failed to set RECEIVED status or units')
  }
  console.log(`✓ Received transfer ${received.code} in status RECEIVED`)

  // Test 4: Receiving with Discrepancy (Incident Logging)
  console.log('Test 4: Discrepancy and Incident Logging on Reception')
  const transferWithIncident = await transferService.createTransfer({
    originLocationId: 'loc-01',
    destinationLocationId: 'loc-03',
    items: [{ productId: 'prod-002', units: 20 }],
  })
  await transferService.dispatchTransfer({ transferId: transferWithIncident.id })

  const receivedWithDiff = await transferService.receiveTransfer({
    transferId: transferWithIncident.id,
    receivedItems: [
      {
        productId: 'prod-002',
        receivedUnits: 18, // 2 units broken
        notes: 'Faltante de 2 unidades por rotura en trayecto',
      },
    ],
  })

  if (!receivedWithDiff.hasIncident || receivedWithDiff.totalUnitsReceived !== 18) {
    throw new Error('Discrepancy was not flagged as incident on transfer reception')
  }
  if (!receivedWithDiff.items[0].hasDiscrepancy) {
    throw new Error('Item discrepancy flag missing')
  }
  console.log('✓ Discrepancy successfully logged as incident')

  // Test 5: Rejection of Pending Transfer
  console.log('Test 5: Rejection of Pending Transfer')
  const transferToReject = await transferService.createTransfer({
    originLocationId: 'loc-01',
    destinationLocationId: 'loc-04',
    items: [{ productId: 'prod-003', units: 5 }],
  })
  const rejected = await transferService.rejectTransfer({
    transferId: transferToReject.id,
    reason: 'Cancelado por solicitud del comprador',
  })
  if (rejected.status !== 'REJECTED' || !rejected.rejectionReason) {
    throw new Error('Rejection failed to set REJECTED status or reason')
  }
  console.log('✓ Pending transfer successfully rejected with reason')

  // Test 6: RBAC Cost Redaction
  console.log('Test 6: RBAC Cost Redaction (cost.read)')
  const sellerContext: UserPermissionContext = {
    userId: 'seller-01',
    userRole: 'SELLER',
    assignedLocationId: 'loc-02',
    permissions: ['inventory.transfer'], // No cost.read
  }

  const sellerTransfers = await transferService.listTransfers({}, sellerContext)
  if (!sellerTransfers.isCostRedacted) {
    throw new Error('Expected isCostRedacted to be true for seller')
  }
  if (sellerTransfers.items.some((t) => t.totalValueAtCost !== 0 || t.items.some((i) => i.unitCost !== 0))) {
    throw new Error('Financial values were not redacted for seller lacking cost.read')
  }
  console.log('✓ RBAC Cost Privacy Protection passed')

  // Test 7: Flow Edge Generation
  console.log('Test 7: Flow Edge Generation for Visual View')
  const flowEdges = transferService.getFlowEdges(sellerTransfers.items)
  if (flowEdges.length === 0 || !flowEdges[0].originLocationName || !flowEdges[0].destinationLocationName) {
    throw new Error('Flow edges were not properly constructed')
  }
  console.log(`✓ Flow edges correctly generated (${flowEdges.length} edges)`)

  // Test 8: CSV Export with RBAC Masking
  console.log('Test 8: CSV Export with RBAC Masking')
  const csvAdmin = transferService.exportToCsv([received], false)
  if (!csvAdmin.includes(received.code)) {
    throw new Error('Admin CSV missing transfer code')
  }
  const csvSeller = transferService.exportToCsv([received], true)
  if (!csvSeller.includes('••••••••')) {
    throw new Error('Seller CSV must mask cost values')
  }
  // Test 9: Location Options and Active Status Filtering
  console.log('Test 9: Location Options and Active Status Filtering')
  const locations = await transferService.getTransferLocations()
  if (locations.length < 2) {
    throw new Error('Expected at least 2 active locations')
  }
  if (locations.some((l) => l.status !== 'ACTIVE')) {
    throw new Error('Inactive locations returned in transfer options')
  }
  console.log(`✓ Active locations correctly returned (${locations.length} locations)`)

  // Test 10: Multi-Warehouse Availability Query with Projections
  console.log('Test 10: Multi-Warehouse Availability Query with Projections')
  const prodsWithAvail = await transferService.getAvailableProductsForTransfer('loc-01', 'loc-02')
  if (prodsWithAvail.length === 0) {
    throw new Error('Available products query returned empty list')
  }
  const firstProd = prodsWithAvail[0]
  if (firstProd.stockInOrigin === undefined || firstProd.stockInDestination === undefined || !firstProd.stocksByLocation) {
    throw new Error('Product availability missing origin/destination/network stocks')
  }
  console.log(`✓ Multi-warehouse availability correctly computed for ${firstProd.productName}`)

  console.log('\n======================================')
  console.log('ALL TRANSFERS BUSINESS LOGIC TESTS PASSED!')
  console.log('======================================\n')
}

runTests().catch((err) => {
  console.error('TRANSFERS TEST FAILED:', err)
  process.exit(1)
})
