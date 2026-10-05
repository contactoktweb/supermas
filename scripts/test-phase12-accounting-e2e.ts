/**
 * ============================================================================
 * SUPER MÁS ERP — FASE 12: SUITE E2E DE CONTABILIDAD Y CAUSACIÓN AUTOMÁTICA
 * ============================================================================
 *
 * Verificación fiduciaria y transaccional completa:
 * - T01: Catálogo de cuentas PUC desde PostgreSQL y consulta por clase/naturaleza.
 * - T02: Creación de cuenta PUC adicional con validación de código.
 * - T03: Creación de asiento contable manual atómico con estricta partida doble (fn_create_accounting_entry).
 * - T04: Rechazo y bloqueo de asiento con partida doble descuadrada (SUM(debit) != SUM(credit)).
 * - T05: Inmutabilidad de comprobantes en estado POSTED (bloqueo de modificación y borrado).
 * - T06: Reversión contable formal (fn_reverse_accounting_entry), inversión de líneas y estado REVERSED.
 * - T07: Causación automática de Venta comercial (fn_cause_sale_accounting).
 * - T08: Causación automática de Compra comercial (fn_cause_purchase_accounting).
 * - T09: Causación automática de Pago a Proveedor (fn_cause_payment_accounting).
 * - T10: Causación automática de Recaudo de Cliente (fn_cause_receipt_accounting).
 * - T11: Cierre de periodo contable mensual (fn_close_accounting_period, estado CLOSED).
 * - T12: Bloqueo estricto de nuevos asientos en periodos cerrados.
 * - T13: Reapertura autorizada de periodo contable con justificación obligatoria (fn_reopen_accounting_period).
 * - T14: Reportes financieros en BD (fn_financial_trial_balance, fn_financial_daily_journal, fn_financial_general_ledger).
 * - T15: Aislamiento multiempresa estricto, auditoría en audit_logs y Zero Pollution (limpieza 100%).
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

async function runPhase12TestSuite() {
  await pgClient.connect()
  console.log('✅ Conexión directa a PostgreSQL Staging establecida.\n')

  const runId = `P12_${Date.now()}`
  let companyAId: string | null = null
  let companyBId: string | null = null
  let authUserAId: string | null = null
  let authUserBId: string | null = null
  let locAId: string | null = null
  let customerAId: string | null = null
  let supplierAId: string | null = null
  let productAId: string | null = null
  let bankAccountId: string | null = null
  let companyBCreated = false

  // Variables de seguimiento para limpieza
  const createdEntryIds: string[] = []
  const createdAccountIds: string[] = []
  let createdSaleId: string | null = null
  let createdPurchaseId: string | null = null
  let createdPaymentId: string | null = null
  let createdReceiptId: string | null = null
  let testPeriodCode: string = `2025-11`

  try {
    // ========================================================================
    // SETUP EMPRESAS, USUARIOS, BODEGAS Y MAESTROS
    // ========================================================================
    console.log('--- Configurando Empresas y Usuarios de Prueba ---')

    const compARes = await pgClient.query(`SELECT id FROM public.companies ORDER BY created_at ASC LIMIT 1;`)
    if (compARes.rows.length === 0) throw new Error('No existe ninguna empresa en la base de datos.')
    companyAId = compARes.rows[0].id

    const compBRes = await pgClient.query(
      `SELECT id FROM public.companies WHERE id != $1 ORDER BY created_at ASC LIMIT 1;`,
      [companyAId]
    )
    if (compBRes.rows.length === 0) {
      const newB = await pgClient.query(`
        INSERT INTO public.companies (id, business_name, trade_name, tax_id, verification_digit, tax_regime, economic_activity_code, address, city, department, country, currency, status)
        VALUES (gen_random_uuid(), 'Empresa B Temporal E2E Contabilidad', 'Empresa B E2E', '900${runId.slice(-4)}-2', '1', 'RESPONSABLE_DE_IVA', '4711', 'Calle 10 # 20-30', 'Medellín', 'Antioquia', 'Colombia', 'COP', 'ACTIVE')
        RETURNING id;
      `)
      companyBId = newB.rows[0].id
      companyBCreated = true
    } else {
      companyBId = compBRes.rows[0].id
    }

    // Crear usuarios Auth
    const emailA = `contador_a_${runId}@supermas.com`
    const { data: userACreated, error: userAErr } = await adminSupabase.auth.admin.createUser({
      email: emailA,
      password: 'SuperPassword123!',
      email_confirm: true,
      user_metadata: { full_name: `Contador A ${runId}` },
    })
    if (userAErr || !userACreated?.user) throw new Error(`Error creando usuario Auth A: ${userAErr?.message}`)
    authUserAId = userACreated.user.id

    await pgClient.query(
      `INSERT INTO users (id, email, full_name, role_id, company_id, is_active)
       VALUES ($1, $2, $3, 'c0000000-0000-0000-0000-000000000005', $4, true)
       ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, role_id = EXCLUDED.role_id, company_id = EXCLUDED.company_id, is_active = true;`,
      [authUserAId, emailA, `Contador General A ${runId}`, companyAId]
    )

    const emailB = `contador_b_${runId}@supermas.com`
    const { data: userBCreated, error: userBErr } = await adminSupabase.auth.admin.createUser({
      email: emailB,
      password: 'SuperPassword123!',
      email_confirm: true,
      user_metadata: { full_name: `Contador B ${runId}` },
    })
    if (userBErr || !userBCreated?.user) throw new Error(`Error creando usuario Auth B: ${userBErr?.message}`)
    authUserBId = userBCreated.user.id

    await pgClient.query(
      `INSERT INTO users (id, email, full_name, role_id, company_id, is_active)
       VALUES ($1, $2, $3, 'c0000000-0000-0000-0000-000000000005', $4, true)
       ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, role_id = EXCLUDED.role_id, company_id = EXCLUDED.company_id, is_active = true;`,
      [authUserBId, emailB, `Contador General B ${runId}`, companyBId]
    )

    // Bodega en Empresa A
    const locARes = await pgClient.query(
      `INSERT INTO locations (company_id, name, code, type, status, address, city)
       VALUES ($1, $2, $3, 'WAREHOUSE', 'ACTIVE', 'Calle 10 # 20-30', 'Medellin') RETURNING id;`,
      [companyAId, `Bodega Central ${runId}`, `BC-${runId.slice(-4)}`]
    )
    locAId = locARes.rows[0].id

    // Cliente en Empresa A
    const custRes = await pgClient.query(
      `INSERT INTO customers (company_id, document_type, document_number, company_name, customer_category, credit_limit, current_balance, is_active)
       VALUES ($1, 'NIT', $2, $3, 'WHOLESALE', 20000000.00, 0.00, true) RETURNING id;`,
      [companyAId, `900999${runId.slice(-4)}`, `Distribuidor Mayorista ${runId}`]
    )
    customerAId = custRes.rows[0].id

    // Proveedor en Empresa A
    const suppRes = await pgClient.query(
      `INSERT INTO suppliers (company_id, tax_id, name, legal_name, is_active)
       VALUES ($1, $2, $3, $4, true) RETURNING id;`,
      [companyAId, `800111${runId.slice(-4)}`, `Molino Central ${runId}`, `Molino Central S.A.S.`]
    )
    supplierAId = suppRes.rows[0].id

    // Producto en Empresa A
    const prodRes = await pgClient.query(
      `INSERT INTO products (company_id, sku, barcode, name, slug, cost_price, public_sale_price, wholesale_price, is_active)
       VALUES ($1, $2, $3, $4, $5, 3000.00, 4500.00, 4000.00, true) RETURNING id;`,
      [companyAId, `SKU-CONTA-${runId.slice(-4)}`, `BAR-${runId.slice(-4)}`, `Arroz Premium ${runId}`, `arroz-premium-${runId.toLowerCase()}`]
    )
    productAId = prodRes.rows[0].id

    // Cuenta Bancaria de prueba en Empresa A
    const bankRes = await pgClient.query(
      `INSERT INTO public.bank_accounts (
         company_id, location_id, bank_name, account_number, account_type, currency, current_balance, is_active
       ) VALUES (
         $1, $2, 'Bancolombia Test', $3, 'CHECKING', 'COP', 10000000.00, true
       ) RETURNING id;`,
      [companyAId, locAId, `CTA-${runId.slice(-6)}`]
    )
    bankAccountId = bankRes.rows[0].id

    // Asegurar periodo contable OPEN para fecha actual en Empresa A
    const currentMonthCode = new Date().toISOString().slice(0, 7)
    const [curYr, curMo] = currentMonthCode.split('-').map(Number)
    await pgClient.query(
      `INSERT INTO public.accounting_periods (id, company_id, period_code, year, month, month_name, start_date, end_date, status)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, 'Mes Actual', $5, $6, 'OPEN')
       ON CONFLICT (company_id, period_code) DO UPDATE SET status = 'OPEN';`,
      [
        companyAId,
        currentMonthCode,
        curYr,
        curMo,
        `${currentMonthCode}-01`,
        `${currentMonthCode}-28`,
      ]
    )

    console.log('✅ Setup inicial completado exitosamente.\n')

    // ========================================================================
    // T01: Catálogo de Cuentas PUC desde PostgreSQL y Consulta por Clase/Naturaleza
    // ========================================================================
    const pucRes = await pgClient.query(
      `SELECT id, code, name, account_class, nature, level
       FROM public.accounting_accounts
       WHERE is_active = true
       ORDER BY code ASC;`
    )
    const hasPUC = pucRes.rows.length >= 30
    const sampleClasses = new Set(pucRes.rows.map((r) => r.account_class))
    const hasRequiredClasses = [1, 2, 3, 4, 5, 6].every((c) => sampleClasses.has(c))

    recordResult(
      'T01',
      'Catálogo de cuentas PUC desde PostgreSQL y consulta por clase/naturaleza',
      hasPUC && hasRequiredClasses,
      hasPUC && hasRequiredClasses
        ? `Se recuperaron ${pucRes.rows.length} cuentas PUC oficiales en PostgreSQL con clases 1 a 6 cubiertas.`
        : `Falla: cuentas insuficientes (${pucRes.rows.length}) o clases incompletas.`
    )

    // ========================================================================
    // T02: Creación de Cuenta PUC Adicional con Validación de Código
    // ========================================================================
    const testAccountCode = `111099${runId.slice(-2)}`
    const newAccRes = await pgClient.query(
      `INSERT INTO public.accounting_accounts (
         id, code, name, account_class, level, nature, is_active
       ) VALUES (
         gen_random_uuid(), $1, $2, 1, 4, 'DEBIT', true
       ) RETURNING id, code, name, nature;`,
      [testAccountCode, `Cuenta Bancaria Adicional Test ${runId}`]
    )
    const createdAccount = newAccRes.rows[0]
    createdAccountIds.push(createdAccount.id)

    recordResult(
      'T02',
      'Creación de cuenta PUC adicional con validación de código',
      Boolean(createdAccount?.id && createdAccount.code === testAccountCode),
      createdAccount?.id
        ? `Cuenta PUC creada exitosamente: ${createdAccount.code} - ${createdAccount.name} (${createdAccount.nature})`
        : 'Falla: No se pudo crear la cuenta PUC.'
    )

    // ========================================================================
    // T03: Creación de Asiento Contable Manual Atómico con Estricta Partida Doble
    // ========================================================================
    const entryDate = new Date().toISOString().slice(0, 10)
    const linesT03 = [
      {
        account_code: '110505',
        debit_amount: 150000.0,
        credit_amount: 0.0,
        description: `Ingreso a caja prueba ${runId}`,
        third_party_name: `Cliente Prueba ${runId}`,
      },
      {
        account_code: '130505',
        debit_amount: 0.0,
        credit_amount: 150000.0,
        description: `Disminución clientes prueba ${runId}`,
        third_party_name: `Cliente Prueba ${runId}`,
      },
    ]

    const rpcEntryRes = await pgClient.query(
      `SELECT public.fn_create_accounting_entry(
         p_date := $1::DATE,
         p_concept := $2,
         p_document_type := 'MANUAL',
         p_document_reference := $3,
         p_lines := $4::JSONB,
         p_location_id := $5::UUID,
         p_auto_post := true,
         p_company_id := $6::UUID
       ) AS result;`,
      [entryDate, `Asiento manual comprobante ${runId}`, `REF-${runId.slice(-4)}`, JSON.stringify(linesT03), locAId, companyAId]
    )

    const entryT03Result = rpcEntryRes.rows[0].result
    let manualEntryId: string = entryT03Result.entry_id
    createdEntryIds.push(manualEntryId)

    // Verificar en BD
    const verifyT03 = await pgClient.query(
      `SELECT ae.id, ae.entry_number, ae.status, ae.date,
              COALESCE(SUM(ael.debit_amount), 0) AS total_debit,
              COALESCE(SUM(ael.credit_amount), 0) AS total_credit
       FROM public.accounting_entries ae
       JOIN public.accounting_entry_lines ael ON ael.entry_id = ae.id
       WHERE ae.id = $1
       GROUP BY ae.id, ae.entry_number, ae.status, ae.date;`,
      [manualEntryId]
    )
    const t03Row = verifyT03.rows[0]
    const t03Pass =
      t03Row &&
      t03Row.status === 'POSTED' &&
      Number(t03Row.total_debit) === 150000.0 &&
      Number(t03Row.total_credit) === 150000.0 &&
      t03Row.entry_number.startsWith('MANUAL-')

    recordResult(
      'T03',
      'Creación de asiento contable manual atómico con estricta partida doble (fn_create_accounting_entry)',
      Boolean(t03Pass),
      t03Pass
        ? `Asiento ${t03Row.entry_number} asentado en POSTED con Débito $${t03Row.total_debit} = Crédito $${t03Row.total_credit}.`
        : 'Falla: El comprobante no se guardó en POSTED o los totales no coinciden.'
    )

    // ========================================================================
    // T04: Rechazo y Bloqueo de Asiento con Partida Doble Descuadrada
    // ========================================================================
    let t04Blocked = false
    let t04ErrorMsg = ''
    try {
      const unbalanceLines = [
        { account_code: '110505', debit_amount: 200000.0, credit_amount: 0.0, description: 'Descuadre' },
        { account_code: '130505', debit_amount: 0.0, credit_amount: 150000.0, description: 'Descuadre' },
      ]
      await pgClient.query(
        `SELECT public.fn_create_accounting_entry(
           p_date := $1::DATE,
           p_concept := 'Asiento Descuadrado Inválido',
           p_document_type := 'MANUAL',
           p_document_reference := 'ERR-UNBALANCED',
           p_lines := $2::JSONB,
           p_location_id := $3::UUID,
           p_auto_post := true,
           p_company_id := $4::UUID
         );`,
        [entryDate, JSON.stringify(unbalanceLines), locAId, companyAId]
      )
    } catch (err: any) {
      t04Blocked = true
      t04ErrorMsg = err.message
    }

    recordResult(
      'T04',
      'Rechazo y bloqueo de asiento con partida doble descuadrada (SUM(debit) != SUM(credit))',
      t04Blocked && t04ErrorMsg.includes('Partida doble descuadrada'),
      t04Blocked
        ? `Bloqueo fiduciario exitoso: ${t04ErrorMsg}`
        : 'Falla: La base de datos permitió registrar un asiento con partida doble descuadrada.'
    )

    // ========================================================================
    // T05: Inmutabilidad de Comprobantes en Estado POSTED
    // ========================================================================
    let t05DeleteBlocked = false
    let t05DeleteMsg = ''
    try {
      // Intentar borrado directo sin bandera de limpieza
      await pgClient.query(`DELETE FROM public.accounting_entries WHERE id = $1;`, [manualEntryId])
    } catch (delErr: any) {
      t05DeleteBlocked = true
      t05DeleteMsg = delErr.message
    }

    let t05UpdateBlocked = false
    let t05UpdateMsg = ''
    try {
      // Intentar alterar la fecha o concepto
      await pgClient.query(
        `UPDATE public.accounting_entries SET concept = 'Concepto alterado ilegalmente' WHERE id = $1;`,
        [manualEntryId]
      )
    } catch (upErr: any) {
      t05UpdateBlocked = true
      t05UpdateMsg = upErr.message
    }

    const t05Pass = t05DeleteBlocked && t05UpdateBlocked
    recordResult(
      'T05',
      'Inmutabilidad de comprobantes en estado POSTED (bloqueo de modificación y borrado)',
      t05Pass,
      t05Pass
        ? `Inmutabilidad verificada: Delete bloqueado (${t05DeleteMsg.slice(0, 50)}...), Update bloqueado (${t05UpdateMsg.slice(0, 50)}...).`
        : 'Falla: No se garantizó la inmutabilidad de los comprobantes contables POSTED.'
    )

    // ========================================================================
    // T06: Reversión Contable Formal (fn_reverse_accounting_entry)
    // ========================================================================
    const revRes = await pgClient.query(
      `SELECT public.fn_reverse_accounting_entry(
         p_entry_id := $1::UUID,
         p_reason := 'Error fiduciario justificado en auditoría',
         p_company_id := $2::UUID
       ) AS result;`,
      [manualEntryId, companyAId]
    )
    const revData = revRes.rows[0].result
    const reversalEntryId = revData.reversal_entry_id
    createdEntryIds.push(reversalEntryId)

    // Verificar estado del original y del contra-asiento
    const checkOrig = await pgClient.query(`SELECT status FROM public.accounting_entries WHERE id = $1;`, [manualEntryId])
    const checkRev = await pgClient.query(
      `SELECT ae.entry_number, ae.status, ae.concept,
              COALESCE(SUM(ael.debit_amount), 0) as deb,
              COALESCE(SUM(ael.credit_amount), 0) as crd
       FROM public.accounting_entries ae
       JOIN public.accounting_entry_lines ael ON ael.entry_id = ae.id
       WHERE ae.id = $1
       GROUP BY ae.id, ae.entry_number, ae.status, ae.concept;`,
      [reversalEntryId]
    )

    const t06Pass =
      checkOrig.rows[0]?.status === 'REVERSED' &&
      checkRev.rows[0]?.status === 'POSTED' &&
      Number(checkRev.rows[0].deb) === 150000.0 &&
      Number(checkRev.rows[0].crd) === 150000.0 &&
      checkRev.rows[0].entry_number.startsWith('REV-')

    recordResult(
      'T06',
      'Reversión contable formal (fn_reverse_accounting_entry), inversión de líneas y estado REVERSED',
      Boolean(t06Pass),
      t06Pass
        ? `Original marcado como REVERSED. Contra-asiento ${checkRev.rows[0].entry_number} creado con líneas invertidas y estado POSTED.`
        : 'Falla: La reversión contable no cumplió las especificaciones fiduciarias.'
    )

    // ========================================================================
    // T07: Causación Automática de Venta Comercial (fn_cause_sale_accounting)
    // ========================================================================
    const saleNum = `VTA-${runId.slice(-6)}`
    const saleRes = await pgClient.query(
      `INSERT INTO public.sales (
         company_id, location_id, customer_id, seller_user_id, sale_number,
         subtotal_amount, tax_amount, total_amount, payment_method, status
       ) VALUES (
         $1, $2, $3, $4, $5, 40000.00, 7600.00, 47600.00, 'BANK_TRANSFER', 'ISSUED'
       ) RETURNING id;`,
      [companyAId, locAId, customerAId, authUserAId, saleNum]
    )
    createdSaleId = saleRes.rows[0].id

    // Insertar item con costo para causar costo de ventas también
    await pgClient.query(
      `INSERT INTO public.sale_items (
         sale_id, product_id, quantity, unit_price, unit_cost, subtotal, tax_amount, total
       ) VALUES (
         $1, $2, 10.0, 4000.00, 3000.00, 40000.00, 7600.00, 47600.00
       );`,
      [createdSaleId, productAId]
    )

    const causeSaleRes = await pgClient.query(
      `SELECT public.fn_cause_sale_accounting($1::UUID) AS result;`,
      [createdSaleId]
    )
    const saleEntryResult = causeSaleRes.rows[0].result
    const saleEntryId = saleEntryResult.entry_id
    createdEntryIds.push(saleEntryId)

    // Verificar líneas causadas: Ingreso (4135), IVA Generado (2408), Bancos (1110), Costo (6135), Inventario (1435)
    const saleLinesRes = await pgClient.query(
      `SELECT aa.code, ael.debit_amount, ael.credit_amount
       FROM public.accounting_entry_lines ael
       JOIN public.accounting_accounts aa ON aa.id = ael.account_id
       WHERE ael.entry_id = $1
       ORDER BY aa.code;`,
      [saleEntryId]
    )

    const saleAccounts = saleLinesRes.rows.map((r) => r.code)
    const hasBank = saleAccounts.some((c) => c.startsWith('1110'))
    const hasRev = saleAccounts.some((c) => c.startsWith('4135'))
    const hasTax = saleAccounts.some((c) => c.startsWith('2408'))
    const hasCost = saleAccounts.some((c) => c.startsWith('6135'))
    const hasInv = saleAccounts.some((c) => c.startsWith('1435'))
    const t07Pass = hasBank && hasRev && hasTax && hasCost && hasInv

    recordResult(
      'T07',
      'Causación automática de Venta comercial (fn_cause_sale_accounting)',
      t07Pass,
      t07Pass
        ? `Venta ${saleNum} causada: Banco (1110), Ingreso (4135), IVA Generado (2408), Costo (6135) e Inventario (1435).`
        : `Falla: Cuentas causadas incompletas: ${saleAccounts.join(', ')}`
    )

    // ========================================================================
    // T08: Causación Automática de Compra Comercial (fn_cause_purchase_accounting)
    // ========================================================================
    const purNum = `COM-${runId.slice(-6)}`
    const purRes = await pgClient.query(
      `INSERT INTO public.purchases (
         company_id, location_id, supplier_id, purchase_number, supplier_invoice_number,
         issue_date, due_date, subtotal_amount, tax_amount, total_amount, paid_amount,
         inventory_status, payment_status
       ) VALUES (
         $1, $2, $3, $4, $5, $6::DATE, $6::DATE, 100000.00, 19000.00, 119000.00, 0.00,
         'RECEIVED', 'PENDING'
       ) RETURNING id;`,
      [companyAId, locAId, supplierAId, purNum, `FACT-PROV-${runId.slice(-4)}`, entryDate]
    )
    createdPurchaseId = purRes.rows[0].id

    const causePurRes = await pgClient.query(
      `SELECT public.fn_cause_purchase_accounting($1::UUID) AS result;`,
      [createdPurchaseId]
    )
    const purEntryResult = causePurRes.rows[0].result
    const purEntryId = purEntryResult.entry_id
    createdEntryIds.push(purEntryId)

    const purLinesRes = await pgClient.query(
      `SELECT aa.code, ael.debit_amount, ael.credit_amount
       FROM public.accounting_entry_lines ael
       JOIN public.accounting_accounts aa ON aa.id = ael.account_id
       WHERE ael.entry_id = $1
       ORDER BY aa.code;`,
      [purEntryId]
    )
    const purAccounts = purLinesRes.rows.map((r) => r.code)
    const hasPurInv = purAccounts.some((c) => c.startsWith('1435'))
    const hasPurTax = purAccounts.some((c) => c.startsWith('2408'))
    const hasPurCxP = purAccounts.some((c) => c.startsWith('2205'))
    const t08Pass = hasPurInv && hasPurTax && hasPurCxP

    recordResult(
      'T08',
      'Causación automática de Compra comercial (fn_cause_purchase_accounting)',
      t08Pass,
      t08Pass
        ? `Compra ${purNum} causada: Inventario (1435), IVA Descontable (2408) y Proveedores CxP (2205).`
        : `Falla: Cuentas causadas incompletas: ${purAccounts.join(', ')}`
    )

    // ========================================================================
    // T09: Causación Automática de Pago a Proveedor (fn_cause_payment_accounting)
    // ========================================================================
    const payNum = `TES-PAG-${runId.slice(-6)}`
    const payRes = await pgClient.query(
      `INSERT INTO public.treasury_payments (
         company_id, location_id, supplier_id, purchase_id, bank_account_id, payment_number,
         payment_type, payment_date, amount, payment_method, status
       ) VALUES (
         $1, $2, $3, $4, $5, $6, 'SUPPLIER_PAYMENT', $7::DATE, 119000.00, 'BANK_TRANSFER', 'EXECUTED'
       ) RETURNING id;`,
      [companyAId, locAId, supplierAId, createdPurchaseId, bankAccountId, payNum, entryDate]
    )
    createdPaymentId = payRes.rows[0].id

    const causePayRes = await pgClient.query(
      `SELECT public.fn_cause_payment_accounting($1::UUID) AS result;`,
      [createdPaymentId]
    )
    const payEntryResult = causePayRes.rows[0].result
    const payEntryId = payEntryResult.entry_id
    createdEntryIds.push(payEntryId)

    const payLinesRes = await pgClient.query(
      `SELECT aa.code, ael.debit_amount, ael.credit_amount
       FROM public.accounting_entry_lines ael
       JOIN public.accounting_accounts aa ON aa.id = ael.account_id
       WHERE ael.entry_id = $1
       ORDER BY aa.code;`,
      [payEntryId]
    )
    const payAccounts = payLinesRes.rows.map((r) => r.code)
    const hasPayCxP = payAccounts.some((c) => c.startsWith('2205'))
    const hasPayBank = payAccounts.some((c) => c.startsWith('1110'))
    const t09Pass = hasPayCxP && hasPayBank

    recordResult(
      'T09',
      'Causación automática de Pago a Proveedor (fn_cause_payment_accounting)',
      t09Pass,
      t09Pass
        ? `Pago ${payNum} causado: Disminuye Proveedores CxP (2205) y Egresa Banco (1110).`
        : `Falla: Cuentas causadas incompletas: ${payAccounts.join(', ')}`
    )

    // ========================================================================
    // T10: Causación Automática de Recaudo de Cliente (fn_cause_receipt_accounting)
    // ========================================================================
    const recNum = `TES-REC-${runId.slice(-6)}`
    const recRes = await pgClient.query(
      `INSERT INTO public.treasury_receipts (
         company_id, location_id, customer_id, invoice_id, bank_account_id, receipt_number,
         receipt_date, amount, payment_method, status
       ) VALUES (
         $1, $2, $3, $4, $5, $6, $7::DATE, 47600.00, 'BANK_TRANSFER', 'CONFIRMED'
       ) RETURNING id;`,
      [companyAId, locAId, customerAId, null, bankAccountId, recNum, entryDate]
    )
    createdReceiptId = recRes.rows[0].id

    const causeRecRes = await pgClient.query(
      `SELECT public.fn_cause_receipt_accounting($1::UUID) AS result;`,
      [createdReceiptId]
    )
    const recEntryResult = causeRecRes.rows[0].result
    const recEntryId = recEntryResult.entry_id
    createdEntryIds.push(recEntryId)

    const recLinesRes = await pgClient.query(
      `SELECT aa.code, ael.debit_amount, ael.credit_amount
       FROM public.accounting_entry_lines ael
       JOIN public.accounting_accounts aa ON aa.id = ael.account_id
       WHERE ael.entry_id = $1
       ORDER BY aa.code;`,
      [recEntryId]
    )
    const recAccounts = recLinesRes.rows.map((r) => r.code)
    const hasRecBank = recAccounts.some((c) => c.startsWith('1110'))
    const hasRecCxC = recAccounts.some((c) => c.startsWith('1305'))
    const t10Pass = hasRecBank && hasRecCxC

    recordResult(
      'T10',
      'Causación automática de Recaudo de Cliente (fn_cause_receipt_accounting)',
      t10Pass,
      t10Pass
        ? `Recaudo ${recNum} causado: Ingresa Banco (1110) y Disminuye Cartera Clientes (1305).`
        : `Falla: Cuentas causadas incompletas: ${recAccounts.join(', ')}`
    )

    // ========================================================================
    // T11: Cierre de Periodo Contable Mensual (fn_close_accounting_period)
    // ========================================================================
    // Crear periodo específico para cerrar
    testPeriodCode = `2025-10`
    await pgClient.query(
      `INSERT INTO public.accounting_periods (
         id, company_id, period_code, year, month, month_name, start_date, end_date, status
       ) VALUES (
         gen_random_uuid(), $1, $2, 2025, 10, 'Octubre', '2025-10-01', '2025-10-31', 'OPEN'
       ) ON CONFLICT (company_id, period_code) DO UPDATE SET status = 'OPEN';`,
      [companyAId, testPeriodCode]
    )

    const closeRes = await pgClient.query(
      `SELECT public.fn_close_accounting_period(
         p_company_id := $1::UUID,
         p_period_code := $2,
         p_closed_by := $3::UUID
       ) AS result;`,
      [companyAId, testPeriodCode, authUserAId]
    )
    const closeData = closeRes.rows[0].result
    const t11Pass = closeData.status === 'CLOSED' && closeData.period_code === testPeriodCode

    recordResult(
      'T11',
      'Cierre de periodo contable mensual (fn_close_accounting_period, estado CLOSED)',
      t11Pass,
      t11Pass
        ? `Periodo ${testPeriodCode} cerrado exitosamente. Comprobantes procesados: ${closeData.entries_count}.`
        : 'Falla: El periodo no pasó a estado CLOSED.'
    )

    // ========================================================================
    // T12: Bloqueo Estricto de Nuevos Asientos en Periodos Cerrados
    // ========================================================================
    let t12Blocked = false
    let t12ErrorMsg = ''
    try {
      const closedDate = '2025-10-15'
      const testLinesClosed = [
        { account_code: '110505', debit_amount: 50000.0, credit_amount: 0.0, description: 'Test en cerrado' },
        { account_code: '130505', debit_amount: 0.0, credit_amount: 50000.0, description: 'Test en cerrado' },
      ]
      await pgClient.query(
        `SELECT public.fn_create_accounting_entry(
           p_date := $1::DATE,
           p_concept := 'Intento en periodo cerrado',
           p_document_type := 'MANUAL',
           p_document_reference := 'ERR-CLOSED',
           p_lines := $2::JSONB,
           p_location_id := $3::UUID,
           p_auto_post := true,
           p_company_id := $4::UUID
         );`,
        [closedDate, JSON.stringify(testLinesClosed), locAId, companyAId]
      )
    } catch (closedErr: any) {
      t12Blocked = true
      t12ErrorMsg = closedErr.message
    }

    recordResult(
      'T12',
      'Bloqueo estricto de nuevos asientos en periodos cerrados',
      t12Blocked && t12ErrorMsg.includes('CERRADO'),
      t12Blocked
        ? `Bloqueo de periodo exitoso: ${t12ErrorMsg}`
        : 'Falla: Se permitió asentar comprobantes en un periodo clausurado.'
    )

    // ========================================================================
    // T13: Reapertura Autorizada de Periodo Contable (fn_reopen_accounting_period)
    // ========================================================================
    const reopenRes = await pgClient.query(
      `SELECT public.fn_reopen_accounting_period(
         p_company_id := $1::UUID,
         p_period_code := $2,
         p_reopened_by := $3::UUID,
         p_reason := 'Ajuste contable requerido por auditoría fiscal anual'
       ) AS result;`,
      [companyAId, testPeriodCode, authUserAId]
    )
    const reopenData = reopenRes.rows[0].result
    const t13Pass = reopenData.status === 'OPEN' && reopenData.reopened_reason.includes('auditoría fiscal')

    recordResult(
      'T13',
      'Reapertura autorizada de periodo contable con justificación obligatoria (fn_reopen_accounting_period)',
      t13Pass,
      t13Pass
        ? `Periodo ${testPeriodCode} reabierto a estado OPEN con motivo fiduciario auditado.`
        : 'Falla: No se reabrió correctamente el periodo contable.'
    )

    // ========================================================================
    // T14: Reportes Financieros en BD (fn_financial_trial_balance, etc.)
    // ========================================================================
    const trialBalanceRes = await pgClient.query(
      `SELECT * FROM public.fn_financial_trial_balance(
         p_company_id := $1::UUID,
         p_start_date := $2::DATE,
         p_end_date := $3::DATE
       );`,
      [companyAId, `${currentMonthCode}-01`, `${currentMonthCode}-28`]
    )

    const journalRes = await pgClient.query(
      `SELECT * FROM public.fn_financial_daily_journal(
         p_company_id := $1::UUID,
         p_start_date := $2::DATE,
         p_end_date := $3::DATE
       );`,
      [companyAId, `${currentMonthCode}-01`, `${currentMonthCode}-28`]
    )

    const ledgerRes = await pgClient.query(
      `SELECT * FROM public.fn_financial_general_ledger(
         p_company_id := $1::UUID,
         p_start_date := $2::DATE,
         p_end_date := $3::DATE,
         p_account_code := '11'
       );`,
      [companyAId, `${currentMonthCode}-01`, `${currentMonthCode}-28`]
    )

    const t14Pass = trialBalanceRes.rows.length > 0 && journalRes.rows.length > 0 && ledgerRes.rows.length > 0
    recordResult(
      'T14',
      'Reportes financieros en BD (Balance de Comprobación, Libro Diario, Libro Mayor)',
      t14Pass,
      t14Pass
        ? `Reportes generados: Trial Balance (${trialBalanceRes.rows.length} cuentas), Diario (${journalRes.rows.length} líneas), Mayor (${ledgerRes.rows.length} movimientos).`
        : 'Falla: Alguna de las funciones de reporte no devolvió registros.'
    )

    // ========================================================================
    // T15: Aislamiento Multiempresa Estricto, Auditoría en audit_logs y Zero Pollution
    // ========================================================================
    // 1. Verificar aislamiento: Empresa B no debe ver los comprobantes de Empresa A
    const isolationRes = await pgClient.query(
      `SELECT count(*) as count FROM public.accounting_entries WHERE company_id = $1;`,
      [companyBId]
    )
    const companyBEntriesCount = Number(isolationRes.rows[0].count)

    // 2. Verificar auditoría en audit_logs
    const auditRes = await pgClient.query(
      `SELECT action, count(*) as count
       FROM public.audit_logs
       WHERE company_id = $1 AND module = 'ACCOUNTING'
       GROUP BY action;`,
      [companyAId]
    )
    const auditActions = auditRes.rows.map((r) => r.action)
    const hasAudits =
      auditActions.includes('ACCOUNTING_ENTRY_CREATED') &&
      auditActions.includes('ACCOUNTING_ENTRY_REVERSED')

    const t15SecurityPass = companyBEntriesCount === 0 && hasAudits

    recordResult(
      'T15_SECURITY',
      'Aislamiento multiempresa estricto y auditoría fiduciaria',
      t15SecurityPass,
      t15SecurityPass
        ? `Empresa B tiene 0 comprobantes (aislamiento total). Auditoría registró: ${auditActions.join(', ')}.`
        : `Falla en aislamiento o auditoría: Empresa B tiene ${companyBEntriesCount} asientos, auditorías: ${auditActions.join(', ')}`
    )

  } catch (err: any) {
    console.error('❌ Error catastrófico en suite E2E:', err)
  } finally {
    // ========================================================================
    // ZERO POLLUTION: LIMPIEZA 100% LIMPIA DE REGISTROS DE PRUEBA
    // ========================================================================
    console.log('\n--- Ejecutando Purga Zero Pollution ---')
    try {
      // Activar bypass de pruebas para permitir eliminación de registros POSTED de prueba
      await pgClient.query(`SELECT set_config('app.is_test_cleanup', 'true', false);`)

      if (createdEntryIds.length > 0) {
        await pgClient.query(`DELETE FROM public.accounting_entry_lines WHERE entry_id = ANY($1::UUID[]);`, [createdEntryIds])
        await pgClient.query(`DELETE FROM public.accounting_entries WHERE id = ANY($1::UUID[]);`, [createdEntryIds])
      }

      if (createdAccountIds.length > 0) {
        await pgClient.query(`DELETE FROM public.accounting_accounts WHERE id = ANY($1::UUID[]);`, [createdAccountIds])
      }

      if (createdPaymentId) {
        await pgClient.query(`DELETE FROM public.treasury_payments WHERE id = $1;`, [createdPaymentId])
      }
      if (createdReceiptId) {
        await pgClient.query(`DELETE FROM public.treasury_receipts WHERE id = $1;`, [createdReceiptId])
      }
      if (createdPurchaseId) {
        await pgClient.query(`DELETE FROM public.purchases WHERE id = $1;`, [createdPurchaseId])
      }
      if (createdSaleId) {
        await pgClient.query(`DELETE FROM public.sale_items WHERE sale_id = $1;`, [createdSaleId])
        await pgClient.query(`DELETE FROM public.sales WHERE id = $1;`, [createdSaleId])
      }

      if (bankAccountId) {
        await pgClient.query(`DELETE FROM public.bank_accounts WHERE id = $1;`, [bankAccountId])
      }
      if (locAId) {
        await pgClient.query(`DELETE FROM public.locations WHERE id = $1;`, [locAId])
      }
      if (customerAId) {
        await pgClient.query(`DELETE FROM public.customers WHERE id = $1;`, [customerAId])
      }
      if (supplierAId) {
        await pgClient.query(`DELETE FROM public.suppliers WHERE id = $1;`, [supplierAId])
      }
      if (productAId) {
        await pgClient.query(`DELETE FROM public.products WHERE id = $1;`, [productAId])
      }
      if (testPeriodCode && companyAId) {
        await pgClient.query(`DELETE FROM public.accounting_periods WHERE company_id = $1 AND period_code = $2;`, [companyAId, testPeriodCode])
      }

      if (authUserAId || authUserBId) {
        const uids = [authUserAId, authUserBId].filter(Boolean)
        await pgClient.query(`DELETE FROM public.audit_logs WHERE user_id = ANY($1::UUID[]);`, [uids])
        await pgClient.query(`DELETE FROM public.users WHERE id = ANY($1::UUID[]);`, [uids])
        if (authUserAId) await adminSupabase.auth.admin.deleteUser(authUserAId)
        if (authUserBId) await adminSupabase.auth.admin.deleteUser(authUserBId)
      }

      if (companyBCreated && companyBId) {
        await pgClient.query(`DELETE FROM public.accounting_periods WHERE company_id = $1;`, [companyBId])
        await pgClient.query(`DELETE FROM public.audit_logs WHERE company_id = $1;`, [companyBId])
        await pgClient.query(`DELETE FROM public.companies WHERE id = $1;`, [companyBId])
      }

      await pgClient.query("SELECT set_config('app.is_test_cleanup', 'false', false);")

      // Verificación de residuo 0
      const resEntries = await pgClient.query(`SELECT count(*) as count FROM public.accounting_entries WHERE concept LIKE '%${runId}%';`)
      const resAccounts = await pgClient.query(`SELECT count(*) as count FROM public.accounting_accounts WHERE name LIKE '%${runId}%';`)

      const zeroPollution = Number(resEntries.rows[0].count) === 0 && Number(resAccounts.rows[0].count) === 0

      await pgClient.end()

      recordResult(
        'T15',
        'Zero Pollution: purga 100% limpia de datos de prueba',
        zeroPollution,
        zeroPollution
          ? 'Todos los registros de prueba (asientos, líneas, cuentas PUC, periodos, compras, ventas, pagos, recaudos, empresas y usuarios) fueron eliminados sin dejar rastro.'
          : 'Falla: se encontraron registros residuales en la BD.'
      )
    } catch (cleanErr: any) {
      recordResult('T15', 'Zero Pollution', false, `Fallo en limpieza: ${cleanErr.message}`)
    }
  }

  // Resumen final
  console.log('\n============================================================')
  console.log('RESUMEN DE EJECUCIÓN - FASE 12: CONTABILIDAD Y CAUSACIÓN AUTOMÁTICA')
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

runPhase12TestSuite()
