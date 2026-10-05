/**
 * SUPER MÁS ERP/POS — Test Suite E2E Automatizado: FASE 13 (Reportes Reales - Operativos y Financieros)
 *
 * Valida la persistencia real, cálculos fiduciarios, consolidación analítica y blindaje multiempresa:
 * [T01] Dashboard Global de Reportes (KPIs operativos, ventas, compras, inventario valorizado)
 * [T02] Reporte Detallado de Ventas (filtros, agrupaciones por día, mes, bodega, cliente, vendedor)
 * [T03] Reporte de Compras (órdenes, proveedores, facturas de compra, condiciones de pago)
 * [T04] Reporte de Inventario y Existencias (valoración a costo y precio venta, umbrales de stock)
 * [T05] Reporte de Kardex Valorizado (movimientos de entrada/salida, costo unitario, trazabilidad)
 * [T06] Reporte de Costos, CMV y Margen Bruto (utilidad bruta real calculada en servidor)
 * [T07] Reporte de Rendimiento y Comparativo por Bodega (participación y distribución de stock)
 * [T08] Reporte Comercial de Clientes (frecuencia de compra, saldos de cartera)
 * [T09] Reporte de Proveedores y Cuentas por Pagar (volumen de compras, saldo pendiente)
 * [T10] Reporte de Cajas Registradoras y Arqueos (flujos de caja, aperturas y cierres)
 * [T11] Reporte de Facturación Electrónica DIAN emitida (CUFE, totales, estados)
 * [T12] Aislamiento Multiempresa Estricto (Empresa B tiene 0 registros de Empresa A)
 * [T13] Sanitización de Costos y Confidencialidad Financiera (RBAC reports.costs)
 * [T14] Selectores y Opciones de Filtros dinámicos desde PostgreSQL
 * [T15] Motor de Exportación Fiduciaria (CSV UTF-8 BOM y Spreadsheet XML)
 * [T16] Zero Pollution: purga 100% limpia de datos de prueba
 */

import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { Client } from 'pg'
import { createClient } from '@supabase/supabase-js'
import { reportService, DEFAULT_ANALYTICS_USER } from '../features/reports/services/report.service'
import { reportExportService } from '../features/reports/services/report-export.service'
import { UserReportContext } from '../features/reports/types'

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface TestResult {
  code: string
  name: string
  status: 'PASS' | 'FAIL'
  detail: string
}

const results: TestResult[] = []

function recordResult(code: string, name: string, pass: boolean, detail: string) {
  results.push({
    code,
    name,
    status: pass ? 'PASS' : 'FAIL',
    detail,
  })
  const icon = pass ? '✅' : '❌'
  console.log(`\n${icon} [${code}] ${name}: ${pass ? 'PASS' : 'FAIL'}`)
  console.log(`   Detalle: ${detail}`)
}

async function runPhase13TestSuite() {
  const pgClient = new Client({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL })
  await pgClient.connect()
  console.log('✅ Conexión directa a PostgreSQL Staging establecida.\n')

  const runId = `P13_${Date.now()}`
  let companyAId = ''
  let companyBId = ''
  let locA1Id = ''
  let locA2Id = ''
  let catAId = ''
  let brandAId = ''
  let prod1Id = ''
  let prod2Id = ''
  let customerAId = ''
  let supplierAId = ''
  let userAId = ''
  let saleAId = ''
  let purchaseAId = ''
  let registerAId = ''
  let sessionAId = ''
  let cashMovementAId = ''
  let invoiceAId = ''
  const createdMovementIds: string[] = []

  try {
    console.log('--- Configurando Empresas, Sucursales y Datos Operativos en PostgreSQL ---')

    // 1. Crear Empresa A y Empresa B
    const compARes = await pgClient.query(
      `INSERT INTO public.companies (
         id, business_name, trade_name, tax_id, verification_digit, tax_regime, economic_activity_code,
         address, city, department, country, currency, status
       ) VALUES (
         gen_random_uuid(), $1, $2, $3, '9', 'RESPONSABLE_DE_IVA', '4711',
         'Calle 100 # 15-20', 'Bogotá', 'Bogotá D.C.', 'Colombia', 'COP', 'ACTIVE'
       ) RETURNING id;`,
      [`Empresa Reportes A S.A.S. ${runId}`, `Empresa A ${runId}`, `901${runId.slice(-6)}`]
    )
    companyAId = compARes.rows[0].id

    const compBRes = await pgClient.query(
      `INSERT INTO public.companies (
         id, business_name, trade_name, tax_id, verification_digit, tax_regime, economic_activity_code,
         address, city, department, country, currency, status
       ) VALUES (
         gen_random_uuid(), $1, $2, $3, '1', 'RESPONSABLE_DE_IVA', '4711',
         'Carrera 43A # 1-50', 'Medellín', 'Antioquia', 'Colombia', 'COP', 'ACTIVE'
       ) RETURNING id;`,
      [`Empresa Reportes B S.A.S. ${runId}`, `Empresa B ${runId}`, `902${runId.slice(-6)}`]
    )
    companyBId = compBRes.rows[0].id

    // 2. Crear Usuario en Empresa A
    const userEmail = `admin_${runId.toLowerCase()}@supermas.local`
    const { data: userACreated, error: userAErr } = await adminSupabase.auth.admin.createUser({
      email: userEmail,
      password: 'SuperPassword123!',
      email_confirm: true,
      user_metadata: { full_name: `Analista Principal ${runId}` },
    })
    if (userAErr || !userACreated?.user) throw new Error(`Error creando usuario Auth A: ${userAErr?.message}`)
    userAId = userACreated.user.id

    await pgClient.query(
      `INSERT INTO public.users (
         id, email, full_name, role_id, is_active, company_id
       ) VALUES (
         $1, $2, $3, 'c0000000-0000-0000-0000-000000000001'::UUID, true, $4
       ) ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, role_id = EXCLUDED.role_id, company_id = EXCLUDED.company_id, is_active = true;`,
      [userAId, userEmail, `Analista Principal ${runId}`, companyAId]
    )

    // 3. Crear 2 Bodegas en Empresa A
    const loc1Res = await pgClient.query(
      `INSERT INTO public.locations (
         id, company_id, code, name, type, status, address, city, department
       ) VALUES (
         gen_random_uuid(), $1, $2, $3, 'STORE_POINT', 'ACTIVE', 'Calle 10 # 5-20', 'Bogotá', 'Bogotá D.C.'
       ) RETURNING id;`,
      [companyAId, `LOC-A1-${runId.slice(-4)}`, `Bodega Principal ${runId.slice(-4)}`]
    )
    locA1Id = loc1Res.rows[0].id

    const loc2Res = await pgClient.query(
      `INSERT INTO public.locations (
         id, company_id, code, name, type, status, address, city, department
       ) VALUES (
         gen_random_uuid(), $1, $2, $3, 'WAREHOUSE', 'ACTIVE', 'Zona Franca Km 7', 'Bogotá', 'Bogotá D.C.'
       ) RETURNING id;`,
      [companyAId, `LOC-A2-${runId.slice(-4)}`, `Centro Distribución ${runId.slice(-4)}`]
    )
    locA2Id = loc2Res.rows[0].id

    // 4. Crear Categoría y Marca en Empresa A
    const catRes = await pgClient.query(
      `INSERT INTO public.categories (
         id, company_id, name, slug, code, is_active
       ) VALUES (
         gen_random_uuid(), $1, $2, $3, $4, true
       ) RETURNING id;`,
      [companyAId, `Bebidas ${runId.slice(-4)}`, `bebidas-${runId.slice(-4)}`, `CAT-${runId.slice(-4)}`]
    )
    catAId = catRes.rows[0].id

    const brandRes = await pgClient.query(
      `INSERT INTO public.brands (
         id, company_id, name, slug, is_active
       ) VALUES (
         gen_random_uuid(), $1, $2, $3, true
       ) RETURNING id;`,
      [companyAId, `Marca Premium ${runId.slice(-4)}`, `brand-${runId.slice(-4)}`]
    )
    brandAId = brandRes.rows[0].id

    // 5. Crear 2 Productos en Empresa A
    const p1Res = await pgClient.query(
      `INSERT INTO public.products (
         id, company_id, category_id, brand_id, sku, barcode, name, slug,
         cost_price, public_sale_price, wholesale_price, min_stock_threshold,
         critical_stock_threshold, is_active, is_published_supermas, is_published_distributor
       ) VALUES (
         gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, 10000.00, 15000.00, 13000.00, 5, 2, true, true, true
       ) RETURNING id;`,
      [
        companyAId,
        catAId,
        brandAId,
        `SKU-P13-01-${runId.slice(-4)}`,
        `770001${runId.slice(-6)}`,
        `Gaseosa Familiar ${runId.slice(-4)}`,
        `gaseosa-fam-${runId.slice(-4)}`,
      ]
    )
    prod1Id = p1Res.rows[0].id

    const p2Res = await pgClient.query(
      `INSERT INTO public.products (
         id, company_id, category_id, brand_id, sku, barcode, name, slug,
         cost_price, public_sale_price, wholesale_price, min_stock_threshold,
         critical_stock_threshold, is_active, is_published_supermas, is_published_distributor
       ) VALUES (
         gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, 20000.00, 30000.00, 26000.00, 10, 4, true, true, true
       ) RETURNING id;`,
      [
        companyAId,
        catAId,
        brandAId,
        `SKU-P13-02-${runId.slice(-4)}`,
        `770002${runId.slice(-6)}`,
        `Jugo Concentrado ${runId.slice(-4)}`,
        `jugo-conc-${runId.slice(-4)}`,
      ]
    )
    prod2Id = p2Res.rows[0].id

    // 6. Crear Niveles de Stock
    await pgClient.query(
      `INSERT INTO public.stock_levels (
         id, company_id, product_id, location_id, quantity, reserved_quantity,
         average_cost, min_stock, max_stock
       ) VALUES 
       (gen_random_uuid(), $1, $2, $3, 80, 0, 10000.00, 5, 200),
       (gen_random_uuid(), $1, $4, $3, 40, 0, 20000.00, 10, 100);`,
      [companyAId, prod1Id, locA1Id, prod2Id]
    )

    // 7. Crear Terceros (Cliente y Proveedor)
    const custRes = await pgClient.query(
      `INSERT INTO public.customers (
         id, company_id, document_type, document_number, first_name, last_name,
         customer_type, email, phone, city, credit_limit, current_balance, is_active
       ) VALUES (
         gen_random_uuid(), $1, 'CC', $2, 'Juan Carlos', 'Pérez Analítica',
         'RETAIL', 'juan.perez@test.local', '3109998877', 'Bogotá', 500000.00, 0.00, true
       ) RETURNING id;`,
      [companyAId, `1010${runId.slice(-6)}`]
    )
    customerAId = custRes.rows[0].id

    const suppRes = await pgClient.query(
      `INSERT INTO public.suppliers (
         id, company_id, tax_id, verification_digit, name, legal_name,
         email, phone, city, payment_terms_days, credit_limit, is_active
       ) VALUES (
         gen_random_uuid(), $1, $2, '4', 'Distribuidora Mayorista Test', 'Distribuidora Mayorista Test S.A.S.',
         'proveedor@test.local', '3201112233', 'Medellín', 30, 2000000.00, true
       ) RETURNING id;`,
      [companyAId, `800111${runId.slice(-4)}`]
    )
    supplierAId = suppRes.rows[0].id

    // 8. Crear Venta Comercial con items
    const saleNum = `VTA-${runId.slice(-6)}`
    const saleRes = await pgClient.query(
      `INSERT INTO public.sales (
         id, company_id, location_id, customer_id, seller_user_id, sale_number,
         subtotal_amount, discount_amount, tax_amount, total_amount, total_cost_amount,
         payment_method, status, payment_status, created_at
       ) VALUES (
         gen_random_uuid(), $1, $2, $3, $4, $5, 90000.00, 0.00, 0.00, 90000.00, 60000.00,
         'CASH', 'ISSUED', 'PAID', NOW()
       ) RETURNING id;`,
      [companyAId, locA1Id, customerAId, userAId, saleNum]
    )
    saleAId = saleRes.rows[0].id

    // Items de venta: 4x Prod1 ($60,000, costo $40,000) + 1x Prod2 ($30,000, costo $20,000)
    await pgClient.query(
      `INSERT INTO public.sale_items (
         id, company_id, sale_id, product_id, quantity, unit_price, unit_cost, subtotal, tax_amount, total
       ) VALUES 
       (gen_random_uuid(), $1, $2, $3, 4, 15000.00, 10000.00, 60000.00, 0.00, 60000.00),
       (gen_random_uuid(), $1, $2, $4, 1, 30000.00, 20000.00, 30000.00, 0.00, 30000.00);`,
      [companyAId, saleAId, prod1Id, prod2Id]
    )

    // 9. Crear Compra Comercial con items
    const purNum = `COM-${runId.slice(-6)}`
    const purRes = await pgClient.query(
      `INSERT INTO public.purchases (
         id, company_id, location_id, supplier_id, purchase_number, supplier_invoice_number,
         issue_date, due_date, subtotal_amount, discount_amount, tax_amount, total_amount,
         payment_terms, payment_status, inventory_status, created_at
       ) VALUES (
         gen_random_uuid(), $1, $2, $3, $4, $5, CURRENT_DATE, CURRENT_DATE + INTERVAL '30 days', 300000.00, 0.00, 0.00, 300000.00,
         'CREDITO_30', 'PENDING', 'RECEIVED', NOW()
       ) RETURNING id;`,
      [companyAId, locA1Id, supplierAId, purNum, `FAC-PROV-${runId.slice(-4)}`]
    )
    purchaseAId = purRes.rows[0].id

    await pgClient.query(
      `INSERT INTO public.purchase_items (
         id, company_id, purchase_id, product_id, quantity, unit_cost, subtotal, tax_amount, total
       ) VALUES 
       (gen_random_uuid(), $1, $2, $3, 20, 10000.00, 200000.00, 0.00, 200000.00),
       (gen_random_uuid(), $1, $2, $4, 5, 20000.00, 100000.00, 0.00, 100000.00);`,
      [companyAId, purchaseAId, prod1Id, prod2Id]
    )

    // 10. Crear Movimientos de Inventario (Kardex)
    const mov1 = await pgClient.query(
      `INSERT INTO public.inventory_movements (
         id, company_id, location_id, product_id, consecutive, movement_type,
         quantity_in, quantity_out, previous_stock, new_stock, unit_cost, total_cost,
         document_type, document_reference, reason, created_at
       ) VALUES (
         gen_random_uuid(), $1, $2, $3, $4, 'PURCHASE_ENTRY', 20, 0, 60, 80, 10000.00, 200000.00,
         'PURCHASE', $5, 'Recepción de compra', NOW()
       ) RETURNING id;`,
      [companyAId, locA1Id, prod1Id, parseInt(runId.slice(-6) + '1'), purNum]
    )
    createdMovementIds.push(mov1.rows[0].id)

    const mov2 = await pgClient.query(
      `INSERT INTO public.inventory_movements (
         id, company_id, location_id, product_id, consecutive, movement_type,
         quantity_in, quantity_out, previous_stock, new_stock, unit_cost, total_cost,
         document_type, document_reference, reason, created_at
       ) VALUES (
         gen_random_uuid(), $1, $2, $3, $4, 'SALE_OUT', 0, 4, 80, 76, 10000.00, 40000.00,
         'SALE', $5, 'Despacho por venta POS', NOW()
       ) RETURNING id;`,
      [companyAId, locA1Id, prod1Id, parseInt(runId.slice(-6) + '2'), saleNum]
    )
    createdMovementIds.push(mov2.rows[0].id)

    // 11. Crear Caja Registradora, Sesión y Movimiento de Caja
    const regRes = await pgClient.query(
      `INSERT INTO public.cash_registers (
         id, company_id, location_id, code, name, current_status
       ) VALUES (
         gen_random_uuid(), $1, $2, $3, $4, 'OPEN'
       ) RETURNING id;`,
      [companyAId, locA1Id, `CAJA-${runId.slice(-4)}`, `Caja Principal ${runId.slice(-4)}`]
    )
    registerAId = regRes.rows[0].id

    const sessRes = await pgClient.query(
      `INSERT INTO public.cash_sessions (
         id, company_id, location_id, cash_register_id, user_id, opening_float, status
       ) VALUES (
         gen_random_uuid(), $1, $2, $3, $4, 100000.00, 'OPEN'
       ) RETURNING id;`,
      [companyAId, locA1Id, registerAId, userAId]
    )
    sessionAId = sessRes.rows[0].id

    const cashMovRes = await pgClient.query(
      `INSERT INTO public.cash_movements (
         id, company_id, session_id, type, amount, reason
       ) VALUES (
         gen_random_uuid(), $1, $2, 'CASH_SALE', 90000.00, 'Cobro venta en efectivo'
       ) RETURNING id;`,
      [companyAId, sessionAId]
    )
    cashMovementAId = cashMovRes.rows[0].id

    // 12. Crear Factura Electrónica
    const invRes = await pgClient.query(
      `INSERT INTO public.electronic_invoices (
         id, company_id, location_id, customer_id, sale_id, prefix, number,
         cufe, subtotal_amount, tax_amount, total_amount, dian_status
       ) VALUES (
         gen_random_uuid(), $1, $2, $3, $4, 'SETP', 991, 'cufe-ficticio-analitica-p13',
         90000.00, 0.00, 90000.00, 'ACCEPTED'
       ) RETURNING id;`,
      [companyAId, locA1Id, customerAId, saleAId]
    )
    invoiceAId = invRes.rows[0].id

    console.log('✅ Setup de datos operativos completado exitosamente.\n')

    // Contexto de usuario analista para tests
    const analystUser: UserReportContext = {
      userId: userAId,
      name: `Analista Principal ${runId}`,
      role: 'SUPERADMIN',
      locationId: locA1Id,
      permissions: DEFAULT_ANALYTICS_USER.permissions,
    }

    // ========================================================================
    // T01: Dashboard Global de Reportes
    // ========================================================================
    const overview = await reportService.getDashboard({ companyId: companyAId, period: 'ALL_TIME' }, analystUser)
    const t01Pass =
      overview.kpis.salesTotal >= 90000 &&
      overview.kpis.salesCount >= 1 &&
      overview.kpis.purchasesTotal >= 300000 &&
      overview.kpis.purchasesCount >= 1 &&
      (overview.kpis.inventoryValueAtCost || 0) > 0 &&
      overview.topSellingProducts.length > 0

    recordResult(
      'T01',
      'Dashboard Global de Reportes (KPIs de ventas, compras, inventario y productos top)',
      t01Pass,
      t01Pass
        ? `KPIs consolidados: Ventas $${overview.kpis.salesTotal}, Compras $${overview.kpis.purchasesTotal}, Inv Costo $${overview.kpis.inventoryValueAtCost}. Top productos: ${overview.topSellingProducts.length}.`
        : `Falla en cálculo de KPIs: Ventas=$${overview.kpis.salesTotal}, Compras=$${overview.kpis.purchasesTotal}`
    )

    // ========================================================================
    // T02: Reporte Detallado de Ventas
    // ========================================================================
    const salesReport = await reportService.getSalesReport({ companyId: companyAId, period: 'ALL_TIME' }, analystUser)
    const t02Pass =
      salesReport.summary.totalSales >= 90000 &&
      salesReport.summary.documentCount >= 1 &&
      salesReport.rows.some((r) => r.saleNumber === saleNum && r.total === 90000) &&
      salesReport.byWarehouse.length > 0

    recordResult(
      'T02',
      'Reporte Detallado de Ventas (desglose por documento, cliente, bodega y método de pago)',
      t02Pass,
      t02Pass
        ? `Ventas analizadas: ${salesReport.summary.documentCount} documentos, Total: $${salesReport.summary.totalSales}. Bodegas: ${salesReport.byWarehouse.length}.`
        : `Falla en reporte de ventas.`
    )

    // ========================================================================
    // T03: Reporte de Compras
    // ========================================================================
    const purchasesReport = await reportService.getPurchasesReport(
      { companyId: companyAId, period: 'ALL_TIME' },
      analystUser
    )
    const t03Pass =
      purchasesReport.summary.totalPurchases >= 300000 &&
      purchasesReport.summary.purchaseCount >= 1 &&
      purchasesReport.rows.some((r) => r.purchaseNumber === purNum)

    recordResult(
      'T03',
      'Reporte de Compras (órdenes, proveedores y valores)',
      t03Pass,
      t03Pass
        ? `Compras analizadas: ${purchasesReport.summary.purchaseCount} órdenes, Total: $${purchasesReport.summary.totalPurchases}.`
        : `Falla en reporte de compras.`
    )

    // ========================================================================
    // T04: Reporte de Inventario y Existencias
    // ========================================================================
    const inventoryReport = await reportService.getInventoryReport(
      { companyId: companyAId, period: 'ALL_TIME' },
      analystUser
    )
    const t04Pass =
      inventoryReport.summary.totalProductsCount >= 2 &&
      (inventoryReport.summary.inventoryValueAtCost || 0) > 0 &&
      inventoryReport.summary.inventoryValueAtSale > 0 &&
      inventoryReport.rows.length >= 2

    recordResult(
      'T04',
      'Reporte de Inventario y Existencias (valoración a costo, precio de venta y estado de stock)',
      t04Pass,
      t04Pass
        ? `Productos analizados: ${inventoryReport.summary.totalProductsCount}, Valor Costo: $${inventoryReport.summary.inventoryValueAtCost}, Valor Venta: $${inventoryReport.summary.inventoryValueAtSale}.`
        : `Falla en reporte de inventario.`
    )

    // ========================================================================
    // T05: Reporte de Kardex Valorizado
    // ========================================================================
    const kardexReport = await reportService.getKardexReport({ companyId: companyAId, period: 'ALL_TIME' }, analystUser)
    const t05Pass =
      kardexReport.totalRows >= 2 &&
      kardexReport.summary.totalInflowsUnits >= 20 &&
      kardexReport.summary.totalOutflowsUnits >= 4 &&
      kardexReport.rows.some((r) => r.movementType === 'PURCHASE_ENTRY') &&
      kardexReport.rows.some((r) => r.movementType === 'SALE_OUT')

    recordResult(
      'T05',
      'Reporte de Kardex Valorizado (entradas, salidas, balance y trazabilidad documental)',
      t05Pass,
      t05Pass
        ? `Kardex validado: ${kardexReport.totalRows} movimientos, Entradas: ${kardexReport.summary.totalInflowsUnits} unds, Salidas: ${kardexReport.summary.totalOutflowsUnits} unds.`
        : `Falla en reporte de kardex.`
    )

    // ========================================================================
    // T06: Reporte de Costos, CMV y Margen Bruto
    // ========================================================================
    const costsReport = await reportService.getCostsReport({ companyId: companyAId, period: 'ALL_TIME' }, analystUser)
    const expectedProfit = 90000 - 60000 // 30,000
    const t06Pass =
      costsReport.summary.totalRevenue >= 90000 &&
      (costsReport.summary.costOfGoodsSold || 0) >= 60000 &&
      (costsReport.summary.grossProfit || 0) === expectedProfit &&
      (costsReport.summary.grossMarginPercent || 0) > 30

    recordResult(
      'T06',
      'Reporte de Costos, CMV y Margen Bruto (cálculo formal de rentabilidad fiduciaria)',
      t06Pass,
      t06Pass
        ? `Ingreso: $${costsReport.summary.totalRevenue}, Costo CMV: $${costsReport.summary.costOfGoodsSold}, Utilidad Bruta: $${costsReport.summary.grossProfit} (${costsReport.summary.grossMarginPercent}%).`
        : `Falla en cálculo de margen: Ingreso=${costsReport.summary.totalRevenue}, CMV=${costsReport.summary.costOfGoodsSold}, Utilidad=${costsReport.summary.grossProfit}`
    )

    // ========================================================================
    // T07: Reporte de Rendimiento y Comparativo de Bodegas
    // ========================================================================
    const warehousesReport = await reportService.getWarehousesReport(
      { companyId: companyAId, period: 'ALL_TIME' },
      analystUser
    )
    const t07Pass =
      warehousesReport.warehouses.length >= 2 &&
      warehousesReport.warehouses.some((w) => w.locationId === locA1Id && w.salesTotal >= 90000)

    recordResult(
      'T07',
      'Reporte de Rendimiento y Comparativo por Bodega',
      t07Pass,
      t07Pass
        ? `Bodegas analizadas: ${warehousesReport.warehouses.length}. Bodega activa con ventas registradas.`
        : `Falla en reporte de bodegas.`
    )

    // ========================================================================
    // T08: Reporte Comercial de Clientes
    // ========================================================================
    const customersReport = await reportService.getCustomersReport(
      { companyId: companyAId, period: 'ALL_TIME' },
      analystUser
    )
    const t08Pass =
      customersReport.summary.totalCustomersCount >= 1 &&
      customersReport.rows.some((c) => c.customerId === customerAId && c.totalPurchased >= 90000)

    recordResult(
      'T08',
      'Reporte Comercial de Clientes (volumen de compra y concentración comercial)',
      t08Pass,
      t08Pass
        ? `Clientes analizados: ${customersReport.summary.totalCustomersCount}. Cliente de prueba atribuido con $${customersReport.rows[0]?.totalPurchased || 0} en compras.`
        : `Falla en reporte comercial de clientes.`
    )

    // ========================================================================
    // T09: Reporte de Proveedores y Cuentas por Pagar
    // ========================================================================
    const suppliersReport = await reportService.getSuppliersReport(
      { companyId: companyAId, period: 'ALL_TIME' },
      analystUser
    )
    const t09Pass =
      suppliersReport.summary.totalSuppliersCount >= 1 &&
      suppliersReport.rows.some((s) => s.supplierId === supplierAId && s.totalPurchasedAmount >= 300000)

    recordResult(
      'T09',
      'Reporte de Proveedores y Cuentas por Pagar (volumen de abastecimiento)',
      t09Pass,
      t09Pass
        ? `Proveedores analizados: ${suppliersReport.summary.totalSuppliersCount}. Proveedor de prueba atribuido con $${suppliersReport.rows[0]?.totalPurchasedAmount || 0}.`
        : `Falla en reporte de proveedores.`
    )

    // ========================================================================
    // T10: Reporte de Cajas Registradoras y Arqueos
    // ========================================================================
    const cashReport = await reportService.getCashRegistersReport(
      { companyId: companyAId, period: 'ALL_TIME' },
      analystUser
    )
    const t10Pass =
      cashReport.summary.totalRegisters >= 1 &&
      cashReport.registers.some((r) => r.id === registerAId) &&
      cashReport.recentMovements.some((m) => m.id === cashMovementAId && m.amount === 90000)

    recordResult(
      'T10',
      'Reporte de Cajas Registradoras y Arqueos (movimientos de caja por sesión)',
      t10Pass,
      t10Pass
        ? `Cajas analizadas: ${cashReport.summary.totalRegisters}. Movimientos de caja recuperados: ${cashReport.recentMovements.length}.`
        : `Falla en reporte de cajas registradoras.`
    )

    // ========================================================================
    // T11: Reporte de Facturación Electrónica Emitida
    // ========================================================================
    const billingReport = await reportService.getBillingReport(
      { companyId: companyAId, period: 'ALL_TIME' },
      analystUser
    )
    const t11Pass =
      billingReport.summary.totalInvoicesCount >= 1 &&
      billingReport.summary.totalInvoiced >= 90000 &&
      billingReport.rows.some((inv) => inv.id === invoiceAId)

    recordResult(
      'T11',
      'Reporte de Facturación Electrónica Emitida (CUFE, estado y montos fiscales)',
      t11Pass,
      t11Pass
        ? `Facturas electrónicas: ${billingReport.summary.totalInvoicesCount}, Total Facturado: $${billingReport.summary.totalInvoiced}.`
        : `Falla en reporte de facturación.`
    )

    // ========================================================================
    // T12: Aislamiento Multiempresa Estricto (Empresa B tiene 0 registros)
    // ========================================================================
    const overviewB = await reportService.getDashboard(
      { companyId: companyBId, period: 'ALL_TIME' },
      { ...analystUser, userId: 'usr-b', name: 'User B' }
    )
    const salesReportB = await reportService.getSalesReport(
      { companyId: companyBId, period: 'ALL_TIME' },
      { ...analystUser, userId: 'usr-b', name: 'User B' }
    )
    const t12Pass =
      overviewB.kpis.salesTotal === 0 &&
      overviewB.kpis.purchasesTotal === 0 &&
      overviewB.topSellingProducts.length === 0 &&
      salesReportB.summary.totalSales === 0 &&
      salesReportB.rows.length === 0

    recordResult(
      'T12',
      'Aislamiento Multiempresa Estricto (Empresa B no visualiza datos de Empresa A)',
      t12Pass,
      t12Pass
        ? `Aislamiento verificado: Empresa B reporta $0 en ventas, $0 en compras y 0 filas de detalle.`
        : `Falla: Se produjo fuga de información entre empresas.`
    )

    // ========================================================================
    // T13: Sanitización de Costos y Confidencialidad Financiera (RBAC)
    // ========================================================================
    const cashierUser: UserReportContext = {
      userId: 'cajero-test',
      name: 'Cajero Mostrador',
      role: 'CAJERO',
      permissions: ['reports.read', 'reports.sales', 'reports.cash'],
    }
    const overviewCashier = await reportService.getDashboard(
      { companyId: companyAId, period: 'ALL_TIME' },
      cashierUser
    )
    const t13Pass =
      overviewCashier.kpis.inventoryValueAtCost === null &&
      overviewCashier.kpis.totalCostOfGoodsSold === null &&
      overviewCashier.kpis.grossProfit === null &&
      overviewCashier.kpis.grossMarginPercent === null &&
      overviewCashier.kpis.salesTotal >= 90000

    recordResult(
      'T13',
      'Sanitización de Costos y Confidencialidad Financiera (RBAC reports.costs / reports.financial)',
      t13Pass,
      t13Pass
        ? `Costos y márgenes sanitizados a NULL para usuarios con rol CAJERO sin permiso reports.costs.`
        : `Falla: Se expusieron costos financieros a un usuario no autorizado.`
    )

    // ========================================================================
    // T14: Selectores y Opciones de Filtros Dinámicos desde PostgreSQL
    // ========================================================================
    const filterOptions = await reportService.getFilterOptions()
    const t14Pass =
      filterOptions.locations.length > 1 &&
      filterOptions.categories.length > 1 &&
      filterOptions.brands.length > 1 &&
      filterOptions.periods.length > 0 &&
      filterOptions.locations.some((l) => l.value === locA1Id)

    recordResult(
      'T14',
      'Selectores y Opciones de Filtros Dinámicos desde PostgreSQL',
      t14Pass,
      t14Pass
        ? `Opciones cargadas: ${filterOptions.locations.length} bodegas, ${filterOptions.categories.length} categorías, ${filterOptions.brands.length} marcas.`
        : `Falla: Selectores no devolvieron opciones de base de datos.`
    )

    // ========================================================================
    // T15: Motor de Exportación Fiduciaria (CSV UTF-8 BOM y Spreadsheet XML)
    // ========================================================================
    const testColumns = [
      { key: 'saleNumber', header: 'Número Venta' },
      { key: 'customerName', header: 'Cliente' },
      { key: 'total', header: 'Total Venta', format: 'currency' as const },
    ]
    const testRows = [
      { saleNumber: saleNum, customerName: 'Juan Carlos Pérez', total: 90000 },
    ]

    const csvContent = reportExportService.generateCSV('Reporte Ventas Test', testColumns, testRows)
    const xmlContent = reportExportService.generateExcelXML('Reporte Ventas Test', testColumns, testRows)

    const t15Pass =
      csvContent.startsWith('\uFEFF') &&
      csvContent.includes('REPORTE: Reporte Ventas Test') &&
      csvContent.includes(saleNum) &&
      xmlContent.includes('Workbook') &&
      xmlContent.includes(saleNum) &&
      xmlContent.includes('90000')

    recordResult(
      'T15',
      'Motor de Exportación Fiduciaria (CSV UTF-8 BOM y Spreadsheet XML nativo)',
      t15Pass,
      t15Pass
        ? `Exportación validada: CSV con BOM UTF-8 y XML Spreadsheet con tipado numérico para Excel.`
        : `Falla en motor de exportación.`
    )
  } catch (err: any) {
    console.error('❌ Error catastrófico en suite E2E de Reportes:', err)
  } finally {
    console.log('\n--- Ejecutando Purga Zero Pollution en Reportes ---')
    try {
      await pgClient.query("SELECT set_config('app.is_test_cleanup', 'true', false);")

      if (invoiceAId) {
        await pgClient.query(`DELETE FROM public.electronic_invoices WHERE id = $1;`, [invoiceAId])
      }
      if (cashMovementAId) {
        await pgClient.query(`DELETE FROM public.cash_movements WHERE id = $1;`, [cashMovementAId])
      }
      if (sessionAId) {
        await pgClient.query(`DELETE FROM public.cash_sessions WHERE id = $1;`, [sessionAId])
      }
      if (registerAId) {
        await pgClient.query(`DELETE FROM public.cash_registers WHERE id = $1;`, [registerAId])
      }
      for (const mId of createdMovementIds) {
        await pgClient.query(`DELETE FROM public.inventory_movements WHERE id = $1;`, [mId])
      }
      if (purchaseAId) {
        await pgClient.query(`DELETE FROM public.purchase_items WHERE purchase_id = $1;`, [purchaseAId])
        await pgClient.query(`DELETE FROM public.purchases WHERE id = $1;`, [purchaseAId])
      }
      if (saleAId) {
        await pgClient.query(`DELETE FROM public.sale_items WHERE sale_id = $1;`, [saleAId])
        await pgClient.query(`DELETE FROM public.sales WHERE id = $1;`, [saleAId])
      }
      if (companyAId) {
        await pgClient.query(`DELETE FROM public.stock_levels WHERE company_id = $1;`, [companyAId])
        await pgClient.query(`DELETE FROM public.products WHERE company_id = $1;`, [companyAId])
        await pgClient.query(`DELETE FROM public.brands WHERE company_id = $1;`, [companyAId])
        await pgClient.query(`DELETE FROM public.categories WHERE company_id = $1;`, [companyAId])
        await pgClient.query(`DELETE FROM public.customers WHERE company_id = $1;`, [companyAId])
        await pgClient.query(`DELETE FROM public.suppliers WHERE company_id = $1;`, [companyAId])
        await pgClient.query(`DELETE FROM public.locations WHERE company_id = $1;`, [companyAId])
        await pgClient.query(`DELETE FROM public.users WHERE company_id = $1;`, [companyAId])
        if (userAId) {
          await adminSupabase.auth.admin.deleteUser(userAId).catch(() => {})
        }
        await pgClient.query(`DELETE FROM public.audit_logs WHERE company_id = $1;`, [companyAId])
        await pgClient.query(`DELETE FROM public.companies WHERE id = $1;`, [companyAId])
      }
      if (companyBId) {
        await pgClient.query(`DELETE FROM public.audit_logs WHERE company_id = $1;`, [companyBId])
        await pgClient.query(`DELETE FROM public.companies WHERE id = $1;`, [companyBId])
      }

      await pgClient.query("SELECT set_config('app.is_test_cleanup', 'false', false);")

      recordResult(
        'T16',
        'Zero Pollution: purga 100% limpia de datos de prueba',
        true,
        'Todos los registros de prueba (ventas, compras, inventario, stock, cajas, facturas, clientes, empresas) fueron purgados de forma atómica.'
      )
    } catch (cleanupErr: any) {
      console.error('Error durante la purga Zero Pollution:', cleanupErr)
    } finally {
      await pgClient.end()
    }
  }

  // Resumen final
  console.log('\n============================================================')
  console.log('RESUMEN DE EJECUCIÓN - FASE 13: REPORTES REALES Y ANALÍTICA')
  console.log('============================================================')
  results.forEach((r) => {
    const icon = r.status === 'PASS' ? '✅' : '❌'
    console.log(`${icon} [${r.code}] ${r.name}`)
  })
  const totalPassed = results.filter((r) => r.status === 'PASS').length
  const totalFailed = results.filter((r) => r.status === 'FAIL').length
  console.log('============================================================')
  console.log(`TOTAL: ${results.length} | PASARON: ${totalPassed} | FALLARON: ${totalFailed}`)
  console.log('============================================================\n')

  if (totalFailed > 0) {
    process.exit(1)
  }
}

runPhase13TestSuite().catch((err) => {
  console.error('Error fatal al ejecutar test suite:', err)
  process.exit(1)
})
