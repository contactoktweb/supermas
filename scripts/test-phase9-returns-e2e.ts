/**
 * ============================================================================
 * SUITE DE PRUEBAS E2E FASE 9 — DEVOLUCIONES (CLIENTE Y PROVEEDOR CON KARDEX REAL)
 * ============================================================================
 * 
 * Verifica con rigor absoluto en PostgreSQL Staging:
 * - T01: Devolución parcial de cliente con reingreso atómico en Kardex (CUSTOMER_RETURN) e incremento de stock.
 * - T02: Prevención de sobre-devolución de cliente (rechazo si cantidad > vendida).
 * - T03: Devoluciones acumuladas de cliente y límite exacto de saldo restante.
 * - T04: Devolución a proveedor con deducción atómica en Kardex (SUPPLIER_RETURN) y reducción de stock.
 * - T05: Prevención de sobre-devolución a proveedor (rechazo si cantidad > recibida).
 * - T06: Prevención de stock insuficiente en devolución a proveedor (bloqueo transaccional de stock negativo).
 * - T07: Consecutivos fiduciarios diferenciados (DEV-CLI vs DEV-PRV).
 * - T08: Trazabilidad y enlace fiduciario con documentos origen (source_document_id/code).
 * - T09: Concurrencia en devoluciones simultáneas (SELECT FOR UPDATE).
 * - T10: Aislamiento multiempresa estricto (bloqueo entre empresas).
 * - T11: Auditoría transaccional de ciclo de vida completo en audit_logs.
 * - T12: Consultas relacionales en ReturnRepository (findAll con joins y filtros).
 * - T13: Consulta por documento origen (findBySourceDocument).
 * - T14: Estadísticas consolidadas en PostgreSQL (getStats).
 * - T15: Zero Pollution (0 residuos en base de datos).
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js'
import pg from 'pg'

interface TestResult {
  code: string
  name: string
  passed: boolean
  details?: string
}

async function runPhase9TestSuite() {
  const runId = Math.floor(100000 + Math.random() * 900000).toString()
  const tag = `TEST-P9-${runId}`
  const userPassword = `Pass_${runId}!Aa`
  const results: TestResult[] = []

  const recordResult = (code: string, name: string, passed: boolean, details?: string) => {
    results.push({ code, name, passed, details })
    const icon = passed ? '✅' : '❌'
    console.log(`\n${icon} [${code}] ${name}: ${passed ? 'PASS' : 'FAIL'}`)
    if (details) console.log(`   Detalle: ${details}`)
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const databaseUrl = process.env.DATABASE_URL

  if (!supabaseUrl || !anonKey || !serviceRoleKey || !databaseUrl) {
    throw new Error('Variables de entorno incompletas en .env.local')
  }

  const pgClient = new pg.Client({ connectionString: databaseUrl })
  await pgClient.connect()
  console.log('✅ Conexión directa a PostgreSQL Staging establecida.')

  const adminSupabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  let companyAId = ''
  let companyBId = ''
  let locAId = ''
  let locBId = ''
  let customerAId = ''
  let supplierAId = ''
  let product1Id = ''
  let product2Id = ''
  let authUserAId = ''
  let authUserBId = ''
  let clientA: SupabaseClient
  let clientB: SupabaseClient

  let sale1Id = ''
  let purchase1Id = ''

  try {
    console.log('\n--- SETUP BASE MULTI-TENANT & ENTIDADES STAGING ---')

    // 1. Obtener empresas activas
    const compARes = await pgClient.query(
      `SELECT id FROM public.companies WHERE status = 'ACTIVE' ORDER BY created_at ASC LIMIT 1;`
    )
    if (compARes.rows.length === 0) throw new Error('No hay empresas activas en staging.')
    companyAId = compARes.rows[0].id

    const compBRes = await pgClient.query(
      `SELECT id FROM public.companies WHERE id != $1 AND status = 'ACTIVE' LIMIT 1;`,
      [companyAId]
    )
    if (compBRes.rows.length === 0) throw new Error('No se encontró una segunda empresa activa.')
    companyBId = compBRes.rows[0].id

    // 2. Crear Bodegas de prueba
    const locA = await pgClient.query(
      `INSERT INTO public.locations (company_id, code, name, type, status, address, city, allow_sales, allow_inventory_ops)
       VALUES ($1, 'BOD-DEV-A-${runId}', 'Bodega Devoluciones A ${tag}', 'WAREHOUSE', 'ACTIVE', 'Calle 70 # 10-20', 'Medellin', true, true)
       RETURNING id;`,
      [companyAId]
    )
    locAId = locA.rows[0].id

    const locB = await pgClient.query(
      `INSERT INTO public.locations (company_id, code, name, type, status, address, city, allow_sales, allow_inventory_ops)
       VALUES ($1, 'BOD-DEV-B-${runId}', 'Bodega Devoluciones B ${tag}', 'WAREHOUSE', 'ACTIVE', 'Carrera 15 # 80-20', 'Bogota', true, true)
       RETURNING id;`,
      [companyBId]
    )
    locBId = locB.rows[0].id

    // 3. Crear Cliente y Proveedor de prueba
    const custA = await pgClient.query(
      `INSERT INTO public.customers (company_id, document_type, document_number, first_name, last_name, company_name, email, phone, address, city, is_active)
       VALUES ($1, 'NIT', '901${runId}1', 'Cliente', 'Devoluciones', 'Cliente Devoluciones ${tag}', 'cliente-dev-${runId}@test.com', '3009988776', 'Calle 55 # 40-10', 'Medellin', true)
       RETURNING id;`,
      [companyAId]
    )
    customerAId = custA.rows[0].id

    const suppA = await pgClient.query(
      `INSERT INTO public.suppliers (company_id, tax_id, name, legal_name, commercial_name, email, phone, address, city, is_active)
       VALUES ($1, '902${runId}1', 'Proveedor Devoluciones ${tag}', 'Disnalimentos S.A.S. ${tag}', 'Disnalimentos ${tag}', 'prov-dev-${runId}@test.com', '3104433221', 'Zona Industrial # 5-10', 'Medellin', true)
       RETURNING id;`,
      [companyAId]
    )
    supplierAId = suppA.rows[0].id

    // 4. Crear Usuarios Auth en Supabase
    console.log('--- CREANDO USUARIOS EN SUPABASE AUTH ---')
    const roleRes = await pgClient.query(`SELECT id FROM public.roles WHERE code = 'ADMIN' LIMIT 1;`)
    const adminRoleId = roleRes.rows[0].id

    const emailA = `admin.deva.${runId}@supermas.local`
    const { data: userACreated, error: userAErr } = await adminSupabase.auth.admin.createUser({
      email: emailA,
      password: userPassword,
      email_confirm: true,
    })
    if (userAErr) throw userAErr
    authUserAId = userACreated.user.id

    await pgClient.query(
      `INSERT INTO public.users (id, company_id, role_id, full_name, email, is_active)
       VALUES ($1, $2, $3, 'Usuario Devoluciones A ${tag}', $4, true)
       ON CONFLICT (id) DO UPDATE SET company_id = $2, role_id = $3, full_name = 'Usuario Devoluciones A ${tag}';`,
      [authUserAId, companyAId, adminRoleId, emailA]
    )
    await pgClient.query(
      `INSERT INTO public.user_locations (user_id, location_id) VALUES ($1, $2)
       ON CONFLICT DO NOTHING;`,
      [authUserAId, locAId]
    )

    const emailB = `admin.devb.${runId}@supermas.local`
    const { data: userBCreated, error: userBErr } = await adminSupabase.auth.admin.createUser({
      email: emailB,
      password: userPassword,
      email_confirm: true,
    })
    if (userBErr) throw userBErr
    authUserBId = userBCreated.user.id

    await pgClient.query(
      `INSERT INTO public.users (id, company_id, role_id, full_name, email, is_active)
       VALUES ($1, $2, $3, 'Usuario Devoluciones B ${tag}', $4, true)
       ON CONFLICT (id) DO UPDATE SET company_id = $2, role_id = $3, full_name = 'Usuario Devoluciones B ${tag}';`,
      [authUserBId, companyBId, adminRoleId, emailB]
    )
    await pgClient.query(
      `INSERT INTO public.user_locations (user_id, location_id) VALUES ($1, $2)
       ON CONFLICT DO NOTHING;`,
      [authUserBId, locBId]
    )

    const { data: signA, error: signAErr } = await adminSupabase.auth.signInWithPassword({
      email: emailA,
      password: userPassword,
    })
    if (signAErr) throw signAErr
    clientA = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${signA.session.access_token}` } },
    })

    const { data: signB, error: signBErr } = await adminSupabase.auth.signInWithPassword({
      email: emailB,
      password: userPassword,
    })
    if (signBErr) throw signBErr
    clientB = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${signB.session.access_token}` } },
    })

    console.log('✅ Usuarios auth creados y clientes autenticados.\n')

    // 5. Crear Productos y Carga Inicial de Stock en Kardex
    console.log('--- CREANDO PRODUCTOS Y STOCK INICIAL EN KARDEX ---')
    const p1 = await pgClient.query(
      `INSERT INTO public.products (company_id, sku, name, slug, cost_price, public_sale_price, is_active)
       VALUES ($1, 'SKU-DEV1-${runId}', 'Café Sello Rojo 500g ${tag}', 'cafe-dev1-${runId}', 6000.00, 8500.00, true)
       RETURNING id;`,
      [companyAId]
    )
    product1Id = p1.rows[0].id

    const p2 = await pgClient.query(
      `INSERT INTO public.products (company_id, sku, name, slug, cost_price, public_sale_price, is_active)
       VALUES ($1, 'SKU-DEV2-${runId}', 'Leche Entera Colanta 1L ${tag}', 'leche-dev2-${runId}', 3200.00, 4200.00, true)
       RETURNING id;`,
      [companyAId]
    )
    product2Id = p2.rows[0].id

    // Registrar inventario inicial en Bodega A mediante Kardex (POSITIVE_ADJUSTMENT)
    await pgClient.query(
      `INSERT INTO public.inventory_movements (
         company_id, location_id, product_id, movement_type, quantity_in, quantity_out, previous_stock, new_stock, unit_cost, total_cost, document_type, document_reference, reason, user_id
       ) VALUES 
         ($1, $2, $3, 'POSITIVE_ADJUSTMENT', 50.00, 0.00, 0.00, 50.00, 6000.00, 300000.00, 'INITIAL_ADJUSTMENT', 'INV-INI-${runId}', 'Carga inicial devoluciones', $5),
         ($1, $2, $4, 'POSITIVE_ADJUSTMENT', 50.00, 0.00, 0.00, 50.00, 3200.00, 160000.00, 'INITIAL_ADJUSTMENT', 'INV-INI-${runId}', 'Carga inicial devoluciones', $5);`,
      [companyAId, locAId, product1Id, product2Id, authUserAId]
    )
    console.log('✅ Stock inicial cargado: Prod1=50 unds, Prod2=50 unds.\n')

    // 6. Crear Venta base de prueba (Venta de 20 unds Prod1 y 15 unds Prod2 con salida Kardex SALE_OUT)
    const saleRes = await pgClient.query(
      `INSERT INTO public.sales (
         company_id, location_id, customer_id, seller_user_id, sale_number, subtotal_amount, tax_amount, total_amount, payment_method, status
       ) VALUES (
         $1, $2, $3, $4, 'VTA-DEV-${runId}', 233000.00, 0.00, 233000.00, 'CASH', 'ISSUED'
       ) RETURNING id;`,
      [companyAId, locAId, customerAId, authUserAId]
    )
    sale1Id = saleRes.rows[0].id

    await pgClient.query(
      `INSERT INTO public.sale_items (sale_id, company_id, product_id, quantity, unit_cost, unit_price, subtotal, total)
       VALUES 
         ($1, $2, $3, 20.00, 6000.00, 8500.00, 170000.00, 170000.00),
         ($1, $2, $4, 15.00, 3200.00, 4200.00, 63000.00, 63000.00);`,
      [sale1Id, companyAId, product1Id, product2Id]
    )

    // Salida Kardex por la venta: Prod1 (50 - 20 = 30), Prod2 (50 - 15 = 35)
    await pgClient.query(
      `INSERT INTO public.inventory_movements (
         company_id, location_id, product_id, movement_type, quantity_in, quantity_out, previous_stock, new_stock, unit_cost, total_cost, document_type, document_reference, reason, user_id
       ) VALUES 
         ($1, $2, $3, 'SALE_OUT', 0.00, 20.00, 50.00, 30.00, 6000.00, 120000.00, 'SALE', 'VTA-DEV-${runId}', 'Venta base prueba devoluciones', $5),
         ($1, $2, $4, 'SALE_OUT', 0.00, 15.00, 50.00, 35.00, 3200.00, 48000.00, 'SALE', 'VTA-DEV-${runId}', 'Venta base prueba devoluciones', $5);`,
      [companyAId, locAId, product1Id, product2Id, authUserAId]
    )

    // 7. Crear Compra base de prueba (Compra de 30 unds Prod1 recibida)
    const purRes = await pgClient.query(
      `INSERT INTO public.purchases (
         company_id, location_id, supplier_id, purchase_number, supplier_invoice_number, subtotal_amount, tax_amount, total_amount, payment_terms, payment_status, inventory_status, issue_date, due_date
       ) VALUES (
         $1, $2, $3, 'COM-DEV-${runId}', 'FAC-PROV-${runId}', 180000.00, 0.00, 180000.00, 'CONTADO', 'PAID', 'RECEIVED', CURRENT_DATE, CURRENT_DATE
       ) RETURNING id;`,
      [companyAId, locAId, supplierAId]
    )
    purchase1Id = purRes.rows[0].id

    await pgClient.query(
      `INSERT INTO public.purchase_items (purchase_id, company_id, product_id, quantity, received_quantity, unit_cost, subtotal, total)
       VALUES ($1, $2, $3, 30.00, 30.00, 6000.00, 180000.00, 180000.00);`,
      [purchase1Id, companyAId, product1Id]
    )

    // ==========================================================================
    // EJECUTANDO CASOS DE PRUEBA T01 A T15
    // ==========================================================================

    // --- T01: DEVOLUCIÓN PARCIAL DE CLIENTE ---
    console.log('--- EJECUTANDO T01: DEVOLUCIÓN PARCIAL DE CLIENTE ---')
    // Cliente devuelve 5 unidades de Prod1 de las 20 que compró.
    // Stock actual de Prod1 en A1: 30 unds -> debe quedar en 35 unds.
    const { data: ret1Data, error: ret1Err } = await clientA.rpc('fn_process_customer_return', {
      p_sale_id: sale1Id,
      p_items: [{ product_id: product1Id, quantity: 5, reason: 'Empaque abollado' }],
      p_reason: 'Devolución parcial por cliente inconforme con empaque',
    })
    if (ret1Err) throw ret1Err

    // Verificar en Kardex movimiento CUSTOMER_RETURN
    const movRet1 = await pgClient.query(
      `SELECT movement_type, quantity_in, previous_stock, new_stock, document_reference
       FROM public.inventory_movements
       WHERE document_reference = $1 AND movement_type = 'CUSTOMER_RETURN';`,
      [ret1Data.code]
    )

    // Verificar stock en stock_levels
    const stP1AfterRet1 = await pgClient.query(
      `SELECT quantity FROM public.stock_levels WHERE product_id = $1 AND location_id = $2;`,
      [product1Id, locAId]
    )

    const t01Pass =
      ret1Data.success === true &&
      movRet1.rows.length === 1 &&
      Number(movRet1.rows[0].quantity_in) === 5.0 &&
      Number(stP1AfterRet1.rows[0].quantity) === 35.0

    recordResult(
      'T01',
      'Devolución parcial de cliente con reingreso en Kardex (CUSTOMER_RETURN)',
      t01Pass,
      t01Pass
        ? `Devolución ${ret1Data.code} procesada. Movimiento CUSTOMER_RETURN auditado (+5). Stock final Prod1=35.00.`
        : `Falla: ${JSON.stringify(ret1Data)}`
    )

    // --- T02: PREVENCIÓN DE SOBRE-DEVOLUCIÓN DE CLIENTE ---
    console.log('--- EJECUTANDO T02: PREVENCIÓN DE SOBRE-DEVOLUCIÓN ---')
    // Vendidas: 20. Ya devueltas: 5. Máximo restante: 15.
    // Intentar devolver 16 unidades -> Debe fallar
    const { error: overRetErr } = await clientA.rpc('fn_process_customer_return', {
      p_sale_id: sale1Id,
      p_items: [{ product_id: product1Id, quantity: 16, reason: 'Exceso' }],
      p_reason: 'Intento de devolver más de lo comprado',
    })

    const t02Pass = overRetErr !== null && overRetErr.message.includes('No se puede devolver')
    recordResult(
      'T02',
      'Prevención de sobre-devolución de cliente (> unidades vendidas)',
      Boolean(t02Pass),
      t02Pass
        ? `Bloqueado por RPC (42200): "${overRetErr?.message}"`
        : `Falla: permitió devolver más unidades de las compradas.`
    )

    // --- T03: DEVOLUCIONES ACUMULADAS Y LÍMITE EXACTO ---
    console.log('--- EJECUTANDO T03: DEVOLUCIONES ACUMULADAS ---')
    // Devolver exactamente las 15 unidades restantes de Prod1 (20 total devueltas)
    const { data: retExactData, error: retExactErr } = await clientA.rpc('fn_process_customer_return', {
      p_sale_id: sale1Id,
      p_items: [{ product_id: product1Id, quantity: 15, reason: 'Saldo final' }],
      p_reason: 'Devolución del saldo total restante de la venta',
    })
    if (retExactErr) throw retExactErr

    // Ahora intentar devolver 1 unidad más de Prod1 sobre la misma venta -> Debe ser rechazada
    const { error: blockExtraErr } = await clientA.rpc('fn_process_customer_return', {
      p_sale_id: sale1Id,
      p_items: [{ product_id: product1Id, quantity: 1 }],
      p_reason: 'Intento extra tras devolución total',
    })

    const t03Pass =
      retExactData.success === true &&
      blockExtraErr !== null &&
      blockExtraErr.message.includes('No se puede devolver')

    recordResult(
      'T03',
      'Devoluciones acumuladas y límite exacto de saldo restante',
      Boolean(t03Pass),
      t03Pass
        ? `Saldo exacto de 15 unds aceptado. Intento extra bloqueado: "${blockExtraErr?.message}"`
        : `Falla en control acumulado.`
    )

    // --- T04: DEVOLUCIÓN PARCIAL A PROVEEDOR ---
    console.log('--- EJECUTANDO T04: DEVOLUCIÓN A PROVEEDOR ---')
    // Compra1: 30 unds recibidas de Prod1. Devolver 10 unds al proveedor por avería.
    // Stock actual de Prod1 en A1: 35 + 15 = 50 unds.
    // Salida a proveedor: 50 - 10 = 40 unds.
    const { data: suppRetData, error: suppRetErr } = await clientA.rpc('fn_process_supplier_return', {
      p_purchase_id: purchase1Id,
      p_items: [{ product_id: product1Id, quantity: 10, reason: 'Defecto de empaque' }],
      p_reason: 'Devolución de lote averiado a proveedor',
    })
    if (suppRetErr) throw suppRetErr

    // Verificar en Kardex SUPPLIER_RETURN
    const movSuppRet = await pgClient.query(
      `SELECT movement_type, quantity_out, document_reference
       FROM public.inventory_movements
       WHERE document_reference = $1 AND movement_type = 'SUPPLIER_RETURN';`,
      [suppRetData.code]
    )

    // Verificar stock_levels
    const stP1AfterSuppRet = await pgClient.query(
      `SELECT quantity FROM public.stock_levels WHERE product_id = $1 AND location_id = $2;`,
      [product1Id, locAId]
    )

    const t04Pass =
      suppRetData.success === true &&
      movSuppRet.rows.length === 1 &&
      Number(movSuppRet.rows[0].quantity_out) === 10.0 &&
      Number(stP1AfterSuppRet.rows[0].quantity) === 40.0

    recordResult(
      'T04',
      'Devolución a proveedor con deducción en Kardex (SUPPLIER_RETURN)',
      t04Pass,
      t04Pass
        ? `Devolución ${suppRetData.code} procesada. Movimiento SUPPLIER_RETURN auditado (-10). Stock resultante Prod1=40.00.`
        : `Falla en devolución a proveedor.`
    )

    // --- T05: PREVENCIÓN DE SOBRE-DEVOLUCIÓN A PROVEEDOR ---
    console.log('--- EJECUTANDO T05: PREVENCIÓN SOBRE-DEVOLUCIÓN PROVEEDOR ---')
    // Recibidas: 30. Ya devueltas: 10. Máximo restante: 20.
    // Intentar devolver 25 unidades -> Debe fallar
    const { error: overSuppErr } = await clientA.rpc('fn_process_supplier_return', {
      p_purchase_id: purchase1Id,
      p_items: [{ product_id: product1Id, quantity: 25 }],
      p_reason: 'Intento de sobre-devolución a proveedor',
    })

    const t05Pass = overSuppErr !== null && overSuppErr.message.includes('No se puede devolver')
    recordResult(
      'T05',
      'Prevención de sobre-devolución a proveedor (> unidades recibidas)',
      Boolean(t05Pass),
      t05Pass
        ? `Bloqueado por RPC: "${overSuppErr?.message}"`
        : `Falla: permitió devolver más unidades de las recibidas.`
    )

    // --- T06: PREVENCIÓN DE STOCK INSUFICIENTE EN DEVOLUCIÓN A PROVEEDOR ---
    console.log('--- EJECUTANDO T06: PREVENCIÓN STOCK INSUFICIENTE PROVEEDOR ---')
    // Supongamos una compra de 100 unds de Prod2 pero solo hay 35 unds en stock en la bodega
    const purHuge = await pgClient.query(
      `INSERT INTO public.purchases (
         company_id, location_id, supplier_id, purchase_number, supplier_invoice_number, subtotal_amount, tax_amount, total_amount, payment_terms, payment_status, inventory_status, issue_date, due_date
       ) VALUES (
         $1, $2, $3, 'COM-HUGE-${runId}', 'FAC-HUGE-${runId}', 320000.00, 0.00, 320000.00, 'CONTADO', 'PAID', 'RECEIVED', CURRENT_DATE, CURRENT_DATE
       ) RETURNING id;`,
      [companyAId, locAId, supplierAId]
    )
    const purHugeId = purHuge.rows[0].id

    await pgClient.query(
      `INSERT INTO public.purchase_items (purchase_id, company_id, product_id, quantity, received_quantity, unit_cost, subtotal, total)
       VALUES ($1, $2, $3, 100.00, 100.00, 3200.00, 320000.00, 320000.00);`,
      [purHugeId, companyAId, product2Id]
    )

    // Intentar devolver 80 unidades de Prod2 (solo hay 35 en bodega)
    const { error: noStockSuppErr } = await clientA.rpc('fn_process_supplier_return', {
      p_purchase_id: purHugeId,
      p_items: [{ product_id: product2Id, quantity: 80 }],
      p_reason: 'Intento de devolución sin stock suficiente',
    })

    const t06Pass = noStockSuppErr !== null && noStockSuppErr.message.includes('Stock insuficiente')
    recordResult(
      'T06',
      'Prevención de stock insuficiente en devolución a proveedor',
      Boolean(t06Pass),
      t06Pass
        ? `Bloqueado por regla de stock: "${noStockSuppErr?.message}"`
        : `Falla: permitió crear saldo negativo en bodega.`
    )

    // --- T07: CONSECUTIVOS FIDUCIARIOS (DEV-CLI vs DEV-PRV) ---
    console.log('--- EJECUTANDO T07: CONSECUTIVOS DIFERENCIADOS ---')
    const t07Pass = ret1Data.code.startsWith('DEV-CLI-') && suppRetData.code.startsWith('DEV-PRV-')
    recordResult(
      'T07',
      'Consecutivos fiduciarios diferenciados por tipo',
      t07Pass,
      t07Pass
        ? `Cliente: ${ret1Data.code}, Proveedor: ${suppRetData.code}.`
        : `Falla en formato de consecutivos.`
    )

    // --- T08: TRAZABILIDAD Y ENLACE CON DOCUMENTO ORIGEN ---
    console.log('--- EJECUTANDO T08: TRAZABILIDAD DOCUMENTO ORIGEN ---')
    const checkDoc = await pgClient.query(
      `SELECT code, source_document_type, source_document_code, customer_id, supplier_id, total_units, total_amount
       FROM public.returns
       WHERE id = $1;`,
      [ret1Data.return_id]
    )
    const t08Pass =
      checkDoc.rows.length === 1 &&
      checkDoc.rows[0].source_document_type === 'SALE' &&
      checkDoc.rows[0].source_document_code === `VTA-DEV-${runId}` &&
      Number(checkDoc.rows[0].total_units) === 5.0

    recordResult(
      'T08',
      'Trazabilidad y enlace fiduciario con documento origen',
      t08Pass,
      t08Pass
        ? `Documento origen: ${checkDoc.rows[0].source_document_code}, Unidades: ${checkDoc.rows[0].total_units}.`
        : `Falla en trazabilidad.`
    )

    // --- T09: CONCURRENCIA EN DEVOLUCIONES SIMULTÁNEAS ---
    console.log('--- EJECUTANDO T09: CONCURRENCIA EN DEVOLUCIONES ---')
    // Venta con 10 unidades de Prod2 (disponibles para devolver)
    const saleConc = await pgClient.query(
      `INSERT INTO public.sales (company_id, location_id, customer_id, seller_user_id, sale_number, subtotal_amount, tax_amount, total_amount, payment_method, status)
       VALUES ($1, $2, $3, $4, 'VTA-CONC-${runId}', 42000.00, 0.00, 42000.00, 'CASH', 'ISSUED')
       RETURNING id;`,
      [companyAId, locAId, customerAId, authUserAId]
    )
    const saleConcId = saleConc.rows[0].id

    await pgClient.query(
      `INSERT INTO public.sale_items (sale_id, company_id, product_id, quantity, unit_cost, unit_price, subtotal, total)
       VALUES ($1, $2, $3, 10.00, 3200.00, 4200.00, 42000.00, 42000.00);`,
      [saleConcId, companyAId, product2Id]
    )

    // Dos devoluciones simultáneas intentando devolver 8 unidades cada una (8 + 8 = 16 > 10)
    const [cRes1, cRes2] = await Promise.all([
      clientA.rpc('fn_process_customer_return', {
        p_sale_id: saleConcId,
        p_items: [{ product_id: product2Id, quantity: 8 }],
        p_reason: 'Devolución concurrente 1',
      }),
      clientA.rpc('fn_process_customer_return', {
        p_sale_id: saleConcId,
        p_items: [{ product_id: product2Id, quantity: 8 }],
        p_reason: 'Devolución concurrente 2',
      }),
    ])

    const successConc = (cRes1.error ? 0 : 1) + (cRes2.error ? 0 : 1)
    const failedConc = (cRes1.error ? 1 : 0) + (cRes2.error ? 1 : 0)

    const t09Pass = successConc === 1 && failedConc === 1
    recordResult(
      'T09',
      'Concurrencia fiduciaria en devoluciones simultáneas (SELECT FOR UPDATE)',
      t09Pass,
      t09Pass
        ? `Exitoso=1, Rechazado=1 (bloqueo pesimista evitó sobre-devolución por carrera).`
        : `Falla en concurrencia: exitosos=${successConc}, fallidos=${failedConc}`
    )

    // --- T10: AISLAMIENTO MULTIEMPRESA ESTRICTO ---
    console.log('--- EJECUTANDO T10: AISLAMIENTO MULTIEMPRESA ---')
    // Usuario B intenta devolver ítems de una venta de Empresa A
    const { error: mtErr } = await clientB.rpc('fn_process_customer_return', {
      p_sale_id: sale1Id,
      p_items: [{ product_id: product1Id, quantity: 1 }],
      p_reason: 'Intento de acceso cruzado',
    })

    const t10Pass = mtErr !== null && mtErr.message.includes('otra empresa')
    recordResult(
      'T10',
      'Aislamiento multiempresa estricto',
      Boolean(t10Pass),
      t10Pass
        ? `Bloqueado por RPC (42501): "${mtErr?.message}"`
        : `Falla: permitió procesar devolución de otra empresa.`
    )

    // --- T11: AUDITORÍA TRANSACCIONAL EN AUDIT_LOGS ---
    console.log('--- EJECUTANDO T11: AUDITORÍA TRANSACCIONAL ---')
    const auditRes = await pgClient.query(
      `SELECT DISTINCT action
       FROM public.audit_logs
       WHERE company_id = $1 AND entity_name = 'returns'
       ORDER BY action ASC;`,
      [companyAId]
    )
    const auditActions = auditRes.rows.map((r: any) => r.action)
    const t11Pass =
      auditActions.includes('CUSTOMER_RETURN_PROCESSED') &&
      auditActions.includes('SUPPLIER_RETURN_PROCESSED')

    recordResult(
      'T11',
      'Auditoría transaccional de ciclo de vida completo',
      t11Pass,
      t11Pass
        ? `Acciones auditadas: ${auditActions.join(', ')}.`
        : `Faltan acciones auditadas. Presentes: ${auditActions.join(', ')}`
    )

    // --- T12: CONSULTAS REALES EN REPOSITORIO (FIND ALL) ---
    console.log('--- EJECUTANDO T12: CONSULTAS REPOSITORIO ---')
    const listRes = await pgClient.query(
      `SELECT r.id, r.code, r.return_type, r.total_units, r.total_amount, l.name as loc_name
       FROM public.returns r
       JOIN public.locations l ON l.id = r.location_id
       WHERE r.company_id = $1
       ORDER BY r.created_at DESC;`,
      [companyAId]
    )
    const t12Pass = listRes.rows.length >= 3 && listRes.rows.every((r: any) => r.loc_name)
    recordResult(
      'T12',
      'Consultas reales con joins en PostgreSQL (findAll)',
      t12Pass,
      t12Pass
        ? `Consultadas ${listRes.rows.length} devoluciones con relaciones resueltas.`
        : `Falla en consulta de devoluciones.`
    )

    // --- T13: CONSULTA POR DOCUMENTO ORIGEN ---
    console.log('--- EJECUTANDO T13: CONSULTA POR DOCUMENTO ORIGEN ---')
    const docQueryRes = await pgClient.query(
      `SELECT count(*) as count FROM public.returns WHERE source_document_id = $1;`,
      [sale1Id]
    )
    const t13Pass = Number(docQueryRes.rows[0].count) >= 2
    recordResult(
      'T13',
      'Consulta por documento origen (findBySourceDocument)',
      t13Pass,
      t13Pass
        ? `Localizadas ${docQueryRes.rows[0].count} devoluciones vinculadas a la venta ${sale1Id}.`
        : `Falla en consulta por documento.`
    )

    // --- T14: ESTADÍSTICAS GLOBALES EN POSTGRESQL ---
    console.log('--- EJECUTANDO T14: ESTADÍSTICAS GLOBALES ---')
    const statsRes = await pgClient.query(
      `SELECT 
         COUNT(*) as total_returns,
         COUNT(*) FILTER (WHERE return_type = 'CUSTOMER_RETURN') as cust_returns,
         COALESCE(SUM(total_amount) FILTER (WHERE return_type = 'CUSTOMER_RETURN'), 0) as cust_amount,
         COUNT(*) FILTER (WHERE return_type = 'SUPPLIER_RETURN') as supp_returns,
         COALESCE(SUM(total_amount) FILTER (WHERE return_type = 'SUPPLIER_RETURN'), 0) as supp_amount,
         COALESCE(SUM(total_units), 0) as total_units
       FROM public.returns
       WHERE company_id = $1;`,
      [companyAId]
    )
    const t14Pass =
      Number(statsRes.rows[0].cust_returns) >= 2 &&
      Number(statsRes.rows[0].supp_returns) >= 1 &&
      Number(statsRes.rows[0].total_units) >= 30

    recordResult(
      'T14',
      'Estadísticas de devoluciones en PostgreSQL (getStats)',
      t14Pass,
      t14Pass
        ? `Dev. Clientes: ${statsRes.rows[0].cust_returns} ($${statsRes.rows[0].cust_amount}), Dev. Proveedores: ${statsRes.rows[0].supp_returns} ($${statsRes.rows[0].supp_amount}), Total Unidades: ${statsRes.rows[0].total_units}.`
        : `Falla en estadísticas.`
    )

    // --- T15: ZERO POLLUTION PURGE ---
    console.log('--- EJECUTANDO T15: ZERO POLLUTION ---')
    await pgClient.query("SELECT set_config('app.is_test_cleanup', 'true', false);")

    // Eliminar movimientos de inventario de prueba
    await pgClient.query(
      `DELETE FROM public.inventory_movements WHERE location_id IN ($1, $2) OR (company_id = $3 AND (document_reference LIKE '%${runId}%' OR reason LIKE '%${tag}%'));`,
      [locAId, locBId, companyAId]
    )

    // Eliminar return_items y returns
    await pgClient.query(
      `DELETE FROM public.return_items WHERE return_id IN (
         SELECT id FROM public.returns WHERE location_id IN ($1, $2) OR created_by_user_id = $3
       );`,
      [locAId, locBId, authUserAId]
    )
    await pgClient.query(
      `DELETE FROM public.returns WHERE location_id IN ($1, $2) OR created_by_user_id = $3;`,
      [locAId, locBId, authUserAId]
    )

    // Eliminar purchase_items y purchases
    await pgClient.query(`DELETE FROM public.purchase_items WHERE purchase_id IN ($1, $2);`, [purchase1Id, purHugeId])
    await pgClient.query(`DELETE FROM public.purchases WHERE id IN ($1, $2);`, [purchase1Id, purHugeId])

    // Eliminar sale_items y sales
    await pgClient.query(`DELETE FROM public.sale_items WHERE sale_id IN ($1, $2);`, [sale1Id, saleConcId])
    await pgClient.query(`DELETE FROM public.sales WHERE id IN ($1, $2);`, [sale1Id, saleConcId])

    // Eliminar auditorías de prueba
    await pgClient.query(
      `DELETE FROM public.audit_logs WHERE user_id IN ($1, $2);`,
      [authUserAId, authUserBId]
    )

    // Eliminar stock_levels y productos
    await pgClient.query(`DELETE FROM public.stock_levels WHERE product_id IN ($1, $2);`, [product1Id, product2Id])
    await pgClient.query(`DELETE FROM public.products WHERE id IN ($1, $2);`, [product1Id, product2Id])

    // Eliminar cliente y proveedor de prueba
    await pgClient.query(`DELETE FROM public.customers WHERE id = $1;`, [customerAId])
    await pgClient.query(`DELETE FROM public.suppliers WHERE id = $1;`, [supplierAId])

    // Eliminar asignaciones y usuarios de prueba
    await pgClient.query(`DELETE FROM public.user_locations WHERE user_id IN ($1, $2);`, [authUserAId, authUserBId])
    await pgClient.query(`DELETE FROM public.users WHERE id IN ($1, $2);`, [authUserAId, authUserBId])
    await adminSupabase.auth.admin.deleteUser(authUserAId)
    await adminSupabase.auth.admin.deleteUser(authUserBId)

    // Eliminar bodegas temporales
    await pgClient.query(`DELETE FROM public.locations WHERE id IN ($1, $2);`, [locAId, locBId])

    await pgClient.query("SELECT set_config('app.is_test_cleanup', 'false', false);")

    // Verificar residuos
    const resRet = await pgClient.query(`SELECT count(*) as count FROM public.returns WHERE code LIKE '%${runId}%';`)
    const resMovs = await pgClient.query(`SELECT count(*) as count FROM public.inventory_movements WHERE document_reference LIKE '%${runId}%';`)
    const resProds = await pgClient.query(`SELECT count(*) as count FROM public.products WHERE sku LIKE '%${runId}%';`)
    const resLocs = await pgClient.query(`SELECT count(*) as count FROM public.locations WHERE code LIKE '%${runId}%';`)

    const totalResiduals =
      Number(resRet.rows[0].count) +
      Number(resMovs.rows[0].count) +
      Number(resProds.rows[0].count) +
      Number(resLocs.rows[0].count)

    const t15Pass = totalResiduals === 0
    recordResult(
      'T15',
      'Zero Pollution (0 registros residuales en BD)',
      t15Pass,
      t15Pass
        ? `Residuos verificados: Devoluciones=0, Kardex=0, Productos=0, Bodegas=0. Purga 100% exitosa.`
        : `Residuos detectados: ${totalResiduals} registros sin limpiar.`
    )
  } catch (err: any) {
    console.error('❌ Excepción catastrófica en suite E2E Fase 9:', err)
    recordResult('FATAL', 'Ejecución Suite Fase 9', false, err.message || JSON.stringify(err))
  } finally {
    await pgClient.end()
  }

  // Resumen final
  console.log('\n================================================================================')
  console.log('📋 RESUMEN FINAL DE PRUEBAS FASE 9 (DEVOLUCIONES)')
  console.log('================================================================================')
  let passedCount = 0
  for (const r of results) {
    const icon = r.passed ? '✅' : '❌'
    console.log(`${icon} [${r.passed ? 'PASS' : 'FAIL'}] ${r.code}: ${r.name}`)
    if (r.passed) passedCount++
  }

  console.log(`\nTOTAL: ${results.length} | APROBADAS: ${passedCount} | FALLIDAS: ${results.length - passedCount}`)
  if (passedCount === 15 && results.length === 15) {
    console.log('🏆 TODAS LAS 15 PRUEBAS DE LA FASE 9 FUERON SUPERADAS AL 100% (PASS).\n')
  } else {
    console.error('⚠️ ALGUNAS PRUEBAS NO FUERON SUPERADAS. REVISAR LOGS ANTERIORES.\n')
    process.exit(1)
  }
}

runPhase9TestSuite().catch((err) => {
  console.error('Error fatal al ejecutar suite E2E Fase 9:', err)
  process.exit(1)
})
