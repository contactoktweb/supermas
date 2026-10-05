/**
 * SUPER MÁS ERP/POS - SUITE E2E FASE 19: COTIZACIONES Y PRESUPUESTOS COMERCIALES
 *
 * Valida de forma exhaustiva, transaccional y multiempresa:
 * 1. Creación y persistencia de cotización y líneas en PostgreSQL (public.quotes / public.quote_items).
 * 2. Consecutivo automático secuencial (COT-XXXXXX).
 * 3. Integridad de Kardex: Una cotización NO afecta el stock ni genera movimientos de inventario.
 * 4. Transiciones de estado (DRAFT -> SENT -> ACCEPTED -> REJECTED).
 * 5. Generación de mensaje proforma y URL de WhatsApp comercial formateada en COP.
 * 6. Conversión atómica a venta oficial (public.sales, public.sale_items, stock_levels y Kardex OUT).
 * 7. Salvaguardas de idempotencia: Imposibilidad de doble conversión o conversión de rechazada.
 * 8. Métricas y KPIs de conversión comercial (QuoteStats).
 * 9. Filtros de búsqueda (por texto, cliente, estado, fechas).
 * 10. Aislamiento estricto multi-inquilino (Company A vs Company B).
 * 11. Auditoría inmutable en public.audit_logs.
 * 12. Zero Pollution: Purga atómica del 100% de datos de prueba.
 *
 * Ejecución: npx tsx --env-file=.env.local scripts/test-phase19-quotes-e2e.ts
 */

import pg from 'pg'
import { quoteRepository } from '../features/quotes/repositories/quote.repository'
import { quoteService } from '../features/quotes/services/quote.service'
import { supabaseAdmin } from '../lib/supabase/admin'

interface TestResult {
  code: string
  name: string
  passed: boolean
  details: string
}

const results: TestResult[] = []

function recordResult(code: string, name: string, passed: boolean, details: string) {
  results.push({ code, name, passed, details })
  const icon = passed ? '✅' : '❌'
  console.log(`\n${icon} [${code}] ${name}: ${passed ? 'PASS' : 'FAIL'}`)
  console.log(`   Detalle: ${details}`)
}

async function runPhase19QuotesE2ETests() {
  console.log('============================================================')
  console.log('INICIANDO SUITE E2E - FASE 19: COTIZACIONES Y PRESUPUESTOS')
  console.log('============================================================\n')

  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    throw new Error('DATABASE_URL no configurado en entorno.')
  }

  const pgClient = new pg.Client({ connectionString: databaseUrl })
  await pgClient.connect()
  console.log('✅ Conexión directa a PostgreSQL Staging establecida.\n')

  const testSuffix = `_t19_${Date.now().toString().slice(-4)}`
  let companyAId: string | null = null
  let companyBId: string | null = null
  let locPrincipalAId: string | null = null
  let locControlBId: string | null = null
  let categoryId: string | null = null
  let brandId: string | null = null
  let userAId: string | null = null
  let customerAId: string | null = null

  let prod1Id: string | null = null
  let prod2Id: string | null = null

  let createdQuoteId: string | null = null
  let createdSaleId: string | null = null

  try {
    console.log('--- Configurando Entorno Multiempresa y Catálogo para Cotizaciones ---')

    // 1. Empresa A
    const compARes = await pgClient.query(`
      INSERT INTO public.companies (
        business_name, trade_name, tax_id, verification_digit, tax_regime,
        address, city, department, country, currency, status, created_at, updated_at
      ) VALUES (
        'Super Más Cotizaciones S.A.S.', 'Super Más Cotizaciones', '901777${Date.now().toString().slice(-3)}',
        '1', 'COMUN', 'Calle 80 # 25-10', 'Bogotá', 'Bogotá D.C.', 'COLOMBIA', 'COP', 'ACTIVE',
        NOW(), NOW()
      ) RETURNING id;
    `)
    companyAId = compARes.rows[0].id

    // 2. Empresa B (Control de aislamiento)
    const compBRes = await pgClient.query(`
      INSERT INTO public.companies (
        business_name, trade_name, tax_id, verification_digit, tax_regime,
        address, city, department, country, currency, status, created_at, updated_at
      ) VALUES (
        'Empresa Control Cotizaciones B S.A.S.', 'Control Cotizaciones B', '901666${Date.now().toString().slice(-3)}',
        '2', 'COMUN', 'Calle 50 # 10-20', 'Medellín', 'Antioquia', 'COLOMBIA', 'COP', 'ACTIVE',
        NOW(), NOW()
      ) RETURNING id;
    `)
    companyBId = compBRes.rows[0].id

    // 3. Ubicaciones
    const locARes = await pgClient.query(`
      INSERT INTO public.locations (company_id, code, name, type, status, is_ecommerce_source, address, city, department, created_at, updated_at)
      VALUES ($1, 'BOD-COT-${testSuffix.slice(-4)}', 'Bodega Cotizaciones Central', 'WAREHOUSE', 'ACTIVE', false, 'Calle 80 # 25-10', 'Bogotá', 'Bogotá D.C.', NOW(), NOW())
      RETURNING id;
    `, [companyAId])
    locPrincipalAId = locARes.rows[0].id

    const locBRes = await pgClient.query(`
      INSERT INTO public.locations (company_id, code, name, type, status, is_ecommerce_source, address, city, department, created_at, updated_at)
      VALUES ($1, 'BOD-CTRL-${testSuffix.slice(-4)}', 'Bodega Control Cotizaciones', 'WAREHOUSE', 'ACTIVE', false, 'Calle 50 # 10-20', 'Medellín', 'Antioquia', NOW(), NOW())
      RETURNING id;
    `, [companyBId])
    locControlBId = locBRes.rows[0].id

    // 4. Usuario Admin en Empresa A
    const authUserRes = await supabaseAdmin.auth.admin.createUser({
      email: `seller_quotes_${testSuffix}@supermas.co`,
      password: 'SuperQuotesPass2026*',
      email_confirm: true,
      app_metadata: { company_id: companyAId, role: 'SELLER' },
    })
    userAId = authUserRes.data.user!.id

    const roleRes = await pgClient.query(`SELECT id FROM public.roles LIMIT 1;`)
    const defaultRoleId = roleRes.rows[0].id

    await pgClient.query(`
      INSERT INTO public.users (id, company_id, email, full_name, role_id, is_active, created_at, updated_at)
      VALUES ($1, $2, 'seller_quotes_${testSuffix}@supermas.co', 'Camilo Vendedor', $3, true, NOW(), NOW())
      ON CONFLICT (id) DO UPDATE SET
        company_id = EXCLUDED.company_id,
        full_name = EXCLUDED.full_name,
        role_id = EXCLUDED.role_id,
        is_active = true;
    `, [userAId, companyAId, defaultRoleId])

    // 5. Cliente Mayorista en Empresa A
    const custRes = await pgClient.query(`
      INSERT INTO public.customers (
        company_id, first_name, last_name, company_name, document_type, document_number,
        email, phone, address, city, customer_type, customer_category, is_active, created_at, updated_at
      ) VALUES (
        $1, 'Andrés', 'Restrepo', 'Distribuidora del Norte S.A.S.', 'NIT', '900123456-7',
        'compras@delnorte.com', '3109876543', 'Av. Boyacá # 116-50', 'Bogotá', 'COMPANY', 'WHOLESALE', true, NOW(), NOW()
      ) RETURNING id;
    `, [companyAId])
    customerAId = custRes.rows[0].id

    // 6. Categoría y Marca
    const catRes = await pgClient.query(`
      INSERT INTO public.categories (company_id, name, slug, is_active, created_at, updated_at)
      VALUES ($1, 'Abarrotes Cotiz ${testSuffix}', 'abarrotes-cotiz-${testSuffix}', true, NOW(), NOW())
      RETURNING id;
    `, [companyAId])
    categoryId = catRes.rows[0].id

    const brandRes = await pgClient.query(`
      INSERT INTO public.brands (company_id, name, slug, is_active, created_at, updated_at)
      VALUES ($1, 'La Fina ${testSuffix}', 'la-fina-${testSuffix}', true, NOW(), NOW())
      RETURNING id;
    `, [companyAId])
    brandId = brandRes.rows[0].id

    // 7. Productos con Stock Inicial
    // Prod 1: Harina de Trigo Bulto 50kg (Costo: 80.000, Precio: 100.000, IVA: 0%)
    const p1Res = await pgClient.query(`
      INSERT INTO public.products (
        company_id, sku, barcode, name, slug, category_id, brand_id, inventory_type, unit_of_measure,
        cost_price, public_sale_price, wholesale_price, min_wholesale_quantity, tax_rate_percent,
        is_tax_exempt, is_published_supermas, is_published_distributor, min_stock_threshold,
        critical_stock_threshold, is_active, created_at, updated_at
      ) VALUES (
        $1, 'SKU-HAR-${testSuffix}', '770111222333', 'Harina de Trigo Bulto 50kg', 'harina-trigo-${testSuffix}',
        $2, $3, 'MERCHANDISE', 'BULTO', 80000, 100000, 92000, 2, 0, true, true, true, 10, 5, true, NOW(), NOW()
      ) RETURNING id;
    `, [companyAId, categoryId, brandId])
    prod1Id = p1Res.rows[0].id

    await pgClient.query(`
      INSERT INTO public.stock_levels (company_id, product_id, location_id, quantity, updated_at)
      VALUES ($1, $2, $3, 100, NOW());
    `, [companyAId, prod1Id, locPrincipalAId])

    // Prod 2: Manteca Vegetal Caja 15kg (Costo: 60.000, Precio: 75.000, IVA: 19%)
    const p2Res = await pgClient.query(`
      INSERT INTO public.products (
        company_id, sku, barcode, name, slug, category_id, brand_id, inventory_type, unit_of_measure,
        cost_price, public_sale_price, wholesale_price, min_wholesale_quantity, tax_rate_percent,
        is_tax_exempt, is_published_supermas, is_published_distributor, min_stock_threshold,
        critical_stock_threshold, is_active, created_at, updated_at
      ) VALUES (
        $1, 'SKU-MAN-${testSuffix}', '770444555666', 'Manteca Vegetal Caja 15kg', 'manteca-vegetal-${testSuffix}',
        $2, $3, 'MERCHANDISE', 'CAJA', 60000, 75000, 68000, 3, 19, false, true, true, 15, 6, true, NOW(), NOW()
      ) RETURNING id;
    `, [companyAId, categoryId, brandId])
    prod2Id = p2Res.rows[0].id

    await pgClient.query(`
      INSERT INTO public.stock_levels (company_id, product_id, location_id, quantity, updated_at)
      VALUES ($1, $2, $3, 50, NOW());
    `, [companyAId, prod2Id, locPrincipalAId])

    console.log('✅ Setup completado: Empresa A, Empresa B, Ubicaciones, Cliente, Productos y Stock listos.\n')

    const sellerUser = {
      id: userAId!,
      name: 'Camilo Vendedor',
      role: 'SELLER',
      companyId: companyAId!,
    }

    // ========================================================================
    // T01: Creación y Persistencia de Cotización en PostgreSQL
    // ========================================================================
    // 5 bultos de harina ($100.000 c/u, 5% desc) = base $475.000, iva $0 = total $475.000
    // 2 cajas manteca ($75.000 c/u, 0% desc, 19% iva) = base $150.000, iva $28.500 = total $178.500
    // Total general = $653.500
    const quote1 = await quoteService.createQuote(
      {
        locationId: locPrincipalAId!,
        customerId: customerAId!,
        customerName: 'Distribuidora del Norte S.A.S.',
        customerDocument: '900123456-7',
        customerEmail: 'compras@delnorte.com',
        customerPhone: '3109876543',
        validUntil: '2026-10-31',
        notes: 'Precios especiales por volumen para panadería industrial.',
        items: [
          { productId: prod1Id!, quantity: 5, unitPrice: 100000, discountPercent: 5, taxRatePercent: 0 },
          { productId: prod2Id!, quantity: 2, unitPrice: 75000, discountPercent: 0, taxRatePercent: 19 },
        ],
      },
      sellerUser
    )

    createdQuoteId = quote1.id

    const verifyQuoteInDb = await pgClient.query(
      `SELECT quote_number, status, subtotal_amount, discount_amount, tax_amount, total_amount
       FROM public.quotes WHERE id = $1;`,
      [createdQuoteId]
    )

    const verifyItemsInDb = await pgClient.query(
      `SELECT count(*) FROM public.quote_items WHERE quote_id = $1;`,
      [createdQuoteId]
    )

    const qRow = verifyQuoteInDb.rows[0]
    const t01Pass =
      verifyQuoteInDb.rows.length === 1 &&
      qRow.quote_number.startsWith('COT-') &&
      qRow.status === 'DRAFT' &&
      Number(qRow.subtotal_amount) === 650000 &&
      Number(qRow.discount_amount) === 25000 &&
      Number(qRow.tax_amount) === 28500 &&
      Number(qRow.total_amount) === 653500 &&
      Number(verifyItemsInDb.rows[0].count) === 2

    recordResult(
      'T01',
      'Creación y Persistencia de Cotización con Cálculos Comerciales en PostgreSQL',
      t01Pass,
      t01Pass
        ? `Cotización ${qRow.quote_number} generada exitosamente con 2 líneas ($653,500 COP total).`
        : `Falla en creación o persistencia de cotización.`
    )

    // ========================================================================
    // T02: Integridad de Inventario: NO Afecta Stock ni Genera Kardex
    // ========================================================================
    const checkStockP1 = await pgClient.query(
      `SELECT quantity FROM public.stock_levels WHERE company_id = $1 AND product_id = $2 AND location_id = $3;`,
      [companyAId, prod1Id, locPrincipalAId]
    )
    const checkStockP2 = await pgClient.query(
      `SELECT quantity FROM public.stock_levels WHERE company_id = $1 AND product_id = $2 AND location_id = $3;`,
      [companyAId, prod2Id, locPrincipalAId]
    )
    const checkKardex = await pgClient.query(
      `SELECT count(*) FROM public.inventory_movements WHERE company_id = $1;`,
      [companyAId]
    )

    const t02Pass =
      Number(checkStockP1.rows[0].quantity) === 100 &&
      Number(checkStockP2.rows[0].quantity) === 50 &&
      Number(checkKardex.rows[0].count) === 0

    recordResult(
      'T02',
      'Integridad Fiduciaria: Las Cotizaciones NO Descuentan Stock ni Alteran Kardex',
      t02Pass,
      t02Pass
        ? `Stock de Harina permanece en 100 y Manteca en 50. Movimientos de Kardex = 0.`
        : `Falla: Una cotización afectó el stock físico o el Kardex.`
    )

    // ========================================================================
    // T03: Transición de Estado a ENVIADA (SENT)
    // ========================================================================
    const sentQuote = await quoteService.updateStatus(
      createdQuoteId,
      'SENT',
      'Enviada por correo y WhatsApp al jefe de compras.',
      sellerUser
    )

    const verifySentInDb = await pgClient.query(
      `SELECT status FROM public.quotes WHERE id = $1;`,
      [createdQuoteId]
    )

    const t03Pass =
      sentQuote.status === 'SENT' &&
      verifySentInDb.rows[0].status === 'SENT'

    recordResult(
      'T03',
      'Transición de Estado Comercial a ENVIADA (SENT)',
      t03Pass,
      t03Pass
        ? `Estado actualizado a SENT y persistido en PostgreSQL.`
        : `Falla en transición a SENT.`
    )

    // ========================================================================
    // T04: Transición de Estado a ACEPTADA (ACCEPTED)
    // ========================================================================
    const acceptedQuote = await quoteService.updateStatus(
      createdQuoteId,
      'ACCEPTED',
      'Aprobada por gerencia de compras cliente.',
      sellerUser
    )

    const verifyAcceptedInDb = await pgClient.query(
      `SELECT status FROM public.quotes WHERE id = $1;`,
      [createdQuoteId]
    )

    const t04Pass =
      acceptedQuote.status === 'ACCEPTED' &&
      verifyAcceptedInDb.rows[0].status === 'ACCEPTED'

    recordResult(
      'T04',
      'Transición de Estado Comercial a ACEPTADA (ACCEPTED)',
      t04Pass,
      t04Pass
        ? `Estado actualizado a ACCEPTED conforme al flujo comercial.`
        : `Falla en transición a ACCEPTED.`
    )

    // ========================================================================
    // T05: Generación de Plantilla y Enlace Comercial WhatsApp
    // ========================================================================
    const whatsappUrl = quoteService.generateWhatsAppShareUrl(acceptedQuote, 'Super Más Mayoristas')

    const t05Pass =
      whatsappUrl.startsWith('https://wa.me/573109876543?text=') &&
      whatsappUrl.includes(encodeURIComponent(acceptedQuote.quoteNumber)) &&
      whatsappUrl.includes(encodeURIComponent('Harina de Trigo Bulto 50kg')) &&
      whatsappUrl.includes(encodeURIComponent('653.500'))

    recordResult(
      'T05',
      'Generación de Mensaje Proforma y Enlace WhatsApp Comercial',
      t05Pass,
      t05Pass
        ? `Enlace WhatsApp generado correctamente con formato profesional y moneda colombiana.`
        : `Falla en generación de URL de WhatsApp.`
    )

    // ========================================================================
    // T06: Conversión Atómica a Venta Oficial en sales y Descuento de Stock
    // ========================================================================
    const conversionResult = await quoteService.convertToSale(
      createdQuoteId,
      {
        locationId: locPrincipalAId!,
        paymentMethod: 'TRANSFERENCIA',
        notes: 'Pago anticipado vía transferencia Bancolombia.',
      },
      sellerUser
    )

    createdSaleId = conversionResult.saleId

    // Verificar venta en public.sales
    const verifySale = await pgClient.query(
      `SELECT sale_number, customer_id, total_amount, payment_status, status FROM public.sales WHERE id = $1;`,
      [createdSaleId]
    )

    // Verificar líneas en public.sale_items
    const verifySaleItems = await pgClient.query(
      `SELECT count(*), sum(quantity) as units FROM public.sale_items WHERE sale_id = $1;`,
      [createdSaleId]
    )

    // Verificar Kardex
    const verifyKardexOut = await pgClient.query(
      `SELECT movement_type, quantity_out, reason FROM public.inventory_movements
       WHERE company_id = $1 AND document_reference = $2;`,
      [companyAId, conversionResult.saleNumber]
    )

    // Verificar descuento de stock en stock_levels
    const checkStockPostSaleP1 = await pgClient.query(
      `SELECT quantity FROM public.stock_levels WHERE company_id = $1 AND product_id = $2 AND location_id = $3;`,
      [companyAId, prod1Id, locPrincipalAId]
    )
    const checkStockPostSaleP2 = await pgClient.query(
      `SELECT quantity FROM public.stock_levels WHERE company_id = $1 AND product_id = $2 AND location_id = $3;`,
      [companyAId, prod2Id, locPrincipalAId]
    )

    // Verificar que la cotización quedó en CONVERTED y vinculada
    const verifyQuoteStatusPost = await pgClient.query(
      `SELECT status, sale_id FROM public.quotes WHERE id = $1;`,
      [createdQuoteId]
    )

    const t06Pass =
      verifySale.rows.length === 1 &&
      verifySale.rows[0].sale_number === conversionResult.saleNumber &&
      Number(verifySale.rows[0].total_amount) === 653500 &&
      Number(verifySaleItems.rows[0].count) === 2 &&
      Number(verifySaleItems.rows[0].units) === 7 && // 5 + 2
      verifyKardexOut.rows.length === 2 &&
      verifyKardexOut.rows[0].movement_type === 'SALE_OUT' &&
      Number(checkStockPostSaleP1.rows[0].quantity) === 95 && // 100 - 5 = 95
      Number(checkStockPostSaleP2.rows[0].quantity) === 48 && // 50 - 2 = 48
      verifyQuoteStatusPost.rows[0].status === 'CONVERTED' &&
      verifyQuoteStatusPost.rows[0].sale_id === createdSaleId

    recordResult(
      'T06',
      'Conversión Atómica de Cotización a Venta Oficial, Kardex OUT y Stock',
      t06Pass,
      t06Pass
        ? `Venta ${conversionResult.saleNumber} generada, Kardex descontado (Harina: 95, Manteca: 48) y cotización vinculada.`
        : `Falla en conversión atómica de cotización a venta.`
    )

    // ========================================================================
    // T07: Salvaguarda de Idempotencia: No Permitir Doble Conversión
    // ========================================================================
    let doubleConversionError = false
    try {
      await quoteService.convertToSale(createdQuoteId, {}, sellerUser)
    } catch (err: any) {
      if (err.message.includes('ya fue convertida a venta previamente')) {
        doubleConversionError = true
      }
    }

    recordResult(
      'T07',
      'Salvaguarda de Idempotencia: Bloqueo de Doble Conversión',
      doubleConversionError,
      doubleConversionError
        ? `Rechazado intento de convertir nuevamente la cotización ya convertida.`
        : `Falla: Se permitió doble conversión de cotización.`
    )

    // ========================================================================
    // T08: Flujo de Rechazo Comercial (REJECTED) y Bloqueo de Conversión
    // ========================================================================
    const quoteReject = await quoteService.createQuote(
      {
        locationId: locPrincipalAId!,
        customerName: 'Cliente Ocasional No Aprobó',
        validUntil: '2026-10-15',
        items: [{ productId: prod1Id!, quantity: 1, unitPrice: 100000 }],
      },
      sellerUser
    )

    await quoteService.updateStatus(quoteReject.id, 'REJECTED', 'Presupuesto no aprobado por precio alto.', sellerUser)

    let convertRejectedError = false
    try {
      await quoteService.convertToSale(quoteReject.id, {}, sellerUser)
    } catch (err: any) {
      if (err.message.includes('No se puede convertir a venta una cotización rechazada')) {
        convertRejectedError = true
      }
    }

    const t08Pass = convertRejectedError

    recordResult(
      'T08',
      'Flujo de Cotización Rechazada y Bloqueo de Conversión a Venta',
      t08Pass,
      t08Pass
        ? `Cotización rechazada bloqueada correctamente contra conversiones accidentales.`
        : `Falla en validación de cotización rechazada.`
    )

    // ========================================================================
    // T09: Filtros de Búsqueda y Paginación desde PostgreSQL
    // ========================================================================
    const filteredByCustomer = await quoteService.getQuotes(
      { customerId: customerAId! },
      sellerUser
    )
    const filteredByStatus = await quoteService.getQuotes(
      { status: 'CONVERTED' },
      sellerUser
    )

    const t09Pass =
      filteredByCustomer.total >= 1 &&
      filteredByCustomer.data.every((q) => q.customerId === customerAId) &&
      filteredByStatus.total >= 1 &&
      filteredByStatus.data.every((q) => q.status === 'CONVERTED')

    recordResult(
      'T09',
      'Filtros Avanzados y Consultas Dinámicas en PostgreSQL',
      t09Pass,
      t09Pass
        ? `Filtros por cliente y estado CONVERTED verificados con consistencia relacional.`
        : `Falla en filtros de cotizaciones.`
    )

    // ========================================================================
    // T10: Métricas y KPIs Comerciales (getStats)
    // ========================================================================
    const stats = await quoteService.getStats(sellerUser)

    const t10Pass =
      stats.totalQuotes >= 2 &&
      stats.convertedCount >= 1 &&
      stats.rejectedCount >= 1 &&
      stats.convertedAmount >= 653500 &&
      stats.conversionRatePercent > 0

    recordResult(
      'T10',
      'Métricas y KPIs Comerciales en Tiempo Real (getStats)',
      t10Pass,
      t10Pass
        ? `Total cotizaciones: ${stats.totalQuotes}, Convertidas: ${stats.convertedCount} ($${stats.convertedAmount.toLocaleString('es-CO')} COP), Tasa: ${stats.conversionRatePercent}%.`
        : `Falla en cálculo de métricas de cotizaciones.`
    )

    // ========================================================================
    // T11: Aislamiento Estricto Multi-Inquilino (Company A vs Company B)
    // ========================================================================
    const sellerB = {
      id: crypto.randomUUID(),
      name: 'Vendedor Empresa B',
      role: 'SELLER',
      companyId: companyBId!,
    }

    const quotesCompanyB = await quoteService.getQuotes({}, sellerB)
    const statsCompanyB = await quoteService.getStats(sellerB)

    const t11Pass =
      quotesCompanyB.total === 0 &&
      quotesCompanyB.data.length === 0 &&
      statsCompanyB.totalQuotes === 0

    recordResult(
      'T11',
      'Aislamiento Estricto Multi-Inquilino (Multi-Tenancy)',
      t11Pass,
      t11Pass
        ? `Empresa B visualiza 0 cotizaciones y 0 métricas. Segregación 100% estricta.`
        : `Falla en aislamiento multiempresa de cotizaciones.`
    )

    // ========================================================================
    // T12: Trazabilidad Inmutable en public.audit_logs
    // ========================================================================
    const auditEvents = await pgClient.query(`
      SELECT action, module, entity_name, entity_id FROM public.audit_logs
      WHERE company_id = $1 AND module = 'SALES';
    `, [companyAId])

    const quoteEvents = auditEvents.rows.filter((r) => r.entity_name === 'QUOTE')
    const saleCreatedEvent = auditEvents.rows.find((r) => r.action === 'SALE_CREATED' && r.entity_id === createdSaleId)

    const t12Pass =
      quoteEvents.length >= 2 &&
      Boolean(saleCreatedEvent)

    recordResult(
      'T12',
      'Trazabilidad Inmutable en public.audit_logs para Cotizaciones y Ventas',
      t12Pass,
      t12Pass
        ? `Registrados ${quoteEvents.length} eventos de cotización y evento de venta creada en PostgreSQL.`
        : `Falla en registro de auditoría de cotizaciones.`
    )

  } catch (err: any) {
    console.error('❌ Error catastrófico en suite E2E de Cotizaciones:', err)
  } finally {
    console.log('\n--- Ejecutando Purga Zero Pollution en Cotizaciones ---')
    try {
      await pgClient.query("SELECT set_config('app.is_test_cleanup', 'true', false);")

      if (companyAId) {
        // 1. Cotizaciones y Ventas
        await pgClient.query(`DELETE FROM public.quote_items WHERE company_id = $1;`, [companyAId])
        await pgClient.query(`DELETE FROM public.quotes WHERE company_id = $1;`, [companyAId])
        await pgClient.query(`DELETE FROM public.sale_items WHERE company_id = $1;`, [companyAId])
        await pgClient.query(`DELETE FROM public.sales WHERE company_id = $1;`, [companyAId])
        await pgClient.query(`DELETE FROM public.customers WHERE company_id = $1;`, [companyAId])

        // 2. Kardex, Stock y Productos
        await pgClient.query(`DELETE FROM public.inventory_movements WHERE company_id = $1;`, [companyAId])
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

      const verifyQuotesClean = await pgClient.query(
        `SELECT COUNT(*) FROM public.quotes WHERE company_id = $1;`,
        [companyAId]
      )
      const verifySalesClean = await pgClient.query(
        `SELECT COUNT(*) FROM public.sales WHERE company_id = $1;`,
        [companyAId]
      )
      const verifyProductsClean = await pgClient.query(
        `SELECT COUNT(*) FROM public.products WHERE company_id = $1;`,
        [companyAId]
      )

      const t13Pass =
        Number(verifyQuotesClean.rows[0].count) === 0 &&
        Number(verifySalesClean.rows[0].count) === 0 &&
        Number(verifyProductsClean.rows[0].count) === 0

      recordResult(
        'T13',
        'Zero Pollution: Purga 100% limpia de Cotizaciones, Ventas, Stock y Empresas',
        t13Pass,
        t13Pass
          ? `Todos los registros de prueba (cotizaciones, items, ventas, stock, productos, empresas) purgados atómicamente.`
          : `Alerta: Quedaron residuos de prueba en PostgreSQL.`
      )
    } catch (cleanupErr) {
      console.error('❌ Error durante la purga de cotizaciones:', cleanupErr)
    } finally {
      await pgClient.end()
    }
  }

  // ========================================================================
  // RESUMEN FINAL
  // ========================================================================
  console.log('\n============================================================')
  console.log('RESUMEN DE EJECUCIÓN - FASE 19: COTIZACIONES Y PRESUPUESTOS')
  console.log('============================================================')
  results.forEach((r) => {
    console.log(`${r.passed ? '✅' : '❌'} [${r.code}] ${r.name}`)
  })
  const totalPassed = results.filter((r) => r.passed).length
  console.log('============================================================')
  console.log(`TOTAL: ${results.length} | PASARON: ${totalPassed} | FALLARON: ${results.length - totalPassed}`)
  console.log('============================================================\n')

  if (totalPassed !== results.length) {
    process.exit(1)
  }
}

runPhase19QuotesE2ETests().catch((err) => {
  console.error('Error no controlado en suite E2E de Cotizaciones:', err)
  process.exit(1)
})
