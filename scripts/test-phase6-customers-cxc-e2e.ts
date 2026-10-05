/**
 * ==============================================================================
 * SUITE DE PRUEBAS E2E FASE 6 — CLIENTES, CUENTAS POR COBRAR (CxC) Y RECAUDOS
 * ERP SUPER MÁS S.A.S. - PostgreSQL / Supabase Staging
 * ==============================================================================
 * 
 * Verifica con rigor absoluto:
 * 1. Clientes reales en PostgreSQL: Crear, editar, consultar, inactivar.
 * 2. Cuentas por Cobrar (CxC): Venta a crédito, saldo pendiente, estado de cuenta.
 * 3. RPC Atómica fn_register_customer_payment:
 *    - Abonos parciales y pago total.
 *    - Prevención de sobrepago.
 *    - Bloqueo de pagos con monto <= 0.
 *    - Bloqueo de pagos a ventas anuladas o ya pagadas.
 *    - Concurrencia y bloqueo pesimista (SELECT FOR UPDATE / Advisory Locks).
 *    - Aislamiento multiempresa estricto.
 *    - Integración atómica con Tesorería (Caja POS y Extracto Bancario).
 *    - Actualización coherente de cartera del cliente.
 *    - Auditoría transaccional en public.audit_logs.
 *    - Atomicidad y rollback total ante errores.
 *    - Zero Pollution (purga completa de datos de prueba).
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

async function runPhase6TestSuite() {
  console.log('================================================================================')
  console.log('🧪 INICIANDO SUITE DE PRUEBAS E2E FASE 6 — CLIENTES, CxC Y RECAUDOS')
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
  const tag = `TEST-P6-${runId}`

  let companyAId = ''
  let companyBId = ''
  let locAId = ''
  let locBId = ''
  let authUserAId = ''
  let authUserBId = ''
  let emailA = `cxc.userA.${runId}@supermas.test`
  let emailB = `cxc.userB.${runId}@supermas.test`
  let userPassword = `PassTest.${runId}*Secure`

  let clientA: any
  let clientB: any

  let bankAccountAId = ''
  let bankAccountBId = ''
  let cashRegisterAId = ''
  let cashSessionAId = ''
  let closedSessionId = ''

  let customerAId = ''
  let customerBId = ''
  let productAId = ''

  try {
    // --------------------------------------------------------------------------
    // SETUP EMPRESAS, SEDES, USUARIOS Y ROLES
    // --------------------------------------------------------------------------
    console.log('--- SETUP BASE MULTI-TENANT & ENTIDADES STAGING ---')

    // 1. Resolver empresas existentes en Staging
    const compARes = await pgClient.query(
      `SELECT id FROM public.companies WHERE status = 'ACTIVE' ORDER BY created_at ASC LIMIT 1;`
    )
    if (compARes.rows.length === 0) {
      throw new Error('No hay empresas activas en staging.')
    }
    companyAId = compARes.rows[0].id

    const compBRes = await pgClient.query(
      `SELECT id FROM public.companies WHERE id != $1 AND status = 'ACTIVE' LIMIT 1;`,
      [companyAId]
    )
    if (compBRes.rows.length === 0) {
      throw new Error('No se encontró una segunda empresa activa para aislamiento multi-tenant.')
    }
    companyBId = compBRes.rows[0].id

    // 2. Ubicaciones (Sedes/Bodegas)
    const locARes = await pgClient.query(
      `SELECT id FROM public.locations WHERE company_id = $1 AND status = 'ACTIVE' LIMIT 1;`,
      [companyAId]
    )
    if (locARes.rows.length > 0) {
      locAId = locARes.rows[0].id
    } else {
      const insL = await pgClient.query(
        `INSERT INTO public.locations (company_id, code, name, type, status)
         VALUES ($1, $2, $3, 'STORE', 'ACTIVE') RETURNING id;`,
        [companyAId, `LOC-A-${runId}`, `Sede Principal A ${tag}`]
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
        `INSERT INTO public.locations (company_id, code, name, type, status)
         VALUES ($1, $2, $3, 'STORE', 'ACTIVE') RETURNING id;`,
        [companyBId, `LOC-B-${runId}`, `Sede Principal B ${tag}`]
      )
      locBId = insLB.rows[0].id
    }

    // Role ADMIN
    const roleRes = await pgClient.query(`SELECT id FROM public.roles WHERE code = 'ADMIN' LIMIT 1;`)
    const adminRoleId = roleRes.rows[0].id

    // Auth Users
    console.log('--- CREANDO USUARIOS EN SUPABASE AUTH ---')
    const createAuthUser = async (email: string, compId: string) => {
      const { data: userAuth, error: authErr } = await adminSupabase.auth.admin.createUser({
        email,
        password: userPassword,
        email_confirm: true,
        user_metadata: { full_name: `Gestor CxC ${email.split('@')[0]}`, company_id: compId, role: 'ADMIN' },
      })
      if (authErr) throw authErr

      await pgClient.query(
        `INSERT INTO public.users (id, email, full_name, role_id, company_id, is_active)
         VALUES ($1, $2, $3, $4, $5, true)
         ON CONFLICT (id) DO UPDATE SET company_id = $5, role_id = $4;`,
        [userAuth.user.id, email, `Gestor CxC ${email.split('@')[0]}`, adminRoleId, compId]
      )

      await pgClient.query(
        `INSERT INTO public.user_locations (user_id, location_id)
         VALUES ($1, $2) ON CONFLICT DO NOTHING;`,
        [userAuth.user.id, compId === companyAId ? locAId : locBId]
      )

      return userAuth.user.id
    }

    authUserAId = await createAuthUser(emailA, companyAId)
    authUserBId = await createAuthUser(emailB, companyBId)

    // Iniciar sesión y crear clientes Supabase autenticados
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

    // Cuentas Bancarias
    const bankA = await pgClient.query(
      `INSERT INTO public.bank_accounts (company_id, location_id, bank_name, account_number, account_type, current_balance, is_active)
       VALUES ($1, $2, 'Bancolombia Recaudos A', 'CTA-REC-A-${runId}', 'CORRIENTE', 1000000.00, true)
       RETURNING id;`,
      [companyAId, locAId]
    )
    bankAccountAId = bankA.rows[0].id

    const bankB = await pgClient.query(
      `INSERT INTO public.bank_accounts (company_id, location_id, bank_name, account_number, account_type, current_balance, is_active)
       VALUES ($1, $2, 'Davivienda B', 'CTA-REC-B-${runId}', 'CORRIENTE', 500000.00, true)
       RETURNING id;`,
      [companyBId, locBId]
    )
    bankAccountBId = bankB.rows[0].id

    // Cajas y Sesiones
    const cReg = await pgClient.query(
      `INSERT INTO public.cash_registers (company_id, location_id, name, code, current_status)
       VALUES ($1, $2, 'Caja Principal POS A', 'CAJA-A-${runId}', 'OPEN')
       RETURNING id;`,
      [companyAId, locAId]
    )
    cashRegisterAId = cReg.rows[0].id

    const cSessOpen = await pgClient.query(
      `INSERT INTO public.cash_sessions (company_id, location_id, cash_register_id, user_id, opening_time, opening_float, status)
       VALUES ($1, $2, $3, $4, NOW(), 200000.00, 'OPEN')
       RETURNING id;`,
      [companyAId, locAId, cashRegisterAId, authUserAId]
    )
    cashSessionAId = cSessOpen.rows[0].id

    const cSessClosed = await pgClient.query(
      `INSERT INTO public.cash_sessions (company_id, location_id, cash_register_id, user_id, opening_time, closing_time, opening_float, status)
       VALUES ($1, $2, $3, $4, NOW(), NOW(), 100000.00, 'CLOSED')
       RETURNING id;`,
      [companyAId, locAId, cashRegisterAId, authUserAId]
    )
    closedSessionId = cSessClosed.rows[0].id

    // Producto de prueba para ventas
    const prodRes = await pgClient.query(
      `INSERT INTO public.products (company_id, sku, name, slug, is_active)
       VALUES ($1, 'SKU-CXC-${runId}', 'Producto Prueba CxC ${tag}', 'prod-cxc-${runId}', true)
       RETURNING id;`,
      [companyAId]
    )
    productAId = prodRes.rows[0].id

    // Helper para crear venta a crédito en PostgreSQL
    const createCreditSale = async (
      client: any,
      companyId: string,
      locationId: string,
      customerId: string,
      saleNumber: string,
      totalAmount: number,
      dueDateDays: number = 30
    ) => {
      const dueDate = new Date(Date.now() + dueDateDays * 86400000).toISOString().split('T')[0]
      const { data, error } = await client
        .from('sales')
        .insert({
          company_id: companyId,
          location_id: locationId,
          customer_id: customerId,
          seller_user_id: authUserAId,
          cash_session_id: cashSessionAId,
          sale_number: saleNumber,
          total_amount: totalAmount,
          subtotal_amount: totalAmount,
          tax_amount: 0,
          discount_amount: 0,
          paid_amount: 0,
          payment_status: 'PENDING',
          payment_terms: 'CREDITO',
          payment_method: 'CREDIT',
          status: 'ISSUED',
          due_date: dueDate,
          notes: `Venta crédito para pruebas ${tag}`,
        })
        .select('id')
        .single()
      if (error) throw error

      // Incrementar saldo de cartera del cliente
      await pgClient.query(
        `UPDATE public.customers
         SET current_balance = COALESCE(current_balance, 0) + $1
         WHERE id = $2;`,
        [totalAmount, customerId]
      )

      return data.id as string
    }

    // ==========================================================================
    // EJECUTANDO CASOS DE PRUEBA C01 A C15
    // ==========================================================================

    // --- C01: CRUD CLIENTES (CREAR, EDITAR, CONSULTAR) ---
    console.log('--- EJECUTANDO C01: CRUD CLIENTES ---')
    const { data: createdCust, error: c01CreateErr } = await clientA
      .from('customers')
      .insert({
        company_id: companyAId,
        person_type: 'NATURAL',
        first_name: 'Carlos',
        last_name: `Gómez ${runId}`,
        document_type: 'CC',
        document_number: `1098${runId}`,
        phone: '3001234567',
        email: `carlos.${runId}@test.com`,
        address: 'Calle 10 # 20-30',
        city: 'Medellín',
        credit_limit: 5000000.00,
        credit_days: 30,
        current_balance: 0.00,
        is_active: true,
      })
      .select()
      .single()

    customerAId = createdCust?.id

    // Editar cliente
    const { data: updatedCust, error: c01UpdateErr } = await clientA
      .from('customers')
      .update({
        phone: '3119876543',
        credit_limit: 8000000.00,
      })
      .eq('id', customerAId)
      .select()
      .single()

    const c01Pass = !c01CreateErr && !c01UpdateErr && updatedCust?.phone === '3119876543' && Number(updatedCust?.credit_limit) === 8000000.00
    recordResult(
      'C01',
      'Clientes CRUD en PostgreSQL',
      c01Pass,
      c01Pass
        ? `Cliente creado (${createdCust.document_number}) y actualizado exitosamente. Cupo: $8.000.000.`
        : `Falla en CRUD clientes: ${c01CreateErr?.message || c01UpdateErr?.message}`
    )

    // Crear cliente de Empresa B para pruebas multiempresa
    const custBRes = await pgClient.query(
      `INSERT INTO public.customers (company_id, person_type, first_name, last_name, document_type, document_number, credit_limit, current_balance, is_active)
       VALUES ($1, 'COMPANY', 'Distribuidora B', '${tag}', 'NIT', '901${runId}', 10000000, 0, true)
       RETURNING id;`,
      [companyBId]
    )
    customerBId = custBRes.rows[0].id

    // --- C02: INACTIVAR Y REACTIVAR CLIENTE ---
    console.log('--- EJECUTANDO C02: INACTIVAR Y REACTIVAR CLIENTE ---')
    const { error: inactErr } = await clientA
      .from('customers')
      .update({ is_active: false })
      .eq('id', customerAId)

    const { data: inactCust } = await clientA.from('customers').select('is_active').eq('id', customerAId).single()
    const wasInactive = inactCust?.is_active === false

    const { error: reactErr } = await clientA
      .from('customers')
      .update({ is_active: true })
      .eq('id', customerAId)

    const { data: reactCust } = await clientA.from('customers').select('is_active').eq('id', customerAId).single()
    const wasReactivated = reactCust?.is_active === true

    const c02Pass = !inactErr && !reactErr && wasInactive && wasReactivated
    recordResult(
      'C02',
      'Inactivar y reactivar cliente',
      c02Pass,
      c02Pass
        ? `Inactivación (is_active: false) y reactivación (is_active: true) verificada en PostgreSQL.`
        : `Falla inactivando/reactivando cliente.`
    )

    // --- C03: VENTA A CRÉDITO Y SALDO DE CARTERA ---
    console.log('--- EJECUTANDO C03: VENTA A CRÉDITO Y SALDO INICIAL ---')
    // Venta 1: $1.000.000 a crédito
    const sale1Id = await createCreditSale(clientA, companyAId, locAId, customerAId, `VEN-CR-${runId}-1`, 1000000.00, 30)
    
    // Verificar que el saldo del cliente aumentó a $1.000.000
    const { data: custBalAfterSale } = await clientA.from('customers').select('current_balance').eq('id', customerAId).single()
    const c03Pass = Number(custBalAfterSale?.current_balance) === 1000000.00
    recordResult(
      'C03',
      'Venta a crédito y saldo inicial de cartera',
      c03Pass,
      c03Pass
        ? `Venta crédito creada (${sale1Id}), saldo cartera del cliente: $${custBalAfterSale.current_balance}.`
        : `Falla: saldo esperado $1.000.000, obtenido $${custBalAfterSale?.current_balance}`
    )

    // --- C04: ABONO PARCIAL EN EFECTIVO (RPC ATÓMICA) ---
    console.log('--- EJECUTANDO C04: ABONO PARCIAL EN EFECTIVO ---')
    // Abono de $400.000 en efectivo
    const { data: p01Data, error: p01Err } = await clientA.rpc('fn_register_customer_payment', {
      p_sale_id: sale1Id,
      p_amount: 400000.00,
      p_payment_method: 'EFECTIVO',
      p_cash_session_id: cashSessionAId,
      p_notes: `Primer abono parcial en efectivo ${tag}`,
    })
    if (p01Err) throw p01Err

    // Verificar venta
    const { data: sale1AfterP01 } = await clientA.from('sales').select('paid_amount, payment_status').eq('id', sale1Id).single()
    // Verificar cliente
    const { data: custAfterP01 } = await clientA.from('customers').select('current_balance').eq('id', customerAId).single()

    const c04Pass =
      p01Data?.payment_number?.startsWith('REC-') &&
      sale1AfterP01?.payment_status === 'PARTIAL' &&
      Number(sale1AfterP01?.paid_amount) === 400000.00 &&
      Number(custAfterP01?.current_balance) === 600000.00

    recordResult(
      'C04',
      'Abono parcial en efectivo (RPC atómica)',
      c04Pass,
      c04Pass
        ? `Recaudo registrado: ${p01Data.payment_number}, estado: PARTIAL, pagado venta: $400.000, saldo cartera cliente: $${custAfterP01.current_balance}.`
        : `Falla en abono parcial: ${JSON.stringify(sale1AfterP01)}`
    )

    // --- C05: SEGUNDO ABONO VÍA TRANSFERENCIA BANCARIA ---
    console.log('--- EJECUTANDO C05: SEGUNDO ABONO BANCARIO ---')
    // Abono de $300.000 bancario
    const { data: p02Data, error: p02Err } = await clientA.rpc('fn_register_customer_payment', {
      p_sale_id: sale1Id,
      p_amount: 300000.00,
      p_payment_method: 'TRANSFERENCIA',
      p_transaction_reference: `TRANS-${runId}`,
      p_bank_account_id: bankAccountAId,
      p_notes: `Segundo abono bancario ${tag}`,
    })
    if (p02Err) throw p02Err

    const { data: sale1AfterP02 } = await clientA.from('sales').select('paid_amount, payment_status').eq('id', sale1Id).single()
    const { data: custAfterP02 } = await clientA.from('customers').select('current_balance').eq('id', customerAId).single()

    const c05Pass =
      sale1AfterP02?.payment_status === 'PARTIAL' &&
      Number(sale1AfterP02?.paid_amount) === 700000.00 &&
      Number(custAfterP02?.current_balance) === 300000.00 &&
      Boolean(p02Data?.bank_movement_id)

    recordResult(
      'C05',
      'Segundo abono bancario (Saldo acumulado)',
      c05Pass,
      c05Pass
        ? `Segundo recaudo: ${p02Data.payment_number}, pagado acumulado: $700.000, saldo cartera cliente: $${custAfterP02.current_balance}.`
        : `Falla en segundo abono.`
    )

    // --- C06: PAGO TOTAL / FINIQUITO DE DEUDA ---
    console.log('--- EJECUTANDO C06: PAGO TOTAL ---')
    // Saldo restante es $300.000
    const { data: p03Data, error: p03Err } = await clientA.rpc('fn_register_customer_payment', {
      p_sale_id: sale1Id,
      p_amount: 300000.00,
      p_payment_method: 'TRANSFERENCIA',
      p_bank_account_id: bankAccountAId,
    })
    if (p03Err) throw p03Err

    const { data: sale1AfterP03 } = await clientA.from('sales').select('paid_amount, payment_status').eq('id', sale1Id).single()
    const { data: custAfterP03 } = await clientA.from('customers').select('current_balance').eq('id', customerAId).single()

    const c06Pass =
      sale1AfterP03?.payment_status === 'PAID' &&
      Number(sale1AfterP03?.paid_amount) === 1000000.00 &&
      Number(custAfterP03?.current_balance) === 0.00

    recordResult(
      'C06',
      'Pago total / Finiquito de deuda (PAID)',
      c06Pass,
      c06Pass
        ? `Venta finiquitada: ${p03Data.payment_number}, estado venta: PAID, saldo pendiente venta: $0, saldo cartera cliente: $0.`
        : `Falla en finiquito de deuda.`
    )

    // --- C07: SOBREPAGO BLOQUEADO ---
    console.log('--- EJECUTANDO C07: SOBREPAGO BLOQUEADO ---')
    // Crear venta 2 con saldo $500.000
    const sale2Id = await createCreditSale(clientA, companyAId, locAId, customerAId, `VEN-CR-${runId}-2`, 500000.00)
    // Intentar pagar $550.000
    const { error: overpayErr } = await clientA.rpc('fn_register_customer_payment', {
      p_sale_id: sale2Id,
      p_amount: 550000.00,
      p_payment_method: 'EFECTIVO',
      p_cash_session_id: cashSessionAId,
    })
    const c07Pass = overpayErr && overpayErr.message.includes('supera el saldo pendiente')
    recordResult(
      'C07',
      'Sobrepago bloqueado estrictamente',
      Boolean(c07Pass),
      c07Pass
        ? `Bloqueado por backend: "${overpayErr?.message}"`
        : `Falla: no bloqueó sobrepago.`
    )

    // --- C08: MONTO CERO Y NEGATIVO BLOQUEADOS ---
    console.log('--- EJECUTANDO C08: MONTO INVÁLIDO BLOQUEADO ---')
    const { error: zeroErr } = await clientA.rpc('fn_register_customer_payment', {
      p_sale_id: sale2Id,
      p_amount: 0,
      p_payment_method: 'EFECTIVO',
    })
    const { error: negErr } = await clientA.rpc('fn_register_customer_payment', {
      p_sale_id: sale2Id,
      p_amount: -10000,
      p_payment_method: 'EFECTIVO',
    })
    const c08Pass = zeroErr && negErr && zeroErr.message.includes('mayor a 0') && negErr.message.includes('mayor a 0')
    recordResult(
      'C08',
      'Monto cero y negativo bloqueados',
      Boolean(c08Pass),
      c08Pass
        ? `Ambos montos inválidos rechazados: "${zeroErr?.message}"`
        : `Falla: no bloqueó montos <= 0.`
    )

    // --- C09: PAGO VENTA ANULADA BLOQUEADO ---
    console.log('--- EJECUTANDO C09: PAGO VENTA ANULADA BLOQUEADO ---')
    const saleAnulId = await createCreditSale(clientA, companyAId, locAId, customerAId, `VEN-ANUL-${runId}`, 200000.00)
    // Anular venta
    await pgClient.query(`UPDATE public.sales SET status = 'CANCELLED' WHERE id = $1;`, [saleAnulId])

    const { error: anulErr } = await clientA.rpc('fn_register_customer_payment', {
      p_sale_id: saleAnulId,
      p_amount: 50000.00,
      p_payment_method: 'EFECTIVO',
      p_cash_session_id: cashSessionAId,
    })
    const c09Pass = anulErr && anulErr.message.includes('venta anulada')
    recordResult(
      'C09',
      'Pago a venta anulada bloqueado',
      Boolean(c09Pass),
      c09Pass
        ? `Bloqueado correctamente: "${anulErr?.message}"`
        : `Falla: permitió abonar a venta cancelada.`
    )

    // --- C10: PAGO A VENTA TOTALMENTE SALDADA BLOQUEADO ---
    console.log('--- EJECUTANDO C10: PAGO VENTA TOTALMENTE SALDADA BLOQUEADO ---')
    // sale1Id ya está 100% pagada
    const { error: paidErr } = await clientA.rpc('fn_register_customer_payment', {
      p_sale_id: sale1Id,
      p_amount: 10000.00,
      p_payment_method: 'TRANSFERENCIA',
      p_bank_account_id: bankAccountAId,
    })
    const c10Pass = paidErr && paidErr.message.includes('totalmente saldada')
    recordResult(
      'C10',
      'Pago a venta ya saldada bloqueado',
      Boolean(c10Pass),
      c10Pass
        ? `Bloqueado correctamente: "${paidErr?.message}"`
        : `Falla: permitió abonar a venta con saldo cero.`
    )

    // --- C11: CONCURRENCIA EN RECAUDOS (SELECT FOR UPDATE) ---
    console.log('--- EJECUTANDO C11: CONCURRENCIA EN RECAUDOS ---')
    const saleConcId = await createCreditSale(clientA, companyAId, locAId, customerAId, `VEN-CONC-${runId}`, 200000.00)
    // Dos pagos simultáneos compitiendo por $200.000 cada uno
    const [cResA, cResB] = await Promise.allSettled([
      clientA.rpc('fn_register_customer_payment', {
        p_sale_id: saleConcId,
        p_amount: 200000.00,
        p_payment_method: 'TRANSFERENCIA',
        p_bank_account_id: bankAccountAId,
      }),
      clientA.rpc('fn_register_customer_payment', {
        p_sale_id: saleConcId,
        p_amount: 200000.00,
        p_payment_method: 'TRANSFERENCIA',
        p_bank_account_id: bankAccountAId,
      }),
    ])

    const successCount = [cResA, cResB].filter((r) => r.status === 'fulfilled' && !r.value.error).length
    const rejectedCount = [cResA, cResB].filter((r) => r.status === 'fulfilled' && r.value.error).length

    const { data: finalConcSale } = await clientA.from('sales').select('paid_amount').eq('id', saleConcId).single()
    const c11Pass = successCount === 1 && rejectedCount === 1 && Number(finalConcSale?.paid_amount) === 200000.00

    recordResult(
      'C11',
      'Concurrencia fiduciaria (SELECT FOR UPDATE)',
      c11Pass,
      c11Pass
        ? `Exitoso=1, Rechazado=1. Saldo pagado final: $200.000 exactos. Sin sobrepagos ni condiciones de carrera.`
        : `Falla concurrencia: exitosos=${successCount}, rechazados=${rejectedCount}, pagado=${finalConcSale?.paid_amount}`
    )

    // --- C12: AISLAMIENTO MULTIEMPRESA ESTRICTO ---
    console.log('--- EJECUTANDO C12: AISLAMIENTO MULTIEMPRESA ---')
    // Usuario B intenta recaudar venta de Empresa A
    const { error: multiTenantErr } = await clientB.rpc('fn_register_customer_payment', {
      p_sale_id: sale2Id,
      p_amount: 100000.00,
      p_payment_method: 'TRANSFERENCIA',
      p_bank_account_id: bankAccountBId,
    })
    const c12Pass = multiTenantErr && multiTenantErr.message.includes('otra empresa')
    recordResult(
      'C12',
      'Aislamiento multiempresa estricto',
      Boolean(c12Pass),
      c12Pass
        ? `Bloqueado por RPC (42501): "${multiTenantErr?.message}"`
        : `Falla: permitió recaudar venta de otra empresa.`
    )

    // --- C13: INTEGRACIÓN CON TESORERÍA (EXTRACTO BANCARIO Y CAJA POS) ---
    console.log('--- EJECUTANDO C13: INTEGRACIÓN CON TESORERÍA ---')
    // Pagar $100.000 a sale2Id vía banco
    const { data: pBankData } = await clientA.rpc('fn_register_customer_payment', {
      p_sale_id: sale2Id,
      p_amount: 100000.00,
      p_payment_method: 'TRANSFERENCIA',
      p_bank_account_id: bankAccountAId,
      p_transaction_reference: `REF-BANCO-${runId}`,
    })

    // Pagar $50.000 a sale2Id vía efectivo
    const { data: pCashData } = await clientA.rpc('fn_register_customer_payment', {
      p_sale_id: sale2Id,
      p_amount: 50000.00,
      p_payment_method: 'EFECTIVO',
      p_cash_session_id: cashSessionAId,
    })

    // Verificar extracto bancario (CREDIT por ingreso)
    const { data: bankMov } = await clientA
      .from('bank_movements')
      .select('*')
      .eq('id', pBankData.bank_movement_id)
      .single()

    // Verificar movimiento de caja (SALE_CASH)
    const { data: cashMov } = await clientA
      .from('cash_movements')
      .select('*')
      .eq('id', pCashData.cash_movement_id)
      .single()

    const c13Pass =
      bankMov?.movement_type === 'CREDIT' &&
      Number(bankMov?.amount) === 100000.00 &&
      bankMov?.customer_payment_id === pBankData.payment_id &&
      cashMov?.type === 'SALE_CASH' &&
      Number(cashMov?.amount) === 50000.00 &&
      cashMov?.customer_payment_id === pCashData.payment_id

    recordResult(
      'C13',
      'Integración con Tesorería (Extracto bancario y Caja POS)',
      c13Pass,
      c13Pass
        ? `Extracto bancario generado (${bankMov?.movement_number}, CREDIT, $100.000). Movimiento de caja registrado (${cashMov?.type}, $50.000).`
        : `Falla en integración de tesorería: bankMov=${JSON.stringify(bankMov)}, cashMov=${JSON.stringify(cashMov)}`
    )

    // --- C14: AUDITORÍA EN AUDIT_LOGS Y ATOMICIDAD CON ROLLBACK ---
    console.log('--- EJECUTANDO C14: AUDITORÍA Y ATOMICIDAD ---')
    // Verificar auditoría
    const auditRes = await pgClient.query(
      `SELECT id, action, entity_name, user_id
       FROM public.audit_logs
       WHERE company_id = $1 AND entity_name = 'customer_payments'
       ORDER BY created_at DESC
       LIMIT 1;`,
      [companyAId]
    )
    const hasAudit =
      auditRes.rows.length > 0 &&
      ['CUSTOMER_PAYMENT_CREATED', 'RECEIVABLE_PAYMENT'].includes(auditRes.rows[0].action)

    // Probar atomicidad / rollback: pasar cuenta bancaria inexistente
    const fakeBankId = '00000000-0000-0000-0000-000000000000'
    const { data: preRollbackSale } = await clientA.from('sales').select('paid_amount').eq('id', sale2Id).single()
    const { error: atErr } = await clientA.rpc('fn_register_customer_payment', {
      p_sale_id: sale2Id,
      p_amount: 50000.00,
      p_payment_method: 'TRANSFERENCIA',
      p_bank_account_id: fakeBankId,
    })
    const { data: postRollbackSale } = await clientA.from('sales').select('paid_amount').eq('id', sale2Id).single()
    const isAtomic = atErr && Number(preRollbackSale.paid_amount) === Number(postRollbackSale.paid_amount)

    const c14Pass = hasAudit && isAtomic
    recordResult(
      'C14',
      'Auditoría transaccional y Rollback ante error',
      c14Pass,
      c14Pass
        ? `Auditoría verificada (id: ${auditRes.rows[0]?.id}, action: ${auditRes.rows[0]?.action}). Rollback perfecto ante error de cuenta bancaria inexistente.`
        : `Falla en auditoría o rollback: audit=${hasAudit}, atomic=${isAtomic}`
    )

    // --- C15: ZERO POLLUTION PURGE ---
    console.log('--- EJECUTANDO C15: ZERO POLLUTION ---')
    await pgClient.query("SELECT set_config('app.is_test_cleanup', 'true', false);")

    // Eliminar movimientos de caja y sesiones
    await pgClient.query(`DELETE FROM public.cash_movements WHERE session_id IN ($1, $2);`, [cashSessionAId, closedSessionId])
    await pgClient.query(`DELETE FROM public.cash_sessions WHERE id IN ($1, $2);`, [cashSessionAId, closedSessionId])
    await pgClient.query(`DELETE FROM public.cash_registers WHERE id = $1;`, [cashRegisterAId])

    // Eliminar movimientos bancarios y cuentas
    await pgClient.query(`DELETE FROM public.bank_movements WHERE bank_account_id IN ($1, $2);`, [bankAccountAId, bankAccountBId])
    await pgClient.query(`DELETE FROM public.bank_accounts WHERE id IN ($1, $2);`, [bankAccountAId, bankAccountBId])

    // Eliminar customer_payments y sales de prueba
    await pgClient.query(
      `DELETE FROM public.customer_payments WHERE company_id IN ($1, $2);`,
      [companyAId, companyBId]
    )
    await pgClient.query(
      `DELETE FROM public.sales WHERE company_id IN ($1, $2);`,
      [companyAId, companyBId]
    )

    // Eliminar clientes y productos
    await pgClient.query(`DELETE FROM public.customers WHERE id IN ($1, $2);`, [customerAId, customerBId])
    await pgClient.query(`DELETE FROM public.products WHERE id = $1;`, [productAId])

    // Eliminar usuarios y asignaciones
    await pgClient.query(`DELETE FROM public.user_locations WHERE user_id IN ($1, $2);`, [authUserAId, authUserBId])
    await pgClient.query(`DELETE FROM public.users WHERE id IN ($1, $2);`, [authUserAId, authUserBId])
    await adminSupabase.auth.admin.deleteUser(authUserAId)
    await adminSupabase.auth.admin.deleteUser(authUserBId)

    await pgClient.query("SELECT set_config('app.is_test_cleanup', 'false', false);")

    // Verificar conteo residual
    const resSales = await pgClient.query(`SELECT count(*) as count FROM public.sales WHERE sale_number LIKE '%${runId}%';`)
    const resPayments = await pgClient.query(`SELECT count(*) as count FROM public.customer_payments WHERE notes LIKE '%${tag}%';`)
    const resCusts = await pgClient.query(`SELECT count(*) as count FROM public.customers WHERE document_number LIKE '%${runId}%';`)
    const resProds = await pgClient.query(`SELECT count(*) as count FROM public.products WHERE sku LIKE '%${runId}%';`)

    const totalResiduals =
      Number(resSales.rows[0].count) +
      Number(resPayments.rows[0].count) +
      Number(resCusts.rows[0].count) +
      Number(resProds.rows[0].count)

    const c15Pass = totalResiduals === 0
    recordResult(
      'C15',
      'Zero Pollution (0 registros residuales en BD)',
      c15Pass,
      c15Pass
        ? `Residuos verificados: Ventas=0, Recaudos=0, Clientes=0, Productos=0. Purga 100% exitosa.`
        : `Falla: se encontraron ${totalResiduals} registros residuales.`
    )
  } catch (err: any) {
    console.error('❌ Excepción catastrófica en suite E2E Fase 6:', err)
    recordResult('FATAL', 'Ejecución Suite Fase 6', false, err.message)
  } finally {
    await pgClient.end()
  }

  // ---------------------------------------------------------------------------
  // REPORTE FINAL
  // ---------------------------------------------------------------------------
  console.log('\n================================================================================')
  console.log('📋 RESUMEN FINAL DE PRUEBAS FASE 6 (CLIENTES, CxC Y RECAUDOS)')
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
    console.log('🏆 TODAS LAS 15 PRUEBAS DE LA FASE 6 FUERON SUPERADAS AL 100% (PASS).\n')
  }
}

runPhase6TestSuite().catch((err) => {
  console.error('Fallo fatal:', err)
  process.exit(1)
})
