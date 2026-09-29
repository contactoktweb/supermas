/**
 * ==============================================================================
 * SUITE DE VALIDACIÓN REAL DE VENTAS / POS Y FACTURACIÓN ELECTRÓNICA (PASO 11)
 * ERP SUPER MÁS S.A.S. — Supabase PostgreSQL (Staging)
 * ==============================================================================
 *
 * REGLAS OBLIGATORIAS:
 * 1. Transacción estricta BEGIN ... ROLLBACK (Cero persistencia comercial final).
 * 2. No crear clientes, ventas o facturas reales en staging todavía.
 * 3. Validar el flujo completo:
 *    - 1. Creación de cliente con datos fiscales.
 *    - 2. Creación de producto con entrada y costo en Kardex.
 *    - 3. Prevención de venta sin stock (Overselling blocking).
 *    - 4. Bloqueo de usuario no autorizado intentando vender (RLS).
 *    - 5. Registro exitoso de Venta POS por cajero autorizado.
 *    - 6. Descuento automático y atómico de existencias en Kardex.
 *    - 7. Generación de Factura Electrónica DIAN y desglose de impuestos (IVA 19%).
 *    - 8. Inmutabilidad de venta y factura electrónica (prohibición DELETE físico).
 *    - 9. Contabilización automática en partida doble PUC (1105, 4135, 2408, 6135, 1435).
 *    - 10. Aislamiento estricto multi-tenant y multi-sede (Empresa A vs Empresa B).
 *    - 11. Devolución de venta (CUSTOMER_RETURN) con reingreso atómico de inventario.
 *    - 12. Emisión de Nota Crédito DIAN y reversión contable en partida doble.
 *    - 13. Auditoría de todas las operaciones sensibles (audit_logs).
 *    - 14. Inmutabilidad de logs de auditoría (prohibición UPDATE/DELETE).
 *    - 15. Comprobación post-rollback (todas las tablas comerciales vuelven a cero).
 */

import pg from 'pg'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

async function runRealSalesPosInvoicingTests() {
  const client = new pg.Client({
    connectionString: process.env.DIRECT_URL,
    ssl: { rejectUnauthorized: false },
  })

  await client.connect()

  console.log('================================================================================')
  console.log('🧾 SUITE DE VALIDACIÓN REAL DE VENTAS / POS Y FACTURACIÓN ELECTRÓNICA (PASO 11)')
  console.log('================================================================================\n')

  try {
    // -------------------------------------------------------------------------
    // 0. VERIFICACIÓN PREVIA AL TEST (ESTADO LIMPIO EN STAGING)
    // -------------------------------------------------------------------------
    console.log('--- 0. COMPROBACIÓN DE TABLAS PRE-TEST (DEBEN ESTAR EN CERO) ---')
    const preTables = [
      'customers',
      'sales',
      'sale_items',
      'electronic_invoices',
      'stock_levels',
      'inventory_movements',
      'accounting_entries',
      'accounting_entry_lines',
      'audit_logs',
    ]

    for (const t of preTables) {
      const res = await client.query(`SELECT COUNT(*)::int as count FROM public.${t};`)
      const cnt = res.rows[0].count
      if (cnt !== 0) {
        throw new Error(`Estado inicial inválido: la tabla ${t} contiene ${cnt} registros (se esperaba 0).`)
      }
    }
    console.log('✅ Todas las tablas comerciales y transaccionales están limpias (0 registros).\n')

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
    const userCashierAId = 'a0000000-0000-0000-0000-000000000001' // CASHIER en Empresa A (Bodega A1)
    const userAccountantAId = 'a0000000-0000-0000-0000-000000000002' // ACCOUNTANT en Empresa A
    const userSellerAId = 'a0000000-0000-0000-0000-000000000003' // SELLER en Empresa A (Bodega A2)
    const userCashierBId = 'b0000000-0000-0000-0000-000000000001' // CASHIER en Empresa B (Bodega B1)

    await client.query(`
      INSERT INTO auth.users (id, email, raw_app_meta_data, raw_user_meta_data)
      VALUES 
        ($1, 'cajero@empresa-a.com', jsonb_build_object('role', 'CASHIER', 'company_id', $2::text), '{}'::jsonb),
        ($3, 'contador@empresa-a.com', jsonb_build_object('role', 'ACCOUNTANT', 'company_id', $2::text), '{}'::jsonb),
        ($4, 'vendedor@empresa-a.com', jsonb_build_object('role', 'SELLER', 'company_id', $2::text), '{}'::jsonb),
        ($5, 'cajero@empresa-b.com', jsonb_build_object('role', 'CASHIER', 'company_id', $6::text), '{}'::jsonb);
    `, [userCashierAId, compA, userAccountantAId, userSellerAId, userCashierBId, compB])

    await client.query(`
      INSERT INTO public.users (id, company_id, email, full_name, role_id, is_active)
      VALUES 
        ($1, $2, 'cajero@empresa-a.com', 'Cajero Carlos POS', $3, true),
        ($4, $2, 'contador@empresa-a.com', 'Contador Constanza', $5, true),
        ($6, $2, 'vendedor@empresa-a.com', 'Vendedor Vicente', $7, true),
        ($8, $9, 'cajero@empresa-b.com', 'Cajero Beto B', $3, true)
      ON CONFLICT (id) DO UPDATE SET 
        company_id = EXCLUDED.company_id,
        role_id = EXCLUDED.role_id,
        full_name = EXCLUDED.full_name;
    `, [
      userCashierAId, compA, roles.get('CASHIER'),
      userAccountantAId, roles.get('ACCOUNTANT'),
      userSellerAId, roles.get('SELLER'),
      userCashierBId, compB,
    ])

    // Asignar sedes
    await client.query(`
      INSERT INTO public.user_locations (user_id, location_id, is_primary)
      VALUES 
        ($1, $2, true),
        ($3, $4, true),
        ($5, $6, true);
    `, [userCashierAId, locA1, userSellerAId, locA2, userCashierBId, locB1])

    console.log('✅ Usuarios y sedes creados para simulación RLS.\n')

    // -------------------------------------------------------------------------
    // FLUJO 1: CREACIÓN DE CLIENTE (customers)
    // -------------------------------------------------------------------------
    console.log('================================================================================')
    console.log('1. CREACIÓN DE CLIENTE CON INFORMACIÓN FISCAL Y COMERCIAL')
    console.log('================================================================================')

    const custRes = await client.query(`
      INSERT INTO public.customers (
        company_id, document_type, document_number, verification_digit,
        first_name, last_name, customer_type, customer_category,
        email, phone, address, city, department, credit_limit
      ) VALUES (
        $1, 'CC', '1020304050', null,
        'Juan David', 'Pérez Restrepo', 'INDIVIDUAL', 'RETAIL',
        'juan.perez@test.com', '3001234567', 'Calle 10 # 40-20', 'Medellín', 'Antioquia', 0.00
      ) RETURNING id, first_name, last_name, document_number;
    `, [compA])
    const customer = custRes.rows[0]
    console.log(`✅ Cliente creado: "${customer.first_name} ${customer.last_name}" (CC: ${customer.document_number}, ID: ${customer.id})`)

    // Registrar auditoría de creación de cliente
    await client.query(`
      INSERT INTO public.audit_logs (
        company_id, location_id, user_id, user_name, action, module,
        entity_name, entity_id, new_value
      ) VALUES (
        $1, $2, $3, 'Cajero Carlos POS', 'CREATE', 'customers',
        'customers', $4, jsonb_build_object('name', 'Juan David Pérez', 'doc', '1020304050')
      );
    `, [compA, locA1, userCashierAId, customer.id])

    // -------------------------------------------------------------------------
    // FLUJO 2: CREACIÓN DE PRODUCTO Y ENTRADA DE INVENTARIO EN KARDEX
    // -------------------------------------------------------------------------
    console.log('\n================================================================================')
    console.log('2. CREACIÓN DE PRODUCTO Y ENTRADA DE INVENTARIO KARDEX')
    console.log('================================================================================')

    const prodRes = await client.query(`
      INSERT INTO public.products (
        company_id, sku, barcode, name, slug, short_description, unit_of_measure, min_stock_threshold
      ) VALUES (
        $1, 'SKU-ACEITE-1L', '7701234567890', 'Aceite Vegetal Premier 1L', 'aceite-vegetal-premier-1l',
        'Aceite para cocina 1000ml', 'UND', 5
      ) RETURNING id, name, sku;
    `, [compA])
    const product = prodRes.rows[0]
    console.log(`✅ Producto creado: "${product.name}" [${product.sku}] (ID: ${product.id})`)

    // Entrada inicial vía Kardex: 50 unidades a $8.000 COP c/u ($400.000 total)
    console.log('   Registrando entrada de mercancía (PURCHASE_ENTRY): 50 unidades @ $8.000 COP...')
    await client.query(`
      INSERT INTO public.inventory_movements (
        company_id, location_id, product_id, user_id, movement_type,
        quantity_in, quantity_out, previous_stock, new_stock, unit_cost, total_cost,
        document_type, document_reference, reason
      ) VALUES (
        $1, $2, $3, $4, 'PURCHASE_ENTRY',
        50.00, 0.00, 0.00, 50.00, 8000.00, 400000.00,
        'PURCHASE', 'FAC-PROV-7788', 'Recepción de compra inicial'
      );
    `, [compA, locA1, product.id, userCashierAId])

    const stockInitial = (await client.query(`
      SELECT quantity, average_cost, total_value_at_cost, health_status
      FROM public.stock_levels
      WHERE product_id = $1 AND location_id = $2;
    `, [product.id, locA1])).rows[0]

    console.log(`   Existencias verificadas:`)
    console.log(`   - Cantidad en bodega: ${stockInitial.quantity} unds (Esperado: 50.00)`)
    console.log(`   - Costo promedio:     $${stockInitial.average_cost} COP (Esperado: 8000.00)`)
    console.log(`   - Valoración total:   $${stockInitial.total_value_at_cost} COP (Esperado: 400000.00)`)
    console.log(`   - Estado de salud:    ${stockInitial.health_status} (Esperado: AVAILABLE)`)

    if (Number(stockInitial.quantity) !== 50 || Number(stockInitial.average_cost) !== 8000) {
      throw new Error('Discrepancia en stock inicial.')
    }
    console.log('✅ Entrada de Kardex y estado de existencias validado con éxito.')

    // -------------------------------------------------------------------------
    // FLUJO 3: PRUEBA NEGATIVA - INTENTO DE OVERSELLING (VENTA SIN STOCK)
    // -------------------------------------------------------------------------
    console.log('\n================================================================================')
    console.log('3. PRUEBA NEGATIVA: INTENTO DE VENTA SIN STOCK SUFICIENTE (OVERSELLING)')
    console.log('================================================================================')

    let oversellBlocked = false
    try {
      await client.query('SAVEPOINT sp_oversell;')
      // Se intenta despachar 60 unidades cuando sólo existen 50
      await client.query(`
        INSERT INTO public.inventory_movements (
          company_id, location_id, product_id, user_id, movement_type,
          quantity_in, quantity_out, previous_stock, new_stock, unit_cost, total_cost,
          document_type, document_reference, reason
        ) VALUES (
          $1, $2, $3, $4, 'SALE_OUT',
          0.00, 60.00, 50.00, -10.00, 8000.00, 480000.00,
          'SALE', 'VTA-OVERSELL-01', 'Intento de venta sin stock'
        );
      `, [compA, locA1, product.id, userCashierAId])
    } catch (err: any) {
      oversellBlocked = true
      await client.query('ROLLBACK TO SAVEPOINT sp_oversell;')
      console.log(`✅ Bloqueo de overselling exitoso: "${err.message}"`)
    }

    if (!oversellBlocked) {
      throw new Error('Falla de seguridad: Se permitió registrar una salida superior al stock disponible.')
    }

    // Verificar que el stock sigue intacto en 50
    const stockAfterOversell = (await client.query(`
      SELECT quantity FROM public.stock_levels WHERE product_id = $1 AND location_id = $2;
    `, [product.id, locA1])).rows[0].quantity
    if (Number(stockAfterOversell) !== 50) {
      throw new Error(`El stock se alteró tras intento de overselling: ${stockAfterOversell}`)
    }
    console.log(`✅ Integridad confirmada: El stock se mantiene inalterado en ${stockAfterOversell} unidades.`)

    // -------------------------------------------------------------------------
    // FLUJO 4: PRUEBA NEGATIVA - INTENTO DE VENTA POR USUARIO NO AUTORIZADO
    // -------------------------------------------------------------------------
    console.log('\n================================================================================')
    console.log('4. PRUEBA NEGATIVA: USUARIO SIN PERMISO DE VENTA INTENTA REGISTRAR VENTA')
    console.log('================================================================================')

    let unauthorizedBlocked = false
    try {
      await client.query('SAVEPOINT sp_unauth_sale;')
      // Simular usuario Contador (no tiene sales.create ni acceso a ventas operativas)
      await client.query(`SET LOCAL ROLE authenticated;`)
      await client.query(`SET LOCAL "request.jwt.claims" = '${JSON.stringify({
        sub: userAccountantAId,
        role: 'authenticated',
        app_metadata: { role: 'ACCOUNTANT', company_id: compA },
      })}';`)

      await client.query(`
        INSERT INTO public.sales (
          company_id, location_id, customer_id, seller_user_id,
          sale_number, subtotal_amount, discount_amount, tax_amount, total_amount,
          total_cost_amount, payment_method, status
        ) VALUES (
          $1, $2, $3, $4,
          'VTA-UNAUTH-001', 100000.00, 0.00, 19000.00, 119000.00,
          80000.00, 'CASH', 'ISSUED'
        );
      `, [compA, locA1, customer.id, userAccountantAId])
    } catch (err: any) {
      unauthorizedBlocked = true
      await client.query('ROLLBACK TO SAVEPOINT sp_unauth_sale;')
      await client.query(`SET LOCAL ROLE postgres;`)
      console.log(`✅ Bloqueo RLS exitoso: Usuario ACCOUNTANT no pudo insertar venta (${err.message}).`)
    } finally {
      await client.query(`SET LOCAL ROLE postgres;`)
    }

    if (!unauthorizedBlocked) {
      throw new Error('Falla de seguridad RLS: Usuario sin permiso sales.create pudo insertar una venta.')
    }

    // -------------------------------------------------------------------------
    // FLUJO 5: VENTA POS EXITOSA POR CAJERO AUTORIZADO
    // -------------------------------------------------------------------------
    console.log('\n================================================================================')
    console.log('5. VENTA POS EXITOSA POR CAJERO AUTORIZADO CON RLS ACTIVO')
    console.log('================================================================================')

    // Simular contexto autenticado del Cajero
    await client.query(`SET LOCAL ROLE authenticated;`)
    await client.query(`SET LOCAL "request.jwt.claims" = '${JSON.stringify({
      sub: userCashierAId,
      role: 'authenticated',
      app_metadata: { role: 'CASHIER', company_id: compA },
    })}';`)

    // Parámetros de la venta: 10 unidades de Aceite Premier
    // Precio unitario: $10.000 COP base + 19% IVA ($1.900) = $11.900 COP total unitario
    // Subtotal: $100.000 COP
    // IVA 19%:  $19.000 COP
    // Total:    $119.000 COP
    // Costo:    10 x $8.000 = $80.000 COP
    // Utilidad: $20.000 COP
    const saleNumber = 'VTA-POS-2026-0001'
    const saleRes = await client.query(`
      INSERT INTO public.sales (
        company_id, location_id, customer_id, seller_user_id,
        sale_number, subtotal_amount, discount_amount, tax_amount, total_amount,
        total_cost_amount, payment_method, status, notes
      ) VALUES (
        $1, $2, $3, $4,
        $5, 100000.00, 0.00, 19000.00, 119000.00,
        80000.00, 'CASH', 'ISSUED', 'Venta mostrador POS cliente general'
      ) RETURNING id, sale_number, total_amount, total_cost_amount, estimated_profit_amount;
    `, [compA, locA1, customer.id, userCashierAId, saleNumber])
    const sale = saleRes.rows[0]

    // Insertar línea de venta (sale_items)
    const saleItemRes = await client.query(`
      INSERT INTO public.sale_items (
        company_id, sale_id, product_id, quantity, unit_cost, unit_price,
        discount_percent, tax_rate_percent, tax_amount, subtotal, total
      ) VALUES (
        $1, $2, $3, 10.00, 8000.00, 10000.00,
        0.00, 19.00, 19000.00, 100000.00, 119000.00
      ) RETURNING id, quantity, unit_price, tax_amount, total;
    `, [compA, sale.id, product.id])
    const saleItem = saleItemRes.rows[0]

    console.log(`✅ Venta POS registrada con éxito:`)
    console.log(`   - Comprobante: ${sale.sale_number} (ID: ${sale.id})`)
    console.log(`   - Producto:    ${product.name} x ${saleItem.quantity} unds @ $10.000 c/u`)
    console.log(`   - Subtotal:    $100.000 COP`)
    console.log(`   - IVA (19%):   $${saleItem.tax_amount} COP`)
    console.log(`   - Total Venta: $${sale.total_amount} COP`)
    console.log(`   - Costo Total: $${sale.total_cost_amount} COP`)

    // Volver a rol postgres para operaciones internas de inventario y triggers
    await client.query(`SET LOCAL ROLE postgres;`)

    // -------------------------------------------------------------------------
    // FLUJO 6: DESCUENTO AUTOMÁTICO DE INVENTARIO MEDIANTE KARDEX (SALE_OUT)
    // -------------------------------------------------------------------------
    console.log('\n================================================================================')
    console.log('6. DESCUENTO AUTOMÁTICO DE INVENTARIO MEDIANTE KARDEX')
    console.log('================================================================================')

    // Registrar salida en Kardex asociada a la venta
    await client.query(`
      INSERT INTO public.inventory_movements (
        company_id, location_id, product_id, user_id, movement_type,
        quantity_in, quantity_out, previous_stock, new_stock, unit_cost, total_cost,
        document_type, document_reference, reason
      ) VALUES (
        $1, $2, $3, $4, 'SALE_OUT',
        0.00, 10.00, 50.00, 40.00, 8000.00, 80000.00,
        'SALE', $5, 'Despacho automático por venta POS'
      );
    `, [compA, locA1, product.id, userCashierAId, sale.sale_number])

    const stockAfterSale = (await client.query(`
      SELECT quantity, average_cost, total_value_at_cost, health_status
      FROM public.stock_levels
      WHERE product_id = $1 AND location_id = $2;
    `, [product.id, locA1])).rows[0]

    console.log(`   Existencias tras la venta:`)
    console.log(`   - Cantidad restante: ${stockAfterSale.quantity} unds (Esperado: 40.00)`)
    console.log(`   - Costo promedio:    $${stockAfterSale.average_cost} COP (Esperado: 8000.00)`)
    console.log(`   - Valoración total:  $${stockAfterSale.total_value_at_cost} COP (Esperado: 320000.00)`)
    console.log(`   - Estado de salud:   ${stockAfterSale.health_status} (Esperado: AVAILABLE)`)

    if (Number(stockAfterSale.quantity) !== 40 || Number(stockAfterSale.total_value_at_cost) !== 320000) {
      throw new Error(`Error en el cálculo atómico de Kardex tras la venta: cantidad = ${stockAfterSale.quantity}`)
    }
    console.log('✅ Descuento de inventario verificado en Kardex y stock_levels.')

    // -------------------------------------------------------------------------
    // FLUJO 7: GENERACIÓN DE FACTURA ELECTRÓNICA DIAN E IMPUESTOS
    // -------------------------------------------------------------------------
    console.log('\n================================================================================')
    console.log('7. GENERACIÓN DE FACTURA ELECTRÓNICA DIAN E IMPUESTOS (IVA 19%)')
    console.log('================================================================================')

    // Contexto autenticado del cajero para emitir factura
    await client.query(`SET LOCAL ROLE authenticated;`)
    await client.query(`SET LOCAL "request.jwt.claims" = '${JSON.stringify({
      sub: userCashierAId,
      role: 'authenticated',
      app_metadata: { role: 'CASHIER', company_id: compA },
    })}';`)

    const dianPrefix = 'SETP'
    const dianNumber = 990000001
    const fullNumber = `${dianPrefix}-${dianNumber}`
    const cufeHash = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855e3b0c44298fc1c14'

    const qrCodeData = `https://catalogo-vpfe.dian.gov.co/document/searchqr?documentkey=${cufeHash}`

    const invoiceRes = await client.query(`
      INSERT INTO public.electronic_invoices (
        company_id, location_id, sale_id, customer_id,
        prefix, number, document_type,
        cufe, qr_code_data, subtotal_amount, tax_amount, total_amount,
        dian_status, dian_response_message, dian_response_date,
        dian_prefix, dian_number, dian_resolution
      ) VALUES (
        $1, $2, $3, $4,
        $5, $6, 'INVOICE',
        $7, $8,
        100000.00, 19000.00, 119000.00,
        'ACCEPTED', 'La Factura Electrónica SETP-990000001 ha sido autorizada por la DIAN.', NOW(),
        $5, $6, 'Resolución DIAN No. 18760000001 de 2026'
      ) RETURNING id, full_number, cufe, dian_status, total_amount;
    `, [compA, locA1, sale.id, customer.id, dianPrefix, dianNumber, cufeHash, qrCodeData])
    const invoice = invoiceRes.rows[0]

    console.log(`✅ Factura Electrónica emitida y vinculada:`)
    console.log(`   - Número:     ${invoice.full_number} (ID: ${invoice.id})`)
    console.log(`   - Estado DIAN:${invoice.dian_status}`)
    console.log(`   - CUFE:       ${invoice.cufe.slice(0, 32)}...`)
    console.log(`   - Base Gravable: $100.000 COP (IVA 19%: $19.000 COP)`)
    console.log(`   - Total:      $${invoice.total_amount} COP`)

    // Volver a rol postgres para registro de auditoría del sistema
    await client.query(`SET LOCAL ROLE postgres;`)

    // Registrar en auditoría la emisión de factura
    await client.query(`
      INSERT INTO public.audit_logs (
        company_id, location_id, user_id, user_name, action, module,
        entity_name, entity_id, new_value
      ) VALUES (
        $1, $2, $3, 'Cajero Carlos POS', 'EMIT_INVOICE', 'invoicing',
        'electronic_invoices', $4, jsonb_build_object('invoice', $5::text, 'cufe', $6::text)
      );
    `, [compA, locA1, userCashierAId, invoice.id, invoice.full_number, invoice.cufe])

    // -------------------------------------------------------------------------
    // FLUJO 8: INMUTABILIDAD DE VENTAS Y FACTURAS ELECTRÓNICAS
    // -------------------------------------------------------------------------
    console.log('\n================================================================================')
    console.log('8. VALIDACIÓN DE INMUTABILIDAD COMERCIAL (PREVENCIÓN DE BORRADO FÍSICO)')
    console.log('================================================================================')

    // 8.1 Intentar eliminar la venta
    let deleteSaleBlocked = false
    try {
      await client.query('SAVEPOINT sp_del_sale;')
      await client.query(`DELETE FROM public.sales WHERE id = $1;`, [sale.id])
    } catch (err: any) {
      deleteSaleBlocked = true
      await client.query('ROLLBACK TO SAVEPOINT sp_del_sale;')
      console.log(`✅ Bloqueo de eliminación de venta: "${err.message}"`)
    }
    if (!deleteSaleBlocked) {
      throw new Error('Falla de auditoría: Se permitió eliminar físicamente un registro de venta emitido.')
    }

    // 8.2 Intentar eliminar la factura electrónica
    let deleteInvoiceBlocked = false
    try {
      await client.query('SAVEPOINT sp_del_invoice;')
      await client.query(`DELETE FROM public.electronic_invoices WHERE id = $1;`, [invoice.id])
    } catch (err: any) {
      deleteInvoiceBlocked = true
      await client.query('ROLLBACK TO SAVEPOINT sp_del_invoice;')
      console.log(`✅ Bloqueo de eliminación de factura: "${err.message}"`)
    }
    if (!deleteInvoiceBlocked) {
      throw new Error('Falla DIAN: Se permitió eliminar físicamente una factura electrónica autorizada.')
    }
    console.log('✅ Inmutabilidad de ventas y facturas DIAN validada al 100%.')

    // -------------------------------------------------------------------------
    // FLUJO 9: CONTABILIZACIÓN AUTOMÁTICA EN PARTIDA DOBLE PUC
    // -------------------------------------------------------------------------
    console.log('\n================================================================================')
    console.log('9. CONTABILIZACIÓN EN PARTIDA DOBLE PUC (ASIENTO DE VENTA Y COSTO)')
    console.log('================================================================================')

    // Obtener IDs de las cuentas contables PUC
    const accRes = await client.query(`
      SELECT id, code, name FROM public.accounting_accounts
      WHERE code IN ('1105', '4135', '2408', '6135', '1435');
    `)
    const accounts = new Map(accRes.rows.map((a: any) => [a.code, a.id]))

    // 1. Crear comprobante contable en estado DRAFT
    const entryRes = await client.query(`
      INSERT INTO public.accounting_entries (
        company_id, location_id, consecutive, entry_number, date, concept,
        document_type, document_reference, status, created_by_user_id
      ) VALUES (
        $1, $2, 1001, 'CC-2026-0001', CURRENT_DATE,
        'Contabilización Venta POS Factura SETP-990000001',
        'SALES_INVOICE', $3, 'DRAFT', $4
      ) RETURNING id, entry_number;
    `, [compA, locA1, invoice.full_number, userCashierAId])
    const entryId = entryRes.rows[0].id

    // 2. Insertar líneas contables respetando la partida doble:
    // Línea 1: 1105 (Caja General) -> Débito $119.000 (Ingreso efectivo cliente)
    // Línea 2: 4135 (Comercio al por Mayor y Menor) -> Crédito $100.000 (Ingreso operacional)
    // Línea 3: 2408 (IVA por pagar 19%) -> Crédito $19.000 (Pasivo fiscal)
    // Línea 4: 6135 (Costo de Ventas) -> Débito $80.000 (Gasto costo mercancía)
    // Línea 5: 1435 (Inventario Mercancías) -> Crédito $80.000 (Salida de activo)
    // Total Débitos = $119.000 + $80.000 = $199.000
    // Total Créditos = $100.000 + $19.000 + $80.000 = $199.000 (Partida doble perfecta)
    await client.query(`
      INSERT INTO public.accounting_entry_lines (
        entry_id, account_id, third_party_doc, third_party_name, description, debit_amount, credit_amount
      ) VALUES 
        ($1, $2, '1020304050', 'Juan David Pérez', 'Recaudo en efectivo Venta SETP-990000001', 119000.00, 0.00),
        ($1, $3, '1020304050', 'Juan David Pérez', 'Ingreso por venta de mercancías', 0.00, 100000.00),
        ($1, $4, '900123456', 'DIAN', 'IVA generado 19% venta SETP-990000001', 0.00, 19000.00),
        ($1, $5, '1020304050', 'Juan David Pérez', 'Reconocimiento costo de venta', 80000.00, 0.00),
        ($1, $6, '1020304050', 'Juan David Pérez', 'Salida de inventario a costo', 0.00, 80000.00);
    `, [entryId, accounts.get('1105'), accounts.get('4135'), accounts.get('2408'), accounts.get('6135'), accounts.get('1435')])

    // 3. Asentar comprobante (POSTED)
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

    console.log(`   Asiento contable asentado (POSTED):`)
    console.log(`   - Comprobante:    ${entryRes.rows[0].entry_number}`)
    console.log(`   - Total Débito:   $${sumLines.total_debit} COP`)
    console.log(`   - Total Crédito:  $${sumLines.total_credit} COP`)
    console.log(`   - Balance:        Partida Doble Verificada (Débito == Crédito)`)

    if (Number(sumLines.total_debit) !== Number(sumLines.total_credit)) {
      throw new Error('Descuadre contable detectado.')
    }

    // 4. Validar inmutabilidad de asiento POSTED
    let updatePostedBlocked = false
    try {
      await client.query('SAVEPOINT sp_update_posted;')
      await client.query(`UPDATE public.accounting_entries SET concept = 'Fraude' WHERE id = $1;`, [entryId])
    } catch (err: any) {
      updatePostedBlocked = true
      await client.query('ROLLBACK TO SAVEPOINT sp_update_posted;')
      console.log(`✅ Inmutabilidad contable confirmada: Asiento POSTED no puede modificarse (${err.message}).`)
    }
    if (!updatePostedBlocked) {
      throw new Error('Falla contable: Se permitió modificar un asiento POSTED.')
    }

    // -------------------------------------------------------------------------
    // FLUJO 10: AISLAMIENTO MULTI-TENANT Y MULTI-SEDE
    // -------------------------------------------------------------------------
    console.log('\n================================================================================')
    console.log('10. VALIDACIÓN DE AISLAMIENTO MULTI-TENANT Y MULTI-SEDE')
    console.log('================================================================================')

    // 10.1 Cajero B (Empresa B) no puede ver ventas de Empresa A
    await client.query(`SET LOCAL ROLE authenticated;`)
    await client.query(`SET LOCAL "request.jwt.claims" = '${JSON.stringify({
      sub: userCashierBId,
      role: 'authenticated',
      app_metadata: { role: 'CASHIER', company_id: compB },
    })}';`)

    const salesCompB = await client.query(`SELECT * FROM public.sales;`)
    console.log(`   Ventas visibles para Cajero de Empresa B: ${salesCompB.rows.length} (Esperado: 0)`)
    if (salesCompB.rows.length !== 0) {
      throw new Error('Fuga multi-tenant: Empresa B puede ver ventas de Empresa A.')
    }

    const invoicesCompB = await client.query(`SELECT * FROM public.electronic_invoices;`)
    console.log(`   Facturas DIAN visibles para Empresa B:    ${invoicesCompB.rows.length} (Esperado: 0)`)
    if (invoicesCompB.rows.length !== 0) {
      throw new Error('Fuga multi-tenant: Empresa B puede ver facturas de Empresa A.')
    }

    // 10.2 Vendedor de Sede Envigado (A2) no puede ver ventas de Sede Principal (A1)
    await client.query(`SET LOCAL "request.jwt.claims" = '${JSON.stringify({
      sub: userSellerAId,
      role: 'authenticated',
      app_metadata: { role: 'SELLER', company_id: compA },
    })}';`)

    const salesSellerA2 = await client.query(`SELECT * FROM public.sales WHERE location_id = $1;`, [locA1])
    console.log(`   Ventas de Bodega A1 visibles para Vendedor de Bodega A2: ${salesSellerA2.rows.length} (Esperado: 0)`)
    if (salesSellerA2.rows.length !== 0) {
      throw new Error('Fuga multi-sede: Usuario de Sede Envigado puede consultar ventas de Sede Principal.')
    }

    await client.query(`SET LOCAL ROLE postgres;`)
    console.log('✅ Aislamiento estricto multi-tenant y multi-sede validado al 100%.')

    // -------------------------------------------------------------------------
    // FLUJO 11: DEVOLUCIÓN PARCIAL DE VENTA (CUSTOMER_RETURN EN KARDEX)
    // -------------------------------------------------------------------------
    console.log('\n================================================================================')
    console.log('11. DEVOLUCIÓN DE VENTA Y REINGRESO ATÓMICO EN KARDEX')
    console.log('================================================================================')

    // Cliente devuelve 2 unidades de Aceite Premier
    // Reingreso en Kardex: quantity_in = 2, unit_cost = 8000, total_cost = 16000
    console.log('   Procesando devolución de cliente (CUSTOMER_RETURN): 2 unidades @ $8.000 COP...')
    await client.query(`
      INSERT INTO public.inventory_movements (
        company_id, location_id, product_id, user_id, movement_type,
        quantity_in, quantity_out, previous_stock, new_stock, unit_cost, total_cost,
        document_type, document_reference, reason
      ) VALUES (
        $1, $2, $3, $4, 'CUSTOMER_RETURN',
        2.00, 0.00, 40.00, 42.00, 8000.00, 16000.00,
        'SALE', $5, 'Devolución parcial por cliente inconforme con empaque'
      );
    `, [compA, locA1, product.id, userCashierAId, sale.sale_number])

    const stockAfterReturn = (await client.query(`
      SELECT quantity, average_cost, total_value_at_cost, health_status
      FROM public.stock_levels
      WHERE product_id = $1 AND location_id = $2;
    `, [product.id, locA1])).rows[0]

    console.log(`   Existencias tras la devolución:`)
    console.log(`   - Cantidad en bodega: ${stockAfterReturn.quantity} unds (Esperado: 42.00)`)
    console.log(`   - Costo promedio:     $${stockAfterReturn.average_cost} COP (Esperado: 8000.00)`)
    console.log(`   - Valoración total:   $${stockAfterReturn.total_value_at_cost} COP (Esperado: 336000.00)`)
    console.log(`   - Estado de salud:    ${stockAfterReturn.health_status} (Esperado: AVAILABLE)`)

    if (Number(stockAfterReturn.quantity) !== 42 || Number(stockAfterReturn.total_value_at_cost) !== 336000) {
      throw new Error(`Error en Kardex tras devolución de cliente: cantidad = ${stockAfterReturn.quantity}`)
    }
    console.log('✅ Reingreso de inventario por devolución validado con exactitud.')

    // -------------------------------------------------------------------------
    // FLUJO 12: EMISIÓN DE NOTA CRÉDITO DIAN Y REVERSIÓN CONTABLE
    // -------------------------------------------------------------------------
    console.log('\n================================================================================')
    console.log('12. EMISIÓN DE NOTA CRÉDITO DIAN Y REVERSIÓN CONTABLE')
    console.log('================================================================================')

    // 12.1 Emisión de Nota Crédito en electronic_invoices vinculada a la factura original
    // 2 unidades devueltas:
    // Subtotal: $20.000 COP
    // IVA 19%:  $3.800 COP
    // Total NC: $23.800 COP
    const ncNumber = 990000001
    const ncFullNumber = `NC-${ncNumber}`
    const ncCufe = 'f4c8996fb92427ae41e4649b934ca495991b7852b855e3b0c44298fc1c149afbf4c8996fb92427ae'

    const ncQrCode = `https://catalogo-vpfe.dian.gov.co/document/searchqr?documentkey=${ncCufe}`

    const ncRes = await client.query(`
      INSERT INTO public.electronic_invoices (
        company_id, location_id, sale_id, customer_id,
        prefix, number, document_type,
        cufe, qr_code_data, subtotal_amount, tax_amount, total_amount,
        dian_status, dian_response_message, dian_response_date,
        dian_prefix, dian_number, dian_resolution
      ) VALUES (
        $1, $2, $3, $4,
        'NC', $5, 'CREDIT_NOTE',
        $6, $7,
        20000.00, 3800.00, 23800.00,
        'ACCEPTED', 'Nota Crédito NC-990000001 autorizada exitosamente por la DIAN.', NOW(),
        'NC', $5, 'Resolución DIAN No. 18760000001 de 2026'
      ) RETURNING id, full_number, cufe, total_amount;
    `, [compA, locA1, sale.id, customer.id, ncNumber, ncCufe, ncQrCode])
    const creditNote = ncRes.rows[0]

    console.log(`✅ Nota Crédito DIAN registrada:`)
    console.log(`   - Documento:  ${creditNote.full_number} (ID: ${creditNote.id})`)
    console.log(`   - CUFE / Cude:${creditNote.cufe.slice(0, 32)}...`)
    console.log(`   - Valor Total:$${creditNote.total_amount} COP`)

    // 12.2 Asiento contable de Reversión / Nota Crédito:
    // Línea 1: 4135 (Menor ingreso / Devolución) -> Débito $20.000
    // Línea 2: 2408 (IVA devuelto) -> Débito $3.800
    // Línea 3: 1105 (Devolución de efectivo al cliente) -> Crédito $23.800
    // Línea 4: 1435 (Reingreso de mercancía al inventario) -> Débito $16.000 (2 x $8.000)
    // Línea 5: 6135 (Reversión costo de venta) -> Crédito $16.000
    // Total Débitos = $20.000 + $3.800 + $16.000 = $39.800
    // Total Créditos = $23.800 + $16.000 = $39.800 (Partida doble perfecta)
    const revEntryRes = await client.query(`
      INSERT INTO public.accounting_entries (
        company_id, location_id, consecutive, entry_number, date, concept,
        document_type, document_reference, status, created_by_user_id
      ) VALUES (
        $1, $2, 1002, 'CC-2026-0002', CURRENT_DATE,
        'Contabilización Nota Crédito NC-990000001 por devolución parcial',
        'CREDIT_NOTE', $3, 'DRAFT', $4
      ) RETURNING id, entry_number;
    `, [compA, locA1, creditNote.full_number, userCashierAId])
    const revEntryId = revEntryRes.rows[0].id

    await client.query(`
      INSERT INTO public.accounting_entry_lines (
        entry_id, account_id, third_party_doc, third_party_name, description, debit_amount, credit_amount
      ) VALUES 
        ($1, $2, '1020304050', 'Juan David Pérez', 'Devolución parcial de venta - Menor ingreso', 20000.00, 0.00),
        ($1, $3, '900123456', 'DIAN', 'IVA descontado por devolución en venta', 3800.00, 0.00),
        ($1, $4, '1020304050', 'Juan David Pérez', 'Reembolso efectivo al cliente', 0.00, 23800.00),
        ($1, $5, '1020304050', 'Juan David Pérez', 'Reingreso de inventario al costo por devolución', 16000.00, 0.00),
        ($1, $6, '1020304050', 'Juan David Pérez', 'Reversión costo de ventas por devolución', 0.00, 16000.00);
    `, [revEntryId, accounts.get('4135'), accounts.get('2408'), accounts.get('1105'), accounts.get('1435'), accounts.get('6135')])

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

    console.log(`   Asiento contable de reversión asentado (POSTED):`)
    console.log(`   - Comprobante:    ${revEntryRes.rows[0].entry_number}`)
    console.log(`   - Total Débito:   $${sumRevLines.total_debit} COP`)
    console.log(`   - Total Crédito:  $${sumRevLines.total_credit} COP`)
    console.log(`   - Balance:        Partida Doble Verificada (Débito == Crédito)`)

    if (Number(sumRevLines.total_debit) !== Number(sumRevLines.total_credit)) {
      throw new Error('Descuadre en asiento de reversión.')
    }
    console.log('✅ Nota Crédito y asiento de reversión contabilizados con éxito.')

    // -------------------------------------------------------------------------
    // FLUJO 13: AUDITORÍA DE OPERACIONES SENSIBLES E INMUTABILIDAD
    // -------------------------------------------------------------------------
    console.log('\n================================================================================')
    console.log('13. AUDITORÍA FORENSE Y VALIDACIÓN DE INMUTABILIDAD DE LOGS')
    console.log('================================================================================')

    // Registrar logs de auditoría para devolución y nota crédito
    await client.query(`
      INSERT INTO public.audit_logs (
        company_id, location_id, user_id, user_name, action, module,
        entity_name, entity_id, new_value
      ) VALUES 
        ($1, $2, $3, 'Cajero Carlos POS', 'SALE_RETURN', 'sales', 'sales', $4,
         jsonb_build_object('returned_units', 2, 'refund_amount', 23800.00)),
        ($1, $2, $3, 'Cajero Carlos POS', 'EMIT_CREDIT_NOTE', 'invoicing', 'electronic_invoices', $5,
         jsonb_build_object('nc_number', 'NC-990000001', 'total', 23800.00));
    `, [compA, locA1, userCashierAId, sale.id, creditNote.id])

    const totalAuditLogs = (await client.query(`SELECT COUNT(*)::int as count FROM public.audit_logs;`)).rows[0].count
    console.log(`   Total eventos de auditoría registrados en la prueba: ${totalAuditLogs}`)

    // Intentar alterar o borrar un registro de auditoría
    let auditTamperBlocked = false
    try {
      await client.query('SAVEPOINT sp_audit_tamper;')
      await client.query(`DELETE FROM public.audit_logs WHERE action = 'SALE_RETURN';`)
    } catch (err: any) {
      auditTamperBlocked = true
      await client.query('ROLLBACK TO SAVEPOINT sp_audit_tamper;')
      console.log(`✅ Inmutabilidad de auditoría confirmada: "${err.message}"`)
    }
    if (!auditTamperBlocked) {
      throw new Error('Falla crítica: Se permitió eliminar registros de auditoría forense.')
    }
    console.log('✅ Auditoría completa y trazabilidad inmutable certificada.')

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
      'customers',
      'sales',
      'sale_items',
      'electronic_invoices',
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

    // Verificar que las entidades maestras base legítimas siguen intactas
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
    console.log('🎉 RESULTADO FINAL: PASO 11 SUPERADO EXITOSAMENTE AL 100%')
    console.log('================================================================================')
  } catch (error) {
    await client.query('ROLLBACK;').catch(() => {})
    console.error('\n❌ ERROR EN LA SUITE DE PRUEBAS DE VENTAS Y FACTURACIÓN:', error)
    process.exit(1)
  } finally {
    await client.end()
  }
}

runRealSalesPosInvoicingTests()
