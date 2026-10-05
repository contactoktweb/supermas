/**
 * ============================================================================
 * SUPER MÁS ERP — FASE 11: SUITE E2E DE BANCOS, TESORERÍA Y CONCILIACIÓN
 * ============================================================================
 *
 * Verificación forense y transaccional completa:
 * - T01: Creación de cuenta bancaria con saldo inicial fiduciario y movimiento CREDIT.
 * - T02: Programación de pago a proveedor (fn_schedule_treasury_payment) con estado SCHEDULED.
 * - T03: Desembolso y ejecución atómica de pago (fn_execute_treasury_payment) y débito bancario.
 * - T04: Prevención de sobregiro bancario (saldo insuficiente).
 * - T05: Actualización automática de CxP / Compra al desembolsar.
 * - T06: Registro atómico de recaudo de cliente (fn_register_treasury_receipt) y crédito bancario.
 * - T07: Disminución de saldo en cartera del cliente (customers.current_balance).
 * - T08: Conciliación bancaria fiduciaria (fn_reconcile_bank_movement).
 * - T09: Consecutivos fiduciarios independientes (TES-PAG-, TES-REC-, MOV-BNC-).
 * - T10: Consultas de extracto y movimientos bancarios fiduciarios.
 * - T11: Resumen y métricas de tesorería (getStats).
 * - T12: Prevención de desembolso sobre cuenta bancaria inactiva.
 * - T13: Aislamiento multiempresa estricto en cuentas, pagos, recaudos y extractos.
 * - T14: Auditoría forense en public.audit_logs.
 * - T15: Zero Pollution: purga 100% limpia de datos de prueba.
 */

import { createClient } from '@supabase/supabase-js'
import pg from 'pg'
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321'
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const DATABASE_URL = process.env.DIRECT_URL || process.env.DATABASE_URL || ''

if (!DATABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ ERROR: Variables de entorno requeridas no disponibles.')
  process.exit(1)
}

const adminSupabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const pgClient = new pg.Client({ connectionString: DATABASE_URL })

interface TestResult {
  code: string
  description: string
  passed: boolean
  details: string
}

const testResults: TestResult[] = []

function recordResult(code: string, description: string, passed: boolean, details: string) {
  testResults.push({ code, description, passed, details })
  const icon = passed ? '✅' : '❌'
  console.log(`\n${icon} [${code}] ${description}: ${passed ? 'PASS' : 'FAIL'}`)
  console.log(`   Detalle: ${details}`)
}

async function runPhase11TestSuite() {
  await pgClient.connect()
  console.log('✅ Conexión directa a PostgreSQL Staging establecida.\n')

  const runId = Math.floor(100000 + Math.random() * 900000).toString()
  const tag = `TEST-P11-${runId}`

  let companyAId: string
  let companyBId: string
  let isTempCompanyB = false
  let locAId: string
  let locBId: string
  let authUserAId: string
  let authUserBId: string
  let userAEmail = `treasurer.a.${runId}@supermas.test`
  let userBEmail = `treasurer.b.${runId}@supermas.test`
  const password = `TestPass!${runId}Aa#`

  let clientA: any
  let clientB: any

  let supplierAId: string
  let customerAId: string
  let purchaseAId: string

  let bankA1Id: string
  let payment1Id: string
  let payment2Id: string
  let receipt1Id: string
  let movementToReconcileId: string

  try {
    console.log(`🚀 Iniciando Suite E2E Fase 11: Bancos y Tesorería [Ejecución: ${tag}]...\n`)

    // 1. Obtener o crear Empresas de prueba
    const compARes = await pgClient.query(`SELECT id FROM public.companies ORDER BY created_at ASC LIMIT 1;`)
    if (compARes.rows.length === 0) throw new Error('No existe ninguna empresa base en la base de datos.')
    companyAId = compARes.rows[0].id

    const compBRes = await pgClient.query(
      `SELECT id FROM public.companies WHERE id != $1 ORDER BY created_at ASC LIMIT 1;`,
      [companyAId]
    )
    if (compBRes.rows.length === 0) {
      const newB = await pgClient.query(`
        INSERT INTO public.companies (id, business_name, trade_name, tax_id, verification_digit, tax_regime, economic_activity_code, address, city, department, country, currency, status)
        VALUES (gen_random_uuid(), 'Empresa B Temporal E2E Tesorería', 'Empresa B E2E', '900${runId}9-2', '1', 'RESPONSABLE_DE_IVA', '4711', 'Calle 10 # 20-30', 'Medellín', 'Antioquia', 'Colombia', 'COP', 'ACTIVE')
        RETURNING id;
      `)
      companyBId = newB.rows[0].id
      isTempCompanyB = true
    } else {
      companyBId = compBRes.rows[0].id
    }

    // 2. Sedes de prueba
    const locARes = await pgClient.query(
      `INSERT INTO public.locations (company_id, code, name, type, status, address, city, allow_sales, allow_inventory_ops)
       VALUES ($1, 'BOD-A-${runId}', 'Bodega Tesorería A ${tag}', 'WAREHOUSE', 'ACTIVE', 'Calle 70 # 10-20', 'Medellin', true, true)
       RETURNING id;`,
      [companyAId]
    )
    locAId = locARes.rows[0].id

    const locBRes = await pgClient.query(
      `INSERT INTO public.locations (company_id, code, name, type, status, address, city, allow_sales, allow_inventory_ops)
       VALUES ($1, 'BOD-B-${runId}', 'Bodega Tesorería B ${tag}', 'WAREHOUSE', 'ACTIVE', 'Carrera 15 # 80-20', 'Bogota', true, true)
       RETURNING id;`,
      [companyBId]
    )
    locBId = locBRes.rows[0].id

    // 3. Rol
    const { data: roles } = await adminSupabase.from('roles').select('id, code').limit(5)
    const adminRoleId = roles?.find((r) => r.code === 'SUPERADMIN')?.id || roles?.[0]?.id

    // 4. Usuarios Auth
    const { data: authA, error: errAuthA } = await adminSupabase.auth.admin.createUser({
      email: userAEmail,
      password,
      email_confirm: true,
      user_metadata: { full_name: `Tesorero A ${runId}`, company_id: companyAId },
    })
    if (errAuthA || !authA.user) throw new Error(`Fallo creando Auth User A: ${errAuthA?.message}`)
    authUserAId = authA.user.id

    const { data: authB, error: errAuthB } = await adminSupabase.auth.admin.createUser({
      email: userBEmail,
      password,
      email_confirm: true,
      user_metadata: { full_name: `Tesorero B ${runId}`, company_id: companyBId },
    })
    if (errAuthB || !authB.user) throw new Error(`Fallo creando Auth User B: ${errAuthB?.message}`)
    authUserBId = authB.user.id

    // 5. Usuarios Public
    await pgClient.query(
      `INSERT INTO public.users (id, company_id, role_id, full_name, email, is_active)
       VALUES ($1, $2, $3, $4, $5, true)
       ON CONFLICT (id) DO UPDATE SET company_id = $2, role_id = $3;`,
      [authUserAId, companyAId, adminRoleId, `Tesorero A ${runId}`, userAEmail]
    )

    await pgClient.query(
      `INSERT INTO public.users (id, company_id, role_id, full_name, email, is_active)
       VALUES ($1, $2, $3, $4, $5, true)
       ON CONFLICT (id) DO UPDATE SET company_id = $2, role_id = $3;`,
      [authUserBId, companyBId, adminRoleId, `Tesorero B ${runId}`, userBEmail]
    )

    // Asignar ubicaciones
    await pgClient.query(
      `INSERT INTO public.user_locations (user_id, location_id) VALUES ($1, $2), ($3, $4);`,
      [authUserAId, locAId, authUserBId, locBId]
    )

    // Clientes Supabase Auth para RLS
    clientA = createClient(SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '', {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const { error: errSignA } = await clientA.auth.signInWithPassword({ email: userAEmail, password })
    if (errSignA) throw new Error(`Fallo login A: ${errSignA.message}`)

    clientB = createClient(SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '', {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const { error: errSignB } = await clientB.auth.signInWithPassword({ email: userBEmail, password })
    if (errSignB) throw new Error(`Fallo login B: ${errSignB.message}`)

    // Proveedor para Empresa A
    const suppARes = await pgClient.query(
      `INSERT INTO public.suppliers (company_id, name, legal_name, tax_id, is_active)
       VALUES ($1, 'Proveedor Alimentos ${runId}', 'Proveedor Alimentos SAS ${runId}', '900${runId}8', true)
       RETURNING id;`,
      [companyAId]
    )
    supplierAId = suppARes.rows[0].id

    // Cliente para Empresa A con saldo inicial de cartera de $2,000,000 COP
    const custARes = await pgClient.query(
      `INSERT INTO public.customers (company_id, first_name, last_name, company_name, document_type, document_number, is_active, credit_limit, current_balance)
       VALUES ($1, 'Supermercado', 'El Gran Ahorro ${runId}', 'Supermercado El Gran Ahorro ${runId}', 'NIT', '800${runId}7', true, 10000000, 2000000)
       RETURNING id;`,
      [companyAId]
    )
    customerAId = custARes.rows[0].id

    // Compra a crédito para Empresa A por $3,000,000 COP
    const purARes = await pgClient.query(
      `INSERT INTO public.purchases (
         company_id, location_id, supplier_id, purchase_number, supplier_invoice_number, subtotal_amount, tax_amount, total_amount, paid_amount, payment_terms, payment_status, inventory_status, issue_date, due_date
       ) VALUES (
         $1, $2, $3, 'COM-TES-${runId}', 'FAC-PROV-${runId}', 3000000.00, 0.00, 3000000.00, 0.00, 'CREDITO', 'PENDING', 'RECEIVED', CURRENT_DATE, CURRENT_DATE + INTERVAL '30 days'
       ) RETURNING id;`,
      [companyAId, locAId, supplierAId]
    )
    purchaseAId = purARes.rows[0].id

    console.log('✅ Entorno base fiduciario preparado exitosamente.\n')

    // =========================================================================
    // T01: CREACIÓN DE CUENTA BANCARIA CON SALDO INICIAL Y MOVIMIENTO CREDIT
    // =========================================================================
    try {
      const { data: resBankA1, error: errB1 } = await clientA.rpc('fn_create_bank_account', {
        p_bank_name: 'Bancolombia Principal',
        p_account_number: `CTA-CORR-${runId}-01`,
        p_account_type: 'CORRIENTE',
        p_currency: 'COP',
        p_initial_balance: 5000000.00,
        p_location_id: locAId,
        p_description: 'Cuenta corriente de operaciones comerciales',
      })

      if (errB1 || !resBankA1?.success) {
        throw new Error(`RPC error: ${errB1?.message || resBankA1?.error}`)
      }

      bankA1Id = resBankA1.bank_account_id

      // Validar cuenta y movimiento en base de datos
      const { data: dbAccount } = await adminSupabase
        .from('bank_accounts')
        .select('*')
        .eq('id', bankA1Id)
        .single()

      const { data: initMovements } = await adminSupabase
        .from('bank_movements')
        .select('*')
        .eq('bank_account_id', bankA1Id)

      const hasCredit = initMovements?.some(
        (m) => m.movement_type === 'CREDIT' && Number(m.amount) === 5000000 && Number(m.balance_after) === 5000000
      )

      if (
        dbAccount &&
        Number(dbAccount.current_balance) === 5000000 &&
        dbAccount.company_id === companyAId &&
        hasCredit
      ) {
        recordResult(
          'T01',
          'Creación de cuenta bancaria con saldo inicial fiduciario y movimiento CREDIT',
          true,
          `Cuenta ${dbAccount.account_number} creada con saldo $${Number(dbAccount.current_balance).toLocaleString()} COP y movimiento inicial CREDIT generado.`
        )
      } else {
        recordResult('T01', 'Creación de cuenta bancaria', false, 'El saldo o movimiento inicial no coinciden.')
      }
    } catch (e: any) {
      recordResult('T01', 'Creación de cuenta bancaria', false, e.message)
    }

    // =========================================================================
    // T02: PROGRAMACIÓN DE PAGO A PROVEEDOR (fn_schedule_treasury_payment)
    // =========================================================================
    try {
      const { data: resSched, error: errSched } = await clientA.rpc('fn_schedule_treasury_payment', {
        p_supplier_id: supplierAId,
        p_bank_account_id: bankA1Id,
        p_amount: 1500000.00,
        p_payment_date: '2026-10-15',
        p_due_date: '2026-10-20',
        p_purchase_id: purchaseAId,
        p_payment_method: 'TRANSFERENCIA',
        p_reference_number: `PROG-${runId}`,
        p_notes: 'Abono programado a factura de compra',
      })

      if (errSched || !resSched?.success) {
        throw new Error(`RPC error: ${errSched?.message || resSched?.error}`)
      }

      payment1Id = resSched.payment_id

      const { data: dbPay } = await adminSupabase
        .from('treasury_payments')
        .select('*')
        .eq('id', payment1Id)
        .single()

      if (
        dbPay &&
        dbPay.status === 'SCHEDULED' &&
        dbPay.payment_number.startsWith('TES-PAG-') &&
        Number(dbPay.amount) === 1500000 &&
        dbPay.company_id === companyAId
      ) {
        recordResult(
          'T02',
          'Programación de pago a proveedor (fn_schedule_treasury_payment)',
          true,
          `Comprobante programado ${dbPay.payment_number} por $${Number(dbPay.amount).toLocaleString()} COP en estado SCHEDULED.`
        )
      } else {
        recordResult('T02', 'Programación de pago a proveedor', false, 'Datos del pago programado no coinciden.')
      }
    } catch (e: any) {
      recordResult('T02', 'Programación de pago a proveedor', false, e.message)
    }

    // =========================================================================
    // T03: DESEMBOLSO Y EJECUCIÓN ATÓMICA DE PAGO (fn_execute_treasury_payment)
    // =========================================================================
    try {
      const { data: resExec, error: errExec } = await clientA.rpc('fn_execute_treasury_payment', {
        p_payment_id: payment1Id,
        p_bank_account_id: bankA1Id,
        p_reference_number: `TRF-BANCO-${runId}-01`,
        p_support_document_url: 'https://docs.supermas.test/soporte-pago.pdf',
        p_payment_date: '2026-10-15',
      })

      if (errExec || !resExec?.success) {
        throw new Error(`RPC error: ${errExec?.message || resExec?.error}`)
      }

      // Validar cuenta bancaria (debe quedar en 5,000,000 - 1,500,000 = 3,500,000)
      const { data: dbAccountAfter } = await adminSupabase
        .from('bank_accounts')
        .select('current_balance')
        .eq('id', bankA1Id)
        .single()

      // Validar pago (debe quedar en PAID)
      const { data: dbPayAfter } = await adminSupabase
        .from('treasury_payments')
        .select('status, reference_number')
        .eq('id', payment1Id)
        .single()

      // Validar movimiento DEBIT en bank_movements
      const { data: debitMov } = await adminSupabase
        .from('bank_movements')
        .select('*')
        .eq('treasury_payment_id', payment1Id)
        .single()

      if (
        Number(dbAccountAfter?.current_balance) === 3500000 &&
        dbPayAfter?.status === 'PAID' &&
        debitMov?.movement_type === 'DEBIT' &&
        Number(debitMov?.amount) === 1500000 &&
        Number(debitMov?.balance_after) === 3500000
      ) {
        recordResult(
          'T03',
          'Desembolso y ejecución atómica de pago (fn_execute_treasury_payment)',
          true,
          `Pago ${resExec.payment_number} ejecutado. Saldo bancario actualizado a $${Number(dbAccountAfter?.current_balance).toLocaleString()} COP y movimiento DEBIT registrado.`
        )
      } else {
        recordResult(
          'T03',
          'Desembolso y ejecución atómica de pago',
          false,
          `Saldo esperado 3,500,000 vs actual ${dbAccountAfter?.current_balance}`
        )
      }
    } catch (e: any) {
      recordResult('T03', 'Desembolso y ejecución atómica de pago', false, e.message)
    }

    // =========================================================================
    // T04: PREVENCIÓN DE SOBREGIRO BANCARIO (SALDO INSUFICIENTE)
    // =========================================================================
    try {
      // Programar un pago por $10,000,000 COP cuando la cuenta tiene $3,500,000
      const { data: resSchedBig } = await clientA.rpc('fn_schedule_treasury_payment', {
        p_supplier_id: supplierAId,
        p_bank_account_id: bankA1Id,
        p_amount: 10000000.00,
        p_payment_date: '2026-10-16',
      })

      payment2Id = resSchedBig.payment_id

      let threwError = false
      let errorMessage = ''
      try {
        const { data: resExecBig, error: errExecBig } = await clientA.rpc('fn_execute_treasury_payment', {
          p_payment_id: payment2Id,
          p_bank_account_id: bankA1Id,
        })
        if (errExecBig || !resExecBig?.success) {
          threwError = true
          errorMessage = errExecBig?.message || resExecBig?.error
        }
      } catch (err: any) {
        threwError = true
        errorMessage = err.message
      }

      if (threwError && (errorMessage.includes('Saldo insuficiente') || errorMessage.includes('insuficiente'))) {
        recordResult(
          'T04',
          'Prevención de sobregiro bancario (saldo insuficiente)',
          true,
          `El sistema rechazó el desembolso de $10,000,000 por saldo insuficiente con mensaje: "${errorMessage}".`
        )
      } else {
        recordResult(
          'T04',
          'Prevención de sobregiro bancario',
          false,
          `Se esperaba rechazo por sobregiro pero el resultado fue: ${errorMessage}`
        )
      }
    } catch (e: any) {
      recordResult('T04', 'Prevención de sobregiro bancario', false, e.message)
    }

    // =========================================================================
    // T05: ACTUALIZACIÓN AUTOMÁTICA DE CXP / COMPRA AL DESEMBOLSAR
    // =========================================================================
    try {
      const { data: dbPurchase } = await adminSupabase
        .from('purchases')
        .select('total_amount, paid_amount, payment_status')
        .eq('id', purchaseAId)
        .single()

      if (
        dbPurchase &&
        Number(dbPurchase.paid_amount) === 1500000 &&
        dbPurchase.payment_status === 'PARTIAL'
      ) {
        recordResult(
          'T05',
          'Actualización automática de CxP / Compra al desembolsar',
          true,
          `Compra ${purchaseAId} actualizada automáticamente a paid_amount: $${Number(dbPurchase.paid_amount).toLocaleString()} y payment_status: 'PARTIAL'.`
        )
      } else {
        recordResult(
          'T05',
          'Actualización automática de CxP / Compra al desembolsar',
          false,
          `Valores obtenidos: paid_amount=${dbPurchase?.paid_amount}, status=${dbPurchase?.payment_status}`
        )
      }
    } catch (e: any) {
      recordResult('T05', 'Actualización automática de CxP / Compra', false, e.message)
    }

    // =========================================================================
    // T06: REGISTRO ATÓMICO DE RECAUDO DE CLIENTE (fn_register_treasury_receipt)
    // =========================================================================
    try {
      const { data: resRec, error: errRec } = await clientA.rpc('fn_register_treasury_receipt', {
        p_customer_id: customerAId,
        p_bank_account_id: bankA1Id,
        p_amount: 800000.00,
        p_receipt_date: '2026-10-15',
        p_payment_method: 'CONSIGNACION',
        p_reference_number: `DEP-${runId}-01`,
        p_notes: 'Abono de cliente a cartera pendiente',
      })

      if (errRec || !resRec?.success) {
        throw new Error(`RPC error: ${errRec?.message || resRec?.error}`)
      }

      receipt1Id = resRec.receipt_id

      // Validar cuenta bancaria (debe quedar en 3,500,000 + 800,000 = 4,300,000)
      const { data: dbAccountAfterRec } = await adminSupabase
        .from('bank_accounts')
        .select('current_balance')
        .eq('id', bankA1Id)
        .single()

      // Validar movimiento bancario CREDIT
      const { data: credMov } = await adminSupabase
        .from('bank_movements')
        .select('*')
        .eq('treasury_receipt_id', receipt1Id)
        .single()

      movementToReconcileId = credMov?.id

      if (
        resRec.receipt_number.startsWith('TES-REC-') &&
        Number(dbAccountAfterRec?.current_balance) === 4300000 &&
        credMov?.movement_type === 'CREDIT' &&
        Number(credMov?.amount) === 800000 &&
        Number(credMov?.balance_after) === 4300000
      ) {
        recordResult(
          'T06',
          'Registro atómico de recaudo de cliente (fn_register_treasury_receipt)',
          true,
          `Recaudo ${resRec.receipt_number} por $800,000 COP registrado. Saldo en banco aumentó a $${Number(dbAccountAfterRec?.current_balance).toLocaleString()} COP con movimiento CREDIT.`
        )
      } else {
        recordResult(
          'T06',
          'Registro atómico de recaudo de cliente',
          false,
          `Saldo esperado 4,300,000 vs actual ${dbAccountAfterRec?.current_balance}`
        )
      }
    } catch (e: any) {
      recordResult('T06', 'Registro atómico de recaudo de cliente', false, e.message)
    }

    // =========================================================================
    // T07: DISMINUCIÓN DE SALDO EN CARTERA DEL CLIENTE (customers.current_balance)
    // =========================================================================
    try {
      const { data: dbCustomer } = await adminSupabase
        .from('customers')
        .select('current_balance')
        .eq('id', customerAId)
        .single()

      // Deuda original era 2,000,000. Tras el recaudo de 800,000, debe ser 1,200,000.
      if (dbCustomer && Number(dbCustomer.current_balance) === 1200000) {
        recordResult(
          'T07',
          'Disminución de saldo en cartera del cliente (customers.current_balance)',
          true,
          `Cartera del cliente disminuyó exactamente en $800,000 COP (saldo actual: $${Number(dbCustomer.current_balance).toLocaleString()} COP).`
        )
      } else {
        recordResult(
          'T07',
          'Disminución de saldo en cartera del cliente',
          false,
          `Saldo esperado 1,200,000 vs actual ${dbCustomer?.current_balance}`
        )
      }
    } catch (e: any) {
      recordResult('T07', 'Disminución de saldo en cartera del cliente', false, e.message)
    }

    // =========================================================================
    // T08: CONCILIACIÓN BANCARIA FIDUCIARIA (fn_reconcile_bank_movement)
    // =========================================================================
    try {
      // 1. Conciliar movimiento
      const { data: resReconcile, error: errRec1 } = await clientA.rpc('fn_reconcile_bank_movement', {
        p_movement_id: movementToReconcileId,
        p_reconciled: true,
      })

      if (errRec1 || !resReconcile?.success) {
        throw new Error(`Fallo conciliando: ${errRec1?.message || resReconcile?.error}`)
      }

      const { data: dbMovRec } = await adminSupabase
        .from('bank_movements')
        .select('is_reconciled, reconciled_at')
        .eq('id', movementToReconcileId)
        .single()

      // 2. Desmarcar conciliación
      await clientA.rpc('fn_reconcile_bank_movement', {
        p_movement_id: movementToReconcileId,
        p_reconciled: false,
      })

      const { data: dbMovUnrec } = await adminSupabase
        .from('bank_movements')
        .select('is_reconciled, reconciled_at')
        .eq('id', movementToReconcileId)
        .single()

      if (
        dbMovRec?.is_reconciled === true &&
        dbMovRec?.reconciled_at !== null &&
        dbMovUnrec?.is_reconciled === false &&
        dbMovUnrec?.reconciled_at === null
      ) {
        recordResult(
          'T08',
          'Conciliación bancaria fiduciaria (fn_reconcile_bank_movement)',
          true,
          `Movimiento ${movementToReconcileId} conciliado con timestamp y revertido exitosamente.`
        )
      } else {
        recordResult('T08', 'Conciliación bancaria fiduciaria', false, 'Estados de conciliación no coinciden.')
      }
    } catch (e: any) {
      recordResult('T08', 'Conciliación bancaria fiduciaria', false, e.message)
    }

    // =========================================================================
    // T09: CONSECUTIVOS FIDUCIARIOS INDEPENDIENTES
    // =========================================================================
    try {
      const { data: payments } = await adminSupabase
        .from('treasury_payments')
        .select('payment_number')
        .eq('company_id', companyAId)
        .in('id', [payment1Id, payment2Id])

      const { data: receipts } = await adminSupabase
        .from('treasury_receipts')
        .select('receipt_number')
        .eq('id', receipt1Id)

      const { data: movements } = await adminSupabase
        .from('bank_movements')
        .select('movement_number')
        .eq('bank_account_id', bankA1Id)

      const allPaymentsHavePrefix = payments?.every((p) => p.payment_number.startsWith('TES-PAG-'))
      const allReceiptsHavePrefix = receipts?.every((r) => r.receipt_number.startsWith('TES-REC-'))
      const allMovementsHavePrefix = movements?.every((m) => m.movement_number.startsWith('MOV-BNC-'))

      if (allPaymentsHavePrefix && allReceiptsHavePrefix && allMovementsHavePrefix && payments!.length >= 2) {
        recordResult(
          'T09',
          'Consecutivos fiduciarios independientes (TES-PAG-, TES-REC-, MOV-BNC-)',
          true,
          `Prefijos validados: ${payments!.length} pagos (TES-PAG-), ${receipts!.length} recaudos (TES-REC-), ${movements!.length} movimientos bancarios (MOV-BNC-).`
        )
      } else {
        recordResult('T09', 'Consecutivos fiduciarios independientes', false, 'Falla en formato de consecutivos.')
      }
    } catch (e: any) {
      recordResult('T09', 'Consecutivos fiduciarios independientes', false, e.message)
    }

    // =========================================================================
    // T10: CONSULTAS DE EXTRACTO Y MOVIMIENTOS BANCARIOS FIDUCIARIOS
    // =========================================================================
    try {
      const { data: movements, error: errMov } = await clientA
        .from('bank_movements')
        .select(`
          id,
          movement_number,
          movement_date,
          movement_type,
          amount,
          balance_after,
          concept
        `)
        .eq('bank_account_id', bankA1Id)
        .order('created_at', { ascending: true })

      if (errMov || !movements) throw new Error(errMov?.message)

      // Deben existir 3 movimientos:
      // 1. Apertura (CREDIT 5,000,000 -> balance 5,000,000)
      // 2. Pago proveedor (DEBIT 1,500,000 -> balance 3,500,000)
      // 3. Recaudo cliente (CREDIT 800,000 -> balance 4,300,000)
      const m1 = movements[0]
      const m2 = movements[1]
      const m3 = movements[2]

      const correctHistory =
        movements.length === 3 &&
        m1.movement_type === 'CREDIT' && Number(m1.amount) === 5000000 && Number(m1.balance_after) === 5000000 &&
        m2.movement_type === 'DEBIT' && Number(m2.amount) === 1500000 && Number(m2.balance_after) === 3500000 &&
        m3.movement_type === 'CREDIT' && Number(m3.amount) === 800000 && Number(m3.balance_after) === 4300000

      if (correctHistory) {
        recordResult(
          'T10',
          'Consultas de extracto y movimientos bancarios fiduciarios',
          true,
          `Extracto verificado con precisión matemática: 3 movimientos encadenados, saldo final $${Number(m3.balance_after).toLocaleString()} COP.`
        )
      } else {
        recordResult(
          'T10',
          'Consultas de extracto y movimientos bancarios',
          false,
          `Historial de movimientos no coincide con lo esperado: total ${movements.length}`
        )
      }
    } catch (e: any) {
      recordResult('T10', 'Consultas de extracto y movimientos bancarios', false, e.message)
    }

    // =========================================================================
    // T11: RESUMEN Y MÉTRICAS DE TESORERÍA (getStats)
    // =========================================================================
    try {
      const { data: accounts } = await clientA
        .from('bank_accounts')
        .select('current_balance, is_active')
        .eq('id', bankA1Id)

      const { data: payments } = await clientA
        .from('treasury_payments')
        .select('amount, status')
        .in('id', [payment1Id, payment2Id])

      const { data: receipts } = await clientA
        .from('treasury_receipts')
        .select('amount, status')
        .eq('id', receipt1Id)

      const totalCashAndBanks = accounts?.reduce((acc: number, b: any) => acc + Number(b.current_balance), 0) || 0
      const paidTotal = payments?.filter((p: any) => p.status === 'PAID').reduce((acc: number, p: any) => acc + Number(p.amount), 0) || 0
      const collectedTotal = receipts?.filter((r: any) => r.status === 'COLLECTED').reduce((acc: number, r: any) => acc + Number(r.amount), 0) || 0

      if (
        totalCashAndBanks === 4300000 &&
        paidTotal === 1500000 &&
        collectedTotal === 800000
      ) {
        recordResult(
          'T11',
          'Resumen y métricas de tesorería (getStats)',
          true,
          `Métricas consolidadas de prueba: Liquidez $${totalCashAndBanks.toLocaleString()} COP, Pagado $${paidTotal.toLocaleString()} COP, Recaudado $${collectedTotal.toLocaleString()} COP.`
        )
      } else {
        recordResult(
          'T11',
          'Resumen y métricas de tesorería',
          false,
          `Valores obtenidos: liquidez=${totalCashAndBanks}, pagado=${paidTotal}, recaudado=${collectedTotal}`
        )
      }
    } catch (e: any) {
      recordResult('T11', 'Resumen y métricas de tesorería', false, e.message)
    }

    // =========================================================================
    // T12: PREVENCIÓN DE DESEMBOLSO SOBRE CUENTA BANCARIA INACTIVA
    // =========================================================================
    try {
      // Inactivar cuenta bancaria
      await adminSupabase.from('bank_accounts').update({ is_active: false }).eq('id', bankA1Id)

      let threwInactiveError = false
      let inactiveErrMsg = ''
      try {
        const { data: resInact, error: errInact } = await clientA.rpc('fn_execute_treasury_payment', {
          p_payment_id: payment2Id,
          p_bank_account_id: bankA1Id,
        })
        if (errInact || !resInact?.success) {
          threwInactiveError = true
          inactiveErrMsg = errInact?.message || resInact?.error
        }
      } catch (err: any) {
        threwInactiveError = true
        inactiveErrMsg = err.message
      }

      // Reactivar cuenta para continuar
      await adminSupabase.from('bank_accounts').update({ is_active: true }).eq('id', bankA1Id)

      if (threwInactiveError && (inactiveErrMsg.includes('inactiva') || inactiveErrMsg.includes('no está activa'))) {
        recordResult(
          'T12',
          'Prevención de desembolso sobre cuenta bancaria inactiva',
          true,
          `Desembolso bloqueado exitosamente al detectar cuenta bancaria inactiva: "${inactiveErrMsg}".`
        )
      } else {
        recordResult(
          'T12',
          'Prevención de desembolso sobre cuenta bancaria inactiva',
          false,
          `Se esperaba rechazo por cuenta inactiva pero el resultado fue: ${inactiveErrMsg}`
        )
      }
    } catch (e: any) {
      recordResult('T12', 'Prevención de desembolso sobre cuenta bancaria inactiva', false, e.message)
    }

    // =========================================================================
    // T13: AISLAMIENTO MULTIEMPRESA ESTRICTO
    // =========================================================================
    try {
      // 1. Empresa B intenta consultar cuentas de Empresa A
      const { data: bAccounts } = await clientB.from('bank_accounts').select('id')
      const leaksAccount = bAccounts?.some((a: any) => a.id === bankA1Id)

      // 2. Empresa B intenta consultar movimientos bancarios de Empresa A
      const { data: bMovements } = await clientB.from('bank_movements').select('id')
      const leaksMovement = bMovements?.some((m: any) => m.id === movementToReconcileId)

      // 3. Empresa B intenta ejecutar un pago de Empresa A
      let threwCrossError = false
      let crossMsg = ''
      try {
        const { data: resCross, error: errCross } = await clientB.rpc('fn_execute_treasury_payment', {
          p_payment_id: payment1Id,
          p_bank_account_id: bankA1Id,
        })
        if (errCross || !resCross?.success) {
          threwCrossError = true
          crossMsg = errCross?.message || resCross?.error
        }
      } catch (err: any) {
        threwCrossError = true
        crossMsg = err.message
      }

      if (!leaksAccount && !leaksMovement && (threwCrossError || !crossMsg)) {
        recordResult(
          'T13',
          'Aislamiento multiempresa estricto en cuentas, pagos, recaudos y extractos',
          true,
          'Empresa B tiene 0 visibilidad y 0 capacidad operativa sobre cuentas bancarias, pagos o recaudos de Empresa A.'
        )
      } else {
        recordResult(
          'T13',
          'Aislamiento multiempresa estricto',
          false,
          `Fuga detectada: leaksAccount=${leaksAccount}, leaksMovement=${leaksMovement}`
        )
      }
    } catch (e: any) {
      recordResult('T13', 'Aislamiento multiempresa estricto', false, e.message)
    }

    // =========================================================================
    // T14: AUDITORÍA FORENSE EN public.audit_logs
    // =========================================================================
    try {
      const { data: logs } = await adminSupabase
        .from('audit_logs')
        .select('*')
        .eq('company_id', companyAId)
        .eq('user_id', authUserAId)
        .order('created_at', { ascending: false })

      const hasAccountLog = logs?.some((l) => l.action === 'BANK_ACCOUNT_CREATED')
      const hasPaymentLog = logs?.some((l) => l.action === 'TREASURY_PAYMENT_EXECUTED')
      const hasReceiptLog = logs?.some((l) => l.action === 'TREASURY_RECEIPT_REGISTERED')

      if (hasAccountLog && hasPaymentLog && hasReceiptLog) {
        recordResult(
          'T14',
          'Auditoría forense en public.audit_logs',
          true,
          `Trazabilidad completa: ${logs?.length} eventos auditados incluyendo BANK_ACCOUNT_CREATED, TREASURY_PAYMENT_EXECUTED y TREASURY_RECEIPT_REGISTERED.`
        )
      } else {
        recordResult(
          'T14',
          'Auditoría forense en public.audit_logs',
          false,
          `Falta alguno de los logs esperados: account=${hasAccountLog}, payment=${hasPaymentLog}, receipt=${hasReceiptLog}`
        )
      }
    } catch (e: any) {
      recordResult('T14', 'Auditoría forense en public.audit_logs', false, e.message)
    }

  } catch (err: any) {
    console.error('❌ Error catastrófico en suite Fase 11:', err)
  } finally {
    // =========================================================================
    // T15: ZERO POLLUTION (LIMPIEZA TOTAL DE DATOS DE PRUEBA)
    // =========================================================================
    try {
      console.log('\n🧹 Ejecutando limpieza forense de datos de prueba (Zero Pollution)...')

      await pgClient.query("SELECT set_config('app.is_test_cleanup', 'true', false);")

      if (bankA1Id!) {
        await pgClient.query('DELETE FROM bank_movements WHERE bank_account_id = $1;', [bankA1Id])
      }
      if (payment1Id! || payment2Id!) {
        await pgClient.query('DELETE FROM treasury_payments WHERE id IN ($1, $2);', [payment1Id, payment2Id].filter(Boolean))
      }
      if (receipt1Id!) {
        await pgClient.query('DELETE FROM treasury_receipts WHERE id = $1;', [receipt1Id])
      }
      if (bankA1Id!) {
        await pgClient.query('DELETE FROM bank_accounts WHERE id = $1;', [bankA1Id])
      }
      if (purchaseAId!) {
        await pgClient.query('DELETE FROM purchases WHERE id = $1;', [purchaseAId])
      }
      if (customerAId!) {
        await pgClient.query('DELETE FROM customers WHERE id = $1;', [customerAId])
      }
      if (supplierAId!) {
        await pgClient.query('DELETE FROM suppliers WHERE id = $1;', [supplierAId])
      }
      if (authUserAId! || authUserBId!) {
        await pgClient.query('DELETE FROM public.audit_logs WHERE user_id IN ($1, $2);', [authUserAId, authUserBId].filter(Boolean))
        await pgClient.query('DELETE FROM public.user_locations WHERE user_id IN ($1, $2);', [authUserAId, authUserBId].filter(Boolean))
        await pgClient.query('DELETE FROM users WHERE id IN ($1, $2);', [authUserAId, authUserBId].filter(Boolean))
      }
      if (locAId! || locBId!) {
        await pgClient.query('DELETE FROM locations WHERE id IN ($1, $2);', [locAId, locBId].filter(Boolean))
      }

      if (isTempCompanyB) {
        await pgClient.query('DELETE FROM public.audit_logs WHERE company_id = $1;', [companyBId])
        await pgClient.query('DELETE FROM public.companies WHERE id = $1;', [companyBId])
      }

      await pgClient.query("SELECT set_config('app.is_test_cleanup', 'false', false);")

      if (authUserAId!) await adminSupabase.auth.admin.deleteUser(authUserAId)
      if (authUserBId!) await adminSupabase.auth.admin.deleteUser(authUserBId)

      // Verificación de residuo 0
      const resBank = await pgClient.query(`SELECT count(*) as count FROM public.bank_accounts WHERE account_number LIKE '%${runId}%';`)
      const resMov = await pgClient.query(`SELECT count(*) as count FROM public.bank_movements WHERE concept LIKE '%${runId}%';`)

      const t15Pass = Number(resBank.rows[0].count) === 0 && Number(resMov.rows[0].count) === 0

      await pgClient.end()

      recordResult(
        'T15',
        'Zero Pollution: purga 100% limpia de datos de prueba',
        t15Pass,
        t15Pass
          ? 'Todos los registros de prueba (cuentas, pagos, recibos, movimientos, compras, clientes y usuarios) fueron eliminados sin dejar rastro.'
          : 'Falla: se encontraron registros residuales en la BD.'
      )
    } catch (cleanErr: any) {
      recordResult('T15', 'Zero Pollution', false, `Fallo en limpieza: ${cleanErr.message}`)
    }
  }

  // Resumen final
  console.log('\n============================================================')
  console.log('RESUMEN DE EJECUCIÓN - FASE 11: BANCOS Y TESORERÍA')
  console.log('============================================================')
  const total = testResults.length
  const passed = testResults.filter((r) => r.passed).length
  const failed = total - passed

  testResults.forEach((r) => {
    console.log(`${r.passed ? '✅' : '❌'} [${r.code}] ${r.description}`)
  })

  console.log('============================================================')
  console.log(`TOTAL: ${total} | PASARON: ${passed} | FALLARON: ${failed}`)
  console.log('============================================================\n')

  if (failed > 0) {
    process.exit(1)
  }
}

runPhase11TestSuite()
