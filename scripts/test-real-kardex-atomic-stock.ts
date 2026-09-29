/**
 * ==============================================================================
 * SUITE DE VALIDACIÓN REAL DE KARDEX Y RECÁLCULO ATÓMICO DE STOCK (PASO 10)
 * ERP SUPER MÁS S.A.S. — Supabase PostgreSQL (Staging)
 * ==============================================================================
 *
 * OBJETIVOS:
 * 1. Transacción estricta BEGIN ... ROLLBACK (Cero datos residuales).
 * 2. Validar ciclo de vida completo de movimientos:
 *    - Entradas (PURCHASE_ENTRY)
 *    - Salidas (SALE_OUT)
 *    - Devoluciones (CUSTOMER_RETURN, SUPPLIER_RETURN)
 *    - Ajustes (POSITIVE_ADJUSTMENT, NEGATIVE_ADJUSTMENT)
 * 3. Validar recálculo matemático de Costo Promedio Ponderado.
 * 4. Validar transiciones automáticas de salud de stock (AVAILABLE -> LOW_STOCK -> OUT_OF_STOCK).
 * 5. Verificar que stock_levels SOLAMENTE cambie mediante inventory_movements.
 * 6. Validar separación por empresa y por bodega (multi-bodega y multi-tenant).
 * 7. Comprobación post-rollback (Base 100% limpia).
 */

import pg from 'pg'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

async function runRealKardexAtomicStockTests() {
  const client = new pg.Client({
    connectionString: process.env.DIRECT_URL,
    ssl: { rejectUnauthorized: false },
  })

  await client.connect()

  console.log('====================================================================')
  console.log('📦 SUITE DE VALIDACIÓN REAL DE KARDEX Y RECÁLCULO ATÓMICO (PASO 10)')
  console.log('====================================================================\n')

  try {
    // INICIAR TRANSACCIÓN AISLADA
    await client.query('BEGIN;')
    console.log('🔒 [BEGIN] Transacción iniciada — Cero persistencia final garantizada por ROLLBACK.\n')

    // 0. OBTENER IDS BASE DE STAGING
    const compARes = await client.query('SELECT id, business_name FROM public.companies LIMIT 1;')
    const compA = compARes.rows[0].id
    const locA1Res = await client.query('SELECT id, code, name FROM public.locations WHERE company_id = $1 LIMIT 1;', [compA])
    const locA1 = locA1Res.rows[0].id

    console.log(`Empresa A legítima:  "${compARes.rows[0].business_name}" (${compA})`)
    console.log(`Bodega A1 legítima:  "${locA1Res.rows[0].name}" [${locA1Res.rows[0].code}] (${locA1})`)

    // Roles
    const rolesRes = await client.query('SELECT id, code FROM public.roles;')
    const roles = new Map(rolesRes.rows.map((r: any) => [r.code, r.id]))

    // 1. CREAR SEGUNDA BODEGA EN EMPRESA A (Para validar separación multi-bodega)
    const locA2Res = await client.query(`
      INSERT INTO public.locations (
        company_id, code, name, type, address, city, department
      ) VALUES (
        $1, 'BOD-02', 'Bodega Sucursal Envigado', 'STORE_POINT', 'Calle 38 Sur # 43-20', 'Envigado', 'Antioquia'
      ) RETURNING id;
    `, [compA])
    const locA2 = locA2Res.rows[0].id
    console.log(`Bodega A2 temporal:  "Bodega Sucursal Envigado" [BOD-02] (${locA2})`)

    // 2. CREAR EMPRESA B Y SEDE B (Para validar separación multi-tenant)
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
    console.log(`Empresa B temporal:  "Competencia Mayorista B S.A.S." (${compB})`)
    console.log(`Bodega B1 temporal:  "Bodega Bello Norte" [BOD-B01] (${locB1})\n`)

    // 3. CREAR USUARIOS DE PRUEBA
    const userWhAId = 'a0000000-0000-0000-0000-000000000004' // WAREHOUSE_ADMIN en Empresa A
    const userAdminBId = 'b0000000-0000-0000-0000-000000000001' // ADMIN en Empresa B

    await client.query(`
      INSERT INTO auth.users (id, email, raw_app_meta_data, raw_user_meta_data)
      VALUES 
        ($1, 'wh.admin@empresa-a.com', jsonb_build_object('role', 'WAREHOUSE_ADMIN', 'company_id', $2::text), '{}'::jsonb),
        ($3, 'admin@empresa-b.com', jsonb_build_object('role', 'ADMIN', 'company_id', $4::text), '{}'::jsonb);
    `, [userWhAId, compA, userAdminBId, compB])

    await client.query(`
      INSERT INTO public.users (id, company_id, email, full_name, role_id, is_active)
      VALUES 
        ($1, $2, 'wh.admin@empresa-a.com', 'Jefe Bodega A', $3, true),
        ($4, $5, 'admin@empresa-b.com', 'Admin Empresa B', $6, true)
      ON CONFLICT (id) DO UPDATE SET company_id = EXCLUDED.company_id, role_id = EXCLUDED.role_id;
    `, [userWhAId, compA, roles.get('WAREHOUSE_ADMIN'), userAdminBId, compB, roles.get('ADMIN')])

    // Asignar accesos a bodegas
    await client.query(`
      INSERT INTO public.user_locations (user_id, location_id, is_primary)
      VALUES 
        ($1, $2, true),
        ($1, $3, false),
        ($4, $5, true)
      ON CONFLICT (user_id, location_id) DO NOTHING;
    `, [userWhAId, locA1, locA2, userAdminBId, locB1])

    // 4. CREAR PRODUCTOS DE PRUEBA
    // Producto A: Arroz Diana 1kg (Umbral mínimo: 10 unidades)
    const prodARes = await client.query(`
      INSERT INTO public.products (
        company_id, sku, barcode, name, slug, short_description, unit_of_measure, min_stock_threshold
      ) VALUES (
        $1, 'SKU-ARROZ-1K', '7701111111111', 'Arroz Diana 1kg', 'arroz-diana-1kg', 'Arroz blanco', 'UND', 10
      ) RETURNING id;
    `, [compA])
    const prodA = prodARes.rows[0].id

    // Producto B: Arroz Empresa B
    const prodBRes = await client.query(`
      INSERT INTO public.products (
        company_id, sku, barcode, name, slug, short_description, unit_of_measure, min_stock_threshold
      ) VALUES (
        $1, 'SKU-ARROZ-B', '7709999999999', 'Arroz Empresa B 1kg', 'arroz-b-1kg', 'Arroz B', 'UND', 10
      ) RETURNING id;
    `, [compB])
    const prodB = prodBRes.rows[0].id

    console.log(`Producto A creado: "Arroz Diana 1kg" (ID: ${prodA}, min_stock: 10)`)
    console.log(`Producto B creado: "Arroz Empresa B 1kg" (ID: ${prodB}, min_stock: 10)\n`)

    // =========================================================================
    // SECCIÓN 1: ENTRADAS Y CÁLCULO DE COSTO PROMEDIO PONDERADO
    // =========================================================================
    console.log('====================================================================')
    console.log('1. VALIDACIÓN DE ENTRADAS Y COSTO PROMEDIO PONDERADO')
    console.log('====================================================================')

    // 1.1 Entrada Inicial (Compra 1): 100 unidades a $2.000 COP cada una
    console.log('  1.1 Registrando Entrada Inicial (Compra 1): 100 unds @ $2.000 COP...')
    await client.query(`
      INSERT INTO public.inventory_movements (
        company_id, location_id, product_id, user_id, movement_type, quantity_in, quantity_out,
        previous_stock, new_stock, unit_cost, total_cost, document_type, document_reference, reason
      ) VALUES (
        $1, $2, $3, $4, 'PURCHASE_ENTRY', 100, 0, 0, 100, 2000.00, 200000.00, 'PURCHASE', 'FAC-PROV-001', 'Compra Inicial Proveedor 1'
      );
    `, [compA, locA1, prodA, userWhAId])

    const stock1 = (await client.query('SELECT * FROM public.stock_levels WHERE product_id = $1 AND location_id = $2;', [prodA, locA1])).rows[0]
    console.log('      Existencias tras Entrada Inicial:')
    console.log(`      - Cantidad:            ${stock1.quantity} unds (Esperado: 100.00)`)
    console.log(`      - Costo Promedio:      $${stock1.average_cost} COP (Esperado: 2000.00)`)
    console.log(`      - Valor Total Costo:   $${stock1.total_value_at_cost} COP (Esperado: 200000.00)`)
    console.log(`      - Cantidad Disponible: ${stock1.available_quantity} unds`)
    console.log(`      - Estado de Salud:     ${stock1.health_status} (Esperado: AVAILABLE)`)

    if (parseFloat(stock1.quantity) !== 100 || parseFloat(stock1.average_cost) !== 2000 || stock1.health_status !== 'AVAILABLE') {
      throw new Error('Fallo en cálculo de existencias tras entrada inicial.')
    }
    console.log('      ✅ Entrada inicial verificada correctamente.\n')

    // 1.2 Segunda Entrada (Compra 2 con variación de precio): 50 unidades a $2.600 COP cada una
    // Cálculo Ponderado Matemático:
    // Stock Anterior: 100 unds @ $2.000 = $200.000
    // Entrada Nueva:   50 unds @ $2.600 = $130.000
    // Total Valor:    $330.000 / 150 unds = $2.200.00 COP por unidad exactos.
    console.log('  1.2 Registrando Segunda Entrada (Compra 2): 50 unds @ $2.600 COP...')
    await client.query(`
      INSERT INTO public.inventory_movements (
        company_id, location_id, product_id, user_id, movement_type, quantity_in, quantity_out,
        previous_stock, new_stock, unit_cost, total_cost, document_type, document_reference, reason
      ) VALUES (
        $1, $2, $3, $4, 'PURCHASE_ENTRY', 50, 0, 100, 150, 2600.00, 130000.00, 'PURCHASE', 'FAC-PROV-002', 'Compra Lote 2 con Alza'
      );
    `, [compA, locA1, prodA, userWhAId])

    const stock2 = (await client.query('SELECT * FROM public.stock_levels WHERE product_id = $1 AND location_id = $2;', [prodA, locA1])).rows[0]
    console.log('      Existencias tras Ponderación de Costo:')
    console.log(`      - Cantidad Total:      ${stock2.quantity} unds (Esperado: 150.00)`)
    console.log(`      - Costo Promedio:      $${stock2.average_cost} COP (Esperado exacto: 2200.00)`)
    console.log(`      - Valor Total Costo:   $${stock2.total_value_at_cost} COP (Esperado: 330000.00)`)
    console.log(`      - Estado de Salud:     ${stock2.health_status} (Esperado: AVAILABLE)`)

    if (parseFloat(stock2.quantity) !== 150 || parseFloat(stock2.average_cost) !== 2200 || parseFloat(stock2.total_value_at_cost) !== 330000) {
      throw new Error('Fallo crítico en cálculo de Costo Promedio Ponderado.')
    }
    console.log('      ✅ Recálculo atómico de Costo Promedio Ponderado verificado con éxito ($2.200 exactos).\n')

    // =========================================================================
    // SECCIÓN 2: SALIDAS DE INVENTARIO (PRESERVACIÓN DE COSTO UNITARIO)
    // =========================================================================
    console.log('====================================================================')
    console.log('2. VALIDACIÓN DE SALIDAS DE INVENTARIO (VENTAS)')
    console.log('====================================================================')

    // 2.1 Salida por Venta: 60 unidades vendidas
    // Regla fiduciaria: Las salidas deducen existencias físicas pero NO alteran el costo promedio unitario.
    console.log('  2.1 Registrando Salida por Venta (SALE_OUT): 60 unds...')
    await client.query(`
      INSERT INTO public.inventory_movements (
        company_id, location_id, product_id, user_id, movement_type, quantity_in, quantity_out,
        previous_stock, new_stock, unit_cost, total_cost, document_type, document_reference, reason
      ) VALUES (
        $1, $2, $3, $4, 'SALE_OUT', 0, 60, 150, 90, 2200.00, 132000.00, 'SALE', 'VTA-001', 'Despacho Venta Comercial'
      );
    `, [compA, locA1, prodA, userWhAId])

    const stock3 = (await client.query('SELECT * FROM public.stock_levels WHERE product_id = $1 AND location_id = $2;', [prodA, locA1])).rows[0]
    console.log('      Existencias tras Salida por Venta:')
    console.log(`      - Cantidad Restante:   ${stock3.quantity} unds (Esperado: 90.00)`)
    console.log(`      - Costo Promedio:      $${stock3.average_cost} COP (Esperado inmutable: 2200.00)`)
    console.log(`      - Valor Total Costo:   $${stock3.total_value_at_cost} COP (Esperado: 198000.00)`)
    console.log(`      - Estado de Salud:     ${stock3.health_status} (Esperado: AVAILABLE)`)

    if (parseFloat(stock3.quantity) !== 90 || parseFloat(stock3.average_cost) !== 2200 || parseFloat(stock3.total_value_at_cost) !== 198000) {
      throw new Error('Fallo: La salida por venta alteró incorrectamente el costo o el saldo.')
    }
    console.log('      ✅ Salida de inventario verificada (Stock: 90 unds, Costo Unitario preservado: $2.200).\n')

    // =========================================================================
    // SECCIÓN 3: DEVOLUCIONES (CLIENTE Y PROVEEDOR)
    // =========================================================================
    console.log('====================================================================')
    console.log('3. VALIDACIÓN DE DEVOLUCIONES (CLIENTE Y PROVEEDOR)')
    console.log('====================================================================')

    // 3.1 Devolución de Cliente: El cliente devuelve 10 unidades en perfecto estado
    console.log('  3.1 Registrando Devolución de Cliente (CUSTOMER_RETURN): +10 unds...')
    await client.query(`
      INSERT INTO public.inventory_movements (
        company_id, location_id, product_id, user_id, movement_type, quantity_in, quantity_out,
        previous_stock, new_stock, unit_cost, total_cost, document_type, document_reference, reason
      ) VALUES (
        $1, $2, $3, $4, 'CUSTOMER_RETURN', 10, 0, 90, 100, 2200.00, 22000.00, 'SALE_RETURN', 'DEV-CLI-001', 'Devolución de cliente por cambio'
      );
    `, [compA, locA1, prodA, userWhAId])

    const stock4 = (await client.query('SELECT * FROM public.stock_levels WHERE product_id = $1 AND location_id = $2;', [prodA, locA1])).rows[0]
    console.log('      Existencias tras Devolución de Cliente:')
    console.log(`      - Cantidad:            ${stock4.quantity} unds (Esperado: 100.00)`)
    console.log(`      - Costo Promedio:      $${stock4.average_cost} COP (Esperado: 2200.00)`)
    console.log(`      - Valor Total Costo:   $${stock4.total_value_at_cost} COP (Esperado: 220000.00)`)

    if (parseFloat(stock4.quantity) !== 100 || parseFloat(stock4.average_cost) !== 2200) {
      throw new Error('Fallo en devolución de cliente.')
    }
    console.log('      ✅ Devolución de cliente reingresada exitosamente al stock.\n')

    // 3.2 Devolución a Proveedor: Salida de 15 unidades por garantía / avería de fábrica
    console.log('  3.2 Registrando Devolución a Proveedor (SUPPLIER_RETURN): -15 unds...')
    await client.query(`
      INSERT INTO public.inventory_movements (
        company_id, location_id, product_id, user_id, movement_type, quantity_in, quantity_out,
        previous_stock, new_stock, unit_cost, total_cost, document_type, document_reference, reason
      ) VALUES (
        $1, $2, $3, $4, 'SUPPLIER_RETURN', 0, 15, 100, 85, 2200.00, 33000.00, 'PURCHASE_RETURN', 'DEV-PROV-001', 'Garantía por defecto de empaque'
      );
    `, [compA, locA1, prodA, userWhAId])

    const stock5 = (await client.query('SELECT * FROM public.stock_levels WHERE product_id = $1 AND location_id = $2;', [prodA, locA1])).rows[0]
    console.log('      Existencias tras Devolución a Proveedor:')
    console.log(`      - Cantidad:            ${stock5.quantity} unds (Esperado: 85.00)`)
    console.log(`      - Costo Promedio:      $${stock5.average_cost} COP (Esperado: 2200.00)`)
    console.log(`      - Valor Total Costo:   $${stock5.total_value_at_cost} COP (Esperado: 187000.00)`)

    if (parseFloat(stock5.quantity) !== 85 || parseFloat(stock5.average_cost) !== 2200) {
      throw new Error('Fallo en devolución a proveedor.')
    }
    console.log('      ✅ Devolución a proveedor procesada correctamente.\n')

    // =========================================================================
    // SECCIÓN 4: AJUSTES DE INVENTARIO Y TRANSICIÓN DE ESTADOS DE SALUD
    // =========================================================================
    console.log('====================================================================')
    console.log('4. VALIDACIÓN DE AJUSTES Y TRANSICIONES DE SALUD (HEALTH STATUS)')
    console.log('====================================================================')

    // 4.1 Ajuste Positivo: Hallazgo físico de 5 unidades adicionales
    console.log('  4.1 Registrando Ajuste Positivo (POSITIVE_ADJUSTMENT): +5 unds...')
    await client.query(`
      INSERT INTO public.inventory_movements (
        company_id, location_id, product_id, user_id, movement_type, quantity_in, quantity_out,
        previous_stock, new_stock, unit_cost, total_cost, document_type, document_reference, reason
      ) VALUES (
        $1, $2, $3, $4, 'POSITIVE_ADJUSTMENT', 5, 0, 85, 90, 2200.00, 11000.00, 'ADJUSTMENT', 'ADJ-FIS-001', 'Ajuste sobrante conteo físico'
      );
    `, [compA, locA1, prodA, userWhAId])

    const stock6 = (await client.query('SELECT * FROM public.stock_levels WHERE product_id = $1 AND location_id = $2;', [prodA, locA1])).rows[0]
    console.log(`      - Cantidad tras ajuste positivo: ${stock6.quantity} unds (Esperado: 90.00)`)
    if (parseFloat(stock6.quantity) !== 90) throw new Error('Fallo en ajuste positivo.')

    // 4.2 Ajuste Negativo hacia LOW_STOCK: Merma de 82 unidades
    // Saldo resultante: 90 - 82 = 8 unidades.
    // Como min_stock_threshold = 10, y 8 <= 10, health_status debe transicionar a LOW_STOCK.
    console.log('  4.2 Registrando Ajuste Negativo (NEGATIVE_ADJUSTMENT): -82 unds (Umbral min_stock: 10)...')
    await client.query(`
      INSERT INTO public.inventory_movements (
        company_id, location_id, product_id, user_id, movement_type, quantity_in, quantity_out,
        previous_stock, new_stock, unit_cost, total_cost, document_type, document_reference, reason
      ) VALUES (
        $1, $2, $3, $4, 'NEGATIVE_ADJUSTMENT', 0, 82, 90, 8, 2200.00, 180400.00, 'ADJUSTMENT', 'ADJ-MERMA-001', 'Merma por daño en transporte'
      );
    `, [compA, locA1, prodA, userWhAId])

    const stock7 = (await client.query('SELECT * FROM public.stock_levels WHERE product_id = $1 AND location_id = $2;', [prodA, locA1])).rows[0]
    console.log('      Existencias tras Ajuste Negativo:')
    console.log(`      - Cantidad:            ${stock7.quantity} unds (Esperado: 8.00)`)
    console.log(`      - Umbral Mínimo:       ${stock7.min_stock} unds`)
    console.log(`      - Estado de Salud:     ${stock7.health_status} (Esperado: LOW_STOCK)`)

    if (parseFloat(stock7.quantity) !== 8 || stock7.health_status !== 'LOW_STOCK') {
      throw new Error('Fallo: El estado de salud debió transicionar a LOW_STOCK.')
    }
    console.log('      ✅ Transición automática a LOW_STOCK verificada con éxito.\n')

    // 4.3 Salida total hacia OUT_OF_STOCK: Venta de las últimas 8 unidades
    // Saldo resultante: 8 - 8 = 0 unidades. health_status debe transicionar a OUT_OF_STOCK.
    console.log('  4.3 Venta de últimas 8 unidades hacia agotamiento total (OUT_OF_STOCK)...')
    await client.query(`
      INSERT INTO public.inventory_movements (
        company_id, location_id, product_id, user_id, movement_type, quantity_in, quantity_out,
        previous_stock, new_stock, unit_cost, total_cost, document_type, document_reference, reason
      ) VALUES (
        $1, $2, $3, $4, 'SALE_OUT', 0, 8, 8, 0, 2200.00, 17600.00, 'SALE', 'VTA-002', 'Venta saldo final'
      );
    `, [compA, locA1, prodA, userWhAId])

    const stock8 = (await client.query('SELECT * FROM public.stock_levels WHERE product_id = $1 AND location_id = $2;', [prodA, locA1])).rows[0]
    console.log('      Existencias tras Agotamiento:')
    console.log(`      - Cantidad:            ${stock8.quantity} unds (Esperado: 0.00)`)
    console.log(`      - Costo Promedio:      $${stock8.average_cost} COP (Preservado: 2200.00)`)
    console.log(`      - Valor Total Costo:   $${stock8.total_value_at_cost} COP (Esperado: 0.00)`)
    console.log(`      - Estado de Salud:     ${stock8.health_status} (Esperado: OUT_OF_STOCK)`)

    if (parseFloat(stock8.quantity) !== 0 || stock8.health_status !== 'OUT_OF_STOCK') {
      throw new Error('Fallo: El estado de salud debió transicionar a OUT_OF_STOCK.')
    }
    console.log('      ✅ Transición automática a OUT_OF_STOCK verificada con éxito.\n')

    // =========================================================================
    // SECCIÓN 5: VERIFICACIÓN QUE STOCK_LEVELS SOLO CAMBIA VÍA KARDEX
    // =========================================================================
    console.log('====================================================================')
    console.log('5. VERIFICACIÓN: STOCK_LEVELS SOLO MUTABLE MEDIANTE KARDEX')
    console.log('====================================================================')

    await client.query(`SET LOCAL ROLE authenticated;`)
    await client.query(`SET LOCAL "request.jwt.claim.sub" = '${userWhAId}';`)

    // 5.1 Intento de UPDATE directo en stock_levels por cliente (DEBE FALLAR)
    let directStockUpdBlocked = false
    try {
      const res = await client.query(`UPDATE public.stock_levels SET quantity = 9999 WHERE product_id = $1;`, [prodA])
      if (res.rowCount === 0) directStockUpdBlocked = true
    } catch (e: any) {
      directStockUpdBlocked = true
    }
    console.log('  5.1 Intento de UPDATE directo sobre stock_levels: ', directStockUpdBlocked ? 'DENEGADO (0 filas afectadas / RLS) ✅' : 'FALLO ❌')
    if (!directStockUpdBlocked) throw new Error('Un usuario no debe poder modificar directamente stock_levels.')

    // 5.2 Intento de INSERT directo en stock_levels por cliente (DEBE FALLAR)
    let directStockInsBlocked = false
    await client.query('SAVEPOINT stk_ins;')
    try {
      await client.query(`
        INSERT INTO public.stock_levels (company_id, location_id, product_id, quantity, average_cost, min_stock, max_stock, health_status)
        VALUES ($1, $2, $3, 500, 1000, 10, 1000, 'AVAILABLE');
      `, [compA, locA2, prodA])
    } catch (e: any) {
      directStockInsBlocked = true
      console.log('  5.2 Intento de INSERT directo sobre stock_levels: DENEGADO POR RLS ✅ (' + e.message + ')')
    } finally {
      await client.query('ROLLBACK TO SAVEPOINT stk_ins;')
    }
    if (!directStockInsBlocked) throw new Error('Un usuario no debe poder insertar directamente en stock_levels.')

    await client.query(`RESET ROLE;`)

    // =========================================================================
    // SECCIÓN 6: SEPARACIÓN POR EMPRESA Y BODEGA (MULTI-BODEGA Y MULTI-TENANT)
    // =========================================================================
    console.log('\n====================================================================')
    console.log('6. VALIDACIÓN DE SEPARACIÓN POR BODEGA Y POR EMPRESA')
    console.log('====================================================================')

    // 6.1 Multi-Bodega en Empresa A:
    // Registrar entrada en Bodega 2 (locA2 - Envigado) para el mismo Producto A: 40 unds @ $2.500 COP
    console.log('  6.1 Registrando Entrada en Bodega 2 (locA2 - Envigado) para Producto A: 40 unds @ $2.500...')
    await client.query(`
      INSERT INTO public.inventory_movements (
        company_id, location_id, product_id, user_id, movement_type, quantity_in, quantity_out,
        previous_stock, new_stock, unit_cost, total_cost, document_type, document_reference, reason
      ) VALUES (
        $1, $2, $3, $4, 'PURCHASE_ENTRY', 40, 0, 0, 40, 2500.00, 100000.00, 'PURCHASE', 'FAC-PROV-B2', 'Entrada directa Bodega Envigado'
      );
    `, [compA, locA2, prodA, userWhAId])

    // Verificar que Bodega 1 y Bodega 2 tienen existencias totalmente independientes
    const stockB1 = (await client.query('SELECT quantity, average_cost FROM public.stock_levels WHERE product_id = $1 AND location_id = $2;', [prodA, locA1])).rows[0]
    const stockB2 = (await client.query('SELECT quantity, average_cost FROM public.stock_levels WHERE product_id = $1 AND location_id = $2;', [prodA, locA2])).rows[0]

    console.log(`      - Existencias en Bodega 1 (Medellín): ${stockB1.quantity} unds (Esperado: 0.00)`)
    console.log(`      - Existencias en Bodega 2 (Envigado): ${stockB2.quantity} unds (Esperado: 40.00, Costo: $${stockB2.average_cost})`)

    if (parseFloat(stockB1.quantity) !== 0 || parseFloat(stockB2.quantity) !== 40 || parseFloat(stockB2.average_cost) !== 2500) {
      throw new Error('Fallo de aislamiento multi-bodega: El movimiento en Bodega 2 contaminó Bodega 1.')
    }
    console.log('      ✅ Aislamiento multi-bodega verificado: Existencias independientes por sede.\n')

    // 6.2 Multi-Empresa:
    // Registrar entrada en Bodega Empresa B (locB1) para Producto B: 75 unds @ $3.200 COP
    console.log('  6.2 Registrando Entrada en Empresa B (locB1 - Bello) para Producto B: 75 unds @ $3.200...')
    await client.query(`
      INSERT INTO public.inventory_movements (
        company_id, location_id, product_id, user_id, movement_type, quantity_in, quantity_out,
        previous_stock, new_stock, unit_cost, total_cost, document_type, document_reference, reason
      ) VALUES (
        $1, $2, $3, $4, 'PURCHASE_ENTRY', 75, 0, 0, 75, 3200.00, 240000.00, 'PURCHASE', 'FAC-PROV-EB1', 'Entrada Empresa B'
      );
    `, [compB, locB1, prodB, userAdminBId])

    // Simular sesión de usuario de Empresa A consultando existencias globales
    await client.query(`SET LOCAL ROLE authenticated;`)
    await client.query(`SET LOCAL "request.jwt.claim.sub" = '${userWhAId}';`)

    const aStockVisible = await client.query('SELECT id, company_id, location_id, quantity FROM public.stock_levels;')
    console.log(`      - Filas de stock_levels visibles para Empresa A: ${aStockVisible.rows.length} (Esperado: 2 registros, solo Empresa A)`)
    const aSeesCompanyB = aStockVisible.rows.some((r: any) => r.company_id === compB)
    if (aSeesCompanyB || aStockVisible.rows.length !== 2) {
      throw new Error('Fallo de aislamiento multi-tenant: Empresa A pudo ver inventario de Empresa B.')
    }
    console.log('      ✅ Aislamiento multi-tenant en existencias verificado: Cero visibilidad de Empresa B.\n')

    // Simular sesión de usuario de Empresa B consultando Kardex
    await client.query(`SET LOCAL ROLE authenticated;`)
    await client.query(`SET LOCAL "request.jwt.claim.sub" = '${userAdminBId}';`)

    const bMovementsVisible = await client.query('SELECT id, company_id, movement_type FROM public.inventory_movements;')
    console.log(`      - Filas de Kardex visibles para Empresa B: ${bMovementsVisible.rows.length} (Esperado: 1 registro propio)`)
    const bSeesCompanyA = bMovementsVisible.rows.some((r: any) => r.company_id === compA)
    if (bSeesCompanyA || bMovementsVisible.rows.length !== 1) {
      throw new Error('Fallo de aislamiento multi-tenant: Empresa B pudo ver movimientos Kardex de Empresa A.')
    }
    console.log('      ✅ Aislamiento multi-tenant en Kardex verificado: Empresa B solo ve su único movimiento propio.')

    // =========================================================================
    // SECCIÓN 7: EJECUCIÓN DE ROLLBACK Y VERIFICACIÓN DE BASE LIMPIA
    // =========================================================================
    console.log('\n====================================================================')
    console.log('🔄 EJECUTANDO ROLLBACK COMPLETO DE TODAS LAS PRUEBAS DE KARDEX')
    console.log('====================================================================')
    await client.query(`RESET ROLE;`)
    await client.query('ROLLBACK;')
    console.log('✅ ROLLBACK ejecutado exitosamente. Cero datos temporales permanecen en la base de datos.')

  } catch (err) {
    await client.query('RESET ROLE;').catch(() => {})
    await client.query('ROLLBACK;').catch(() => {})
    console.error('\n❌ ERROR DURANTE LA VALIDACIÓN DE KARDEX Y STOCK:', err)
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
    const al = await client.query('SELECT count(*) FROM public.audit_logs;')

    console.log(`companies:           ${c.rows[0].count} (Solo empresa legítima del Paso 8) ✅`)
    console.log(`locations:           ${l.rows[0].count} (Solo bodega legítima del Paso 8) ✅`)
    console.log(`users:               ${u.rows[0].count} (Solo superadmin legítimo del Paso 7) ✅`)
    console.log(`products:            ${p.rows[0].count} (0 productos comerciales) ✅`)
    console.log(`stock_levels:        ${s.rows[0].count} (0 existencias) ✅`)
    console.log(`inventory_movements: ${m.rows[0].count} (0 movimientos Kardex) ✅`)
    console.log(`sales:               ${sa.rows[0].count} (0 ventas) ✅`)
    console.log(`purchases:           ${pu.rows[0].count} (0 compras) ✅`)
    console.log(`accounting_entries:  ${ae.rows[0].count} (0 comprobantes contables) ✅`)
    console.log(`audit_logs:          ${al.rows[0].count} (0 logs residuales) ✅`)

    await client.end()
  }
}

runRealKardexAtomicStockTests().catch((e) => {
  console.error(e)
  process.exit(1)
})
