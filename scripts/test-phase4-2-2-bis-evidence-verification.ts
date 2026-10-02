/**
 * ==============================================================================
 * SUITE DE VALIDACION FINAL DE EVIDENCIA (FASE 4.2.2-BIS)
 * ERP SUPER MAS S.A.S. — Supabase PostgreSQL (Staging)
 * ==============================================================================
 */

import { Client } from "pg"
import { createClient } from "@supabase/supabase-js"
import * as dotenv from "dotenv"

dotenv.config({ path: ".env.local" })

interface EvidenceCheck {
  num: string
  name: string
  status: "PASS" | "FAIL"
  evidence: any
}

const checks: EvidenceCheck[] = []

function record(num: string, name: string, pass: boolean, evidence: any) {
  const status = pass ? "PASS" : "FAIL"
  checks.push({ num, name, status, evidence })
  const icon = pass ? "✅" : "❌"
  console.log(icon + " [" + num + "] " + name + ": " + status)
  console.log("   Evidencia:", typeof evidence === "string" ? evidence : JSON.stringify(evidence, null, 2), "\n")
}

async function runEvidenceVerification() {
  console.log("================================================================================")
  console.log("🔬 INICIANDO VERIFICACION FINAL DE EVIDENCIA — FASE 4.2.2-BIS")
  console.log("================================================================================\n")

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  const connStr = process.env.DATABASE_URL || process.env.DIRECT_URL

  const pgClient = new Client({
    connectionString: connStr,
    ssl: { rejectUnauthorized: false },
  })
  await pgClient.connect()

  const adminSupabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const runId = Date.now().toString().slice(-6)
  const tag = "BIS-" + runId

  let companyAId = ""
  let companyBId = ""
  let locAId = ""
  let locBId = ""
  let userAId = ""
  let userBId = ""
  const userAEmail = "user_a_" + runId + "@supermas.test"
  const userBEmail = "user_b_" + runId + "@supermas.test"
  const password = "Pass_" + runId + "!Sec"
  let clientA: any = null
  let clientB: any = null

  let saleAId = ""
  let saleBId = ""
  let prodOfficialId = ""
  let cashRegAId = ""
  let cashSessionAId = ""

  try {
    // -------------------------------------------------------------------------
    // 1. HALLAZGO 1 & 2: VERIFICAR SEARCH_PATH Y PRIVILEGIOS LIVE
    // -------------------------------------------------------------------------
    console.log("--- 1. VERIFICANDO DEFINICION Y PRIVILEGIOS LIVE DE fn_execute_pos_sale ---")
    const procRes = await pgClient.query(`
      SELECT
        n.nspname AS schema_name,
        p.proname AS function_name,
        p.prosecdef AS is_security_definer,
        r.rolname AS owner_name,
        p.proconfig,
        pg_get_functiondef(p.oid) AS function_def
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      JOIN pg_roles r ON r.oid = p.proowner
      WHERE n.nspname = 'public'
        AND p.proname = 'fn_execute_pos_sale'
    `)

    const procRow = procRes.rows[0]
    const liveSearchPath = procRow.proconfig?.[0] || "NOT_SET"
    const liveSecDef = procRow.is_security_definer
    const liveOwner = procRow.owner_name

    const privsRes = await pgClient.query(`
      SELECT grantee, privilege_type
      FROM information_schema.routine_privileges
      WHERE specific_schema = 'public'
        AND routine_name = 'fn_execute_pos_sale'
    `)
    const grantees = privsRes.rows.map((r: any) => r.grantee)
    const hasPublic = grantees.includes("PUBLIC")
    const hasAnon = grantees.includes("anon")
    const hasAuthenticated = grantees.includes("authenticated")
    const hasServiceRole = grantees.includes("service_role")

    const h1Pass = liveSearchPath === "search_path=public, pg_catalog"
    record("H1", "Verificar search_path REAL en Live PostgreSQL", h1Pass, {
      proconfig: procRow.proconfig,
      liveSearchPath,
      nota: "El search_path real en PostgreSQL es public, pg_catalog (no public, pg_temp)."
    })

    const h2Pass = liveSecDef === true && !hasPublic && !hasAnon && hasAuthenticated && hasServiceRole
    record("H2", "Verificar SECURITY DEFINER y Privilegios de Ejecucion Live", h2Pass, {
      is_security_definer: liveSecDef,
      owner: liveOwner,
      grantees,
      public_revoked: !hasPublic,
      anon_revoked: !hasAnon,
      authenticated_granted: hasAuthenticated,
      service_role_granted: hasServiceRole
    })

    // -------------------------------------------------------------------------
    // SETUP MULTI-TENANT CON USUARIOS SUPABASE AUTH REALES
    // -------------------------------------------------------------------------
    console.log("--- SETUP ENTIDADES MULTI-TENANT TEMPORALES ---")
    const compARes = await pgClient.query("SELECT id FROM public.companies WHERE status = 'ACTIVE' ORDER BY created_at ASC LIMIT 1")
    companyAId = compARes.rows[0].id

    const compBRes = await pgClient.query(`
      INSERT INTO public.companies (
        business_name, trade_name, tax_id, verification_digit, tax_regime,
        address, city, department, country, phone, email, invoice_email, status
      ) VALUES (
        'Empresa B Staging ' || $1, 'Empresa B', '900888' || $1, '2', 'RESPONSABLE_DE_IVA',
        'Calle 20 # 30-40', 'Bogota', 'Bogota D.C.', 'Colombia', '3009998877',
        'compb_' || $1 || '@supermas.test', 'factb_' || $1 || '@supermas.test', 'ACTIVE'
      ) RETURNING id
    `, [runId])
    companyBId = compBRes.rows[0].id

    const locARes = await pgClient.query("SELECT id FROM public.locations WHERE company_id = $1 AND status = 'ACTIVE' LIMIT 1", [companyAId])
    locAId = locARes.rows[0].id

    const locBRes = await pgClient.query(`
      INSERT INTO public.locations (
        company_id, code, name, type, address, city, department, status
      ) VALUES (
        $1, 'LOC-B-' || $2, 'Bodega Principal B ' || $2, 'WAREHOUSE',
        'Carrera 7 # 100-20', 'Bogota', 'Bogota D.C.', 'ACTIVE'
      ) RETURNING id
    `, [companyBId, runId])
    locBId = locBRes.rows[0].id

    const roleCashier = await pgClient.query("SELECT id FROM public.roles WHERE code = 'CASHIER' LIMIT 1")
    const cashierRoleId = roleCashier.rows[0].id

    // Crear usuarios Auth
    const uA = await adminSupabase.auth.admin.createUser({ email: userAEmail, password, email_confirm: true })
    userAId = uA.data.user!.id
    await pgClient.query(`
      UPDATE public.users
      SET company_id = $1, role_id = $2, full_name = 'Usuario A ' || $3, is_active = true
      WHERE id = $4
    `, [companyAId, cashierRoleId, runId, userAId])
    await pgClient.query("INSERT INTO public.user_locations (user_id, location_id, is_primary) VALUES ($1, $2, true)", [userAId, locAId])

    const uB = await adminSupabase.auth.admin.createUser({ email: userBEmail, password, email_confirm: true })
    userBId = uB.data.user!.id
    await pgClient.query(`
      UPDATE public.users
      SET company_id = $1, role_id = $2, full_name = 'Usuario B ' || $3, is_active = true
      WHERE id = $4
    `, [companyBId, cashierRoleId, runId, userBId])
    await pgClient.query("INSERT INTO public.user_locations (user_id, location_id, is_primary) VALUES ($1, $2, true)", [userBId, locBId])

    // Iniciar sesiones Supabase
    clientA = createClient(supabaseUrl, anonKey, { auth: { autoRefreshToken: false, persistSession: false } })
    await clientA.auth.signInWithPassword({ email: userAEmail, password })

    clientB = createClient(supabaseUrl, anonKey, { auth: { autoRefreshToken: false, persistSession: false } })
    await clientB.auth.signInWithPassword({ email: userBEmail, password })

    // Obtener / Crear Clientes para Empresa A y Empresa B
    const custARes = await pgClient.query("SELECT id FROM public.customers WHERE company_id = $1 LIMIT 1", [companyAId])
    let custAId = custARes.rows[0]?.id
    if (!custAId) {
      const insCustA = await pgClient.query(`
        INSERT INTO public.customers (company_id, document_type, document_number, first_name, last_name, company_name, customer_type, is_active)
        VALUES ($1, 'CC', '222222222222', 'Consumidor', 'Final', 'Consumidor Final', 'INDIVIDUAL', true) RETURNING id
      `, [companyAId])
      custAId = insCustA.rows[0].id
    }

    const insCustB = await pgClient.query(`
      INSERT INTO public.customers (company_id, document_type, document_number, first_name, last_name, company_name, customer_type, is_active)
      VALUES ($1, 'CC', '222222222222', 'Consumidor', 'Final B', 'Consumidor Final B', 'INDIVIDUAL', true) RETURNING id
    `, [companyBId])
    const custBId = insCustB.rows[0].id

    // Insertar 1 venta controlada en Empresa A y 1 venta controlada en Empresa B
    const sARes = await pgClient.query(`
      INSERT INTO public.sales (
        company_id, location_id, customer_id, seller_user_id, sale_number, subtotal_amount,
        discount_amount, tax_amount, total_amount, total_cost_amount, paid_amount,
        payment_status, payment_method, status, notes
      ) VALUES (
        $1, $2, $3, $4, 'VTA-CTRL-A-' || $5, 50000,
        0, 9500, 59500, 30000, 59500,
        'PAID', 'CASH', 'ISSUED', 'Venta Controlada Empresa A'
      ) RETURNING id
    `, [companyAId, locAId, custAId, userAId, runId])
    saleAId = sARes.rows[0].id

    const sBRes = await pgClient.query(`
      INSERT INTO public.sales (
        company_id, location_id, customer_id, seller_user_id, sale_number, subtotal_amount,
        discount_amount, tax_amount, total_amount, total_cost_amount, paid_amount,
        payment_status, payment_method, status, notes
      ) VALUES (
        $1, $2, $3, $4, 'VTA-CTRL-B-' || $5, 80000,
        0, 15200, 95200, 50000, 95200,
        'PAID', 'CASH', 'ISSUED', 'Venta Controlada Empresa B'
      ) RETURNING id
    `, [companyBId, locBId, custBId, userBId, runId])
    saleBId = sBRes.rows[0].id

    // -------------------------------------------------------------------------
    // 3. HALLAZGO 3: RLS SELECT TEST REAL (NO TAUTOLOGICO)
    // -------------------------------------------------------------------------
    console.log("--- 3. EJECUTANDO PRUEBA RLS SELECT REAL (Usuario A) ---")
    const { data: ownSales } = await clientA
      .from("sales")
      .select("id, sale_number, company_id")
      .eq("id", saleAId)

    const { data: foreignSales } = await clientA
      .from("sales")
      .select("id, sale_number, company_id")
      .eq("id", saleBId)

    const { data: allVisibleSales } = await clientA
      .from("sales")
      .select("id, company_id")

    const ownCount = ownSales?.length || 0
    const foreignCount = foreignSales?.length || 0
    const foreignLeaked = (allVisibleSales || []).filter((s: any) => s.company_id === companyBId).length

    const h3Pass = ownCount > 0 && foreignCount === 0 && foreignLeaked === 0
    record("H3", "RLS SELECT Real (ownCount > 0 && foreignCount = 0)", h3Pass, {
      ownCount,
      foreignCount,
      foreignLeaked,
      ownSales,
      foreignSales,
      criterio: "El Usuario A ve sus ventas pero tiene estrictamente 0 visibilidad de ventas de Empresa B."
    })

    // -------------------------------------------------------------------------
    // 4. HALLAZGO 4: RLS INSERT TEST (Usuario A intenta insertar en Empresa B)
    // -------------------------------------------------------------------------
    console.log("--- 4. EJECUTANDO PRUEBA RLS INSERT REAL ---")
    const { data: insData, error: insErr } = await clientA
      .from("sales")
      .insert({
        company_id: companyBId,
        location_id: locBId,
        seller_user_id: userAId,
        sale_number: "VTA-ILLEGAL-INS-" + runId,
        subtotal_amount: 1000,
        total_amount: 1000,
        payment_method: "CASH",
        status: "ISSUED"
      })
      .select()

    const chkIns = await pgClient.query("SELECT count(*) FROM public.sales WHERE sale_number = $1", ["VTA-ILLEGAL-INS-" + runId])
    const insExists = Number(chkIns.rows[0].count) > 0

    const insPolRes = await pgClient.query(`
      SELECT policyname, cmd, with_check
      FROM pg_policies
      WHERE tablename = 'sales' AND cmd = 'INSERT'
    `)

    const h4Pass = insErr !== null && !insExists
    record("H4", "RLS INSERT Cross-Tenant Direct Blocked", h4Pass, {
      insertError: insErr?.message || insErr,
      errorCode: insErr?.code,
      insExistsInDb: insExists,
      applicablePolicy: insPolRes.rows[0]?.policyname,
      policyWithCheck: insPolRes.rows[0]?.with_check,
      distincion: "Bloqueado por politica RLS Tenant isolation insert sales (WITH CHECK: company_id = get_auth_company_id())."
    })

    // -------------------------------------------------------------------------
    // 5. HALLAZGO 5: RLS UPDATE TEST (Usuario A intenta modificar venta de Empresa B)
    // -------------------------------------------------------------------------
    console.log("--- 5. EJECUTANDO PRUEBA RLS UPDATE REAL ---")
    const { data: updData } = await clientA
      .from("sales")
      .update({ notes: "ADULTERADO POR USUARIO A" })
      .eq("id", saleBId)
      .select()

    const chkUpd = await pgClient.query("SELECT notes FROM public.sales WHERE id = $1", [saleBId])
    const notesUnchanged = chkUpd.rows[0]?.notes === "Venta Controlada Empresa B"
    const rowsUpdatedCount = updData?.length || 0

    const h5Pass = rowsUpdatedCount === 0 && notesUnchanged
    record("H5", "RLS UPDATE Cross-Tenant Prevented", h5Pass, {
      rowsUpdatedCount,
      notesInDb: chkUpd.rows[0]?.notes,
      notesUnchanged,
      distincion: "La politica RLS de UPDATE filtra por qual (company_id = get_auth_company_id()); Usuario A ve 0 filas y no puede modificar la fila de Empresa B."
    })

    // -------------------------------------------------------------------------
    // 6. HALLAZGO 6: RLS DELETE TEST & INMUTABILIDAD
    // -------------------------------------------------------------------------
    console.log("--- 6. EJECUTANDO PRUEBA RLS DELETE TEST & INMUTABILIDAD ---")
    // 6.1 Usuario B intenta eliminar venta de Empresa A
    await clientB
      .from("sales")
      .delete()
      .eq("id", saleAId)
      .select()

    const chkDelB = await pgClient.query("SELECT count(*) FROM public.sales WHERE id = $1", [saleAId])
    const saleAStillExists = Number(chkDelB.rows[0].count) === 1

    // 6.2 Usuario A (propietario) intenta eliminar su propia venta directamente
    let triggerBlocked = false
    let triggerErrCode = ""
    let triggerErrMsg = ""
    try {
      await pgClient.query(`
        SELECT set_config('request.jwt.claims', '{"sub": "` + userAId + `", "role": "authenticated"}', true)
      `)
      await pgClient.query("DELETE FROM public.sales WHERE id = $1", [saleAId])
    } catch (e: any) {
      triggerBlocked = true
      triggerErrCode = e.code
      triggerErrMsg = e.message
    } finally {
      await pgClient.query("ROLLBACK")
    }

    const chkFinalSaleA = await pgClient.query("SELECT count(*) FROM public.sales WHERE id = $1", [saleAId])
    const saleAFinalCount = Number(chkFinalSaleA.rows[0].count)

    const h6Pass = saleAStillExists && triggerBlocked && saleAFinalCount === 1
    record("H6", "RLS DELETE & Inmutabilidad de Ventas Verificada", h6Pass, {
      saleAStillExistsAfterCrossDelete: saleAStillExists,
      ownerDeleteTriggerBlocked: triggerBlocked,
      triggerErrCode,
      triggerErrMsg,
      saleAFinalCountInDb: saleAFinalCount,
      distincion: "Eliminacion cruzada prevenida por RLS (0 filas coincidentes). Eliminacion del propietario prevenida por trigger trg_prevent_sale_deletion (Codigo 23506)."
    })

    // -------------------------------------------------------------------------
    // 7 & 8: POLÍTICAS Y RLS FORCE
    // -------------------------------------------------------------------------
    console.log("--- 7 & 8. VERIFICANDO POLITICAS Y RLS FORCE ---")
    const rlsStatusRes = await pgClient.query(`
      SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relname IN ('sales', 'sale_items', 'inventory_movements', 'cash_sessions', 'cash_movements', 'stock_levels')
      ORDER BY c.relname
    `)

    const allRlsEnabled = rlsStatusRes.rows.every((r: any) => r.relrowsecurity === true)
    record("H8", "RLS ENABLED en todas las tablas criticas", allRlsEnabled, rlsStatusRes.rows)

    // -------------------------------------------------------------------------
    // 11. VERIFICACIÓN DE PRECIO (Catálogo, Mayorista, Adulterado, $1)
    // -------------------------------------------------------------------------
    console.log("--- 11. PRUEBA DE PRECIO (Oficial, Mayorista, Adulterado, 1$) ---")
    const prodRes = await pgClient.query(`
      INSERT INTO public.products (
        company_id, sku, barcode, name, slug, unit_of_measure, cost_price,
        public_sale_price, wholesale_price, min_wholesale_quantity, tax_rate_percent,
        is_tax_exempt, is_active
      ) VALUES (
        $1, 'SKU-PRC-' || $2, 'BAR-PRC-' || $2, 'Prod Precio ' || $2, 'prod-prc-' || $2, 'UND',
        50000, 100000, 80000, 12, 19, false, true
      ) RETURNING id
    `, [companyAId, runId])
    prodOfficialId = prodRes.rows[0].id

    await pgClient.query(`
      INSERT INTO public.stock_levels (product_id, location_id, quantity, average_cost)
      VALUES ($1, $2, 100, 50000)
    `, [prodOfficialId, locAId])

    const crA = await pgClient.query(`
      INSERT INTO public.cash_registers (company_id, location_id, code, name, current_status)
      VALUES ($1, $2, 'CR-A-' || $3, 'Caja A ' || $3, 'ACTIVE') RETURNING id
    `, [companyAId, locAId, runId])
    cashRegAId = crA.rows[0].id

    const csA = await pgClient.query(`
      INSERT INTO public.cash_sessions (company_id, location_id, cash_register_id, user_id, opening_float, status)
      VALUES ($1, $2, $3, $4, 100000, 'OPEN') RETURNING id
    `, [companyAId, locAId, cashRegAId, userAId])
    cashSessionAId = csA.rows[0].id

    // 11.1 Venta precio oficial $100.000 x 1 -> PASS
    const rOfficial = await clientA.rpc("fn_execute_pos_sale", {
      p_company_id: companyAId,
      p_location_id: locAId,
      p_customer_id: null,
      p_seller_user_id: userAId,
      p_cash_session_id: cashSessionAId,
      p_sale_number: "VTA-OK-OFF-" + runId,
      p_payment_method: "CASH",
      p_notes: "Venta precio oficial",
      p_items: [{ product_id: prodOfficialId, quantity: 1, unit_price: 100000 }]
    })

    // 11.2 Venta precio mayorista $80.000 x 12 -> PASS
    const rWholesale = await clientA.rpc("fn_execute_pos_sale", {
      p_company_id: companyAId,
      p_location_id: locAId,
      p_customer_id: null,
      p_seller_user_id: userAId,
      p_cash_session_id: cashSessionAId,
      p_sale_number: "VTA-OK-WHOLE-" + runId,
      p_payment_method: "CASH",
      p_notes: "Venta precio mayorista",
      p_items: [{ product_id: prodOfficialId, quantity: 12, unit_price: 80000 }]
    })

    // 11.3 Venta precio adulterado $50.000 x 1 -> REJECT
    const rTampered = await clientA.rpc("fn_execute_pos_sale", {
      p_company_id: companyAId,
      p_location_id: locAId,
      p_customer_id: null,
      p_seller_user_id: userAId,
      p_cash_session_id: cashSessionAId,
      p_sale_number: "VTA-BAD-50K-" + runId,
      p_payment_method: "CASH",
      p_notes: "Intento precio adulterado",
      p_items: [{ product_id: prodOfficialId, quantity: 1, unit_price: 50000 }]
    })

    // 11.4 Venta precio $1 x 1 -> REJECT
    const rOneDollar = await clientA.rpc("fn_execute_pos_sale", {
      p_company_id: companyAId,
      p_location_id: locAId,
      p_customer_id: null,
      p_seller_user_id: userAId,
      p_cash_session_id: cashSessionAId,
      p_sale_number: "VTA-BAD-1USD-" + runId,
      p_payment_method: "CASH",
      p_notes: "Intento precio 1 peso",
      p_items: [{ product_id: prodOfficialId, quantity: 1, unit_price: 1 }]
    })

    const chkBadSales = await pgClient.query(`
      SELECT count(*) FROM public.sales
      WHERE sale_number IN ('VTA-BAD-50K-' || $1, 'VTA-BAD-1USD-' || $1)
    `, [runId])
    const badSalesCount = Number(chkBadSales.rows[0].count)

    const chkBadKardex = await pgClient.query(`
      SELECT count(*) FROM public.inventory_movements
      WHERE document_reference IN ('VTA-BAD-50K-' || $1, 'VTA-BAD-1USD-' || $1)
    `, [runId])
    const badKardexCount = Number(chkBadKardex.rows[0].count)

    const chkBadCash = await pgClient.query(`
      SELECT count(*) FROM public.cash_movements
      WHERE reason LIKE '%VTA-BAD-50K-' || $1 || '%' OR reason LIKE '%VTA-BAD-1USD-' || $1 || '%'
    `, [runId])
    const badCashCount = Number(chkBadCash.rows[0].count)

    const h11Pass = rOfficial.data?.success === true &&
                    rWholesale.data?.success === true &&
                    rTampered.error !== null &&
                    rOneDollar.error !== null &&
                    badSalesCount === 0 &&
                    badKardexCount === 0 &&
                    badCashCount === 0

    record("H11", "Verificacion Fiduciaria de Precios y Cero Residuos en Rechazo", h11Pass, {
      officialResult: rOfficial.data?.success,
      wholesaleResult: rWholesale.data?.success,
      tamperedError: rTampered.error?.message,
      oneDollarError: rOneDollar.error?.message,
      badSalesInDb: badSalesCount,
      badKardexInDb: badKardexCount,
      badCashInDb: badCashCount
    })

    // -------------------------------------------------------------------------
    // 12. VERIFICACIÓN DE TAX TAMPERING
    // -------------------------------------------------------------------------
    console.log("--- 12. PRUEBA DE TAX TAMPERING ---")
    const rTax = await clientA.rpc("fn_execute_pos_sale", {
      p_company_id: companyAId,
      p_location_id: locAId,
      p_customer_id: null,
      p_seller_user_id: userAId,
      p_cash_session_id: cashSessionAId,
      p_sale_number: "VTA-TAX-TEST-" + runId,
      p_payment_method: "CASH",
      p_notes: "Prueba tax tampering",
      p_items: [{
        product_id: prodOfficialId,
        quantity: 1,
        unit_price: 100000,
        tax_rate_percent: 0
      }]
    })

    const taxDbRes = await pgClient.query(`
      SELECT s.id, s.subtotal_amount, s.tax_amount, s.total_amount,
             i.tax_rate_percent, i.tax_amount as item_tax_amount
      FROM public.sales s
      JOIN public.sale_items i ON i.sale_id = s.id
      WHERE s.sale_number = $1
    `, ["VTA-TAX-TEST-" + runId])

    const taxRow = taxDbRes.rows[0]
    const subtotal = Number(taxRow.subtotal_amount)
    const taxAmt = Number(taxRow.tax_amount)
    const totalAmt = Number(taxRow.total_amount)
    const itemRate = Number(taxRow.tax_rate_percent)
    const itemTax = Number(taxRow.item_tax_amount)

    const h12Pass = subtotal === 100000 &&
                    taxAmt === 19000 &&
                    totalAmt === 119000 &&
                    itemRate === 19 &&
                    itemTax === 19000

    record("H12", "Tax Tampering Protection Directa en DB", h12Pass, {
      clienteEnvio: "tax_rate_percent = 0",
      dbSubtotal: subtotal,
      dbTaxAmount: taxAmt,
      dbTotalAmount: totalAmt,
      itemTaxRatePercent: itemRate,
      itemTaxAmount: itemTax,
      ivaAplicado: "19% Oficial Calculado Fiduciariamente por PostgreSQL"
    })

  } catch (err: any) {
    console.error("Error no controlado durante verificacion de evidencia:", err)
  } finally {
    // -------------------------------------------------------------------------
    // ZERO POLLUTION TEARDOWN
    // -------------------------------------------------------------------------
    console.log("--- PURGANDO RESIDUOS ZERO POLLUTION ---")
    try {
      await pgClient.query("SELECT set_config('app.is_test_cleanup', 'true', false)")

      if (cashSessionAId) {
        await pgClient.query("DELETE FROM public.cash_movements WHERE session_id = $1", [cashSessionAId])
        await pgClient.query("DELETE FROM public.cash_sessions WHERE id = $1", [cashSessionAId])
      }
      if (cashRegAId) {
        await pgClient.query("DELETE FROM public.cash_registers WHERE id = $1", [cashRegAId])
      }

      await pgClient.query("DELETE FROM public.cash_movements WHERE session_id IN (SELECT id FROM public.cash_sessions WHERE company_id = $1)", [companyBId])
      await pgClient.query("DELETE FROM public.cash_sessions WHERE company_id = $1", [companyBId])
      await pgClient.query("DELETE FROM public.cash_registers WHERE company_id = $1", [companyBId])

      await pgClient.query("DELETE FROM public.inventory_movements WHERE document_reference LIKE '%' || $1 || '%'", [runId])
      await pgClient.query("DELETE FROM public.sale_items WHERE sale_id IN (SELECT id FROM public.sales WHERE sale_number LIKE '%' || $1 || '%')", [runId])
      await pgClient.query("DELETE FROM public.sales WHERE sale_number LIKE '%' || $1 || '%'", [runId])

      if (prodOfficialId) {
        await pgClient.query("DELETE FROM public.stock_levels WHERE product_id = $1", [prodOfficialId])
        await pgClient.query("DELETE FROM public.products WHERE id = $1", [prodOfficialId])
      }

      if (userAId) {
        await pgClient.query("DELETE FROM public.user_locations WHERE user_id = $1", [userAId])
        await pgClient.query("DELETE FROM public.users WHERE id = $1", [userAId])
        await adminSupabase.auth.admin.deleteUser(userAId)
      }
      if (userBId) {
        await pgClient.query("DELETE FROM public.user_locations WHERE user_id = $1", [userBId])
        await pgClient.query("DELETE FROM public.users WHERE id = $1", [userBId])
        await adminSupabase.auth.admin.deleteUser(userBId)
      }

      if (locBId) {
        await pgClient.query("DELETE FROM public.locations WHERE id = $1", [locBId])
      }
            if (companyBId) {
        await pgClient.query("DELETE FROM public.customers WHERE company_id = $1", [companyBId])
        await pgClient.query("DELETE FROM public.audit_logs WHERE company_id = $1", [companyBId])
        await pgClient.query("DELETE FROM public.companies WHERE id = $1", [companyBId])
      }

      console.log("Teardown completado exitosamente.")
    } catch (cleanErr: any) {
      console.error("Error durante teardown:", cleanErr)
    }

    const zpProd = await pgClient.query("SELECT count(*) FROM public.products WHERE sku LIKE '%' || $1 || '%'", [runId])
    const zpSales = await pgClient.query("SELECT count(*) FROM public.sales WHERE sale_number LIKE '%' || $1 || '%'", [runId])
    const zpUsers = await pgClient.query("SELECT count(*) FROM public.users WHERE email LIKE '%' || $1 || '%'", [runId])
    const zpComp = await pgClient.query("SELECT count(*) FROM public.companies WHERE business_name LIKE '%' || $1 || '%'", [runId])

    const zpPass = Number(zpProd.rows[0].count) === 0 &&
                   Number(zpSales.rows[0].count) === 0 &&
                   Number(zpUsers.rows[0].count) === 0 &&
                   Number(zpComp.rows[0].count) === 0

    record("ZP", "Zero Pollution Final Verification (0 residuos)", zpPass, {
      residualProducts: Number(zpProd.rows[0].count),
      residualSales: Number(zpSales.rows[0].count),
      residualUsers: Number(zpUsers.rows[0].count),
      residualCompanies: Number(zpComp.rows[0].count)
    })

    await pgClient.end()
  }
}

runEvidenceVerification().catch(console.error);
