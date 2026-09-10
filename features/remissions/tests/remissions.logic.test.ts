import { remissionService } from '../services/remission.service'
import { remissionRepository } from '../repositories/remission.repository'
import { RemissionUserContext } from '../types'
import { db } from '@/lib/supabase'

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`❌ Assertion failed: ${message}`)
  }
  console.log(`✅ Passed: ${message}`)
}

async function runRemissionsTestSuite() {
  console.log('========================================================')
  console.log('🧪 RUNNING SUPER MÁS REMISIONES (DELIVERY) TEST SUITE')
  console.log('========================================================\n')

  const adminUser: RemissionUserContext = {
    userId: 'usr-admin-test',
    userName: 'Mauricio Logística Admin',
    userRole: 'Administrador',
    permissions: [
      'remission.read',
      'remission.create',
      'remission.update',
      'remission.dispatch',
      'remission.receive',
      'remission.cancel',
      'remission.export',
    ],
  }

  const restrictedUser: RemissionUserContext = {
    userId: 'usr-viewer-test',
    userName: 'Operador Solo Lectura',
    userRole: 'Operador',
    permissions: ['remission.read'],
  }

  // 1. Listing & Statistics
  console.log('--- 1. Testing Repository & Service Listing ---')
  const stats = await remissionService.getRemissionStats(adminUser)
  assert(stats.totalRemissions >= 0, 'Stats returned total remissions count')
  assert(stats.uniqueCustomers >= 0, 'Stats returned unique customers count')

  const listRes = await remissionService.list({}, adminUser)
  assert(Array.isArray(listRes.data), 'Listing remissions returns data array')
  console.log(`Found ${listRes.total} total remissions in database.`)

  // 2. Manual Remission Creation
  console.log('\n--- 2. Testing Manual Remission Creation ---')
  const newManualRem = await remissionService.create(
    {
      customerId: 'cust-001',
      customerName: 'Comercializadora El Sol S.A.S.',
      customerDoc: '900123456-1',
      locationId: 'loc-001',
      deliveryAddress: 'Cra 15 # 45-20, Muelle 2',
      deliveryCity: 'Bogotá, D.C.',
      contactPerson: 'Hernán Correa',
      contactPhone: '+57 300 123 4567',
      notes: 'Remisión creada manualmente en prueba',
      status: 'CREATED',
      items: [
        {
          productId: 'prod-001',
          productName: 'Arroz Diana Tradicional 1000g',
          sku: 'SKU-001842',
          quantityRequested: 30,
          unitCost: 3400,
          unitPrice: 4200,
        },
      ],
    },
    adminUser
  )

  assert(Boolean(newManualRem.id), `Manual remission created with ID ${newManualRem.id}`)
  assert(newManualRem.status === 'CREATED', 'Remission status set to CREATED')
  assert(newManualRem.totalUnits === 30, 'Total units correctly calculated (30)')

  // 3. Creation from Confirmed Sale
  console.log('\n--- 3. Testing Create Remission from Sale ---')
  const pendingSales = await remissionService.getSalesPendingRemission(adminUser)
  console.log(`Found ${pendingSales.length} pending sales for remission generation.`)

  if (pendingSales.length > 0) {
    const saleToDeliver = pendingSales[0]
    const createdFromSale = await remissionService.createFromSale(
      {
        saleId: saleToDeliver.id,
        deliveryAddress: 'Sede Principal de Entrega',
        contactPerson: 'Jefe de Recepción',
        notes: 'Despacho generado en suite de pruebas',
      },
      adminUser
    )

    assert(Boolean(createdFromSale.id), `Remission from sale created with ID ${createdFromSale.id}`)
    assert(createdFromSale.saleId === saleToDeliver.id, 'Remission references originating sale ID')

    // Test duplicate prevention
    let duplicateBlocked = false
    try {
      await remissionService.createFromSale(
        {
          saleId: saleToDeliver.id,
        },
        adminUser
      )
    } catch (err) {
      duplicateBlocked = true
    }
    assert(duplicateBlocked, 'Duplicate remission generation for same sale was blocked')
  }

  // 4. Dispatch Logistics Workflow & Kardex Out
  console.log('\n--- 4. Testing Dispatch & Inventory Movement (REMISSION_OUT) ---')
  const initialKardexCount = (db.inventoryMovements as any[]).length

  const dispatched = await remissionService.dispatch(
    {
      remissionId: newManualRem.id,
      carrierName: 'Transportes Rápidos del Valle S.A.S.',
      vehiclePlate: 'TRL-890',
      driverName: 'Hernán Darío Correa',
      driverDoc: 'CC 79.845.120',
      notes: 'Despacho verificado con precinto 99201',
    },
    adminUser
  )

  assert(dispatched.status === 'DISPATCHED', 'Remission status changed to DISPATCHED')
  assert(dispatched.vehiclePlate === 'TRL-890', 'Vehicle plate recorded')
  assert(Boolean(dispatched.dispatchedAt), 'Dispatch timestamp recorded')

  const postDispatchKardexCount = (db.inventoryMovements as any[]).length
  assert(
    postDispatchKardexCount > initialKardexCount,
    'Inventory Kardex movement (REMISSION_OUT) generated upon dispatch'
  )

  const lastMovement = (db.inventoryMovements as any[])[0]
  assert(
    lastMovement.type === 'REMISSION_OUT',
    'Kardex movement type is REMISSION_OUT'
  )

  // 5. Customer Delivery Confirmation
  console.log('\n--- 5. Testing Delivery Confirmation ---')
  const delivered = await remissionService.deliver(
    {
      remissionId: newManualRem.id,
      receivedBy: 'Mauricio Gómez (Jefe Almacén)',
      receivedDoc: 'CC 80.123.456',
      deliveryEvidenceNotes: 'Mercancía recibida en muelle 2 con firma y sello.',
    },
    adminUser
  )

  assert(delivered.status === 'DELIVERED', 'Remission status changed to DELIVERED')
  assert(delivered.receivedBy === 'Mauricio Gómez (Jefe Almacén)', 'Received by metadata recorded')
  assert(
    delivered.items[0].quantityDelivered === delivered.items[0].quantityRequested,
    'Item quantityDelivered synchronized with quantityRequested'
  )

  // 6. Cancellation with Inventory Reversal
  console.log('\n--- 6. Testing Cancellation & Kardex Reversal (REMISSION_RETURN) ---')
  const preCancelKardexCount = (db.inventoryMovements as any[]).length

  const cancelled = await remissionService.cancel(
    {
      remissionId: newManualRem.id,
      reason: 'Cliente rechazó despacho por cambio de horario de recepción',
    },
    adminUser
  )

  assert(cancelled.status === 'CANCELLED', 'Remission status changed to CANCELLED')
  assert(Boolean(cancelled.cancelReason), 'Cancellation reason preserved')

  const postCancelKardexCount = (db.inventoryMovements as any[]).length
  assert(
    postCancelKardexCount > preCancelKardexCount,
    'Inventory Kardex reversal movement (REMISSION_RETURN) generated for cancelled dispatched remission'
  )

  const reversalMovement = (db.inventoryMovements as any[])[0]
  assert(
    reversalMovement.type === 'REMISSION_RETURN',
    'Kardex movement type is REMISSION_RETURN'
  )

  // 7. Audit Log Verification
  console.log('\n--- 7. Testing Audit Logging ---')
  const latestAudit = (db.auditLogs as any[])[0]
  assert(
    latestAudit && (latestAudit.entityType === 'REMISSION' || latestAudit.entity === 'Remission'),
    'Audit log recorded for remission action'
  )

  // 8. RBAC Permissions Verification
  console.log('\n--- 8. Testing RBAC Security & Permissions ---')
  let rbacBlocked = false
  try {
    await remissionService.dispatch(
      {
        remissionId: newManualRem.id,
        carrierName: 'Test',
        driverName: 'Test',
      },
      restrictedUser
    )
  } catch (err: any) {
    rbacBlocked = err.message.includes('Acceso denegado')
  }
  assert(rbacBlocked, 'Restricted user without remission.dispatch permission was blocked')

  console.log('\n========================================================')
  console.log('🎉 ALL REMISSIONS MODULE LOGIC & INTEGRATION TESTS PASSED!')
  console.log('========================================================\n')
}

runRemissionsTestSuite().catch((err) => {
  console.error('❌ Test suite failed:', err)
  process.exit(1)
})
