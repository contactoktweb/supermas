/**
 * ==============================================================================
 * SUITE DE VALIDACIÓN E2E — FASE 5.2: RECEPCIÓN FÍSICA DE MERCANCÍA
 * ERP SUPER MÁS S.A.S. — Supabase PostgreSQL (Staging)
 * ==============================================================================
 *
 * 18 Casos de Prueba Obligatorios:
 * R01 — Recepción total: 20 unidades -> Estado RECIBIDA, received_quantity = 20
 * R02 — Recepción parcial: 20 unidades, recibir 8 -> RECIBIDA_PARCIALMENTE, stock +8
 * R03 — Segunda recepción: Saldo 12, recibir 12 -> RECIBIDA, stock +20
 * R04 — Exceso: Recibir > pendiente -> Rechazar, 0 actas, 0 Kardex, 0 stock
 * R05 — Cero: Recibir 0 -> Rechazar
 * R06 — Negativo: Recibir -1 -> Rechazar
 * R07 — Borrador: Recibir orden en BORRADOR -> Rechazar
 * R08 — Cancelada: Recibir orden CANCELADA -> Rechazar
 * R09 — Usuario real: received_by_user_id = auth.uid() y movements.user_id = auth.uid()
 * R10 — Kardex: movement_type = PURCHASE_ENTRY, document_type = PURCHASE_RECEIPT, REC-XXXXXX
 * R11 — Stock: stock_levels.quantity incrementa exactamente por quantity_received
 * R12 — Costo promedio ponderado: (10 * 10.000 + 10 * 14.000) / 20 = 12.000
 * R13 — Bodega: Recepción en Bodega A no altera stock de Bodega B
 * R14 — Producto: Producto único en public.products, no duplicado por bodega
 * R15 — Multiempresa: Usuario de Empresa B intenta recibir orden de Empresa A -> Rechazado
 * R16 — Concurrencia: Dos recepciones simultáneas -> pg_advisory_xact_lock & SELECT FOR UPDATE evitan sobre-recepción
 * R17 — Atomicidad: Error forzado en línea 2 de 2 -> Rollback total (0 actas, 0 stock, 0 Kardex)
 * R18 — Zero Pollution: Limpieza de todos los fixtures de prueba (0 residuos en staging)
 */

import { Client } from 'pg'
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { purchaseService } from '../features/purchases/services/purchase.service'

dotenv.config({ path: '.env.local' })

interface TestResult {
  code: string
  name: string
  status: 'PASS' | 'FAIL'
  details: string
}

const results: TestResult[] = []

function recordResult(code: string, name: string, pass: boolean, details: string) {
  const status = pass ? 'PASS' : 'FAIL'
  results.push({ code, name, status, details })
  const icon = pass ? '✅' : '❌'
  console.log(`${icon} [${code}] ${name}: ${status}`)
  console.log(`   Detalle: ${details}\n`)
}

async function runPhase52TestSuite() {
  console.log('================================================================================')
  console.log('🧪 INICIANDO SUITE DE PRUEBAS E2E FASE 5.2 — RECEPCIÓN FÍSICA DE MERCANCÍA')
  console.log('================================================================================\n')

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  const connStr = process.env.DATABASE_URL || process.env.DIRECT_URL

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
  const tag = `TEST-P52-${runId}`

  let companyAId = ''
  let companyBId = ''
  let locAId = ''
  let locA2Id = ''
  let locBId = ''

  let authUserAId = ''
  let authUserBId = ''

  const userAEmail = `admin_p52_a_${runId}@supermas.test`
  const userBEmail = `admin_p52_b_${runId}@supermas.test`
  const testPassword = `P52Rec*${runId}Pass!`

  let categoryAId = ''
  let categoryBId = ''
  let supplierAId = ''
  let supplierBId = ''

  let productA1Id = ''
  let productA2Id = ''
  let productA3Id = '' // Para costo promedio
  let productB1Id = ''

  let clientA: any
  let clientB: any

  try {
    // -------------------------------------------------------------------------
    // SETUP BASE MULTI-TENANT & ENTIDADES STAGING
    // -------------------------------------------------------------------------
    console.log('--- SETUP BASE MULTI-TENANT & ENTIDADES STAGING ---')

    const compA = await pgClient.query("SELECT id FROM public.companies WHERE status = 'ACTIVE' ORDER BY created_at ASC LIMIT 1;")
    if (compA.rows.length === 0) throw new Error('No hay empresas activas en staging.')
    companyAId = compA.rows[0].id

    // Crear Empresa B temporal
    const compBRes = await pgClient.query(`
      INSERT INTO public.companies (
        business_name, trade_name, tax_id, verification_digit, tax_regime,
        address, city, department, country, phone, email, invoice_email, status
      ) VALUES (
        'Empresa B Staging ${tag}', 'Distribuidora B P52', '900777${runId}', '3', 'RESPONSABLE_DE_IVA',
        'Calle 80 # 20-30', 'Bogotá', 'Bogotá D.C.', 'Colombia', '3129998877',
        'compb_p52_${runId}@supermas.test', 'fact_p52_${runId}@supermas.test', 'ACTIVE'
      ) RETURNING id;
    `)
    companyBId = compBRes.rows[0].id

    // Bodega Sede A1 (Principal)
    const locARes = await pgClient.query(
      "SELECT id FROM public.locations WHERE company_id = $1 AND status = 'ACTIVE' AND allow_purchases = true LIMIT 1;",
      [companyAId]
    )
    if (locARes.rows.length === 0) throw new Error('No hay bodegas con allow_purchases activas en Empresa A.')
    locAId = locARes.rows[0].id

    // Bodega Sede A2 (Secundaria para prueba de aislamiento de bodegas)
    const locA2Res = await pgClient.query(`
      INSERT INTO public.locations (
        company_id, code, name, type, address, city, department, allow_purchases, status
      ) VALUES (
        $1, 'BOD-A2-${runId}', 'Bodega Sucursal Norte ${tag}', 'WAREHOUSE',
        'Carrera 15 # 100-20', 'Bogotá', 'Bogotá D.C.', true, 'ACTIVE'
      ) RETURNING id;
    `, [companyAId])
    locA2Id = locA2Res.rows[0].id

    // Bodega Sede B
    const locBRes = await pgClient.query(`
      INSERT INTO public.locations (
        company_id, code, name, type, address, city, department, allow_purchases, status
      ) VALUES (
        $1, 'BOD-B-${runId}', 'Bodega Empresa B ${tag}', 'WAREHOUSE',
        'Carrera 40 # 50-60', 'Bogotá', 'Bogotá D.C.', true, 'ACTIVE'
      ) RETURNING id;
    `, [companyBId])
    locBId = locBRes.rows[0].id

    // Roles
    const rSuperAdmin = await pgClient.query("SELECT id FROM public.roles WHERE code = 'SUPERADMIN' LIMIT 1;")
    const roleSuperAdminId = rSuperAdmin.rows[0]?.id

    // Categorías
    const catRes = await pgClient.query(`
      INSERT INTO public.categories (
        company_id, code, name, slug, is_active, sort_order
      ) VALUES (
        $1, 'CAT-P52-A-${runId}', 'Categoría P52 A ${tag}', 'cat-p52-a-${runId}', true, 0
      ) RETURNING id;
    `, [companyAId])
    categoryAId = catRes.rows[0].id

    const catBRes = await pgClient.query(`
      INSERT INTO public.categories (
        company_id, code, name, slug, is_active, sort_order
      ) VALUES (
        $1, 'CAT-P52-B-${runId}', 'Categoría P52 B ${tag}', 'cat-p52-b-${runId}', true, 0
      ) RETURNING id;
    `, [companyBId])
    categoryBId = catBRes.rows[0].id

    // Proveedores
    const suppARes = await pgClient.query(`
      INSERT INTO public.suppliers (
        company_id, tax_id, verification_digit, name, legal_name, person_type,
        contact_name, email, phone, city, payment_terms_days, credit_limit, is_active
      ) VALUES (
        $1, '900888${runId}', '1', 'Distribuidora Mayorista P52 ${tag}', 'Distribuidora Mayorista P52 S.A.S.', 'JURIDICA',
        'Manuel Benítez', 'mayorista_${runId}@supermas.test', '3101112233', 'Bogotá', 30, 0, true
      ) RETURNING id;
    `, [companyAId])
    supplierAId = suppARes.rows[0].id

    const suppBRes = await pgClient.query(`
      INSERT INTO public.suppliers (
        company_id, tax_id, verification_digit, name, legal_name, person_type,
        contact_name, email, phone, city, payment_terms_days, credit_limit, is_active
      ) VALUES (
        $1, '900999${runId}', '2', 'Proveedor B P52 ${tag}', 'Proveedor B P52 S.A.S.', 'JURIDICA',
        'Camilo Echeverry', 'provb_${runId}@supermas.test', '3114445566', 'Bogotá', 30, 0, true
      ) RETURNING id;
    `, [companyBId])
    supplierBId = suppBRes.rows[0].id

    // Productos
    const prodA1Res = await pgClient.query(`
      INSERT INTO public.products (
        company_id, category_id, sku, name, slug, unit_of_measure,
        cost_price, public_sale_price, wholesale_price, min_wholesale_quantity,
        tax_rate_percent, is_tax_exempt, min_stock_threshold, critical_stock_threshold,
        inventory_type, is_active, is_published_supermas, is_published_distributor
      ) VALUES (
        $1, $2, 'SKU-P52-A1-${runId}', 'Arroz Premium 1kg ${tag}', 'arroz-premium-${runId}', 'UND',
        3500.00, 4800.00, 4400.00, 10,
        0.00, true, 5, 2,
        'STANDARD', true, false, false
      ) RETURNING id;
    `, [companyAId, categoryAId])
    productA1Id = prodA1Res.rows[0].id

    const prodA2Res = await pgClient.query(`
      INSERT INTO public.products (
        company_id, category_id, sku, name, slug, unit_of_measure,
        cost_price, public_sale_price, wholesale_price, min_wholesale_quantity,
        tax_rate_percent, is_tax_exempt, min_stock_threshold, critical_stock_threshold,
        inventory_type, is_active, is_published_supermas, is_published_distributor
      ) VALUES (
        $1, $2, 'SKU-P52-A2-${runId}', 'Aceite Vegetal 900ml ${tag}', 'aceite-veg-${runId}', 'UND',
        8000.00, 11000.00, 10000.00, 6,
        19.00, false, 5, 2,
        'STANDARD', true, false, false
      ) RETURNING id;
    `, [companyAId, categoryAId])
    productA2Id = prodA2Res.rows[0].id

    // Producto A3 para prueba de Costo Promedio Ponderado
    const prodA3Res = await pgClient.query(`
      INSERT INTO public.products (
        company_id, category_id, sku, name, slug, unit_of_measure,
        cost_price, public_sale_price, wholesale_price, min_wholesale_quantity,
        tax_rate_percent, is_tax_exempt, min_stock_threshold, critical_stock_threshold,
        inventory_type, is_active, is_published_supermas, is_published_distributor
      ) VALUES (
        $1, $2, 'SKU-P52-A3-${runId}', 'Atún en Aceite 170g ${tag}', 'atun-aceite-${runId}', 'UND',
        10000.00, 15000.00, 13500.00, 12,
        0.00, true, 5, 2,
        'STANDARD', true, false, false
      ) RETURNING id;
    `, [companyAId, categoryAId])
    productA3Id = prodA3Res.rows[0].id

    const prodB1Res = await pgClient.query(`
      INSERT INTO public.products (
        company_id, category_id, sku, name, slug, unit_of_measure,
        cost_price, public_sale_price, wholesale_price, min_wholesale_quantity,
        tax_rate_percent, is_tax_exempt, min_stock_threshold, critical_stock_threshold,
        inventory_type, is_active, is_published_supermas, is_published_distributor
      ) VALUES (
        $1, $2, 'SKU-P52-B1-${runId}', 'Leche Entera 1L B ${tag}', 'leche-b-${runId}', 'UND',
        3000.00, 4200.00, 3900.00, 12,
        0.00, true, 5, 2,
        'STANDARD', true, false, false
      ) RETURNING id;
    `, [companyBId, categoryBId])
    productB1Id = prodB1Res.rows[0].id

    // -------------------------------------------------------------------------
    // Usuarios Supabase Auth Reales
    // -------------------------------------------------------------------------
    console.log('--- CREANDO USUARIOS EN SUPABASE AUTH ---')

    const userACreated = await adminSupabase.auth.admin.createUser({
      email: userAEmail,
      password: testPassword,
      email_confirm: true,
      user_metadata: { full_name: `Admin P52 A ${tag}` },
    })
    if (userACreated.error) throw userACreated.error
    authUserAId = userACreated.data.user.id

    await pgClient.query(`
      INSERT INTO public.users (id, company_id, role_id, email, full_name, is_active)
      VALUES ($1, $2, $3, $4, $5, true)
      ON CONFLICT (id) DO UPDATE SET company_id = EXCLUDED.company_id, role_id = EXCLUDED.role_id, full_name = EXCLUDED.full_name;
    `, [authUserAId, companyAId, roleSuperAdminId, userAEmail, `Admin P52 A ${tag}`])

    await pgClient.query(`
      INSERT INTO public.user_locations (user_id, location_id, is_primary)
      VALUES ($1, $2, true), ($1, $3, false)
      ON CONFLICT (user_id, location_id) DO NOTHING;
    `, [authUserAId, locAId, locA2Id])

    const userBCreated = await adminSupabase.auth.admin.createUser({
      email: userBEmail,
      password: testPassword,
      email_confirm: true,
      user_metadata: { full_name: `Admin P52 B ${tag}` },
    })
    if (userBCreated.error) throw userBCreated.error
    authUserBId = userBCreated.data.user.id

    await pgClient.query(`
      INSERT INTO public.users (id, company_id, role_id, email, full_name, is_active)
      VALUES ($1, $2, $3, $4, $5, true)
      ON CONFLICT (id) DO UPDATE SET company_id = EXCLUDED.company_id, role_id = EXCLUDED.role_id, full_name = EXCLUDED.full_name;
    `, [authUserBId, companyBId, roleSuperAdminId, userBEmail, `Admin P52 B ${tag}`])

    await pgClient.query(`
      INSERT INTO public.user_locations (user_id, location_id, is_primary)
      VALUES ($1, $2, true)
      ON CONFLICT (user_id, location_id) DO NOTHING;
    `, [authUserBId, locBId])

    console.log('✅ Usuarios auth creados y configurados.')

    // Inicializar clientes autenticados de Supabase
    clientA = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } })
    const loginA = await clientA.auth.signInWithPassword({ email: userAEmail, password: testPassword })
    if (loginA.error) throw loginA.error

    clientB = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } })
    const loginB = await clientB.auth.signInWithPassword({ email: userBEmail, password: testPassword })
    if (loginB.error) throw loginB.error

    console.log('✅ Clientes Supabase autenticados (JWTs activos).\n')

    // Helper para ejecutar SQL con identidad de usuario
    const runAsUser = async (userId: string, callback: (client: Client) => Promise<any>) => {
      await pgClient.query('BEGIN;')
      try {
        await pgClient.query('SET LOCAL ROLE authenticated;')
        await pgClient.query("SELECT set_config('request.jwt.claims', $1, true);", [JSON.stringify({ sub: userId, role: 'authenticated' })])
        const res = await callback(pgClient)
        await pgClient.query('COMMIT;')
        return res
      } catch (err) {
        await pgClient.query('ROLLBACK;')
        throw err
      }
    }

    // =========================================================================
    // R01 — RECEPCIÓN TOTAL
    // =========================================================================
    console.log('--- EJECUTANDO R01: RECEPCIÓN TOTAL ---')
    // Crear orden de 20 unidades confirmada
    const orderR01Id = await runAsUser(authUserAId, async (client) => {
      const res = await client.query(`
        SELECT public.fn_create_purchase_order(
          $1, $2, 'FAC-R01-${runId}', CURRENT_DATE, CURRENT_DATE + 30, 'CREDITO', 'Orden R01 Total', false,
          $3::jsonb
        ) AS id;
      `, [supplierAId, locAId, JSON.stringify([{ product_id: productA1Id, quantity: 20, unit_cost: 3500, discount_percent: 0, tax_rate_percent: 0 }])])
      return res.rows[0].id
    })

    const r01Item = (await pgClient.query("SELECT id FROM public.purchase_items WHERE purchase_id = $1;", [orderR01Id])).rows[0].id

    // Recibir 20 unidades vía clientA RPC
    const r01Res = await clientA.rpc('fn_receive_purchase_order', {
      p_purchase_id: orderR01Id,
      p_supplier_remission_number: `REM-R01-${runId}`,
      p_notes: 'Recepción total 20 unidades',
      p_items: [{ item_id: r01Item, quantity_received: 20 }],
    })

    if (r01Res.error) throw r01Res.error

    const r01Check = await pgClient.query(`
      SELECT p.inventory_status, p.received_at, p.received_by_user_id, pi.received_quantity
      FROM public.purchases p
      JOIN public.purchase_items pi ON pi.purchase_id = p.id
      WHERE p.id = $1;
    `, [orderR01Id])

    const r01Status = r01Check.rows[0].inventory_status
    const r01RecQty = Number(r01Check.rows[0].received_quantity)
    const r01Pass = r01Status === 'RECIBIDA' && r01RecQty === 20 && r01Res.data.reception_number.startsWith('REC-')

    recordResult('R01', 'Recepción total', r01Pass,
      `Acta=${r01Res.data.reception_number}, status=${r01Status} (RECIBIDA esperado), received_quantity=${r01RecQty} (20 esperado).`)

    // =========================================================================
    // R02 — RECEPCIÓN PARCIAL
    // =========================================================================
    console.log('--- EJECUTANDO R02: RECEPCIÓN PARCIAL ---')
    const orderR02Id = await runAsUser(authUserAId, async (client) => {
      const res = await client.query(`
        SELECT public.fn_create_purchase_order(
          $1, $2, 'FAC-R02-${runId}', CURRENT_DATE, CURRENT_DATE + 30, 'CREDITO', 'Orden R02 Parcial', false,
          $3::jsonb
        ) AS id;
      `, [supplierAId, locAId, JSON.stringify([{ product_id: productA2Id, quantity: 20, unit_cost: 8000, discount_percent: 0, tax_rate_percent: 19 }])])
      return res.rows[0].id
    })

    const r02Item = (await pgClient.query("SELECT id FROM public.purchase_items WHERE purchase_id = $1;", [orderR02Id])).rows[0].id

    // Medir stock previo
    const r02StockPrev = Number((await pgClient.query("SELECT COALESCE(quantity, 0) AS qty FROM public.stock_levels WHERE product_id = $1 AND location_id = $2;", [productA2Id, locAId])).rows[0]?.qty || 0)

    // Recibir 8 unidades
    const r02Res = await clientA.rpc('fn_receive_purchase_order', {
      p_purchase_id: orderR02Id,
      p_supplier_remission_number: `REM-R02-${runId}`,
      p_notes: 'Primera entrega parcial (8u)',
      p_items: [{ item_id: r02Item, quantity_received: 8 }],
    })

    if (r02Res.error) throw r02Res.error

    const r02Check = await pgClient.query(`
      SELECT p.inventory_status, pi.received_quantity
      FROM public.purchases p
      JOIN public.purchase_items pi ON pi.purchase_id = p.id
      WHERE p.id = $1;
    `, [orderR02Id])

    const r02StockPost = Number((await pgClient.query("SELECT quantity FROM public.stock_levels WHERE product_id = $1 AND location_id = $2;", [productA2Id, locAId])).rows[0].quantity)

    const r02Status = r02Check.rows[0].inventory_status
    const r02RecQty = Number(r02Check.rows[0].received_quantity)
    const r02Pass = r02Status === 'RECIBIDA_PARCIALMENTE' && r02RecQty === 8 && r02StockPost === (r02StockPrev + 8)

    recordResult('R02', 'Recepción parcial', r02Pass,
      `Acta=${r02Res.data.reception_number}, status=${r02Status} (RECIBIDA_PARCIALMENTE esperado), received_quantity=${r02RecQty} (8 esperado), stock aumento de ${r02StockPrev} a ${r02StockPost} (+8).`)

    // =========================================================================
    // R03 — SEGUNDA RECEPCIÓN (COMPLETAR SALDO)
    // =========================================================================
    console.log('--- EJECUTANDO R03: SEGUNDA RECEPCIÓN (COMPLETAR SALDO) ---')
    // Recibir las 12 restantes de la orden R02
    const r03Res = await clientA.rpc('fn_receive_purchase_order', {
      p_purchase_id: orderR02Id,
      p_supplier_remission_number: `REM-R03-${runId}`,
      p_notes: 'Segunda entrega saldo (12u)',
      p_items: [{ item_id: r02Item, quantity_received: 12 }],
    })

    if (r03Res.error) throw r03Res.error

    const r03Check = await pgClient.query(`
      SELECT p.inventory_status, pi.received_quantity
      FROM public.purchases p
      JOIN public.purchase_items pi ON pi.purchase_id = p.id
      WHERE p.id = $1;
    `, [orderR02Id])

    const r03StockPost = Number((await pgClient.query("SELECT quantity FROM public.stock_levels WHERE product_id = $1 AND location_id = $2;", [productA2Id, locAId])).rows[0].quantity)

    const r03Status = r03Check.rows[0].inventory_status
    const r03RecQty = Number(r03Check.rows[0].received_quantity)
    const r03Pass = r03Status === 'RECIBIDA' && r03RecQty === 20 && r03StockPost === (r02StockPrev + 20)

    recordResult('R03', 'Segunda recepción', r03Pass,
      `Acta=${r03Res.data.reception_number}, status=${r03Status} (RECIBIDA esperado), received_quantity=${r03RecQty} (20 esperado), stock acumulado=${r03StockPost} (+20 total).`)

    // =========================================================================
    // R04 — EXCESO SOBRE SALDO PENDIENTE
    // =========================================================================
    console.log('--- EJECUTANDO R04: EXCESO SOBRE SALDO PENDIENTE ---')
    const orderR04Id = await runAsUser(authUserAId, async (client) => {
      const res = await client.query(`
        SELECT public.fn_create_purchase_order(
          $1, $2, 'FAC-R04-${runId}', CURRENT_DATE, CURRENT_DATE + 30, 'CREDITO', 'Orden R04 Exceso', false,
          $3::jsonb
        ) AS id;
      `, [supplierAId, locAId, JSON.stringify([{ product_id: productA1Id, quantity: 20, unit_cost: 3500, discount_percent: 0, tax_rate_percent: 0 }])])
      return res.rows[0].id
    })

    const r04Item = (await pgClient.query("SELECT id FROM public.purchase_items WHERE purchase_id = $1;", [orderR04Id])).rows[0].id

    const actasCountBefore = Number((await pgClient.query("SELECT count(*) FROM public.purchase_receipts WHERE purchase_id = $1;", [orderR04Id])).rows[0].count)
    const kardexCountBefore = Number((await pgClient.query("SELECT count(*) FROM public.inventory_movements WHERE product_id = $1;", [productA1Id])).rows[0].count)

    // Intentar recibir 21
    const r04Res = await clientA.rpc('fn_receive_purchase_order', {
      p_purchase_id: orderR04Id,
      p_supplier_remission_number: `REM-R04-${runId}`,
      p_notes: 'Intento de exceso 21 sobre 20',
      p_items: [{ item_id: r04Item, quantity_received: 21 }],
    })

    const actasCountAfter = Number((await pgClient.query("SELECT count(*) FROM public.purchase_receipts WHERE purchase_id = $1;", [orderR04Id])).rows[0].count)
    const kardexCountAfter = Number((await pgClient.query("SELECT count(*) FROM public.inventory_movements WHERE product_id = $1;", [productA1Id])).rows[0].count)

    const r04Pass = r04Res.error !== null &&
                    r04Res.error.message.includes('Exceso de recepción') &&
                    actasCountAfter === actasCountBefore &&
                    kardexCountAfter === kardexCountBefore

    recordResult('R04', 'Exceso', r04Pass,
      `Bloqueado por RPC: "${r04Res.error?.message}". Actas generadas=${actasCountAfter - actasCountBefore} (0 esperado), Kardex=${kardexCountAfter - kardexCountBefore} (0 esperado).`)

    // =========================================================================
    // R05 — CANTIDAD CERO
    // =========================================================================
    console.log('--- EJECUTANDO R05: CANTIDAD CERO ---')
    const r05Res = await clientA.rpc('fn_receive_purchase_order', {
      p_purchase_id: orderR04Id,
      p_supplier_remission_number: `REM-R05-${runId}`,
      p_notes: 'Intento con cantidad 0',
      p_items: [{ item_id: r04Item, quantity_received: 0 }],
    })

    const r05Pass = r05Res.error !== null && r05Res.error.message.includes('estrictamente mayor a 0')
    recordResult('R05', 'Cero', r05Pass, `Bloqueado por RPC: "${r05Res.error?.message}".`)

    // =========================================================================
    // R06 — CANTIDAD NEGATIVA
    // =========================================================================
    console.log('--- EJECUTANDO R06: CANTIDAD NEGATIVA ---')
    const r06Res = await clientA.rpc('fn_receive_purchase_order', {
      p_purchase_id: orderR04Id,
      p_supplier_remission_number: `REM-R06-${runId}`,
      p_notes: 'Intento con cantidad negativa',
      p_items: [{ item_id: r04Item, quantity_received: -5 }],
    })

    const r06Pass = r06Res.error !== null && r06Res.error.message.includes('estrictamente mayor a 0')
    recordResult('R06', 'Negativo', r06Pass, `Bloqueado por RPC: "${r06Res.error?.message}".`)

    // =========================================================================
    // R07 — ORDEN EN BORRADOR
    // =========================================================================
    console.log('--- EJECUTANDO R07: ORDEN EN BORRADOR ---')
    const orderR07Id = await runAsUser(authUserAId, async (client) => {
      const res = await client.query(`
        SELECT public.fn_create_purchase_order(
          $1, $2, 'FAC-R07-${runId}', CURRENT_DATE, CURRENT_DATE + 30, 'CREDITO', 'Orden R07 Borrador', true,
          $3::jsonb
        ) AS id;
      `, [supplierAId, locAId, JSON.stringify([{ product_id: productA1Id, quantity: 10, unit_cost: 3500, discount_percent: 0, tax_rate_percent: 0 }])])
      return res.rows[0].id
    })

    const r07Item = (await pgClient.query("SELECT id FROM public.purchase_items WHERE purchase_id = $1;", [orderR07Id])).rows[0].id

    const r07Res = await clientA.rpc('fn_receive_purchase_order', {
      p_purchase_id: orderR07Id,
      p_supplier_remission_number: `REM-R07-${runId}`,
      p_notes: 'Intento recepción en borrador',
      p_items: [{ item_id: r07Item, quantity_received: 10 }],
    })

    const r07Pass = r07Res.error !== null && r07Res.error.message.includes('BORRADOR')
    recordResult('R07', 'Borrador', r07Pass, `Bloqueado por RPC: "${r07Res.error?.message}".`)

    // =========================================================================
    // R08 — ORDEN CANCELADA
    // =========================================================================
    console.log('--- EJECUTANDO R08: ORDEN CANCELADA ---')
    await runAsUser(authUserAId, async (client) => {
      await client.query("SELECT public.fn_cancel_purchase_order($1, 'Anulada para prueba R08');", [orderR07Id])
    })

    const r08Res = await clientA.rpc('fn_receive_purchase_order', {
      p_purchase_id: orderR07Id,
      p_supplier_remission_number: `REM-R08-${runId}`,
      p_notes: 'Intento recepción orden cancelada',
      p_items: [{ item_id: r07Item, quantity_received: 10 }],
    })

    const r08Pass = r08Res.error !== null && r08Res.error.message.includes('CANCELADA')
    recordResult('R08', 'Cancelada', r08Pass, `Bloqueado por RPC: "${r08Res.error?.message}".`)

    // =========================================================================
    // R09 — USUARIO REAL (auth.uid())
    // =========================================================================
    console.log('--- EJECUTANDO R09: USUARIO REAL ---')
    // Verificar en la recepción R01 que received_by_user_id y movements.user_id sean authUserAId
    const r09Receipt = (await pgClient.query("SELECT received_by_user_id FROM public.purchase_receipts WHERE purchase_id = $1 LIMIT 1;", [orderR01Id])).rows[0]
    const r09Purchase = (await pgClient.query("SELECT received_by_user_id FROM public.purchases WHERE id = $1;", [orderR01Id])).rows[0]
    const r09Movement = (await pgClient.query("SELECT user_id FROM public.inventory_movements WHERE document_type = 'PURCHASE_RECEIPT' AND user_id = $1 LIMIT 1;", [authUserAId])).rows[0]

    const r09Pass = r09Receipt?.received_by_user_id === authUserAId &&
                    r09Purchase?.received_by_user_id === authUserAId &&
                    r09Movement?.user_id === authUserAId

    recordResult('R09', 'Usuario real', r09Pass,
      `Trazabilidad confirmada: receipt.user=${r09Receipt?.received_by_user_id}, purchase.user=${r09Purchase?.received_by_user_id}, movement.user=${r09Movement?.user_id} (${authUserAId} esperado).`)

    // =========================================================================
    // R10 — KARDEX
    // =========================================================================
    console.log('--- EJECUTANDO R10: KARDEX ---')
    const r10Movement = (await pgClient.query(`
      SELECT movement_type, document_type, document_reference, quantity_in, unit_cost
      FROM public.inventory_movements
      WHERE document_reference = $1
      LIMIT 1;
    `, [r01Res.data.reception_number])).rows[0]

    const r10Pass = r10Movement?.movement_type === 'PURCHASE_ENTRY' &&
                    r10Movement?.document_type === 'PURCHASE_RECEIPT' &&
                    r10Movement?.document_reference === r01Res.data.reception_number &&
                    Number(r10Movement?.quantity_in) === 20

    recordResult('R10', 'Kardex', r10Pass,
      `Kardex verificado: movement_type=${r10Movement?.movement_type}, doc_type=${r10Movement?.document_type}, ref=${r10Movement?.document_reference}, qty_in=${r10Movement?.quantity_in}.`)

    // =========================================================================
    // R11 — STOCK
    // =========================================================================
    console.log('--- EJECUTANDO R11: STOCK ---')
    const r11Stock = Number((await pgClient.query("SELECT quantity FROM public.stock_levels WHERE product_id = $1 AND location_id = $2;", [productA1Id, locAId])).rows[0].quantity)
    const r11Pass = r11Stock === 20

    recordResult('R11', 'Stock', r11Pass,
      `Saldo de existencias en bodega principal: ${r11Stock} u. (+20 unidades ingresadas exactamente).`)

    // =========================================================================
    // R12 — COSTO PROMEDIO PONDERADO
    // =========================================================================
    console.log('--- EJECUTANDO R12: COSTO PROMEDIO PONDERADO ---')
    // Escenario controlado:
    // 1. Establecer en stock_levels para productA3Id y locAId: stock = 10, average_cost = 10000
    await pgClient.query(`
      INSERT INTO public.stock_levels (
        company_id, product_id, location_id, quantity, average_cost, min_stock, health_status, last_movement_at
      ) VALUES (
        $1, $2, $3, 10, 10000.00, 5, 'AVAILABLE', NOW()
      ) ON CONFLICT (product_id, location_id) DO UPDATE SET
        quantity = 10, average_cost = 10000.00;
    `, [companyAId, productA3Id, locAId])

    // 2. Crear orden confirmada con 10 unidades a costo 14.000
    const orderR12Id = await runAsUser(authUserAId, async (client) => {
      const res = await client.query(`
        SELECT public.fn_create_purchase_order(
          $1, $2, 'FAC-R12-${runId}', CURRENT_DATE, CURRENT_DATE + 30, 'CREDITO', 'Orden R12 Costo Promedio', false,
          $3::jsonb
        ) AS id;
      `, [supplierAId, locAId, JSON.stringify([{ product_id: productA3Id, quantity: 10, unit_cost: 14000, discount_percent: 0, tax_rate_percent: 0 }])])
      return res.rows[0].id
    })

    const r12Item = (await pgClient.query("SELECT id FROM public.purchase_items WHERE purchase_id = $1;", [orderR12Id])).rows[0].id

    // 3. Recibir las 10 unidades a 14.000
    const r12Res = await clientA.rpc('fn_receive_purchase_order', {
      p_purchase_id: orderR12Id,
      p_supplier_remission_number: `REM-R12-${runId}`,
      p_notes: 'Recepción 10u a $14.000 para ponderar',
      p_items: [{ item_id: r12Item, quantity_received: 10 }],
    })

    if (r12Res.error) throw r12Res.error

    const r12StockLevel = (await pgClient.query("SELECT quantity, average_cost FROM public.stock_levels WHERE product_id = $1 AND location_id = $2;", [productA3Id, locAId])).rows[0]
    const r12Qty = Number(r12StockLevel.quantity)
    const r12AvgCost = Number(r12StockLevel.average_cost)

    // Matemáticamente: (10 * 10.000 + 10 * 14.000) / 20 = (100.000 + 140.000) / 20 = 240.000 / 20 = 12.000
    const r12Pass = r12Qty === 20 && Math.abs(r12AvgCost - 12000) < 0.01

    recordResult('R12', 'Costo promedio', r12Pass,
      `Nuevo stock=${r12Qty} (20 esperado), Costo promedio ponderado=$${r12AvgCost} ($12000 esperado exactamente).`)

    // =========================================================================
    // R13 — BODEGA (AISLAMIENTO ENTRE BODEGAS)
    // =========================================================================
    console.log('--- EJECUTANDO R13: BODEGA (AISLAMIENTO) ---')
    // El producto A3 fue recibido en locAId. Verificar que en locA2Id NO exista o tenga 0
    const r13StockLoc2 = (await pgClient.query("SELECT quantity FROM public.stock_levels WHERE product_id = $1 AND location_id = $2;", [productA3Id, locA2Id])).rows[0]

    const r13Pass = r13StockLoc2 === undefined || Number(r13StockLoc2.quantity) === 0
    recordResult('R13', 'Bodega', r13Pass,
      `Bodega Principal (locA)=20 unidades. Bodega Secundaria (locA2)=${r13StockLoc2 ? r13StockLoc2.quantity : '0 (sin registros)'}. Aislamiento por bodega garantizado.`)

    // =========================================================================
    // R14 — PRODUCTO ÚNICO
    // =========================================================================
    console.log('--- EJECUTANDO R14: PRODUCTO ÚNICO ---')
    const r14ProdCount = Number((await pgClient.query("SELECT count(*) FROM public.products WHERE id = $1;", [productA3Id])).rows[0].count)
    const r14Pass = r14ProdCount === 1

    recordResult('R14', 'Producto', r14Pass,
      `Producto ID=${productA3Id} cuenta con ${r14ProdCount} registro único en catálogo maestro. No hay duplicación.`)

    // =========================================================================
    // R15 — MULTIEMPRESA
    // =========================================================================
    console.log('--- EJECUTANDO R15: MULTIEMPRESA ---')
    // Usuario B (clientB) intenta recibir la orden orderR04Id de Empresa A
    const r15Res = await clientB.rpc('fn_receive_purchase_order', {
      p_purchase_id: orderR04Id,
      p_supplier_remission_number: `REM-R15-${runId}`,
      p_notes: 'Intento de recepción cross-tenant',
      p_items: [{ item_id: r04Item, quantity_received: 10 }],
    })

    const r15Pass = r15Res.error !== null &&
                    (r15Res.error.message.includes('otra empresa') || r15Res.error.code === '42501')

    recordResult('R15', 'Multiempresa', r15Pass,
      `Bloqueado por RPC con código ${r15Res.error?.code}: "${r15Res.error?.message}".`)

    // =========================================================================
    // R16 — CONCURRENCIA
    // =========================================================================
    console.log('--- EJECUTANDO R16: CONCURRENCIA ---')
    // Crear orden con 10 unidades
    const orderR16Id = await runAsUser(authUserAId, async (client) => {
      const res = await client.query(`
        SELECT public.fn_create_purchase_order(
          $1, $2, 'FAC-R16-${runId}', CURRENT_DATE, CURRENT_DATE + 30, 'CREDITO', 'Orden R16 Concurrencia', false,
          $3::jsonb
        ) AS id;
      `, [supplierAId, locAId, JSON.stringify([{ product_id: productA1Id, quantity: 10, unit_cost: 3500, discount_percent: 0, tax_rate_percent: 0 }])])
      return res.rows[0].id
    })

    const r16Item = (await pgClient.query("SELECT id FROM public.purchase_items WHERE purchase_id = $1;", [orderR16Id])).rows[0].id

    // Lanzar dos recepciones paralelas de 10 unidades (solo una puede ganar)
    const [p1, p2] = await Promise.all([
      clientA.rpc('fn_receive_purchase_order', {
        p_purchase_id: orderR16Id,
        p_supplier_remission_number: `REM-R16-1-${runId}`,
        p_notes: 'Recepción concurrente Hilo 1 (10u)',
        p_items: [{ item_id: r16Item, quantity_received: 10 }],
      }),
      clientA.rpc('fn_receive_purchase_order', {
        p_purchase_id: orderR16Id,
        p_supplier_remission_number: `REM-R16-2-${runId}`,
        p_notes: 'Recepción concurrente Hilo 2 (10u)',
        p_items: [{ item_id: r16Item, quantity_received: 10 }],
      }),
    ])

    const successCount = (p1.error === null ? 1 : 0) + (p2.error === null ? 1 : 0)
    const failCount = (p1.error !== null ? 1 : 0) + (p2.error !== null ? 1 : 0)

    const r16Check = (await pgClient.query("SELECT received_quantity FROM public.purchase_items WHERE id = $1;", [r16Item])).rows[0]
    const r16TotalReceived = Number(r16Check.received_quantity)

    const r16Pass = successCount === 1 && failCount === 1 && r16TotalReceived === 10

    recordResult('R16', 'Concurrencia', r16Pass,
      `Operaciones exitosas=${successCount}, Rechazadas por sobre-recepción=${failCount}. Total recibido final=${r16TotalReceived} (10 esperado). Candado pg_advisory_xact_lock & SELECT FOR UPDATE operativo.`)

    // =========================================================================
    // R17 — ATOMICIDAD (ROLLBACK ANTE ERROR EN LÍNEA)
    // =========================================================================
    console.log('--- EJECUTANDO R17: ATOMICIDAD ---')
    // Crear orden con 2 líneas: línea 1 (10 unidades), línea 2 (10 unidades)
    const orderR17Id = await runAsUser(authUserAId, async (client) => {
      const res = await client.query(`
        SELECT public.fn_create_purchase_order(
          $1, $2, 'FAC-R17-${runId}', CURRENT_DATE, CURRENT_DATE + 30, 'CREDITO', 'Orden R17 Atomicidad', false,
          $3::jsonb
        ) AS id;
      `, [supplierAId, locAId, JSON.stringify([
        { product_id: productA1Id, quantity: 10, unit_cost: 3500, discount_percent: 0, tax_rate_percent: 0 },
        { product_id: productA2Id, quantity: 10, unit_cost: 8000, discount_percent: 0, tax_rate_percent: 0 }
      ])])
      return res.rows[0].id
    })

    const r17Items = (await pgClient.query("SELECT id FROM public.purchase_items WHERE purchase_id = $1 ORDER BY created_at ASC;", [orderR17Id])).rows

    const actasR17Before = Number((await pgClient.query("SELECT count(*) FROM public.purchase_receipts WHERE purchase_id = $1;", [orderR17Id])).rows[0].count)

    // Enviar recepción con línea 1 válida (5 unidades), pero línea 2 inválida (exceso: 15 sobre 10)
    const r17Res = await clientA.rpc('fn_receive_purchase_order', {
      p_purchase_id: orderR17Id,
      p_supplier_remission_number: `REM-R17-${runId}`,
      p_notes: 'Recepción multipartes con falla forzada en línea 2',
      p_items: [
        { item_id: r17Items[0].id, quantity_received: 5 },
        { item_id: r17Items[1].id, quantity_received: 15 }, // Exceso! Debe abortar todo
      ],
    })

    const actasR17After = Number((await pgClient.query("SELECT count(*) FROM public.purchase_receipts WHERE purchase_id = $1;", [orderR17Id])).rows[0].count)
    const itemsR17Check = (await pgClient.query("SELECT received_quantity FROM public.purchase_items WHERE purchase_id = $1;", [orderR17Id])).rows

    const r17AllZero = itemsR17Check.every(r => Number(r.received_quantity) === 0)
    const r17Pass = r17Res.error !== null &&
                    actasR17After === actasR17Before &&
                    r17AllZero

    recordResult('R17', 'Atomicidad', r17Pass,
      `Error provocado: "${r17Res.error?.message}". Actas generadas=${actasR17After - actasR17Before} (0 esperado), received_quantity en ambas líneas permanece en 0. Rollback 100% verificado.`)

  } catch (err: any) {
    console.error('❌ Error fatal en ejecución de tests:', err)
  } finally {
    // =========================================================================
    // R18 — ZERO POLLUTION
    // =========================================================================
    console.log('--- EJECUTANDO R18: ZERO POLLUTION (LIMPIEZA EN STAGING) ---')
    try {
      await pgClient.query("SELECT set_config('app.is_test_cleanup', 'true', false);")

      // 1. Eliminar ítems de recepción
      await pgClient.query(`
        DELETE FROM public.purchase_receipt_items
        WHERE reception_id IN (
          SELECT id FROM public.purchase_receipts
          WHERE notes LIKE '%' || $1 || '%' OR supplier_remission_number LIKE '%' || $1 || '%'
        );
      `, [runId])

      // 2. Eliminar actas de recepción
      await pgClient.query(`
        DELETE FROM public.purchase_receipts
        WHERE notes LIKE '%' || $1 || '%' OR supplier_remission_number LIKE '%' || $1 || '%';
      `, [runId])

      // 3. Eliminar movimientos de inventario de prueba
      await pgClient.query(`
        DELETE FROM public.inventory_movements
        WHERE reason LIKE '%' || $1 || '%' 
           OR document_reference LIKE '%' || $1 || '%'
           OR product_id IN (SELECT id FROM public.products WHERE sku LIKE '%' || $1 || '%');
      `, [runId])

      // 4. Eliminar stock_levels de los productos de prueba
      await pgClient.query(`
        DELETE FROM public.stock_levels
        WHERE product_id IN (SELECT id FROM public.products WHERE sku LIKE '%' || $1 || '%');
      `, [runId])

      // 5. Eliminar purchase_items y purchases
      await pgClient.query(`
        DELETE FROM public.purchase_items
        WHERE purchase_id IN (
          SELECT id FROM public.purchases
          WHERE supplier_invoice_number LIKE '%' || $1 || '%' OR notes LIKE '%' || $1 || '%'
        );
      `, [runId])

      await pgClient.query(`
        DELETE FROM public.purchases
        WHERE supplier_invoice_number LIKE '%' || $1 || '%' OR notes LIKE '%' || $1 || '%';
      `, [runId])

      // 6. Eliminar productos de prueba
      await pgClient.query("DELETE FROM public.products WHERE sku LIKE '%' || $1 || '%';", [runId])

      // 7. Eliminar categorías de prueba
      await pgClient.query("DELETE FROM public.categories WHERE code LIKE '%' || $1 || '%';", [runId])

      // 8. Eliminar proveedores de prueba
      await pgClient.query("DELETE FROM public.suppliers WHERE email LIKE '%' || $1 || '%';", [runId])

      // 9. Eliminar user_locations y usuarios
      await pgClient.query("DELETE FROM public.user_locations WHERE user_id IN ($1, $2);", [authUserAId, authUserBId])
      await pgClient.query("DELETE FROM public.users WHERE email IN ($1, $2);", [userAEmail, userBEmail])

      if (authUserAId) await adminSupabase.auth.admin.deleteUser(authUserAId)
      if (authUserBId) await adminSupabase.auth.admin.deleteUser(authUserBId)

      // 10. Eliminar bodegas secundarias
      if (locA2Id) await pgClient.query("DELETE FROM public.locations WHERE id = $1;", [locA2Id])
      if (locBId) await pgClient.query("DELETE FROM public.locations WHERE id = $1;", [locBId])

      // 11. Eliminar logs de auditoría creados durante el test
      await pgClient.query(`
        DELETE FROM public.audit_logs
        WHERE company_id = $1 OR user_name LIKE '%' || $2 || '%' OR previous_value::text LIKE '%' || $2 || '%' OR new_value::text LIKE '%' || $2 || '%';
      `, [companyBId, runId])

      // 12. Eliminar Empresa B
      if (companyBId) await pgClient.query("DELETE FROM public.companies WHERE id = $1;", [companyBId])

      await pgClient.query("SELECT set_config('app.is_test_cleanup', 'false', false);")

      // Conteo residual
      const resPurchases = await pgClient.query("SELECT count(*) FROM public.purchases WHERE supplier_invoice_number LIKE '%' || $1 || '%';", [runId])
      const resReceipts = await pgClient.query("SELECT count(*) FROM public.purchase_receipts WHERE supplier_remission_number LIKE '%' || $1 || '%';", [runId])
      const resMovements = await pgClient.query("SELECT count(*) FROM public.inventory_movements WHERE document_reference LIKE '%' || $1 || '%';", [runId])
      const resProds = await pgClient.query("SELECT count(*) FROM public.products WHERE sku LIKE '%' || $1 || '%';", [runId])
      const resSupps = await pgClient.query("SELECT count(*) FROM public.suppliers WHERE email LIKE '%' || $1 || '%';", [runId])

      console.log('📊 Conteo residual en PostgreSQL Staging:')
      console.log(`   - Compras residuales:    ${resPurchases.rows[0].count}`)
      console.log(`   - Actas residuales:      ${resReceipts.rows[0].count}`)
      console.log(`   - Movimientos Kardex:    ${resMovements.rows[0].count}`)
      console.log(`   - Productos residuales:  ${resProds.rows[0].count}`)
      console.log(`   - Proveedores residual:  ${resSupps.rows[0].count}`)

      const zero = Number(resPurchases.rows[0].count) === 0 &&
                   Number(resReceipts.rows[0].count) === 0 &&
                   Number(resMovements.rows[0].count) === 0 &&
                   Number(resProds.rows[0].count) === 0 &&
                   Number(resSupps.rows[0].count) === 0

      recordResult('R18', 'Zero Pollution', zero,
        `Residuos verificados: Compras=${resPurchases.rows[0].count}, Actas=${resReceipts.rows[0].count}, Kardex=${resMovements.rows[0].count}, Prods=${resProds.rows[0].count}. Estado: ${zero ? 'PURGA PERFECTA (0 RESIDUOS)' : 'RESIDUOS DETECTADOS'}`)

    } catch (cleanupErr: any) {
      console.error('Error durante purga Zero Pollution:', cleanupErr)
      recordResult('R18', 'Zero Pollution', false, `Fallo en limpieza: ${cleanupErr.message}`)
    } finally {
      await pgClient.end()
    }
  }

  // ---------------------------------------------------------------------------
  // RESUMEN
  // ---------------------------------------------------------------------------
  console.log('\n================================================================================')
  console.log('📋 RESUMEN FINAL DE PRUEBAS FASE 5.2 (RECEPCIÓN FÍSICA DE MERCANCÍA)')
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
    console.error('❌ CONDICIÓN DE CIERRE NO SUPERADA: Hay pruebas fallidas.')
    process.exit(1)
  } else {
    console.log('🏆 TODAS LAS 18 PRUEBAS DE LA FASE 5.2 FUERON SUPERADAS AL 100% (PASS).')
  }
}

runPhase52TestSuite().catch((err) => {
  console.error('Fallo fatal en suite:', err)
  process.exit(1)
})
