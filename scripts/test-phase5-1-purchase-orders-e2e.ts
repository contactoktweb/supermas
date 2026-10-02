/**
 * ==============================================================================
 * SUITE DE VALIDACIÓN E2E OBLIGATORIA: FASE 5.1
 * ÓRDENES DE COMPRA REALES Y VALIDACIÓN DE PRECIOS DE PROVEEDOR
 * ERP SUPER MÁS S.A.S. — Supabase PostgreSQL (Staging)
 * ==============================================================================
 *
 * Ejecuta y documenta las 18 Pruebas Requeridas:
 * T01 — Crear compra válida (BORRADOR y CONFIRMADA).
 * T02 — Crear compra sin permiso (CASHIER sin purchases.create bloqueado).
 * T03 — Proveedor de otra empresa (bloqueado cross-tenant).
 * T04 — Bodega de otra empresa (bloqueado cross-tenant).
 * T05 — Producto de otra empresa (bloqueado cross-tenant).
 * T06 — Cantidad <= 0 (bloqueado).
 * T07 — Costo negativo (bloqueado).
 * T08 — Compra sin líneas (bloqueado, 0 compras huérfanas).
 * T09 — Compra con múltiples líneas (3 líneas).
 * T10 — Cálculo correcto de subtotal.
 * T11 — Cálculo correcto de impuestos (19%, 5%, 0%).
 * T12 — Cálculo correcto del total.
 * T13 — Edición de DRAFT (modificación atómica de borrador).
 * T14 — Intento de modificar compra no editable (CONFIRMADA protegida).
 * T15 — Multi-tenant real con JWT (Empresa A vs Empresa B bajo RLS).
 * T16 — Consecutivo único por empresa (COM-000001 independiente).
 * T17 — Usuario real registrado en auditoría (sin 'usr-001').
 * T18 — Zero Pollution (0 registros residuales en base de datos).
 */

import { Client } from 'pg'
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

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

async function runPhase51E2ESuite() {
  console.log('================================================================================')
  console.log('📦 INICIANDO SUITE DE PRUEBAS E2E FASE 5.1 — ÓRDENES DE COMPRA REALES')
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
  const tag = `TEST-P51-${runId}`

  let companyAId = ''
  let companyBId = ''
  let locAId = ''
  let locBId = ''

  let authUserAId = ''
  let authUserCashierId = ''
  let authUserBId = ''

  let userAClient: any = null
  let userBClient: any = null

  const userAEmail = `admin_a_${runId}@supermas.test`
  const userCashierEmail = `cajero_a_${runId}@supermas.test`
  const userBEmail = `admin_b_${runId}@supermas.test`
  const testPassword = `P51!SecurePass*${runId}`

  let categoryAId = ''
  let categoryBId = ''
  let supplierAId = ''
  let supplierBId = ''
  let productA1Id = ''
  let productA2Id = ''
  let productA3Id = ''
  let productB1Id = ''

  let draftPurchaseId = ''
  let confirmedPurchaseId = ''
  let multiLinePurchaseId = ''
  let companyBPurchaseId = ''

  try {
    // -------------------------------------------------------------------------
    // SETUP: Entidades Base, Empresas, Sedes, Roles y Usuarios Staging
    // -------------------------------------------------------------------------
    console.log('--- SETUP BASE MULTI-TENANT & ENTIDADES STAGING ---')

    // Empresa A (Super Más S.A.S.)
    const compA = await pgClient.query("SELECT id FROM public.companies WHERE status = 'ACTIVE' ORDER BY created_at ASC LIMIT 1;")
    if (compA.rows.length === 0) throw new Error('No hay empresas activas en staging.')
    companyAId = compA.rows[0].id

    // Crear Empresa B temporal para pruebas de aislamiento cross-tenant
    const compBRes = await pgClient.query(`
      INSERT INTO public.companies (
        business_name, trade_name, tax_id, verification_digit, tax_regime,
        address, city, department, country, phone, email, invoice_email, status
      ) VALUES (
        'Empresa B Staging ${tag}', 'Distribuidora B', '900777${runId}', '3', 'RESPONSABLE_DE_IVA',
        'Calle 45 # 12-34', 'Bogotá', 'Bogotá D.C.', 'Colombia', '3109998877',
        'compb_${runId}@supermas.test', 'fact_${runId}@supermas.test', 'ACTIVE'
      ) RETURNING id;
    `)
    companyBId = compBRes.rows[0].id
    console.log(`🏢 Empresa A: ${companyAId} | Empresa B: ${companyBId}`)

    // Bodega Sede A (debe tener allow_purchases = true)
    const locARes = await pgClient.query(
      "SELECT id FROM public.locations WHERE company_id = $1 AND status = 'ACTIVE' AND allow_purchases = true LIMIT 1;",
      [companyAId]
    )
    if (locARes.rows.length === 0) throw new Error('No hay bodegas con allow_purchases activas en Empresa A.')
    locAId = locARes.rows[0].id

    // Bodega Sede B (Empresa B)
    const locBRes = await pgClient.query(`
      INSERT INTO public.locations (
        company_id, code, name, type, address, city, department, allow_purchases, status
      ) VALUES (
        $1, 'LOC-B-${runId}', 'Bodega Central Empresa B ${tag}', 'WAREHOUSE',
        'Av El Dorado # 68-50', 'Bogotá', 'Bogotá D.C.', true, 'ACTIVE'
      ) RETURNING id;
    `, [companyBId])
    locBId = locBRes.rows[0].id

    // Roles
    const rSuperAdmin = await pgClient.query("SELECT id FROM public.roles WHERE code = 'SUPERADMIN' LIMIT 1;")
    const rCashier = await pgClient.query("SELECT id FROM public.roles WHERE code = 'CASHIER' LIMIT 1;")
    const roleSuperAdminId = rSuperAdmin.rows[0]?.id
    const roleCashierId = rCashier.rows[0]?.id

    // Categoría temporal para productos de prueba
    const catRes = await pgClient.query(`
      INSERT INTO public.categories (
        company_id, code, name, slug, is_active, sort_order
      ) VALUES (
        $1, 'CAT-P51-${runId}', 'Categoría Pruebas P51 ${tag}', 'cat-p51-${runId}', true, 0
      ) RETURNING id;
    `, [companyAId])
    categoryAId = catRes.rows[0].id

    const catBRes = await pgClient.query(`
      INSERT INTO public.categories (
        company_id, code, name, slug, is_active, sort_order
      ) VALUES (
        $1, 'CAT-P51-B-${runId}', 'Categoría Pruebas P51 B ${tag}', 'cat-p51-b-${runId}', true, 0
      ) RETURNING id;
    `, [companyBId])
    categoryBId = catBRes.rows[0].id

    // Proveedor Empresa A
    const suppARes = await pgClient.query(`
      INSERT INTO public.suppliers (
        company_id, tax_id, verification_digit, name, legal_name, person_type,
        contact_name, email, phone, city, payment_terms_days, credit_limit, is_active
      ) VALUES (
        $1, '900555${runId}', '8', 'Distribuciones Andina S.A.S. ${tag}', 'Distribuciones Andina S.A.S.', 'JURIDICA',
        'Carlos Mario Gómez', 'andina_${runId}@supermas.test', '3001234567', 'Medellín', 30, 0, true
      ) RETURNING id;
    `, [companyAId])
    supplierAId = suppARes.rows[0].id

    // Proveedor Empresa B
    const suppBRes = await pgClient.query(`
      INSERT INTO public.suppliers (
        company_id, tax_id, verification_digit, name, legal_name, person_type,
        contact_name, email, phone, city, payment_terms_days, credit_limit, is_active
      ) VALUES (
        $1, '900666${runId}', '2', 'Importaciones Bogotá S.A.S. ${tag}', 'Importaciones Bogotá S.A.S.', 'JURIDICA',
        'Diana Marcela Pérez', 'bogota_${runId}@supermas.test', '3157654321', 'Bogotá', 30, 0, true
      ) RETURNING id;
    `, [companyBId])
    supplierBId = suppBRes.rows[0].id

    // Productos Empresa A (con diferentes tarifas de IVA: 19%, 5%, 0%)
    const prodA1Res = await pgClient.query(`
      INSERT INTO public.products (
        company_id, category_id, sku, name, slug, unit_of_measure,
        cost_price, public_sale_price, wholesale_price, min_wholesale_quantity,
        tax_rate_percent, is_tax_exempt, min_stock_threshold, critical_stock_threshold,
        inventory_type, is_active, is_published_supermas, is_published_distributor
      ) VALUES (
        $1, $2, 'SKU-A1-${runId}', 'Arroz Premium 1kg ${tag}', 'arroz-premium-${runId}', 'UND',
        15000.00, 18500.00, 17000.00, 12,
        19.00, false, 5, 2,
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
        $1, $2, 'SKU-A2-${runId}', 'Aceite Vegetal 900ml ${tag}', 'aceite-vegetal-${runId}', 'UND',
        20000.00, 24000.00, 22000.00, 12,
        5.00, false, 5, 2,
        'STANDARD', true, false, false
      ) RETURNING id;
    `, [companyAId, categoryAId])
    productA2Id = prodA2Res.rows[0].id

    const prodA3Res = await pgClient.query(`
      INSERT INTO public.products (
        company_id, category_id, sku, name, slug, unit_of_measure,
        cost_price, public_sale_price, wholesale_price, min_wholesale_quantity,
        tax_rate_percent, is_tax_exempt, min_stock_threshold, critical_stock_threshold,
        inventory_type, is_active, is_published_supermas, is_published_distributor
      ) VALUES (
        $1, $2, 'SKU-A3-${runId}', 'Leche Entera 1L ${tag}', 'leche-entera-${runId}', 'UND',
        10000.00, 12500.00, 11500.00, 12,
        0.00, false, 5, 2,
        'STANDARD', true, false, false
      ) RETURNING id;
    `, [companyAId, categoryAId])
    productA3Id = prodA3Res.rows[0].id

    // Producto Empresa B
    const prodB1Res = await pgClient.query(`
      INSERT INTO public.products (
        company_id, category_id, sku, name, slug, unit_of_measure,
        cost_price, public_sale_price, wholesale_price, min_wholesale_quantity,
        tax_rate_percent, is_tax_exempt, min_stock_threshold, critical_stock_threshold,
        inventory_type, is_active, is_published_supermas, is_published_distributor
      ) VALUES (
        $1, $2, 'SKU-B1-${runId}', 'Harina de Trigo 1kg B ${tag}', 'harina-trigo-${runId}', 'UND',
        8000.00, 11000.00, 10000.00, 12,
        19.00, false, 5, 2,
        'STANDARD', true, false, false
      ) RETURNING id;
    `, [companyBId, categoryBId])
    productB1Id = prodB1Res.rows[0].id

    // -------------------------------------------------------------------------
    // Usuarios Supabase Auth Reales
    // -------------------------------------------------------------------------
    console.log('--- CREANDO USUARIOS AUTÉNTICOS EN SUPABASE AUTH ---')

    // 1. Usuario A: Superadmin en Empresa A
    const userACreated = await adminSupabase.auth.admin.createUser({
      email: userAEmail,
      password: testPassword,
      email_confirm: true,
      user_metadata: { full_name: `Admin Compras A ${tag}` },
    })
    if (userACreated.error) throw userACreated.error
    authUserAId = userACreated.data.user.id

    await pgClient.query(`
      INSERT INTO public.users (id, company_id, role_id, email, full_name, is_active)
      VALUES ($1, $2, $3, $4, $5, true)
      ON CONFLICT (id) DO UPDATE SET company_id = EXCLUDED.company_id, role_id = EXCLUDED.role_id, full_name = EXCLUDED.full_name, is_active = true;
    `, [authUserAId, companyAId, roleSuperAdminId, userAEmail, `Admin Compras A ${tag}`])

    await pgClient.query(`
      INSERT INTO public.user_locations (user_id, location_id, is_primary)
      VALUES ($1, $2, true)
      ON CONFLICT (user_id, location_id) DO NOTHING;
    `, [authUserAId, locAId])

    // 2. Usuario Cashier: Cajero en Empresa A (sin permisos de compras)
    const userCashierCreated = await adminSupabase.auth.admin.createUser({
      email: userCashierEmail,
      password: testPassword,
      email_confirm: true,
      user_metadata: { full_name: `Cajero Sin Compras ${tag}` },
    })
    if (userCashierCreated.error) throw userCashierCreated.error
    authUserCashierId = userCashierCreated.data.user.id

    await pgClient.query(`
      INSERT INTO public.users (id, company_id, role_id, email, full_name, is_active)
      VALUES ($1, $2, $3, $4, $5, true)
      ON CONFLICT (id) DO UPDATE SET company_id = EXCLUDED.company_id, role_id = EXCLUDED.role_id, full_name = EXCLUDED.full_name, is_active = true;
    `, [authUserCashierId, companyAId, roleCashierId, userCashierEmail, `Cajero Sin Compras ${tag}`])

    await pgClient.query(`
      INSERT INTO public.user_locations (user_id, location_id, is_primary)
      VALUES ($1, $2, true)
      ON CONFLICT (user_id, location_id) DO NOTHING;
    `, [authUserCashierId, locAId])

    // 3. Usuario B: Superadmin en Empresa B
    const userBCreated = await adminSupabase.auth.admin.createUser({
      email: userBEmail,
      password: testPassword,
      email_confirm: true,
      user_metadata: { full_name: `Admin Compras B ${tag}` },
    })
    if (userBCreated.error) throw userBCreated.error
    authUserBId = userBCreated.data.user.id

    await pgClient.query(`
      INSERT INTO public.users (id, company_id, role_id, email, full_name, is_active)
      VALUES ($1, $2, $3, $4, $5, true)
      ON CONFLICT (id) DO UPDATE SET company_id = EXCLUDED.company_id, role_id = EXCLUDED.role_id, full_name = EXCLUDED.full_name, is_active = true;
    `, [authUserBId, companyBId, roleSuperAdminId, userBEmail, `Admin Compras B ${tag}`])

    await pgClient.query(`
      INSERT INTO public.user_locations (user_id, location_id, is_primary)
      VALUES ($1, $2, true)
      ON CONFLICT (user_id, location_id) DO NOTHING;
    `, [authUserBId, locBId])

    // Iniciar sesión con clientes Supabase para obtener JWT de User A y User B
    userAClient = createClient(supabaseUrl, anonKey, { auth: { autoRefreshToken: false, persistSession: false } })
    const loginA = await userAClient.auth.signInWithPassword({ email: userAEmail, password: testPassword })
    if (loginA.error) throw loginA.error

    userBClient = createClient(supabaseUrl, anonKey, { auth: { autoRefreshToken: false, persistSession: false } })
    const loginB = await userBClient.auth.signInWithPassword({ email: userBEmail, password: testPassword })
    if (loginB.error) throw loginB.error

    console.log('✅ Setup completado exitosamente.\n')

    // Helper para ejecutar consultas bajo contexto autenticado de un usuario específico
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
    // PRUEBAS E2E FASE 5.1
    // =========================================================================

    // -------------------------------------------------------------------------
    // T01 — Crear compra válida (BORRADOR y CONFIRMADA)
    // -------------------------------------------------------------------------
    console.log('--- EJECUTANDO T01: CREAR COMPRA VÁLIDA ---')
    let t01Success = false
    let t01Details = ''

    try {
      // 1. Crear en BORRADOR
      const draftRes = await runAsUser(authUserAId, async (client) => {
        return client.query(`
          SELECT public.fn_create_purchase_order(
            $1, $2, $3, $4, $5, $6, $7, $8, $9
          ) AS purchase_id;
        `, [
          supplierAId,
          locAId,
          `FAC-PROV-DRAFT-${runId}`,
          '2026-10-02',
          '2026-11-01',
          'CREDITO_30',
          'Orden de compra inicial en borrador para validación',
          true, // save_as_draft: true
          JSON.stringify([
            { product_id: productA1Id, quantity: 10, unit_cost: 15000, discount_percent: 0, tax_rate_percent: 19 }
          ])
        ])
      })
      draftPurchaseId = draftRes.rows[0].purchase_id

      // 2. Crear directamente CONFIRMADA
      const confRes = await runAsUser(authUserAId, async (client) => {
        return client.query(`
          SELECT public.fn_create_purchase_order(
            $1, $2, $3, $4, $5, $6, $7, $8, $9
          ) AS purchase_id;
        `, [
          supplierAId,
          locAId,
          `FAC-PROV-CONF-${runId}`,
          '2026-10-02',
          '2026-10-02',
          'CONTADO',
          'Orden de compra confirmada directamente',
          false, // save_as_draft: false -> CONFIRMADA
          JSON.stringify([
            { product_id: productA1Id, quantity: 5, unit_cost: 15000, discount_percent: 0, tax_rate_percent: 19 }
          ])
        ])
      })
      confirmedPurchaseId = confRes.rows[0].purchase_id

      const checkDraft = await pgClient.query("SELECT * FROM public.purchases WHERE id = $1;", [draftPurchaseId])
      const checkConf = await pgClient.query("SELECT * FROM public.purchases WHERE id = $1;", [confirmedPurchaseId])

      const dRow = checkDraft.rows[0]
      const cRow = checkConf.rows[0]

      const draftValid = dRow.inventory_status === 'BORRADOR' &&
                         dRow.payment_status === 'PENDING' &&
                         dRow.purchase_number.startsWith('COM-') &&
                         dRow.confirmed_at === null

      const confValid = cRow.inventory_status === 'CONFIRMADA' &&
                        cRow.payment_status === 'PENDING' &&
                        cRow.purchase_number.startsWith('COM-') &&
                        cRow.confirmed_at !== null &&
                        cRow.confirmed_by_user_id === authUserAId

      t01Success = draftValid && confValid
      t01Details = `Borrador ${dRow.purchase_number} (status=${dRow.inventory_status}, total=$${dRow.total_amount}). Confirmada ${cRow.purchase_number} (status=${cRow.inventory_status}, total=$${cRow.total_amount}, confirmed_by=${cRow.confirmed_by_user_id}).`
    } catch (err: any) {
      t01Details = `Fallo en T01: ${err.message}`
    }
    recordResult('T01', 'Crear compra válida (BORRADOR y CONFIRMADA)', t01Success, t01Details)

    // -------------------------------------------------------------------------
    // T02 — Crear compra sin permiso (CASHIER sin purchases.create)
    // -------------------------------------------------------------------------
    console.log('--- EJECUTANDO T02: CREAR COMPRA SIN PERMISOS ---')
    let t02Success = false
    let t02Details = ''

    try {
      await runAsUser(authUserCashierId, async (client) => {
        return client.query(`
          SELECT public.fn_create_purchase_order(
            $1, $2, $3, $4, $5, $6, $7, $8, $9
          ) AS purchase_id;
        `, [
          supplierAId,
          locAId,
          `FAC-ILLEGAL-${runId}`,
          '2026-10-02',
          '2026-10-02',
          'CONTADO',
          'Intento de compra por cajero sin permiso',
          true,
          JSON.stringify([
            { product_id: productA1Id, quantity: 1, unit_cost: 15000, discount_percent: 0, tax_rate_percent: 19 }
          ])
        ])
      })
      t02Details = 'El cajero sin permiso pudo registrar la compra indebidamente.'
    } catch (err: any) {
      if (err.code === '42501' || err.message.includes('purchases.create')) {
        t02Success = true
        t02Details = `Bloqueado correctamente con ERRCODE=${err.code}: ${err.message}`
      } else {
        t02Details = `Error inesperado: [${err.code}] ${err.message}`
      }
    }
    recordResult('T02', 'Crear compra sin permiso (CASHIER bloqueado)', t02Success, t02Details)

    // -------------------------------------------------------------------------
    // T03 — Proveedor de otra empresa (bloqueado cross-tenant)
    // -------------------------------------------------------------------------
    console.log('--- EJECUTANDO T03: PROVEEDOR DE OTRA EMPRESA ---')
    let t03Success = false
    let t03Details = ''

    try {
      await runAsUser(authUserAId, async (client) => {
        return client.query(`
          SELECT public.fn_create_purchase_order(
            $1, $2, $3, $4, $5, $6, $7, $8, $9
          ) AS purchase_id;
        `, [
          supplierBId, // Proveedor de Empresa B enviado en Empresa A
          locAId,
          `FAC-CROSS-SUPP-${runId}`,
          '2026-10-02',
          '2026-10-02',
          'CONTADO',
          'Intento con proveedor ajeno',
          true,
          JSON.stringify([
            { product_id: productA1Id, quantity: 1, unit_cost: 15000, discount_percent: 0, tax_rate_percent: 19 }
          ])
        ])
      })
      t03Details = 'Se permitió crear compra con proveedor de otra empresa.'
    } catch (err: any) {
      if (err.code === '23503' || err.message.includes('pertenece a otra empresa')) {
        t03Success = true
        t03Details = `Rechazado correctamente: [${err.code}] ${err.message}`
      } else {
        t03Details = `Error inesperado: [${err.code}] ${err.message}`
      }
    }
    recordResult('T03', 'Proveedor de otra empresa (bloqueado cross-tenant)', t03Success, t03Details)

    // -------------------------------------------------------------------------
    // T04 — Bodega de otra empresa (bloqueado cross-tenant)
    // -------------------------------------------------------------------------
    console.log('--- EJECUTANDO T04: BODEGA DE OTRA EMPRESA ---')
    let t04Success = false
    let t04Details = ''

    try {
      await runAsUser(authUserAId, async (client) => {
        return client.query(`
          SELECT public.fn_create_purchase_order(
            $1, $2, $3, $4, $5, $6, $7, $8, $9
          ) AS purchase_id;
        `, [
          supplierAId,
          locBId, // Bodega de Empresa B enviada en Empresa A
          `FAC-CROSS-LOC-${runId}`,
          '2026-10-02',
          '2026-10-02',
          'CONTADO',
          'Intento con bodega ajena',
          true,
          JSON.stringify([
            { product_id: productA1Id, quantity: 1, unit_cost: 15000, discount_percent: 0, tax_rate_percent: 19 }
          ])
        ])
      })
      t04Details = 'Se permitió crear compra con bodega de otra empresa.'
    } catch (err: any) {
      if (err.code === '23503' || err.code === '42501' || err.message.includes('pertenece a otra empresa') || err.message.includes('acceso a la bodega')) {
        t04Success = true
        t04Details = `Rechazado correctamente: [${err.code}] ${err.message}`
      } else {
        t04Details = `Error inesperado: [${err.code}] ${err.message}`
      }
    }
    recordResult('T04', 'Bodega de otra empresa (bloqueado cross-tenant)', t04Success, t04Details)

    // -------------------------------------------------------------------------
    // T05 — Producto de otra empresa (bloqueado cross-tenant)
    // -------------------------------------------------------------------------
    console.log('--- EJECUTANDO T05: PRODUCTO DE OTRA EMPRESA ---')
    let t05Success = false
    let t05Details = ''

    try {
      await runAsUser(authUserAId, async (client) => {
        return client.query(`
          SELECT public.fn_create_purchase_order(
            $1, $2, $3, $4, $5, $6, $7, $8, $9
          ) AS purchase_id;
        `, [
          supplierAId,
          locAId,
          `FAC-CROSS-PROD-${runId}`,
          '2026-10-02',
          '2026-10-02',
          'CONTADO',
          'Intento con producto ajeno',
          true,
          JSON.stringify([
            { product_id: productB1Id, quantity: 1, unit_cost: 15000, discount_percent: 0, tax_rate_percent: 19 } // Producto de Empresa B
          ])
        ])
      })
      t05Details = 'Se permitió crear compra con producto de otra empresa.'
    } catch (err: any) {
      if (err.code === '23503' || err.message.includes('pertenece a otra empresa')) {
        t05Success = true
        t05Details = `Rechazado correctamente: [${err.code}] ${err.message}`
      } else {
        t05Details = `Error inesperado: [${err.code}] ${err.message}`
      }
    }
    recordResult('T05', 'Producto de otra empresa (bloqueado cross-tenant)', t05Success, t05Details)

    // -------------------------------------------------------------------------
    // T06 — Cantidad <= 0 (bloqueado)
    // -------------------------------------------------------------------------
    console.log('--- EJECUTANDO T06: CANTIDAD <= 0 ---')
    let t06Success = false
    let t06Details = ''

    try {
      await runAsUser(authUserAId, async (client) => {
        return client.query(`
          SELECT public.fn_create_purchase_order(
            $1, $2, $3, $4, $5, $6, $7, $8, $9
          ) AS purchase_id;
        `, [
          supplierAId,
          locAId,
          `FAC-ZERO-QTY-${runId}`,
          '2026-10-02',
          '2026-10-02',
          'CONTADO',
          'Intento con cantidad 0',
          true,
          JSON.stringify([
            { product_id: productA1Id, quantity: 0, unit_cost: 15000, discount_percent: 0, tax_rate_percent: 19 }
          ])
        ])
      })
      t06Details = 'Se permitió registrar ítem con cantidad = 0.'
    } catch (err: any) {
      if (err.code === '23514' || err.message.includes('mayor a 0')) {
        t06Success = true
        t06Details = `Rechazado correctamente: [${err.code}] ${err.message}`
      } else {
        t06Details = `Error inesperado: [${err.code}] ${err.message}`
      }
    }
    recordResult('T06', 'Cantidad <= 0 (bloqueado)', t06Success, t06Details)

    // -------------------------------------------------------------------------
    // T07 — Costo negativo (bloqueado)
    // -------------------------------------------------------------------------
    console.log('--- EJECUTANDO T07: COSTO NEGATIVO ---')
    let t07Success = false
    let t07Details = ''

    try {
      await runAsUser(authUserAId, async (client) => {
        return client.query(`
          SELECT public.fn_create_purchase_order(
            $1, $2, $3, $4, $5, $6, $7, $8, $9
          ) AS purchase_id;
        `, [
          supplierAId,
          locAId,
          `FAC-NEG-COST-${runId}`,
          '2026-10-02',
          '2026-10-02',
          'CONTADO',
          'Intento con costo negativo',
          true,
          JSON.stringify([
            { product_id: productA1Id, quantity: 2, unit_cost: -5000, discount_percent: 0, tax_rate_percent: 19 }
          ])
        ])
      })
      t07Details = 'Se permitió registrar ítem con costo negativo.'
    } catch (err: any) {
      if (err.code === '23514' || err.message.includes('negativo')) {
        t07Success = true
        t07Details = `Rechazado correctamente: [${err.code}] ${err.message}`
      } else {
        t07Details = `Error inesperado: [${err.code}] ${err.message}`
      }
    }
    recordResult('T07', 'Costo unitario negativo (bloqueado)', t07Success, t07Details)

    // -------------------------------------------------------------------------
    // T08 — Compra sin líneas (bloqueado)
    // -------------------------------------------------------------------------
    console.log('--- EJECUTANDO T08: COMPRA SIN LÍNEAS ---')
    let t08Success = false
    let t08Details = ''

    try {
      await runAsUser(authUserAId, async (client) => {
        return client.query(`
          SELECT public.fn_create_purchase_order(
            $1, $2, $3, $4, $5, $6, $7, $8, $9
          ) AS purchase_id;
        `, [
          supplierAId,
          locAId,
          `FAC-EMPTY-${runId}`,
          '2026-10-02',
          '2026-10-02',
          'CONTADO',
          'Intento de compra sin ítems',
          true,
          JSON.stringify([]) // Array vacío
        ])
      })
      t08Details = 'Se permitió crear compra vacía sin líneas.'
    } catch (err: any) {
      if (err.code === '23514' || err.message.includes('al menos un producto')) {
        // Verificar que no se creó cabecera huérfana
        const orphanCheck = await pgClient.query(
          "SELECT count(*) FROM public.purchases WHERE supplier_invoice_number = $1;",
          [`FAC-EMPTY-${runId}`]
        )
        const zeroOrphans = Number(orphanCheck.rows[0].count) === 0
        t08Success = zeroOrphans
        t08Details = `Rechazado correctamente: [${err.code}] ${err.message}. Compras huérfanas en BD = 0.`
      } else {
        t08Details = `Error inesperado: [${err.code}] ${err.message}`
      }
    }
    recordResult('T08', 'Compra sin líneas (bloqueado, 0 huérfanas)', t08Success, t08Details)

    // -------------------------------------------------------------------------
    // T09 — Compra con múltiples líneas
    // T10 — Cálculo correcto de subtotal
    // T11 — Cálculo correcto de impuestos (19%, 5%, 0%)
    // T12 — Cálculo correcto del total
    // -------------------------------------------------------------------------
    console.log('--- EJECUTANDO T09, T10, T11, T12: MÚLTIPLES LÍNEAS Y CÁLCULOS MATEMÁTICOS ---')
    let t09Success = false
    let t10Success = false
    let t11Success = false
    let t12Success = false
    let t09Details = ''
    let t10Details = ''
    let t11Details = ''
    let t12Details = ''

    try {
      /**
       * Línea 1: Arroz (productA1)
       *   Cantidad = 10, Costo = 15.000, IVA = 19%
       *   Subtotal 1 = 150.000
       *   IVA 1 = 150.000 * 0.19 = 28.500
       *   Total 1 = 178.500
       *
       * Línea 2: Aceite (productA2)
       *   Cantidad = 5, Costo = 20.000, IVA = 5%
       *   Subtotal 2 = 100.000
       *   IVA 2 = 100.000 * 0.05 = 5.000
       *   Total 2 = 105.000
       *
       * Línea 3: Leche (productA3)
       *   Cantidad = 5, Costo = 10.000, IVA = 0%
       *   Subtotal 3 = 50.000
       *   IVA 3 = 50.000 * 0.00 = 0
       *   Total 3 = 50.000
       *
       * TOTALES ESPERADOS:
       *   Subtotal Total = 150.000 + 100.000 + 50.000 = 300.000
       *   Impuesto Total = 28.500 + 5.000 + 0 = 33.500
       *   Total Orden    = 300.000 + 33.500 = 333.500
       */
      const multiRes = await runAsUser(authUserAId, async (client) => {
        return client.query(`
          SELECT public.fn_create_purchase_order(
            $1, $2, $3, $4, $5, $6, $7, $8, $9
          ) AS purchase_id;
        `, [
          supplierAId,
          locAId,
          `FAC-MULTI-${runId}`,
          '2026-10-02',
          '2026-11-01',
          'CREDITO_30',
          'Orden multi-línea con IVA 19%, 5% y 0%',
          false, // CONFIRMADA
          JSON.stringify([
            { product_id: productA1Id, quantity: 10, unit_cost: 15000, discount_percent: 0, tax_rate_percent: 19 },
            { product_id: productA2Id, quantity: 5, unit_cost: 20000, discount_percent: 0, tax_rate_percent: 5 },
            { product_id: productA3Id, quantity: 5, unit_cost: 10000, discount_percent: 0, tax_rate_percent: 0 }
          ])
        ])
      })
      multiLinePurchaseId = multiRes.rows[0].purchase_id

      const pRow = (await pgClient.query("SELECT * FROM public.purchases WHERE id = $1;", [multiLinePurchaseId])).rows[0]
      const items = (await pgClient.query("SELECT * FROM public.purchase_items WHERE purchase_id = $1 ORDER BY unit_cost DESC;", [multiLinePurchaseId])).rows

      // T09: 3 líneas creadas
      t09Success = items.length === 3
      t09Details = `Orden ${pRow.purchase_number} generada con ${items.length} líneas persistidas en purchase_items.`

      // T10: Subtotal esperado = 300000
      const dbSubtotal = Number(pRow.subtotal_amount)
      t10Success = dbSubtotal === 300000
      t10Details = `Subtotal obtenido: $${dbSubtotal} | Esperado: $300000.`

      // T11: Impuestos esperados = 33500
      const dbTax = Number(pRow.tax_amount)
      t11Success = dbTax === 33500
      t11Details = `Impuestos obtenidos: $${dbTax} (Línea 19%: $28500, Línea 5%: $5000, Línea 0%: $0) | Esperado: $33500.`

      // T12: Total esperado = 333500
      const dbTotal = Number(pRow.total_amount)
      t12Success = dbTotal === 333500
      t12Details = `Total orden obtenido: $${dbTotal} | Esperado: $333500.`
    } catch (err: any) {
      t09Details = `Error en multi-línea: ${err.message}`
      t10Details = `Error: ${err.message}`
      t11Details = `Error: ${err.message}`
      t12Details = `Error: ${err.message}`
    }
    recordResult('T09', 'Compra con múltiples líneas', t09Success, t09Details)
    recordResult('T10', 'Cálculo correcto de subtotal ($300.000)', t10Success, t10Details)
    recordResult('T11', 'Cálculo correcto de impuestos ($33.500)', t11Success, t11Details)
    recordResult('T12', 'Cálculo correcto del total ($333.500)', t12Success, t12Details)

    // -------------------------------------------------------------------------
    // T13 — Edición de DRAFT (modificación atómica de borrador)
    // -------------------------------------------------------------------------
    console.log('--- EJECUTANDO T13: EDICIÓN DE DRAFT ---')
    let t13Success = false
    let t13Details = ''

    try {
      /**
       * Modificamos el borrador creado en T01:
       * Pasamos de 10 unidades de Arroz ($150.000 + IVA = $178.500)
       * A 20 unidades de Arroz ($300.000 + IVA = $357.000)
       * Y actualizamos notas y número de factura proveedor.
       */
      const updateRes = await runAsUser(authUserAId, async (client) => {
        return client.query(`
          SELECT public.fn_update_purchase_order(
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10
          ) AS purchase_id;
        `, [
          draftPurchaseId,
          supplierAId,
          locAId,
          `FAC-PROV-DRAFT-MODIFICADA-${runId}`,
          '2026-10-02',
          '2026-11-15',
          'CREDITO_45',
          'Borrador editado con éxito: cantidad ajustada a 20 unidades',
          true, // sigue en BORRADOR
          JSON.stringify([
            { product_id: productA1Id, quantity: 20, unit_cost: 15000, discount_percent: 0, tax_rate_percent: 19 }
          ])
        ])
      })

      const updatedDraft = (await pgClient.query("SELECT * FROM public.purchases WHERE id = $1;", [draftPurchaseId])).rows[0]
      const updatedItems = (await pgClient.query("SELECT * FROM public.purchase_items WHERE purchase_id = $1;", [draftPurchaseId])).rows

      const subtotalOk = Number(updatedDraft.subtotal_amount) === 300000
      const totalOk = Number(updatedDraft.total_amount) === 357000
      const qtyOk = Number(updatedItems[0].quantity) === 20
      const statusOk = updatedDraft.inventory_status === 'BORRADOR'
      const invoiceOk = updatedDraft.supplier_invoice_number === `FAC-PROV-DRAFT-MODIFICADA-${runId}`

      t13Success = subtotalOk && totalOk && qtyOk && statusOk && invoiceOk
      t13Details = `Borrador editado atómicamente: Cantidad=${qtyOk} (20), Subtotal=$${updatedDraft.subtotal_amount}, Total=$${updatedDraft.total_amount}, Status=${updatedDraft.inventory_status}.`
    } catch (err: any) {
      t13Details = `Error en T13: ${err.message}`
    }
    recordResult('T13', 'Edición de DRAFT (modificación atómica)', t13Success, t13Details)

    // -------------------------------------------------------------------------
    // T14 — Intento de modificar compra no editable (CONFIRMADA protegida)
    // -------------------------------------------------------------------------
    console.log('--- EJECUTANDO T14: INTENTO DE MODIFICAR COMPRA CONFIRMADA ---')
    let t14Success = false
    let t14Details = ''

    try {
      // 1. Intento por RPC
      let rpcBlocked = false
      try {
        await runAsUser(authUserAId, async (client) => {
          return client.query(`
            SELECT public.fn_update_purchase_order(
              $1, $2, $3, $4, $5, $6, $7, $8, $9, $10
            );
          `, [
            confirmedPurchaseId, // Orden en estado CONFIRMADA
            supplierAId,
            locAId,
            'HACKED-INVOICE',
            '2026-10-02',
            '2026-10-02',
            'CONTADO',
            'Intento ilegal de mutar orden confirmada',
            false,
            JSON.stringify([
              { product_id: productA1Id, quantity: 99, unit_cost: 1000, discount_percent: 0, tax_rate_percent: 19 }
            ])
          ])
        })
      } catch (rpcErr: any) {
        if (rpcErr.code === '23514' || rpcErr.message.includes('CONFIRMADA')) {
          rpcBlocked = true
        }
      }

      // 2. Intento directo por SQL UPDATE protegido por trigger
      let triggerBlocked = false
      try {
        await runAsUser(authUserAId, async (client) => {
          return client.query(`
            UPDATE public.purchases
            SET total_amount = 1.00
            WHERE id = $1;
          `, [confirmedPurchaseId])
        })
      } catch (trgErr: any) {
        if (trgErr.code === '23514' || trgErr.message.toLowerCase().includes('confirmada') || trgErr.message.includes('inmutable')) {
          triggerBlocked = true
        }
      }

      // 3. Intento directo por SQL DELETE en purchase_items protegido por trigger
      let deleteItemBlocked = false
      try {
        const delRes = await runAsUser(authUserAId, async (client) => {
          return client.query(`
            DELETE FROM public.purchase_items
            WHERE purchase_id = $1;
          `, [confirmedPurchaseId])
        })
        console.log('T14 DELETE succeeded unexpectedly! rowCount:', delRes.rowCount);
      } catch (itemErr: any) {
        console.log('T14 DELETE caught error:', itemErr.code, itemErr.message);
        if (itemErr.code === '23514' || itemErr.message.toLowerCase().includes('no se pueden eliminar líneas') || itemErr.message.toLowerCase().includes('confirmada')) {
          deleteItemBlocked = true
        }
      }

      t14Success = rpcBlocked && triggerBlocked && deleteItemBlocked
      t14Details = `RPC bloqueado: ${rpcBlocked} | Trigger Header UPDATE bloqueado: ${triggerBlocked} | Trigger Items DELETE bloqueado: ${deleteItemBlocked}.`
    } catch (err: any) {
      t14Details = `Fallo inesperado: ${err.message}`
    }
    recordResult('T14', 'Intento de modificar compra no editable (CONFIRMADA)', t14Success, t14Details)

    // -------------------------------------------------------------------------
    // T15 — Multi-tenant real con JWT (Empresa A vs Empresa B bajo RLS)
    // -------------------------------------------------------------------------
    console.log('--- EJECUTANDO T15: MULTI-TENANT REAL CON JWT ---')
    let t15Success = false
    let t15Details = ''

    try {
      // User B (Empresa B) intenta leer la compra de Empresa A
      const crossTenantRead = await runAsUser(authUserBId, async (client) => {
        return client.query("SELECT * FROM public.purchases WHERE id = $1;", [confirmedPurchaseId])
      })

      // User B intenta insertar directamente una compra asignando company_id de Empresa A
      let crossTenantInsertBlocked = false
      try {
        await runAsUser(authUserBId, async (client) => {
          return client.query(`
            INSERT INTO public.purchases (
              id, company_id, purchase_number, supplier_id, location_id,
              issue_date, due_date, subtotal_amount, tax_amount, total_amount,
              payment_status, inventory_status
            ) VALUES (
              gen_random_uuid(), $1, 'COM-HACK', $2, $3,
              CURRENT_DATE, CURRENT_DATE, 1000, 190, 1190,
              'PENDING', 'BORRADOR'
            );
          `, [companyAId, supplierAId, locAId])
        })
      } catch (crossInsErr: any) {
        if (crossInsErr.code === '42501' || crossInsErr.message.includes('violates row-level security')) {
          crossTenantInsertBlocked = true
        }
      }

      const rowsVisible = crossTenantRead.rows.length
      t15Success = rowsVisible === 0 && crossTenantInsertBlocked
      t15Details = `Filas de Empresa A visibles para Usuario B = ${rowsVisible} (0 esperado). INSERT cross-tenant bloqueado por RLS = ${crossTenantInsertBlocked}.`
    } catch (err: any) {
      t15Details = `Error en T15: ${err.message}`
    }
    recordResult('T15', 'Multi-tenant real con JWT (Empresa A vs B bajo RLS)', t15Success, t15Details)

    // -------------------------------------------------------------------------
    // T16 — Consecutivo único por empresa (COM-000001 independiente)
    // -------------------------------------------------------------------------
    console.log('--- EJECUTANDO T16: CONSECUTIVO ÚNICO POR EMPRESA ---')
    let t16Success = false
    let t16Details = ''

    try {
      // User B crea su primera orden de compra en Empresa B
      const compBOrderRes = await runAsUser(authUserBId, async (client) => {
        return client.query(`
          SELECT public.fn_create_purchase_order(
            $1, $2, $3, $4, $5, $6, $7, $8, $9
          ) AS purchase_id;
        `, [
          supplierBId,
          locBId,
          `FAC-COMP-B-${runId}`,
          '2026-10-02',
          '2026-10-02',
          'CONTADO',
          'Primera orden de compra para Empresa B',
          false, // CONFIRMADA
          JSON.stringify([
            { product_id: productB1Id, quantity: 10, unit_cost: 8000, discount_percent: 0, tax_rate_percent: 19 }
          ])
        ])
      })
      companyBPurchaseId = compBOrderRes.rows[0].purchase_id

      const bOrder = (await pgClient.query("SELECT * FROM public.purchases WHERE id = $1;", [companyBPurchaseId])).rows[0]
      const aOrder = (await pgClient.query("SELECT * FROM public.purchases WHERE id = $1;", [confirmedPurchaseId])).rows[0]

      // Empresa B debe iniciar su propio consecutivo en COM-000001
      const isB000001 = bOrder.purchase_number === 'COM-000001'
      const aHasConsecutive = aOrder.purchase_number.startsWith('COM-')

      t16Success = isB000001 && aHasConsecutive
      t16Details = `Empresa B primer consecutivo: ${bOrder.purchase_number} (COM-000001 esperado). Empresa A consecutivo: ${aOrder.purchase_number}. No hay colisión.`
    } catch (err: any) {
      t16Details = `Error en T16: ${err.message}`
    }
    recordResult('T16', 'Consecutivo único por empresa (COM-000001 independiente)', t16Success, t16Details)

    // -------------------------------------------------------------------------
    // T17 — Usuario real registrado en auditoría (sin 'usr-001')
    // -------------------------------------------------------------------------
    console.log('--- EJECUTANDO T17: USUARIO REAL EN AUDITORÍA ---')
    let t17Success = false
    let t17Details = ''

    try {
      // Confirmamos el borrador formalmente mediante el RPC fn_confirm_purchase_order
      await runAsUser(authUserAId, async (client) => {
        return client.query("SELECT public.fn_confirm_purchase_order($1);", [draftPurchaseId])
      })

      const auditRes = await pgClient.query(`
        SELECT * FROM public.audit_logs
        WHERE entity_id = $1 AND action = 'PURCHASE_CONFIRMED'
        ORDER BY created_at DESC LIMIT 1;
      `, [draftPurchaseId])

      if (auditRes.rows.length === 0) {
        t17Details = 'No se encontró registro de auditoría PURCHASE_CONFIRMED para la orden de compra.'
      } else {
        const auditLog = auditRes.rows[0]
        const userMatches = auditLog.user_id === authUserAId
        const nameMatches = auditLog.user_name.includes(`Admin Compras A ${tag}`)
        const noFallback = auditLog.user_id !== 'usr-001' && auditLog.user_name !== 'usr-001' && auditLog.user_name !== 'Administrador'

        t17Success = userMatches && nameMatches && noFallback
        t17Details = `Audit Log encontrado: user_id=${auditLog.user_id}, user_name="${auditLog.user_name}", action=${auditLog.action}. Sin fallbacks detectados.`
      }
    } catch (err: any) {
      t17Details = `Error en T17: ${err.message}`
    }
    recordResult('T17', 'Usuario real registrado en auditoría (sin usr-001)', t17Success, t17Details)

  } finally {
    // -------------------------------------------------------------------------
    // T18 — Zero Pollution (Purga y Verificación Directa en Staging)
    // -------------------------------------------------------------------------
    console.log('\n--- EJECUTANDO T18: ZERO POLLUTION PURGE & VERIFICACIÓN ---')
    let t18Success = false
    let t18Details = ''

    try {
      // Activar flag seguro de limpieza de pruebas para omitir triggers de inmutabilidad
      await pgClient.query("SELECT set_config('app.is_test_cleanup', 'true', false);")

      // 1. Eliminar líneas de compras de prueba
      await pgClient.query(`
        DELETE FROM public.purchase_items
        WHERE purchase_id IN (
          SELECT id FROM public.purchases 
          WHERE supplier_invoice_number LIKE '%' || $1 || '%' OR company_id = $2
        );
      `, [runId, companyBId])

      // 2. Eliminar compras de prueba
      await pgClient.query(`
        DELETE FROM public.purchases
        WHERE supplier_invoice_number LIKE '%' || $1 || '%' OR company_id = $2;
      `, [runId, companyBId])

      // 3. Eliminar productos de prueba
      await pgClient.query(`
        DELETE FROM public.products
        WHERE sku LIKE '%' || $1 || '%';
      `, [runId])

      // 4. Eliminar categorías de prueba
      await pgClient.query(`
        DELETE FROM public.categories
        WHERE code LIKE '%' || $1 || '%';
      `, [runId])

      // 5. Eliminar proveedores de prueba
      await pgClient.query(`
        DELETE FROM public.suppliers
        WHERE email LIKE '%' || $1 || '%' OR tax_id LIKE '%' || $1 || '%';
      `, [runId])

      // 6. Eliminar ubicaciones temporales
      if (locBId) await pgClient.query("DELETE FROM public.user_locations WHERE location_id = $1;", [locBId])
      if (locBId) await pgClient.query("DELETE FROM public.locations WHERE id = $1;", [locBId])

      // 7. Eliminar asignaciones de sedes de usuarios de prueba
      if (authUserAId) await pgClient.query("DELETE FROM public.user_locations WHERE user_id = $1;", [authUserAId])
      if (authUserCashierId) await pgClient.query("DELETE FROM public.user_locations WHERE user_id = $1;", [authUserCashierId])
      if (authUserBId) await pgClient.query("DELETE FROM public.user_locations WHERE user_id = $1;", [authUserBId])

      // 8. Eliminar usuarios de public.users
      if (authUserAId) await pgClient.query("DELETE FROM public.users WHERE id = $1;", [authUserAId])
      if (authUserCashierId) await pgClient.query("DELETE FROM public.users WHERE id = $1;", [authUserCashierId])
      if (authUserBId) await pgClient.query("DELETE FROM public.users WHERE id = $1;", [authUserBId])

      // 9. Eliminar usuarios de Supabase Auth
      if (authUserAId) await adminSupabase.auth.admin.deleteUser(authUserAId)
      if (authUserCashierId) await adminSupabase.auth.admin.deleteUser(authUserCashierId)
      if (authUserBId) await adminSupabase.auth.admin.deleteUser(authUserBId)

      // 10. Eliminar logs de auditoría creados durante el test
      await pgClient.query(`
        DELETE FROM public.audit_logs
        WHERE company_id = $1 OR user_name LIKE '%' || $2 || '%';
      `, [companyBId, runId])

      // 11. Eliminar Empresa B
      if (companyBId) await pgClient.query("DELETE FROM public.companies WHERE id = $1;", [companyBId])

      // Desactivar flag seguro de limpieza
      await pgClient.query("SELECT set_config('app.is_test_cleanup', 'false', false);")

      // VERIFICACIÓN DIRECTA EN POSTGRESQL
      const resPurchases = await pgClient.query("SELECT count(*) FROM public.purchases WHERE supplier_invoice_number LIKE '%' || $1 || '%';", [runId])
      const resProds = await pgClient.query("SELECT count(*) FROM public.products WHERE sku LIKE '%' || $1 || '%';", [runId])
      const resSupps = await pgClient.query("SELECT count(*) FROM public.suppliers WHERE email LIKE '%' || $1 || '%';", [runId])
      const resUsers = await pgClient.query("SELECT count(*) FROM public.users WHERE email LIKE '%' || $1 || '%';", [runId])
      const resComps = await pgClient.query("SELECT count(*) FROM public.companies WHERE business_name LIKE '%' || $1 || '%';", [runId])

      const zeroResiduals = Number(resPurchases.rows[0].count) === 0 &&
                            Number(resProds.rows[0].count) === 0 &&
                            Number(resSupps.rows[0].count) === 0 &&
                            Number(resUsers.rows[0].count) === 0 &&
                            Number(resComps.rows[0].count) === 0

      console.log('📊 Conteo residual verificado en PostgreSQL Staging:')
      console.log(`   - Compras residuales:   ${resPurchases.rows[0].count}`)
      console.log(`   - Productos residuales: ${resProds.rows[0].count}`)
      console.log(`   - Proveedores residual: ${resSupps.rows[0].count}`)
      console.log(`   - Usuarios residuales:  ${resUsers.rows[0].count}`)
      console.log(`   - Empresas residuales:  ${resComps.rows[0].count}`)

      t18Success = zeroResiduals
      t18Details = `Verificación directa: compras=${resPurchases.rows[0].count}, productos=${resProds.rows[0].count}, proveedores=${resSupps.rows[0].count}, usuarios=${resUsers.rows[0].count}, empresas=${resComps.rows[0].count}. Residuos = 0.`
    } catch (cleanupErr: any) {
      t18Details = `Error durante la purga de Zero Pollution: ${cleanupErr.message}`
      console.error(t18Details)
    } finally {
      await pgClient.end()
    }

    recordResult('T18', 'Zero Pollution (0 registros residuales en BD)', t18Success, t18Details)
  }

  // ---------------------------------------------------------------------------
  // REPORTE DE RESULTADOS
  // ---------------------------------------------------------------------------
  console.log('\n================================================================================')
  console.log('📋 RESUMEN FINAL DE PRUEBAS E2E FASE 5.1')
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
    console.error('❌ CONDICIÓN DE CIERRE NO SUPERADA: Hay pruebas E2E fallidas.')
    process.exit(1)
  } else {
    console.log('🏆 TODAS LAS 18 PRUEBAS E2E DE FASE 5.1 FUERON SUPERADAS AL 100% (PASS).')
  }
}

runPhase51E2ESuite().catch((err) => {
  console.error('Fallo fatal en suite:', err)
  process.exit(1)
})
