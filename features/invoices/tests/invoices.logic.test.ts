import { invoiceService } from '../services/invoice.service'
import { invoiceCalculationService } from '../services/invoice-calculation.service'
import { invoiceRepository } from '../repositories/invoice.repository'
import { InvoiceUserContext } from '../types'
import { db } from '@/lib/supabase'

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`❌ Assertion failed: ${message}`)
  }
  console.log(`✅ Passed: ${message}`)
}

async function runInvoicesTestSuite() {
  console.log('========================================================')
  console.log('🧪 RUNNING SUPER MÁS FACTURACIÓN (INVOICING) TEST SUITE')
  console.log('========================================================\n')

  const adminUser: InvoiceUserContext = {
    userId: 'usr-admin-test',
    userName: 'Mauricio Test Admin',
    userRole: 'Administrador',
    permissions: [
      'invoice.read',
      'invoice.create',
      'invoice.send_dian',
      'invoice.download',
      'invoice.cancel',
      'invoice.credit_note',
      'invoice.export',
    ],
  }

  const restrictedUser: InvoiceUserContext = {
    userId: 'usr-cashier-test',
    userName: 'Cajero Junior',
    userRole: 'Cajero',
    permissions: ['invoice.read'],
  }

  // 1. Test Tax Calculation Service
  console.log('--- 1. Testing Tax Calculations & CUFE ---')
  const sampleItems = [
    {
      unitPrice: 100000,
      quantity: 2,
      discountPercent: 10,
      discountAmount: 20000,
      taxRatePercent: 19,
      taxCode: 'IVA_19',
    },
    {
      unitPrice: 50000,
      quantity: 1,
      discountPercent: 0,
      discountAmount: 0,
      taxRatePercent: 0,
      taxCode: 'EXENTO',
    },
  ]

  const calculated = invoiceCalculationService.calculateInvoiceTotals(sampleItems)
  assert(calculated.subtotal === 230000, 'Subtotal correctly computed (180,000 + 50,000 = 230,000)')
  assert(calculated.taxTotal === 34200, 'IVA 19% on 180,000 correctly computed (34,200)')
  assert(calculated.total === 264200, 'Total computed as subtotal + taxes (264,200)')
  assert(calculated.taxesBreakdown.length === 2, 'Taxes breakdown correctly separated by tax rate')

  const cufe = invoiceCalculationService.generateCUFE(
    'FAC-2026-9999',
    264200,
    new Date().toISOString(),
    '900123456-1'
  )
  assert(typeof cufe === 'string' && cufe.length === 64, 'CUFE is a valid 64-character hash')

  const xml = invoiceCalculationService.generateDIANXml(
    'FAC-2026-9999',
    'Cliente Prueba S.A.S.',
    '900123456-1',
    264200,
    cufe
  )
  assert(xml.includes('<Invoice') && xml.includes(cufe), 'XML includes UBL 2.1 root and CUFE node')

  // 2. Test Listing and Stats
  console.log('\n--- 2. Testing Repository & Service Listing ---')
  const stats = await invoiceService.getInvoiceStats(adminUser)
  assert(stats.totalGenerated >= 0, 'Stats returned total generated count')
  assert(stats.totalAmountBilled >= 0, 'Stats returned total amount billed')

  const listRes = await invoiceService.list({}, adminUser)
  assert(Array.isArray(listRes.data), 'Listing invoices returns data array')

  // 3. Test Generating Invoice from Sale
  console.log('\n--- 3. Testing Generate Invoice from Sale ---')
  const pendingSales = await invoiceService.getSalesPendingInvoicing(adminUser)
  console.log(`Found ${pendingSales.length} pending sales available for invoicing.`)

  if (pendingSales.length > 0) {
    const saleToInvoice = pendingSales[0]
    const generated = await invoiceService.generateFromSale(
      {
        saleId: saleToInvoice.id,
        type: 'ELECTRONICA',
        sendToDianImmediately: true,
        notes: 'Factura generada en test automatizado',
      },
      adminUser
    )

    assert(Boolean(generated.id), `Invoice generated with ID ${generated.id}`)
    assert(generated.saleId === saleToInvoice.id, 'Invoice references originating sale ID')
    assert(generated.type === 'ELECTRONICA', 'Invoice type set to ELECTRONICA')
    assert(generated.dianStatus === 'ACEPTADA', 'Immediate DIAN transmission accepted')
    assert(Boolean(generated.dianCufe), 'CUFE successfully generated and attached')

    // Test duplicate prevention
    let duplicatePrevented = false
    try {
      await invoiceService.generateFromSale(
        {
          saleId: saleToInvoice.id,
          type: 'ELECTRONICA',
        },
        adminUser
      )
    } catch (err) {
      duplicatePrevented = true
    }
    assert(duplicatePrevented, 'Duplicate invoice generation for same sale was blocked')

    // 4. Test Credit Note Creation
    console.log('\n--- 4. Testing Credit Note & Kardex Movement ---')
    const initialKardexCount = (db.inventoryMovements as any[]).length
    const creditNote = await invoiceService.createCreditNote(
      {
        invoiceId: generated.id,
        reason: 'DEVOLUCION_TOTAL',
        notes: 'Mercancía en mal estado reportada por el cliente',
        adjustInventory: true,
        sendToDianImmediately: true,
        items: generated.items.map((it) => ({
          productId: it.productId,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          taxRatePercent: it.taxRatePercent,
        })),
      },
      adminUser
    )

    assert(creditNote.type === 'NOTA_CREDITO', 'Credit Note created with NOTA_CREDITO type')
    assert(creditNote.originalInvoiceId === generated.id, 'Credit Note references original invoice')
    assert(creditNote.dianStatus === 'ACEPTADA', 'Credit note electronically accepted by DIAN')

    const finalKardexCount = (db.inventoryMovements as any[]).length
    assert(
      finalKardexCount > initialKardexCount,
      'Inventory Kardex movement (RETURN_IN) automatically generated for credit note'
    )

    // 5. Test Cancellation
    console.log('\n--- 5. Testing Invoice Cancellation ---')
    const cancelled = await invoiceService.cancelInvoice(
      {
        invoiceId: generated.id,
        reason: 'Anulación autorizada por gerencia tras nota de crédito',
      },
      adminUser
    )
    assert(cancelled.status === 'CANCELLED', 'Invoice status updated to CANCELLED')
    assert(Boolean(cancelled.cancelReason), 'Cancellation reason preserved')

    // Verify audit log
    const latestAudit = (db.auditLogs as any[])[0]
    assert(
      latestAudit && (latestAudit.entityType === 'INVOICE' || latestAudit.entity === 'Invoice'),
      'Audit log recorded for invoice cancellation'
    )
  }

  // 6. Test RBAC Permissions
  console.log('\n--- 6. Testing RBAC Security & Permissions ---')
  let rbacBlocked = false
  try {
    await invoiceService.cancelInvoice(
      { invoiceId: 'inv-any', reason: 'Test' },
      restrictedUser
    )
  } catch (err: any) {
    rbacBlocked = err.message.includes('Acceso denegado')
  }
  assert(rbacBlocked, 'Restricted user without invoice.cancel permission was blocked')

  console.log('\n========================================================')
  console.log('🎉 ALL INVOICING MODULE LOGIC & INTEGRATION TESTS PASSED!')
  console.log('========================================================\n')
}

runInvoicesTestSuite().catch((err) => {
  console.error('❌ Test suite failed:', err)
  process.exit(1)
})
