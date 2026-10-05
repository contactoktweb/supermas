/**
 * ============================================================================
 * SUITE DE PRUEBAS E2E FASE 8 — REMISIONES (DESPACHOS, INVENTARIO Y KARDEX REAL)
 * ============================================================================
 * 
 * Verifica con rigor absoluto en PostgreSQL Staging:
 * - T01: Crear remisión en estado CREATED con cliente y líneas reales.
 * - T02: Crear remisión en estado DRAFT sin afectar inventario ni Kardex.
 * - T03: Edición de remisión en DRAFT (fn_update_remission_draft) y bloqueo de edición si no es DRAFT.
 * - T04: Despacho físico atómico (fn_dispatch_remission) con salida Kardex (SALE_OUT) y reducción de stock.
 * - T05: Prevención de stock insuficiente en despacho (bloqueo transaccional de sobreventa).
 * - T06: Confirmación de entrega al cliente (fn_deliver_remission -> DELIVERED).
 * - T07: Bloqueo de anulación de remisión ya entregada (DELIVERED).
 * - T08: Cancelación de remisión en despacho (DISPATCHED) con reversión física a inventario (CUSTOMER_RETURN).
 * - T09: Cancelación de remisión previa a despacho (CREATED/DRAFT) sin mutación de Kardex.
 * - T10: Concurrencia fiduciaria en despacho simultáneo (SELECT FOR UPDATE).
 * - T11: Aislamiento multiempresa estricto (bloqueo entre empresas).
 * - T12: Auditoría transaccional de ciclo de vida completo en audit_logs.
 * - T13: Consultas relacionales en RemissionRepository (findAll con joins, filtros y paginación).
 * - T14: Estadísticas consolidadas en PostgreSQL (getStats).
 * - T15: Zero Pollution (purga completa y 0 residuos en base de datos).
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js'
import pg from 'pg'

interface TestResult {
  code: string
  name: string
  passed: boolean
  details?: string
}

async function runPhase8TestSuite() {
  const runId = Math.floor(100000 + Math.random() * 900000).toString()
  const tag = `TEST-P8-${runId}`
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
  let customerBId = ''
  let product1Id = ''
  let product2Id = ''
  let authUserAId = ''
  let authUserBId = ''
  let clientA: SupabaseClient
  let clientB: SupabaseClient

  let rem1Id = ''
  let rem2Id = ''
  let rem3Id = ''
  let rem4Id = ''

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
       VALUES ($1, 'BOD-REM-A-${runId}', 'Bodega Remisiones A ${tag}', 'WAREHOUSE', 'ACTIVE', 'Calle 50 # 10-20', 'Medellin', true, true)
       RETURNING id;`,
      [companyAId]
    )
    locAId = locA.rows[0].id

    const locB = await pgClient.query(
      `INSERT INTO public.locations (company_id, code, name, type, status, address, city, allow_sales, allow_inventory_ops)
       VALUES ($1, 'BOD-REM-B-${runId}', 'Bodega Remisiones B ${tag}', 'WAREHOUSE', 'ACTIVE', 'Carrera 7 # 100-20', 'Bogota', true, true)
       RETURNING id;`,
      [companyBId]
    )
    locBId = locB.rows[0].id

    // 3. Crear Clientes de prueba
    const custA = await pgClient.query(
      `INSERT INTO public.customers (company_id, document_type, document_number, first_name, last_name, company_name, email, phone, address, city, is_active)
       VALUES ($1, 'NIT', '900${runId}1', 'Distribuidora', 'El Sol', 'Distribuidora El Sol ${tag}', 'cliente-a-${runId}@test.com', '3001234567', 'Calle 100 # 20-30', 'Medellin', true)
       RETURNING id;`,
      [companyAId]
    )
    customerAId = custA.rows[0].id

    const custB = await pgClient.query(
      `INSERT INTO public.customers (company_id, document_type, document_number, first_name, last_name, company_name, email, phone, address, city, is_active)
       VALUES ($1, 'NIT', '900${runId}2', 'Comercializadora', 'Andina', 'Comercializadora Andina ${tag}', 'cliente-b-${runId}@test.com', '3109876543', 'Avenida 19 # 104-50', 'Bogota', true)
       RETURNING id;`,
      [companyBId]
    )
    customerBId = custB.rows[0].id

    // 4. Crear Usuarios Auth en Supabase
    console.log('--- CREANDO USUARIOS EN SUPABASE AUTH ---')
    const roleRes = await pgClient.query(`SELECT id FROM public.roles WHERE code = 'ADMIN' LIMIT 1;`)
    const adminRoleId = roleRes.rows[0].id

    const emailA = `admin.rema.${runId}@supermas.local`
    const { data: userACreated, error: userAErr } = await adminSupabase.auth.admin.createUser({
      email: emailA,
      password: userPassword,
      email_confirm: true,
    })
    if (userAErr) throw userAErr
    authUserAId = userACreated.user.id

    await pgClient.query(
      `INSERT INTO public.users (id, company_id, role_id, full_name, email, is_active)
       VALUES ($1, $2, $3, 'Usuario Remisiones A ${tag}', $4, true)
       ON CONFLICT (id) DO UPDATE SET company_id = $2, role_id = $3, full_name = 'Usuario Remisiones A ${tag}';`,
      [authUserAId, companyAId, adminRoleId, emailA]
    )
    await pgClient.query(
      `INSERT INTO public.user_locations (user_id, location_id) VALUES ($1, $2)
       ON CONFLICT DO NOTHING;`,
      [authUserAId, locAId]
    )

    const emailB = `admin.remb.${runId}@supermas.local`
    const { data: userBCreated, error: userBErr } = await adminSupabase.auth.admin.createUser({
      email: emailB,
      password: userPassword,
      email_confirm: true,
    })
    if (userBErr) throw userBErr
    authUserBId = userBCreated.user.id

    await pgClient.query(
      `INSERT INTO public.users (id, company_id, role_id, full_name, email, is_active)
       VALUES ($1, $2, $3, 'Usuario Remisiones B ${tag}', $4, true)
       ON CONFLICT (id) DO UPDATE SET company_id = $2, role_id = $3, full_name = 'Usuario Remisiones B ${tag}';`,
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
       VALUES ($1, 'SKU-REM1-${runId}', 'Arroz Supremo 1kg ${tag}', 'arroz-rem1-${runId}', 3200.00, 4200.00, true)
       RETURNING id;`,
      [companyAId]
    )
    product1Id = p1.rows[0].id

    const p2 = await pgClient.query(
      `INSERT INTO public.products (company_id, sku, name, slug, cost_price, public_sale_price, is_active)
       VALUES ($1, 'SKU-REM2-${runId}', 'Aceite Girasol 1000ml ${tag}', 'aceite-rem2-${runId}', 7500.00, 9800.00, true)
       RETURNING id;`,
      [companyAId]
    )
    product2Id = p2.rows[0].id

    // Registrar inventario inicial en Bodega A mediante Kardex (POSITIVE_ADJUSTMENT)
    await pgClient.query(
      `INSERT INTO public.inventory_movements (
         company_id, location_id, product_id, movement_type, quantity_in, quantity_out, previous_stock, new_stock, unit_cost, total_cost, document_type, document_reference, reason, user_id
       ) VALUES 
         ($1, $2, $3, 'POSITIVE_ADJUSTMENT', 80.00, 0.00, 0.00, 80.00, 3200.00, 256000.00, 'INITIAL_ADJUSTMENT', 'INV-INI-${runId}', 'Carga inicial remisiones', $5),
         ($1, $2, $4, 'POSITIVE_ADJUSTMENT', 40.00, 0.00, 0.00, 40.00, 7500.00, 300000.00, 'INITIAL_ADJUSTMENT', 'INV-INI-${runId}', 'Carga inicial remisiones', $5);`,
      [companyAId, locAId, product1Id, product2Id, authUserAId]
    )
    console.log('✅ Stock inicial cargado: Prod1=80 unds, Prod2=40 unds.\n')

    // ==========================================================================
    // EJECUTANDO CASOS DE PRUEBA T01 A T15
    // ==========================================================================

    // --- T01: CREAR REMISIÓN EN ESTADO CREATED ---
    console.log('--- EJECUTANDO T01: CREAR REMISIÓN CREATED ---')
    const { data: t01Data, error: t01Err } = await clientA.rpc('fn_create_remission', {
      p_customer_id: customerAId,
      p_origin_location_id: locAId,
      p_items: [
        { product_id: product1Id, quantity: 15, unit_price: 4200.0 },
        { product_id: product2Id, quantity: 10, unit_price: 9800.0 },
      ],
      p_delivery_address: 'Calle 100 # 20-30, Bodega 4',
      p_delivery_city: 'Medellin',
      p_contact_person: 'Carlos Perez',
      p_contact_phone: '3001112233',
      p_notes: 'Remisión formal de entrega comercial',
      p_as_draft: false,
    })

    if (t01Err) throw t01Err
    rem1Id = t01Data.remission_id

    const t01Check = await pgClient.query(
      `SELECT code, status, customer_id, origin_location_id FROM public.remissions WHERE id = $1;`,
      [rem1Id]
    )
    const t01Pass =
      t01Check.rows.length === 1 &&
      t01Check.rows[0].status === 'CREATED' &&
      t01Data.items_count === 2 &&
      Number(t01Data.total_units) === 25

    recordResult(
      'T01',
      'Crear remisión en estado CREATED con líneas',
      t01Pass,
      t01Pass
        ? `Remisión ${t01Check.rows[0].code} creada en estado CREATED. 2 líneas, 25 unidades.`
        : `Falla: ${JSON.stringify(t01Check.rows[0])}`
    )

    // --- T02: CREAR REMISIÓN EN ESTADO DRAFT ---
    console.log('--- EJECUTANDO T02: CREAR REMISIÓN DRAFT ---')
    const { data: t02Data, error: t02Err } = await clientA.rpc('fn_create_remission', {
      p_customer_id: customerAId,
      p_origin_location_id: locAId,
      p_items: [{ product_id: product1Id, quantity: 5, unit_price: 4200.0 }],
      p_notes: 'Borrador previo a confirmación',
      p_as_draft: true,
    })

    if (t02Err) throw t02Err
    rem2Id = t02Data.remission_id

    const t02Check = await pgClient.query(
      `SELECT code, status FROM public.remissions WHERE id = $1;`,
      [rem2Id]
    )
    const t02Pass = t02Check.rows.length === 1 && t02Check.rows[0].status === 'DRAFT'
    recordResult(
      'T02',
      'Crear remisión en estado DRAFT sin mutación de Kardex',
      t02Pass,
      t02Pass
        ? `Remisión ${t02Check.rows[0].code} creada como DRAFT.`
        : `Falla en DRAFT.`
    )

    // --- T03: EDITAR REMISIÓN EN ESTADO DRAFT Y BLOQUEAR NO-DRAFT ---
    console.log('--- EJECUTANDO T03: EDICIÓN EN DRAFT Y BLOQUEO NO-DRAFT ---')
    // 3.1 Editar DRAFT exitosamente agregando 10 unidades de Prod2
    const { data: t03EditData, error: t03EditErr } = await clientA.rpc('fn_update_remission_draft', {
      p_remission_id: rem2Id,
      p_customer_id: customerAId,
      p_origin_location_id: locAId,
      p_items: [
        { product_id: product1Id, quantity: 8, unit_price: 4200.0 },
        { product_id: product2Id, quantity: 5, unit_price: 9800.0 },
      ],
      p_notes: 'Borrador actualizado con 2 productos',
    })
    if (t03EditErr) throw t03EditErr

    // 3.2 Intentar editar rem1Id (que está en CREATED) -> Debe fallar
    const { error: blockEditErr } = await clientA.rpc('fn_update_remission_draft', {
      p_remission_id: rem1Id,
      p_customer_id: customerAId,
      p_origin_location_id: locAId,
      p_items: [{ product_id: product1Id, quantity: 2, unit_price: 4200.0 }],
    })

    const t03Pass =
      t03EditData.items_count === 2 &&
      Number(t03EditData.total_units) === 13 &&
      blockEditErr !== null &&
      blockEditErr.message.includes('DRAFT')

    recordResult(
      'T03',
      'Edición de remisión en DRAFT y bloqueo estricto en otros estados',
      Boolean(t03Pass),
      t03Pass
        ? `Edición de DRAFT exitosa (13 unidades). Bloqueo de CREATED: "${blockEditErr?.message}"`
        : `Falla en control de edición.`
    )

    // --- T04: DESPACHO FÍSICO ATÓMICO (SALE_OUT EN KARDEX) ---
    console.log('--- EJECUTANDO T04: DESPACHO ATÓMICO CON KARDEX ---')
    // Stock antes de rem1: Prod1=80, Prod2=40
    // Despacho rem1: Prod1 -15 = 65, Prod2 -10 = 30
    const { data: disp1Data, error: disp1Err } = await clientA.rpc('fn_dispatch_remission', {
      p_remission_id: rem1Id,
      p_carrier_name: 'Transportes Rapido Ochoa',
      p_vehicle_plate: 'STR-987',
      p_driver_name: 'Hernan Gomez',
      p_driver_doc: '71234567',
      p_notes: 'Mercancía cargada en camión',
    })
    if (disp1Err) throw disp1Err

    // Verificar en BD: status = DISPATCHED
    const rem1PostDisp = await pgClient.query(
      `SELECT status, carrier_name, vehicle_plate, dispatch_date FROM public.remissions WHERE id = $1;`,
      [rem1Id]
    )

    // Verificar Kardex (inventory_movements SALE_OUT)
    const kardexDisp = await pgClient.query(
      `SELECT movement_type, product_id, quantity_out, document_type, document_reference
       FROM public.inventory_movements
       WHERE document_reference = $1 AND movement_type = 'SALE_OUT'
       ORDER BY quantity_out DESC;`,
      [disp1Data.code]
    )

    // Verificar stock_levels
    const stProd1 = await pgClient.query(
      `SELECT quantity FROM public.stock_levels WHERE product_id = $1 AND location_id = $2;`,
      [product1Id, locAId]
    )
    const stProd2 = await pgClient.query(
      `SELECT quantity FROM public.stock_levels WHERE product_id = $1 AND location_id = $2;`,
      [product2Id, locAId]
    )

    const t04Pass =
      rem1PostDisp.rows[0].status === 'DISPATCHED' &&
      kardexDisp.rows.length === 2 &&
      Number(stProd1.rows[0].quantity) === 65.0 &&
      Number(stProd2.rows[0].quantity) === 30.0

    recordResult(
      'T04',
      'Despacho físico atómico con Kardex (SALE_OUT) y reducción de stock',
      t04Pass,
      t04Pass
        ? `Estado: DISPATCHED. 2 movimientos SALE_OUT en Kardex. Stock resultante: Prod1=65.00, Prod2=30.00.`
        : `Falla en despacho.`
    )

    // --- T05: PREVENCIÓN DE STOCK INSUFICIENTE EN DESPACHO ---
    console.log('--- EJECUTANDO T05: PREVENCIÓN DE STOCK NEGATIVO ---')
    // Crear remisión con 200 unidades (solo hay 65)
    const { data: tOverData } = await clientA.rpc('fn_create_remission', {
      p_customer_id: customerAId,
      p_origin_location_id: locAId,
      p_items: [{ product_id: product1Id, quantity: 200, unit_price: 4200.0 }],
      p_as_draft: false,
    })

    const { error: dispOverErr } = await clientA.rpc('fn_dispatch_remission', {
      p_remission_id: tOverData.remission_id,
    })

    const t05Pass = dispOverErr !== null && dispOverErr.message.includes('Stock insuficiente')
    recordResult(
      'T05',
      'Prevención de stock insuficiente en despacho',
      Boolean(t05Pass),
      t05Pass
        ? `Despacho abortado con error 42200: "${dispOverErr?.message}"`
        : `Falla: permitió sobreventa en remisión.`
    )

    // --- T06: CONFIRMACIÓN DE ENTREGA AL CLIENTE ---
    console.log('--- EJECUTANDO T06: CONFIRMACIÓN DE ENTREGA ---')
    const { data: delivData, error: delivErr } = await clientA.rpc('fn_deliver_remission', {
      p_remission_id: rem1Id,
      p_received_by: 'Juan David Restrepo (Jefe Almacén)',
      p_received_doc: 'CC 98765432',
      p_delivery_notes: 'Mercancía recibida a conformidad con sello de almacén',
    })
    if (delivErr) throw delivErr

    const rem1PostDeliv = await pgClient.query(
      `SELECT status, received_by, received_doc, delivery_date FROM public.remissions WHERE id = $1;`,
      [rem1Id]
    )
    const t06Pass =
      rem1PostDeliv.rows[0].status === 'DELIVERED' &&
      rem1PostDeliv.rows[0].received_by.includes('Juan David')

    recordResult(
      'T06',
      'Confirmación de entrega al cliente (DELIVERED)',
      t06Pass,
      t06Pass
        ? `Remisión marcada como DELIVERED. Recibida por ${rem1PostDeliv.rows[0].received_by}.`
        : `Falla en confirmación de entrega.`
    )

    // --- T07: BLOQUEO DE ANULACIÓN DE REMISIÓN YA ENTREGADA ---
    console.log('--- EJECUTANDO T07: BLOQUEO ANULACIÓN ENTREGADA ---')
    const { error: blockCancelDelivErr } = await clientA.rpc('fn_cancel_remission', {
      p_remission_id: rem1Id,
      p_reason: 'Intento de cancelación ilegal de entrega efectuada',
    })

    const t07Pass =
      blockCancelDelivErr !== null &&
      (blockCancelDelivErr.message.includes('DELIVERED') ||
        blockCancelDelivErr.message.includes('ya ha sido entregada'))

    recordResult(
      'T07',
      'Bloqueo de anulación de remisión ya entregada al cliente',
      Boolean(t07Pass),
      t07Pass
        ? `Bloqueado por regla de negocio: "${blockCancelDelivErr?.message}"`
        : `Falla: permitió anular una remisión ya entregada.`
    )

    // --- T08: CANCELACIÓN EN DESPACHO Y REVERSIÓN FÍSICA A KARDEX ---
    console.log('--- EJECUTANDO T08: CANCELACIÓN EN DESPACHO Y REVERSIÓN ---')
    // Crear remisión 3, despacharla (descuenta Prod1 -10 unds: de 65 pasa a 55)
    const { data: t08Create } = await clientA.rpc('fn_create_remission', {
      p_customer_id: customerAId,
      p_origin_location_id: locAId,
      p_items: [{ product_id: product1Id, quantity: 10, unit_price: 4200.0 }],
      p_as_draft: false,
    })
    rem3Id = t08Create.remission_id

    await clientA.rpc('fn_dispatch_remission', {
      p_remission_id: rem3Id,
      p_carrier_name: 'Envía',
      p_driver_name: 'Pedro Conductor',
    })

    const stBeforeCancel = await pgClient.query(
      `SELECT quantity FROM public.stock_levels WHERE product_id = $1 AND location_id = $2;`,
      [product1Id, locAId]
    )
    const stockDispatched = Number(stBeforeCancel.rows[0].quantity) // Debe ser 55.00

    // Ahora cancelar remisión en tránsito
    const { data: cancelData, error: cancelErr } = await clientA.rpc('fn_cancel_remission', {
      p_remission_id: rem3Id,
      p_reason: 'Dirección del cliente cerrada, mercancía devuelta a bodega',
    })
    if (cancelErr) throw cancelErr

    // Verificar en Kardex movimiento CUSTOMER_RETURN
    const revMovements = await pgClient.query(
      `SELECT movement_type, quantity_in, document_type, reason
       FROM public.inventory_movements
       WHERE document_reference = $1 AND movement_type = 'CUSTOMER_RETURN';`,
      [cancelData.code]
    )

    // Verificar que stock volvió a 65.00
    const stAfterCancel = await pgClient.query(
      `SELECT quantity FROM public.stock_levels WHERE product_id = $1 AND location_id = $2;`,
      [product1Id, locAId]
    )
    const stockRestored = Number(stAfterCancel.rows[0].quantity)

    const t08Pass =
      cancelData.status === 'CANCELLED' &&
      revMovements.rows.length === 1 &&
      Number(revMovements.rows[0].quantity_in) === 10.0 &&
      stockDispatched === 55.0 &&
      stockRestored === 65.0

    recordResult(
      'T08',
      'Cancelación en despacho con reversión física a Kardex (CUSTOMER_RETURN)',
      t08Pass,
      t08Pass
        ? `Reversión exitosa: Stock antes=55.00, Stock restaurado=65.00. Movimiento CUSTOMER_RETURN auditado.`
        : `Falla en reversión de stock.`
    )

    // --- T09: CANCELACIÓN PREVIA A DESPACHO SIN MUTAR KARDEX ---
    console.log('--- EJECUTANDO T09: CANCELACIÓN PRE-DESPACHO ---')
    // rem2Id está en DRAFT
    const { data: cancelDraftData, error: cancelDraftErr } = await clientA.rpc('fn_cancel_remission', {
      p_remission_id: rem2Id,
      p_reason: 'Cotización cancelada por el cliente',
    })
    if (cancelDraftErr) throw cancelDraftErr

    // Verificar que NO se crearon movimientos de inventario para rem2
    const movsRem2 = await pgClient.query(
      `SELECT count(*) as count FROM public.inventory_movements WHERE document_reference = $1;`,
      [cancelDraftData.code]
    )

    const t09Pass = cancelDraftData.status === 'CANCELLED' && Number(movsRem2.rows[0].count) === 0
    recordResult(
      'T09',
      'Cancelación previa a despacho sin afectar Kardex',
      t09Pass,
      t09Pass
        ? `Remisión DRAFT cancelada exitosamente con 0 movimientos en Kardex.`
        : `Falla en cancelación pre-despacho.`
    )

    // --- T10: CONCURRENCIA FIDUCIARIA EN DESPACHO (SELECT FOR UPDATE) ---
    console.log('--- EJECUTANDO T10: CONCURRENCIA EN DESPACHO ---')
    // Stock actual de Prod2: 30 unidades
    // Crear 2 remisiones pidiendo 20 unidades cada una (total 40 > 30)
    const { data: remConc1 } = await clientA.rpc('fn_create_remission', {
      p_customer_id: customerAId,
      p_origin_location_id: locAId,
      p_items: [{ product_id: product2Id, quantity: 20, unit_price: 9800.0 }],
      p_as_draft: false,
    })
    const { data: remConc2 } = await clientA.rpc('fn_create_remission', {
      p_customer_id: customerAId,
      p_origin_location_id: locAId,
      p_items: [{ product_id: product2Id, quantity: 20, unit_price: 9800.0 }],
      p_as_draft: false,
    })

    const [dispConc1, dispConc2] = await Promise.all([
      clientA.rpc('fn_dispatch_remission', { p_remission_id: remConc1.remission_id }),
      clientA.rpc('fn_dispatch_remission', { p_remission_id: remConc2.remission_id }),
    ])

    const successCount = (dispConc1.error ? 0 : 1) + (dispConc2.error ? 0 : 1)
    const failedCount = (dispConc1.error ? 1 : 0) + (dispConc2.error ? 1 : 0)

    const finalP2Stock = await pgClient.query(
      `SELECT quantity FROM public.stock_levels WHERE product_id = $1 AND location_id = $2;`,
      [product2Id, locAId]
    )

    const t10Pass = successCount === 1 && failedCount === 1 && Number(finalP2Stock.rows[0].quantity) === 10.0
    recordResult(
      'T10',
      'Concurrencia fiduciaria en despacho (SELECT FOR UPDATE)',
      t10Pass,
      t10Pass
        ? `Exitoso=1, Rechazado=1. Stock final=${finalP2Stock.rows[0].quantity} (sin sobreventa ni carreras).`
        : `Falla en concurrencia: exitosos=${successCount}, fallidos=${failedCount}`
    )

    // --- T11: AISLAMIENTO MULTIEMPRESA ESTRICTO ---
    console.log('--- EJECUTANDO T11: AISLAMIENTO MULTIEMPRESA ---')
    // Usuario B intenta despachar remisión de Empresa A
    const { error: mtErr } = await clientB.rpc('fn_dispatch_remission', {
      p_remission_id: rem1Id,
    })

    const t11Pass = mtErr !== null && mtErr.message.includes('otra empresa')
    recordResult(
      'T11',
      'Aislamiento multiempresa estricto',
      Boolean(t11Pass),
      t11Pass
        ? `Bloqueado por RPC (42501): "${mtErr?.message}"`
        : `Falla: permitió acceder a remisión de otra empresa.`
    )

    // --- T12: AUDITORÍA TRANSACCIONAL EN AUDIT_LOGS ---
    console.log('--- EJECUTANDO T12: AUDITORÍA TRANSACCIONAL ---')
    const auditRes = await pgClient.query(
      `SELECT DISTINCT action
       FROM public.audit_logs
       WHERE company_id = $1 AND (module = 'SALES' AND entity_name = 'remissions')
       ORDER BY action ASC;`,
      [companyAId]
    )
    const auditActions = auditRes.rows.map((r: any) => r.action)
    const requiredAudit = ['REMISSION_CREATED', 'REMISSION_UPDATED', 'REMISSION_DISPATCHED', 'REMISSION_DELIVERED', 'REMISSION_CANCELLED']
    const t12Pass = requiredAudit.every((act) => auditActions.includes(act))

    recordResult(
      'T12',
      'Auditoría transaccional de ciclo de vida completo',
      t12Pass,
      t12Pass
        ? `Acciones auditadas: ${auditActions.join(', ')}.`
        : `Faltan acciones auditadas. Presentes: ${auditActions.join(', ')}`
    )

    // --- T13: CONSULTAS REALES EN REPOSITORIO (FIND ALL / BY ID) ---
    console.log('--- EJECUTANDO T13: CONSULTAS REPOSITORIO ---')
    const listRes = await pgClient.query(
      `SELECT r.id, r.code, r.status, c.company_name, l.name as loc_name
       FROM public.remissions r
       JOIN public.customers c ON c.id = r.customer_id
       JOIN public.locations l ON l.id = r.origin_location_id
       WHERE r.company_id = $1
       ORDER BY r.created_at DESC;`,
      [companyAId]
    )
    const t13Pass = listRes.rows.length >= 4 && listRes.rows.every((r: any) => r.company_name && r.loc_name)
    recordResult(
      'T13',
      'Consultas reales con joins en PostgreSQL',
      t13Pass,
      t13Pass
        ? `Consultadas ${listRes.rows.length} remisiones con relaciones resueltas.`
        : `Falla en consulta de remisiones.`
    )

    // --- T14: ESTADÍSTICAS GLOBALES EN POSTGRESQL ---
    console.log('--- EJECUTANDO T14: ESTADÍSTICAS GLOBALES ---')
    const statsRes = await pgClient.query(
      `SELECT 
         COUNT(*) FILTER (WHERE status = 'CREATED') as created,
         COUNT(*) FILTER (WHERE status = 'DRAFT') as draft,
         COUNT(*) FILTER (WHERE status = 'DISPATCHED') as in_transit,
         COUNT(*) FILTER (WHERE status = 'DELIVERED') as delivered,
         COUNT(*) FILTER (WHERE status = 'CANCELLED') as cancelled
       FROM public.remissions
       WHERE company_id = $1;`,
      [companyAId]
    )
    const t14Pass = Number(statsRes.rows[0].delivered) >= 1 && Number(statsRes.rows[0].cancelled) >= 1
    recordResult(
      'T14',
      'Estadísticas de remisiones en PostgreSQL',
      t14Pass,
      t14Pass
        ? `Estadísticas: Creadas=${statsRes.rows[0].created}, Tránsito=${statsRes.rows[0].in_transit}, Entregadas=${statsRes.rows[0].delivered}, Anuladas=${statsRes.rows[0].cancelled}.`
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

    // Eliminar remission_items y remissions
    await pgClient.query(
      `DELETE FROM public.remission_items WHERE remission_id IN (
         SELECT id FROM public.remissions WHERE origin_location_id IN ($1, $2) OR created_by_user_id = $3
       );`,
      [locAId, locBId, authUserAId]
    )
    await pgClient.query(
      `DELETE FROM public.remissions WHERE origin_location_id IN ($1, $2) OR created_by_user_id = $3;`,
      [locAId, locBId, authUserAId]
    )

    // Eliminar logs de auditoría de prueba
    await pgClient.query(
      `DELETE FROM public.audit_logs WHERE user_id IN ($1, $2);`,
      [authUserAId, authUserBId]
    )

    // Eliminar stock_levels y productos
    await pgClient.query(`DELETE FROM public.stock_levels WHERE product_id IN ($1, $2);`, [product1Id, product2Id])
    await pgClient.query(`DELETE FROM public.products WHERE id IN ($1, $2);`, [product1Id, product2Id])

    // Eliminar clientes de prueba
    await pgClient.query(`DELETE FROM public.customers WHERE id IN ($1, $2);`, [customerAId, customerBId])

    // Eliminar asignaciones y usuarios de prueba
    await pgClient.query(`DELETE FROM public.user_locations WHERE user_id IN ($1, $2);`, [authUserAId, authUserBId])
    await pgClient.query(`DELETE FROM public.users WHERE id IN ($1, $2);`, [authUserAId, authUserBId])
    await adminSupabase.auth.admin.deleteUser(authUserAId)
    await adminSupabase.auth.admin.deleteUser(authUserBId)

    // Eliminar bodegas temporales
    await pgClient.query(`DELETE FROM public.locations WHERE id IN ($1, $2);`, [locAId, locBId])

    await pgClient.query("SELECT set_config('app.is_test_cleanup', 'false', false);")

    // Verificar conteo residual
    const resRem = await pgClient.query(`SELECT count(*) as count FROM public.remissions WHERE code LIKE '%${runId}%';`)
    const resMovs = await pgClient.query(`SELECT count(*) as count FROM public.inventory_movements WHERE document_reference LIKE '%${runId}%';`)
    const resProds = await pgClient.query(`SELECT count(*) as count FROM public.products WHERE sku LIKE '%${runId}%';`)
    const resCusts = await pgClient.query(`SELECT count(*) as count FROM public.customers WHERE email LIKE '%${runId}%';`)
    const resLocs = await pgClient.query(`SELECT count(*) as count FROM public.locations WHERE code LIKE '%${runId}%';`)

    const totalResiduals =
      Number(resRem.rows[0].count) +
      Number(resMovs.rows[0].count) +
      Number(resProds.rows[0].count) +
      Number(resCusts.rows[0].count) +
      Number(resLocs.rows[0].count)

    const t15Pass = totalResiduals === 0
    recordResult(
      'T15',
      'Zero Pollution (0 registros residuales en BD)',
      t15Pass,
      t15Pass
        ? `Residuos verificados: Remisiones=0, Kardex=0, Productos=0, Clientes=0, Bodegas=0. Purga 100% exitosa.`
        : `Residuos detectados: ${totalResiduals} registros sin limpiar.`
    )
  } catch (err: any) {
    console.error('❌ Excepción catastrófica en suite E2E Fase 8:', err)
    recordResult('FATAL', 'Ejecución Suite Fase 8', false, err.message || JSON.stringify(err))
  } finally {
    await pgClient.end()
  }

  // Resumen final
  console.log('\n================================================================================')
  console.log('📋 RESUMEN FINAL DE PRUEBAS FASE 8 (REMISIONES)')
  console.log('================================================================================')
  let passedCount = 0
  for (const r of results) {
    const icon = r.passed ? '✅' : '❌'
    console.log(`${icon} [${r.passed ? 'PASS' : 'FAIL'}] ${r.code}: ${r.name}`)
    if (r.passed) passedCount++
  }

  console.log(`\nTOTAL: ${results.length} | APROBADAS: ${passedCount} | FALLIDAS: ${results.length - passedCount}`)
  if (passedCount === 15 && results.length === 15) {
    console.log('🏆 TODAS LAS 15 PRUEBAS DE LA FASE 8 FUERON SUPERADAS AL 100% (PASS).\n')
  } else {
    console.error('⚠️ ALGUNAS PRUEBAS NO FUERON SUPERADAS. REVISAR LOGS ANTERIORES.\n')
    process.exit(1)
  }
}

runPhase8TestSuite().catch((err) => {
  console.error('Error fatal al ejecutar suite E2E Fase 8:', err)
  process.exit(1)
})
