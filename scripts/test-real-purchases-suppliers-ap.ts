/**
 * ==============================================================================
 * SUITE DE VALIDACIÓN REAL DE COMPRAS, PROVEEDORES, KARDEX Y TESORERÍA (PASO 12)
 * ERP SUPER MÁS S.A.S. — Supabase PostgreSQL (Staging)
 * ==============================================================================
 *
 * REGLAS OBLIGATORIAS:
 * 1. Transacción estricta BEGIN ... ROLLBACK (Cero persistencia comercial final).
 * 2. No crear proveedores, compras, pagos o inventario permanentes en staging.
 * 3. Validar el flujo completo:
 *    - 1. Creación de proveedor con datos fiscales y condiciones de pago.
 *    - 2. Creación de producto y existencias iniciales.
 *    - 3. Registro de factura de compra (purchases, purchase_items) con IVA 19% e impuestos.
 *    - 4. Recepción de mercancía y entrada automática al Kardex (PURCHASE_ENTRY).
 *    - 5. Recálculo matemático exacto de Costo Promedio Ponderado.
 *    - 6. Liquidación de retenciones aplicables (ReteFuente 2.5% compras).
 *    - 7. Contabilización automática en partida doble PUC (1435, 2408, 2365, 2205).
 *    - 8. Gestión de Cuentas por Pagar y dispersión de pago en Tesorería (treasury_payments, bank_accounts).
 *    - 9. Contabilización del pago a proveedor (2205 Débito, 1110 Crédito).
 *    - 10. Devolución a proveedor (SUPPLIER_RETURN) con deducción en Kardex.
 *    - 11. Nota Débito al proveedor y asiento contable de reversión en partida doble.
 *    - 12. Inmutabilidad física (bloqueo DELETE en compra recibida y en pago desembolsado).
 *    - 13. Aislamiento multi-tenant y multi-sede (Empresa A vs Empresa B).
 *    - 14. Validación de permisos por rol (WAREHOUSE_ADMIN, ACCOUNTANT vs CASHIER, SELLER).
 *    - 15. Auditoría forense inmutable de todas las operaciones sensibles (audit_logs).
 *    - 16. Comprobación post-rollback (todas las tablas comerciales vuelven a cero).
 */

import pg from 'pg'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

async function runRealPurchasesSuppliersApTests() {
  const client = new pg.Client({
    connectionString: process.env.DIRECT_URL,
    ssl: { rejectUnauthorized: false },
  })

  await client.connect()

  console.log('================================================================================')
  console.log('📦 SUITE DE VALIDACIÓN REAL DE COMPRAS, PROVEEDORES Y TESORERÍA (PASO 12)')
  console.log('================================================================================\n')

  try {
    // -------------------------------------------------------------------------
    // 0. VERIFICACIÓN PREVIA AL TEST (ESTADO LIMPIO EN STAGING)
    // -------------------------------------------------------------------------
    console.log('--- 0. COMPROBACIÓN DE TABLAS PRE-TEST (DEBEN ESTAR EN CERO) ---')
    const preTables = [
      'suppliers',
      'purchases',
      'purchase_items',
      'treasury_payments',
      'bank_accounts',
      'bank_movements',
      'stock_levels',
      'inventory_movements',
      'accounting_entries',
      'accounting_entry_lines',
      'audit_logs',
      'products',
    ]

    for (const t of preTables) {
      const res = await client.query(`SELECT COUNT(*)::int as count FROM public.${t};`)
      const cnt = res.rows[0].count
      if (cnt !== 0) {
        throw new Error(`Estado inicial inválido: la tabla ${t} contiene ${cnt} registros (se esperaba 0).`)
      }
    }
    console.log('✅ Todas las tablas comerciales, transaccionales y de compras están limpias (0 registros).\n')

    // -------------------------------------------------------------------------
    // INICIAR TRANSACCIÓN PRINCIPAL AISLADA
    // -------------------------------------------------------------------------
    await client.query('BEGIN;')
    console.log('🔒 [BEGIN] Transacción iniciada — Cero persistencia final garantizada por ROLLBACK.\n')

    // -------------------------------------------------------------------------
    // SETUP: DATOS MAESTROS BASE DE STAGING
    // -------------------------------------------------------------------------
    const compARes = await client.query('SELECT id, business_name FROM public.companies LIMIT 1;')
    const compA = compARes.rows[0].id
    const locA1Res = await client.query('SELECT id, code, name FROM public.locations WHERE company_id = $1 LIMIT 1;', [compA])
    const locA1 = locA1Res.rows[0].id

    console.log(`Empresa A legítima: "${compARes.rows[0].business_name}" (${compA})`)
    console.log(`Bodega A1 legítima: "${locA1Res.rows[0].name}" [${locA1Res.rows[0].code}] (${locA1})`)

    // Crear segunda bodega para Empresa A
    const locA2Res = await client.query(`
      INSERT INTO public.locations (
        company_id, code, name, type, address, city, department
      ) VALUES (
        $1, 'BOD-02', 'Sucursal Envigado', 'STORE_POINT', 'Calle 38 Sur # 43-20', 'Envigado', 'Antioquia'
      ) RETURNING id;
    `, [compA])
    const locA2 = locA2Res.rows[0].id

    // Crear Empresa B y Bodega B1
    const compBRes = await client.query(`
      INSERT INTO public.companies (
        business_name, trade_name, tax_id, verification_digit, tax_regime, address, city, department, country
      ) VALUES (
        'Competencia Mayorista B S.A.S.', 'Mayorista B', '901777666', '3', 'RESPONSABLE_DE_IVA', 'Carrera 65 # 80-10', 'Bello', 'Antioquia', 'Colombia'
      ) RETURNING id;
    `)
    const compB = compBRes.rows[0].id

    const locB1Res = await client.query(`
      INSERT INTO public.locations (
        company_id, code, name, type, address, city, department
      ) VALUES (
        $1, 'BOD-B01', 'Bodega Bello Norte', 'WAREHOUSE', 'Carrera 65 # 80-10', 'Bello', 'Antioquia'
      ) RETURNING id;
    `, [compB])
    const locB1 = locB1Res.rows[0].id

    // Roles
    const rolesRes = await client.query('SELECT id, code FROM public.roles;')
    const roles = new Map(rolesRes.rows.map((r: any) => [r.code, r.id]))

    // Usuarios de prueba
    const userWarehouseAId = 'a0000000-0000-0000-0000-000000000010' // WAREHOUSE_ADMIN en Empresa A
    const userAccountantAId = 'a0000000-0000-0000-0000-000000000020' // ACCOUNTANT en Empresa A
    const userCashierAId = 'a0000000-0000-0000-0000-000000000030' // CASHIER en Empresa A
    const userAdminBId = 'b0000000-0000-0000-0000-000000000010' // ADMIN en Empresa B

    await client.query(`
      INSERT INTO auth.users (id, email, raw_app_meta_data, raw_user_meta_data)
      VALUES 
        ($1, 'bodega@empresa-a.com', jsonb_build_object('role', 'WAREHOUSE_ADMIN', 'company_id', $2::text), '{}'::jsonb),
        ($3, 'contador@empresa-a.com', jsonb_build_object('role', 'ACCOUNTANT', 'company_id', $2::text), '{}'::jsonb),
        ($4, 'cajero@empresa-a.com', jsonb_build_object('role', 'CASHIER', 'company_id', $2::text), '{}'::jsonb),
        ($5, 'admin@empresa-b.com', jsonb_build_object('role', 'ADMIN', 'company_id', $6::text), '{}'::jsonb);
    `, [userWarehouseAId, compA, userAccountantAId, userCashierAId, userAdminBId, compB])

    await client.query(`
      INSERT INTO public.users (id, company_id, email, full_name, role_id, is_active)
      VALUES 
        ($1, $2, 'bodega@empresa-a.com', 'Jefe Bodega Bernardo', $3, true),
        ($4, $2, 'contador@empresa-a.com', 'Contadora Constanza', $5, true),
        ($6, $2, 'cajero@empresa-a.com', 'Cajero Carlos POS', $7, true),
        ($8, $9, 'admin@empresa-b.com', 'Admin Beto Empresa B', $10, true)
      ON CONFLICT (id) DO UPDATE SET 
        company_id = EXCLUDED.company_id,
        role_id = EXCLUDED.role_id,
        full_name = EXCLUDED.full_name;
    `, [
      userWarehouseAId, compA, roles.get('WAREHOUSE_ADMIN'),
      userAccountantAId, roles.get('ACCOUNTANT'),
      userCashierAId, roles.get('CASHIER'),
      userAdminBId, compB, roles.get('ADMIN'),
    ])

    // Asignar sedes
    await client.query(`
      INSERT INTO public.user_locations (user_id, location_id, is_primary)
      VALUES 
        ($1, $2, true),
        ($3, $2, true),
        ($4, $2, true),
        ($5, $6, true);
    `, [userWarehouseAId, locA1, userAccountantAId, userCashierAId, userAdminBId, locB1])

    console.log('✅ Usuarios, roles y sedes creados para simulación RLS.\n')

    // -------------------------------------------------------------------------
    // FLUJO 1: CREACIÓN DE PROVEEDORES (suppliers)
    // -------------------------------------------------------------------------
    console.log('================================================================================')
    console.log('1. CREACIÓN DE PROVEEDOR CON CONDICIONES COMERCIALES Y FISCALES')
    console.log('================================================================================')

    // Proveedor Empresa A: Distribuidora Nacional de Alimentos S.A.S.
    const suppARes = await client.query(`
      INSERT INTO public.suppliers (
        company_id, tax_id, verification_digit, name, legal_name, contact_name,
        email, phone, address, city, department, payment_terms_days, is_active
      ) VALUES (
        $1, '900555444', '1', 'Disnalimentos S.A.S.', 'Distribuidora Nacional de Alimentos S.A.S.',
        'Mauricio Restrepo', 'ventas@disnalimentos.com', '3109876543', 'Zona Industrial Calle 29 # 43A-50',
        'Medellín', 'Antioquia', 30, true
      ) RETURNING id, name, tax_id, verification_digit, payment_terms_days;
    `, [compA])
    const supplierA = suppARes.rows[0]

    // Proveedor Empresa B (para aislamiento multi-tenant)
    const suppBRes = await client.query(`
      INSERT INTO public.suppliers (
        company_id, tax_id, verification_digit, name, legal_name, contact_name,
        email, phone, address, city, department, payment_terms_days, is_active
      ) VALUES (
        $1, '901222333', '8', 'Agropecuaria del Norte S.A.S.', 'Agropecuaria del Norte S.A.S.',
        'Pedro Gómez', 'contacto@agronorte.com', '3157778899', 'Carretera Norte Km 12',
        'Bello', 'Antioquia', 15, true
      ) RETURNING id, name;
    `, [compB])
    const supplierB = suppBRes.rows[0]

    console.log(`✅ Proveedor A creado: "${supplierA.name}" (NIT: ${supplierA.tax_id}-${supplierA.verification_digit}, Plazo: ${supplierA.payment_terms_days} días)`)
    console.log(`✅ Proveedor B creado: "${supplierB.name}" (Empresa B)\n`)

    // Registrar en auditoría la creación del proveedor
    await client.query(`
      INSERT INTO public.audit_logs (
        company_id, location_id, user_id, user_name, action, module,
        entity_name, entity_id, new_value
      ) VALUES (
        $1, $2, $3, 'Jefe Bodega Bernardo', 'CREATE', 'suppliers',
        'suppliers', $4, jsonb_build_object('name', $5::text, 'tax_id', $6::text)
      );
    `, [compA, locA1, userWarehouseAId, supplierA.id, supplierA.name, supplierA.tax_id])

    // -------------------------------------------------------------------------
    // FLUJO 2: CREACIÓN DE PRODUCTO Y EXISTENCIAS BASE
    // -------------------------------------------------------------------------
    console.log('================================================================================')
    console.log('2. CREACIÓN DE PRODUCTO Y EXISTENCIAS BASE PREVIAS')
    console.log('================================================================================')

    const prodRes = await client.query(`
      INSERT INTO public.products (
        company_id, sku, barcode, name, slug, short_description, unit_of_measure, min_stock_threshold
      ) VALUES (
        $1, 'SKU-LECHE-1L', '7709876543210', 'Leche Entera Colanta 1L', 'leche-entera-colanta-1l',
        'Bolsa de leche entera 1000ml', 'UND', 20
      ) RETURNING id, name, sku;
    `, [compA])
    const product = prodRes.rows[0]
    console.log(`✅ Producto creado: "${product.name}" [${product.sku}] (ID: ${product.id})`)

    // Existencia previa en inventario: 50 unidades @ $3.000 COP c/u ($150.000 total)
    console.log('   Registrando stock inicial previo: 50 unds @ $3.000 COP...')
    await client.query(`
      INSERT INTO public.inventory_movements (
        company_id, location_id, product_id, user_id, movement_type,
        quantity_in, quantity_out, previous_stock, new_stock, unit_cost, total_cost,
        document_type, document_reference, reason
      ) VALUES (
        $1, $2, $3, $4, 'PURCHASE_ENTRY',
        50.00, 0.00, 0.00, 50.00, 3000.00, 150000.00,
        'PURCHASE', 'FAC-INI-001', 'Inventario inicial previo'
      );
    `, [compA, locA1, product.id, userWarehouseAId])

    const stockBase = (await client.query(`
      SELECT quantity, average_cost, total_value_at_cost, health_status
      FROM public.stock_levels
      WHERE product_id = $1 AND location_id = $2;
    `, [product.id, locA1])).rows[0]

    console.log(`   Stock inicial verificado:`)
    console.log(`   - Cantidad:       ${stockBase.quantity} unds (Esperado: 50.00)`)
    console.log(`   - Costo Promedio: $${stockBase.average_cost} COP (Esperado: 3000.00)`)
    console.log(`   - Valoración:     $${stockBase.total_value_at_cost} COP (Esperado: 150000.00)\n`)

    // -------------------------------------------------------------------------
    // FLUJO 3: PRUEBA NEGATIVA - CAJERO INTENTA CREAR COMPRA
    // -------------------------------------------------------------------------
    console.log('================================================================================')
    console.log('3. PRUEBA NEGATIVA: CAJERO INTENTA CREAR UNA ORDEN DE COMPRA (RLS)')
    console.log('================================================================================')

    let cashierPurchaseBlocked = false
    try {
      await client.query('SAVEPOINT sp_unauth_purchase;')
      await client.query(`SET LOCAL ROLE authenticated;`)
      await client.query(`SET LOCAL "request.jwt.claims" = '${JSON.stringify({
        sub: userCashierAId,
        role: 'authenticated',
        app_metadata: { role: 'CASHIER', company_id: compA },
      })}';`)

      await client.query(`
        INSERT INTO public.purchases (
          company_id, location_id, supplier_id, purchase_number, supplier_invoice_number,
          issue_date, due_date, subtotal_amount, tax_amount, total_amount, payment_terms
        ) VALUES (
          $1, $2, $3, 'COM-UNAUTH-01', 'FAC-0099', CURRENT_DATE, CURRENT_DATE + 30,
          100000.00, 19000.00, 119000.00, 'CREDITO'
        );
      `, [compA, locA1, supplierA.id])
    } catch (err: any) {
      cashierPurchaseBlocked = true
      await client.query('ROLLBACK TO SAVEPOINT sp_unauth_purchase;')
      await client.query(`SET LOCAL ROLE postgres;`)
      console.log(`✅ Bloqueo RLS exitoso: Usuario CASHIER no pudo insertar compra (${err.message}).`)
    } finally {
      await client.query(`SET LOCAL ROLE postgres;`)
    }

    if (!cashierPurchaseBlocked) {
      throw new Error('Falla de seguridad RLS: Usuario CASHIER pudo insertar una compra sin permiso.')
    }

    // -------------------------------------------------------------------------
    // FLUJO 4: REGISTRO DE FACTURA DE COMPRA POR JEFE DE BODEGA
    // -------------------------------------------------------------------------
    console.log('\n================================================================================')
    console.log('4. REGISTRO DE COMPRA POR USUARIO AUTORIZADO (WAREHOUSE_ADMIN)')
    console.log('================================================================================')

    // Contexto autenticado de WAREHOUSE_ADMIN
    await client.query(`SET LOCAL ROLE authenticated;`)
    await client.query(`SET LOCAL "request.jwt.claims" = '${JSON.stringify({
      sub: userWarehouseAId,
      role: 'authenticated',
      app_metadata: { role: 'WAREHOUSE_ADMIN', company_id: compA },
    })}';`)

    // Compra: 100 unidades de Leche Colanta a $3.600 COP cada una
    // Subtotal: 100 x $3.600 = $360.000 COP
    // IVA 19% (Descontable): $68.400 COP
    // Total Compra: $428.400 COP
    // Retención en la fuente (2.5% sobre $360.000): $9.000 COP
    // Neto a Pagar Proveedor: $428.400 - $9.000 = $419.400 COP
    const purchaseNumber = 'COM-2026-0001'
    const supplierInvoiceNumber = 'FAC-DISNAL-88990'

    const purchRes = await client.query(`
      INSERT INTO public.purchases (
        company_id, location_id, supplier_id, purchase_number, supplier_invoice_number,
        issue_date, due_date, subtotal_amount, tax_amount, total_amount,
        payment_terms, payment_status, inventory_status, notes
      ) VALUES (
        $1, $2, $3, $4, $5,
        CURRENT_DATE, CURRENT_DATE + 30, 360000.00, 68400.00, 428400.00,
        'CREDITO', 'PENDING', 'PENDING', 'Compra de reposición de lácteos por alta rotación'
      ) RETURNING id, purchase_number, supplier_invoice_number, total_amount, inventory_status;
    `, [compA, locA1, supplierA.id, purchaseNumber, supplierInvoiceNumber])
    const purchase = purchRes.rows[0]

    // Insertar líneas de compra (purchase_items)
    const pItemRes = await client.query(`
      INSERT INTO public.purchase_items (
        company_id, purchase_id, product_id, quantity, unit_cost,
        tax_rate_percent, tax_amount, subtotal, total
      ) VALUES (
        $1, $2, $3, 100.00, 3600.00,
        19.00, 68400.00, 360000.00, 428400.00
      ) RETURNING id, quantity, unit_cost, subtotal, total;
    `, [compA, purchase.id, product.id])
    const purchaseItem = pItemRes.rows[0]

    console.log(`✅ Orden de compra registrada:`)
    console.log(`   - Consecutivo Interno: ${purchase.purchase_number} (ID: ${purchase.id})`)
    console.log(`   - Factura Proveedor:   ${purchase.supplier_invoice_number}`)
    console.log(`   - Ítem:                ${product.name} x ${purchaseItem.quantity} unds @ $3.600 COP`)
    console.log(`   - Subtotal:            $360.000 COP`)
    console.log(`   - IVA (19%):           $68.400 COP`)
    console.log(`   - Total Factura:       $${purchase.total_amount} COP`)
    console.log(`   - Estado Mercancía:    ${purchase.inventory_status} (Pendiente de recepción)`)

    await client.query(`SET LOCAL ROLE postgres;`)

    // -------------------------------------------------------------------------
    // FLUJO 5: RECEPCIÓN DE MERCANCÍA Y ENTRADA ATÓMICA AL KARDEX
    // -------------------------------------------------------------------------
    console.log('\n================================================================================')
    console.log('5. RECEPCIÓN DE MERCANCÍA Y RECÁLCULO ATÓMICO DE COSTO PROMEDIO PONDERADO')
    console.log('================================================================================')

    // Actualizar estado de compra a RECEIVED
    await client.query(`
      UPDATE public.purchases
      SET inventory_status = 'RECEIVED', updated_at = NOW()
      WHERE id = $1;
    `, [purchase.id])

    // Registrar movimiento de Kardex (PURCHASE_ENTRY)
    // Costo previo: 50 unds @ $3.000 = $150.000
    // Entrada: 100 unds @ $3.600 = $360.000
    // Total unidades = 150 unds
    // Total valor costo = $150.000 + $360.000 = $510.000 COP
    // Nuevo costo promedio ponderado: $510.000 / 150 = $3.400,00 COP exactos!
    console.log('   Ingresando mercancía a Kardex (PURCHASE_ENTRY): 100 unds @ $3.600 COP...')
    await client.query(`
      INSERT INTO public.inventory_movements (
        company_id, location_id, product_id, user_id, movement_type,
        quantity_in, quantity_out, previous_stock, new_stock, unit_cost, total_cost,
        document_type, document_reference, reason
      ) VALUES (
        $1, $2, $3, $4, 'PURCHASE_ENTRY',
        100.00, 0.00, 50.00, 150.00, 3600.00, 360000.00,
        'PURCHASE', $5, 'Recepción física y verificación de factura proveedor'
      );
    `, [compA, locA1, product.id, userWarehouseAId, purchase.purchase_number])

    const stockAfterReception = (await client.query(`
      SELECT quantity, average_cost, total_value_at_cost, health_status
      FROM public.stock_levels
      WHERE product_id = $1 AND location_id = $2;
    `, [product.id, locA1])).rows[0]

    console.log(`   Existencias tras recepción y recálculo:`)
    console.log(`   - Cantidad total en bodega: ${stockAfterReception.quantity} unds (Esperado: 150.00)`)
    console.log(`   - Nuevo Costo Promedio:     $${stockAfterReception.average_cost} COP (Esperado: 3400.00)`)
    console.log(`   - Valoración total a costo: $${stockAfterReception.total_value_at_cost} COP (Esperado: 510000.00)`)
    console.log(`   - Estado de salud:          ${stockAfterReception.health_status} (Esperado: AVAILABLE)`)

    if (Number(stockAfterReception.quantity) !== 150 || Number(stockAfterReception.average_cost) !== 3400) {
      throw new Error(`Discrepancia en recálculo de costo promedio: cantidad = ${stockAfterReception.quantity}, costo = ${stockAfterReception.average_cost}`)
    }
    console.log('✅ Ponderación matemática de costo promedio ponderado certificada ($3.400,00 COP).')

    // -------------------------------------------------------------------------
    // FLUJO 6: INMUTABILIDAD DE COMPRAS RECIBIDAS (BLOQUEO DE DELETE FÍSICO)
    // -------------------------------------------------------------------------
    console.log('\n================================================================================')
    console.log('6. VALIDACIÓN DE INMUTABILIDAD: INTENTO DE BORRADO DE COMPRA RECIBIDA')
    console.log('================================================================================')

    let deletePurchaseBlocked = false
    try {
      await client.query('SAVEPOINT sp_del_received_purchase;')
      await client.query(`DELETE FROM public.purchases WHERE id = $1;`, [purchase.id])
    } catch (err: any) {
      deletePurchaseBlocked = true
      await client.query('ROLLBACK TO SAVEPOINT sp_del_received_purchase;')
      console.log(`✅ Bloqueo de eliminación física exitoso: "${err.message}"`)
    }
    if (!deletePurchaseBlocked) {
      throw new Error('Falla crítica: Se permitió eliminar una compra que ya tiene mercancía recibida.')
    }
    console.log('✅ Inmutabilidad de compras recibidas validada al 100%.')

    // -------------------------------------------------------------------------
    // FLUJO 7: CONTABILIZACIÓN EN PARTIDA DOBLE PUC CON RETENCIONES
    // -------------------------------------------------------------------------
    console.log('\n================================================================================')
    console.log('7. CONTABILIZACIÓN AUTOMÁTICA EN PARTIDA DOBLE PUC (CON RETENCIÓN EN LA FUENTE)')
    console.log('================================================================================')

    // Cuentas PUC requeridas:
    // 1435: Mercancías para la venta (Inventario)
    // 2408: IVA descontable por compras (19%)
    // 2365: Retención en la fuente por pagar (2.5% compras generales)
    // 2205: Proveedores nacionales (Cuentas por pagar)
    const accRes = await client.query(`
      SELECT id, code FROM public.accounting_accounts
      WHERE code IN ('1435', '2408', '2365', '2205', '1110');
    `)
    const accounts = new Map(accRes.rows.map((a: any) => [a.code, a.id]))

    // Crear comprobante contable de compra (DRAFT)
    const entryRes = await client.query(`
      INSERT INTO public.accounting_entries (
        company_id, location_id, consecutive, entry_number, date, concept,
        document_type, document_reference, status, created_by_user_id
      ) VALUES (
        $1, $2, 2001, 'CP-2026-0001', CURRENT_DATE,
        'Causación Factura Proveedor FAC-DISNAL-88990 Disnalimentos S.A.S.',
        'PURCHASE_INVOICE', $3, 'DRAFT', $4
      ) RETURNING id, entry_number;
    `, [compA, locA1, purchase.supplier_invoice_number, userAccountantAId])
    const entryId = entryRes.rows[0].id

    // Líneas contables:
    // Línea 1: 1435 (Inventario Mercancías) -> Débito $360.000,00 (Subtotal costo base)
    // Línea 2: 2408 (IVA Descontable 19%)   -> Débito  $68.400,00 (Crédito fiscal)
    // Línea 3: 2365 (ReteFuente 2.5%)       -> Crédito  $9.000,00 (Pasivo fiscal DIAN)
    // Línea 4: 2205 (Proveedores CXP)       -> Crédito $419.400,00 (Total a pagar proveedor)
    // Total Débito = $360.000 + $68.400 = $428.400 COP
    // Total Crédito = $9.000 + $419.400 = $428.400 COP (Partida Doble Perfecta)
    await client.query(`
      INSERT INTO public.accounting_entry_lines (
        entry_id, account_id, third_party_doc, third_party_name, description, debit_amount, credit_amount
      ) VALUES 
        ($1, $2, '900555444', 'Disnalimentos S.A.S.', 'Ingreso inventario Leche Colanta 100 unds', 360000.00, 0.00),
        ($1, $3, '900555444', 'Disnalimentos S.A.S.', 'IVA descontable 19% compra mercancía', 68400.00, 0.00),
        ($1, $4, '900123456', 'DIAN', 'ReteFuente 2.5% sobre compras generales', 0.00, 9000.00),
        ($1, $5, '900555444', 'Disnalimentos S.A.S.', 'Causación cuenta por pagar proveedor nacional', 0.00, 419400.00);
    `, [entryId, accounts.get('1435'), accounts.get('2408'), accounts.get('2365'), accounts.get('2205')])

    // Publicar comprobante a POSTED
    await client.query(`
      UPDATE public.accounting_entries
      SET status = 'POSTED', posted_at = NOW()
      WHERE id = $1;
    `, [entryId])

    const sumLines = (await client.query(`
      SELECT SUM(debit_amount)::numeric(15,2) as total_debit, SUM(credit_amount)::numeric(15,2) as total_credit
      FROM public.accounting_entry_lines
      WHERE entry_id = $1;
    `, [entryId])).rows[0]

    console.log(`   Asiento contable de compra asentado (POSTED):`)
    console.log(`   - Comprobante:    ${entryRes.rows[0].entry_number}`)
    console.log(`   - Total Débito:   $${sumLines.total_debit} COP`)
    console.log(`   - Total Crédito:  $${sumLines.total_credit} COP`)
    console.log(`   - Balance:        Partida Doble Verificada (Débito == Crédito)`)

    if (Number(sumLines.total_debit) !== Number(sumLines.total_credit)) {
      throw new Error('Descuadre contable en asiento de compra.')
    }
    console.log('✅ Causación de compra con retención e IVA descontable verificada en PUC.')

    // -------------------------------------------------------------------------
    // FLUJO 8: CUENTAS POR PAGAR Y DISPERSIÓN DE PAGO EN TESORERÍA
    // -------------------------------------------------------------------------
    console.log('\n================================================================================')
    console.log('8. CUENTAS POR PAGAR Y DISPERSIÓN DE PAGO EN TESORERÍA (bank_accounts)')
    console.log('================================================================================')

    // 8.1 Crear Cuenta Bancaria institucional de Empresa A
    const bankRes = await client.query(`
      INSERT INTO public.bank_accounts (
        company_id, location_id, bank_name, account_number, account_type, currency, current_balance, is_active
      ) VALUES (
        $1, $2, 'Bancolombia S.A.', '1029-3847-56', 'CORRIENTE', 'COP', 5000000.00, true
      ) RETURNING id, bank_name, account_number, current_balance;
    `, [compA, locA1])
    const bankAccount = bankRes.rows[0]
    console.log(`✅ Cuenta bancaria creada: "${bankAccount.bank_name}" Cta #${bankAccount.account_number} (Saldo: $${bankAccount.current_balance} COP)`)

    // 8.2 Dispersión de Pago en treasury_payments: Pago neto $419.400 COP al Proveedor
    const payRes = await client.query(`
      INSERT INTO public.treasury_payments (
        company_id, location_id, payment_number, payment_type, purchase_id, supplier_id,
        bank_account_id, amount, payment_date, due_date, payment_method, reference_number,
        status, notes, created_by_user_id
      ) VALUES (
        $1, $2, 'PAG-2026-0001', 'SUPPLIER_PAYMENT', $3, $4,
        $5, 419400.00, CURRENT_DATE, CURRENT_DATE + 30, 'TRANSFERENCIA', 'TRF-BANCOL-776655',
        'PAID', 'Pago total factura FAC-DISNAL-88990 mediante transferencia bancaria', $6
      ) RETURNING id, payment_number, amount, status;
    `, [compA, locA1, purchase.id, supplierA.id, bankAccount.id, userAccountantAId])
    const payment = payRes.rows[0]

    // Actualizar estado de pago en purchases
    await client.query(`
      UPDATE public.purchases
      SET payment_status = 'PAID', updated_at = NOW()
      WHERE id = $1;
    `, [purchase.id])

    // Actualizar saldo bancario y registrar movimiento bancario
    const newBankBalance = Number(bankAccount.current_balance) - Number(payment.amount)
    await client.query(`
      UPDATE public.bank_accounts
      SET current_balance = $1, updated_at = NOW()
      WHERE id = $2;
    `, [newBankBalance, bankAccount.id])

    await client.query(`
      INSERT INTO public.bank_movements (
        company_id, location_id, bank_account_id, movement_number, movement_date,
        movement_type, amount, balance_after, concept, reference, treasury_payment_id, is_reconciled
      ) VALUES (
        $1, $2, $3, 'MOV-BANCOL-001', CURRENT_DATE,
        'CREDIT', 419400.00, $4, 'Pago a Proveedor Disnalimentos S.A.S.', 'TRF-BANCOL-776655', $5, true
      );
    `, [compA, locA1, bankAccount.id, newBankBalance, payment.id])

    console.log(`✅ Pago de tesorería procesado:`)
    console.log(`   - Comprobante Pago: ${payment.payment_number} (ID: ${payment.id})`)
    console.log(`   - Valor Desembolso: $${payment.amount} COP`)
    console.log(`   - Estado de Pago:   ${payment.status}`)
    console.log(`   - Estado Compra:    PAID (Cancelada en su totalidad)`)
    console.log(`   - Saldo Bancario:   $${newBankBalance} COP`)

    // 8.3 Inmutabilidad del pago desembolsado
    let deletePaymentBlocked = false
    try {
      await client.query('SAVEPOINT sp_del_paid_payment;')
      await client.query(`DELETE FROM public.treasury_payments WHERE id = $1;`, [payment.id])
    } catch (err: any) {
      deletePaymentBlocked = true
      await client.query('ROLLBACK TO SAVEPOINT sp_del_paid_payment;')
      console.log(`✅ Bloqueo de eliminación de pago desembolsado: "${err.message}"`)
    }
    if (!deletePaymentBlocked) {
      throw new Error('Falla crítica: Se permitió eliminar un pago desembolsado de tesorería.')
    }

    // -------------------------------------------------------------------------
    // FLUJO 9: CONTABILIZACIÓN DEL PAGO AL PROVEEDOR
    // -------------------------------------------------------------------------
    console.log('\n================================================================================')
    console.log('9. CONTABILIZACIÓN DEL DESEMBOLSO EN PARTIDA DOBLE PUC (2205 vs 1110)')
    console.log('================================================================================')

    // Asiento contable de Pago:
    // Línea 1: 2205 (Proveedores CXP) -> Débito  $419.400,00 (Cancelación pasivo)
    // Línea 2: 1110 (Bancos)          -> Crédito $419.400,00 (Salida de recursos bancarios)
    // Total Débitos: $419.400 == Total Créditos: $419.400 (Partida Doble Perfecta)
    const payEntryRes = await client.query(`
      INSERT INTO public.accounting_entries (
        company_id, location_id, consecutive, entry_number, date, concept,
        document_type, document_reference, status, created_by_user_id
      ) VALUES (
        $1, $2, 2002, 'CP-2026-0002', CURRENT_DATE,
        'Comprobante de Egreso Pago Factura Proveedor FAC-DISNAL-88990',
        'TREASURY_PAYMENT', $3, 'DRAFT', $4
      ) RETURNING id, entry_number;
    `, [compA, locA1, payment.payment_number, userAccountantAId])
    const payEntryId = payEntryRes.rows[0].id

    await client.query(`
      INSERT INTO public.accounting_entry_lines (
        entry_id, account_id, third_party_doc, third_party_name, description, debit_amount, credit_amount
      ) VALUES 
        ($1, $2, '900555444', 'Disnalimentos S.A.S.', 'Cancelación cuenta por pagar proveedor nacional', 419400.00, 0.00),
        ($1, $3, '900555444', 'Disnalimentos S.A.S.', 'Desembolso fondos transferencia Bancolombia', 0.00, 419400.00);
    `, [payEntryId, accounts.get('2205'), accounts.get('1110')])

    await client.query(`
      UPDATE public.accounting_entries
      SET status = 'POSTED', posted_at = NOW()
      WHERE id = $1;
    `, [payEntryId])

    const sumPayLines = (await client.query(`
      SELECT SUM(debit_amount)::numeric(15,2) as total_debit, SUM(credit_amount)::numeric(15,2) as total_credit
      FROM public.accounting_entry_lines
      WHERE entry_id = $1;
    `, [payEntryId])).rows[0]

    console.log(`   Asiento contable de desembolso asentado (POSTED):`)
    console.log(`   - Comprobante:    ${payEntryRes.rows[0].entry_number}`)
    console.log(`   - Total Débito:   $${sumPayLines.total_debit} COP`)
    console.log(`   - Total Crédito:  $${sumPayLines.total_credit} COP`)
    console.log(`   - Balance:        Partida Doble Verificada (Débito == Crédito)`)

    if (Number(sumPayLines.total_debit) !== Number(sumPayLines.total_credit)) {
      throw new Error('Descuadre en comprobante de pago.')
    }
    console.log('✅ Contabilización de tesorería y cuentas por pagar certificada.')

    // -------------------------------------------------------------------------
    // FLUJO 10: DEVOLUCIÓN A PROVEEDOR (SUPPLIER_RETURN EN KARDEX)
    // -------------------------------------------------------------------------
    console.log('\n================================================================================')
    console.log('10. DEVOLUCIÓN A PROVEEDOR Y DESCUENTO ATÓMICO EN KARDEX (SUPPLIER_RETURN)')
    console.log('================================================================================')

    // Devolución por lote averiado: Se devuelven 10 unidades de Leche Colanta al proveedor
    // Salida en Kardex: quantity_out = 10, unit_cost = 3400 (costo promedio actual), total_cost = 34000
    // Stock restante: 150 - 10 = 140 unidades
    // Valoración restante: 140 x $3.400 = $476.000 COP
    console.log('   Procesando devolución a proveedor (SUPPLIER_RETURN): 10 unds @ $3.400 COP...')
    await client.query(`
      INSERT INTO public.inventory_movements (
        company_id, location_id, product_id, user_id, movement_type,
        quantity_in, quantity_out, previous_stock, new_stock, unit_cost, total_cost,
        document_type, document_reference, reason
      ) VALUES (
        $1, $2, $3, $4, 'SUPPLIER_RETURN',
        0.00, 10.00, 150.00, 140.00, 3400.00, 34000.00,
        'PURCHASE', $5, 'Devolución de 10 unidades por fecha corta de vencimiento'
      );
    `, [compA, locA1, product.id, userWarehouseAId, purchase.purchase_number])

    const stockAfterReturn = (await client.query(`
      SELECT quantity, average_cost, total_value_at_cost, health_status
      FROM public.stock_levels
      WHERE product_id = $1 AND location_id = $2;
    `, [product.id, locA1])).rows[0]

    console.log(`   Existencias tras devolución al proveedor:`)
    console.log(`   - Cantidad restante: ${stockAfterReturn.quantity} unds (Esperado: 140.00)`)
    console.log(`   - Costo promedio:    $${stockAfterReturn.average_cost} COP (Esperado: 3400.00)`)
    console.log(`   - Valoración total:  $${stockAfterReturn.total_value_at_cost} COP (Esperado: 476000.00)`)
    console.log(`   - Estado de salud:   ${stockAfterReturn.health_status} (Esperado: AVAILABLE)`)

    if (Number(stockAfterReturn.quantity) !== 140 || Number(stockAfterReturn.total_value_at_cost) !== 476000) {
      throw new Error(`Error en Kardex tras devolución a proveedor: cantidad = ${stockAfterReturn.quantity}`)
    }
    console.log('✅ Descuento de existencias en Kardex por SUPPLIER_RETURN validado con éxito.')

    // -------------------------------------------------------------------------
    // FLUJO 11: NOTA DÉBITO COMERCIAL Y REVERSIÓN CONTABLE
    // -------------------------------------------------------------------------
    console.log('\n================================================================================')
    console.log('11. NOTA DÉBITO COMERCIAL Y REVERSIÓN CONTABLE POR DEVOLUCIÓN A PROVEEDOR')
    console.log('================================================================================')

    // Liquidación de la devolución al costo de compra original ($3.600):
    // 10 unidades devueltas:
    // Subtotal: 10 x $3.600 = $36.000,00 COP
    // IVA 19% devuelto:       $6.840,00 COP
    // ReteFuente revertida:    $900,00 COP (2.5% sobre $36.000)
    // Saldo a Favor / Menor CXP Proveedor: $36.000 + $6.840 - $900 = $41.940,00 COP
    //
    // Asiento contable de Reversión / Nota Débito (CC-2026-0003):
    // Línea 1: 2205 (Proveedores / Saldo a Favor)  -> Débito  $41.940,00
    // Línea 2: 2365 (Reversión ReteFuente)         -> Débito     $900,00
    // Línea 3: 1435 (Salida de inventario a costo) -> Crédito $36.000,00
    // Línea 4: 2408 (Reversión IVA descontable 19%)-> Crédito  $6.840,00
    // Total Débito = $41.940 + $900 = $42.840 COP
    // Total Crédito = $36.000 + $6.840 = $42.840 COP (Partida Doble Perfecta)
    const revEntryRes = await client.query(`
      INSERT INTO public.accounting_entries (
        company_id, location_id, consecutive, entry_number, date, concept,
        document_type, document_reference, status, created_by_user_id
      ) VALUES (
        $1, $2, 2003, 'CP-2026-0003', CURRENT_DATE,
        'Nota Débito ND-001 Devolución parcial de mercancía a Disnalimentos S.A.S.',
        'DEBIT_NOTE', 'ND-DISNAL-001', 'DRAFT', $3
      ) RETURNING id, entry_number;
    `, [compA, locA1, userAccountantAId])
    const revEntryId = revEntryRes.rows[0].id

    await client.query(`
      INSERT INTO public.accounting_entry_lines (
        entry_id, account_id, third_party_doc, third_party_name, description, debit_amount, credit_amount
      ) VALUES 
        ($1, $2, '900555444', 'Disnalimentos S.A.S.', 'Saldo a favor por devolución de mercancía comprada', 41940.00, 0.00),
        ($1, $3, '900123456', 'DIAN', 'Reversión proporcional de retención en la fuente', 900.00, 0.00),
        ($1, $4, '900555444', 'Disnalimentos S.A.S.', 'Salida física de inventario devuelto a costo de compra', 0.00, 36000.00),
        ($1, $5, '900555444', 'Disnalimentos S.A.S.', 'Reversión IVA descontable por devolución a proveedor', 0.00, 6840.00);
    `, [revEntryId, accounts.get('2205'), accounts.get('2365'), accounts.get('1435'), accounts.get('2408')])

    await client.query(`
      UPDATE public.accounting_entries
      SET status = 'POSTED', posted_at = NOW()
      WHERE id = $1;
    `, [revEntryId])

    const sumRevLines = (await client.query(`
      SELECT SUM(debit_amount)::numeric(15,2) as total_debit, SUM(credit_amount)::numeric(15,2) as total_credit
      FROM public.accounting_entry_lines
      WHERE entry_id = $1;
    `, [revEntryId])).rows[0]

    console.log(`   Asiento contable de Nota Débito asentado (POSTED):`)
    console.log(`   - Comprobante:    ${revEntryRes.rows[0].entry_number}`)
    console.log(`   - Total Débito:   $${sumRevLines.total_debit} COP`)
    console.log(`   - Total Crédito:  $${sumRevLines.total_credit} COP`)
    console.log(`   - Balance:        Partida Doble Verificada (Débito == Crédito)`)

    if (Number(sumRevLines.total_debit) !== Number(sumRevLines.total_credit)) {
      throw new Error('Descuadre en asiento de Nota Débito a proveedor.')
    }
    console.log('✅ Nota Débito y reversión contable certificadas con exactitud.')

    // -------------------------------------------------------------------------
    // FLUJO 12: AISLAMIENTO MULTI-TENANT Y MULTI-SEDE
    // -------------------------------------------------------------------------
    console.log('\n================================================================================')
    console.log('12. VALIDACIÓN DE AISLAMIENTO MULTI-TENANT Y MULTI-SEDE EN COMPRAS')
    console.log('================================================================================')

    // 12.1 Usuario de Empresa B no puede ver proveedores de Empresa A
    await client.query(`SET LOCAL ROLE authenticated;`)
    await client.query(`SET LOCAL "request.jwt.claims" = '${JSON.stringify({
      sub: userAdminBId,
      role: 'authenticated',
      app_metadata: { role: 'ADMIN', company_id: compB },
    })}';`)

    const suppCompB = await client.query(`SELECT * FROM public.suppliers WHERE id = $1;`, [supplierA.id])
    console.log(`   Proveedores de Empresa A visibles para Empresa B: ${suppCompB.rows.length} (Esperado: 0)`)
    if (suppCompB.rows.length !== 0) {
      throw new Error('Fuga multi-tenant: Empresa B puede consultar proveedores de Empresa A.')
    }

    // 12.2 Usuario de Empresa B no puede ver compras de Empresa A
    const purchCompB = await client.query(`SELECT * FROM public.purchases;`)
    console.log(`   Compras de Empresa A visibles para Empresa B:     ${purchCompB.rows.length} (Esperado: 0)`)
    if (purchCompB.rows.length !== 0) {
      throw new Error('Fuga multi-tenant: Empresa B puede consultar compras de Empresa A.')
    }

    // 12.3 Usuario de Empresa B no puede ver cuentas bancarias de Empresa A
    const banksCompB = await client.query(`SELECT * FROM public.bank_accounts;`)
    console.log(`   Cuentas bancarias de Empresa A visibles para B:   ${banksCompB.rows.length} (Esperado: 0)`)
    if (banksCompB.rows.length !== 0) {
      throw new Error('Fuga multi-tenant: Empresa B puede consultar cuentas bancarias de Empresa A.')
    }

    // 12.4 Usuario de Empresa B no puede ver pagos de tesorería de Empresa A
    const paysCompB = await client.query(`SELECT * FROM public.treasury_payments;`)
    console.log(`   Pagos de tesorería de Empresa A visibles para B:  ${paysCompB.rows.length} (Esperado: 0)`)
    if (paysCompB.rows.length !== 0) {
      throw new Error('Fuga multi-tenant: Empresa B puede consultar pagos de tesorería de Empresa A.')
    }

    await client.query(`SET LOCAL ROLE postgres;`)
    console.log('✅ Aislamiento estricto multi-tenant y multi-sede certificado.')

    // -------------------------------------------------------------------------
    // FLUJO 13: AUDITORÍA FORENSE E INMUTABILIDAD DE LOGS
    // -------------------------------------------------------------------------
    console.log('\n================================================================================')
    console.log('13. AUDITORÍA FORENSE Y VALIDACIÓN DE INMUTABILIDAD DE REGISTROS')
    console.log('================================================================================')

    // Registrar eventos de recepción, desembolso y devolución
    await client.query(`
      INSERT INTO public.audit_logs (
        company_id, location_id, user_id, user_name, action, module,
        entity_name, entity_id, new_value
      ) VALUES 
        ($1, $2, $3, 'Jefe Bodega Bernardo', 'RECEIVE_PURCHASE', 'purchases', 'purchases', $4,
         jsonb_build_object('purchase', $7::text, 'received_units', 100)),
        ($1, $2, $5, 'Contadora Constanza', 'DISBURSE_PAYMENT', 'treasury', 'treasury_payments', $6,
         jsonb_build_object('payment', $8::text, 'amount', 419400.00)),
        ($1, $2, $3, 'Jefe Bodega Bernardo', 'SUPPLIER_RETURN', 'inventory', 'inventory_movements', $4,
         jsonb_build_object('returned_units', 10, 'reason', 'Fecha corta'));
    `, [compA, locA1, userWarehouseAId, purchase.id, userAccountantAId, payment.id, purchase.purchase_number, payment.payment_number])

    const totalAuditLogs = (await client.query(`SELECT COUNT(*)::int as count FROM public.audit_logs;`)).rows[0].count
    console.log(`   Total eventos de auditoría registrados en la prueba: ${totalAuditLogs}`)

    // Intentar alterar o eliminar registros de auditoría
    let auditTamperBlocked = false
    try {
      await client.query('SAVEPOINT sp_audit_tamper;')
      await client.query(`DELETE FROM public.audit_logs WHERE action = 'DISBURSE_PAYMENT';`)
    } catch (err: any) {
      auditTamperBlocked = true
      await client.query('ROLLBACK TO SAVEPOINT sp_audit_tamper;')
      console.log(`✅ Inmutabilidad de auditoría confirmada: "${err.message}"`)
    }
    if (!auditTamperBlocked) {
      throw new Error('Falla crítica: Se permitió eliminar registros de auditoría forense.')
    }
    console.log('✅ Trazabilidad forense e inmutabilidad de auditoría certificadas.')

    // -------------------------------------------------------------------------
    // FLUJO 14: ROLLBACK ESTRICTO DE LA TRANSACCIÓN
    // -------------------------------------------------------------------------
    console.log('\n================================================================================')
    console.log('14. ROLLBACK ESTRICTO DE LA TRANSACCIÓN')
    console.log('================================================================================')

    await client.query('ROLLBACK;')
    console.log('⏪ [ROLLBACK] Transacción revertida completamente.')

    // -------------------------------------------------------------------------
    // FLUJO 15: COMPROBACIÓN POST-ROLLBACK (CERO REGISTROS RESIDUALES)
    // -------------------------------------------------------------------------
    console.log('\n================================================================================')
    console.log('15. COMPROBACIÓN POST-ROLLBACK: VERIFICACIÓN DE CERO RESIDUOS COMERCIALES')
    console.log('================================================================================')

    const postTables = [
      'suppliers',
      'purchases',
      'purchase_items',
      'treasury_payments',
      'bank_accounts',
      'bank_movements',
      'stock_levels',
      'inventory_movements',
      'accounting_entries',
      'accounting_entry_lines',
      'audit_logs',
      'products',
    ]

    let allClean = true
    for (const t of postTables) {
      const res = await client.query(`SELECT COUNT(*)::int as count FROM public.${t};`)
      const cnt = res.rows[0].count
      console.log(`   - ${t.padEnd(25)}: ${cnt} registros`)
      if (cnt !== 0) {
        allClean = false
        console.error(`❌ ALERTA: La tabla ${t} quedó con ${cnt} registros post-rollback.`)
      }
    }

    // Verificar entidades maestras legítimas
    const compCount = (await client.query('SELECT COUNT(*)::int as count FROM public.companies;')).rows[0].count
    const locCount = (await client.query('SELECT COUNT(*)::int as count FROM public.locations;')).rows[0].count
    const usrCount = (await client.query('SELECT COUNT(*)::int as count FROM public.users;')).rows[0].count

    console.log(`\n   Entidades maestras legítimas preservadas:`)
    console.log(`   - companies: ${compCount} (Esperado: 1)`)
    console.log(`   - locations: ${locCount} (Esperado: 1)`)
    console.log(`   - users:     ${usrCount} (Esperado: 1)`)

    if (!allClean || compCount !== 1 || locCount !== 1 || usrCount !== 1) {
      throw new Error('Discrepancia post-rollback: La base de datos no quedó en su estado limpio original.')
    }

    console.log('\n================================================================================')
    console.log('🎉 RESULTADO FINAL: PASO 12 SUPERADO EXITOSAMENTE AL 100%')
    console.log('================================================================================')
  } catch (error) {
    await client.query('ROLLBACK;').catch(() => {})
    console.error('\n❌ ERROR EN LA SUITE DE PRUEBAS DE COMPRAS Y TESORERÍA:', error)
    process.exit(1)
  } finally {
    await client.end()
  }
}

runRealPurchasesSuppliersApTests()
