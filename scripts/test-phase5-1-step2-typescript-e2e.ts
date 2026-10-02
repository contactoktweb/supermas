/**
 * ==============================================================================
 * SUITE DE VALIDACIÓN TÉCNICA E2E — FASE 5.1 / PASO 2
 * CAPA TYPESCRIPT Y CONEXIÓN REAL CON RPCs POSTGRESQL (037)
 * ERP SUPER MÁS S.A.S. — Supabase PostgreSQL (Staging)
 * ==============================================================================
 *
 * 16 Casos de Prueba Obligatorios del Paso 2:
 * T01 — Crear orden real mediante RPC
 * T02 — Consecutivo COM-XXXXXX generado por PostgreSQL
 * T03 — Crear múltiples órdenes y verificar consecutivos crecientes
 * T04 — Crear orden con proveedor válido
 * T05 — Rechazar proveedor de otra empresa
 * T06 — Rechazar producto de otra empresa
 * T07 — Rechazar quantity <= 0
 * T08 — Rechazar unit_cost < 0
 * T09 — Editar BORRADOR
 * T10 — Rechazar edición de CONFIRMADA
 * T11 — Confirmar BORRADOR
 * T12 — Registrar usuario real mediante auth.uid()
 * T13 — Cancelar BORRADOR
 * T14 — Rechazar cancelación cuando corresponda (mercancía recibida)
 * T15 — Verificar que confirmar compra NO modifica inventario
 * T16 — Verificar aislamiento multiempresa
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

async function runStep2TestSuite() {
  console.log('================================================================================')
  console.log('🧪 INICIANDO SUITE DE PRUEBAS TÉCNICAS FASE 5.1 / PASO 2 — TYPESCRIPT & RPCs')
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
  const tag = `TEST-P51-S2-${runId}`

  let companyAId = ''
  let companyBId = ''
  let locAId = ''
  let locBId = ''

  let authUserAId = ''
  let authUserBId = ''

  const userAEmail = `admin_s2_a_${runId}@supermas.test`
  const userBEmail = `admin_s2_b_${runId}@supermas.test`
  const testPassword = `P51Sec2*${runId}Pass!`

  let categoryAId = ''
  let categoryBId = ''
  let supplierAId = ''
  let supplierBId = ''
  let productA1Id = ''
  let productA2Id = ''
  let productB1Id = ''

  let order1Id = ''
  let order2Id = ''
  let draftToEditId = ''
  let confirmedOrderId = ''
  let cancelOrderId = ''

  try {
    // -------------------------------------------------------------------------
    // SETUP BASE MULTI-TENANT
    // -------------------------------------------------------------------------
    console.log('--- SETUP BASE MULTI-TENANT & ENTIDADES STAGING ---')

    const compA = await pgClient.query("SELECT id FROM public.companies WHERE status = 'ACTIVE' ORDER BY created_at ASC LIMIT 1;")
    if (compA.rows.length === 0) throw new Error('No hay empresas activas en staging.')
    companyAId = compA.rows[0].id

    // Crear Empresa B temporal para pruebas cross-tenant
    const compBRes = await pgClient.query(`
      INSERT INTO public.companies (
        business_name, trade_name, tax_id, verification_digit, tax_regime,
        address, city, department, country, phone, email, invoice_email, status
      ) VALUES (
        'Empresa B Staging ${tag}', 'Distribuidora B', '900666${runId}', '4', 'RESPONSABLE_DE_IVA',
        'Calle 70 # 10-20', 'Bogotá', 'Bogotá D.C.', 'Colombia', '3128889900',
        'compb_${runId}@supermas.test', 'fact_${runId}@supermas.test', 'ACTIVE'
      ) RETURNING id;
    `)
    companyBId = compBRes.rows[0].id

    // Bodega Sede A (allow_purchases = true)
    const locARes = await pgClient.query(
      "SELECT id FROM public.locations WHERE company_id = $1 AND status = 'ACTIVE' AND allow_purchases = true LIMIT 1;",
      [companyAId]
    )
    if (locARes.rows.length === 0) throw new Error('No hay bodegas con allow_purchases activas en Empresa A.')
    locAId = locARes.rows[0].id

    // Bodega Sede B
    const locBRes = await pgClient.query(`
      INSERT INTO public.locations (
        company_id, code, name, type, address, city, department, allow_purchases, status
      ) VALUES (
        $1, 'LOC-B-${runId}', 'Bodega Empresa B ${tag}', 'WAREHOUSE',
        'Carrera 30 # 45-10', 'Bogotá', 'Bogotá D.C.', true, 'ACTIVE'
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
        $1, 'CAT-S2-A-${runId}', 'Categoría A ${tag}', 'cat-s2-a-${runId}', true, 0
      ) RETURNING id;
    `, [companyAId])
    categoryAId = catRes.rows[0].id

    const catBRes = await pgClient.query(`
      INSERT INTO public.categories (
        company_id, code, name, slug, is_active, sort_order
      ) VALUES (
        $1, 'CAT-S2-B-${runId}', 'Categoría B ${tag}', 'cat-s2-b-${runId}', true, 0
      ) RETURNING id;
    `, [companyBId])
    categoryBId = catBRes.rows[0].id

    // Proveedores
    const suppARes = await pgClient.query(`
      INSERT INTO public.suppliers (
        company_id, tax_id, verification_digit, name, legal_name, person_type,
        contact_name, email, phone, city, payment_terms_days, credit_limit, is_active
      ) VALUES (
        $1, '900444${runId}', '9', 'Lácteos Andinos S.A.S. ${tag}', 'Lácteos Andinos S.A.S.', 'JURIDICA',
        'Rodrigo Soto', 'andinos_${runId}@supermas.test', '3007654321', 'Medellín', 30, 0, true
      ) RETURNING id;
    `, [companyAId])
    supplierAId = suppARes.rows[0].id

    const suppBRes = await pgClient.query(`
      INSERT INTO public.suppliers (
        company_id, tax_id, verification_digit, name, legal_name, person_type,
        contact_name, email, phone, city, payment_terms_days, credit_limit, is_active
      ) VALUES (
        $1, '900555${runId}', '5', 'Comercializadora Bogotana S.A.S. ${tag}', 'Comercializadora Bogotana S.A.S.', 'JURIDICA',
        'Sandra López', 'bogotana_${runId}@supermas.test', '3151234567', 'Bogotá', 30, 0, true
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
        $1, $2, 'SKU-S2-A1-${runId}', 'Café Tostado 500g ${tag}', 'cafe-tostado-${runId}', 'UND',
        18000.00, 24000.00, 22000.00, 12,
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
        $1, $2, 'SKU-S2-A2-${runId}', 'Azúcar Refinada 1kg ${tag}', 'azucar-refinada-${runId}', 'UND',
        4000.00, 5500.00, 5000.00, 12,
        5.00, false, 5, 2,
        'STANDARD', true, false, false
      ) RETURNING id;
    `, [companyAId, categoryAId])
    productA2Id = prodA2Res.rows[0].id

    const prodB1Res = await pgClient.query(`
      INSERT INTO public.products (
        company_id, category_id, sku, name, slug, unit_of_measure,
        cost_price, public_sale_price, wholesale_price, min_wholesale_quantity,
        tax_rate_percent, is_tax_exempt, min_stock_threshold, critical_stock_threshold,
        inventory_type, is_active, is_published_supermas, is_published_distributor
      ) VALUES (
        $1, $2, 'SKU-S2-B1-${runId}', 'Sal Marina 1kg B ${tag}', 'sal-marina-${runId}', 'UND',
        2500.00, 3500.00, 3200.00, 12,
        19.00, false, 5, 2,
        'STANDARD', true, false, false
      ) RETURNING id;
    `, [companyBId, categoryBId])
    productB1Id = prodB1Res.rows[0].id

    // -------------------------------------------------------------------------
    // Usuarios Supabase Auth Reales
    // -------------------------------------------------------------------------
    console.log('--- CREANDO USUARIOS EN SUPABASE AUTH ---')

    // Usuario A (Empresa A)
    const userACreated = await adminSupabase.auth.admin.createUser({
      email: userAEmail,
      password: testPassword,
      email_confirm: true,
      user_metadata: { full_name: `Admin Step2 A ${tag}` },
    })
    if (userACreated.error) throw userACreated.error
    authUserAId = userACreated.data.user.id

    await pgClient.query(`
      INSERT INTO public.users (id, company_id, role_id, email, full_name, is_active)
      VALUES ($1, $2, $3, $4, $5, true)
      ON CONFLICT (id) DO UPDATE SET company_id = EXCLUDED.company_id, role_id = EXCLUDED.role_id, full_name = EXCLUDED.full_name;
    `, [authUserAId, companyAId, roleSuperAdminId, userAEmail, `Admin Step2 A ${tag}`])

    await pgClient.query(`
      INSERT INTO public.user_locations (user_id, location_id, is_primary)
      VALUES ($1, $2, true)
      ON CONFLICT (user_id, location_id) DO NOTHING;
    `, [authUserAId, locAId])

    // Usuario B (Empresa B)
    const userBCreated = await adminSupabase.auth.admin.createUser({
      email: userBEmail,
      password: testPassword,
      email_confirm: true,
      user_metadata: { full_name: `Admin Step2 B ${tag}` },
    })
    if (userBCreated.error) throw userBCreated.error
    authUserBId = userBCreated.data.user.id

    await pgClient.query(`
      INSERT INTO public.users (id, company_id, role_id, email, full_name, is_active)
      VALUES ($1, $2, $3, $4, $5, true)
      ON CONFLICT (id) DO UPDATE SET company_id = EXCLUDED.company_id, role_id = EXCLUDED.role_id, full_name = EXCLUDED.full_name;
    `, [authUserBId, companyBId, roleSuperAdminId, userBEmail, `Admin Step2 B ${tag}`])

    await pgClient.query(`
      INSERT INTO public.user_locations (user_id, location_id, is_primary)
      VALUES ($1, $2, true)
      ON CONFLICT (user_id, location_id) DO NOTHING;
    `, [authUserBId, locBId])

    console.log('✅ Setup completado exitosamente.\n')

    // Helper autenticado
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
    // PRUEBAS PASO 2
    // =========================================================================

    // -------------------------------------------------------------------------
    // T01 — Crear orden real mediante RPC (fn_create_purchase_order)
    // -------------------------------------------------------------------------
    console.log('--- EJECUTANDO T01: CREAR ORDEN REAL MEDIANTE RPC ---')
    let t01Success = false
    let t01Details = ''
    try {
      const res = await runAsUser(authUserAId, async (client) => {
        return client.query(`
          SELECT public.fn_create_purchase_order(
            $1, $2, $3, $4, $5, $6, $7, $8, $9
          ) AS purchase_id;
        `, [
          supplierAId,
          locAId,
          `FAC-S2-01-${runId}`,
          '2026-10-02',
          '2026-11-01',
          'CREDITO_30',
          'Orden 1 creada mediante RPC atómica',
          true, // BORRADOR
          JSON.stringify([
            { product_id: productA1Id, quantity: 10, unit_cost: 18000, discount_percent: 0, tax_rate_percent: 19 }
          ])
        ])
      })
      order1Id = res.rows[0].purchase_id
      const row = (await pgClient.query("SELECT * FROM public.purchases WHERE id = $1;", [order1Id])).rows[0]
      const items = (await pgClient.query("SELECT * FROM public.purchase_items WHERE purchase_id = $1;", [order1Id])).rows

      t01Success = row && items.length === 1 && row.inventory_status === 'BORRADOR'
      t01Details = `Orden creada ID=${order1Id}, Consecutivo=${row.purchase_number}, Total=$${row.total_amount}, Líneas=${items.length}.`
    } catch (err: any) {
      t01Details = `Error en T01: ${err.message}`
    }
    recordResult('T01', 'Crear orden real mediante RPC', t01Success, t01Details)

    // -------------------------------------------------------------------------
    // T02 — Consecutivo COM-XXXXXX generado por PostgreSQL
    // -------------------------------------------------------------------------
    console.log('--- EJECUTANDO T02: CONSECUTIVO COM-XXXXXX GENERADO POR POSTGRESQL ---')
    let t02Success = false
    let t02Details = ''
    try {
      const row = (await pgClient.query("SELECT purchase_number FROM public.purchases WHERE id = $1;", [order1Id])).rows[0]
      const matchesPattern = /^COM-[0-9]{6}$/.test(row.purchase_number)
      t02Success = matchesPattern
      t02Details = `Número comercial generado: "${row.purchase_number}". Cumple patrón COM-XXXXXX: ${matchesPattern}.`
    } catch (err: any) {
      t02Details = `Error en T02: ${err.message}`
    }
    recordResult('T02', 'Consecutivo COM-XXXXXX generado por PostgreSQL', t02Success, t02Details)

    // -------------------------------------------------------------------------
    // T03 — Crear múltiples órdenes y verificar consecutivos crecientes
    // -------------------------------------------------------------------------
    console.log('--- EJECUTANDO T03: CREAR MÚLTIPLES ÓRDENES Y VERIFICAR CONSECUTIVOS ---')
    let t03Success = false
    let t03Details = ''
    try {
      const res2 = await runAsUser(authUserAId, async (client) => {
        return client.query(`
          SELECT public.fn_create_purchase_order(
            $1, $2, $3, $4, $5, $6, $7, $8, $9
          ) AS purchase_id;
        `, [
          supplierAId,
          locAId,
          `FAC-S2-02-${runId}`,
          '2026-10-02',
          '2026-10-02',
          'CONTADO',
          'Orden 2 para validación correlativa',
          true,
          JSON.stringify([
            { product_id: productA2Id, quantity: 20, unit_cost: 4000, discount_percent: 0, tax_rate_percent: 5 }
          ])
        ])
      })
      order2Id = res2.rows[0].purchase_id

      const row1 = (await pgClient.query("SELECT purchase_number FROM public.purchases WHERE id = $1;", [order1Id])).rows[0]
      const row2 = (await pgClient.query("SELECT purchase_number FROM public.purchases WHERE id = $1;", [order2Id])).rows[0]

      const n1 = parseInt(row1.purchase_number.replace('COM-', ''), 10)
      const n2 = parseInt(row2.purchase_number.replace('COM-', ''), 10)

      t03Success = n2 === n1 + 1
      t03Details = `Orden 1: ${row1.purchase_number} -> Orden 2: ${row2.purchase_number}. Correlativo estricto confirmado.`
    } catch (err: any) {
      t03Details = `Error en T03: ${err.message}`
    }
    recordResult('T03', 'Crear múltiples órdenes y verificar consecutivos', t03Success, t03Details)

    // -------------------------------------------------------------------------
    // T04 — Crear orden con proveedor válido
    // -------------------------------------------------------------------------
    console.log('--- EJECUTANDO T04: CREAR ORDEN CON PROVEEDOR VÁLIDO ---')
    let t04Success = false
    let t04Details = ''
    try {
      const row = (await pgClient.query(`
        SELECT p.supplier_id, s.name, s.tax_id 
        FROM public.purchases p
        JOIN public.suppliers s ON s.id = p.supplier_id
        WHERE p.id = $1;
      `, [order1Id])).rows[0]

      t04Success = row.supplier_id === supplierAId
      t04Details = `Proveedor vinculado exitosamente: "${row.name}" (NIT: ${row.tax_id}).`
    } catch (err: any) {
      t04Details = `Error en T04: ${err.message}`
    }
    recordResult('T04', 'Crear orden con proveedor válido', t04Success, t04Details)

    // -------------------------------------------------------------------------
    // T05 — Rechazar proveedor de otra empresa
    // -------------------------------------------------------------------------
    console.log('--- EJECUTANDO T05: RECHAZAR PROVEEDOR DE OTRA EMPRESA ---')
    let t05Success = false
    let t05Details = ''
    try {
      await runAsUser(authUserAId, async (client) => {
        return client.query(`
          SELECT public.fn_create_purchase_order(
            $1, $2, $3, $4, $5, $6, $7, $8, $9
          ) AS purchase_id;
        `, [
          supplierBId, // Proveedor ajeno
          locAId,
          `FAC-FAIL-SUPP-${runId}`,
          '2026-10-02',
          '2026-10-02',
          'CONTADO',
          'Cross-tenant supplier attempt',
          true,
          JSON.stringify([
            { product_id: productA1Id, quantity: 1, unit_cost: 18000, discount_percent: 0, tax_rate_percent: 19 }
          ])
        ])
      })
      t05Details = 'Se permitió usar proveedor de otra empresa indebidamente.'
    } catch (err: any) {
      if (err.code === '23503' || err.message.includes('pertenece a otra empresa')) {
        t05Success = true
        t05Details = `Bloqueado por PostgreSQL con código ${err.code}: ${err.message}`
      } else {
        t05Details = `Error inesperado: ${err.message}`
      }
    }
    recordResult('T05', 'Rechazar proveedor de otra empresa', t05Success, t05Details)

    // -------------------------------------------------------------------------
    // T06 — Rechazar producto de otra empresa
    // -------------------------------------------------------------------------
    console.log('--- EJECUTANDO T06: RECHAZAR PRODUCTO DE OTRA EMPRESA ---')
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
          `FAC-FAIL-PROD-${runId}`,
          '2026-10-02',
          '2026-10-02',
          'CONTADO',
          'Cross-tenant product attempt',
          true,
          JSON.stringify([
            { product_id: productB1Id, quantity: 1, unit_cost: 18000, discount_percent: 0, tax_rate_percent: 19 }
          ])
        ])
      })
      t06Details = 'Se permitió usar producto de otra empresa indebidamente.'
    } catch (err: any) {
      if (err.code === '23503' || err.message.includes('pertenece a otra empresa')) {
        t06Success = true
        t06Details = `Bloqueado por PostgreSQL con código ${err.code}: ${err.message}`
      } else {
        t06Details = `Error inesperado: ${err.message}`
      }
    }
    recordResult('T06', 'Rechazar producto de otra empresa', t06Success, t06Details)

    // -------------------------------------------------------------------------
    // T07 — Rechazar quantity <= 0
    // -------------------------------------------------------------------------
    console.log('--- EJECUTANDO T07: RECHAZAR QUANTITY <= 0 ---')
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
          `FAC-FAIL-QTY-${runId}`,
          '2026-10-02',
          '2026-10-02',
          'CONTADO',
          'Zero quantity attempt',
          true,
          JSON.stringify([
            { product_id: productA1Id, quantity: 0, unit_cost: 18000, discount_percent: 0, tax_rate_percent: 19 }
          ])
        ])
      })
      t07Details = 'Se permitió cantidad 0.'
    } catch (err: any) {
      if (err.code === '23514' || err.message.includes('mayor a 0')) {
        t07Success = true
        t07Details = `Rechazado correctamente con código ${err.code}: ${err.message}`
      } else {
        t07Details = `Error inesperado: ${err.message}`
      }
    }
    recordResult('T07', 'Rechazar quantity <= 0', t07Success, t07Details)

    // -------------------------------------------------------------------------
    // T08 — Rechazar unit_cost < 0
    // -------------------------------------------------------------------------
    console.log('--- EJECUTANDO T08: RECHAZAR UNIT_COST < 0 ---')
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
          `FAC-FAIL-COST-${runId}`,
          '2026-10-02',
          '2026-10-02',
          'CONTADO',
          'Negative cost attempt',
          true,
          JSON.stringify([
            { product_id: productA1Id, quantity: 1, unit_cost: -500, discount_percent: 0, tax_rate_percent: 19 }
          ])
        ])
      })
      t08Details = 'Se permitió costo negativo.'
    } catch (err: any) {
      if (err.code === '23514' || err.message.includes('negativo')) {
        t08Success = true
        t08Details = `Rechazado correctamente con código ${err.code}: ${err.message}`
      } else {
        t08Details = `Error inesperado: ${err.message}`
      }
    }
    recordResult('T08', 'Rechazar unit_cost < 0', t08Success, t08Details)

    // -------------------------------------------------------------------------
    // T09 — Editar BORRADOR
    // -------------------------------------------------------------------------
    console.log('--- EJECUTANDO T09: EDITAR BORRADOR ---')
    let t09Success = false
    let t09Details = ''
    try {
      // Creamos borrador específico para editar
      const draftRes = await runAsUser(authUserAId, async (client) => {
        return client.query(`
          SELECT public.fn_create_purchase_order(
            $1, $2, $3, $4, $5, $6, $7, $8, $9
          ) AS purchase_id;
        `, [
          supplierAId,
          locAId,
          `FAC-EDIT-INIT-${runId}`,
          '2026-10-02',
          '2026-10-02',
          'CONTADO',
          'Borrador inicial',
          true,
          JSON.stringify([
            { product_id: productA1Id, quantity: 5, unit_cost: 18000, discount_percent: 0, tax_rate_percent: 19 }
          ])
        ])
      })
      draftToEditId = draftRes.rows[0].purchase_id

      // Actualizamos mediante fn_update_purchase_order: aumentamos a 15 unidades
      await runAsUser(authUserAId, async (client) => {
        return client.query(`
          SELECT public.fn_update_purchase_order(
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10
          ) AS purchase_id;
        `, [
          draftToEditId,
          supplierAId,
          locAId,
          `FAC-EDIT-UPD-${runId}`,
          '2026-10-02',
          '2026-11-15',
          'CREDITO_45',
          'Borrador editado con éxito',
          true, // sigue en borrador
          JSON.stringify([
            { product_id: productA1Id, quantity: 15, unit_cost: 18000, discount_percent: 0, tax_rate_percent: 19 }
          ])
        ])
      })

      const updatedRow = (await pgClient.query("SELECT * FROM public.purchases WHERE id = $1;", [draftToEditId])).rows[0]
      const updatedItems = (await pgClient.query("SELECT * FROM public.purchase_items WHERE purchase_id = $1;", [draftToEditId])).rows

      const qty = Number(updatedItems[0].quantity)
      const subtotal = Number(updatedRow.subtotal_amount)
      const status = updatedRow.inventory_status

      t09Success = qty === 15 && subtotal === 270000 && status === 'BORRADOR'
      t09Details = `Borrador actualizado: cantidad=${qty}, subtotal=$${subtotal}, status=${status}.`
    } catch (err: any) {
      t09Details = `Error en T09: ${err.message}`
    }
    recordResult('T09', 'Editar BORRADOR', t09Success, t09Details)

    // -------------------------------------------------------------------------
    // T10 — Rechazar edición de CONFIRMADA
    // -------------------------------------------------------------------------
    console.log('--- EJECUTANDO T10: RECHAZAR EDICIÓN DE CONFIRMADA ---')
    let t10Success = false
    let t10Details = ''
    try {
      // Creamos orden directamente confirmada
      const confRes = await runAsUser(authUserAId, async (client) => {
        return client.query(`
          SELECT public.fn_create_purchase_order(
            $1, $2, $3, $4, $5, $6, $7, $8, $9
          ) AS purchase_id;
        `, [
          supplierAId,
          locAId,
          `FAC-CONF-IMM-${runId}`,
          '2026-10-02',
          '2026-10-02',
          'CONTADO',
          'Orden confirmada directamente',
          false, // CONFIRMADA
          JSON.stringify([
            { product_id: productA1Id, quantity: 10, unit_cost: 18000, discount_percent: 0, tax_rate_percent: 19 }
          ])
        ])
      })
      confirmedOrderId = confRes.rows[0].purchase_id

      // Intentar editar mediante fn_update_purchase_order
      await runAsUser(authUserAId, async (client) => {
        return client.query(`
          SELECT public.fn_update_purchase_order(
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10
          );
        `, [
          confirmedOrderId,
          supplierAId,
          locAId,
          'FAC-HACK',
          '2026-10-02',
          '2026-10-02',
          'CONTADO',
          'Intento de mutación de orden confirmada',
          false,
          JSON.stringify([
            { product_id: productA1Id, quantity: 1, unit_cost: 100, discount_percent: 0, tax_rate_percent: 19 }
          ])
        ])
      })
      t10Details = 'Se permitió editar orden confirmada.'
    } catch (err: any) {
      if (err.code === '23514' || err.message.includes('Solo las órdenes de compra en borrador pueden ser modificadas')) {
        t10Success = true
        t10Details = `Bloqueado por RPC con código ${err.code}: ${err.message}`
      } else {
        t10Details = `Error inesperado: ${err.message}`
      }
    }
    recordResult('T10', 'Rechazar edición de CONFIRMADA', t10Success, t10Details)

    // -------------------------------------------------------------------------
    // T11 — Confirmar BORRADOR (fn_confirm_purchase_order)
    // -------------------------------------------------------------------------
    console.log('--- EJECUTANDO T11: CONFIRMAR BORRADOR ---')
    let t11Success = false
    let t11Details = ''
    try {
      await runAsUser(authUserAId, async (client) => {
        return client.query("SELECT public.fn_confirm_purchase_order($1);", [draftToEditId])
      })

      const row = (await pgClient.query("SELECT * FROM public.purchases WHERE id = $1;", [draftToEditId])).rows[0]

      t11Success = row.inventory_status === 'CONFIRMADA' && row.confirmed_at !== null
      t11Details = `Orden ${row.purchase_number} transicionó a CONFIRMADA en ${row.confirmed_at}.`
    } catch (err: any) {
      t11Details = `Error en T11: ${err.message}`
    }
    recordResult('T11', 'Confirmar BORRADOR', t11Success, t11Details)

    // -------------------------------------------------------------------------
    // T12 — Registrar usuario real mediante auth.uid()
    // -------------------------------------------------------------------------
    console.log('--- EJECUTANDO T12: REGISTRAR USUARIO REAL MEDIANTE auth.uid() ---')
    let t12Success = false
    let t12Details = ''
    try {
      const pRow = (await pgClient.query("SELECT confirmed_by_user_id FROM public.purchases WHERE id = $1;", [draftToEditId])).rows[0]
      const auditLog = (await pgClient.query(`
        SELECT user_id, user_name, action
        FROM public.audit_logs
        WHERE entity_id = $1 AND action = 'PURCHASE_CONFIRMED'
        ORDER BY created_at DESC LIMIT 1;
      `, [draftToEditId])).rows[0]

      const purchaseUserMatch = pRow.confirmed_by_user_id === authUserAId
      const auditUserMatch = auditLog && auditLog.user_id === authUserAId
      const noFallback = auditLog && auditLog.user_name.includes(`Admin Step2 A ${tag}`) && auditLog.user_name !== 'Administrador' && auditLog.user_name !== 'usr-001'

      t12Success = purchaseUserMatch && auditUserMatch && Boolean(noFallback)
      t12Details = `Trazabilidad confirmada: confirmed_by_user_id=${pRow.confirmed_by_user_id}, audit.user_id=${auditLog?.user_id}, user_name="${auditLog?.user_name}".`
    } catch (err: any) {
      t12Details = `Error en T12: ${err.message}`
    }
    recordResult('T12', 'Registrar usuario real mediante auth.uid()', t12Success, t12Details)

    // -------------------------------------------------------------------------
    // T13 — Cancelar BORRADOR (fn_cancel_purchase_order)
    // -------------------------------------------------------------------------
    console.log('--- EJECUTANDO T13: CANCELAR BORRADOR ---')
    let t13Success = false
    let t13Details = ''
    try {
      // Creamos orden para anular
      const cRes = await runAsUser(authUserAId, async (client) => {
        return client.query(`
          SELECT public.fn_create_purchase_order(
            $1, $2, $3, $4, $5, $6, $7, $8, $9
          ) AS purchase_id;
        `, [
          supplierAId,
          locAId,
          `FAC-CANCEL-${runId}`,
          '2026-10-02',
          '2026-10-02',
          'CONTADO',
          'Orden para anular',
          true,
          JSON.stringify([
            { product_id: productA1Id, quantity: 2, unit_cost: 18000, discount_percent: 0, tax_rate_percent: 19 }
          ])
        ])
      })
      cancelOrderId = cRes.rows[0].purchase_id

      await runAsUser(authUserAId, async (client) => {
        return client.query("SELECT public.fn_cancel_purchase_order($1, $2);", [
          cancelOrderId,
          'Cancelación solicitada por proveedor por falta de stock'
        ])
      })

      const row = (await pgClient.query("SELECT * FROM public.purchases WHERE id = $1;", [cancelOrderId])).rows[0]

      t13Success = row.inventory_status === 'CANCELADA' && row.payment_status === 'CANCELLED' && row.notes.includes('[ANULADA:')
      t13Details = `Orden ${row.purchase_number} anulada exitosamente: status=${row.inventory_status}, payment=${row.payment_status}.`
    } catch (err: any) {
      t13Details = `Error en T13: ${err.message}`
    }
    recordResult('T13', 'Cancelar BORRADOR', t13Success, t13Details)

    // -------------------------------------------------------------------------
    // T14 — Rechazar cancelación cuando corresponda (mercancía ya recibida)
    // -------------------------------------------------------------------------
    console.log('--- EJECUTANDO T14: RECHAZAR CANCELACIÓN CON MERCANCÍA RECIBIDA ---')
    let t14Success = false
    let t14Details = ''
    try {
      // Simulamos temporalmente que confirmedOrderId tiene cantidad recibida > 0
      await pgClient.query("SELECT set_config('app.is_test_cleanup', 'true', false);")
      await pgClient.query("UPDATE public.purchase_items SET received_quantity = 5 WHERE purchase_id = $1;", [confirmedOrderId])
      await pgClient.query("SELECT set_config('app.is_test_cleanup', 'false', false);")

      await runAsUser(authUserAId, async (client) => {
        return client.query("SELECT public.fn_cancel_purchase_order($1, $2);", [
          confirmedOrderId,
          'Intento de cancelación con recepción'
        ])
      })
      t14Details = 'Se permitió anular orden con mercancía recibida.'
    } catch (err: any) {
      if (err.code === '23514' || err.message.includes('tiene ítems con cantidades recibidas')) {
        t14Success = true
        t14Details = `Bloqueado por RPC con código ${err.code}: ${err.message}`
      } else {
        t14Details = `Error inesperado: ${err.message}`
      }
    }
    recordResult('T14', 'Rechazar cancelación con mercancía recibida', t14Success, t14Details)

    // -------------------------------------------------------------------------
    // T15 — Verificar que confirmar compra NO modifica inventario
    // -------------------------------------------------------------------------
    console.log('--- EJECUTANDO T15: CONFIRMAR COMPRA NO MODIFICA INVENTARIO ---')
    let t15Success = false
    let t15Details = ''
    try {
      const movsCount = await pgClient.query(
        "SELECT count(*) FROM public.inventory_movements WHERE company_id = $1 AND (document_reference = $2 OR document_reference = $3 OR product_id = $4);",
        [companyAId, draftToEditId, confirmedOrderId, productA1Id]
      )

      const zeroMovements = Number(movsCount.rows[0].count) === 0
      t15Success = zeroMovements
      t15Details = `Movimientos de inventario generados por confirmar orden = ${movsCount.rows[0].count} (0 esperado). Stock físico no afectado.`
    } catch (err: any) {
      t15Details = `Error en T15: ${err.message}`
    }
    recordResult('T15', 'Verificar que confirmar compra NO modifica inventario', t15Success, t15Details)

    // -------------------------------------------------------------------------
    // T16 — Verificar aislamiento multiempresa
    // -------------------------------------------------------------------------
    console.log('--- EJECUTANDO T16: VERIFICAR AISLAMIENTO MULTIEMPRESA ---')
    let t16Success = false
    let t16Details = ''
    try {
      // 1. User B intenta leer compras de Empresa A bajo RLS
      const readRes = await runAsUser(authUserBId, async (client) => {
        return client.query("SELECT * FROM public.purchases WHERE id = $1;", [confirmedOrderId])
      })

      // 2. User B crea su propia orden en Empresa B y verifica consecutivo independiente
      const bOrderRes = await runAsUser(authUserBId, async (client) => {
        return client.query(`
          SELECT public.fn_create_purchase_order(
            $1, $2, $3, $4, $5, $6, $7, $8, $9
          ) AS purchase_id;
        `, [
          supplierBId,
          locBId,
          `FAC-B-01-${runId}`,
          '2026-10-02',
          '2026-10-02',
          'CONTADO',
          'Orden 1 de Empresa B',
          false,
          JSON.stringify([
            { product_id: productB1Id, quantity: 10, unit_cost: 2500, discount_percent: 0, tax_rate_percent: 19 }
          ])
        ])
      })
      const bOrderId = bOrderRes.rows[0].purchase_id
      const bOrderRow = (await pgClient.query("SELECT * FROM public.purchases WHERE id = $1;", [bOrderId])).rows[0]

      const invisibleCrossTenant = readRes.rows.length === 0
      const independentConsecutive = bOrderRow.purchase_number === 'COM-000001'

      t16Success = invisibleCrossTenant && independentConsecutive
      t16Details = `Compras de Empresa A visibles para Usuario B = ${readRes.rows.length} (0 esperado). Consecutivo Empresa B: "${bOrderRow.purchase_number}" (COM-000001 esperado).`
    } catch (err: any) {
      t16Details = `Error en T16: ${err.message}`
    }
    recordResult('T16', 'Verificar aislamiento multiempresa', t16Success, t16Details)

  } finally {
    // -------------------------------------------------------------------------
    // LIMPIEZA ZERO POLLUTION EN STAGING
    // -------------------------------------------------------------------------
    console.log('--- PURGA ZERO POLLUTION EN STAGING ---')
    try {
      await pgClient.query("SELECT set_config('app.is_test_cleanup', 'true', false);")

      // 1. Eliminar líneas de compra del test
      await pgClient.query(`
        DELETE FROM public.purchase_items
        WHERE purchase_id IN (
          SELECT id FROM public.purchases
          WHERE supplier_invoice_number LIKE '%' || $1 || '%' OR company_id = $2
        );
      `, [runId, companyBId])

      // 2. Eliminar cabeceras de compras del test
      await pgClient.query(`
        DELETE FROM public.purchases
        WHERE supplier_invoice_number LIKE '%' || $1 || '%' OR company_id = $2;
      `, [runId, companyBId])

      // 3. Eliminar productos del test
      await pgClient.query("DELETE FROM public.products WHERE sku LIKE '%' || $1 || '%';", [runId])

      // 4. Eliminar categorías del test
      await pgClient.query("DELETE FROM public.categories WHERE code LIKE '%' || $1 || '%';", [runId])

      // 5. Eliminar proveedores del test
      await pgClient.query("DELETE FROM public.suppliers WHERE email LIKE '%' || $1 || '%' OR tax_id LIKE '%' || $1 || '%';", [runId])

      // 6. Eliminar ubicaciones temporales
      if (locBId) await pgClient.query("DELETE FROM public.user_locations WHERE location_id = $1;", [locBId])
      if (locBId) await pgClient.query("DELETE FROM public.locations WHERE id = $1;", [locBId])

      // 7. Eliminar asignaciones de sedes de usuarios
      if (authUserAId) await pgClient.query("DELETE FROM public.user_locations WHERE user_id = $1;", [authUserAId])
      if (authUserBId) await pgClient.query("DELETE FROM public.user_locations WHERE user_id = $1;", [authUserBId])

      // 8. Eliminar usuarios de public.users
      if (authUserAId) await pgClient.query("DELETE FROM public.users WHERE id = $1;", [authUserAId])
      if (authUserBId) await pgClient.query("DELETE FROM public.users WHERE id = $1;", [authUserBId])

      // 9. Eliminar usuarios de Supabase Auth
      if (authUserAId) await adminSupabase.auth.admin.deleteUser(authUserAId)
      if (authUserBId) await adminSupabase.auth.admin.deleteUser(authUserBId)

      // 10. Eliminar logs de auditoría creados durante el test
      await pgClient.query(`
        DELETE FROM public.audit_logs
        WHERE company_id = $1 OR user_name LIKE '%' || $2 || '%';
      `, [companyBId, runId])

      // 11. Eliminar Empresa B
      if (companyBId) await pgClient.query("DELETE FROM public.companies WHERE id = $1;", [companyBId])

      await pgClient.query("SELECT set_config('app.is_test_cleanup', 'false', false);")

      // Conteo residual
      const resPurchases = await pgClient.query("SELECT count(*) FROM public.purchases WHERE supplier_invoice_number LIKE '%' || $1 || '%';", [runId])
      const resProds = await pgClient.query("SELECT count(*) FROM public.products WHERE sku LIKE '%' || $1 || '%';", [runId])
      const resSupps = await pgClient.query("SELECT count(*) FROM public.suppliers WHERE email LIKE '%' || $1 || '%';", [runId])
      const resUsers = await pgClient.query("SELECT count(*) FROM public.users WHERE email LIKE '%' || $1 || '%';", [runId])
      const resComps = await pgClient.query("SELECT count(*) FROM public.companies WHERE business_name LIKE '%' || $1 || '%';", [runId])

      console.log('📊 Conteo residual en PostgreSQL Staging:')
      console.log(`   - Compras residuales:   ${resPurchases.rows[0].count}`)
      console.log(`   - Productos residuales: ${resProds.rows[0].count}`)
      console.log(`   - Proveedores residual: ${resSupps.rows[0].count}`)
      console.log(`   - Usuarios residuales:  ${resUsers.rows[0].count}`)
      console.log(`   - Empresas residuales:  ${resComps.rows[0].count}`)

      const zero = Number(resPurchases.rows[0].count) === 0 &&
                   Number(resProds.rows[0].count) === 0 &&
                   Number(resSupps.rows[0].count) === 0 &&
                   Number(resUsers.rows[0].count) === 0 &&
                   Number(resComps.rows[0].count) === 0

      if (zero) {
        console.log('✅ ZERO POLLUTION COMPROBADO AL 100% (0 RESIDUOS).')
      } else {
        console.error('⚠️ ALERTA: Quedaron residuos en base de datos.')
      }
    } catch (cleanupErr: any) {
      console.error('Error durante la purga de Zero Pollution:', cleanupErr.message)
    } finally {
      await pgClient.end()
    }
  }

  // ---------------------------------------------------------------------------
  // RESUMEN
  // ---------------------------------------------------------------------------
  console.log('\n================================================================================')
  console.log('📋 RESUMEN FINAL DE PRUEBAS PASO 2 (TYPESCRIPT & RPCs)')
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
    console.log('🏆 TODAS LAS 16 PRUEBAS DEL PASO 2 FUERON SUPERADAS AL 100% (PASS).')
  }
}

runStep2TestSuite().catch((err) => {
  console.error('Fallo fatal en suite:', err)
  process.exit(1)
})
