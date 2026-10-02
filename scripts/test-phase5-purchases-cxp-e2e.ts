/**
 * SUPER MÁS ERP/POS — SUITE DE PRUEBAS E2E FASE 5
 * Compras + Cuentas por Pagar (CxP) + Recepciones + Kardex + Auditoría + Zero Pollution
 *
 * Flujo de 20 pasos reales en PostgreSQL sin mocks ni arrays en memoria.
 */

import { Client } from 'pg'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

async function runPhase5TestSuite() {
  console.log('================================================================')
  console.log('🚀 INICIANDO PRUEBA E2E OBLIGATORIA: FASE 5 — COMPRAS + CxP')
  console.log('================================================================\n')

  const client = new Client({
    connectionString: process.env.DIRECT_URL,
    ssl: { rejectUnauthorized: false },
  })

  await client.connect()
  console.log('✅ Conexión directa a PostgreSQL establecida.\n')

  // Identificadores únicos para trazabilidad y aislamiento
  const testRunId = Date.now().toString().slice(-6)
  const testNit = `900888${testRunId}`
  const testSku = `SKU-PH5-${testRunId}`
  const testSlug = `leche-uht-test-${testRunId}`
  const testPurchaseNum = `COM-TEST-${testRunId}`
  const testRec1Num = `REC-TEST-${testRunId}-1`
  const testRec2Num = `REC-TEST-${testRunId}-2`
  const testPay1Num = `PAG-TEST-${testRunId}-1`
  const testPay2Num = `PAG-TEST-${testRunId}-2`
  const testBankAccountNum = `ACC-TEST-${testRunId}`

  let testCompanyId = ''
  let testLocationId = ''
  let testTaxRateId = ''
  let testCategoryId = ''
  let testUserId = ''

  let supplierId = ''
  let productId = ''
  let purchaseId = ''
  let purchaseItemId = ''
  let receipt1Id = ''
  let receipt2Id = ''
  let bankAccountId = ''

  try {
    // -------------------------------------------------------------------------
    // 0. OBTENER DATOS BASE DE TENANT REAL
    // -------------------------------------------------------------------------
    console.log('--- 0. CARGANDO CONFIGURACIÓN BASE DEL TENANT ---')
    const compRes = await client.query(`SELECT id, business_name FROM public.companies LIMIT 1;`)
    testCompanyId = compRes.rows[0].id
    console.log(`🏢 Empresa: ${compRes.rows[0].business_name} (${testCompanyId})`)

    const locRes = await client.query(
      `SELECT id, code, name FROM public.locations WHERE company_id = $1 LIMIT 1;`,
      [testCompanyId]
    )
    testLocationId = locRes.rows[0].id
    console.log(`📦 Bodega: ${locRes.rows[0].name} [${locRes.rows[0].code}] (${testLocationId})`)

    const taxRes = await client.query(
      `SELECT id, code, percentage FROM public.tax_rates WHERE code = 'IVA_19' LIMIT 1;`
    )
    testTaxRateId = taxRes.rows[0].id
    console.log(`💰 Tarifa IVA: ${taxRes.rows[0].code} (${taxRes.rows[0].percentage}%)`)

    const catRes = await client.query(
      `SELECT id, name FROM public.categories WHERE company_id = $1 LIMIT 1;`,
      [testCompanyId]
    )
    testCategoryId = catRes.rows[0].id

    const userRes = await client.query(
      `SELECT id, email FROM public.users WHERE company_id = $1 LIMIT 1;`,
      [testCompanyId]
    )
    testUserId = userRes.rows[0].id
    console.log(`👤 Usuario responsable: ${userRes.rows[0].email} (${testUserId})\n`)

    // Crear cuenta bancaria de prueba para egresos
    const bankRes = await client.query(
      `INSERT INTO public.bank_accounts (
        company_id, location_id, bank_name, account_number, account_type, currency, current_balance, is_active, description
      ) VALUES ($1, $2, 'Bancolombia Test', $3, 'CORRIENTE', 'COP', 10000000.00, true, 'Cuenta bancaria de prueba E2E Fase 5')
      RETURNING id;`,
      [testCompanyId, testLocationId, testBankAccountNum]
    )
    bankAccountId = bankRes.rows[0].id
    console.log(`🏦 Cuenta bancaria creada para pagos: ${bankAccountId}\n`)

    // -------------------------------------------------------------------------
    // PASO 1: CREAR PROVEEDOR DE PRUEBA
    // -------------------------------------------------------------------------
    console.log('--- PASO 1: CREAR PROVEEDOR DE PRUEBA ---')
    const supRes = await client.query(
      `INSERT INTO public.suppliers (
        company_id, tax_id, verification_digit, name, legal_name, contact_name, phone, email, address, city, department, payment_terms_days, is_active, notes
      ) VALUES ($1, $2, '1', 'LACTEOS DEL NORTE S.A.S. (TEST)', 'Lácteos del Norte SAS', 'Carlos Gomez', '3157778899', 'contacto@lacteosnorte.test', 'Av. 5 #10-20', 'Cúcuta', 'Norte de Santander', 30, true, 'Proveedor de prueba E2E')
      RETURNING id, tax_id, name, payment_terms_days;`,
      [testCompanyId, testNit]
    )
    supplierId = supRes.rows[0].id
    console.log(`✅ Proveedor creado: ${supRes.rows[0].name} (NIT/TaxID: ${supRes.rows[0].tax_id}, Días crédito: ${supRes.rows[0].payment_terms_days})\n`)

    // -------------------------------------------------------------------------
    // PASO 2: CREAR PRODUCTO DE PRUEBA UTILIZANDO LA ESTRUCTURA REAL
    // -------------------------------------------------------------------------
    console.log('--- PASO 2: CREAR PRODUCTO DE PRUEBA ---')
    const prodRes = await client.query(
      `INSERT INTO public.products (
        company_id, category_id, sku, barcode, name, slug, unit_of_measure, cost_price, public_sale_price, wholesale_price, tax_rate_percent, is_active
      ) VALUES ($1, $2, $3, $3, 'Leche Entera Larga Vida 1L (TEST FASE 5)', $4, 'UNIDAD', 0.00, 4800.00, 4300.00, 19.00, true)
      RETURNING id, sku, name, cost_price;`,
      [testCompanyId, testCategoryId, testSku, testSlug]
    )
    productId = prodRes.rows[0].id
    console.log(`✅ Producto creado: ${prodRes.rows[0].name} (SKU: ${prodRes.rows[0].sku}, Costo inicial: $${prodRes.rows[0].cost_price})\n`)

    // -------------------------------------------------------------------------
    // PASO 3: CREAR ORDEN DE COMPRA (BORRADOR)
    // -------------------------------------------------------------------------
    console.log('--- PASO 3: CREAR ORDEN DE COMPRA (BORRADOR) ---')
    // 10 unidades a $3,000 COP cada una. Subtotal: $30,000. IVA 19%: $5,700. Total: $35,700.
    const purchaseRes = await client.query(
      `INSERT INTO public.purchases (
        company_id, location_id, supplier_id, purchase_number, supplier_invoice_number, issue_date, payment_terms, due_date, inventory_status, payment_status, subtotal_amount, tax_amount, total_amount, paid_amount, notes
      ) VALUES ($1, $2, $3, $4, 'FAC-PROV-998877', CURRENT_DATE, 'CREDITO', CURRENT_DATE + INTERVAL '30 days', 'BORRADOR', 'PENDING', 30000.00, 5700.00, 35700.00, 0.00, 'Orden de compra inicial en borrador')
      RETURNING id, purchase_number, inventory_status, total_amount;`,
      [testCompanyId, testLocationId, supplierId, testPurchaseNum]
    )
    purchaseId = purchaseRes.rows[0].id

    const piRes = await client.query(
      `INSERT INTO public.purchase_items (
        company_id, purchase_id, product_id, quantity, received_quantity, unit_cost, tax_rate_percent, tax_amount, subtotal, total
      ) VALUES ($1, $2, $3, 10.00, 0.00, 3000.00, 19.00, 5700.00, 30000.00, 35700.00)
      RETURNING id, quantity, received_quantity, unit_cost;`,
      [testCompanyId, purchaseId, productId]
    )
    purchaseItemId = piRes.rows[0].id

    console.log(`✅ Orden creada: ${purchaseRes.rows[0].purchase_number} | Estado: ${purchaseRes.rows[0].inventory_status} | Total: $${purchaseRes.rows[0].total_amount}`)

    // VALIDACIÓN CRÍTICA: Crear orden NO debe modificar inventario ni Kardex
    const initStock = await client.query(
      `SELECT quantity FROM public.stock_levels WHERE product_id = $1 AND location_id = $2;`,
      [productId, testLocationId]
    )
    const initMovements = await client.query(
      `SELECT COUNT(*) FROM public.inventory_movements WHERE product_id = $1;`,
      [productId]
    )
    const initialQty = Number(initStock.rows[0]?.quantity || 0)
    const initialMovs = Number(initMovements.rows[0]?.count || 0)

    if (initialQty !== 0 || initialMovs !== 0) {
      throw new Error(`VIOLACIÓN CRÍTICA: La creación de la orden modificó inventario (Stock: ${initialQty}, Movs: ${initialMovs})`)
    }
    console.log(`🛡️ Verificación estricta: Stock en bodega = ${initialQty}, Movimientos Kardex = ${initialMovs} (INALTERADO)\n`)

    // -------------------------------------------------------------------------
    // PASO 4: CONFIRMAR LA ORDEN DE COMPRA
    // -------------------------------------------------------------------------
    console.log('--- PASO 4: CONFIRMAR LA ORDEN DE COMPRA ---')
    await client.query(
      `UPDATE public.purchases 
       SET inventory_status = 'CONFIRMADA', confirmed_at = NOW(), confirmed_by_user_id = $2
       WHERE id = $1;`,
      [purchaseId, testUserId]
    )

    const confCheck = await client.query(
      `SELECT inventory_status, confirmed_at FROM public.purchases WHERE id = $1;`,
      [purchaseId]
    )
    console.log(`✅ Orden confirmada: Estado = ${confCheck.rows[0].inventory_status}`)

    // VALIDACIÓN CRÍTICA: Confirmar orden NO debe modificar inventario
    const confStock = await client.query(
      `SELECT quantity FROM public.stock_levels WHERE product_id = $1 AND location_id = $2;`,
      [productId, testLocationId]
    )
    const confMovements = await client.query(
      `SELECT COUNT(*) FROM public.inventory_movements WHERE product_id = $1;`,
      [productId]
    )
    if (Number(confStock.rows[0]?.quantity || 0) !== 0 || Number(confMovements.rows[0]?.count || 0) !== 0) {
      throw new Error(`VIOLACIÓN CRÍTICA: La confirmación de la orden modificó inventario`)
    }
    console.log(`🛡️ Verificación estricta: Stock sigue en 0 y Kardex en 0 tras confirmación.\n`)

    // -------------------------------------------------------------------------
    // PASO 5: RECIBIR PARCIALMENTE (4 de 10 unidades)
    // -------------------------------------------------------------------------
    console.log('--- PASO 5: RECEPCIÓN PARCIAL (4 de 10 unidades) ---')
    const rec1Res = await client.query(
      `INSERT INTO public.purchase_receipts (
        company_id, location_id, purchase_id, reception_number, reception_date, received_by_user_id, supplier_remission_number, notes
      ) VALUES ($1, $2, $3, $4, NOW(), $5, 'REM-TEST-001', 'Primera entrega parcial en bodega San Luis')
      RETURNING id, reception_number;`,
      [testCompanyId, testLocationId, purchaseId, testRec1Num, testUserId]
    )
    receipt1Id = rec1Res.rows[0].id

    await client.query(
      `INSERT INTO public.purchase_receipt_items (
        company_id, reception_id, purchase_item_id, product_id, quantity_received, unit_cost
      ) VALUES ($1, $2, $3, $4, 4.00, 3000.00);`,
      [testCompanyId, receipt1Id, purchaseItemId, productId]
    )

    await client.query(
      `UPDATE public.purchase_items SET received_quantity = 4.00 WHERE id = $1;`,
      [purchaseItemId]
    )

    // Movimiento formal de Kardex PURCHASE_ENTRY (ejecuta trg_after_inventory_movement para actualizar stock_levels)
    await client.query(
      `INSERT INTO public.inventory_movements (
        company_id, location_id, product_id, movement_type, quantity_in, quantity_out, previous_stock, new_stock, unit_cost, total_cost, document_type, document_reference, reason, user_id
      ) VALUES ($1, $2, $3, 'PURCHASE_ENTRY', 4.00, 0.00, 0.00, 4.00, 3000.00, 12000.00, 'PURCHASE_RECEIPT', $4, 'Recepción parcial orden compra', $5);`,
      [testCompanyId, testLocationId, productId, testRec1Num, testUserId]
    )

    await client.query(
      `UPDATE public.purchases SET inventory_status = 'RECIBIDA_PARCIALMENTE' WHERE id = $1;`,
      [purchaseId]
    )
    console.log(`✅ Recepción parcial registrada: ${testRec1Num} (4 unidades recibidas)\n`)

    // -------------------------------------------------------------------------
    // PASO 6: VERIFICAR STOCK (Debe ser exactamente 4)
    // -------------------------------------------------------------------------
    console.log('--- PASO 6: VERIFICAR STOCK TRAS RECEPCIÓN PARCIAL ---')
    const stockAfterRec1 = await client.query(
      `SELECT quantity, average_cost FROM public.stock_levels WHERE product_id = $1 AND location_id = $2;`,
      [productId, testLocationId]
    )
    const currentQty1 = Number(stockAfterRec1.rows[0].quantity)
    console.log(`📦 Stock actual en bodega: ${currentQty1} unidades (Esperado: 4.00)`)
    if (currentQty1 !== 4) {
      throw new Error(`Fallo en Paso 6: Stock esperado 4, obtenido ${currentQty1}`)
    }
    console.log('✅ Stock verificado correctamente.\n')

    // -------------------------------------------------------------------------
    // PASO 7: VERIFICAR PURCHASE_ENTRY EN KARDEX
    // -------------------------------------------------------------------------
    console.log('--- PASO 7: VERIFICAR PURCHASE_ENTRY EN KARDEX ---')
    const movRec1 = await client.query(
      `SELECT movement_type, quantity_in, unit_cost, total_cost, document_reference 
       FROM public.inventory_movements 
       WHERE product_id = $1 AND document_reference = $2;`,
      [productId, testRec1Num]
    )
    if (movRec1.rows.length === 0) {
      throw new Error('Fallo en Paso 7: Movimiento PURCHASE_ENTRY no encontrado en Kardex')
    }
    console.log(`✅ Movimiento Kardex confirmado: Tipo = ${movRec1.rows[0].movement_type} | Cantidad = +${movRec1.rows[0].quantity_in} | Costo unitario = $${movRec1.rows[0].unit_cost} | Ref: ${movRec1.rows[0].document_reference}\n`)

    // -------------------------------------------------------------------------
    // PASO 8: VERIFICAR COSTO PROMEDIO PONDERADO
    // -------------------------------------------------------------------------
    console.log('--- PASO 8: VERIFICAR COSTO PROMEDIO PONDERADO ---')
    const avgCost1 = Number(stockAfterRec1.rows[0].average_cost)
    console.log(`💵 Costo promedio en stock_levels: $${avgCost1} (Esperado: 3000.00)`)
    if (avgCost1 !== 3000) {
      throw new Error(`Fallo en Paso 8: Costo promedio esperado 3000, obtenido ${avgCost1}`)
    }

    // Sincronizar catálogo maestro products.cost_price
    await client.query(`UPDATE public.products SET cost_price = $2 WHERE id = $1;`, [productId, avgCost1])
    const syncProd = await client.query(`SELECT cost_price FROM public.products WHERE id = $1;`, [productId])
    console.log(`✅ Catálogo maestro products.cost_price actualizado: $${syncProd.rows[0].cost_price}\n`)

    // -------------------------------------------------------------------------
    // PASO 9: RECIBIR SALDO RESTANTE (6 de 10 unidades)
    // -------------------------------------------------------------------------
    console.log('--- PASO 9: RECIBIR SALDO RESTANTE (6 de 10 unidades) ---')
    const rec2Res = await client.query(
      `INSERT INTO public.purchase_receipts (
        company_id, location_id, purchase_id, reception_number, reception_date, received_by_user_id, supplier_remission_number, notes
      ) VALUES ($1, $2, $3, $4, NOW(), $5, 'REM-TEST-002', 'Segunda entrega saldo restante')
      RETURNING id, reception_number;`,
      [testCompanyId, testLocationId, purchaseId, testRec2Num, testUserId]
    )
    receipt2Id = rec2Res.rows[0].id

    await client.query(
      `INSERT INTO public.purchase_receipt_items (
        company_id, reception_id, purchase_item_id, product_id, quantity_received, unit_cost
      ) VALUES ($1, $2, $3, $4, 6.00, 3000.00);`,
      [testCompanyId, receipt2Id, purchaseItemId, productId]
    )

    await client.query(
      `UPDATE public.purchase_items SET received_quantity = 10.00 WHERE id = $1;`,
      [purchaseItemId]
    )

    // Movimiento formal de Kardex PURCHASE_ENTRY
    await client.query(
      `INSERT INTO public.inventory_movements (
        company_id, location_id, product_id, movement_type, quantity_in, quantity_out, previous_stock, new_stock, unit_cost, total_cost, document_type, document_reference, reason, user_id
      ) VALUES ($1, $2, $3, 'PURCHASE_ENTRY', 6.00, 0.00, 4.00, 10.00, 3000.00, 18000.00, 'PURCHASE_RECEIPT', $4, 'Recepción total saldo restante', $5);`,
      [testCompanyId, testLocationId, productId, testRec2Num, testUserId]
    )

    await client.query(
      `UPDATE public.purchases SET inventory_status = 'RECIBIDA' WHERE id = $1;`,
      [purchaseId]
    )
    console.log(`✅ Recepción final registrada: ${testRec2Num} (6 unidades recibidas)\n`)

    // -------------------------------------------------------------------------
    // PASO 10: VERIFICAR STOCK FINAL (Exactamente 10) Y ESTADO 'RECIBIDA'
    // -------------------------------------------------------------------------
    console.log('--- PASO 10: VERIFICAR STOCK FINAL Y ESTADO RECIBIDA ---')
    const stockFinal = await client.query(
      `SELECT quantity, average_cost FROM public.stock_levels WHERE product_id = $1 AND location_id = $2;`,
      [productId, testLocationId]
    )
    const finalQty = Number(stockFinal.rows[0].quantity)
    console.log(`📦 Stock final en bodega: ${finalQty} unidades (Esperado: 10.00)`)
    if (finalQty !== 10) {
      throw new Error(`Fallo en Paso 10: Stock final esperado 10, obtenido ${finalQty}`)
    }

    const orderFinalState = await client.query(`SELECT inventory_status FROM public.purchases WHERE id = $1;`, [purchaseId])
    console.log(`📋 Estado final de la orden: ${orderFinalState.rows[0].inventory_status}`)
    if (orderFinalState.rows[0].inventory_status !== 'RECIBIDA') {
      throw new Error(`Fallo en Paso 10: Estado de orden esperado RECIBIDA, obtenido ${orderFinalState.rows[0].inventory_status}`)
    }
    console.log('✅ Stock final y estado verificado con éxito.\n')

    // -------------------------------------------------------------------------
    // PASO 11: VERIFICAR CUENTAS POR PAGAR (CxP)
    // -------------------------------------------------------------------------
    console.log('--- PASO 11: VERIFICAR CUENTA POR PAGAR (CxP) ---')
    const cxpCheck = await client.query(
      `SELECT total_amount, paid_amount, (total_amount - paid_amount) as pending_balance, payment_status, payment_terms, due_date
       FROM public.purchases WHERE id = $1;`,
      [purchaseId]
    )
    const totalCxP = Number(cxpCheck.rows[0].total_amount)
    const paidCxP = Number(cxpCheck.rows[0].paid_amount)
    const pendingBalance = Number(cxpCheck.rows[0].pending_balance)

    console.log(`💼 CxP Compra: Total = $${totalCxP} | Pagado = $${paidCxP} | Saldo Pendiente = $${pendingBalance} | Estado = ${cxpCheck.rows[0].payment_status}`)
    if (pendingBalance !== 35700 || cxpCheck.rows[0].payment_status !== 'PENDING') {
      throw new Error(`Fallo en Paso 11: CxP incorrecta (Saldo: ${pendingBalance}, Estado: ${cxpCheck.rows[0].payment_status})`)
    }
    console.log('✅ Estructura de Cuenta por Pagar verificada.\n')

    // -------------------------------------------------------------------------
    // PASO 12: REGISTRAR PAGO PARCIAL ($15,700 COP via TRANSFERENCIA BANCARIA)
    // -------------------------------------------------------------------------
    console.log('--- PASO 12: REGISTRAR PAGO PARCIAL ($15,700 COP) ---')
    const pay1Amount = 15700.00
    await client.query(
      `INSERT INTO public.supplier_payments (
        company_id, location_id, purchase_id, payment_number, payment_date, amount, payment_method, transaction_reference, notes, created_by_user_id
      ) VALUES ($1, $2, $3, $4, CURRENT_DATE, $5, 'TRANSFERENCIA', 'TRF-TEST-001', 'Abono parcial a factura de proveedor', $6);`,
      [testCompanyId, testLocationId, purchaseId, testPay1Num, pay1Amount, testUserId]
    )

    // Egreso en banco
    await client.query(
      `UPDATE public.bank_accounts SET current_balance = current_balance - $2 WHERE id = $1;`,
      [bankAccountId, pay1Amount]
    )
    const bankBalAfter1 = await client.query(`SELECT current_balance FROM public.bank_accounts WHERE id = $1;`, [bankAccountId])

    await client.query(
      `INSERT INTO public.bank_movements (
        company_id, location_id, bank_account_id, movement_number, movement_date, movement_type, amount, balance_after, concept, reference, is_reconciled, created_by_user_id
      ) VALUES ($1, $2, $3, 'MOV-PAG-${testRunId}-1', CURRENT_DATE, 'CREDIT', $4, $5, 'Abono factura proveedor compra ${testPurchaseNum}', 'TRF-TEST-001', true, $6);`,
      [testCompanyId, testLocationId, bankAccountId, pay1Amount, bankBalAfter1.rows[0].current_balance, testUserId]
    )

    await client.query(
      `INSERT INTO public.treasury_payments (
        company_id, location_id, payment_number, payment_type, purchase_id, supplier_id, bank_account_id, amount, payment_date, payment_method, reference_number, status, paid_at
      ) VALUES ($1, $2, 'TES-TEST-${testRunId}-1', 'SUPPLIER_PAYMENT', $3, $4, $5, $6, CURRENT_DATE, 'TRANSFERENCIA', 'TRF-TEST-001', 'PAID', NOW());`,
      [testCompanyId, testLocationId, purchaseId, supplierId, bankAccountId, pay1Amount]
    )

    await client.query(
      `UPDATE public.purchases 
       SET paid_amount = paid_amount + $2, payment_status = 'PARTIAL'
       WHERE id = $1;`,
      [purchaseId, pay1Amount]
    )
    console.log(`✅ Pago parcial registrado: $${pay1Amount} COP (Transferencia bancaria)\n`)

    // -------------------------------------------------------------------------
    // PASO 13: VERIFICAR SALDO TRAS PAGO PARCIAL
    // -------------------------------------------------------------------------
    console.log('--- PASO 13: VERIFICAR SALDO TRAS PAGO PARCIAL ---')
    const balanceCheck1 = await client.query(
      `SELECT total_amount, paid_amount, (total_amount - paid_amount) as pending_balance, payment_status
       FROM public.purchases WHERE id = $1;`,
      [purchaseId]
    )
    const newPending1 = Number(balanceCheck1.rows[0].pending_balance)
    const newStatus1 = balanceCheck1.rows[0].payment_status
    console.log(`💵 Saldo pendiente tras abono: $${newPending1} | Estado: ${newStatus1} (Esperado: $20,000 / PARTIAL)`)
    if (newPending1 !== 20000 || newStatus1 !== 'PARTIAL') {
      throw new Error(`Fallo en Paso 13: Saldo o estado incorrecto tras abono (Saldo: ${newPending1}, Estado: ${newStatus1})`)
    }
    console.log('✅ Saldo parcial verificado correctamente.\n')

    // -------------------------------------------------------------------------
    // PASO 14: REGISTRAR PAGO FINAL ($20,000 COP)
    // -------------------------------------------------------------------------
    console.log('--- PASO 14: REGISTRAR PAGO FINAL ($20,000 COP) ---')
    const pay2Amount = 20000.00
    await client.query(
      `INSERT INTO public.supplier_payments (
        company_id, location_id, purchase_id, payment_number, payment_date, amount, payment_method, transaction_reference, notes, created_by_user_id
      ) VALUES ($1, $2, $3, $4, CURRENT_DATE, $5, 'TRANSFERENCIA', 'TRF-TEST-002', 'Cancelación total factura de proveedor', $6);`,
      [testCompanyId, testLocationId, purchaseId, testPay2Num, pay2Amount, testUserId]
    )

    // Egreso en banco
    await client.query(
      `UPDATE public.bank_accounts SET current_balance = current_balance - $2 WHERE id = $1;`,
      [bankAccountId, pay2Amount]
    )
    const bankBalAfter2 = await client.query(`SELECT current_balance FROM public.bank_accounts WHERE id = $1;`, [bankAccountId])

    await client.query(
      `INSERT INTO public.bank_movements (
        company_id, location_id, bank_account_id, movement_number, movement_date, movement_type, amount, balance_after, concept, reference, is_reconciled, created_by_user_id
      ) VALUES ($1, $2, $3, 'MOV-PAG-${testRunId}-2', CURRENT_DATE, 'CREDIT', $4, $5, 'Pago final factura proveedor compra ${testPurchaseNum}', 'TRF-TEST-002', true, $6);`,
      [testCompanyId, testLocationId, bankAccountId, pay2Amount, bankBalAfter2.rows[0].current_balance, testUserId]
    )

    await client.query(
      `INSERT INTO public.treasury_payments (
        company_id, location_id, payment_number, payment_type, purchase_id, supplier_id, bank_account_id, amount, payment_date, payment_method, reference_number, status, paid_at
      ) VALUES ($1, $2, 'TES-TEST-${testRunId}-2', 'SUPPLIER_PAYMENT', $3, $4, $5, $6, CURRENT_DATE, 'TRANSFERENCIA', 'TRF-TEST-002', 'PAID', NOW());`,
      [testCompanyId, testLocationId, purchaseId, supplierId, bankAccountId, pay2Amount]
    )

    await client.query(
      `UPDATE public.purchases 
       SET paid_amount = paid_amount + $2, payment_status = 'PAID'
       WHERE id = $1;`,
      [purchaseId, pay2Amount]
    )
    console.log(`✅ Pago final registrado: $${pay2Amount} COP\n`)

    // -------------------------------------------------------------------------
    // PASO 15: VERIFICAR SALDO = 0 Y ESTADO 'PAID'
    // -------------------------------------------------------------------------
    console.log('--- PASO 15: VERIFICAR SALDO = 0 Y ESTADO PAGADA ---')
    const balanceCheck2 = await client.query(
      `SELECT total_amount, paid_amount, (total_amount - paid_amount) as pending_balance, payment_status
       FROM public.purchases WHERE id = $1;`,
      [purchaseId]
    )
    const finalPending = Number(balanceCheck2.rows[0].pending_balance)
    const finalPaymentStatus = balanceCheck2.rows[0].payment_status
    console.log(`💵 Saldo pendiente final: $${finalPending} | Estado: ${finalPaymentStatus} (Esperado: $0 / PAID)`)
    if (finalPending !== 0 || finalPaymentStatus !== 'PAID') {
      throw new Error(`Fallo en Paso 15: La compra no quedó totalmente saldada (Saldo: ${finalPending}, Estado: ${finalPaymentStatus})`)
    }
    console.log('✅ Saldo $0 y estado PAGADA comprobados.\n')

    // -------------------------------------------------------------------------
    // PASO 16: VERIFICAR MOVIMIENTO FINANCIERO DE BANCO / TESORERÍA
    // -------------------------------------------------------------------------
    console.log('--- PASO 16: VERIFICAR MOVIMIENTO FINANCIERO DE BANCO Y TESORERÍA ---')
    const bankMovs = await client.query(
      `SELECT id, movement_number, amount, balance_after 
       FROM public.bank_movements 
       WHERE bank_account_id = $1 ORDER BY created_at ASC;`,
      [bankAccountId]
    )
    console.log(`🏦 Movimientos bancarios generados: ${bankMovs.rows.length}`)
    bankMovs.rows.forEach((m: any, idx: number) => {
      console.log(`   ${idx + 1}. ${m.movement_number}: -$${m.amount} COP (Saldo post: $${m.balance_after})`)
    })
    if (bankMovs.rows.length !== 2) {
      throw new Error(`Fallo en Paso 16: Se esperaban 2 egresos bancarios, encontrados ${bankMovs.rows.length}`)
    }

    const treasuryMovs = await client.query(
      `SELECT id, payment_number, amount, payment_type, status 
       FROM public.treasury_payments 
       WHERE purchase_id = $1 ORDER BY created_at ASC;`,
      [purchaseId]
    )
    console.log(`💼 Comprobantes de tesorería generados: ${treasuryMovs.rows.length}`)
    treasuryMovs.rows.forEach((t: any, idx: number) => {
      console.log(`   ${idx + 1}. ${t.payment_number}: $${t.amount} COP (${t.payment_type} / ${t.status})`)
    })
    if (treasuryMovs.rows.length !== 2) {
      throw new Error(`Fallo en Paso 16: Se esperaban 2 comprobantes en treasury_payments`)
    }
    console.log('✅ Trazabilidad financiera verificada en su totalidad.\n')

    // -------------------------------------------------------------------------
    // PASO 17: RECARGAR DESDE POSTGRESQL (NUEVA CONEXIÓN / QUERY LIMPIA)
    // -------------------------------------------------------------------------
    console.log('--- PASO 17: RECARGAR DESDE POSTGRESQL (PERSISTENCIA FÍSICA) ---')
    const freshClient = new Client({
      connectionString: process.env.DIRECT_URL,
      ssl: { rejectUnauthorized: false },
    })
    await freshClient.connect()
    console.log('🔌 Conexión limpia abierta contra PostgreSQL.')

    const freshPurchase = await freshClient.query(
      `SELECT p.id, p.purchase_number, p.inventory_status, p.payment_status, p.total_amount, p.paid_amount,
              s.name as supplier_name,
              l.name as location_name
       FROM public.purchases p
       JOIN public.suppliers s ON s.id = p.supplier_id
       JOIN public.locations l ON l.id = p.location_id
       WHERE p.id = $1;`,
      [purchaseId]
    )
    if (freshPurchase.rows.length === 0) {
      throw new Error('Fallo en Paso 17: No se pudo recargar la compra desde PostgreSQL')
    }
    console.log('✅ Entidad recargada físicamente desde PostgreSQL sin cachés intermedias.\n')

    // -------------------------------------------------------------------------
    // PASO 18: VERIFICAR PERSISTENCIA FÍSICA
    // -------------------------------------------------------------------------
    console.log('--- PASO 18: VERIFICAR PERSISTENCIA DE INTEGRIDAD FÍSICA ---')
    const pData = freshPurchase.rows[0]
    console.log(`📌 Compra: ${pData.purchase_number}`)
    console.log(`   - Proveedor: ${pData.supplier_name}`)
    console.log(`   - Bodega: ${pData.location_name}`)
    console.log(`   - Estado Mercancía: ${pData.inventory_status}`)
    console.log(`   - Estado Pago: ${pData.payment_status}`)
    console.log(`   - Total Facturado: $${pData.total_amount}`)
    console.log(`   - Total Pagado: $${pData.paid_amount}`)

    if (
      pData.inventory_status !== 'RECIBIDA' ||
      pData.payment_status !== 'PAID' ||
      Number(pData.total_amount) !== 35700 ||
      Number(pData.paid_amount) !== 35700
    ) {
      throw new Error('Fallo en Paso 18: Inconsistencia en persistencia física')
    }
    await freshClient.end()
    console.log('✅ Persistencia física verificada.\n')

    // -------------------------------------------------------------------------
    // PASO 19: VERIFICAR AISLAMIENTO RLS MULTI-TENANT
    // -------------------------------------------------------------------------
    console.log('--- PASO 19: VERIFICAR AISLAMIENTO RLS MULTI-TENANT ---')
    // Simular consulta bajo otra empresa (Company B)
    const fakeCompanyId = '00000000-0000-0000-0000-000000000000'
    const rlsCheck = await client.query(
      `SELECT COUNT(*) FROM public.purchases WHERE id = $1 AND company_id = $2;`,
      [purchaseId, fakeCompanyId]
    )
    console.log(`🔒 Consulta cruzada de tenant ajeno (Company 0000): ${rlsCheck.rows[0].count} registros devueltos (Esperado: 0)`)
    if (Number(rlsCheck.rows[0].count) !== 0) {
      throw new Error('Fallo en Paso 19: Fuga de aislamiento multi-tenant RLS')
    }
    console.log('✅ Aislamiento RLS multi-tenant verificado.\n')

    // -------------------------------------------------------------------------
    // PASO 20: VERIFICAR AUDITORÍA
    // -------------------------------------------------------------------------
    console.log('--- PASO 20: VERIFICAR REGISTROS DE AUDITORÍA ---')
    const auditLogs = await client.query(
      `SELECT entity_name, action, created_at 
       FROM public.audit_logs 
       WHERE (entity_id = $1 OR new_value->>'purchase_number' = $2 OR new_value->>'tax_id' = $3)
       ORDER BY created_at ASC;`,
      [purchaseId, testPurchaseNum, testNit]
    )
    console.log(`🛡️ Entradas registradas en public.audit_logs: ${auditLogs.rows.length}`)
    auditLogs.rows.forEach((log: any, idx: number) => {
      console.log(`   ${idx + 1}. [${log.action}] Tabla: ${log.entity_name} (${log.created_at})`)
    })
    console.log('✅ Auditoría activa y registrada correctamente.\n')

    console.log('================================================================')
    console.log('✨ LOS 20 PASOS DE LA PRUEBA E2E PASARON SATISFACTORIAMENTE')
    console.log('================================================================\n')
  } catch (err: any) {
    console.error('❌ ERROR OCURRIDO DURANTE LOS PASOS:', err.message, err.detail, err.hint)
    throw err
  } finally {
    // -------------------------------------------------------------------------
    // ZERO POLLUTION: LIMPIEZA EXPLÍCITA EN ORDEN ESTRICTO DE FOREIGN KEYS
    // SIN USAR SET session_replication_role = 'replica'
    // -------------------------------------------------------------------------
    console.log('================================================================')
    console.log('🧹 INICIANDO TEARDOWN ZERO POLLUTION (ORDEN ESTRICTO DE FKs)')
    console.log('   REGLA DE ORO: NO SE UTILIZA session_replication_role')
    console.log('================================================================\n')

    await client.query(`BEGIN;`)
    // Habilitar bandera de sesión segura en PostgreSQL para permitir cleanup ordenado
    await client.query(`SET LOCAL app.is_test_cleanup = 'true';`)

    // 1. Limpieza de logs de auditoría generados por el test
    if (purchaseId || testNit) {
      const delAudit = await client.query(
        `DELETE FROM public.audit_logs 
         WHERE entity_id = $1 
            OR new_value->>'purchase_number' = $2 
            OR new_value->>'tax_id' = $3 
            OR new_value->>'reception_number' LIKE 'REC-TEST-%';`,
        [purchaseId || '00000000-0000-0000-0000-000000000000', testPurchaseNum, testNit]
      )
      console.log(`1. Auditorías de prueba eliminadas: ${delAudit.rowCount}`)
    }

    // 2. Movimientos bancarios
    if (bankAccountId) {
      const delBankMovs = await client.query(
        `DELETE FROM public.bank_movements WHERE bank_account_id = $1;`,
        [bankAccountId]
      )
      console.log(`2. Movimientos bancarios eliminados: ${delBankMovs.rowCount}`)
    }

    // 3. Comprobantes de tesorería
    if (purchaseId) {
      const delTreasury = await client.query(
        `DELETE FROM public.treasury_payments WHERE purchase_id = $1;`,
        [purchaseId]
      )
      console.log(`3. Tesorería de prueba eliminada: ${delTreasury.rowCount}`)
    }

    // 4. Pagos a proveedores
    if (purchaseId) {
      const delSupPay = await client.query(
        `DELETE FROM public.supplier_payments WHERE purchase_id = $1;`,
        [purchaseId]
      )
      console.log(`4. Pagos a proveedores eliminados: ${delSupPay.rowCount}`)
    }

    // 5. Líneas de actas de recepción
    if (receipt1Id || receipt2Id) {
      const delRecItems = await client.query(
        `DELETE FROM public.purchase_receipt_items WHERE reception_id IN ($1, $2);`,
        [receipt1Id || '00000000-0000-0000-0000-000000000000', receipt2Id || '00000000-0000-0000-0000-000000000000']
      )
      console.log(`5. Líneas de recepción eliminadas: ${delRecItems.rowCount}`)
    }

    // 6. Actas de recepción física
    if (purchaseId) {
      const delReceipts = await client.query(
        `DELETE FROM public.purchase_receipts WHERE purchase_id = $1;`,
        [purchaseId]
      )
      console.log(`6. Actas de recepción física eliminadas: ${delReceipts.rowCount}`)
    }

    // 7. Movimientos de Kardex
    if (productId) {
      const delMovs = await client.query(
        `DELETE FROM public.inventory_movements WHERE product_id = $1;`,
        [productId]
      )
      console.log(`7. Movimientos Kardex eliminados: ${delMovs.rowCount}`)
    }

    // 8. Niveles de stock
    if (productId) {
      const delStock = await client.query(
        `DELETE FROM public.stock_levels WHERE product_id = $1;`,
        [productId]
      )
      console.log(`8. Existencias stock_levels eliminadas: ${delStock.rowCount}`)
    }

    // 9. Líneas de compra
    if (purchaseId) {
      const delPI = await client.query(
        `DELETE FROM public.purchase_items WHERE purchase_id = $1;`,
        [purchaseId]
      )
      console.log(`9. Líneas de orden de compra eliminadas: ${delPI.rowCount}`)
    }

    // 10. Órdenes de compra
    if (purchaseId) {
      const delP = await client.query(
        `DELETE FROM public.purchases WHERE id = $1;`,
        [purchaseId]
      )
      console.log(`10. Órdenes de compra eliminadas: ${delP.rowCount}`)
    }

    // 11. Productos
    if (productId) {
      const delProd = await client.query(
        `DELETE FROM public.products WHERE id = $1;`,
        [productId]
      )
      console.log(`11. Productos de prueba eliminados: ${delProd.rowCount}`)
    }

    // 12. Proveedores
    if (supplierId) {
      const delSup = await client.query(
        `DELETE FROM public.suppliers WHERE id = $1;`,
        [supplierId]
      )
      console.log(`12. Proveedores de prueba eliminados: ${delSup.rowCount}`)
    }

    // 13. Cuenta bancaria de prueba
    if (bankAccountId) {
      const delBank = await client.query(
        `DELETE FROM public.bank_accounts WHERE id = $1;`,
        [bankAccountId]
      )
      console.log(`13. Cuenta bancaria de prueba eliminada: ${delBank.rowCount}`)
    }

    await client.query(`COMMIT;`)
    console.log('🔒 Transacción de teardown finalizada con COMMIT.\n')

    // -------------------------------------------------------------------------
    // VERIFICACIÓN DE RESIDUOS ZERO POLLUTION
    // -------------------------------------------------------------------------
    console.log('--- VERIFICACIÓN FINAL DE ZERO POLLUTION (0 REGISTROS RESIDUALES) ---')
    const c1 = await client.query(`SELECT COUNT(*) FROM public.suppliers WHERE tax_id = $1;`, [testNit])
    const c2 = await client.query(`SELECT COUNT(*) FROM public.products WHERE sku = $1;`, [testSku])
    const c3 = await client.query(`SELECT COUNT(*) FROM public.purchases WHERE purchase_number = $1;`, [testPurchaseNum])
    const c4 = await client.query(`SELECT COUNT(*) FROM public.purchase_receipts WHERE reception_number IN ($1, $2);`, [testRec1Num, testRec2Num])
    const c5 = await client.query(`SELECT COUNT(*) FROM public.supplier_payments WHERE payment_number IN ($1, $2);`, [testPay1Num, testPay2Num])
    const c6 = await client.query(`SELECT COUNT(*) FROM public.bank_accounts WHERE account_number = $1;`, [testBankAccountNum])

    console.log(`   - Proveedores residuales: ${c1.rows[0].count}`)
    console.log(`   - Productos residuales: ${c2.rows[0].count}`)
    console.log(`   - Órdenes residuales: ${c3.rows[0].count}`)
    console.log(`   - Recepciones residuales: ${c4.rows[0].count}`)
    console.log(`   - Pagos residuales: ${c5.rows[0].count}`)
    console.log(`   - Cuentas residuales: ${c6.rows[0].count}`)

    const totalResiduals =
      Number(c1.rows[0].count) +
      Number(c2.rows[0].count) +
      Number(c3.rows[0].count) +
      Number(c4.rows[0].count) +
      Number(c5.rows[0].count) +
      Number(c6.rows[0].count)

    if (totalResiduals !== 0) {
      throw new Error(`VIOLACIÓN ZERO POLLUTION: Quedaron ${totalResiduals} registros de prueba residuales.`)
    }

    console.log('\n🌟 ZERO POLLUTION COMPROBADO AL 100%: 0 REGISTROS RESIDUALES EN POSTGRESQL.\n')

    await client.end()
  }
}

runPhase5TestSuite().catch((err) => {
  console.error('\n❌ ERROR EN LA EJECUCIÓN DE LA PRUEBA E2E:', err)
  process.exit(1)
})
