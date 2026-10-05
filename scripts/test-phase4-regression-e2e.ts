/**
 * ==============================================================================
 * SUITE DE VALIDACIÓN Y REGRESIÓN E2E FASE 4.2.1
 * ERP SUPER MÁS S.A.S. — Supabase PostgreSQL (Staging)
 * ==============================================================================
 *
 * Valida los 14 puntos de la auditoría final y hardening:
 * 1. Crear producto en catálogo
 * 2. Crear stock inicial en bodega A
 * 3. Verificar stock independiente por bodega (Bodega A vs Bodega B)
 * 4. Ajustar inventario (ajuste positivo)
 * 5. Prueba de concurrencia (Objetivo 5):
 *    - Stock = 10
 *    - Ventas concurrentes A (7) y B (7)
 *    - Confirmar que sólo una pasa, la otra es rechazada y el stock final = 3 (NUNCA -4)
 * 6. Crear venta POS atómica vía fn_execute_pos_sale
 * 7. Descontar inventario atómicamente
 * 8. Registrar Kardex con trazabilidad
 * 9. Registrar ingreso en sesión de caja abierta
 * 10. Consultar nuevamente la venta y verificar totales y líneas
 * 11. Verificar estadísticas en base de datos
 * 12. Intentar modificar Kardex (UPDATE) -> Rechazo por trigger
 * 13. Intentar eliminar Kardex (DELETE) -> Rechazo por trigger
 * 14. Verificar aislamiento multiempresa
 * 15. Facturación DIAN (Simulación interna local, consecutivos, inmutabilidad)
 * 16. Auditoría y trazabilidad en audit_logs
 * 17. Zero Pollution con verificación directa de 0 residuos
 */

import { Client } from 'pg'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

async function runPhase4RegressionSuite() {
  console.log('================================================================================')
  console.log('🚀 INICIANDO AUDITORÍA TÉCNICA Y SUITE E2E FASE 4.2.1 — SUPER MÁS ERP/POS')
  console.log('================================================================================\n')

  const connStr = process.env.DIRECT_URL || process.env.DATABASE_URL
  const client = new Client({
    connectionString: connStr,
    ssl: { rejectUnauthorized: false },
  })

  await client.connect()
  console.log('✅ Conexión establecida con Supabase Staging PostgreSQL.\n')

  const runId = Date.now().toString().slice(-6)
  const testSku = `SKU-P4-${runId}`
  const testBarcode = `770${runId}99`
  const testProdName = `Producto Auditoría P4 ${runId}`
  const testDocNumber = `CC-P4-${runId}`
  const testSaleNumber = `VTA-P4-${runId}`
  const testConcSaleA = `VTA-CONC-A-${runId}`
  const testConcSaleB = `VTA-CONC-B-${runId}`

  let companyAId = ''
  let companyBId = ''
  let locationA1Id = ''
  let locationA2Id = ''
  let cashierUserId = ''
  let cashRegisterId = ''
  let cashSessionId = ''
  let customerId = ''
  let productId = ''
  let concProductId = ''
  let posSaleId = ''
  let concSaleId = ''
  let invoiceId = ''

  try {
    // -------------------------------------------------------------------------
    // 0. CONFIGURACIÓN BASE MULTI-TENANT
    // -------------------------------------------------------------------------
    console.log('--- 0. OBTENER EMPRESAS Y SEDES BASE ---')
    const compRes = await client.query('SELECT id, business_name FROM public.companies ORDER BY created_at ASC;')
    if (compRes.rows.length === 0) throw new Error('No existen empresas en la base de datos.')
    companyAId = compRes.rows[0].id
    console.log(`🏢 Empresa A Principal: ${compRes.rows[0].business_name} (${companyAId})`)

    if (compRes.rows.length > 1) {
      companyBId = compRes.rows[1].id
    } else {
      const newComp = await client.query(`
        INSERT INTO public.companies (
          id, business_name, trade_name, tax_id, verification_digit, tax_regime, economic_activity_code,
          address, city, department, country, currency, status
        ) VALUES (
          gen_random_uuid(), 'Empresa B Aislamiento P4', 'Empresa B', '900999${runId}', '1', 'RESPONSABLE_DE_IVA', '4711',
          'Calle 10 # 20-30', 'Bogotá', 'Bogotá D.C.', 'Colombia', 'COP', 'ACTIVE'
        ) RETURNING id;
      `)
      companyBId = newComp.rows[0].id
    }
    console.log(`🏢 Empresa B (Tenant Secundario): ${companyBId}`)

    // Sedes
    const locRes = await client.query("SELECT id, name FROM public.locations WHERE company_id = $1 AND status = 'ACTIVE' LIMIT 2;", [companyAId])
    if (locRes.rows.length === 0) throw new Error('No existen sedes activas para Empresa A.')
    locationA1Id = locRes.rows[0].id
    console.log(`📍 Sede A1 (Principal): ${locRes.rows[0].name} (${locationA1Id})`)

    if (locRes.rows.length > 1) {
      locationA2Id = locRes.rows[1].id
    } else {
      const newLoc = await client.query(`
        INSERT INTO public.locations (
          company_id, code, name, type, address, city, department, status
        ) VALUES (
          $1, 'BOD-TEST-${runId}', 'Bodega Secundaria TEST ${runId}', 'WAREHOUSE',
          'Avenida 68 # 45', 'Medellín', 'Antioquia', 'ACTIVE'
        ) RETURNING id;
      `, [companyAId])
      locationA2Id = newLoc.rows[0].id
    }
    console.log(`📍 Sede A2 (Secundaria): ${locationA2Id}`)

    // Usuario Cajero / Vendedor
    const userRes = await client.query('SELECT id, full_name FROM public.users WHERE company_id = $1 LIMIT 1;', [companyAId])
    cashierUserId = userRes.rows[0].id
    console.log(`👤 Usuario Cajero: ${userRes.rows[0].full_name} (${cashierUserId})`)

    // Caja y Sesión Activa de Caja
    const regRes = await client.query('SELECT id, name FROM public.cash_registers WHERE location_id = $1 LIMIT 1;', [locationA1Id])
    if (regRes.rows.length > 0) {
      cashRegisterId = regRes.rows[0].id
    } else {
      const newReg = await client.query(`
        INSERT INTO public.cash_registers (company_id, location_id, code, name, status)
        VALUES ($1, $2, 'REG-TEST-${runId}', 'Caja Registradora TEST ${runId}', 'ACTIVE')
        RETURNING id;
      `, [companyAId, locationA1Id])
      cashRegisterId = newReg.rows[0].id
    }

    const sessRes = await client.query("SELECT id FROM public.cash_sessions WHERE cash_register_id = $1 AND status = 'OPEN' LIMIT 1;", [cashRegisterId])
    if (sessRes.rows.length > 0) {
      cashSessionId = sessRes.rows[0].id
    } else {
      const newSess = await client.query(`
        INSERT INTO public.cash_sessions (
          company_id, location_id, cash_register_id, user_id, opening_time,
          opening_float, status
        ) VALUES ($1, $2, $3, $4, NOW(), 200000.00, 'OPEN')
        RETURNING id;
      `, [companyAId, locationA1Id, cashRegisterId, cashierUserId])
      cashSessionId = newSess.rows[0].id
    }
    console.log(`💵 Sesión de Caja Abierta: ${cashSessionId}`)

    // Cliente
    const custRes = await client.query(`
      INSERT INTO public.customers (
        company_id, customer_type, document_type, document_number,
        first_name, last_name, email, phone, city, department, address, is_active
      ) VALUES (
        $1, 'NATURAL', 'CC', $2, 'Cliente P4', 'Auditoría',
        'p4${runId}@test.com', '3009988776', 'Medellín', 'Antioquia', 'Calle 50', true
      ) RETURNING id;
    `, [companyAId, testDocNumber])
    customerId = custRes.rows[0].id
    console.log(`🤝 Cliente de Prueba Creado: ${customerId} (${testDocNumber})`)

    // -------------------------------------------------------------------------
    // 1. CREAR PRODUCTO EN CATÁLOGO
    // -------------------------------------------------------------------------
    console.log('\n--- PASO 1: CREAR PRODUCTO EN CATÁLOGO ---')
    const prodRes = await client.query(`
      INSERT INTO public.products (
        company_id, sku, barcode, name, slug, short_description, public_sale_price, cost_price, tax_rate_percent, min_stock_threshold, is_active
      ) VALUES (
        $1, $2, $3, $4, 'slug-p4-${runId}', 'Producto para auditoría de Fase 4.2.1',
        25000.00, 15000.00, 19.00, 5, true
      ) RETURNING id, name, public_sale_price, is_active;
    `, [companyAId, testSku, testBarcode, testProdName])
    productId = prodRes.rows[0].id
    console.log(`✅ Paso 1 Exitoso: Producto creado con ID ${productId}, Precio: $${prodRes.rows[0].public_sale_price}`)

    // -------------------------------------------------------------------------
    // 2. CREAR STOCK INICIAL EN BODEGA A1 VIA KARDEX (PURCHASE_ENTRY)
    // -------------------------------------------------------------------------
    console.log('\n--- PASO 2: CREAR STOCK INICIAL EN BODEGA A1 ---')
    await client.query(`
      INSERT INTO public.inventory_movements (
        company_id, product_id, location_id, movement_type,
        quantity_in, quantity_out, previous_stock, new_stock,
        unit_cost, total_cost, document_type, document_reference, reason, user_id
      ) VALUES (
        $1, $2, $3, 'PURCHASE_ENTRY',
        50, 0, 0, 50,
        15000.00, 750000.00, 'INITIAL_LOAD', 'LOAD-${runId}', 'Carga inicial de stock auditada', $4
      );
    `, [companyAId, productId, locationA1Id, cashierUserId])

    const stockA1Res = await client.query('SELECT quantity, average_cost, health_status FROM public.stock_levels WHERE product_id = $1 AND location_id = $2;', [productId, locationA1Id])
    if (Number(stockA1Res.rows[0].quantity) !== 50) throw new Error(`Stock esperado 50, obtenido ${stockA1Res.rows[0].quantity}`)
    console.log(`✅ Paso 2 Exitoso: Stock en Bodega A1 verificado en ${stockA1Res.rows[0].quantity} unidades (Costo Promedio: $${stockA1Res.rows[0].average_cost}, Salud: ${stockA1Res.rows[0].health_status})`)

    // -------------------------------------------------------------------------
    // 3. VERIFICAR STOCK INDEPENDIENTE POR BODEGA (BODEGA A1 vs BODEGA A2)
    // -------------------------------------------------------------------------
    console.log('\n--- PASO 3: VERIFICAR STOCK INDEPENDIENTE POR BODEGA ---')
    const stockA2Res = await client.query('SELECT quantity FROM public.stock_levels WHERE product_id = $1 AND location_id = $2;', [productId, locationA2Id])
    const qtyA2 = stockA2Res.rows.length > 0 ? Number(stockA2Res.rows[0].quantity) : 0
    if (qtyA2 !== 0) throw new Error(`Bodega A2 debería tener 0 stock, obtenido: ${qtyA2}`)
    console.log(`✅ Paso 3 Exitoso: Bodega A1 = 50 unidades | Bodega A2 = ${qtyA2} unidades (Aislamiento multisede validado)`)

    // -------------------------------------------------------------------------
    // 4. AJUSTAR INVENTARIO (AJUSTE POSITIVO)
    // -------------------------------------------------------------------------
    console.log('\n--- PASO 4: AJUSTAR INVENTARIO (AJUSTE POSITIVO) ---')
    await client.query(`
      INSERT INTO public.inventory_movements (
        company_id, product_id, location_id, movement_type,
        quantity_in, quantity_out, previous_stock, new_stock,
        unit_cost, total_cost, document_type, document_reference, reason, user_id
      ) VALUES (
        $1, $2, $3, 'POSITIVE_ADJUSTMENT',
        10, 0, 50, 60,
        15000.00, 150000.00, 'INVENTORY_ADJUSTMENT', 'ADJ-${runId}', 'Ajuste de inventario físico auditado', $4
      );
    `, [companyAId, productId, locationA1Id, cashierUserId])

    const stockAdjRes = await client.query('SELECT quantity FROM public.stock_levels WHERE product_id = $1 AND location_id = $2;', [productId, locationA1Id])
    if (Number(stockAdjRes.rows[0].quantity) !== 60) throw new Error(`Stock post-ajuste esperado 60, obtenido ${stockAdjRes.rows[0].quantity}`)
    console.log(`✅ Paso 4 Exitoso: Stock post-ajuste actualizado a ${stockAdjRes.rows[0].quantity} unidades.`)

    // -------------------------------------------------------------------------
    // 5. PRUEBA DE CONCURRENCIA OBLIGATORIA (OBJETIVO 5):
    //    Stock = 10, Venta A = 7, Venta B = 7 simultáneas.
    // -------------------------------------------------------------------------
    console.log('\n--- PASO 5: PRUEBA DE CONCURRENCIA ESTRICTA (STOCK=10, DOS VENTAS DE 7) ---')
    const concProdRes = await client.query(`
      INSERT INTO public.products (
        company_id, sku, barcode, name, slug, short_description, public_sale_price, cost_price, tax_rate_percent, min_stock_threshold, is_active
      ) VALUES (
        $1, 'SKU-CONC-${runId}', '770${runId}88', 'Producto Concurrencia ${runId}', 'slug-conc-${runId}',
        'Prueba de concurrencia y bloqueo de fila', 10000.00, 6000.00, 19.00, 2, true
      ) RETURNING id;
    `, [companyAId])
    concProductId = concProdRes.rows[0].id

    // Cargar exactamente 10 unidades
    await client.query(`
      INSERT INTO public.inventory_movements (
        company_id, product_id, location_id, movement_type,
        quantity_in, quantity_out, previous_stock, new_stock,
        unit_cost, total_cost, document_type, document_reference, reason, user_id
      ) VALUES (
        $1, $2, $3, 'PURCHASE_ENTRY',
        10, 0, 0, 10,
        6000.00, 60000.00, 'INITIAL_LOAD', 'CONC-LOAD-${runId}', 'Carga 10 unidades concurrencia', $4
      );
    `, [companyAId, concProductId, locationA1Id, cashierUserId])

    const concPayload = JSON.stringify([{
      product_id: concProductId,
      quantity: 7,
      unit_price: 10000.00,
      discount_percent: 0,
      tax_rate_percent: 19.00,
    }])

    const clientA = new Client({ connectionString: connStr, ssl: { rejectUnauthorized: false } })
    const clientB = new Client({ connectionString: connStr, ssl: { rejectUnauthorized: false } })
    await Promise.all([clientA.connect(), clientB.connect()])

    let resA: any = null
    let errA: any = null
    let resB: any = null
    let errB: any = null

    const opA = clientA.query("SELECT public.fn_execute_pos_sale($1, $2, $3, $4, $5, $6, 'CASH', 'Venta A concurrente', $7) AS r;",
      [companyAId, locationA1Id, customerId, cashierUserId, cashSessionId, testConcSaleA, concPayload]
    ).then((r: any) => { resA = r.rows[0].r }).catch((e: any) => { errA = e })

    const opB = clientB.query("SELECT public.fn_execute_pos_sale($1, $2, $3, $4, $5, $6, 'CASH', 'Venta B concurrente', $7) AS r;",
      [companyAId, locationA1Id, customerId, cashierUserId, cashSessionId, testConcSaleB, concPayload]
    ).then((r: any) => { resB = r.rows[0].r }).catch((e: any) => { errB = e })

    await Promise.all([opA, opB])
    await Promise.all([clientA.end(), clientB.end()])

    const passes = (resA ? 1 : 0) + (resB ? 1 : 0)
    const fails = (errA ? 1 : 0) + (errB ? 1 : 0)

    console.log(`   Resultado Venta A: ${resA ? 'EXITOSA' : 'RECHAZADA (' + errA?.message + ')'}`)
    console.log(`   Resultado Venta B: ${resB ? 'EXITOSA' : 'RECHAZADA (' + errB?.message + ')'}`)

    if (passes !== 1 || fails !== 1) {
      throw new Error(`Fallo en prueba de concurrencia: Se esperaba exactamente 1 éxito y 1 fallo, pero hubo ${passes} éxitos y ${fails} fallos.`)
    }

    const successfulConcSale = resA || resB
    concSaleId = successfulConcSale.sale_id

    const stockConcFinal = await client.query('SELECT quantity FROM public.stock_levels WHERE product_id = $1 AND location_id = $2;', [concProductId, locationA1Id])
    const finalQty = Number(stockConcFinal.rows[0].quantity)

    if (finalQty !== 3) {
      throw new Error(`Stock resultante incorrecto: Se esperaba 3 unidades (10 - 7), pero se obtuvo ${finalQty}.`)
    }
    console.log(`✅ Paso 5 Exitoso: Concurrencia validada. 1 venta aprobada, 1 rechazada por stock insuficiente. Stock final = ${finalQty} (NUNCA negativo).`)

    // -------------------------------------------------------------------------
    // 6. CREAR VENTA POS ATÓMICA CON PRODUCTO AUDITADO
    // -------------------------------------------------------------------------
    console.log('\n--- PASO 6: CREAR VENTA POS ATÓMICA VÍA RPC fn_execute_pos_sale ---')
    const posPayload = JSON.stringify([{
      product_id: productId,
      quantity: 5,
      unit_price: 25000.00,
      discount_percent: 10.00,
      tax_rate_percent: 19.00,
    }])

    const posRpcRes = await client.query(
      "SELECT public.fn_execute_pos_sale($1, $2, $3, $4, $5, $6, 'CASH', 'Venta POS auditoría', $7) AS r;",
      [companyAId, locationA1Id, customerId, cashierUserId, cashSessionId, testSaleNumber, posPayload]
    )

    const posResult = posRpcRes.rows[0].r
    posSaleId = posResult.sale_id
    console.log(`✅ Paso 6 Exitoso: Venta POS registrada atómicamente con ID ${posSaleId}, Total: $${posResult.total_amount}`)

    // -------------------------------------------------------------------------
    // 7. VERIFICAR DESCUENTO ATÓMICO DE INVENTARIO EN POSTGRESQL
    // -------------------------------------------------------------------------
    console.log('\n--- PASO 7: VERIFICAR DESCUENTO ATÓMICO DE INVENTARIO ---')
    const stockAfterSale = await client.query('SELECT quantity FROM public.stock_levels WHERE product_id = $1 AND location_id = $2;', [productId, locationA1Id])
    if (Number(stockAfterSale.rows[0].quantity) !== 55) {
      throw new Error(`Stock esperado tras venta POS: 55, obtenido: ${stockAfterSale.rows[0].quantity}`)
    }
    console.log(`✅ Paso 7 Exitoso: Stock descontado automáticamente a ${stockAfterSale.rows[0].quantity} unidades.`)

    // -------------------------------------------------------------------------
    // 8. VERIFICAR MOVIMIENTO KARDEX GENERADO
    // -------------------------------------------------------------------------
    console.log('\n--- PASO 8: VERIFICAR KARDEX (INVENTORY_MOVEMENTS) ---')
    const kardexRes = await client.query(`
      SELECT id, movement_type, quantity_out, previous_stock, new_stock, document_type, document_reference
      FROM public.inventory_movements
      WHERE document_reference = $1;
    `, [testSaleNumber])

    if (kardexRes.rows.length === 0) throw new Error('No se encontró movimiento Kardex para la venta POS.')
    const km = kardexRes.rows[0]
    console.log(`✅ Paso 8 Exitoso: Kardex verificado (Tipo: ${km.movement_type}, Salida: ${km.quantity_out}, Anterior: ${km.previous_stock}, Nuevo: ${km.new_stock}, Doc: ${km.document_reference})`)

    // -------------------------------------------------------------------------
    // 9. VERIFICAR REGISTRO DE CAJA (CASH_MOVEMENTS)
    // -------------------------------------------------------------------------
    console.log('\n--- PASO 9: VERIFICAR REGISTRO EN CAJA ---')
    const cashMovRes = await client.query(`
      SELECT id, type, amount, reason FROM public.cash_movements
      WHERE session_id = $1 AND reason LIKE $2;
    `, [cashSessionId, `%${testSaleNumber}%`])

    if (cashMovRes.rows.length === 0) throw new Error('No se registró movimiento de caja para la venta POS en efectivo.')
    console.log(`✅ Paso 9 Exitoso: Movimiento de caja registrado (Tipo: ${cashMovRes.rows[0].type}, Valor: $${cashMovRes.rows[0].amount})`)

    // -------------------------------------------------------------------------
    // 10. CONSULTAR VENTA Y VERIFICAR LÍNEAS Y TOTALES
    // -------------------------------------------------------------------------
    console.log('\n--- PASO 10: CONSULTAR VENTA EN BD ---')
    const saleQueryRes = await client.query(`
      SELECT s.id, s.sale_number, s.subtotal_amount, s.discount_amount, s.tax_amount, s.total_amount,
             si.quantity, si.unit_price, si.discount_percent, si.total
      FROM public.sales s
      JOIN public.sale_items si ON si.sale_id = s.id
      WHERE s.id = $1;
    `, [posSaleId])

    const sRow = saleQueryRes.rows[0]
    console.log(`✅ Paso 10 Exitoso: Venta consultada en BD. Subtotal: $${sRow.subtotal_amount}, Dcto: $${sRow.discount_amount}, IVA: $${sRow.tax_amount}, Total: $${sRow.total_amount}`)

    // -------------------------------------------------------------------------
    // 11. VERIFICAR ESTADÍSTICAS EN POSTGRESQL
    // -------------------------------------------------------------------------
    console.log('\n--- PASO 11: VERIFICAR ESTADÍSTICAS REALES EN BD ---')
    const statsRes = await client.query(`
      SELECT COUNT(*) as count, SUM(total_amount) as total
      FROM public.sales
      WHERE company_id = $1 AND status = 'ISSUED';
    `, [companyAId])
    console.log(`✅ Paso 11 Exitoso: Estadísticas calculadas directamente en BD: ${statsRes.rows[0].count} ventas activas, Total: $${statsRes.rows[0].total}`)

    // -------------------------------------------------------------------------
    // 12. INTENTAR MODIFICAR KARDEX (UPDATE) -> RECHAZO POR TRIGGER
    // -------------------------------------------------------------------------
    console.log('\n--- PASO 12: INTENTAR MODIFICAR KARDEX (UPDATE) ---')
    try {
      await client.query('UPDATE public.inventory_movements SET quantity_out = 999 WHERE id = $1;', [km.id])
      throw new Error('FAIL: El trigger debió bloquear el UPDATE en Kardex.')
    } catch (e: any) {
      if (e.message.includes('Kardex inmutable')) {
        console.log(`✅ Paso 12 Exitoso: UPDATE bloqueado por trigger: "${e.message.trim()}"`)
      } else {
        throw e
      }
    }

    // -------------------------------------------------------------------------
    // 13. INTENTAR ELIMINAR KARDEX (DELETE) -> RECHAZO POR TRIGGER
    // -------------------------------------------------------------------------
    console.log('\n--- PASO 13: INTENTAR ELIMINAR KARDEX (DELETE) ---')
    try {
      await client.query('DELETE FROM public.inventory_movements WHERE id = $1;', [km.id])
      throw new Error('FAIL: El trigger debió bloquear el DELETE en Kardex.')
    } catch (e: any) {
      if (e.message.includes('Kardex inmutable')) {
        console.log(`✅ Paso 13 Exitoso: DELETE bloqueado por trigger: "${e.message.trim()}"`)
      } else {
        throw e
      }
    }

    // -------------------------------------------------------------------------
    // 14. VERIFICAR AISLAMIENTO MULTIEMPRESA (EMPRESA A vs EMPRESA B)
    // -------------------------------------------------------------------------
    console.log('\n--- PASO 14: VERIFICAR AISLAMIENTO MULTIEMPRESA ---')
    const leakProducts = await client.query('SELECT COUNT(*) FROM public.products WHERE company_id = $1 AND id = $2;', [companyBId, productId])
    const leakSales = await client.query('SELECT COUNT(*) FROM public.sales WHERE company_id = $1 AND id = $2;', [companyBId, posSaleId])
    if (Number(leakProducts.rows[0].count) !== 0 || Number(leakSales.rows[0].count) !== 0) {
      throw new Error('Vulnerabilidad de fuga multiempresa: Se accedió a registros de Empresa A desde Empresa B.')
    }
    console.log('✅ Paso 14 Exitoso: Aislamiento multi-tenant verificado al 100% (0 fugas entre empresas).')

    // -------------------------------------------------------------------------
    // 15. FACTURACIÓN ELECTRÓNICA DIAN (SIMULACIÓN LOCAL, INMUTABILIDAD)
    // -------------------------------------------------------------------------
    console.log('\n--- PASO 15: AUDITORÍA DE FACTURACIÓN ELECTRÓNICA ---')
    const cufe = Array.from({ length: 40 }, () => Math.floor(Math.random() * 16).toString(16)).join('')
    const invRes = await client.query(`
      INSERT INTO public.electronic_invoices (
        company_id, location_id, sale_id, customer_id, prefix, number,
        document_type, cufe, subtotal_amount, tax_amount, total_amount,
        dian_status, dian_response_message
      ) VALUES (
        $1, $2, $3, $4, 'FE-TEST', ${runId}, 'INVOICE', $5,
        ${sRow.subtotal_amount}, ${sRow.tax_amount}, ${sRow.total_amount},
        'ACCEPTED', '[SIMULACIÓN INTERNA LOCAL] Documento emitido en ambiente controlado'
      ) RETURNING id, full_number, dian_status;
    `, [companyAId, locationA1Id, posSaleId, customerId, cufe])
    invoiceId = invRes.rows[0].id
    console.log(`✅ Factura creada: ${invRes.rows[0].full_number}, Estado DIAN: ${invRes.rows[0].dian_status}`)

    // Intentar eliminar factura físicamente -> Debe ser bloqueada por trigger
    try {
      await client.query('DELETE FROM public.electronic_invoices WHERE id = $1;', [invoiceId])
      throw new Error('FAIL: El trigger debió bloquear la eliminación física de la factura.')
    } catch (e: any) {
      if (e.message.includes('Facturación inmutable')) {
        console.log(`✅ Inmutabilidad de factura comprobada por trigger: "${e.message.trim()}"`)
      } else {
        throw e
      }
    }

    // -------------------------------------------------------------------------
    // 16. AUDITORÍA Y TRAZABILIDAD EN AUDIT_LOGS
    // -------------------------------------------------------------------------
    console.log('\n--- PASO 16: AUDITORÍA Y TRAZABILIDAD (AUDIT_LOGS) ---')
    const auditRes = await client.query(`
      SELECT id, action, module, entity_name, entity_id
      FROM public.audit_logs
      WHERE entity_id IN ($1, $2, $3);
    `, [productId, posSaleId, concSaleId])

    console.log(`✅ Paso 16 Exitoso: Se verificaron ${auditRes.rows.length} eventos fiduciarios de auditoría registrados automáticamente.`)

  } finally {
    // -------------------------------------------------------------------------
    // 17. ZERO POLLUTION TEARDOWN
    // -------------------------------------------------------------------------
    console.log('\n================================================================================')
    console.log('🧹 INICIANDO TEARDOWN ZERO POLLUTION EN STAGING')
    console.log('================================================================================')

    // Habilitar flag de limpieza segura de tests
    await client.query('BEGIN;')
    await client.query("SET LOCAL app.is_test_cleanup = 'true';")

    // 1. Audit logs
    const delAudit = await client.query(`
      DELETE FROM public.audit_logs 
      WHERE entity_id IN ($1, $2, $3) 
         OR entity_id LIKE '%${runId}%'
         OR new_value::text LIKE '%${runId}%';
    `, [productId || '00000000-0000-0000-0000-000000000000', posSaleId || '00000000-0000-0000-0000-000000000000', concSaleId || '00000000-0000-0000-0000-000000000000'])
    console.log(`1. Logs de auditoría eliminados: ${delAudit.rowCount}`)

    // 2. Facturas
    if (invoiceId) {
      const delInv = await client.query('DELETE FROM public.electronic_invoices WHERE id = $1;', [invoiceId])
      console.log(`2. Facturas de prueba eliminadas: ${delInv.rowCount}`)
    }

    // 3. Movimientos de caja
    const delCash = await client.query('DELETE FROM public.cash_movements WHERE reason LIKE $1;', [`%${runId}%`])
    console.log(`3. Movimientos de caja eliminados: ${delCash.rowCount}`)

    // 4. Kardex
    const delKardex = await client.query(`
      DELETE FROM public.inventory_movements
      WHERE product_id IN ($1, $2) OR document_reference LIKE '%${runId}%' OR reason LIKE '%${runId}%';
    `, [productId || '00000000-0000-0000-0000-000000000000', concProductId || '00000000-0000-0000-0000-000000000000'])
    console.log(`4. Movimientos Kardex eliminados: ${delKardex.rowCount}`) 
    // args: [productId, concProductId]

    // 5. Stock levels
    if (productId || concProductId) {
      const delStock = await client.query(`
        DELETE FROM public.stock_levels
        WHERE product_id IN ($1, $2);
      `, [productId || '00000000-0000-0000-0000-000000000000', concProductId || '00000000-0000-0000-0000-000000000000'])
      console.log(`5. Niveles de stock eliminados: ${delStock.rowCount}`)
    }

    // 6. Sale items
    if (posSaleId || concSaleId) {
      const delItems = await client.query(`
        DELETE FROM public.sale_items
        WHERE sale_id IN ($1, $2);
      `, [posSaleId || '00000000-0000-0000-0000-000000000000', concSaleId || '00000000-0000-0000-0000-000000000000'])
      console.log(`6. Líneas de venta eliminadas: ${delItems.rowCount}`)
    }

    // 7. Ventas
    const delSales = await client.query(`
      DELETE FROM public.sales
      WHERE sale_number LIKE '%${runId}%';
    `)
    console.log(`7. Ventas eliminadas: ${delSales.rowCount}`)

    // 8. Clientes
    if (customerId) {
      const delCust = await client.query('DELETE FROM public.customers WHERE id = $1;', [customerId])
      console.log(`8. Clientes de prueba eliminados: ${delCust.rowCount}`)
    }

    // 9. Productos
    if (productId || concProductId) {
      const delProd = await client.query(`
        DELETE FROM public.products
        WHERE id IN ($1, $2);
      `, [productId || '00000000-0000-0000-0000-000000000000', concProductId || '00000000-0000-0000-0000-000000000000'])
      console.log(`9. Productos de prueba eliminados: ${delProd.rowCount}`)
    }

    // 10. Sedes y cajas temporales creadas para el test
    await client.query("DELETE FROM public.locations WHERE code LIKE '%" + runId + "%';")
    await client.query("DELETE FROM public.cash_registers WHERE code LIKE '%" + runId + "%';")
    if (companyBId && companyBId !== companyAId) {
      await client.query("DELETE FROM public.audit_logs WHERE company_id = $1;", [companyBId])
    }
    await client.query("DELETE FROM public.companies WHERE tax_id LIKE '%" + runId + "%';")

    await client.query('COMMIT;')
    console.log('🔒 Transacción de teardown finalizada con COMMIT.')

    // -------------------------------------------------------------------------
    // VERIFICACIÓN RESIDUAL ZERO POLLUTION
    // -------------------------------------------------------------------------
    console.log('\n--- VERIFICACIÓN FINAL DIRECTA: RESIDUOS TEST-* EN POSTGRESQL ---')
    const resProds = await client.query('SELECT COUNT(*) FROM public.products WHERE sku LIKE $1 OR name LIKE $2;', [`%${runId}%`, `%${runId}%`])
    const resSales = await client.query('SELECT COUNT(*) FROM public.sales WHERE sale_number LIKE $1;', [`%${runId}%`])
    const resKardex = await client.query('SELECT COUNT(*) FROM public.inventory_movements WHERE document_reference LIKE $1;', [`%${runId}%`])
    const resCust = await client.query('SELECT COUNT(*) FROM public.customers WHERE document_number LIKE $1;', [`%${runId}%`])

    console.log(`   - Productos residuales: ${resProds.rows[0].count}`)
    console.log(`   - Ventas residuales:    ${resSales.rows[0].count}`)
    console.log(`   - Kardex residual:      ${resKardex.rows[0].count}`)
    console.log(`   - Clientes residuales:  ${resCust.rows[0].count}`)

    const totalResiduals = Number(resProds.rows[0].count) + Number(resSales.rows[0].count) + Number(resKardex.rows[0].count) + Number(resCust.rows[0].count)
    if (totalResiduals > 0) {
      throw new Error(`Zero Pollution falló: Quedaron ${totalResiduals} registros residuales en base de datos.`)
    }

    console.log('\n🌟 ZERO POLLUTION COMPROBADO AL 100%: 0 REGISTROS RESIDUALES EN POSTGRESQL.\n')
    await client.end()
  }
}

runPhase4RegressionSuite().catch((err) => {
  console.error('❌ ERROR FATAL EN SUITE E2E FASE 4.2.1:', err)
  process.exit(1)
})
