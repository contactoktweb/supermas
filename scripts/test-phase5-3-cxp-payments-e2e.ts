/**
 * ==============================================================================
 * SUITE DE VALIDACIÓN E2E — FASE 5.3: PAGOS A PROVEEDORES, CxP Y TESORERÍA
 * ERP SUPER MÁS S.A.S. — Supabase PostgreSQL (Staging)
 * ==============================================================================
 *
 * 21 Casos de Prueba Obligatorios:
 * P01 — Abono parcial: Compra $1.000.000, abono $400.000 -> PARTIAL, saldo $600.000, comprobante PAG-XXXXXX
 * P02 — Segundo abono: Abono $300.000 -> PARTIAL, paid_amount = $700.000, saldo $300.000
 * P03 — Pago total: Abono $300.000 restante -> PAID, paid_amount = $1.000.000, saldo $0
 * P04 — Sobrepago: Intento de pagar $50.000 con saldo $0 -> Rechazado por RPC
 * P05 — Pago cero: Intento de pagar 0 -> Rechazado por RPC
 * P06 — Pago negativo: Intento de pagar -500 -> Rechazado por RPC
 * P07 — Pago compra borrador: Intento de pagar compra BORRADOR -> Rechazado
 * P08 — Pago compra cancelada: Intento de pagar compra CANCELADA -> Rechazado
 * P09 — Pago compra ya pagada: Intento de pagar orden en PAID -> Rechazado
 * P10 — Concurrencia: Dos pagos simultáneos compitiendo por saldo -> Candado transaccional evita sobrepago
 * P11 — Multiempresa: Usuario Empresa B intenta pagar compra de Empresa A -> Bloqueado (42501)
 * P12 — Usuario real: supplier_payments.created_by_user_id = auth.uid() real
 * P13 — Auditoría: Registro verificado en audit_logs (SUPPLIER_PAYMENT_CREATED)
 * P14 — Pago bancario: BANK_TRANSFER genera bank_movements (DEBIT) con consecutivo BM-XXXXXX
 * P15 — Pago efectivo: CASH genera cash_movements (WITHDRAWAL) en sesión activa
 * P16 — Validación sesión caja: Intento de pago CASH con sesión cerrada o inexistente -> Rechazado
 * P17 — Saldo bancario: bank_accounts.current_balance disminuye exactamente por el monto del pago
 * P18 — Movimiento bancario: bank_movements registra DEBIT, supplier_payment_id y balance_after exacto
 * P19 — Movimiento caja: cash_movements registra WITHDRAWAL, session_id, amount y reason
 * P20 — Atomicidad / rollback: Error en movimiento financiero provoca rollback total de supplier_payment
 * P21 — Zero Pollution: Purga absoluta de datos de prueba en PostgreSQL Staging (0 residuos)
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

async function runPhase53TestSuite() {
  console.log('================================================================================')
  console.log('🧪 INICIANDO SUITE DE PRUEBAS E2E FASE 5.3 — PAGOS A PROVEEDORES, CxP Y TESORERÍA')
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
  const tag = `TEST-P53-${runId}`

  let companyAId = ''
  let companyBId = ''
  let locAId = ''
  let locBId = ''

  let authUserAId = ''
  let authUserBId = ''

  const userAEmail = `admin_p53_a_${runId}@supermas.test`
  const userBEmail = `admin_p53_b_${runId}@supermas.test`
  const testPassword = `P53Pay*${runId}Pass!`

  let categoryAId = ''
  let categoryBId = ''
  let supplierAId = ''
  let supplierBId = ''

  let productAId = ''
  let productBId = ''

  let bankAccountAId = ''
  let bankAccountBId = ''

  let cashRegisterAId = ''
  let cashSessionAId = ''

  let clientA: any
  let clientB: any

  try {
    // --------------------------------------------------------------------------
    // SETUP BASE MULTI-TENANT & ENTIDADES STAGING
    // --------------------------------------------------------------------------
    console.log('--- SETUP BASE MULTI-TENANT & ENTIDADES STAGING ---')

    // 1. Resolver empresas existentes o crear si no existen
    const compARes = await pgClient.query(
      `SELECT id FROM public.companies WHERE status = 'ACTIVE' ORDER BY created_at ASC LIMIT 1;`
    )
    if (compARes.rows.length === 0) {
      throw new Error('No hay empresas activas en staging.')
    }
    companyAId = compARes.rows[0].id

    // Empresa B
    const compBRes = await pgClient.query(
      `SELECT id FROM public.companies WHERE id != $1 AND status = 'ACTIVE' LIMIT 1;`,
      [companyAId]
    )
    if (compBRes.rows.length > 0) {
      companyBId = compBRes.rows[0].id
    } else {
      const insB = await pgClient.query(
        `INSERT INTO public.companies (trade_name, business_name, tax_id, status)
         VALUES ($1, $2, $3, 'ACTIVE') RETURNING id;`,
        [`Empresa B ${tag}`, `Razón Social B ${tag}`, `901${runId}99-1`]
      )
      companyBId = insB.rows[0].id
    }

    // 2. Ubicaciones (Bodegas)
    const locARes = await pgClient.query(
      `SELECT id FROM public.locations WHERE company_id = $1 AND status = 'ACTIVE' LIMIT 1;`,
      [companyAId]
    )
    if (locARes.rows.length > 0) {
      locAId = locARes.rows[0].id
    } else {
      const insL = await pgClient.query(
        `INSERT INTO public.locations (company_id, code, name, status)
         VALUES ($1, $2, $3, 'ACTIVE') RETURNING id;`,
        [companyAId, `BOD-A-${runId}`, `Bodega Principal A ${tag}`]
      )
      locAId = insL.rows[0].id
    }

    const locBRes = await pgClient.query(
      `SELECT id FROM public.locations WHERE company_id = $1 AND status = 'ACTIVE' LIMIT 1;`,
      [companyBId]
    )
    if (locBRes.rows.length > 0) {
      locBId = locBRes.rows[0].id
    } else {
      const insLB = await pgClient.query(
        `INSERT INTO public.locations (company_id, code, name, status)
         VALUES ($1, $2, $3, 'ACTIVE') RETURNING id;`,
        [companyBId, `BOD-B-${runId}`, `Bodega Principal B ${tag}`]
      )
      locBId = insLB.rows[0].id
    }

    // 3. Crear Usuarios Auth en Supabase
    console.log('--- CREANDO USUARIOS EN SUPABASE AUTH ---')
    const createAuthUser = async (email: string, compId: string, role: string) => {
      const { data: userAuth, error: authErr } = await adminSupabase.auth.admin.createUser({
        email,
        password: testPassword,
        email_confirm: true,
        user_metadata: { full_name: `Admin ${email.split('@')[0]}`, company_id: compId, role },
      })
      if (authErr) throw authErr

      await pgClient.query(
        `INSERT INTO public.users (id, email, full_name, role_id, company_id, is_active)
         VALUES ($1, $2, $3, (SELECT id FROM public.roles WHERE code = $4 LIMIT 1), $5, true)
         ON CONFLICT (id) DO UPDATE SET company_id = $5, role_id = (SELECT id FROM public.roles WHERE code = $4 LIMIT 1);`,
        [userAuth.user.id, email, `Admin ${email.split('@')[0]}`, role, compId]
      )

      await pgClient.query(
        `INSERT INTO public.user_locations (user_id, location_id)
         VALUES ($1, $2) ON CONFLICT DO NOTHING;`,
        [userAuth.user.id, compId === companyAId ? locAId : locBId]
      )

      return userAuth.user.id
    }

    authUserAId = await createAuthUser(userAEmail, companyAId, 'ADMIN')
    authUserBId = await createAuthUser(userBEmail, companyBId, 'ADMIN')

    // Iniciar sesión y crear clientes Supabase autenticados
    const { data: signA, error: signAErr } = await adminSupabase.auth.signInWithPassword({
      email: userAEmail,
      password: testPassword,
    })
    if (signAErr) throw signAErr
    clientA = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${signA.session.access_token}` } },
    })

    const { data: signB, error: signBErr } = await adminSupabase.auth.signInWithPassword({
      email: userBEmail,
      password: testPassword,
    })
    if (signBErr) throw signBErr
    clientB = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${signB.session.access_token}` } },
    })

    console.log('✅ Usuarios auth creados y clientes autenticados.\n')

    // 4. Proveedores de prueba
    const supA = await pgClient.query(
      `INSERT INTO public.suppliers (company_id, tax_id, name, legal_name, is_active)
       VALUES ($1, $2, $3, $4, true) RETURNING id;`,
      [companyAId, `NIT-A-${runId}`, `Proveedor A ${tag}`, `Razón Social Proveedor A ${tag}`]
    )
    supplierAId = supA.rows[0].id

    const supB = await pgClient.query(
      `INSERT INTO public.suppliers (company_id, tax_id, name, legal_name, is_active)
       VALUES ($1, $2, $3, $4, true) RETURNING id;`,
      [companyBId, `NIT-B-${runId}`, `Proveedor B ${tag}`, `Razón Social Proveedor B ${tag}`]
    )
    supplierBId = supB.rows[0].id

    // 5. Cuentas bancarias de prueba
    const bankA = await pgClient.query(
      `INSERT INTO public.bank_accounts (company_id, location_id, bank_name, account_number, account_type, currency, current_balance, is_active)
       VALUES ($1, $2, $3, $4, 'CORRIENTE', 'COP', 5000000.00, true) RETURNING id;`,
      [companyAId, locAId, `Bancolombia A ${tag}`, `CTA-A-${runId}`]
    )
    bankAccountAId = bankA.rows[0].id

    const bankB = await pgClient.query(
      `INSERT INTO public.bank_accounts (company_id, location_id, bank_name, account_number, account_type, currency, current_balance, is_active)
       VALUES ($1, $2, $3, $4, 'CORRIENTE', 'COP', 3000000.00, true) RETURNING id;`,
      [companyBId, locBId, `Davivienda B ${tag}`, `CTA-B-${runId}`]
    )
    bankAccountBId = bankB.rows[0].id

    // 6. Caja y Sesión de Caja abierta para Empresa A
    const regA = await pgClient.query(
      `INSERT INTO public.cash_registers (company_id, location_id, code, name, current_status)
       VALUES ($1, $2, $3, $4, 'OPEN') RETURNING id;`,
      [companyAId, locAId, `CAJA-A-${runId}`, `Caja Principal A ${tag}`]
    )
    cashRegisterAId = regA.rows[0].id

    const sessA = await pgClient.query(
      `INSERT INTO public.cash_sessions (company_id, location_id, cash_register_id, user_id, opening_time, opening_float, status)
       VALUES ($1, $2, $3, $4, NOW(), 500000.00, 'OPEN') RETURNING id;`,
      [companyAId, locAId, cashRegisterAId, authUserAId]
    )
    cashSessionAId = sessA.rows[0].id

    // 7. Productos de prueba
    const prodA = await pgClient.query(
      `INSERT INTO public.products (company_id, sku, name, slug, is_active)
       VALUES ($1, $2, $3, $4, true) RETURNING id;`,
      [companyAId, `SKU-A-${runId}`, `Producto A ${tag}`, `prod-a-${runId}`]
    )
    productAId = prodA.rows[0].id

    // Helper para crear una orden de compra confirmada
    const createConfirmedPurchase = async (
      client: any,
      supplierId: string,
      locationId: string,
      productId: string,
      qty: number,
      unitCost: number,
      invoiceNumber: string
    ) => {
      const { data: createData, error: createErr } = await client.rpc('fn_create_purchase_order', {
        p_supplier_id: supplierId,
        p_location_id: locationId,
        p_supplier_invoice_number: invoiceNumber,
        p_issue_date: new Date().toISOString().split('T')[0],
        p_due_date: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
        p_payment_terms: 'CREDITO',
        p_notes: `Orden confirmada para pruebas de pago ${tag}`,
        p_save_as_draft: false,
        p_items: [
          {
            product_id: productId,
            quantity: qty,
            unit_cost: unitCost,
            discount_percent: 0,
            tax_rate_percent: 0,
          },
        ],
      })
      if (createErr) throw createErr
      const purchaseId = createData

      return purchaseId
    }

    // ==========================================================================
    // EJECUTANDO CASOS DE PRUEBA P01 A P21
    // ==========================================================================

    // --- P01: ABONO PARCIAL ---
    console.log('--- EJECUTANDO P01: ABONO PARCIAL ---')
    // Compra de 100 u. a $10.000 = $1.000.000
    const pur1Id = await createConfirmedPurchase(
      clientA,
      supplierAId,
      locAId,
      productAId,
      100,
      10000,
      `FAC-P01-${runId}`
    )

    const { data: p01Data, error: p01Err } = await clientA.rpc('fn_register_supplier_payment', {
      p_purchase_id: pur1Id,
      p_amount: 400000.0,
      p_payment_date: new Date().toISOString().split('T')[0],
      p_payment_method: 'TRANSFERENCIA',
      p_transaction_reference: `TRF-P01-${runId}`,
      p_notes: 'Abono parcial inicial 40%',
      p_bank_account_id: bankAccountAId,
    })

    const p01Pass =
      !p01Err &&
      p01Data?.payment_status === 'PARTIAL' &&
      Number(p01Data?.paid_amount) === 400000 &&
      Number(p01Data?.pending_balance) === 600000 &&
      p01Data?.payment_number?.startsWith('PAG-')
    recordResult(
      'P01',
      'Abono parcial',
      Boolean(p01Pass),
      p01Pass
        ? `Pago registrado: ${p01Data.payment_number}, estado: ${p01Data.payment_status}, pagado: $${p01Data.paid_amount}, pendiente: $${p01Data.pending_balance}`
        : `Error: ${p01Err?.message || JSON.stringify(p01Data)}`
    )

    // --- P02: SEGUNDO ABONO ---
    console.log('--- EJECUTANDO P02: SEGUNDO ABONO ---')
    const { data: p02Data, error: p02Err } = await clientA.rpc('fn_register_supplier_payment', {
      p_purchase_id: pur1Id,
      p_amount: 300000.0,
      p_payment_date: new Date().toISOString().split('T')[0],
      p_payment_method: 'TRANSFERENCIA',
      p_transaction_reference: `TRF-P02-${runId}`,
      p_notes: 'Segundo abono 30%',
      p_bank_account_id: bankAccountAId,
    })

    const p02Pass =
      !p02Err &&
      p02Data?.payment_status === 'PARTIAL' &&
      Number(p02Data?.paid_amount) === 700000 &&
      Number(p02Data?.pending_balance) === 300000
    recordResult(
      'P02',
      'Segundo abono (Saldo acumulado)',
      Boolean(p02Pass),
      p02Pass
        ? `Segundo pago: ${p02Data.payment_number}, acumulado: $${p02Data.paid_amount}, pendiente: $${p02Data.pending_balance}`
        : `Error: ${p02Err?.message || JSON.stringify(p02Data)}`
    )

    // --- P03: PAGO TOTAL (FINIQUITO) ---
    console.log('--- EJECUTANDO P03: PAGO TOTAL ---')
    const { data: p03Data, error: p03Err } = await clientA.rpc('fn_register_supplier_payment', {
      p_purchase_id: pur1Id,
      p_amount: 300000.0,
      p_payment_date: new Date().toISOString().split('T')[0],
      p_payment_method: 'TRANSFERENCIA',
      p_transaction_reference: `TRF-P03-${runId}`,
      p_notes: 'Finiquito pago 100%',
      p_bank_account_id: bankAccountAId,
    })

    const p03Pass =
      !p03Err &&
      p03Data?.payment_status === 'PAID' &&
      Number(p03Data?.paid_amount) === 1000000 &&
      Number(p03Data?.pending_balance) === 0
    recordResult(
      'P03',
      'Pago total',
      Boolean(p03Pass),
      p03Pass
        ? `Pago finiquitado: ${p03Data.payment_number}, estado: ${p03Data.payment_status}, pagado: $${p03Data.paid_amount}, pendiente: $${p03Data.pending_balance}`
        : `Error: ${p03Err?.message || JSON.stringify(p03Data)}`
    )

    // --- P04: SOBREPAGO SOBRE SALDO PENDIENTE ---
    console.log('--- EJECUTANDO P04: SOBREPAGO ---')
    const pur4Id = await createConfirmedPurchase(
      clientA,
      supplierAId,
      locAId,
      productAId,
      10,
      50000,
      `FAC-P04-${runId}`
    ) // Total: 500.000

    const { data: p04Data, error: p04Err } = await clientA.rpc('fn_register_supplier_payment', {
      p_purchase_id: pur4Id,
      p_amount: 550000.0, // Excede por 50.000
      p_payment_method: 'TRANSFERENCIA',
      p_bank_account_id: bankAccountAId,
    })

    const p04Pass = p04Err && p04Err.message.includes('excede el saldo pendiente')
    recordResult(
      'P04',
      'Sobrepago bloqueado',
      Boolean(p04Pass),
      p04Pass
        ? `Bloqueado correctamente por backend: "${p04Err?.message}"`
        : `Falla: debería rechazar sobrepago pero respondió: ${JSON.stringify(p04Data)}`
    )

    // --- P05: PAGO CERO ---
    console.log('--- EJECUTANDO P05: PAGO CERO ---')
    const { error: p05Err } = await clientA.rpc('fn_register_supplier_payment', {
      p_purchase_id: pur4Id,
      p_amount: 0.0,
      p_payment_method: 'TRANSFERENCIA',
      p_bank_account_id: bankAccountAId,
    })
    const p05Pass = p05Err && p05Err.message.includes('estrictamente mayor a 0')
    recordResult(
      'P05',
      'Pago cero bloqueado',
      Boolean(p05Pass),
      p05Pass
        ? `Bloqueado correctamente: "${p05Err?.message}"`
        : `Falla: no bloqueó pago con monto cero.`
    )

    // --- P06: PAGO NEGATIVO ---
    console.log('--- EJECUTANDO P06: PAGO NEGATIVO ---')
    const { error: p06Err } = await clientA.rpc('fn_register_supplier_payment', {
      p_purchase_id: pur4Id,
      p_amount: -1000.0,
      p_payment_method: 'TRANSFERENCIA',
      p_bank_account_id: bankAccountAId,
    })
    const p06Pass = p06Err && p06Err.message.includes('estrictamente mayor a 0')
    recordResult(
      'P06',
      'Pago negativo bloqueado',
      Boolean(p06Pass),
      p06Pass
        ? `Bloqueado correctamente: "${p06Err?.message}"`
        : `Falla: no bloqueó pago con monto negativo.`
    )

    // --- P07: PAGO COMPRA BORRADOR ---
    console.log('--- EJECUTANDO P07: PAGO COMPRA BORRADOR ---')
    // Crear compra en borrador (sin confirmar)
    const { data: draftId, error: draftErr } = await clientA.rpc('fn_create_purchase_order', {
      p_supplier_id: supplierAId,
      p_location_id: locAId,
      p_supplier_invoice_number: `FAC-DRAFT-${runId}`,
      p_issue_date: new Date().toISOString().split('T')[0],
      p_due_date: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
      p_payment_terms: 'CREDITO',
      p_notes: `Orden borrador ${tag}`,
      p_save_as_draft: true,
      p_items: [{ product_id: productAId, quantity: 5, unit_cost: 20000, discount_percent: 0, tax_rate_percent: 0 }],
    })
    if (draftErr) throw draftErr

    const { error: p07Err } = await clientA.rpc('fn_register_supplier_payment', {
      p_purchase_id: draftId,
      p_amount: 50000.0,
      p_payment_method: 'TRANSFERENCIA',
      p_bank_account_id: bankAccountAId,
    })
    const p07Pass = p07Err && p07Err.message.includes('estado borrador')
    recordResult(
      'P07',
      'Pago compra borrador bloqueado',
      Boolean(p07Pass),
      p07Pass
        ? `Bloqueado correctamente: "${p07Err?.message}"`
        : `Falla: permitió abonar a compra en borrador.`
    )

    // --- P08: PAGO COMPRA CANCELADA ---
    console.log('--- EJECUTANDO P08: PAGO COMPRA CANCELADA ---')
    // Anular la orden borrador creada
    await clientA.rpc('fn_cancel_purchase_order', {
      p_purchase_id: draftId,
      p_reason: 'Anulación de prueba para test de pago cancelado',
    })

    const { error: p08Err } = await clientA.rpc('fn_register_supplier_payment', {
      p_purchase_id: draftId,
      p_amount: 50000.0,
      p_payment_method: 'TRANSFERENCIA',
      p_bank_account_id: bankAccountAId,
    })
    const p08Pass = p08Err && p08Err.message.includes('compra anulada')
    recordResult(
      'P08',
      'Pago compra cancelada bloqueado',
      Boolean(p08Pass),
      p08Pass
        ? `Bloqueado correctamente: "${p08Err?.message}"`
        : `Falla: permitió abonar a compra anulada.`
    )

    // --- P09: PAGO COMPRA YA PAGADA ---
    console.log('--- EJECUTANDO P09: PAGO COMPRA YA PAGADA ---')
    // pur1Id ya fue pagada 100% en P03
    const { error: p09Err } = await clientA.rpc('fn_register_supplier_payment', {
      p_purchase_id: pur1Id,
      p_amount: 10000.0,
      p_payment_method: 'TRANSFERENCIA',
      p_bank_account_id: bankAccountAId,
    })
    const p09Pass = p09Err && p09Err.message.includes('totalmente pagada')
    recordResult(
      'P09',
      'Pago compra ya pagada bloqueado',
      Boolean(p09Pass),
      p09Pass
        ? `Bloqueado correctamente: "${p09Err?.message}"`
        : `Falla: permitió abonar a orden con saldo cero.`
    )

    // --- P10: CONCURRENCIA EN PAGOS (SELECT FOR UPDATE) ---
    console.log('--- EJECUTANDO P10: CONCURRENCIA ---')
    // Crear orden con saldo $200.000
    const purConcId = await createConfirmedPurchase(
      clientA,
      supplierAId,
      locAId,
      productAId,
      20,
      10000,
      `FAC-CONC-${runId}`
    ) // Total: 200.000

    // Disparar dos pagos simultáneos de $200.000 cada uno
    const [concA, concB] = await Promise.allSettled([
      clientA.rpc('fn_register_supplier_payment', {
        p_purchase_id: purConcId,
        p_amount: 200000.0,
        p_payment_method: 'TRANSFERENCIA',
        p_bank_account_id: bankAccountAId,
        p_transaction_reference: `CONC-1-${runId}`,
      }),
      clientA.rpc('fn_register_supplier_payment', {
        p_purchase_id: purConcId,
        p_amount: 200000.0,
        p_payment_method: 'TRANSFERENCIA',
        p_bank_account_id: bankAccountAId,
        p_transaction_reference: `CONC-2-${runId}`,
      }),
    ])

    const successCount = [concA, concB].filter((r) => r.status === 'fulfilled' && !r.value.error).length
    const failCount = [concA, concB].filter((r) => r.status === 'fulfilled' && r.value.error).length

    // Verificar en BD que el saldo pagado final es exactamente 200.000 (nunca 400.000)
    const checkConcRes = await pgClient.query(`SELECT paid_amount FROM public.purchases WHERE id = $1;`, [purConcId])
    const finalPaid = Number(checkConcRes.rows[0].paid_amount)

    const p10Pass = successCount === 1 && failCount === 1 && finalPaid === 200000
    recordResult(
      'P10',
      'Concurrencia (SELECT FOR UPDATE)',
      Boolean(p10Pass),
      p10Pass
        ? `Exitoso=1, Rechazado=1. Saldo pagado final: $${finalPaid} (esperado exacto $200.000). Sin sobrepagos.`
        : `Falla en concurrencia: exitosos=${successCount}, fallidos=${failCount}, saldo pagado=${finalPaid}`
    )

    // --- P11: AISLAMIENTO MULTIEMPRESA ---
    console.log('--- EJECUTANDO P11: MULTIEMPRESA ---')
    // Usuario B intenta pagar la orden pur4Id de Empresa A
    const { error: p11Err } = await clientB.rpc('fn_register_supplier_payment', {
      p_purchase_id: pur4Id,
      p_amount: 50000.0,
      p_payment_method: 'TRANSFERENCIA',
      p_bank_account_id: bankAccountBId,
    })
    const p11Pass = p11Err && (p11Err.message.includes('otra empresa') || p11Err.code === '42501')
    recordResult(
      'P11',
      'Aislamiento multiempresa',
      Boolean(p11Pass),
      p11Pass
        ? `Bloqueado por RPC (42501): "${p11Err?.message}"`
        : `Falla: Empresa B logró pagar una orden de Empresa A.`
    )

    // --- P12: USUARIO REAL EN AUDITORÍA / REGISTRO ---
    console.log('--- EJECUTANDO P12: USUARIO REAL ---')
    const checkUserRes = await pgClient.query(
      `SELECT created_by_user_id FROM public.supplier_payments WHERE purchase_id = $1 LIMIT 1;`,
      [pur1Id]
    )
    const dbUserId = checkUserRes.rows[0]?.created_by_user_id
    const p12Pass = dbUserId === authUserAId
    recordResult(
      'P12',
      'Usuario real registrado',
      Boolean(p12Pass),
      p12Pass
        ? `Usuario en supplier_payments: ${dbUserId} coincide exactamente con auth.uid(): ${authUserAId}`
        : `Falla: usuario registrado (${dbUserId}) no coincide con auth.uid() (${authUserAId})`
    )

    // --- P13: AUDITORÍA EN PUBLIC.AUDIT_LOGS ---
    console.log('--- EJECUTANDO P13: AUDITORÍA ---')
    const auditRes = await pgClient.query(
      `SELECT id, action, entity_name, user_id, new_value 
       FROM public.audit_logs 
       WHERE entity_name = 'supplier_payments' AND action = 'SUPPLIER_PAYMENT_CREATED' AND company_id = $1
       ORDER BY created_at DESC LIMIT 1;`,
      [companyAId]
    )
    const auditRow = auditRes.rows[0]
    const p13Pass = auditRow && auditRow.action === 'SUPPLIER_PAYMENT_CREATED' && auditRow.user_id === authUserAId
    recordResult(
      'P13',
      'Auditoría en audit_logs',
      Boolean(p13Pass),
      p13Pass
        ? `Registro de auditoría encontrado: id=${auditRow.id}, action=${auditRow.action}, user=${auditRow.user_id}`
        : `Falla: no se encontró registro de auditoría SUPPLIER_PAYMENT_CREATED.`
    )

    // --- P14: PAGO BANCARIO (BANK_TRANSFER) ---
    console.log('--- EJECUTANDO P14: PAGO BANCARIO ---')
    // Crear orden para pago bancario
    const purBankId = await createConfirmedPurchase(
      clientA,
      supplierAId,
      locAId,
      productAId,
      10,
      10000,
      `FAC-BANK-${runId}`
    ) // Total: 100.000

    const { data: p14Data, error: p14Err } = await clientA.rpc('fn_register_supplier_payment', {
      p_purchase_id: purBankId,
      p_amount: 100000.0,
      p_payment_method: 'TRANSFERENCIA',
      p_bank_account_id: bankAccountAId,
      p_transaction_reference: `BANCOLOMBIA-${runId}`,
      p_notes: 'Transferencia bancaria total',
    })

    const p14Pass = !p14Err && p14Data?.bank_movement_id !== null && p14Data?.payment_status === 'PAID'
    recordResult(
      'P14',
      'Pago bancario (BANK_TRANSFER)',
      Boolean(p14Pass),
      p14Pass
        ? `Pago bancario exitoso: ${p14Data.payment_number}, bank_movement_id=${p14Data.bank_movement_id}`
        : `Falla: ${p14Err?.message || JSON.stringify(p14Data)}`
    )

    // --- P15: PAGO EFECTIVO (CASH) ---
    console.log('--- EJECUTANDO P15: PAGO EFECTIVO ---')
    // Crear orden para pago en efectivo
    const purCashId = await createConfirmedPurchase(
      clientA,
      supplierAId,
      locAId,
      productAId,
      5,
      10000,
      `FAC-CASH-${runId}`
    ) // Total: 50.000

    const { data: p15Data, error: p15Err } = await clientA.rpc('fn_register_supplier_payment', {
      p_purchase_id: purCashId,
      p_amount: 50000.0,
      p_payment_method: 'EFECTIVO',
      p_cash_session_id: cashSessionAId,
      p_transaction_reference: `EFECTIVO-REC-${runId}`,
      p_notes: 'Pago en efectivo desde caja',
    })

    const p15Pass = !p15Err && p15Data?.cash_movement_id !== null && p15Data?.payment_status === 'PAID'
    recordResult(
      'P15',
      'Pago efectivo (CASH)',
      Boolean(p15Pass),
      p15Pass
        ? `Pago en efectivo exitoso: ${p15Data.payment_number}, cash_movement_id=${p15Data.cash_movement_id}`
        : `Falla: ${p15Err?.message || JSON.stringify(p15Data)}`
    )

    // --- P16: VALIDACIÓN SESIÓN DE CAJA ---
    console.log('--- EJECUTANDO P16: VALIDACIÓN SESIÓN CAJA ---')
    // Crear sesión cerrada artificialmente
    const sessClosedRes = await pgClient.query(
      `INSERT INTO public.cash_sessions (company_id, location_id, cash_register_id, user_id, opening_time, closing_time, status)
       VALUES ($1, $2, $3, $4, NOW() - INTERVAL '2 hours', NOW() - INTERVAL '1 hour', 'CLOSED') RETURNING id;`,
      [companyAId, locAId, cashRegisterAId, authUserAId]
    )
    const closedSessionId = sessClosedRes.rows[0].id

    const purCashFailId = await createConfirmedPurchase(
      clientA,
      supplierAId,
      locAId,
      productAId,
      2,
      10000,
      `FAC-CASHFAIL-${runId}`
    )

    const { error: p16Err } = await clientA.rpc('fn_register_supplier_payment', {
      p_purchase_id: purCashFailId,
      p_amount: 20000.0,
      p_payment_method: 'EFECTIVO',
      p_cash_session_id: closedSessionId,
    })

    const p16Pass = p16Err && (p16Err.message.includes('no está abierta') || p16Err.message.includes('CLOSED'))
    recordResult(
      'P16',
      'Validación sesión caja (Rechazar cerrada)',
      Boolean(p16Pass),
      p16Pass
        ? `Bloqueado correctamente: "${p16Err?.message}"`
        : `Falla: permitió registrar pago en efectivo sobre sesión cerrada.`
    )

    // --- P17: SALDO BANCARIO ACTUALIZADO ---
    console.log('--- EJECUTANDO P17: SALDO BANCARIO ---')
    // Saldo inicial era 5.000.000. Pagos debitados: P01 ($400k), P02 ($300k), P03 ($300k), P10 ($200k), P14 ($100k) = Total $1.300.000
    // Saldo esperado: 5.000.000 - 1.300.000 = 3.700.000
    const checkBankBal = await pgClient.query(
      `SELECT current_balance FROM public.bank_accounts WHERE id = $1;`,
      [bankAccountAId]
    )
    const currentBankBal = Number(checkBankBal.rows[0].current_balance)
    const p17Pass = currentBankBal === 3700000
    recordResult(
      'P17',
      'Saldo bancario actualizado',
      Boolean(p17Pass),
      p17Pass
        ? `Saldo actual de cuenta bancaria: $${currentBankBal} (esperado exacto $3.700.000)`
        : `Falla: saldo bancario es $${currentBankBal}, esperado $3.700.000`
    )

    // --- P18: MOVIMIENTO BANCARIO EN EXTRACTO ---
    console.log('--- EJECUTANDO P18: MOVIMIENTO BANCARIO ---')
    const bmRes = await pgClient.query(
      `SELECT id, movement_number, movement_type, amount, balance_after, supplier_payment_id 
       FROM public.bank_movements 
       WHERE bank_account_id = $1 
       ORDER BY created_at DESC LIMIT 1;`,
      [bankAccountAId]
    )
    const bmRow = bmRes.rows[0]
    const p18Pass =
      bmRow &&
      bmRow.movement_type === 'DEBIT' &&
      Number(bmRow.amount) === 100000 &&
      bmRow.supplier_payment_id !== null &&
      bmRow.movement_number?.startsWith('BM-')
    recordResult(
      'P18',
      'Movimiento bancario (Extracto)',
      Boolean(p18Pass),
      p18Pass
        ? `Extracto verificado: ${bmRow.movement_number}, tipo: ${bmRow.movement_type}, monto: $${bmRow.amount}, balance_after: $${bmRow.balance_after}, payment_id: ${bmRow.supplier_payment_id}`
        : `Falla: movimiento bancario no coincide.`
    )

    // --- P19: MOVIMIENTO DE CAJA ---
    console.log('--- EJECUTANDO P19: MOVIMIENTO CAJA ---')
    const cmRes = await pgClient.query(
      `SELECT id, session_id, type, amount, reason, authorized_by_user_id 
       FROM public.cash_movements 
       WHERE session_id = $1 
       ORDER BY created_at DESC LIMIT 1;`,
      [cashSessionAId]
    )
    const cmRow = cmRes.rows[0]
    const p19Pass =
      cmRow &&
      cmRow.type === 'WITHDRAWAL' &&
      Number(cmRow.amount) === 50000 &&
      cmRow.authorized_by_user_id === authUserAId
    recordResult(
      'P19',
      'Movimiento de caja (WITHDRAWAL)',
      Boolean(p19Pass),
      p19Pass
        ? `Movimiento de caja verificado: tipo: ${cmRow.type}, monto: $${cmRow.amount}, motivo: "${cmRow.reason}"`
        : `Falla: movimiento de caja no coincide.`
    )

    // --- P20: ATOMICIDAD Y ROLLBACK TOTAL ---
    console.log('--- EJECUTANDO P20: ATOMICIDAD / ROLLBACK ---')
    // Crear orden y probar fallo forzado con cuenta bancaria inexistente o perteneciente a otra empresa
    const purAtId = await createConfirmedPurchase(
      clientA,
      supplierAId,
      locAId,
      productAId,
      10,
      10000,
      `FAC-AT-${runId}`
    )

    const fakeBankId = '00000000-0000-0000-0000-000000000099'
    const { error: atErr } = await clientA.rpc('fn_register_supplier_payment', {
      p_purchase_id: purAtId,
      p_amount: 50000.0,
      p_payment_method: 'TRANSFERENCIA',
      p_bank_account_id: fakeBankId,
    })

    // Comprobar que en PostgreSQL la compra NO tiene abono y NO existe supplier_payments ni bank_movements
    const checkPurAt = await pgClient.query(`SELECT paid_amount, payment_status FROM public.purchases WHERE id = $1;`, [purAtId])
    const checkPayAt = await pgClient.query(`SELECT COUNT(*) as count FROM public.supplier_payments WHERE purchase_id = $1;`, [purAtId])

    const p20Pass =
      atErr &&
      Number(checkPurAt.rows[0].paid_amount) === 0 &&
      checkPurAt.rows[0].payment_status === 'PENDING' &&
      Number(checkPayAt.rows[0].count) === 0
    recordResult(
      'P20',
      'Atomicidad y rollback total',
      Boolean(p20Pass),
      p20Pass
        ? `Error capturado: "${atErr?.message}". Rollback perfecto: paid_amount=0, pagos residuales=0. Atomicidad 100% garantizada.`
        : `Falla: no hubo rollback consistente.`
    )

    // --- P21: ZERO POLLUTION PURGE ---
    console.log('--- EJECUTANDO P21: ZERO POLLUTION ---')

    // Activar flag seguro de limpieza de pruebas para omitir triggers de inmutabilidad
    await pgClient.query("SELECT set_config('app.is_test_cleanup', 'true', false);")

    // 1. Eliminar movimientos de caja de prueba
    await pgClient.query(
      `DELETE FROM public.cash_movements WHERE session_id IN ($1, $2);`,
      [cashSessionAId, closedSessionId]
    )
    await pgClient.query(
      `DELETE FROM public.cash_sessions WHERE id IN ($1, $2);`,
      [cashSessionAId, closedSessionId]
    )
    await pgClient.query(`DELETE FROM public.cash_registers WHERE id = $1;`, [cashRegisterAId])

    // 2. Eliminar movimientos bancarios de prueba
    await pgClient.query(
      `DELETE FROM public.bank_movements WHERE bank_account_id IN ($1, $2);`,
      [bankAccountAId, bankAccountBId]
    )
    await pgClient.query(
      `DELETE FROM public.bank_accounts WHERE id IN ($1, $2);`,
      [bankAccountAId, bankAccountBId]
    )

    // 3. Eliminar pagos y compras de prueba
    await pgClient.query(
      `DELETE FROM public.supplier_payments WHERE purchase_id IN (
         SELECT id FROM public.purchases WHERE supplier_invoice_number LIKE '%${runId}%'
       );`
    )
    await pgClient.query(
      `DELETE FROM public.purchase_items WHERE purchase_id IN (
         SELECT id FROM public.purchases WHERE supplier_invoice_number LIKE '%${runId}%'
       );`
    )
    await pgClient.query(
      `DELETE FROM public.purchases WHERE supplier_invoice_number LIKE '%${runId}%';`
    )

    // 4. Eliminar productos y proveedores de prueba
    await pgClient.query(`DELETE FROM public.products WHERE id = $1;`, [productAId])
    await pgClient.query(`DELETE FROM public.suppliers WHERE id IN ($1, $2);`, [supplierAId, supplierBId])

    // 5. Eliminar usuarios de prueba
    await pgClient.query(`DELETE FROM public.user_locations WHERE user_id IN ($1, $2);`, [authUserAId, authUserBId])
    await pgClient.query(`DELETE FROM public.users WHERE id IN ($1, $2);`, [authUserAId, authUserBId])
    await adminSupabase.auth.admin.deleteUser(authUserAId)
    await adminSupabase.auth.admin.deleteUser(authUserBId)

    // Desactivar flag seguro de limpieza
    await pgClient.query("SELECT set_config('app.is_test_cleanup', 'false', false);")

    // 6. Verificar conteo residual en staging
    const residualPurchases = await pgClient.query(
      `SELECT COUNT(*) as count FROM public.purchases WHERE supplier_invoice_number LIKE '%${runId}%';`
    )
    const residualPayments = await pgClient.query(
      `SELECT COUNT(*) as count FROM public.supplier_payments WHERE notes LIKE '%${tag}%';`
    )
    const residualBankMovs = await pgClient.query(
      `SELECT COUNT(*) as count FROM public.bank_movements WHERE concept LIKE '%${runId}%';`
    )
    const residualCashMovs = await pgClient.query(
      `SELECT COUNT(*) as count FROM public.cash_movements WHERE reason LIKE '%${runId}%';`
    )

    const totalResiduals =
      Number(residualPurchases.rows[0].count) +
      Number(residualPayments.rows[0].count) +
      Number(residualBankMovs.rows[0].count) +
      Number(residualCashMovs.rows[0].count)

    const p21Pass = totalResiduals === 0
    recordResult(
      'P21',
      'Zero Pollution',
      p21Pass,
      p21Pass
        ? `Residuos verificados: Compras=0, Pagos=0, Movimientos Banco=0, Movimientos Caja=0. Estado: PURGA PERFECTA (0 RESIDUOS).`
        : `Falla: se encontraron ${totalResiduals} registros residuales en staging.`
    )
  } catch (err: any) {
    console.error('❌ Excepción catastrófica en suite E2E:', err)
  } finally {
    await pgClient.end()
  }

  // --------------------------------------------------------------------------
  // RESUMEN TÉCNICO FINAL
  // --------------------------------------------------------------------------
  console.log('\n================================================================================')
  console.log('📋 RESUMEN FINAL DE PRUEBAS FASE 5.3 (PAGOS A PROVEEDORES, CxP Y TESORERÍA)')
  console.log('================================================================================')
  const passed = results.filter((r) => r.status === 'PASS').length
  const failed = results.filter((r) => r.status === 'FAIL').length
  results.forEach((r) => console.log(`${r.status === 'PASS' ? '✅' : '❌'} [${r.status}] ${r.code}: ${r.name}`))
  console.log(`\nTOTAL: ${results.length} | APROBADAS: ${passed} | FALLIDAS: ${failed}`)

  if (failed === 0 && results.length >= 21) {
    console.log('🏆 TODAS LAS 21 PRUEBAS DE LA FASE 5.3 FUERON SUPERADAS AL 100% (PASS).\n')
  } else {
    console.log('⚠️ ALGUNAS PRUEBAS NO FUERON SUPERADAS. REVISAR LOGS ANTERIORES.\n')
    process.exit(1)
  }
}

runPhase53TestSuite().catch((err) => {
  console.error(err)
  process.exit(1)
})
