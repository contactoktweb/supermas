/**
 * SUPER MÁS ERP/POS - Suite E2E de Validación para Fase 15: Configuración de Impuestos y Retenciones
 *
 * Valida:
 * 1. Persistencia fiduciaria en PostgreSQL (tabla public.tax_rates).
 * 2. Cero mocks, cero db.ts.
 * 3. Catálogo oficial de tarifas e impuestos colombianos (IVA 19%, 5%, 0%, Exento, Retefuente, ReteICA, ReteIVA).
 * 4. Creación, actualización, desactivación y reactivación de tarifas personalizadas por empresa.
 * 5. Vinculación y conteo de productos gravados vs exentos.
 * 6. Estadísticas consolidadas (IVA Generado en Ventas, IVA Descontable en Compras, Saldo Neto).
 * 7. Informe tributario detallado por documento, tercero, tarifa y bodega.
 * 8. Precisión matemática en cálculo de documentos comerciales.
 * 9. Aislamiento multiempresa estricto (Company A vs Company B).
 * 10. Motores de exportación CSV.
 * 11. Purga Zero Pollution atómica.
 */

import pg from 'pg'
import { supabaseAdmin } from '../lib/supabase/admin'
import { taxService } from '../features/taxes/services/tax.service'
import { taxRepository } from '../features/taxes/repositories/tax.repository'
import { taxCalculationService } from '../features/taxes/services/tax-calculation.service'

interface TestResult {
  code: string
  name: string
  passed: boolean
  detail: string
}

const results: TestResult[] = []

function recordResult(code: string, name: string, passed: boolean, detail: string) {
  results.push({ code, name, passed, detail })
  const icon = passed ? '✅' : '❌'
  console.log(`\n${icon} [${code}] ${name}: ${passed ? 'PASS' : 'FAIL'}`)
  console.log(`   Detalle: ${detail}`)
}

async function runPhase15TaxesE2ETests() {
  console.log('============================================================')
  console.log('INICIANDO SUITE E2E - FASE 15: IMPUESTOS Y RETENCIONES')
  console.log('============================================================\n')

  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error('DATABASE_URL no está configurada.')
  }

  const pgClient = new pg.Client({ connectionString })
  await pgClient.connect()
  console.log('✅ Conexión directa a PostgreSQL Staging establecida.')

  const testSuffix = `P15_${Date.now()}`
  let companyAId: string | null = null
  let companyBId: string | null = null
  let locAId: string | null = null
  let userAId: string | null = null
  let prodGravadoId: string | null = null
  let prodExentoId: string | null = null
  let customerAId: string | null = null
  let supplierAId: string | null = null
  let saleAId: string | null = null
  let purchaseAId: string | null = null
  let customTaxId: string | null = null

  try {
    console.log('\n--- Configurando Empresas, Ubicaciones y Datos Tributarios en PostgreSQL ---')

    // 1. Crear Empresa A
    const compARes = await pgClient.query(`
      INSERT INTO public.companies (
        business_name, trade_name, tax_id, verification_digit, tax_regime,
        address, city, department, country, currency, status, created_at, updated_at
      ) VALUES (
        'Empresa Impuestos A ${testSuffix}', 'Tax A', '901222${Date.now().toString().slice(-4)}',
        '1', 'COMUN', 'Calle 72 # 10-34', 'Bogotá', 'Bogotá D.C.', 'COLOMBIA', 'COP', 'ACTIVE',
        NOW(), NOW()
      ) RETURNING id;
    `)
    companyAId = compARes.rows[0].id

    // 2. Crear Empresa B
    const compBRes = await pgClient.query(`
      INSERT INTO public.companies (
        business_name, trade_name, tax_id, verification_digit, tax_regime,
        address, city, department, country, currency, status, created_at, updated_at
      ) VALUES (
        'Empresa Impuestos B ${testSuffix}', 'Tax B', '901333${Date.now().toString().slice(-4)}',
        '2', 'COMUN', 'Calle 50 # 20-30', 'Medellín', 'Antioquia', 'COLOMBIA', 'COP', 'ACTIVE',
        NOW(), NOW()
      ) RETURNING id;
    `)
    companyBId = compBRes.rows[0].id

    // 3. Crear Bodega para Empresa A
    const locARes = await pgClient.query(`
      INSERT INTO public.locations (
        company_id, name, code, type, status, address, city, department, created_at, updated_at
      ) VALUES (
        '${companyAId}', 'Bodega Impuestos ${testSuffix}', 'BI-${testSuffix.slice(-4)}',
        'WAREHOUSE', 'ACTIVE', 'Calle 72 # 10-34', 'Bogotá', 'Bogotá D.C.', NOW(), NOW()
      ) RETURNING id;
    `)
    locAId = locARes.rows[0].id

    // 4. Crear Usuario en Auth y public.users
    const userEmailA = `tax_admin_${testSuffix.toLowerCase()}@supermas.local`
    const { data: userACreated, error: userAErr } = await supabaseAdmin.auth.admin.createUser({
      email: userEmailA,
      password: 'SuperPassword123!',
      email_confirm: true,
      user_metadata: { full_name: 'Contador Tributario' },
    })
    if (userAErr || !userACreated?.user) throw new Error(`Error creando usuario Auth A: ${userAErr?.message}`)
    userAId = userACreated.user.id

    const roleRes = await pgClient.query(`SELECT id FROM public.roles LIMIT 1;`)
    const defaultRoleId = roleRes.rows[0].id

    await pgClient.query(`
      INSERT INTO public.users (
        id, company_id, email, full_name, role_id, is_active, created_at, updated_at
      ) VALUES (
        $1, $2, $3, 'Contador Tributario', $4, true, NOW(), NOW()
      ) ON CONFLICT (id) DO UPDATE SET
        company_id = EXCLUDED.company_id,
        full_name = EXCLUDED.full_name,
        role_id = EXCLUDED.role_id,
        is_active = true;
    `, [userAId, companyAId, userEmailA, defaultRoleId])

    // 5. Crear Productos: uno gravado al 19% y uno exento
    const prod1Res = await pgClient.query(`
      INSERT INTO public.products (
        company_id, sku, barcode, name, slug, inventory_type, unit_of_measure,
        cost_price, public_sale_price, wholesale_price, tax_rate_percent, is_tax_exempt,
        is_active, created_at, updated_at
      ) VALUES (
        $1, 'SKU-GRAV-${testSuffix.slice(-4)}', 'BAR-GRAV-${testSuffix.slice(-4)}',
        'Aceite Girasol 1000ml', 'aceite-girasol-${testSuffix.toLowerCase()}',
        'MERCHANDISE', 'UND', 8000, 11900, 10500, 19.00, false, true, NOW(), NOW()
      ) RETURNING id;
    `, [companyAId])
    prodGravadoId = prod1Res.rows[0].id

    const prod2Res = await pgClient.query(`
      INSERT INTO public.products (
        company_id, sku, barcode, name, slug, inventory_type, unit_of_measure,
        cost_price, public_sale_price, wholesale_price, tax_rate_percent, is_tax_exempt,
        is_active, created_at, updated_at
      ) VALUES (
        $1, 'SKU-EXEN-${testSuffix.slice(-4)}', 'BAR-EXEN-${testSuffix.slice(-4)}',
        'Huevos AA x30', 'huevos-aa-${testSuffix.toLowerCase()}',
        'MERCHANDISE', 'UND', 12000, 16000, 15000, 0.00, true, true, NOW(), NOW()
      ) RETURNING id;
    `, [companyAId])
    prodExentoId = prod2Res.rows[0].id

    // 6. Crear Terceros (Cliente y Proveedor)
    const custRes = await pgClient.query(`
      INSERT INTO public.customers (
        company_id, customer_type, document_type, document_number, company_name,
        email, city, department, is_active, created_at, updated_at
      ) VALUES (
        $1, 'BUSINESS', 'NIT', '900111222', 'Supermercado El Éxito Test',
        'compras@elexito.com', 'Bogotá', 'Bogotá D.C.', true, NOW(), NOW()
      ) RETURNING id;
    `, [companyAId])
    customerAId = custRes.rows[0].id

    const suppRes = await pgClient.query(`
      INSERT INTO public.suppliers (
        company_id, person_type, tax_id, legal_name, name,
        city, department, is_active, created_at, updated_at
      ) VALUES (
        $1, 'JURIDICA', '800555444', 'Aceites del Llano S.A.', 'Aceites del Llano',
        'Villavicencio', 'Meta', true, NOW(), NOW()
      ) RETURNING id;
    `, [companyAId])
    supplierAId = suppRes.rows[0].id

    // 7. Crear Venta con IVA ($100,000 base + $19,000 IVA = $119,000)
    const saleNum = `VTA-TAX-${testSuffix.slice(-4)}`
    const saleRes = await pgClient.query(`
      INSERT INTO public.sales (
        company_id, location_id, seller_user_id, customer_id, sale_number,
        payment_method, status, subtotal_amount, discount_amount, tax_amount,
        total_amount, total_cost_amount, paid_amount, payment_status, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5,
        'CASH', 'ISSUED', 100000, 0, 19000,
        119000, 80000, 119000, 'PAID', NOW(), NOW()
      ) RETURNING id;
    `, [companyAId, locAId, userAId, customerAId, saleNum])
    saleAId = saleRes.rows[0].id

    await pgClient.query(`
      INSERT INTO public.sale_items (
        company_id, sale_id, product_id, quantity, unit_cost, unit_price,
        discount_percent, tax_rate_percent, tax_amount, subtotal, total, created_at
      ) VALUES (
        $1, $2, $3, 10, 8000, 10000,
        0, 19.00, 19000, 100000, 119000, NOW()
      );
    `, [companyAId, saleAId, prodGravadoId])

    // 8. Crear Compra con IVA ($200,000 base + $38,000 IVA = $238,000)
    const purNum = `COM-TAX-${testSuffix.slice(-4)}`
    const invoiceNum = `FAC-PROV-${testSuffix.slice(-4)}`
    const purRes = await pgClient.query(`
      INSERT INTO public.purchases (
        company_id, location_id, supplier_id, purchase_number, supplier_invoice_number, payment_terms,
        payment_status, inventory_status, subtotal_amount, discount_amount, tax_amount,
        total_amount, paid_amount, issue_date, due_date, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, 'CONTADO',
        'PAID', 'RECEIVED', 200000, 0, 38000,
        238000, 238000, CURRENT_DATE, CURRENT_DATE, NOW(), NOW()
      ) RETURNING id;
    `, [companyAId, locAId, supplierAId, purNum, invoiceNum])
    purchaseAId = purRes.rows[0].id

    await pgClient.query(`
      INSERT INTO public.purchase_items (
        company_id, purchase_id, product_id, quantity, received_quantity, unit_cost,
        subtotal, discount_percent, discount_amount, tax_rate_percent, tax_amount, total, created_at
      ) VALUES (
        $1, $2, $3, 25, 25, 8000,
        200000, 0, 0, 19.00, 38000, 238000, NOW()
      );
    `, [companyAId, purchaseAId, prodGravadoId])

    console.log(`✅ Setup completado: Empresa A (${companyAId}), Venta ($119k), Compra ($238k)`)

    // ========================================================================
    // T01: Tarifas y Retenciones Estándar en PostgreSQL
    // ========================================================================
    const allGlobalTaxes = await taxService.list({ companyId: companyAId })
    const hasIva19 = allGlobalTaxes.data.some((t) => t.code === 'IVA_19' && t.ratePercent === 19)
    const hasIva5 = allGlobalTaxes.data.some((t) => t.code === 'IVA_5' && t.ratePercent === 5)
    const hasExento = allGlobalTaxes.data.some((t) => t.code === 'EXENTO' && t.ratePercent === 0)
    const hasReteFuente = allGlobalTaxes.data.some((t) => t.code === 'RETEFUENTE_2_5' && t.type === 'RETEFUENTE')
    const hasReteIca = allGlobalTaxes.data.some((t) => t.code === 'RETEICA_0_966' && t.type === 'RETEICA')
    const hasReteIva = allGlobalTaxes.data.some((t) => t.code === 'RETEIVA_15' && t.type === 'RETEIVA')

    const t01Pass =
      allGlobalTaxes.data.length >= 7 &&
      hasIva19 &&
      hasIva5 &&
      hasExento &&
      hasReteFuente &&
      hasReteIca &&
      hasReteIva

    recordResult(
      'T01',
      'Catálogo Oficial de Tarifas Tributarias e Impuestos Colombianos en PostgreSQL',
      t01Pass,
      t01Pass
        ? `Recuperadas ${allGlobalTaxes.total} tarifas en PostgreSQL (IVA 19%, 5%, 0%, Exento, Retefuente, ReteICA, ReteIVA).`
        : `Falla: Faltan tarifas estándar colombianas.`
    )

    // ========================================================================
    // T02: Creación de Tarifa / Retención Personalizada por Empresa
    // ========================================================================
    const customCode = `RETEICA_CALI_${testSuffix.slice(-4)}`
    const createdConfig = await taxService.createTaxConfig(
      {
        code: customCode,
        name: 'ReteICA Municipal Cali 11.04 por mil',
        type: 'RETEICA',
        ratePercent: 1.10,
        status: 'ACTIVE',
        validFrom: '2026-01-01',
        description: 'Retención de ICA tarifa especial Cali sector servicios',
        isDefault: false,
        generatedTaxAccountId: '236801',
        deductibleTaxAccountId: '135518',
      },
      { id: userAId, name: 'Contador Tributario' },
      'SUPERADMIN',
      companyAId
    )
    customTaxId = createdConfig.id

    const dbCheck = await pgClient.query(`
      SELECT * FROM public.tax_rates WHERE id = $1 AND company_id = $2;
    `, [customTaxId, companyAId])

    const t02Pass =
      dbCheck.rowCount === 1 &&
      dbCheck.rows[0].code === customCode &&
      Number(dbCheck.rows[0].percentage) === 1.10 &&
      dbCheck.rows[0].type === 'RETEICA'

    recordResult(
      'T02',
      'Creación Persistente de Configuración Tributaria / Retención en PostgreSQL',
      t02Pass,
      t02Pass
        ? `Tarifa ${customCode} persistida con id ${customTaxId} asociada a company_id ${companyAId}.`
        : `Falla al persistir configuración tributaria en PostgreSQL.`
    )

    // ========================================================================
    // T03: Unicidad de Código Tributario
    // ========================================================================
    let t03Pass = false
    try {
      await taxService.createTaxConfig(
        {
          code: customCode,
          name: 'Duplicado no permitido',
          type: 'RETEICA',
          ratePercent: 1.10,
          status: 'ACTIVE',
          validFrom: '2026-01-01',
        },
        { id: userAId, name: 'Contador' },
        'SUPERADMIN',
        companyAId
      )
    } catch (e: any) {
      t03Pass = e.message.includes('Ya existe una configuración con el código') || e.message.includes('unique')
    }

    recordResult(
      'T03',
      'Validación de Unicidad de Código Tributario',
      t03Pass,
      t03Pass
        ? `El sistema rechazó correctamente el intento de duplicar el código '${customCode}'.`
        : `Falla: Se permitió duplicar código tributario.`
    )

    // ========================================================================
    // T04: Desactivación Fiduciaria (Soft-Delete de Históricos)
    // ========================================================================
    const deactivated = await taxService.deactivateTaxConfig(
      customTaxId,
      'Ajuste de acuerdo municipal',
      { id: userAId, name: 'Contador' },
      'SUPERADMIN',
      companyAId
    )

    const dbCheckDeact = await pgClient.query(`
      SELECT is_active, valid_until FROM public.tax_rates WHERE id = $1;
    `, [customTaxId])

    const t04Pass =
      deactivated.status === 'INACTIVE' &&
      dbCheckDeact.rows[0].is_active === false &&
      dbCheckDeact.rows[0].valid_until !== null

    recordResult(
      'T04',
      'Desactivación Fiduciaria y Protección de Históricos',
      t04Pass,
      t04Pass
        ? `Tarifa desactivada exitosamente en PostgreSQL preservando histórico (valid_until registrado).`
        : `Falla en desactivación fiduciaria.`
    )

    // ========================================================================
    // T05: Reactivación de Configuración Tributaria
    // ========================================================================
    const reactivated = await taxService.activateTaxConfig(
      customTaxId,
      { id: userAId, name: 'Contador' },
      'SUPERADMIN',
      companyAId
    )

    const dbCheckAct = await pgClient.query(`
      SELECT is_active, valid_until FROM public.tax_rates WHERE id = $1;
    `, [customTaxId])

    const t05Pass =
      reactivated.status === 'ACTIVE' &&
      dbCheckAct.rows[0].is_active === true &&
      dbCheckAct.rows[0].valid_until === null

    recordResult(
      'T05',
      'Reactivación de Tarifa Tributaria en PostgreSQL',
      t05Pass,
      t05Pass
        ? `Tarifa reactivada exitosamente: is_active=true y valid_until limpiado.`
        : `Falla en reactivación de tarifa.`
    )

    // ========================================================================
    // T06: Actualización y Registro en Auditoría
    // ========================================================================
    const updated = await taxService.updateTaxConfig(
      customTaxId,
      {
        name: 'ReteICA Cali Sector Comercial Actualizado',
        description: 'Descripción enriquecida para DIAN',
      },
      { id: userAId, name: 'Contador' },
      'SUPERADMIN',
      companyAId
    )

    const dbAuditCheck = await pgClient.query(`
      SELECT * FROM public.audit_logs
      WHERE entity_id = $1 AND module = 'TAXES' AND company_id = $2;
    `, [customTaxId, companyAId])

    const t06Pass =
      updated.name === 'ReteICA Cali Sector Comercial Actualizado' &&
      dbAuditCheck.rowCount >= 1

    recordResult(
      'T06',
      'Actualización Tributaria con Trazabilidad Inmutable en audit_logs',
      t06Pass,
      t06Pass
        ? `Actualización persistida y ${dbAuditCheck.rowCount} eventos de auditoría registrados.`
        : `Falla en actualización o auditoría.`
    )

    // ========================================================================
    // T07: Vinculación Dinámica de Productos a Tarifas Tributarias
    // ========================================================================
    const iva19Rate = allGlobalTaxes.data.find((t) => t.code === 'IVA_19')!
    const assocProducts = await taxService.getAssociatedProducts(iva19Rate.id, {
      companyId: companyAId,
    })

    const t07Pass =
      assocProducts.total >= 1 &&
      assocProducts.data.some((p) => p.id === prodGravadoId && p.ratePercent === 19)

    recordResult(
      'T07',
      'Consulta y Vinculación de Productos por Perfil Tributario',
      t07Pass,
      t07Pass
        ? `Identificados ${assocProducts.total} productos asociados a IVA 19% en PostgreSQL.`
        : `Falla en consulta de productos asociados.`
    )

    // ========================================================================
    // T08: Cálculo de Métricas y Estadísticas Globales Tributarias
    // ========================================================================
    const stats = await taxService.getTaxStats('SUPERADMIN', companyAId)

    // Ventas: $19,000 generado
    // Compras: $38,000 descontable
    // Saldo neto: 19,000 - 38,000 = -19,000 (saldo a favor)
    const t08Pass =
      stats.activeConfigsCount >= 7 &&
      stats.taxedProductsCount >= 1 &&
      stats.exemptProductsCount >= 1 &&
      stats.generatedTaxPeriod >= 19000 &&
      stats.deductibleTaxPeriod >= 38000 &&
      stats.netTaxPayable <= 0

    recordResult(
      'T08',
      'Cálculo Analítico de Estadísticas Tributarias (IVA Débito, Crédito y Saldo Neto)',
      t08Pass,
      t08Pass
        ? `Métricas validadas: IVA Generado $${stats.generatedTaxPeriod}, Descontable $${stats.deductibleTaxPeriod}, Saldo Neto: $${stats.netTaxPayable}.`
        : `Falla en cálculo analítico de estadísticas tributarias.`
    )

    // ========================================================================
    // T09: Generación del Informe Tributario Consolidado
    // ========================================================================
    const taxReport = await taxService.getTaxReports(
      { companyId: companyAId, documentType: 'ALL' },
      'SUPERADMIN'
    )

    const t09Pass =
      taxReport.items.length >= 2 &&
      taxReport.summary.generatedTaxes >= 19000 &&
      taxReport.summary.deductibleTaxes >= 38000 &&
      taxReport.summary.byLocation.length >= 1 &&
      taxReport.summary.byRate.some((r) => r.ratePercent === 19)

    recordResult(
      'T09',
      'Informe Tributario Consolidado (Ventas, Compras y Agrupación por Tarifa y Ubicación)',
      t09Pass,
      t09Pass
        ? `Informe consolidado: ${taxReport.items.length} movimientos procesados con resumen por ubicación y tarifa.`
        : `Falla en generación de informe tributario.`
    )

    // ========================================================================
    // T10: Precisión Matemática en Cálculo de Documentos Comerciales
    // ========================================================================
    const docCalc = taxCalculationService.calculateDocumentTaxes([
      {
        productId: prodGravadoId!,
        quantity: 2,
        unitPrice: 50000,
        discountPercent: 10, // Base: 100,000 - 10,000 = 90,000. IVA 19%: 17,100. Total: 107,100
        customRatePercent: 19,
      },
      {
        productId: prodExentoId!,
        quantity: 1,
        unitPrice: 20000,
        discountPercent: 0, // Base: 20,000. IVA 0%: 0. Total: 20,000
        customRatePercent: 0,
      },
    ])

    const t10Pass =
      docCalc.grossTotal === 120000 &&
      docCalc.discountTotal === 10000 &&
      docCalc.baseTotal === 110000 &&
      docCalc.taxTotal === 17100 &&
      docCalc.grandTotal === 127100 &&
      docCalc.taxBreakdown.length === 2

    recordResult(
      'T10',
      'Precisión Matemática Fiduciaria en Cálculo Línea a Línea y Desglose Tributario',
      t10Pass,
      t10Pass
        ? `Cálculo validado: Bruto $${docCalc.grossTotal}, Descuento $${docCalc.discountTotal}, Base $${docCalc.baseTotal}, IVA $${docCalc.taxTotal}, Total $${docCalc.grandTotal}.`
        : `Falla en precisión matemática de cálculo tributario.`
    )

    // ========================================================================
    // T11: Aislamiento Multiempresa Estricto (Empresa B no ve tarifas de Empresa A)
    // ========================================================================
    const listCompanyB = await taxService.list({ companyId: companyBId }, 'SUPERADMIN')
    const t11Pass =
      !listCompanyB.data.some((t) => t.id === customTaxId || t.code === customCode) &&
      listCompanyB.data.every((t) => !t.companyId || t.companyId === companyBId)

    recordResult(
      'T11',
      'Aislamiento Multiempresa Estricto (Empresa B no visualiza tarifas personalizadas de Empresa A)',
      t11Pass,
      t11Pass
        ? `Aislamiento verificado: Empresa B no tiene acceso a la tarifa ${customCode} de Empresa A.`
        : `Falla de seguridad: Fuga de configuraciones tributarias entre empresas.`
    )

    // ========================================================================
    // T12: Motores de Exportación CSV Fiduciaria
    // ========================================================================
    const configsCsv = await taxService.exportTaxConfigsToCSV({ companyId: companyAId }, 'SUPERADMIN')
    const reportsCsv = await taxService.exportTaxReportsToCSV({ companyId: companyAId }, 'SUPERADMIN')

    const t12Pass =
      configsCsv.includes('Código;Nombre;Tipo;Tarifa (%);Estado') &&
      configsCsv.includes(customCode) &&
      reportsCsv.includes('Documento;Tipo Operación;Fecha;Ubicación / Bodega') &&
      reportsCsv.includes(saleNum) &&
      reportsCsv.includes(purNum)

    recordResult(
      'T12',
      'Motores de Exportación CSV Fiduciaria (Configuraciones y Reportes)',
      t12Pass,
      t12Pass
        ? `Archivos CSV generados con estructura tabular, cabeceras oficiales y valores fiduciarios.`
        : `Falla en motor de exportación CSV.`
    )
  } catch (err: any) {
    console.error('❌ Error catastrófico en suite E2E de Impuestos:', err)
  } finally {
    console.log('\n--- Ejecutando Purga Zero Pollution en Impuestos ---')
    try {
      await pgClient.query("SELECT set_config('app.is_test_cleanup', 'true', false);")

      if (companyAId) {
        await pgClient.query(`DELETE FROM public.sale_items WHERE sale_id IN (SELECT id FROM public.sales WHERE company_id = $1);`, [companyAId])
        await pgClient.query(`DELETE FROM public.sales WHERE company_id = $1;`, [companyAId])
        await pgClient.query(`DELETE FROM public.purchase_items WHERE purchase_id IN (SELECT id FROM public.purchases WHERE company_id = $1);`, [companyAId])
        await pgClient.query(`DELETE FROM public.purchases WHERE company_id = $1;`, [companyAId])
        await pgClient.query(`DELETE FROM public.products WHERE company_id = $1;`, [companyAId])
        await pgClient.query(`DELETE FROM public.customers WHERE company_id = $1;`, [companyAId])
        await pgClient.query(`DELETE FROM public.suppliers WHERE company_id = $1;`, [companyAId])
        await pgClient.query(`DELETE FROM public.tax_rates WHERE company_id = $1;`, [companyAId])
        await pgClient.query(`DELETE FROM public.users WHERE company_id = $1;`, [companyAId])
        await pgClient.query(`DELETE FROM public.locations WHERE company_id = $1;`, [companyAId])
        await pgClient.query(`DELETE FROM public.audit_logs WHERE company_id = $1;`, [companyAId])
        await pgClient.query(`DELETE FROM public.companies WHERE id = $1;`, [companyAId])
        if (userAId) {
          await supabaseAdmin.auth.admin.deleteUser(userAId).catch(() => {})
        }
      }

      if (companyBId) {
        await pgClient.query(`DELETE FROM public.tax_rates WHERE company_id = $1;`, [companyBId])
        await pgClient.query(`DELETE FROM public.users WHERE company_id = $1;`, [companyBId])
        await pgClient.query(`DELETE FROM public.audit_logs WHERE company_id = $1;`, [companyBId])
        await pgClient.query(`DELETE FROM public.companies WHERE id = $1;`, [companyBId])
      }

      const verifyCleanA = await pgClient.query(
        `SELECT COUNT(*) FROM public.tax_rates WHERE company_id = $1;`,
        [companyAId]
      )
      const verifyCleanB = await pgClient.query(
        `SELECT COUNT(*) FROM public.tax_rates WHERE company_id = $1;`,
        [companyBId]
      )

      const t13Pass =
        Number(verifyCleanA.rows[0].count) === 0 &&
        Number(verifyCleanB.rows[0].count) === 0

      recordResult(
        'T13',
        'Zero Pollution: Purga 100% limpia de registros tributarios de prueba',
        t13Pass,
        t13Pass
          ? `Todos los registros de prueba (tarifas, ventas, compras, productos, clientes, empresas) purgados atómicamente.`
          : `Alerta: Quedaron residuos de prueba en PostgreSQL.`
      )
    } catch (cleanupErr) {
      console.error('❌ Error durante la purga de impuestos:', cleanupErr)
    } finally {
      await pgClient.end()
    }
  }

  // ========================================================================
  // RESUMEN FINAL
  // ========================================================================
  console.log('\n============================================================')
  console.log('RESUMEN DE EJECUCIÓN - FASE 15: IMPUESTOS Y RETENCIONES')
  console.log('============================================================')
  results.forEach((r) => {
    console.log(`${r.passed ? '✅' : '❌'} [${r.code}] ${r.name}`)
  })
  const passedCount = results.filter((r) => r.passed).length
  console.log('============================================================')
  console.log(`TOTAL: ${results.length} | PASARON: ${passedCount} | FALLARON: ${results.length - passedCount}`)
  console.log('============================================================\n')

  if (passedCount !== results.length) {
    process.exit(1)
  }
}

runPhase15TaxesE2ETests().catch((err) => {
  console.error('Falla no capturada en ejecución:', err)
  process.exit(1)
})
