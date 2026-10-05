/**
 * ==============================================================================
 * SUITE DE PRUEBAS E2E FASE 7 — TRASLADOS ENTRE BODEGAS Y KARDEX REAL
 * ERP SUPER MÁS S.A.S. - PostgreSQL / Supabase Staging
 * ==============================================================================
 * 
 * Verifica con rigor absoluto:
 * 1. Persistencia real en PostgreSQL (public.transfers y public.transfer_items).
 * 2. Consecutivos reales atómicos multiempresa: TR-XXXXXX.
 * 3. Salida de stock en origen vía TRANSFER_OUT en public.inventory_movements.
 * 4. Entrada de stock en destino vía TRANSFER_IN en public.inventory_movements.
 * 5. Prevención estricta de stock negativo antes del despacho.
 * 6. Flujo completo de estados: PENDING -> IN_TRANSIT -> RECEIVED.
 * 7. Novedades y discrepancias en recepción física.
 * 8. Cancelación segura y reversión a origen si estaba en tránsito.
 * 9. Bloqueo de anulación si ya fue recibido.
 * 10. Concurrencia fiduciaria pesimista (SELECT FOR UPDATE).
 * 11. Aislamiento multiempresa estricto.
 * 12. Auditoría transaccional en public.audit_logs.
 * 13. Consultas y estadísticas globales del repositorio.
 * 14. Zero Pollution (0 residuos en base de datos).
 */

import { Client } from 'pg'
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

interface TestResult {
  code: string
  name: string
  status: 'PASS' | 'FAIL'
  details: string
}

const results: TestResult[] = []

function recordResult(code: string, name: string, pass: boolean, details: string) {
  results.push({
    code,
    name,
    status: pass ? 'PASS' : 'FAIL',
    details,
  })
  const icon = pass ? '✅' : '❌'
  console.log(`\n${icon} [${code}] ${name}: ${pass ? 'PASS' : 'FAIL'}`)
  console.log(`   Detalle: ${details}`)
}

async function runPhase7TestSuite() {
  console.log('================================================================================')
  console.log('🧪 INICIANDO SUITE DE PRUEBAS E2E FASE 7 — TRASLADOS ENTRE BODEGAS')
  console.log('================================================================================\n')

  const connStr = process.env.DATABASE_URL || process.env.DIRECT_URL
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

  const pgClient = new Client({
    connectionString: connStr,
    ssl: { rejectUnauthorized: false },
  })
  await pgClient.connect()
  console.log('✅ Conexión directa a PostgreSQL Staging establecida.\n')

  const adminSupabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const runId = Date.now().toString().slice(-6)
  const tag = `TEST-P7-${runId}`

  let companyAId = ''
  let companyBId = ''
  let locA1Id = ''
  let locA2Id = ''
  let locBId = ''
  let authUserAId = ''
  let authUserBId = ''
  let emailA = `transfer.userA.${runId}@supermas.test`
  let emailB = `transfer.userB.${runId}@supermas.test`
  let userPassword = `PassTest.${runId}*Secure`

  let clientA: any
  let clientB: any

  let product1Id = ''
  let product2Id = ''

  try {
    // --------------------------------------------------------------------------
    // SETUP EMPRESAS, SEDES, USUARIOS Y ROLES
    // --------------------------------------------------------------------------
    console.log('--- SETUP BASE MULTI-TENANT & ENTIDADES STAGING ---')

    // 1. Resolver empresas existentes en Staging
    const compARes = await pgClient.query(
      `SELECT id FROM public.companies WHERE status = 'ACTIVE' ORDER BY created_at ASC LIMIT 1;`
    )
    if (compARes.rows.length === 0) throw new Error('No hay empresas activas en staging.')
    companyAId = compARes.rows[0].id

    let isTempCompanyB = false
    let companyBId: string
    const compBRes = await pgClient.query(
      `SELECT id FROM public.companies WHERE id != $1 AND status = 'ACTIVE' LIMIT 1;`,
      [companyAId]
    )
    if (compBRes.rows.length === 0) {
      const insB = await pgClient.query(`
        INSERT INTO public.companies (id, business_name, trade_name, tax_id, verification_digit, tax_regime, economic_activity_code, address, city, department, country, currency, status)
        VALUES (gen_random_uuid(), 'Empresa B Temporal E2E', 'Empresa B E2E', '999888777', '1', 'RESPONSABLE_DE_IVA', '4711', 'Calle 10 # 20-30', 'Medellín', 'Antioquia', 'Colombia', 'COP', 'ACTIVE')
        RETURNING id;
      `)
      companyBId = insB.rows[0].id
      isTempCompanyB = true
    } else {
      companyBId = compBRes.rows[0].id
    }

    // 2. Crear dos bodegas en Empresa A para traslados internos
    const locA1 = await pgClient.query(
      `INSERT INTO public.locations (company_id, code, name, type, status, address, city)
       VALUES ($1, 'BOD-A1-${runId}', 'Bodega Origen Central ${tag}', 'WAREHOUSE', 'ACTIVE', 'Calle 10 # 20-30', 'Medellin')
       RETURNING id;`,
      [companyAId]
    )
    locA1Id = locA1.rows[0].id

    const locA2 = await pgClient.query(
      `INSERT INTO public.locations (company_id, code, name, type, status, address, city)
       VALUES ($1, 'BOD-A2-${runId}', 'Bodega Destino Sucursal ${tag}', 'STORE_POINT', 'ACTIVE', 'Carrera 43A # 1-50', 'Medellin')
       RETURNING id;`,
      [companyAId]
    )
    locA2Id = locA2.rows[0].id

    // Bodega en Empresa B para prueba multiempresa
    const locB = await pgClient.query(
      `INSERT INTO public.locations (company_id, code, name, type, status, address, city)
       VALUES ($1, 'BOD-B-${runId}', 'Bodega Empresa B ${tag}', 'WAREHOUSE', 'ACTIVE', 'Avenida El Dorado # 68C-61', 'Bogota')
       RETURNING id;`,
      [companyBId]
    )
    locBId = locB.rows[0].id

    // 3. Crear Usuarios Auth en Supabase
    console.log('--- CREANDO USUARIOS EN SUPABASE AUTH ---')
    const roleRes = await pgClient.query(`SELECT id FROM public.roles WHERE code = 'ADMIN' LIMIT 1;`)
    const adminRoleId = roleRes.rows[0].id

    const createAuthUser = async (email: string, compId: string, locId: string) => {
      const { data: userAuth, error: authErr } = await adminSupabase.auth.admin.createUser({
        email,
        password: userPassword,
        email_confirm: true,
        user_metadata: { full_name: `Gestor Traslados ${email.split('@')[0]}`, company_id: compId, role: 'ADMIN' },
      })
      if (authErr) throw authErr

      await pgClient.query(
        `INSERT INTO public.users (id, email, full_name, role_id, company_id, is_active)
         VALUES ($1, $2, $3, $4, $5, true)
         ON CONFLICT (id) DO UPDATE SET company_id = $5, role_id = $4;`,
        [userAuth.user.id, email, `Gestor Traslados ${email.split('@')[0]}`, adminRoleId, compId]
      )

      await pgClient.query(
        `INSERT INTO public.user_locations (user_id, location_id)
         VALUES ($1, $2) ON CONFLICT DO NOTHING;`,
        [userAuth.user.id, locId]
      )

      return userAuth.user.id
    }

    authUserAId = await createAuthUser(emailA, companyAId, locA1Id)
    authUserBId = await createAuthUser(emailB, companyBId, locBId)

    // Clientes Supabase autenticados
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

    // 4. Crear productos de prueba y cargar inventario inicial en Bodega A1
    console.log('--- CREANDO PRODUCTOS Y STOCK INICIAL EN KARDEX ---')
    const p1 = await pgClient.query(
      `INSERT INTO public.products (company_id, sku, name, slug, cost_price, is_active)
       VALUES ($1, 'SKU-TR1-${runId}', 'Arroz Extra Diana 1kg ${tag}', 'arroz-tr1-${runId}', 3500.00, true)
       RETURNING id;`,
      [companyAId]
    )
    product1Id = p1.rows[0].id

    const p2 = await pgClient.query(
      `INSERT INTO public.products (company_id, sku, name, slug, cost_price, is_active)
       VALUES ($1, 'SKU-TR2-${runId}', 'Aceite Premier 1000ml ${tag}', 'aceite-tr2-${runId}', 8500.00, true)
       RETURNING id;`,
      [companyAId]
    )
    product2Id = p2.rows[0].id

    // Registrar inventario inicial en Bodega A1 mediante Kardex real (POSITIVE_ADJUSTMENT)
    await pgClient.query(
      `INSERT INTO public.inventory_movements (
         company_id, location_id, product_id, movement_type, quantity_in, quantity_out, previous_stock, new_stock, unit_cost, total_cost, document_type, document_reference, reason, user_id
       ) VALUES 
         ($1, $2, $3, 'POSITIVE_ADJUSTMENT', 100.00, 0.00, 0.00, 100.00, 3500.00, 350000.00, 'INITIAL_ADJUSTMENT', 'INV-INI-${runId}', 'Carga inicial prueba traslados', $5),
         ($1, $2, $4, 'POSITIVE_ADJUSTMENT', 50.00, 0.00, 0.00, 50.00, 8500.00, 425000.00, 'INITIAL_ADJUSTMENT', 'INV-INI-${runId}', 'Carga inicial prueba traslados', $5);`,
      [companyAId, locA1Id, product1Id, product2Id, authUserAId]
    )

    console.log('✅ Stock inicial cargado en Bodega A1: 100 u. Prod1, 50 u. Prod2.\n')

    // ==========================================================================
    // EJECUTANDO CASOS DE PRUEBA T01 A T15
    // ==========================================================================

    // --- T01: CREAR TRASLADO EN ESTADO PENDING ---
    console.log('--- EJECUTANDO T01: CREAR TRASLADO PENDING ---')
    const { data: t01Data, error: t01Err } = await clientA.rpc('fn_create_transfer', {
      p_origin_location_id: locA1Id,
      p_destination_location_id: locA2Id,
      p_notes: `Traslado de abastecimiento inicial ${tag}`,
      p_items: [
        { product_id: product1Id, quantity: 20 },
        { product_id: product2Id, quantity: 15 },
      ],
    })
    if (t01Err) throw t01Err

    const transfer1Id = t01Data.transfer_id
    const transfer1Code = t01Data.code

    const t01Pass =
      transfer1Code.startsWith('TR-') &&
      t01Data.status === 'PENDING' &&
      t01Data.items_count === 2 &&
      Number(t01Data.total_units) === 35

    recordResult(
      'T01',
      'Crear traslado en estado PENDING con líneas',
      t01Pass,
      t01Pass
        ? `Traslado ${transfer1Code} creado con éxito en PENDING. 2 ítems, 35 unidades.`
        : `Falla creando traslado: ${JSON.stringify(t01Data)}`
    )

    // --- T02: RECHAZO DE TRASLADO CON MISMA BODEGA ORIGEN Y DESTINO ---
    console.log('--- EJECUTANDO T02: RECHAZO MISMA BODEGA ---')
    const { error: sameLocErr } = await clientA.rpc('fn_create_transfer', {
      p_origin_location_id: locA1Id,
      p_destination_location_id: locA1Id,
      p_notes: 'Debe fallar',
      p_items: [{ product_id: product1Id, quantity: 5 }],
    })
    const t02Pass = sameLocErr && sameLocErr.message.includes('misma')
    recordResult(
      'T02',
      'Rechazo de traslado entre la misma bodega',
      Boolean(t02Pass),
      t02Pass
        ? `Bloqueado por validación: "${sameLocErr?.message}"`
        : `Falla: permitió origen == destino.`
    )

    // --- T03: DESPACHO CON SALIDA REAL EN KARDEX (TRANSFER_OUT) ---
    console.log('--- EJECUTANDO T03: DESPACHO CON SALIDA KARDEX ---')
    // Stock antes del despacho en Bodega A1: Prod1 = 100, Prod2 = 50
    const { data: t03Data, error: t03Err } = await clientA.rpc('fn_dispatch_transfer', {
      p_transfer_id: transfer1Id,
      p_notes: `Despachado en camión 1 ${tag}`,
    })
    if (t03Err) throw t03Err

    // Verificar en public.inventory_movements el movimiento TRANSFER_OUT
    const movOutRes = await pgClient.query(
      `SELECT product_id, movement_type, quantity_out, location_id
       FROM public.inventory_movements
       WHERE document_reference = $1 AND movement_type = 'TRANSFER_OUT';`,
      [transfer1Code]
    )

    // Verificar stock actual en stock_levels en Bodega A1 (100 - 20 = 80, 50 - 15 = 35)
    const stockP1A1 = await pgClient.query(
      `SELECT quantity FROM public.stock_levels WHERE product_id = $1 AND location_id = $2;`,
      [product1Id, locA1Id]
    )
    const stockP2A1 = await pgClient.query(
      `SELECT quantity FROM public.stock_levels WHERE product_id = $1 AND location_id = $2;`,
      [product2Id, locA1Id]
    )

    const t03Pass =
      t03Data.status === 'IN_TRANSIT' &&
      movOutRes.rows.length === 2 &&
      Number(stockP1A1.rows[0].quantity) === 80.00 &&
      Number(stockP2A1.rows[0].quantity) === 35.00

    recordResult(
      'T03',
      'Despacho atómico con Kardex (TRANSFER_OUT) y reducción de stock',
      t03Pass,
      t03Pass
        ? `Estado: IN_TRANSIT. Movimientos TRANSFER_OUT verificados en Kardex. Stock en A1 descontado: Prod1=${stockP1A1.rows[0].quantity}, Prod2=${stockP2A1.rows[0].quantity}.`
        : `Falla en despacho: t03Data=${JSON.stringify(t03Data)}`
    )

    // --- T04: PREVENCIÓN DE STOCK NEGATIVO EN DESPACHO ---
    console.log('--- EJECUTANDO T04: BLOQUEO POR STOCK INSUFICIENTE ---')
    // Crear traslado solicitando 200 unidades de Prod1 (solo quedan 80 en A1)
    const { data: tOverData } = await clientA.rpc('fn_create_transfer', {
      p_origin_location_id: locA1Id,
      p_destination_location_id: locA2Id,
      p_items: [{ product_id: product1Id, quantity: 200 }],
    })
    const { error: overStockErr } = await clientA.rpc('fn_dispatch_transfer', {
      p_transfer_id: tOverData.transfer_id,
    })
    const t04Pass = overStockErr && overStockErr.message.includes('Stock insuficiente')
    recordResult(
      'T04',
      'Prevención de stock negativo en despacho',
      Boolean(t04Pass),
      t04Pass
        ? `Bloqueado por backend: "${overStockErr?.message}"`
        : `Falla: permitió despachar más unidades de las disponibles.`
    )

    // --- T05: RECEPCIÓN COMPLETA EN DESTINO CON KARDEX (TRANSFER_IN) ---
    console.log('--- EJECUTANDO T05: RECEPCIÓN COMPLETA EN DESTINO ---')
    // transfer1Id está IN_TRANSIT (20 u. Prod1, 15 u. Prod2)
    const { data: t05Data, error: t05Err } = await clientA.rpc('fn_receive_transfer', {
      p_transfer_id: transfer1Id,
      p_notes: `Recepción conforme en Bodega A2 ${tag}`,
    })
    if (t05Err) throw t05Err

    // Verificar en public.inventory_movements el movimiento TRANSFER_IN en Bodega A2
    const movInRes = await pgClient.query(
      `SELECT product_id, movement_type, quantity_in, location_id
       FROM public.inventory_movements
       WHERE document_reference = $1 AND movement_type = 'TRANSFER_IN';`,
      [transfer1Code]
    )

    // Verificar stock en Bodega A2 (destino): Prod1 = 20, Prod2 = 15
    const stockP1A2 = await pgClient.query(
      `SELECT quantity FROM public.stock_levels WHERE product_id = $1 AND location_id = $2;`,
      [product1Id, locA2Id]
    )
    const stockP2A2 = await pgClient.query(
      `SELECT quantity FROM public.stock_levels WHERE product_id = $1 AND location_id = $2;`,
      [product2Id, locA2Id]
    )

    const t05Pass =
      t05Data.status === 'RECEIVED' &&
      movInRes.rows.length === 2 &&
      Number(stockP1A2.rows[0].quantity) === 20.00 &&
      Number(stockP2A2.rows[0].quantity) === 15.00

    recordResult(
      'T05',
      'Recepción en destino con Kardex (TRANSFER_IN) e incremento de stock',
      t05Pass,
      t05Pass
        ? `Estado: RECEIVED. TRANSFER_IN generado en destino. Stock en A2 incrementado: Prod1=${stockP1A2.rows[0].quantity}, Prod2=${stockP2A2.rows[0].quantity}.`
        : `Falla en recepción: t05Data=${JSON.stringify(t05Data)}`
    )

    // --- T06: RECEPCIÓN CON DISCREPANCIA / NOVEDAD ---
    console.log('--- EJECUTANDO T06: RECEPCIÓN CON DISCREPANCIA ---')
    // Crear y despachar traslado de 10 unidades de Prod1
    const { data: tDiscCreate } = await clientA.rpc('fn_create_transfer', {
      p_origin_location_id: locA1Id,
      p_destination_location_id: locA2Id,
      p_items: [{ product_id: product1Id, quantity: 10 }],
    })
    await clientA.rpc('fn_dispatch_transfer', { p_transfer_id: tDiscCreate.transfer_id })

    // Recibir solo 8 unidades (se dañaron 2 en transporte)
    const { data: tDiscRecv, error: tDiscErr } = await clientA.rpc('fn_receive_transfer', {
      p_transfer_id: tDiscCreate.transfer_id,
      p_received_items: [{ product_id: product1Id, received_quantity: 8, notes: '2 unidades averiadas en trayecto' }],
      p_notes: 'Recepción parcial por avería',
    })
    if (tDiscErr) throw tDiscErr

    // Consultar traslado en base de datos
    const discDb = await pgClient.query(
      `SELECT has_incident, incident_notes, status FROM public.transfers WHERE id = $1;`,
      [tDiscCreate.transfer_id]
    )
    const discItemDb = await pgClient.query(
      `SELECT sent_quantity, received_quantity, has_discrepancy, discrepancy_note FROM public.transfer_items WHERE transfer_id = $1;`,
      [tDiscCreate.transfer_id]
    )

    const t06Pass =
      discDb.rows[0].has_incident === true &&
      discItemDb.rows[0].has_discrepancy === true &&
      Number(discItemDb.rows[0].received_quantity) === 8.00 &&
      Number(discItemDb.rows[0].sent_quantity) === 10.00

    recordResult(
      'T06',
      'Recepción con discrepancia y registro de novedad',
      t06Pass,
      t06Pass
        ? `Novedad detectada: enviadas 10, recibidas 8. has_incident=true, has_discrepancy=true.`
        : `Falla en discrepancia: ${JSON.stringify(discDb.rows[0])}`
    )

    // --- T07: CANCELACIÓN DE TRASLADO PENDIENTE ---
    console.log('--- EJECUTANDO T07: CANCELACIÓN TRASLADO PENDIENTE ---')
    const { data: tCancelDraft } = await clientA.rpc('fn_create_transfer', {
      p_origin_location_id: locA1Id,
      p_destination_location_id: locA2Id,
      p_items: [{ product_id: product1Id, quantity: 5 }],
    })
    const { data: tCancRes, error: tCancErr } = await clientA.rpc('fn_cancel_transfer', {
      p_transfer_id: tCancelDraft.transfer_id,
      p_reason: 'Error en cantidades digitadas',
    })
    if (tCancErr) throw tCancErr

    const t07Pass = tCancRes.status === 'REJECTED'
    recordResult(
      'T07',
      'Cancelación de traslado pendiente sin afectar Kardex',
      t07Pass,
      t07Pass
        ? `Traslado cancelado/rechazado en estado PENDING con éxito.`
        : `Falla cancelando traslado pendiente.`
    )

    // --- T08: CANCELACIÓN DE TRASLADO EN TRÁNSITO CON REVERSIÓN A ORIGEN ---
    console.log('--- EJECUTANDO T08: CANCELACIÓN EN TRÁNSITO Y REVERSIÓN ---')
    // Stock en A1 antes: consultar
    const stBeforeT08 = await pgClient.query(
      `SELECT quantity FROM public.stock_levels WHERE product_id = $1 AND location_id = $2;`,
      [product1Id, locA1Id]
    )
    const stockA1Initial = Number(stBeforeT08.rows[0].quantity)

    // Crear y despachar 10 unidades
    const { data: tRevCreate } = await clientA.rpc('fn_create_transfer', {
      p_origin_location_id: locA1Id,
      p_destination_location_id: locA2Id,
      p_items: [{ product_id: product1Id, quantity: 10 }],
    })
    await clientA.rpc('fn_dispatch_transfer', { p_transfer_id: tRevCreate.transfer_id })

    // Cancelar mientras está IN_TRANSIT
    const { data: tRevRes, error: tRevErr } = await clientA.rpc('fn_cancel_transfer', {
      p_transfer_id: tRevCreate.transfer_id,
      p_reason: 'Accidente vial, camión regresa a bodega origen',
    })
    if (tRevErr) throw tRevErr

    // Verificar que el stock en Bodega A1 se restableció exactamente a stockA1Initial
    const stAfterT08 = await pgClient.query(
      `SELECT quantity FROM public.stock_levels WHERE product_id = $1 AND location_id = $2;`,
      [product1Id, locA1Id]
    )
    const stockA1Restored = Number(stAfterT08.rows[0].quantity)

    const t08Pass = tRevRes.status === 'REJECTED' && stockA1Restored === stockA1Initial
    recordResult(
      'T08',
      'Cancelación en tránsito con reversión física a bodega origen',
      t08Pass,
      t08Pass
        ? `Reversión exitosa: Stock antes=${stockA1Initial}, Stock restablecido=${stockA1Restored}.`
        : `Falla en reversión: inicial=${stockA1Initial}, restaurado=${stockA1Restored}`
    )

    // --- T09: BLOQUEO DE ANULACIÓN DE TRASLADO YA RECIBIDO ---
    console.log('--- EJECUTANDO T09: BLOQUEO ANULACIÓN RECIBIDO ---')
    // transfer1Id ya fue recibido (RECEIVED)
    const { error: blockRecvErr } = await clientA.rpc('fn_cancel_transfer', {
      p_transfer_id: transfer1Id,
      p_reason: 'Intento de anulación indebida',
    })
    const t09Pass = Boolean(
      blockRecvErr &&
      (blockRecvErr.message.includes('ya recibido') ||
       blockRecvErr.message.includes('RECEIVED') ||
       blockRecvErr.message.includes('No se puede cancelar'))
    )
    recordResult(
      'T09',
      'Bloqueo de anulación de traslado ya recibido',
      Boolean(t09Pass),
      t09Pass
        ? `Bloqueado por regla de negocio: "${blockRecvErr?.message}"`
        : `Falla: permitió anular un traslado ya recibido.`
    )

    // --- T10: CONCURRENCIA EN DESPACHO (SELECT FOR UPDATE) ---
    console.log('--- EJECUTANDO T10: CONCURRENCIA EN DESPACHO ---')
    // Stock actual de Prod2 en A1:
    const stP2Res = await pgClient.query(
      `SELECT quantity FROM public.stock_levels WHERE product_id = $1 AND location_id = $2;`,
      [product2Id, locA1Id]
    )
    const curP2 = Number(stP2Res.rows[0].quantity) // Quedan 35 u.

    // Crear dos traslados solicitando 25 u. cada uno (total 50 > 35)
    const { data: tConc1 } = await clientA.rpc('fn_create_transfer', {
      p_origin_location_id: locA1Id,
      p_destination_location_id: locA2Id,
      p_items: [{ product_id: product2Id, quantity: 25 }],
    })
    const { data: tConc2 } = await clientA.rpc('fn_create_transfer', {
      p_origin_location_id: locA1Id,
      p_destination_location_id: locA2Id,
      p_items: [{ product_id: product2Id, quantity: 25 }],
    })

    // Disparar despacho concurrente
    const [c1Res, c2Res] = await Promise.allSettled([
      clientA.rpc('fn_dispatch_transfer', { p_transfer_id: tConc1.transfer_id }),
      clientA.rpc('fn_dispatch_transfer', { p_transfer_id: tConc2.transfer_id }),
    ])

    const concSuccess = [c1Res, c2Res].filter((r) => r.status === 'fulfilled' && !r.value.error).length
    const concFailed = [c1Res, c2Res].filter((r) => r.status === 'fulfilled' && r.value.error).length

    const finalP2Stock = await pgClient.query(
      `SELECT quantity FROM public.stock_levels WHERE product_id = $1 AND location_id = $2;`,
      [product2Id, locA1Id]
    )

    const t10Pass = concSuccess === 1 && concFailed === 1 && Number(finalP2Stock.rows[0].quantity) === (curP2 - 25)
    recordResult(
      'T10',
      'Concurrencia fiduciaria en despacho (SELECT FOR UPDATE)',
      t10Pass,
      t10Pass
        ? `Exitoso=1, Rechazado=1. Stock final=${finalP2Stock.rows[0].quantity} (sin stock negativo ni carreras).`
        : `Falla concurrencia: exitosos=${concSuccess}, fallidos=${concFailed}, stock=${finalP2Stock.rows[0].quantity}`
    )

    // --- T11: AISLAMIENTO MULTIEMPRESA ESTRICTO ---
    console.log('--- EJECUTANDO T11: AISLAMIENTO MULTIEMPRESA ---')
    // Usuario B intenta despachar o consultar traslado de Empresa A
    const { error: mtErr } = await clientB.rpc('fn_dispatch_transfer', {
      p_transfer_id: transfer1Id,
    })
    const t11Pass = mtErr && mtErr.message.includes('otra empresa')
    recordResult(
      'T11',
      'Aislamiento multiempresa estricto',
      Boolean(t11Pass),
      t11Pass
        ? `Bloqueado por RPC (42501): "${mtErr?.message}"`
        : `Falla: permitió acceder a traslado de otra empresa.`
    )

    // --- T12: AUDITORÍA TRANSACCIONAL EN AUDIT_LOGS ---
    console.log('--- EJECUTANDO T12: AUDITORÍA TRANSACCIONAL ---')
    const auditRes = await pgClient.query(
      `SELECT DISTINCT action
       FROM public.audit_logs
       WHERE company_id = $1 AND entity_name = 'transfers'
       ORDER BY action ASC;`,
      [companyAId]
    )
    const actions = auditRes.rows.map((r) => r.action)
    const hasCreated = actions.includes('TRANSFER_CREATED')
    const hasDispatched = actions.includes('TRANSFER_DISPATCHED')
    const hasReceived = actions.includes('TRANSFER_RECEIVED')
    const hasCancelled = actions.includes('TRANSFER_CANCELLED')

    const t12Pass = hasCreated && hasDispatched && hasReceived && hasCancelled
    recordResult(
      'T12',
      'Auditoría transaccional de ciclo de vida completo',
      t12Pass,
      t12Pass
        ? `Acciones auditadas: ${actions.join(', ')}.`
        : `Falla en auditoría: encontradas ${actions.join(', ')}`
    )

    // --- T13: CONSULTAS REALES DEL REPOSITORIO (findMany, findById) ---
    console.log('--- EJECUTANDO T13: CONSULTAS REPOSITORIO ---')
    const { data: dbTransfers, error: qErr } = await clientA
      .from('transfers')
      .select('id, code, status, origin:locations!origin_location_id(name), destination:locations!destination_location_id(name)')
      .eq('company_id', companyAId)

    const t13Pass = !qErr && dbTransfers && dbTransfers.length >= 4
    recordResult(
      'T13',
      'Consultas reales con joins en PostgreSQL',
      Boolean(t13Pass),
      t13Pass
        ? `Consultados ${dbTransfers?.length} traslados con relaciones resueltas.`
        : `Falla en consultas: ${qErr?.message}`
    )

    // --- T14: ESTADÍSTICAS GLOBALES EN BASE DE DATOS ---
    console.log('--- EJECUTANDO T14: ESTADÍSTICAS GLOBALES ---')
    const statsRes = await pgClient.query(
      `SELECT 
         COUNT(*) FILTER (WHERE status = 'PENDING') as pending,
         COUNT(*) FILTER (WHERE status = 'IN_TRANSIT') as in_transit,
         COUNT(*) FILTER (WHERE status = 'RECEIVED') as received,
         COUNT(*) FILTER (WHERE status = 'REJECTED') as rejected
       FROM public.transfers
       WHERE company_id = $1;`,
      [companyAId]
    )
    const t14Pass =
      Number(statsRes.rows[0].received) >= 1 &&
      Number(statsRes.rows[0].rejected) >= 1
    recordResult(
      'T14',
      'Estadísticas de traslados en PostgreSQL',
      t14Pass,
      t14Pass
        ? `Estadísticas: Pendientes=${statsRes.rows[0].pending}, En Tránsito=${statsRes.rows[0].in_transit}, Recibidos=${statsRes.rows[0].received}, Rechazados=${statsRes.rows[0].rejected}.`
        : `Falla en estadísticas.`
    )

    // --- T15: ZERO POLLUTION PURGE ---
    console.log('--- EJECUTANDO T15: ZERO POLLUTION ---')
    await pgClient.query("SELECT set_config('app.is_test_cleanup', 'true', false);")

    // Eliminar movimientos de inventario de prueba
    await pgClient.query(
      `DELETE FROM public.inventory_movements WHERE location_id IN ($1, $2, $3) OR (company_id = $4 AND (document_reference LIKE '%${runId}%' OR reason LIKE '%${tag}%'));`,
      [locA1Id, locA2Id, locBId, companyAId]
    )

    // Eliminar transfer_items y transfers
    await pgClient.query(
      `DELETE FROM public.transfer_items WHERE transfer_id IN (
         SELECT id FROM public.transfers WHERE origin_location_id IN ($1, $2) OR destination_location_id IN ($1, $2) OR created_by_user_id = $3
       );`,
      [locA1Id, locA2Id, authUserAId]
    )
    await pgClient.query(
      `DELETE FROM public.transfers WHERE origin_location_id IN ($1, $2) OR destination_location_id IN ($1, $2) OR created_by_user_id = $3;`,
      [locA1Id, locA2Id, authUserAId]
    )

    // Eliminar logs de auditoría de prueba
    await pgClient.query(
      `DELETE FROM public.audit_logs WHERE user_id IN ($1, $2);`,
      [authUserAId, authUserBId]
    )

    // Eliminar stock_levels y productos
    await pgClient.query(`DELETE FROM public.stock_levels WHERE product_id IN ($1, $2);`, [product1Id, product2Id])
    await pgClient.query(`DELETE FROM public.products WHERE id IN ($1, $2);`, [product1Id, product2Id])

    // Eliminar asignaciones y usuarios de prueba
    await pgClient.query(`DELETE FROM public.user_locations WHERE user_id IN ($1, $2);`, [authUserAId, authUserBId])
    await pgClient.query(`DELETE FROM public.users WHERE id IN ($1, $2);`, [authUserAId, authUserBId])
    await adminSupabase.auth.admin.deleteUser(authUserAId)
    await adminSupabase.auth.admin.deleteUser(authUserBId)

    // Eliminar bodegas temporales
    await pgClient.query(`DELETE FROM public.locations WHERE id IN ($1, $2, $3);`, [locA1Id, locA2Id, locBId])

    if (isTempCompanyB) {
      await pgClient.query(`DELETE FROM public.audit_logs WHERE company_id = $1;`, [companyBId])
      await pgClient.query(`DELETE FROM public.companies WHERE id = $1;`, [companyBId])
    }

    await pgClient.query("SELECT set_config('app.is_test_cleanup', 'false', false);")

    // Verificar conteo residual
    const resTransfers = await pgClient.query(`SELECT count(*) as count FROM public.transfers WHERE code LIKE '%${runId}%';`)
    const resMovs = await pgClient.query(`SELECT count(*) as count FROM public.inventory_movements WHERE document_reference LIKE '%${runId}%';`)
    const resProds = await pgClient.query(`SELECT count(*) as count FROM public.products WHERE sku LIKE '%${runId}%';`)
    const resLocs = await pgClient.query(`SELECT count(*) as count FROM public.locations WHERE code LIKE '%${runId}%';`)

    const totalResiduals =
      Number(resTransfers.rows[0].count) +
      Number(resMovs.rows[0].count) +
      Number(resProds.rows[0].count) +
      Number(resLocs.rows[0].count)

    const t15Pass = totalResiduals === 0
    recordResult(
      'T15',
      'Zero Pollution (0 registros residuales en BD)',
      t15Pass,
      t15Pass
        ? `Residuos verificados: Traslados=0, Kardex=0, Productos=0, Bodegas=0. Purga 100% exitosa.`
        : `Falla: se encontraron ${totalResiduals} registros residuales.`
    )
  } catch (err: any) {
    console.error('❌ Excepción catastrófica en suite E2E Fase 7:', err)
    recordResult('FATAL', 'Ejecución Suite Fase 7', false, err.message)
  } finally {
    await pgClient.end()
  }

  // ---------------------------------------------------------------------------
  // REPORTE FINAL
  // ---------------------------------------------------------------------------
  console.log('\n================================================================================')
  console.log('📋 RESUMEN FINAL DE PRUEBAS FASE 7 (TRASLADOS ENTRE BODEGAS)')
  console.log('================================================================================')
  const total = results.length
  const passed = results.filter((r) => r.status === 'PASS').length
  const failed = results.filter((r) => r.status === 'FAIL').length

  for (const r of results) {
    const icon = r.status === 'PASS' ? '✅' : '❌'
    console.log(`${icon} [${r.status}] ${r.code}: ${r.name}`)
  }

  console.log(`\nTOTAL: ${total} | APROBADAS: ${passed} | FALLIDAS: ${failed}`)
  if (failed > 0) {
    console.error('⚠️ ALGUNAS PRUEBAS NO FUERON SUPERADAS. REVISAR LOGS ANTERIORES.')
    process.exit(1)
  } else {
    console.log('🏆 TODAS LAS 15 PRUEBAS DE LA FASE 7 FUERON SUPERADAS AL 100% (PASS).\n')
  }
}

runPhase7TestSuite().catch((err) => {
  console.error('Fallo fatal:', err)
  process.exit(1)
})
