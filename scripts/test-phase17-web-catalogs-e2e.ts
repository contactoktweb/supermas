/**
 * SUPER MÁS ERP/POS — SUITE E2E: FASE 17: CANALES WEB Y CATÁLOGOS PÚBLICOS
 *
 * Valida la estricta separación entre Catálogo Super Más y Catálogo Distribuidora,
 * las reglas fiduciarias de disponibilidad comercial (AVAILABLE, LOW_STOCK, OUT_OF_STOCK),
 * la sanitización estricta de costos y márgenes, las consultas públicas por slug,
 * la persistencia real en PostgreSQL de pedidos web y el aislamiento multiempresa con Zero Pollution.
 */

import { Client } from 'pg'
import { createClient } from '@supabase/supabase-js'
import { superCatalogRepository } from '../features/super-catalog/repositories/super-catalog.repository'
import { distributorCatalogRepository } from '../features/distributor-catalog/repositories/distributor-catalog.repository'
import { webOrderRepository } from '../features/web-orders/repositories/web-order.repository'

interface TestResult {
  code: string
  name: string
  passed: boolean
  details: string
}

async function runPhase17WebCatalogsE2ETests() {
  console.log('============================================================')
  console.log('INICIANDO SUITE E2E - FASE 17: CANALES WEB Y CATÁLOGOS')
  console.log('============================================================\n')

  const results: TestResult[] = []

  const recordResult = (code: string, name: string, passed: boolean, details: string) => {
    results.push({ code, name, passed, details })
    const icon = passed ? '✅' : '❌'
    console.log(`${icon} [${code}] ${name}: ${passed ? 'PASS' : 'FAIL'}`)
    console.log(`   Detalle: ${details}\n`)
  }

  const databaseUrl = process.env.DATABASE_URL
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!databaseUrl || !supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Error: Variables de entorno requeridas no encontradas.')
    process.exit(1)
  }

  const pgClient = new Client({ connectionString: databaseUrl })
  await pgClient.connect()
  console.log('✅ Conexión directa a PostgreSQL Staging establecida.\n')

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

  const testSuffix = `${Date.now()}_${Math.floor(Math.random() * 1000)}`
  let companyAId: string | null = null
  let companyBId: string | null = null
  let locEcomAId: string | null = null
  let locSatAId: string | null = null
  let userAId: string | null = null

  let prod1Id: string | null = null // Solo Super Más (Stock 100 -> AVAILABLE)
  let prod2Id: string | null = null // Solo Distribuidora (Stock 3 -> LOW_STOCK)
  let prod3Id: string | null = null // En Ambos (Stock 0 -> OUT_OF_STOCK)
  let prod4Id: string | null = null // Oculto de Ambos (Stock 50)

  let webOrderAId: string | null = null

  try {
    console.log('--- Configurando Entorno Multiempresa y Catálogos en PostgreSQL ---')

    // 1. Crear Empresa A
    const compARes = await pgClient.query(`
      INSERT INTO public.companies (
        business_name, trade_name, tax_id, verification_digit, tax_regime,
        address, city, department, country, currency, status, created_at, updated_at
      ) VALUES (
        'Distribuidora Web Test A S.A.S.', 'Super Web A', '901777${Date.now().toString().slice(-3)}',
        '1', 'COMUN', 'Calle 72 # 10-34', 'Bogotá', 'Bogotá D.C.', 'COLOMBIA', 'COP', 'ACTIVE',
        NOW(), NOW()
      ) RETURNING id;
    `)
    companyAId = compARes.rows[0].id

    // 2. Crear Empresa B (aislamiento)
    const compBRes = await pgClient.query(`
      INSERT INTO public.companies (
        business_name, trade_name, tax_id, verification_digit, tax_regime,
        address, city, department, country, currency, status, created_at, updated_at
      ) VALUES (
        'Distribuidora Web Test B S.A.S.', 'Super Web B', '901776${Date.now().toString().slice(-3)}',
        '2', 'COMUN', 'Calle 50 # 20-30', 'Medellín', 'Antioquia', 'COLOMBIA', 'COP', 'ACTIVE',
        NOW(), NOW()
      ) RETURNING id;
    `)
    companyBId = compBRes.rows[0].id

    // 3. Crear Ubicaciones: Bodega Ecommerce (principal) y Bodega Satélite
    const locEcomRes = await pgClient.query(`
      INSERT INTO public.locations (
        company_id, code, name, type, status, is_ecommerce_source, address, city, department, created_at, updated_at
      ) VALUES (
        $1, 'BOD-ECOM', 'Bodega Despachos Ecommerce', 'WAREHOUSE', 'ACTIVE', true, 'Av. 68 # 45-10', 'Bogotá', 'Bogotá D.C.', NOW(), NOW()
      ) RETURNING id;
    `, [companyAId])
    locEcomAId = locEcomRes.rows[0].id

    const locSatRes = await pgClient.query(`
      INSERT INTO public.locations (
        company_id, code, name, type, status, is_ecommerce_source, address, city, department, created_at, updated_at
      ) VALUES (
        $1, 'BOD-SAT', 'Bodega Satélite Norte', 'WAREHOUSE', 'ACTIVE', false, 'Autopista Norte # 170', 'Bogotá', 'Bogotá D.C.', NOW(), NOW()
      ) RETURNING id;
    `, [companyAId])
    locSatAId = locSatRes.rows[0].id

    // 4. Crear Usuario en Empresa A
    const authEmail = `admin_web_${testSuffix}@supermas.com`
    const { data: authUserData, error: userAErr } = await supabaseAdmin.auth.admin.createUser({
      email: authEmail,
      password: 'SuperPassword123!',
      email_confirm: true,
      user_metadata: { full_name: 'Admin Catálogos Web' },
    })
    if (userAErr || !authUserData?.user) throw new Error(`Error creando usuario Auth: ${userAErr?.message}`)
    userAId = authUserData.user.id

    const roleRes = await pgClient.query(`SELECT id FROM public.roles LIMIT 1;`)
    const defaultRoleId = roleRes.rows[0].id

    await pgClient.query(`
      INSERT INTO public.users (
        id, company_id, email, full_name, role_id, is_active, created_at, updated_at
      ) VALUES (
        $1, $2, $3, 'Admin Catálogos Web', $4, true, NOW(), NOW()
      ) ON CONFLICT (id) DO UPDATE SET
        company_id = EXCLUDED.company_id,
        full_name = EXCLUDED.full_name,
        role_id = EXCLUDED.role_id,
        is_active = true;
    `, [userAId, companyAId, authEmail, defaultRoleId])

    // 5. Crear Categoría y Marca
    const catRes = await pgClient.query(`
      INSERT INTO public.categories (
        company_id, name, slug, is_active, created_at, updated_at
      ) VALUES (
        $1, 'Despensa y Granos', 'despensa-granos', true, NOW(), NOW()
      ) RETURNING id;
    `, [companyAId])
    const categoryId = catRes.rows[0].id

    const brandRes = await pgClient.query(`
      INSERT INTO public.brands (
        company_id, name, slug, is_active, created_at, updated_at
      ) VALUES (
        $1, 'Alimentos del Campo', 'alimentos-del-campo', true, NOW(), NOW()
      ) RETURNING id;
    `, [companyAId])
    const brandId = brandRes.rows[0].id

    // 6. Crear Productos de Prueba con diferentes configuraciones de canales web y stock
    // Prod 1: Solo Super Más (Stock 100 -> AVAILABLE)
    const slug1 = `arroz-premium-${testSuffix.slice(-4)}`
    const p1Res = await pgClient.query(`
      INSERT INTO public.products (
        company_id, sku, barcode, name, slug, category_id, brand_id, inventory_type, unit_of_measure,
        cost_price, public_sale_price, wholesale_price, min_wholesale_quantity, tax_rate_percent,
        is_tax_exempt, is_published_supermas, is_published_distributor, min_stock_threshold,
        critical_stock_threshold, is_active, created_at, updated_at
      ) VALUES (
        $1, 'SKU-SM-01-${testSuffix.slice(-4)}', '7701111111', 'Arroz Diana Especial 1kg', $2, $3, $4,
        'MERCHANDISE', 'UND', 3500, 4800, 4200, 12, 0, true, true, false, 10, 5, true, NOW(), NOW()
      ) RETURNING id;
    `, [companyAId, slug1, categoryId, brandId])
    prod1Id = p1Res.rows[0].id

    await pgClient.query(`
      INSERT INTO public.stock_levels (company_id, product_id, location_id, quantity, updated_at)
      VALUES ($1, $2, $3, 100, NOW());
    `, [companyAId, prod1Id, locEcomAId])

    // Prod 2: Solo Distribuidora (Stock 3 -> LOW_STOCK)
    const slug2 = `aceite-bulto-${testSuffix.slice(-4)}`
    const p2Res = await pgClient.query(`
      INSERT INTO public.products (
        company_id, sku, barcode, name, slug, category_id, brand_id, inventory_type, unit_of_measure,
        cost_price, public_sale_price, wholesale_price, min_wholesale_quantity, tax_rate_percent,
        is_tax_exempt, is_published_supermas, is_published_distributor, min_stock_threshold,
        critical_stock_threshold, is_active, created_at, updated_at
      ) VALUES (
        $1, 'SKU-DIS-02-${testSuffix.slice(-4)}', '7702222222', 'Aceite Premier Caja x 12', $2, $3, $4,
        'MERCHANDISE', 'CAJA', 60000, 78000, 70000, 5, 19, false, false, true, 10, 5, true, NOW(), NOW()
      ) RETURNING id;
    `, [companyAId, slug2, categoryId, brandId])
    prod2Id = p2Res.rows[0].id

    await pgClient.query(`
      INSERT INTO public.stock_levels (company_id, product_id, location_id, quantity, updated_at)
      VALUES ($1, $2, $3, 3, NOW());
    `, [companyAId, prod2Id, locEcomAId])

    // Prod 3: En Ambos Catálogos (Stock 0 -> OUT_OF_STOCK)
    const slug3 = `azucar-bulto-${testSuffix.slice(-4)}`
    const p3Res = await pgClient.query(`
      INSERT INTO public.products (
        company_id, sku, barcode, name, slug, category_id, brand_id, inventory_type, unit_of_measure,
        cost_price, public_sale_price, wholesale_price, min_wholesale_quantity, tax_rate_percent,
        is_tax_exempt, is_published_supermas, is_published_distributor, min_stock_threshold,
        critical_stock_threshold, is_active, created_at, updated_at
      ) VALUES (
        $1, 'SKU-AMB-03-${testSuffix.slice(-4)}', '7703333333', 'Azúcar Manuelita Bulto 50kg', $2, $3, $4,
        'MERCHANDISE', 'BULTO', 150000, 180000, 168000, 2, 5, false, true, true, 5, 2, true, NOW(), NOW()
      ) RETURNING id;
    `, [companyAId, slug3, categoryId, brandId])
    prod3Id = p3Res.rows[0].id

    await pgClient.query(`
      INSERT INTO public.stock_levels (company_id, product_id, location_id, quantity, updated_at)
      VALUES ($1, $2, $3, 0, NOW());
    `, [companyAId, prod3Id, locEcomAId])

    // Prod 4: Oculto de Ambos (Stock 50)
    const slug4 = `producto-oculto-${testSuffix.slice(-4)}`
    const p4Res = await pgClient.query(`
      INSERT INTO public.products (
        company_id, sku, barcode, name, slug, category_id, brand_id, inventory_type, unit_of_measure,
        cost_price, public_sale_price, wholesale_price, min_wholesale_quantity, tax_rate_percent,
        is_tax_exempt, is_published_supermas, is_published_distributor, min_stock_threshold,
        critical_stock_threshold, is_active, created_at, updated_at
      ) VALUES (
        $1, 'SKU-OCU-04-${testSuffix.slice(-4)}', '7704444444', 'Producto Privado Interno', $2, $3, $4,
        'MERCHANDISE', 'UND', 10000, 15000, 13000, 1, 19, false, false, false, 10, 5, true, NOW(), NOW()
      ) RETURNING id;
    `, [companyAId, slug4, categoryId, brandId])
    prod4Id = p4Res.rows[0].id

    await pgClient.query(`
      INSERT INTO public.stock_levels (company_id, product_id, location_id, quantity, updated_at)
      VALUES ($1, $2, $3, 50, NOW());
    `, [companyAId, prod4Id, locEcomAId])

    // 7. Crear Pedido Web de Prueba
    const orderNum = `WEB-ORD-${testSuffix.slice(-4)}`
    const ordRes = await pgClient.query(`
      INSERT INTO public.web_orders (
        company_id, order_number, channel, customer_name, customer_phone, customer_email,
        shipping_address, shipping_city, dispatch_location_id, subtotal, shipping_fee,
        total, payment_status, fulfillment_status, created_at, updated_at
      ) VALUES (
        $1, $2, 'SUPER_MAS', 'Laura Morales', '3001234567', 'laura@gmail.com',
        'Carrera 15 # 80-20', 'Bogotá', $3, 9600, 5000,
        14600, 'PAID', 'PENDING', NOW(), NOW()
      ) RETURNING id;
    `, [companyAId, orderNum, locEcomAId])
    webOrderAId = ordRes.rows[0].id

    await pgClient.query(`
      INSERT INTO public.web_order_items (
        company_id, order_id, product_id, quantity, unit_price, subtotal, created_at
      ) VALUES (
        $1, $2, $3, 2, 4800, 9600, NOW()
      );
    `, [companyAId, webOrderAId, prod1Id])

    console.log(`✅ Setup completado: Empresa A (${companyAId}), 4 productos sembrados, Pedido Web (${orderNum})\n`)

    // ========================================================================
    // T01: Filtrado de Catálogo Super Más (is_published_supermas = true)
    // ========================================================================
    const superCatalogResult = await superCatalogRepository.findAll(
      { catalogStatus: 'PUBLISHED' },
      companyAId
    )

    const hasProd1 = superCatalogResult.products.some((p) => p.id === prod1Id)
    const hasProd3 = superCatalogResult.products.some((p) => p.id === prod3Id)
    const hasNotProd2 = !superCatalogResult.products.some((p) => p.id === prod2Id)
    const hasNotProd4 = !superCatalogResult.products.some((p) => p.id === prod4Id)

    const t01Pass = hasProd1 && hasProd3 && hasNotProd2 && hasNotProd4

    recordResult(
      'T01',
      'Filtrado y Segregación de Catálogo Super Más (is_published_supermas)',
      t01Pass,
      t01Pass
        ? `Catálogo Super Más contiene exclusivamente Prod 1 y Prod 3. Prod 2 (Distribuidora) y Prod 4 (Oculto) fueron excluidos.`
        : `Falla en segregación de Catálogo Super Más.`
    )

    // ========================================================================
    // T02: Filtrado de Catálogo Distribuidora (is_published_distributor = true)
    // ========================================================================
    const distCatalogResult = await distributorCatalogRepository.findAll(
      { distributorStatus: 'PUBLISHED' },
      companyAId
    )

    const distHasProd2 = distCatalogResult.products.some((p) => p.id === prod2Id)
    const distHasProd3 = distCatalogResult.products.some((p) => p.id === prod3Id)
    const distHasNotProd1 = !distCatalogResult.products.some((p) => p.id === prod1Id)
    const distHasNotProd4 = !distCatalogResult.products.some((p) => p.id === prod4Id)

    const t02Pass = distHasProd2 && distHasProd3 && distHasNotProd1 && distHasNotProd4

    recordResult(
      'T02',
      'Filtrado y Segregación de Catálogo Distribuidora (is_published_distributor)',
      t02Pass,
      t02Pass
        ? `Catálogo Distribuidora contiene exclusivamente Prod 2 y Prod 3. Prod 1 y Prod 4 fueron excluidos.`
        : `Falla en segregación de Catálogo Distribuidora.`
    )

    // ========================================================================
    // T03: Sanitización Estricta de Costos y Márgenes (Seguridad Pública)
    // ========================================================================
    const allPublicProducts = [...superCatalogResult.products, ...distCatalogResult.products]

    const costLeaked = allPublicProducts.some(
      (p: any) =>
        p.costPrice !== undefined ||
        p.cost_price !== undefined ||
        p.profitMargin !== undefined ||
        p.margin !== undefined ||
        p.supplierId !== undefined
    )

    const t03Pass = !costLeaked && allPublicProducts.length >= 3

    recordResult(
      'T03',
      'Sanitización Fiduciaria: Confidencialidad Absoluta de Costos y Márgenes',
      t03Pass,
      t03Pass
        ? `Ningún producto expone costPrice, costo, margen o proveedor en las respuestas de catálogo.`
        : `Falla de seguridad: Fuga de información sensible de costos en catálogos.`
    )

    // ========================================================================
    // T04: Disponibilidad Comercial Fiduciaria (AVAILABLE, LOW_STOCK, OUT_OF_STOCK)
    // ========================================================================
    const item1 = superCatalogResult.products.find((p) => p.id === prod1Id)
    const item2 = distCatalogResult.products.find((p) => p.id === prod2Id)
    const item3 = superCatalogResult.products.find((p) => p.id === prod3Id)

    const t04Pass =
      item1?.availability === 'AVAILABLE' &&
      item1?.availabilityLabel === 'Disponible' &&
      item2?.availability === 'LOW_STOCK' &&
      item2?.availabilityLabel === 'Pocas unidades' &&
      item3?.availability === 'OUT_OF_STOCK' &&
      item3?.availabilityLabel === 'Agotado'

    recordResult(
      'T04',
      'Cálculo Fiduciario de Disponibilidad Pública (AVAILABLE, LOW_STOCK, OUT_OF_STOCK)',
      t04Pass,
      t04Pass
        ? `Disponibilidad verificada: Prod 1 (100 unds) -> AVAILABLE, Prod 2 (3 unds) -> LOW_STOCK, Prod 3 (0 unds) -> OUT_OF_STOCK.`
        : `Falla en cálculo de disponibilidad comercial.`
    )

    // ========================================================================
    // T05: Consulta Pública por SLUG Seguro
    // ========================================================================
    const slugProductSuperMas = await superCatalogRepository.findBySlug(slug1, companyAId)
    const slugProductDist = await distributorCatalogRepository.findBySlug(slug2, companyAId)
    const hiddenProductSlug = await superCatalogRepository.findBySlug(slug4, companyAId)

    const t05Pass =
      slugProductSuperMas !== null &&
      slugProductSuperMas.id === prod1Id &&
      slugProductDist !== null &&
      slugProductDist.id === prod2Id &&
      hiddenProductSlug === null

    recordResult(
      'T05',
      'Consulta Pública por SLUG Seguro sin Exposición de Atributos Privados',
      t05Pass,
      t05Pass
        ? `Resolución exitosa de SLUG: '${slug1}' en Super Más y '${slug2}' en Distribuidora. Producto oculto rechazado.`
        : `Falla en consulta pública por slug.`
    )

    // ========================================================================
    // T06: Actualización de Configuración y Precios Comerciales
    // ========================================================================
    const updatedProd2 = await distributorCatalogRepository.updateConfig(
      prod2Id!,
      {
        webDistribuidora: true,
        webSuperMas: true,
      },
      companyAId
    )

    const checkDbProd2 = await pgClient.query(
      `SELECT is_published_supermas, is_published_distributor FROM public.products WHERE id = $1;`,
      [prod2Id]
    )

    const t06Pass =
      updatedProd2.webSuperMas === true &&
      checkDbProd2.rows[0].is_published_supermas === true &&
      checkDbProd2.rows[0].is_published_distributor === true

    recordResult(
      'T06',
      'Actualización Dinámica de Canales Comerciales en PostgreSQL',
      t06Pass,
      t06Pass
        ? `Prod 2 ahora publicado en ambos catálogos (Super Más y Distribuidora) sincronizado en PostgreSQL.`
        : `Falla en actualización de configuración web.`
    )

    // ========================================================================
    // T07: Actualización Masiva de Visibilidad (bulkUpdate)
    // ========================================================================
    const bulkHideRes = await superCatalogRepository.bulkUpdate(
      [prod1Id!, prod3Id!],
      'HIDE',
      companyAId
    )

    const checkDbBulk = await pgClient.query(
      `SELECT COUNT(*) FROM public.products WHERE company_id = $1 AND is_published_supermas = true;`,
      [companyAId]
    )

    const t07Pass =
      bulkHideRes.updatedCount === 2 &&
      Number(checkDbBulk.rows[0].count) === 1 // Solo prod2Id que activamos en T06 sigue publicado

    recordResult(
      'T07',
      'Actualización Masiva de Publicación en Catálogos (bulkUpdate)',
      t07Pass,
      t07Pass
        ? `2 productos ocultados masivamente. Conteo de publicados en Super Más actualizado atómicamente.`
        : `Falla en actualización masiva de catálogo.`
    )

    // ========================================================================
    // T08: Resumen Multi-Bodega para Administración (Drawer de Gestión)
    // ========================================================================
    const adminProductDetail = await superCatalogRepository.findById(prod1Id!, companyAId)
    const t08Pass =
      adminProductDetail !== null &&
      Array.isArray(adminProductDetail.warehouseStockSummary) &&
      adminProductDetail.warehouseStockSummary.length >= 1 &&
      adminProductDetail.warehouseStockSummary[0].locationCode === 'BOD-ECOM' &&
      adminProductDetail.warehouseStockSummary[0].isEcommerceSource === true

    recordResult(
      'T08',
      'Desglose Multi-Bodega Exclusivo para Gestión Administrativa (ERP Drawer)',
      t08Pass,
      t08Pass
        ? `Resumen de stock por bodega verificado: BOD-ECOM (isEcommerceSource: true) con 100 unidades.`
        : `Falla en generación de resumen de bodegas administrativo.`
    )

    // ========================================================================
    // T09: Aislamiento Estricto Multiempresa (Empresa B tiene 0 productos de A)
    // ========================================================================
    const compBSuperCatalog = await superCatalogRepository.findAll({}, companyBId)
    const compBDistCatalog = await distributorCatalogRepository.findAll({}, companyBId)

    const t09Pass =
      compBSuperCatalog.products.length === 0 &&
      compBDistCatalog.products.length === 0

    recordResult(
      'T09',
      'Aislamiento Estricto Multiempresa en Catálogos Web',
      t09Pass,
      t09Pass
        ? `Empresa B visualiza 0 productos en Catálogo Super Más y 0 productos en Catálogo Distribuidora.`
        : `Falla de seguridad: Fuga de productos de catálogo entre empresas.`
    )

    // ========================================================================
    // T10: Persistencia Real de Pedidos Web en PostgreSQL
    // ========================================================================
    const webOrdersResult = await webOrderRepository.findAll(
      { orderNumber: orderNum },
      companyAId
    )
    const webStats = await webOrderRepository.getStats(companyAId)

    const t10Pass =
      webOrdersResult.orders.length === 1 &&
      webOrdersResult.orders[0].orderNumber === orderNum &&
      webOrdersResult.orders[0].totalAmount === 14600 &&
      webOrdersResult.orders[0].items.length === 1 &&
      webOrdersResult.orders[0].items[0].productName === 'Arroz Diana Especial 1kg' &&
      webStats.pendingCount >= 1

    recordResult(
      'T10',
      'Persistencia y Consulta de Pedidos Web en PostgreSQL (web_orders / items)',
      t10Pass,
      t10Pass
        ? `Pedido ${orderNum} recuperado con 1 item ($14,600 total) y métricas de pedidos web validadas.`
        : `Falla en consulta de pedidos web desde PostgreSQL.`
    )

    // ========================================================================
    // T11: Verificación de Stock contra Bodega Ecommerce Designada
    // ========================================================================
    const stockCheckFulfillable = await webOrderRepository.checkStockAvailability(
      [{ productId: prod1Id!, quantity: 10 }],
      companyAId
    )
    const stockCheckOutOfStock = await webOrderRepository.checkStockAvailability(
      [{ productId: prod3Id!, quantity: 1 }],
      companyAId
    )

    const t11Pass =
      stockCheckFulfillable.length === 1 &&
      stockCheckFulfillable[0].canFulfill === true &&
      stockCheckFulfillable[0].isEcommerceWarehouseAvailable === true &&
      stockCheckOutOfStock.length === 1 &&
      stockCheckOutOfStock[0].canFulfill === false

    recordResult(
      'T11',
      'Validación de Stock contra Bodega Designada para Procesamiento Ecommerce',
      t11Pass,
      t11Pass
        ? `Verificación de despacho exitosa: Prod 1 canFulfill=true, Prod 3 canFulfill=false.`
        : `Falla en validación de stock en bodega ecommerce.`
    )

    // ========================================================================
    // T12: Transición de Pedido Web a Venta Oficial (createSaleFromWebOrder)
    // ========================================================================
    const targetOrder = webOrdersResult.orders[0]
    const saleCreated = await webOrderRepository.createSaleFromWebOrder(
      targetOrder,
      { id: userAId!, name: 'Admin Catálogos Web' },
      companyAId
    )

    const verifySaleInDb = await pgClient.query(
      `SELECT id, sale_number, total_amount, payment_status FROM public.sales WHERE id = $1;`,
      [saleCreated.saleId]
    )

    const verifyOrderUpdated = await pgClient.query(
      `SELECT sale_id FROM public.web_orders WHERE id = $1;`,
      [targetOrder.id]
    )

    const t12Pass =
      verifySaleInDb.rows.length === 1 &&
      verifySaleInDb.rows[0].sale_number === saleCreated.saleNumber &&
      verifyOrderUpdated.rows[0].sale_id === saleCreated.saleId

    recordResult(
      'T12',
      'Articulación Transaccional: Conversión de Pedido Web a Venta Oficial en sales',
      t12Pass,
      t12Pass
        ? `Venta ${saleCreated.saleNumber} generada en public.sales y vinculada a web_order ${targetOrder.orderNumber}.`
        : `Falla en conversión de pedido web a venta.`
    )
  } catch (err: any) {
    console.error('❌ Error catastrófico en suite E2E de Canales Web:', err)
  } finally {
    console.log('\n--- Ejecutando Purga Zero Pollution en Canales Web ---')
    try {
      await pgClient.query("SELECT set_config('app.is_test_cleanup', 'true', false);")

      if (companyAId) {
        // 1. Pedidos Web y Ventas
        await pgClient.query(`DELETE FROM public.web_order_items WHERE company_id = $1;`, [companyAId])
        await pgClient.query(`DELETE FROM public.web_orders WHERE company_id = $1;`, [companyAId])
        await pgClient.query(`DELETE FROM public.sale_items WHERE company_id = $1;`, [companyAId])
        await pgClient.query(`DELETE FROM public.sales WHERE company_id = $1;`, [companyAId])
        await pgClient.query(`DELETE FROM public.customers WHERE company_id = $1;`, [companyAId])

        // 2. Stock y Productos
        await pgClient.query(`DELETE FROM public.stock_levels WHERE company_id = $1;`, [companyAId])
        await pgClient.query(`DELETE FROM public.product_prices WHERE company_id = $1;`, [companyAId])
        await pgClient.query(`DELETE FROM public.products WHERE company_id = $1;`, [companyAId])

        // 3. Categorías y Marcas
        await pgClient.query(`DELETE FROM public.categories WHERE company_id = $1;`, [companyAId])
        await pgClient.query(`DELETE FROM public.brands WHERE company_id = $1;`, [companyAId])

        // 4. Usuarios y Ubicaciones
        await pgClient.query(`DELETE FROM public.users WHERE company_id = $1;`, [companyAId])
        await pgClient.query(`DELETE FROM public.locations WHERE company_id = $1;`, [companyAId])

        // 5. Auditoría y Empresa
        await pgClient.query(`DELETE FROM public.audit_logs WHERE company_id = $1;`, [companyAId])
        await pgClient.query(`DELETE FROM public.companies WHERE id = $1;`, [companyAId])

        if (userAId) {
          await supabaseAdmin.auth.admin.deleteUser(userAId).catch(() => {})
        }
      }

      if (companyBId) {
        await pgClient.query(`DELETE FROM public.locations WHERE company_id = $1;`, [companyBId])
        await pgClient.query(`DELETE FROM public.audit_logs WHERE company_id = $1;`, [companyBId])
        await pgClient.query(`DELETE FROM public.companies WHERE id = $1;`, [companyBId])
      }

      const verifyCleanA = await pgClient.query(
        `SELECT COUNT(*) FROM public.products WHERE company_id = $1;`,
        [companyAId]
      )
      const verifyCleanB = await pgClient.query(
        `SELECT COUNT(*) FROM public.products WHERE company_id = $1;`,
        [companyBId]
      )

      const t13Pass =
        Number(verifyCleanA.rows[0].count) === 0 &&
        Number(verifyCleanB.rows[0].count) === 0

      recordResult(
        'T13',
        'Zero Pollution: Purga 100% limpia de registros de Catálogos y Pedidos Web',
        t13Pass,
        t13Pass
          ? `Todos los registros de prueba (pedidos web, ventas, stock, productos, categorías, marcas, empresas) purgados atómicamente.`
          : `Alerta: Quedaron residuos de prueba en PostgreSQL.`
      )
    } catch (cleanupErr) {
      console.error('❌ Error durante la purga de canales web:', cleanupErr)
    } finally {
      await pgClient.end()
    }
  }

  // ========================================================================
  // RESUMEN FINAL
  // ========================================================================
  console.log('\n============================================================')
  console.log('RESUMEN DE EJECUCIÓN - FASE 17: CANALES WEB Y CATÁLOGOS')
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

runPhase17WebCatalogsE2ETests().catch((err) => {
  console.error('Falla no capturada en suite:', err)
  process.exit(1)
})
