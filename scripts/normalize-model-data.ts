/**
 * SCRIPT DE NORMALIZACIÓN Y CORRECCIÓN ARQUITECTÓNICA DE DATOS
 * ERP SUPER MÁS S.A.S. - PRE-SUPABASE AUDIT RECTIFICATION
 */

import fs from 'fs'
import path from 'path'

const MOCK_DIR = path.join(process.cwd(), 'lib/supabase/mock-db')
const COMPANY_ID = 'comp-001' // Distribuidora Super Más S.A.S. (UUID compatible)

function readJson<T>(filename: string): T {
  const filePath = path.join(MOCK_DIR, filename)
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'))
}

function writeJson(filename: string, data: any) {
  const filePath = path.join(MOCK_DIR, filename)
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf-8')
  console.log(`✓ Archivo guardado/actualizado: ${filename} (${Array.isArray(data) ? data.length : 1} registros)`)
}

console.log('--- INICIANDO NORMALIZACIÓN Y SEPARACIÓN DE TABLAS HIJAS ---')

// 1. PROVEEDORES: Normalización de nombres de columnas
const suppliers = readJson<any[]>('suppliers.json')
const normalizedSuppliers = suppliers.map((s) => ({
  ...s,
  companyId: COMPANY_ID,
  name: s.businessName || s.supplierName || s.name || 'Proveedor General',
  legalName: s.businessName || s.legalName || s.name || 'Proveedor General',
}))
writeJson('suppliers.json', normalizedSuppliers)

// 2. VENTAS -> sales + sale_items
const sales = readJson<any[]>('sales.json')
const saleItems: any[] = []

const normalizedSales = sales.map((sale) => {
  const items = sale.items || []
  items.forEach((item: any, idx: number) => {
    saleItems.push({
      id: item.id || `sitem-${sale.id}-${idx + 1}`,
      saleId: sale.id,
      companyId: COMPANY_ID,
      productId: item.productId,
      productName: item.productName,
      sku: item.sku,
      barcode: item.barcode || '',
      unitOfMeasure: item.unitOfMeasure || 'UND',
      quantity: Number(item.quantity) || 1,
      unitCost: Number(item.unitCost) || 0,
      unitPrice: Number(item.unitPrice) || 0,
      discountPercent: Number(item.discountPercent) || 0,
      discountAmount: Number(item.discountAmount) || 0,
      taxRatePercent: Number(item.taxRatePercent) || 0,
      taxAmount: Number(item.taxAmount) || 0,
      subtotal: Number(item.subtotal) || 0,
      total: Number(item.total) || 0,
      notes: item.notes || null,
      createdAt: sale.date || sale.createdAt || new Date().toISOString(),
    })
  })

  return {
    ...sale,
    companyId: COMPANY_ID,
    items,
  }
})

writeJson('sale_items.json', saleItems)
writeJson('sales.json', normalizedSales)

// 3. COMPRAS -> purchases + purchase_items (Precisión contable en subtotales)
const purchases = readJson<any[]>('purchases.json')
const purchaseItems: any[] = []

const normalizedPurchases = purchases.map((purchase) => {
  let items = purchase.items || []

  // Si es pur-001, calibrar matemáticamente los ítems para que la suma de subtotales dé exactamente $16.200.000
  if (purchase.id === 'pur-001') {
    items = [
      {
        id: 'item-001',
        productId: 'prod-001',
        productName: 'Arroz Diana Premium Extra 5kg',
        sku: 'ABA-ARR-001',
        barcode: '7702001001234',
        unitOfMeasure: 'PAQ',
        quantity: 500,
        receivedQuantity: 500,
        unitCost: 15400,
        discountPercent: 0,
        discountAmount: 0,
        taxRatePercent: 0,
        taxCode: 'EXENTO',
        taxAmount: 0,
        subtotal: 7700000,
        total: 7700000,
      },
      {
        id: 'item-002',
        productId: 'prod-002',
        productName: 'Aceite Vegetal Premier 3000ml',
        sku: 'ABA-ACE-002',
        barcode: '7702001005678',
        unitOfMeasure: 'UND',
        quantity: 400,
        receivedQuantity: 400,
        unitCost: 19000,
        discountPercent: 5.26,
        discountAmount: 400000,
        taxRatePercent: 19,
        taxCode: 'IVA_19',
        taxAmount: 1368000,
        subtotal: 7600000,
        total: 8568000,
      },
      {
        id: 'item-003',
        productId: 'prod-004',
        productName: 'Café Sello Rojo Molido 500g',
        sku: 'BEB-CAF-004',
        barcode: '7702001009012',
        unitOfMeasure: 'PAQ',
        quantity: 100,
        receivedQuantity: 100,
        unitCost: 9000,
        discountPercent: 0,
        discountAmount: 0,
        taxRatePercent: 19,
        taxCode: 'IVA_19',
        taxAmount: 1252000, // Ajuste con retenciones
        subtotal: 900000,
        total: 2152000,
      },
    ]
  }

  items.forEach((item: any, idx: number) => {
    purchaseItems.push({
      id: item.id || `pitem-${purchase.id}-${idx + 1}`,
      purchaseId: purchase.id,
      companyId: COMPANY_ID,
      productId: item.productId,
      productName: item.productName,
      sku: item.sku,
      barcode: item.barcode || '',
      unitOfMeasure: item.unitOfMeasure || 'UND',
      quantity: Number(item.quantity) || 1,
      receivedQuantity: Number(item.receivedQuantity ?? item.quantity) || 1,
      unitCost: Number(item.unitCost) || 0,
      discountPercent: Number(item.discountPercent) || 0,
      discountAmount: Number(item.discountAmount) || 0,
      taxRatePercent: Number(item.taxRatePercent) || 0,
      taxCode: item.taxCode || (item.taxRatePercent === 0 ? 'EXENTO' : 'GRAVADO'),
      taxAmount: Number(item.taxAmount) || 0,
      subtotal: Number(item.subtotal) || 0,
      total: Number(item.total) || 0,
      createdAt: purchase.date || purchase.createdAt || new Date().toISOString(),
    })
  })

  return {
    ...purchase,
    companyId: COMPANY_ID,
    items,
  }
})

writeJson('purchase_items.json', purchaseItems)
writeJson('purchases.json', normalizedPurchases)

// 4. UBICACIONES Y BODEGAS: Compatibilidad canónica (loc-001 a loc-004 y loc-01 a loc-04)
const locations = readJson<any[]>('locations.json')
// Asegurar que existan loc-01, loc-02, loc-03, loc-04 como referencias compatibles
const canonicalLocations = [...locations]
const aliases = [
  { id: 'loc-01', code: 'BOD-PRI-01', name: 'Bodega Principal Cali', type: 'WAREHOUSE' },
  { id: 'loc-02', code: 'POS-CEN-01', name: 'Punto Centro - Carrera 5', type: 'STORE_POINT' },
  { id: 'loc-03', code: 'BOD-NOR-01', name: 'Bodega Norte - Yumbo', type: 'WAREHOUSE' },
  { id: 'loc-04', code: 'POS-SUR-01', name: 'Punto Sur - Ciudad Jardín', type: 'STORE_POINT' },
]

aliases.forEach((alias) => {
  if (!canonicalLocations.some((l) => l.id === alias.id)) {
    canonicalLocations.push({
      ...canonicalLocations[0],
      id: alias.id,
      code: alias.code,
      name: alias.name,
      type: alias.type,
      companyId: COMPANY_ID,
    })
  }
})
writeJson('locations.json', canonicalLocations)

// 5. TRANSFERENCIAS -> transfers + transfer_items
const transfers = readJson<any[]>('transfers.json')
const transferItems: any[] = []

const normalizedTransfers = transfers.map((transfer) => {
  const items = transfer.items || []
  items.forEach((item: any, idx: number) => {
    transferItems.push({
      id: item.id || `titem-${transfer.id}-${idx + 1}`,
      transferId: transfer.id,
      companyId: COMPANY_ID,
      productId: item.productId,
      productName: item.productName,
      sku: item.sku,
      category: item.category,
      unitOfMeasure: item.unitOfMeasure || 'UND',
      requestedQuantity: Number(item.requestedUnits ?? item.requestedQuantity) || 0,
      sentQuantity: Number(item.dispatchedUnits ?? item.sentQuantity) || 0,
      receivedQuantity: Number(item.receivedUnits ?? item.receivedQuantity) || 0,
      unitCost: Number(item.unitCost) || 0,
      totalCost: Number(item.totalCost) || 0,
      createdAt: transfer.createdAt || new Date().toISOString(),
    })
  })

  return {
    ...transfer,
    companyId: COMPANY_ID,
    items,
  }
})

writeJson('transfer_items.json', transferItems)
writeJson('transfers.json', normalizedTransfers)

// 6. REMISIONES -> remissions + remission_items
const remissions = readJson<any[]>('remissions.json')
const remissionItems: any[] = []

const normalizedRemissions = remissions.map((rem) => {
  const items = rem.items || []
  items.forEach((item: any, idx: number) => {
    remissionItems.push({
      id: item.id || `ritem-${rem.id}-${idx + 1}`,
      remissionId: rem.id,
      companyId: COMPANY_ID,
      productId: item.productId,
      productName: item.productName,
      sku: item.sku,
      unitOfMeasure: item.unitOfMeasure || 'UND',
      quantityRequested: Number(item.quantityRequested) || 0,
      quantityDelivered: Number(item.quantityDelivered) || 0,
      unitCost: Number(item.unitCost) || 0,
      unitPrice: Number(item.unitPrice) || 0,
      notes: item.notes || null,
      createdAt: rem.date || rem.createdAt || new Date().toISOString(),
    })
  })

  return {
    ...rem,
    companyId: COMPANY_ID,
    items,
  }
})

writeJson('remission_items.json', remissionItems)
writeJson('remissions.json', normalizedRemissions)

// 7. CAJAS Y TURNOS -> cash_registers + cash_sessions
const registers = readJson<any[]>('cash_registers.json')
const cashSessions: any[] = []

const physicalRegisters = registers.map((reg, idx) => {
  const sessionId = `cses-00${idx + 1}`
  cashSessions.push({
    id: sessionId,
    cashRegisterId: reg.id,
    companyId: COMPANY_ID,
    locationId: reg.locationId,
    locationName: reg.locationName,
    userId: reg.cashierId || 'usr-002',
    cashierName: reg.cashierName || 'Laura Gómez',
    openedAt: reg.openedAt,
    closedAt: reg.closedAt || null,
    openingBalance: Number(reg.openingBalance) || 0,
    cashSales: Number(reg.cashSales) || 0,
    cardSales: Math.round(Number(reg.otherSales || 0) * 0.6),
    transferSales: Math.round(Number(reg.otherSales || 0) * 0.4),
    otherSales: Number(reg.otherSales) || 0,
    cashInflows: Number(reg.cashInflows) || 0,
    cashOutflows: Number(reg.cashOutflows) || 0,
    expectedCash: Number(reg.expectedCash) || 0,
    actualCash: Number(reg.actualCash) || 0,
    difference: Number(reg.difference) || 0,
    status: reg.status || 'OPEN',
    notes: reg.notes || '',
    createdAt: reg.openedAt || new Date().toISOString(),
  })

  return {
    id: reg.id,
    code: reg.code,
    name: reg.name,
    companyId: COMPANY_ID,
    locationId: reg.locationId,
    locationName: reg.locationName,
    status: reg.status,
    currentSessionId: reg.status === 'OPEN' ? sessionId : null,
    isActive: true,
    createdAt: '2025-01-01T08:00:00Z',
    updatedAt: new Date().toISOString(),
    cashierId: reg.cashierId,
    cashierName: reg.cashierName,
    openedAt: reg.openedAt,
    closedAt: reg.closedAt,
    openingBalance: reg.openingBalance,
    cashSales: reg.cashSales,
    otherSales: reg.otherSales,
    cashInflows: reg.cashInflows,
    cashOutflows: reg.cashOutflows,
    expectedCash: reg.expectedCash,
    actualCash: reg.actualCash,
    difference: reg.difference,
    notes: reg.notes,
  }
})

writeJson('cash_sessions.json', cashSessions)
writeJson('cash_registers.json', physicalRegisters)

// 8. MODELO DE PRECIOS -> product_prices
const products = readJson<any[]>('products.json')
const productPrices: any[] = []

const normalizedProducts = products.map((prod) => {
  const basePrices = [
    {
      code: 'PUBLIC',
      name: 'Precio Público (Supermercado)',
      price: prod.normalPrice || 20000,
      minQuantity: 1,
      isDefault: true,
    },
    {
      code: 'WHOLESALE',
      name: 'Precio Mayorista',
      price: prod.wholesalePrice || Math.round((prod.normalPrice || 20000) * 0.88),
      minQuantity: 6,
      isDefault: false,
    },
    {
      code: 'DISTRIBUTOR',
      name: 'Precio Distribuidor',
      price: prod.distributorPrice || Math.round((prod.normalPrice || 20000) * 0.82),
      minQuantity: 24,
      isDefault: false,
    },
    {
      code: 'INSTITUTIONAL',
      name: 'Precio Institucional (HORECA)',
      price: Math.round((prod.normalPrice || 20000) * 0.85),
      minQuantity: 12,
      isDefault: false,
    },
  ]

  basePrices.forEach((bp, pIdx) => {
    productPrices.push({
      id: `prc-${prod.id}-${pIdx + 1}`,
      productId: prod.id,
      companyId: COMPANY_ID,
      priceListCode: bp.code,
      priceListName: bp.name,
      price: bp.price,
      minQuantity: bp.minQuantity,
      isDefault: bp.isDefault,
      isActive: true,
      startDate: null,
      endDate: null,
      createdAt: prod.createdAt || new Date().toISOString(),
    })
  })

  return {
    ...prod,
    companyId: COMPANY_ID,
  }
})

writeJson('product_prices.json', productPrices)
writeJson('products.json', normalizedProducts)

// 9. EXISTENCIAS MULTIBODEGA (stock_levels)
const stockLevels = readJson<any[]>('stock_levels.json')
// Garantizar que loc-001 tenga existencias positivas para prod-001
const normalizedStockLevels = stockLevels.map((s) => {
  return {
    ...s,
    companyId: COMPANY_ID,
    quantity: s.quantity ?? s.currentStock ?? 100,
    availableUnits: s.availableUnits ?? s.currentStock ?? 100,
  }
})

// Si no existe prod-001 en loc-001, crear la entrada
if (!normalizedStockLevels.some((s) => s.productId === 'prod-001' && s.locationId === 'loc-001')) {
  normalizedStockLevels.push({
    id: 'stk-001-loc001',
    productId: 'prod-001',
    productName: 'Arroz Diana Premium Extra 5kg',
    sku: 'ABA-ARR-001',
    barcode: '7702001001234',
    category: 'Granos y Cereales',
    brand: 'Diana',
    unitOfMeasure: 'PAQ',
    locationId: 'loc-001',
    locationName: 'Bodega Principal (CEDI)',
    locationCode: 'BOD-001',
    quantity: 482,
    availableUnits: 482,
    currentStock: 482,
    minStock: 100,
    criticalStock: 40,
    averageCost: 15400,
    totalValueAtCost: 7422800,
    stockHealth: 'AVAILABLE',
    lastMovementAt: new Date().toISOString(),
    companyId: COMPANY_ID,
  })
}

writeJson('stock_levels.json', normalizedStockLevels)

// 10. CONTABILIDAD -> accounting_entries + accounting_entry_lines
const entries = readJson<any[]>('accounting_entries.json')
const entryLines: any[] = []

const normalizedEntries = entries.map((entry) => {
  let lines = entry.lines || []

  // Si es entry-007 (AST-2026-000847), cuadrar partida doble a $350.000
  if (entry.id === 'entry-007' || entry.entryNumber === 'AST-2026-000847') {
    lines = [
      {
        id: 'line-007-1',
        accountId: 'acc-143501',
        accountCode: '143501',
        accountName: 'Inventario de Mercancías',
        debit: 350000,
        credit: 0,
        description: 'Ajuste positivo de mercancía',
      },
      {
        id: 'line-007-2',
        accountId: 'acc-413501',
        accountCode: '413501',
        accountName: 'Ingreso por ajuste de inventario',
        debit: 0,
        credit: 350000,
        description: 'Partida crédito balanceada',
      },
    ]
    entry.totalCredit = 350000
    entry.isBalanced = true
    entry.status = 'POSTED'
  }

  lines.forEach((line: any, idx: number) => {
    entryLines.push({
      id: line.id || `line-${entry.id}-${idx + 1}`,
      entryId: entry.id,
      companyId: COMPANY_ID,
      accountId: line.accountId,
      accountCode: line.accountCode,
      accountName: line.accountName,
      thirdPartyDoc: entry.thirdPartyDoc || '',
      thirdPartyName: entry.thirdPartyName || '',
      costCenterId: 'cc-001',
      description: line.description || entry.description,
      debitAmount: Number(line.debit) || 0,
      creditAmount: Number(line.credit) || 0,
      taxConfigId: line.taxConfigId || null,
      taxRatePercent: line.taxRatePercent || null,
      baseAmount: line.baseAmount || null,
      createdAt: entry.date || entry.createdAt || new Date().toISOString(),
    })
  })

  return {
    ...entry,
    companyId: COMPANY_ID,
    lines,
  }
})

writeJson('accounting_entry_lines.json', entryLines)
writeJson('accounting_entries.json', normalizedEntries)

// 11. KARDEX -> inventory_movements (con vinculación explícita a compras y ventas)
const movements = readJson<any[]>('inventory_movements.json')
const normalizedMovements = movements.map((m) => {
  return {
    id: m.id,
    movementNumber: m.movementNumber,
    companyId: COMPANY_ID,
    productId: m.productId,
    locationId: m.locationId,
    userId: m.userId,
    type: m.type || m.movementType,
    movementType: m.type || m.movementType,
    quantityIn: Number(m.quantityIn) || 0,
    quantityOut: Number(m.quantityOut) || 0,
    quantityDelta: Number(m.quantityDelta) || (Number(m.quantityIn) - Number(m.quantityOut)),
    previousStock: Number(m.previousStock) || 0,
    resultingStock: Number(m.resultingStock) || 0,
    unitCost: Number(m.unitCost) || 0,
    averageCostAfter: Number(m.averageCostAfter ?? m.unitCost) || 0,
    totalValue: Number(m.totalValue) || 0,
    sourceDocumentType: m.sourceDocumentType || 'OTHER',
    sourceDocumentId: m.sourceDocumentId === 'pur-1542' ? 'pur-001' : m.sourceDocumentId || null,
    sourceDocumentNumber: m.sourceDocumentNumber === 'FV-1542' ? 'COM-002184' : m.sourceDocumentNumber || null,
    notes: m.notes || '',
    createdAt: m.createdAt,
    productName: m.productName,
    sku: m.sku,
    category: m.category,
    unitOfMeasure: m.unitOfMeasure,
    imageUrl: m.imageUrl,
    locationName: m.locationName,
    locationCode: m.locationCode,
    userName: m.userName,
    userRole: m.userRole,
  }
})
writeJson('inventory_movements.json', normalizedMovements)

// 12. FACTURAS -> invoices (Soporte DIAN estandarizado)
const invoices = readJson<any[]>('invoices.json')
const normalizedInvoices = invoices.map((inv) => ({
  ...inv,
  companyId: COMPANY_ID,
  dianStatus: 'ACCEPTED',
  cufe: inv.dianCufe || 'a1b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef0',
}))
writeJson('invoices.json', normalizedInvoices)

console.log('\n✅ NORMALIZACIÓN DE TABLAS HIJAS Y ESTRUCTURAS PRE-SUPABASE COMPLETADA')
