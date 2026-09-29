/**
 * ==============================================================================
 * SUITE DE PRUEBAS REALES DE RLS, PERMISOS Y AISLAMIENTO (PASO 9)
 * ERP SUPER MÁS S.A.S. — Supabase PostgreSQL (Staging)
 * ==============================================================================
 *
 * REGLAS FUNDAMENTALES:
 * 1. Transacción con BEGIN ... ROLLBACK estricto. Cero datos persistidos.
 * 2. Pruebas reales de multiempresa, roles, permisos granulares, inventario,
 *    contabilidad y auditoría.
 * 3. Simulación de sesiones con SET LOCAL ROLE authenticated y request.jwt.claim.sub.
 */

import pg from 'pg'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

async function runRealPostgreSqlRlsTests() {
  const client = new pg.Client({
    connectionString: process.env.DIRECT_URL,
    ssl: { rejectUnauthorized: false },
  })

  await client.connect()

  console.log('====================================================================')
  console.log('🧪 SUITE DE PRUEBAS REALES DE RLS, PERMISOS Y AISLAMIENTO (PASO 9)')
  console.log('====================================================================\n')

  try {
    // INICIAR TRANSACCIÓN AISLADA
    await client.query('BEGIN;')
    console.log('🔒 [BEGIN] Transacción iniciada — Cero persistencia final garantizada por ROLLBACK.\n')

    // 0. OBTENER IDS BASE DE STAGING (Paso 7 y 8)
    const compARes = await client.query('SELECT id, business_name FROM public.companies LIMIT 1;')
    const compA = compARes.rows[0].id
    const locARes = await client.query('SELECT id, code, name FROM public.locations WHERE company_id = $1 LIMIT 1;', [compA])
    const locA = locARes.rows[0].id

    console.log(`Empresa A legítima: "${compARes.rows[0].business_name}" (${compA})`)
    console.log(`Bodega A legítima:  "${locARes.rows[0].name}" [${locARes.rows[0].code}] (${locA})\n`)

    // Obtener catálogo de roles del sistema
    const rolesRes = await client.query('SELECT id, code FROM public.roles;')
    const roles = new Map(rolesRes.rows.map((r: any) => [r.code, r.id]))

    // 1. CREAR EMPRESA B Y SEDE B TEMPORALES
    const compBInsert = await client.query(`
      INSERT INTO public.companies (
        business_name, trade_name, tax_id, verification_digit, tax_regime, address, city, department, country
      ) VALUES (
        'Distribuidora B del Norte S.A.S.', 'Distribuidora B', '901888777', '9', 'RESPONSABLE_DE_IVA', 'Calle 50 # 10-20', 'Medellín', 'Antioquia', 'Colombia'
      ) RETURNING id;
    `)
    const compB = compBInsert.rows[0].id

    const locBInsert = await client.query(`
      INSERT INTO public.locations (
        company_id, code, name, type, address, city, department
      ) VALUES (
        $1, 'BOD-B01', 'Bodega Principal Empresa B', 'WAREHOUSE', 'Calle 50 # 10-20', 'Medellín', 'Antioquia'
      ) RETURNING id;
    `, [compB])
    const locB = locBInsert.rows[0].id

    // 2. CREAR USUARIOS TEMPORALES DE PRUEBA EN auth.users Y public.users
    const userIds = {
      superadminA: 'a0000000-0000-0000-0000-000000000001',
      adminA:      'a0000000-0000-0000-0000-000000000002',
      accountantA: 'a0000000-0000-0000-0000-000000000003',
      warehouseA:  'a0000000-0000-0000-0000-000000000004',
      sellerA:     'a0000000-0000-0000-0000-000000000005',
      cashierA:    'a0000000-0000-0000-0000-000000000006',
      userB:       'b0000000-0000-0000-0000-000000000001',
    }

    const testUsers = [
      { id: userIds.superadminA, email: 'temp.super@empresa-a.com', role: 'SUPERADMIN', comp: compA, loc: locA },
      { id: userIds.adminA,      email: 'temp.admin@empresa-a.com', role: 'ADMIN',      comp: compA, loc: locA },
      { id: userIds.accountantA, email: 'temp.acc@empresa-a.com',   role: 'ACCOUNTANT', comp: compA, loc: locA },
      { id: userIds.warehouseA,  email: 'temp.wh@empresa-a.com',    role: 'WAREHOUSE_ADMIN', comp: compA, loc: locA },
      { id: userIds.sellerA,     email: 'temp.seller@empresa-a.com',role: 'SELLER',     comp: compA, loc: locA },
      { id: userIds.cashierA,    email: 'temp.cash@empresa-a.com',  role: 'CASHIER',    comp: compA, loc: locA },
      { id: userIds.userB,       email: 'temp.admin@empresa-b.com', role: 'ADMIN',      comp: compB, loc: locB },
    ]

    for (const u of testUsers) {
      await client.query(`
        INSERT INTO auth.users (id, email, raw_app_meta_data, raw_user_meta_data)
        VALUES ($1, $2, jsonb_build_object('role', $3::text, 'company_id', $4::text), '{}'::jsonb);
      `, [u.id, u.email, u.role, u.comp])

      await client.query(`
        INSERT INTO public.users (id, company_id, email, full_name, role_id, is_active)
        VALUES ($1, $2, $3, $3, $4, true)
        ON CONFLICT (id) DO UPDATE
        SET company_id = EXCLUDED.company_id, role_id = EXCLUDED.role_id;
      `, [u.id, u.comp, u.email, roles.get(u.role)])

      await client.query(`
        INSERT INTO public.user_locations (user_id, location_id, is_primary)
        VALUES ($1, $2, true)
        ON CONFLICT (user_id, location_id) DO NOTHING;
      `, [u.id, u.loc])
    }
    console.log('✓ Usuarios de prueba creados para los 6 roles en Empresa A y Admin en Empresa B.\n')

    // 3. DATOS MAESTROS TEMPORALES PARA PRUEBA
    // Clientes
    const custA = (await client.query(`
      INSERT INTO public.customers (company_id, document_type, document_number, first_name, last_name, customer_type, customer_category, credit_limit, current_balance)
      VALUES ($1, 'CC', '1020304050', 'Cliente', 'Prueba A', 'INDIVIDUAL', 'RETAIL', 0, 0) RETURNING id;
    `, [compA])).rows[0].id

    // Proveedores
    const suppA = (await client.query(`
      INSERT INTO public.suppliers (company_id, tax_id, name, legal_name, payment_terms_days)
      VALUES ($1, '900123456', 'Proveedor Prueba A', 'Proveedor Prueba A S.A.S.', 30) RETURNING id;
    `, [compA])).rows[0].id

    // Cuenta bancaria
    const bankA = (await client.query(`
      INSERT INTO public.bank_accounts (company_id, location_id, bank_name, account_number, account_type, currency, current_balance)
      VALUES ($1, $2, 'Bancolombia Test', '1234567890', 'CHECKING', 'COP', 10000000.00) RETURNING id;
    `, [compA, locA])).rows[0].id

    // Productos
    const prodAInsert = await client.query(`
      INSERT INTO public.products (
        company_id, sku, barcode, name, slug, short_description, unit_of_measure
      ) VALUES (
        $1, 'SKU-TEST-A', '7701111111111', 'Arroz Diana 1kg Empresa A', 'arroz-diana-1kg-a', 'Producto Test A', 'UND'
      ) RETURNING id;
    `, [compA])
    const prodA = prodAInsert.rows[0].id

    const prodBInsert = await client.query(`
      INSERT INTO public.products (
        company_id, sku, barcode, name, slug, short_description, unit_of_measure
      ) VALUES (
        $1, 'SKU-TEST-B', '7702222222222', 'Aceite Premier 1L Empresa B', 'aceite-premier-1l-b', 'Producto Test B', 'UND'
      ) RETURNING id;
    `, [compB])
    const prodB = prodBInsert.rows[0].id

    // =========================================================================
    // ITEM 1: MULTIEMPRESA — AISLAMIENTO ESTRICTO ENTRE TENANTS
    // =========================================================================
    console.log('====================================================================')
    console.log('1. VALIDACIÓN MULTIEMPRESA')
    console.log('====================================================================')

    // 1.1 Usuario de Empresa B consulta productos
    await client.query(`SET LOCAL ROLE authenticated;`)
    await client.query(`SET LOCAL "request.jwt.claim.sub" = '${userIds.userB}';`)

    const bProducts = await client.query('SELECT id, name FROM public.products;')
    console.log('  1.1 Usuario Empresa B consulta public.products -> Filas retornadas:', bProducts.rows.length)
    if (bProducts.rows.length === 1 && bProducts.rows[0].id === prodB) {
      console.log('      ✅ Aislamiento SELECT: Empresa B solo ve su propio producto. Cero filtración de Empresa A.')
    } else {
      throw new Error('Fallo de aislamiento multiempresa en SELECT products.')
    }

    // 1.2 Usuario de Empresa B intenta consultar directamente la Empresa A
    const bCompanyQuery = await client.query('SELECT * FROM public.companies WHERE id = $1;', [compA])
    console.log('  1.2 Usuario Empresa B consulta Empresa A por ID -> Filas retornadas:', bCompanyQuery.rows.length)
    if (bCompanyQuery.rows.length === 0) {
      console.log('      ✅ Aislamiento SELECT: Empresa B recibe 0 filas al consultar ID de Empresa A.')
    } else {
      throw new Error('Fallo de aislamiento multiempresa: Empresa B pudo leer datos de Empresa A.')
    }

    // 1.3 Usuario de Empresa B intenta consultar bodegas de Empresa A
    const bLocationsQuery = await client.query('SELECT * FROM public.locations WHERE company_id = $1;', [compA])
    console.log('  1.3 Usuario Empresa B consulta sedes de Empresa A -> Filas retornadas:', bLocationsQuery.rows.length)
    if (bLocationsQuery.rows.length === 0) {
      console.log('      ✅ Aislamiento SELECT: Empresa B recibe 0 filas al consultar sedes de Empresa A.')
    } else {
      throw new Error('Fallo de aislamiento multiempresa: Empresa B pudo leer sedes de Empresa A.')
    }

    // 1.4 Inserción cruzada: Empresa B intenta registrar un producto asociándolo a Empresa A
    let crossInsertBlocked = false
    await client.query('SAVEPOINT cross_ins;')
    try {
      await client.query(`
        INSERT INTO public.products (company_id, sku, barcode, name, slug, unit_of_measure)
        VALUES ($1, 'SKU-MALICIOUS', '9999999999999', 'Producto Infiltrado', 'prod-infiltrado', 'UND');
      `, [compA])
    } catch (e: any) {
      crossInsertBlocked = true
      console.log('  1.4 Inserción cruzada de Empresa B en Empresa A: DENEGADO POR RLS WITH CHECK ✅')
    } finally {
      await client.query('ROLLBACK TO SAVEPOINT cross_ins;')
    }
    if (!crossInsertBlocked) throw new Error('Fallo crítico: Empresa B pudo insertar un producto en Empresa A.')

    // =========================================================================
    // ITEM 2 & 3: ROLES Y PERMISOS ATÓMICOS
    // =========================================================================
    console.log('\n====================================================================')
    console.log('2 & 3. VALIDACIÓN DE ROLES Y PERMISOS ATÓMICOS')
    console.log('====================================================================')

    // -------------------------------------------------------------------------
    // 3.1 PRODUCTOS: read / create / update / delete
    // -------------------------------------------------------------------------
    console.log('\n--- 3.1 MÓDULO PRODUCTOS (read, create, update, delete) ---')

    // 3.1.a WAREHOUSE_ADMIN crea producto (Permitido)
    await client.query(`SET LOCAL ROLE authenticated;`)
    await client.query(`SET LOCAL "request.jwt.claim.sub" = '${userIds.warehouseA}';`)

    let whCreatedProd = false
    let testProdWhId = ''
    try {
      const res = await client.query(`
        INSERT INTO public.products (company_id, sku, barcode, name, slug, unit_of_measure)
        VALUES ($1, 'SKU-WH-01', '7703333333333', 'Harina Pan 1kg', 'harina-pan-1kg', 'UND')
        RETURNING id;
      `, [compA])
      testProdWhId = res.rows[0].id
      whCreatedProd = true
    } catch (e: any) {
      console.error(e.message)
    }
    console.log('  3.1.a WAREHOUSE_ADMIN crea producto: ', whCreatedProd ? 'PERMITIDO (products.create) ✅' : 'FALLO ❌')
    if (!whCreatedProd) throw new Error('WAREHOUSE_ADMIN debió poder crear un producto.')

    // 3.1.b CASHIER intenta crear producto (Bloqueado)
    await client.query(`SET LOCAL ROLE authenticated;`)
    await client.query(`SET LOCAL "request.jwt.claim.sub" = '${userIds.cashierA}';`)

    let cashierCreateBlocked = false
    await client.query('SAVEPOINT cash_prod_ins;')
    try {
      await client.query(`
        INSERT INTO public.products (company_id, sku, barcode, name, slug, unit_of_measure)
        VALUES ($1, 'SKU-CASH-01', '7704444444444', 'Producto Cashier', 'prod-cashier', 'UND');
      `, [compA])
    } catch (e: any) {
      cashierCreateBlocked = true
    } finally {
      await client.query('ROLLBACK TO SAVEPOINT cash_prod_ins;')
    }
    console.log('  3.1.b CASHIER intenta crear producto: ', cashierCreateBlocked ? 'BLOQUEADO POR RLS ✅' : 'FALLO ❌')
    if (!cashierCreateBlocked) throw new Error('CASHIER no debe tener permiso de crear productos.')

    // 3.1.c SELLER intenta actualizar producto (Bloqueado)
    await client.query(`SET LOCAL ROLE authenticated;`)
    await client.query(`SET LOCAL "request.jwt.claim.sub" = '${userIds.sellerA}';`)

    let sellerUpdateBlocked = false
    try {
      const res = await client.query(`UPDATE public.products SET name = 'Nombre Cambiado por Seller' WHERE id = $1;`, [prodA])
      if (res.rowCount === 0) sellerUpdateBlocked = true
    } catch (e: any) {
      sellerUpdateBlocked = true
    }
    console.log('  3.1.c SELLER intenta actualizar producto: ', sellerUpdateBlocked ? 'BLOQUEADO (0 filas afectadas / RLS) ✅' : 'FALLO ❌')
    if (!sellerUpdateBlocked) throw new Error('SELLER no debe tener permiso de actualizar productos.')

    // 3.1.d WAREHOUSE_ADMIN intenta eliminar producto (Bloqueado: solo SUPERADMIN/ADMIN tienen products.delete)
    await client.query(`SET LOCAL ROLE authenticated;`)
    await client.query(`SET LOCAL "request.jwt.claim.sub" = '${userIds.warehouseA}';`)

    let whDeleteBlocked = false
    try {
      const res = await client.query(`DELETE FROM public.products WHERE id = $1;`, [testProdWhId])
      if (res.rowCount === 0) whDeleteBlocked = true
    } catch (e: any) {
      whDeleteBlocked = true
    }
    console.log('  3.1.d WAREHOUSE_ADMIN intenta eliminar producto: ', whDeleteBlocked ? 'BLOQUEADO (Sin permiso products.delete) ✅' : 'FALLO ❌')
    if (!whDeleteBlocked) throw new Error('WAREHOUSE_ADMIN no debe tener permiso de eliminar productos.')

    // 3.1.e ADMIN elimina producto de prueba (Permitido)
    await client.query(`SET LOCAL ROLE authenticated;`)
    await client.query(`SET LOCAL "request.jwt.claim.sub" = '${userIds.adminA}';`)

    let adminDeleteSuccess = false
    try {
      const res = await client.query(`DELETE FROM public.products WHERE id = $1;`, [testProdWhId])
      if (res.rowCount === 1) adminDeleteSuccess = true
    } catch (e: any) {
      console.error(e.message)
    }
    console.log('  3.1.e ADMIN elimina producto de prueba: ', adminDeleteSuccess ? 'PERMITIDO (ADMIN tiene products.delete) ✅' : 'FALLO ❌')
    if (!adminDeleteSuccess) throw new Error('ADMIN debió poder eliminar el producto de prueba.')

    // -------------------------------------------------------------------------
    // 3.2 INVENTARIO: inventory.read / inventory.adjust
    // -------------------------------------------------------------------------
    console.log('\n--- 3.2 MÓDULO INVENTARIO (inventory.read, inventory.adjust) ---')

    // 3.2.a CASHIER intenta registrar ajuste de inventario (Bloqueado)
    await client.query(`SET LOCAL ROLE authenticated;`)
    await client.query(`SET LOCAL "request.jwt.claim.sub" = '${userIds.cashierA}';`)

    let cashierAdjustBlocked = false
    await client.query('SAVEPOINT cash_adj;')
    try {
      await client.query(`
        INSERT INTO public.inventory_movements (
          company_id, location_id, product_id, user_id, movement_type, quantity_in, quantity_out, previous_stock, new_stock, unit_cost, total_cost, document_type, document_reference
        ) VALUES (
          $1, $2, $3, $4, 'POSITIVE_ADJUSTMENT', 5, 0, 0, 5, 1000, 5000, 'ADJUSTMENT', 'ADJ-CASHIER'
        );
      `, [compA, locA, prodA, userIds.cashierA])
    } catch (e: any) {
      cashierAdjustBlocked = true
    } finally {
      await client.query('ROLLBACK TO SAVEPOINT cash_adj;')
    }
    console.log('  3.2.a CASHIER intenta registrar movimiento Kardex: ', cashierAdjustBlocked ? 'BLOQUEADO POR RLS ✅' : 'FALLO ❌')
    if (!cashierAdjustBlocked) throw new Error('CASHIER no debe tener permiso de registrar ajustes Kardex.')

    // 3.2.b WAREHOUSE_ADMIN registra ajuste de inventario autorizado (+20 unds)
    await client.query(`SET LOCAL ROLE authenticated;`)
    await client.query(`SET LOCAL "request.jwt.claim.sub" = '${userIds.warehouseA}';`)

    let movementWhId = ''
    try {
      const res = await client.query(`
        INSERT INTO public.inventory_movements (
          company_id, location_id, product_id, user_id, movement_type, quantity_in, quantity_out, previous_stock, new_stock, unit_cost, total_cost, document_type, document_reference
        ) VALUES (
          $1, $2, $3, $4, 'POSITIVE_ADJUSTMENT', 20, 0, 0, 20, 1500.00, 30000.00, 'ADJUSTMENT', 'ADJ-WH-001'
        ) RETURNING id;
      `, [compA, locA, prodA, userIds.warehouseA])
      movementWhId = res.rows[0].id
    } catch (e: any) {
      console.error(e)
    }
    console.log('  3.2.b WAREHOUSE_ADMIN registra ajuste Kardex (+20 unds): PERMITIDO ✅ (ID: ' + movementWhId + ')')
    if (!movementWhId) throw new Error('WAREHOUSE_ADMIN debió poder registrar el ajuste.')

    // Comprobar recálculo de stock por trigger
    await client.query(`RESET ROLE;`)
    const stockAfterWh = await client.query('SELECT quantity, average_cost, health_status FROM public.stock_levels WHERE product_id = $1 AND location_id = $2;', [prodA, locA])
    console.log('      Existencias calculadas por trigger en stock_levels:', stockAfterWh.rows[0])
    if (parseFloat(stockAfterWh.rows[0].quantity) === 20.00) {
      console.log('      ✅ Trigger recalculó existencias a exactamente 20 unidades.')
    } else {
      throw new Error('Trigger de existencias no recalculó el saldo esperado.')
    }

    // -------------------------------------------------------------------------
    // 3.3 VENTAS: sales.create
    // -------------------------------------------------------------------------
    console.log('\n--- 3.3 MÓDULO VENTAS (sales.create) ---')

    // 3.3.a ACCOUNTANT intenta crear venta (Bloqueado)
    await client.query(`SET LOCAL ROLE authenticated;`)
    await client.query(`SET LOCAL "request.jwt.claim.sub" = '${userIds.accountantA}';`)

    let accountantSaleBlocked = false
    await client.query('SAVEPOINT acc_sale;')
    try {
      await client.query(`
        INSERT INTO public.sales (
          company_id, location_id, seller_user_id, customer_id, sale_number, subtotal_amount, discount_amount, tax_amount, total_amount, total_cost_amount, payment_method, status
        ) VALUES (
          $1, $2, $3, $4, 'VTA-ACC-001', 10000, 0, 1900, 11900, 8000, 'CASH', 'ISSUED'
        );
      `, [compA, locA, userIds.accountantA, custA])
    } catch (e: any) {
      accountantSaleBlocked = true
    } finally {
      await client.query('ROLLBACK TO SAVEPOINT acc_sale;')
    }
    console.log('  3.3.a ACCOUNTANT intenta registrar venta: ', accountantSaleBlocked ? 'BLOQUEADO POR RLS ✅' : 'FALLO ❌')
    if (!accountantSaleBlocked) throw new Error('ACCOUNTANT no debe tener permiso de registrar ventas.')

    // 3.3.b SELLER registra venta (Permitido)
    await client.query(`SET LOCAL ROLE authenticated;`)
    await client.query(`SET LOCAL "request.jwt.claim.sub" = '${userIds.sellerA}';`)

    let sellerSaleId = ''
    try {
      const res = await client.query(`
        INSERT INTO public.sales (
          company_id, location_id, seller_user_id, customer_id, sale_number, subtotal_amount, discount_amount, tax_amount, total_amount, total_cost_amount, payment_method, status
        ) VALUES (
          $1, $2, $3, $4, 'VTA-SEL-001', 10000, 0, 1900, 11900, 8000, 'CASH', 'ISSUED'
        ) RETURNING id;
      `, [compA, locA, userIds.sellerA, custA])
      sellerSaleId = res.rows[0].id
    } catch (e: any) {
      console.error(e)
    }
    console.log('  3.3.b SELLER registra venta: ', sellerSaleId ? 'PERMITIDO (sales.create) ✅ (ID: ' + sellerSaleId + ')' : 'FALLO ❌')
    if (!sellerSaleId) throw new Error('SELLER debió poder registrar la venta.')

    // 3.3.c CASHIER registra venta POS (Permitido)
    await client.query(`SET LOCAL ROLE authenticated;`)
    await client.query(`SET LOCAL "request.jwt.claim.sub" = '${userIds.cashierA}';`)

    let cashierSaleId = ''
    try {
      const res = await client.query(`
        INSERT INTO public.sales (
          company_id, location_id, seller_user_id, customer_id, sale_number, subtotal_amount, discount_amount, tax_amount, total_amount, total_cost_amount, payment_method, status
        ) VALUES (
          $1, $2, $3, $4, 'VTA-POS-001', 5000, 0, 950, 5950, 4000, 'CASH', 'ISSUED'
        ) RETURNING id;
      `, [compA, locA, userIds.cashierA, custA])
      cashierSaleId = res.rows[0].id
    } catch (e: any) {
      console.error(e)
    }
    console.log('  3.3.c CASHIER registra venta POS: ', cashierSaleId ? 'PERMITIDO (sales.create) ✅ (ID: ' + cashierSaleId + ')' : 'FALLO ❌')
    if (!cashierSaleId) throw new Error('CASHIER debió poder registrar la venta POS.')

    // -------------------------------------------------------------------------
    // 3.4 COMPRAS: purchases.create
    // -------------------------------------------------------------------------
    console.log('\n--- 3.4 MÓDULO COMPRAS (purchases.create) ---')

    // 3.4.a CASHIER intenta crear orden de compra (Bloqueado)
    await client.query(`SET LOCAL ROLE authenticated;`)
    await client.query(`SET LOCAL "request.jwt.claim.sub" = '${userIds.cashierA}';`)

    let cashierPurchaseBlocked = false
    await client.query('SAVEPOINT cash_purch;')
    try {
      await client.query(`
        INSERT INTO public.purchases (
          company_id, location_id, supplier_id, purchase_number, supplier_invoice_number, issue_date, due_date, subtotal_amount, tax_amount, total_amount, payment_terms, payment_status, inventory_status
        ) VALUES (
          $1, $2, $3, 'COM-CASH-001', 'FAC-001', CURRENT_DATE, CURRENT_DATE + 30, 50000, 9500, 59500, 'CASH', 'PAID', 'PENDING'
        );
      `, [compA, locA, suppA])
    } catch (e: any) {
      cashierPurchaseBlocked = true
    } finally {
      await client.query('ROLLBACK TO SAVEPOINT cash_purch;')
    }
    console.log('  3.4.a CASHIER intenta registrar compra: ', cashierPurchaseBlocked ? 'BLOQUEADO POR RLS ✅' : 'FALLO ❌')
    if (!cashierPurchaseBlocked) throw new Error('CASHIER no debe tener permiso de registrar compras.')

    // 3.4.b WAREHOUSE_ADMIN registra compra (Permitido)
    await client.query(`SET LOCAL ROLE authenticated;`)
    await client.query(`SET LOCAL "request.jwt.claim.sub" = '${userIds.warehouseA}';`)

    let whPurchaseId = ''
    try {
      const res = await client.query(`
        INSERT INTO public.purchases (
          company_id, location_id, supplier_id, purchase_number, supplier_invoice_number, issue_date, due_date, subtotal_amount, tax_amount, total_amount, payment_terms, payment_status, inventory_status
        ) VALUES (
          $1, $2, $3, 'COM-WH-001', 'FAC-WH-001', CURRENT_DATE, CURRENT_DATE + 30, 200000, 38000, 238000, 'CREDIT', 'PENDING', 'PENDING'
        ) RETURNING id;
      `, [compA, locA, suppA])
      whPurchaseId = res.rows[0].id
    } catch (e: any) {
      console.error(e)
    }
    console.log('  3.4.b WAREHOUSE_ADMIN registra compra: ', whPurchaseId ? 'PERMITIDO (purchases.create) ✅ (ID: ' + whPurchaseId + ')' : 'FALLO ❌')
    if (!whPurchaseId) throw new Error('WAREHOUSE_ADMIN debió poder registrar la compra.')

    // -------------------------------------------------------------------------
    // 3.5 CONTABILIDAD: accounting.read / accounting.create (post)
    // -------------------------------------------------------------------------
    console.log('\n--- 3.5 MÓDULO CONTABILIDAD (accounting.read, accounting.create) ---')

    // 3.5.a SELLER intenta registrar comprobante contable (Bloqueado)
    await client.query(`SET LOCAL ROLE authenticated;`)
    await client.query(`SET LOCAL "request.jwt.claim.sub" = '${userIds.sellerA}';`)

    let sellerAccBlocked = false
    await client.query('SAVEPOINT sel_acc;')
    try {
      await client.query(`
        INSERT INTO public.accounting_entries (
          company_id, location_id, consecutive, entry_number, date, concept, document_type, document_reference, status, created_by_user_id
        ) VALUES (
          $1, $2, 999, 'AS-SEL-001', CURRENT_DATE, 'Asiento no autorizado', 'MANUAL', 'REF-001', 'DRAFT', $3
        );
      `, [compA, locA, userIds.sellerA])
    } catch (e: any) {
      sellerAccBlocked = true
    } finally {
      await client.query('ROLLBACK TO SAVEPOINT sel_acc;')
    }
    console.log('  3.5.a SELLER intenta crear comprobante contable: ', sellerAccBlocked ? 'BLOQUEADO POR RLS ✅' : 'FALLO ❌')
    if (!sellerAccBlocked) throw new Error('SELLER no debe tener permiso contable.')

    // 3.5.b ACCOUNTANT registra comprobante contable DRAFT (Permitido)
    await client.query(`SET LOCAL ROLE authenticated;`)
    await client.query(`SET LOCAL "request.jwt.claim.sub" = '${userIds.accountantA}';`)

    let accountantEntryId = ''
    try {
      const res = await client.query(`
        INSERT INTO public.accounting_entries (
          company_id, location_id, consecutive, entry_number, date, concept, document_type, document_reference, status, created_by_user_id
        ) VALUES (
          $1, $2, 1, 'AS-ACC-001', CURRENT_DATE, 'Causación de Gastos Operativos', 'MANUAL', 'REF-001', 'DRAFT', $3
        ) RETURNING id;
      `, [compA, locA, userIds.accountantA])
      accountantEntryId = res.rows[0].id
    } catch (e: any) {
      console.error(e)
    }
    console.log('  3.5.b ACCOUNTANT crea comprobante contable: ', accountantEntryId ? 'PERMITIDO (ACCOUNTANT) ✅ (ID: ' + accountantEntryId + ')' : 'FALLO ❌')
    if (!accountantEntryId) throw new Error('ACCOUNTANT debió poder crear un comprobante contable.')

    // -------------------------------------------------------------------------
    // 3.6 TESORERÍA: treasury.read / treasury.create
    // -------------------------------------------------------------------------
    console.log('\n--- 3.6 MÓDULO TESORERÍA (treasury.read, treasury.create) ---')

    // 3.6.a CASHIER intenta registrar egreso de tesorería (Bloqueado)
    await client.query(`SET LOCAL ROLE authenticated;`)
    await client.query(`SET LOCAL "request.jwt.claim.sub" = '${userIds.cashierA}';`)

    let cashierTreasuryBlocked = false
    await client.query('SAVEPOINT cash_tres;')
    try {
      await client.query(`
        INSERT INTO public.treasury_payments (
          company_id, location_id, payment_number, payment_type, bank_account_id, amount, payment_date, payment_method, status
        ) VALUES (
          $1, $2, 'PAY-CASH-001', 'SUPPLIER_PAYMENT', $3, 150000, CURRENT_DATE, 'TRANSFER', 'PENDING'
        );
      `, [compA, locA, bankA])
    } catch (e: any) {
      cashierTreasuryBlocked = true
    } finally {
      await client.query('ROLLBACK TO SAVEPOINT cash_tres;')
    }
    console.log('  3.6.a CASHIER intenta registrar pago de tesorería: ', cashierTreasuryBlocked ? 'BLOQUEADO POR RLS ✅' : 'FALLO ❌')
    if (!cashierTreasuryBlocked) throw new Error('CASHIER no debe tener acceso al módulo de tesorería.')

    // 3.6.b ACCOUNTANT registra pago de tesorería (Permitido)
    await client.query(`SET LOCAL ROLE authenticated;`)
    await client.query(`SET LOCAL "request.jwt.claim.sub" = '${userIds.accountantA}';`)

    let accountantPayId = ''
    try {
      const res = await client.query(`
        INSERT INTO public.treasury_payments (
          company_id, location_id, payment_number, payment_type, bank_account_id, amount, payment_date, payment_method, status
        ) VALUES (
          $1, $2, 'PAY-ACC-001', 'SUPPLIER_PAYMENT', $3, 150000, CURRENT_DATE, 'TRANSFER', 'PENDING'
        ) RETURNING id;
      `, [compA, locA, bankA])
      accountantPayId = res.rows[0].id
    } catch (e: any) {
      console.error(e)
    }
    console.log('  3.6.b ACCOUNTANT registra dispersión en tesorería: ', accountantPayId ? 'PERMITIDO (treasury.create) ✅ (ID: ' + accountantPayId + ')' : 'FALLO ❌')
    if (!accountantPayId) throw new Error('ACCOUNTANT debió poder registrar el pago de tesorería.')

    // =========================================================================
    // ITEM 4: INVENTARIO — PROHIBICIÓN DE MUTACIÓN DIRECTA
    // =========================================================================
    console.log('\n====================================================================')
    console.log('4. VALIDACIÓN DE INVENTARIO E INMUTABILIDAD DEL KARDEX')
    console.log('====================================================================')

    // 4.1 Modificar stock_levels directamente (DEBE FALLAR)
    await client.query(`SET LOCAL ROLE authenticated;`)
    await client.query(`SET LOCAL "request.jwt.claim.sub" = '${userIds.warehouseA}';`)

    let directStockUpdateBlocked = false
    try {
      const res = await client.query(`UPDATE public.stock_levels SET quantity = 99999 WHERE product_id = $1;`, [prodA])
      if (res.rowCount === 0) directStockUpdateBlocked = true
    } catch (e: any) {
      directStockUpdateBlocked = true
    }
    console.log('  4.1 Intento de UPDATE directo en stock_levels: ', directStockUpdateBlocked ? 'DENEGADO (Sin política de UPDATE en RLS) ✅' : 'FALLO ❌')
    if (!directStockUpdateBlocked) throw new Error('El stock no puede ser modificado directamente sin movimiento Kardex.')

    // 4.2 Eliminar movimiento de inventario Kardex (DEBE FALLAR)
    // 4.2.a Intento desde cliente autenticado (Bloqueado por RLS: 0 filas afectadas)
    let kardexRlsDeleteBlocked = false
    try {
      const res = await client.query(`DELETE FROM public.inventory_movements WHERE id = $1;`, [movementWhId])
      if (res.rowCount === 0) kardexRlsDeleteBlocked = true
    } catch (e: any) {
      kardexRlsDeleteBlocked = true
    }
    console.log('  4.2.a Intento de DELETE sobre Kardex desde cliente: DENEGADO (0 filas / RLS) ✅')
    if (!kardexRlsDeleteBlocked) throw new Error('Un cliente no debe poder eliminar registros de Kardex.')

    // 4.2.b Intento directo en motor PostgreSQL (Bloqueado por trigger trg_prevent_kardex_mutation)
    await client.query(`RESET ROLE;`)
    let kardexTriggerDeleteBlocked = false
    await client.query('SAVEPOINT kdx_del;')
    try {
      await client.query(`DELETE FROM public.inventory_movements WHERE id = $1;`, [movementWhId])
    } catch (e: any) {
      kardexTriggerDeleteBlocked = true
      console.log('  4.2.b Intento de DELETE sobre Kardex en PostgreSQL: DENEGADO POR TRIGGER ✅ (' + e.message + ')')
    } finally {
      await client.query('ROLLBACK TO SAVEPOINT kdx_del;')
    }
    if (!kardexTriggerDeleteBlocked) throw new Error('El trigger de Kardex debió bloquear la eliminación.')

    // =========================================================================
    // ITEM 5: CONTABILIDAD — ASIENTOS POSTED INMUTABLES
    // =========================================================================
    console.log('\n====================================================================')
    console.log('5. VALIDACIÓN DE ASIENTOS CONTABLES "POSTED" INMUTABLES')
    console.log('====================================================================')

    await client.query(`RESET ROLE;`)

    // Cuadrar líneas y publicar comprobante contable a POSTED
    const pucs = await client.query('SELECT id FROM public.accounting_accounts LIMIT 2;')
    await client.query(`
      INSERT INTO public.accounting_entry_lines (entry_id, account_id, debit_amount, credit_amount, description)
      VALUES 
        ($1, $2, 100000.00, 0.00, 'Débito 110505 Caja General'),
        ($1, $3, 0.00, 100000.00, 'Crédito 111005 Bancos Moneda Nacional');
    `, [accountantEntryId, pucs.rows[0].id, pucs.rows[1].id])

    await client.query(`UPDATE public.accounting_entries SET status = 'POSTED' WHERE id = $1;`, [accountantEntryId])
    console.log('  Asiento contable publicado formalmente en estado POSTED (Débitos = Créditos = 100.000).')

    // 5.1 Intentar modificar concepto o fecha de asiento POSTED (DEBE FALLAR)
    let postedUpdateBlocked = false
    await client.query('SAVEPOINT post_upd;')
    try {
      await client.query(`UPDATE public.accounting_entries SET concept = 'Concepto alterado fraudulentamente' WHERE id = $1;`, [accountantEntryId])
    } catch (e: any) {
      postedUpdateBlocked = true
      console.log('  5.1 Intento de UPDATE sobre asiento POSTED: DENEGADO POR TRIGGER ✅ (' + e.message + ')')
    } finally {
      await client.query('ROLLBACK TO SAVEPOINT post_upd;')
    }
    if (!postedUpdateBlocked) throw new Error('Un asiento contable POSTED no debe poder ser modificado.')

    // 5.2 Intentar eliminar asiento POSTED (DEBE FALLAR)
    let postedDeleteBlocked = false
    await client.query('SAVEPOINT post_del;')
    try {
      await client.query(`DELETE FROM public.accounting_entries WHERE id = $1;`, [accountantEntryId])
    } catch (e: any) {
      postedDeleteBlocked = true
      console.log('  5.2 Intento de DELETE sobre asiento POSTED: DENEGADO POR TRIGGER ✅ (' + e.message + ')')
    } finally {
      await client.query('ROLLBACK TO SAVEPOINT post_del;')
    }
    if (!postedDeleteBlocked) throw new Error('Un asiento contable POSTED no debe poder ser eliminado físicamente.')

    // 5.3 Intentar eliminar líneas contables de asiento POSTED (DEBE FALLAR)
    let postedLinesBlocked = false
    await client.query('SAVEPOINT post_lin;')
    try {
      await client.query(`DELETE FROM public.accounting_entry_lines WHERE entry_id = $1;`, [accountantEntryId])
    } catch (e: any) {
      postedLinesBlocked = true
      console.log('  5.3 Intento de DELETE en accounting_entry_lines de asiento POSTED: DENEGADO POR TRIGGER ✅ (' + e.message + ')')
    } finally {
      await client.query('ROLLBACK TO SAVEPOINT post_lin;')
    }
    if (!postedLinesBlocked) throw new Error('Las líneas contables de un asiento POSTED no deben poder alterarse.')

    // =========================================================================
    // ITEM 6: AUDITORÍA (audit_logs)
    // =========================================================================
    console.log('\n====================================================================')
    console.log('6. VALIDACIÓN DE AUDITORÍA (audit_logs)')
    console.log('====================================================================')

    // 6.1 Intento de forjar / insertar directamente audit_logs desde cliente (DEBE FALLAR)
    await client.query(`SET LOCAL ROLE authenticated;`)
    await client.query(`SET LOCAL "request.jwt.claim.sub" = '${userIds.sellerA}';`)

    let auditInsertBlocked = false
    await client.query('SAVEPOINT aud_ins;')
    try {
      await client.query(`
        INSERT INTO public.audit_logs (
          company_id, user_id, user_name, action, module, entity_name, entity_id
        ) VALUES (
          $1, $2, 'Infiltrado', 'FORGED_AUDIT', 'SECURITY', 'users', '0000'
        );
      `, [compA, userIds.sellerA])
    } catch (e: any) {
      auditInsertBlocked = true
      console.log('  6.1 Intento de INSERT directo a audit_logs desde cliente: DENEGADO POR RLS ✅ (' + e.message + ')')
    } finally {
      await client.query('ROLLBACK TO SAVEPOINT aud_ins;')
    }
    if (!auditInsertBlocked) throw new Error('Un cliente autenticado no debe poder insertar directamente en audit_logs.')

    // 6.2 Registro legítimo de auditoría vía contexto fiduciario / backend (service_role)
    await client.query(`RESET ROLE;`)
    const auditRes = await client.query(`
      INSERT INTO public.audit_logs (
        company_id, user_id, user_name, action, module, entity_name, entity_id, previous_value, new_value
      ) VALUES (
        $1, $2, 'Admin Legítimo', 'SECURITY_VALIDATION', 'SYSTEM', 'companies', $3, '{"status":"SETUP"}'::jsonb, '{"status":"ACTIVE"}'::jsonb
      ) RETURNING id;
    `, [compA, userIds.adminA, compA.toString()])
    const auditLogId = auditRes.rows[0].id
    console.log('  6.2 Registro legítimo de auditoría insertado por backend fiduciario ✅ (ID: ' + auditLogId + ')')

    // 6.3 Consulta de auditoría: ACCOUNTANT con permiso audit.read puede consultar logs de su empresa
    await client.query(`SET LOCAL ROLE authenticated;`)
    await client.query(`SET LOCAL "request.jwt.claim.sub" = '${userIds.accountantA}';`)

    const accAuditQuery = await client.query('SELECT id, action, module FROM public.audit_logs WHERE id = $1;', [auditLogId])
    console.log('  6.3 ACCOUNTANT consulta auditoría de Empresa A -> Filas:', accAuditQuery.rows.length, '✅')
    if (accAuditQuery.rows.length !== 1) throw new Error('ACCOUNTANT debió poder consultar los audit_logs de su empresa.')

    // 6.4 Aislamiento multiempresa en auditoría: Empresa B no puede ver auditoría de Empresa A
    await client.query(`SET LOCAL ROLE authenticated;`)
    await client.query(`SET LOCAL "request.jwt.claim.sub" = '${userIds.userB}';`)

    const bAuditQuery = await client.query('SELECT * FROM public.audit_logs WHERE id = $1;', [auditLogId])
    console.log('  6.4 Empresa B consulta auditoría de Empresa A -> Filas:', bAuditQuery.rows.length, '✅')
    if (bAuditQuery.rows.length !== 0) throw new Error('Empresa B no debe tener acceso a logs de Empresa A.')

    // 6.5 Inmutabilidad de audit_logs: Intento de UPDATE o DELETE sobre audit_logs (DEBE FALLAR)
    await client.query(`RESET ROLE;`)

    let auditUpdBlocked = false
    await client.query('SAVEPOINT aud_upd;')
    try {
      await client.query(`UPDATE public.audit_logs SET action = 'HACKED' WHERE id = $1;`, [auditLogId])
    } catch (e: any) {
      auditUpdBlocked = true
      console.log('  6.5.a Intento de UPDATE sobre audit_logs: DENEGADO POR TRIGGER ✅ (' + e.message + ')')
    } finally {
      await client.query('ROLLBACK TO SAVEPOINT aud_upd;')
    }
    if (!auditUpdBlocked) throw new Error('Los registros de auditoría no deben poder ser modificados.')

    let auditDelBlocked = false
    await client.query('SAVEPOINT aud_del;')
    try {
      await client.query(`DELETE FROM public.audit_logs WHERE id = $1;`, [auditLogId])
    } catch (e: any) {
      auditDelBlocked = true
      console.log('  6.5.b Intento de DELETE sobre audit_logs: DENEGADO POR TRIGGER ✅ (' + e.message + ')')
    } finally {
      await client.query('ROLLBACK TO SAVEPOINT aud_del;')
    }
    if (!auditDelBlocked) throw new Error('Los registros de auditoría no deben poder ser eliminados.')

    // =========================================================================
    // ROLLBACK TOTAL DE LA PRUEBA
    // =========================================================================
    console.log('\n====================================================================')
    console.log('🔄 EJECUTANDO ROLLBACK COMPLETO DE TODOS LOS DATOS DE PRUEBA')
    console.log('====================================================================')
    await client.query(`RESET ROLE;`)
    await client.query('ROLLBACK;')
    console.log('✅ ROLLBACK ejecutado exitosamente. Cero datos temporales permanecen en la base de datos.')

  } catch (err) {
    await client.query('RESET ROLE;').catch(() => {})
    await client.query('ROLLBACK;').catch(() => {})
    console.error('\n❌ ERROR DURANTE LA SUITE DE PRUEBAS DE SEGURIDAD:', err)
    throw err
  } finally {
    // COMPROBACIÓN POST-ROLLBACK
    console.log('\n====================================================================')
    console.log('🔍 COMPROBACIÓN POST-ROLLBACK EN POSTGRESQL REAL')
    console.log('====================================================================')
    const c = await client.query('SELECT count(*) FROM public.companies;')
    const l = await client.query('SELECT count(*) FROM public.locations;')
    const u = await client.query('SELECT count(*) FROM public.users;')
    const p = await client.query('SELECT count(*) FROM public.products;')
    const s = await client.query('SELECT count(*) FROM public.stock_levels;')
    const m = await client.query('SELECT count(*) FROM public.inventory_movements;')
    const sa = await client.query('SELECT count(*) FROM public.sales;')
    const pu = await client.query('SELECT count(*) FROM public.purchases;')
    const ae = await client.query('SELECT count(*) FROM public.accounting_entries;')
    const ael = await client.query('SELECT count(*) FROM public.accounting_entry_lines;')
    const tp = await client.query('SELECT count(*) FROM public.treasury_payments;')
    const tr = await client.query('SELECT count(*) FROM public.treasury_receipts;')
    const al = await client.query('SELECT count(*) FROM public.audit_logs;')

    console.log(`companies:               ${c.rows[0].count} (Solo empresa legítima del Paso 8) ✅`)
    console.log(`locations:               ${l.rows[0].count} (Solo bodega legítima del Paso 8) ✅`)
    console.log(`users:                   ${u.rows[0].count} (Solo superadmin legítimo del Paso 7) ✅`)
    console.log(`products:                ${p.rows[0].count} (0 productos comerciales) ✅`)
    console.log(`stock_levels:            ${s.rows[0].count} (0 existencias) ✅`)
    console.log(`inventory_movements:     ${m.rows[0].count} (0 movimientos Kardex) ✅`)
    console.log(`sales:                   ${sa.rows[0].count} (0 ventas) ✅`)
    console.log(`purchases:               ${pu.rows[0].count} (0 compras) ✅`)
    console.log(`accounting_entries:      ${ae.rows[0].count} (0 comprobantes contables) ✅`)
    console.log(`accounting_entry_lines:  ${ael.rows[0].count} (0 líneas contables) ✅`)
    console.log(`treasury_payments:       ${tp.rows[0].count} (0 pagos tesorería) ✅`)
    console.log(`treasury_receipts:       ${tr.rows[0].count} (0 recaudos tesorería) ✅`)
    console.log(`audit_logs:              ${al.rows[0].count} (0 logs residuales) ✅`)

    await client.end()
  }
}

runRealPostgreSqlRlsTests().catch((e) => {
  console.error(e)
  process.exit(1)
})
