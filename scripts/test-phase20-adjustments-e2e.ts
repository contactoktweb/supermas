/**
 * SUITE E2E - FASE 20: AJUSTES COMERCIALES (DESCUENTOS, ANULACIONES Y DEVOLUCIONES)
 *
 * Valida de forma exhaustiva sobre PostgreSQL Staging:
 *  1. Descuentos estándar permitidos por maxAllowedDiscountPercent.
 *  2. Bloqueo de descuentos no autorizados sin permiso supervisor (sales.discount).
 *  3. Aprobación y aplicación de descuentos por usuario supervisor.
 *  4. Recálculo financiero en servidor (subtotal, descuento, base gravable, IVA 19%, total).
 *  5. Venta a Crédito e incremento de saldo deudor (current_balance) en cliente.
 *  6. Anulación de Venta (cancelSale) y restitución automática de existencias en Kardex (POSITIVE_ADJUSTMENT).
 *  7. Reversión de saldo deudor del cliente tras anulación de venta a crédito.
 *  8. Salvaguarda de idempotencia: Bloqueo de re-anulación de venta cancelada.
 *  9. Devolución parcial de mercancía (processReturn) y reingreso a Kardex (CUSTOMER_RETURN).
 * 10. Validación de integridad en devoluciones: Bloqueo de exceso de unidades y productos ajenos.
 * 11. Devolución total en venta a crédito con cambio a estado RETURNED y deducción de cartera.
 * 12. Trazabilidad inmutable en public.audit_logs para anulaciones, descuentos y devoluciones.
 * 13. Zero Pollution: Purga 100% limpia de registros temporales.
 */

import { Client } from 'pg'
import { createClient } from '@supabase/supabase-js'
import { supabaseClient } from '@/lib/supabase/client'
import { salesService } from '@/features/sales/services/sales.service'
import { SalesUserContext, CreateSaleDTO, SaleReturnDTO } from '@/features/sales/types'

const DATABASE_URL = process.env.DATABASE_URL
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!DATABASE_URL || !SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌ ERROR FATAL: Variables de entorno requeridas no configuradas.')
  process.exit(1)
}

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

interface TestResult {
  code: string
  name: string
  passed: boolean
  details?: string
}

const testResults: TestResult[] = []

function recordResult(code: string, name: string, passed: boolean, details?: string) {
  testResults.push({ code, name, passed, details })
  const icon = passed ? '✅' : '❌'
  console.log(`\n${icon} [${code}] ${name}: ${passed ? 'PASS' : 'FAIL'}`)
  if (details) {
    console.log(`   Detalle: ${details}`)
  }
}

async function runPhase20AdjustmentsE2ETests() {
  console.log('============================================================')
  console.log('INICIANDO SUITE E2E - FASE 20: AJUSTES COMERCIALES')
  console.log('============================================================')

  const pgClient = new Client({ connectionString: DATABASE_URL })
  await pgClient.connect()
  await pgClient.query("SET app.is_test_cleanup = 'true';")
  console.log('\n✅ Conexión directa a PostgreSQL Staging establecida.')

  const testSuffix = Date.now().toString().slice(-6)
  let companyId = ''
  let locPrincipalId = ''
  let customerId = ''
  let categoryId = ''
  let brandId = ''
  let prodAId = ''
  let prodBId = ''
  let authUserId = ''

  let createdSale1Id = ''
  let createdSale1Number = ''
  let createdCreditSaleId = ''
  let createdCreditSaleNumber = ''
  let createdReturnSaleId = ''
  let createdReturnSaleNumber = ''

  try {
    // ------------------------------------------------------------------------
    // SETUP: Empresa, Ubicación, Cliente, Catálogo y Stock Inicial
    // ------------------------------------------------------------------------
    console.log('\n--- Configurando Entorno Comercial y Existencias ---')

    // 1. Empresa
    const compRes = await pgClient.query(`
      INSERT INTO public.companies (
        business_name, trade_name, tax_id, verification_digit, tax_regime,
        address, city, department, country, currency, status, created_at, updated_at
      ) VALUES (
        'Super Más Ajustes ${testSuffix} S.A.S.', 'Super Más Comercial ${testSuffix}', '901555${testSuffix}',
        '1', 'COMUN', 'Calle 20 # 10-20', 'Medellín', 'Antioquia', 'COLOMBIA', 'COP', 'ACTIVE',
        NOW(), NOW()
      ) RETURNING id;
    `)
    companyId = compRes.rows[0].id

    // 2. Ubicación / Bodega
    const locRes = await pgClient.query(`
      INSERT INTO public.locations (
        company_id, code, name, type, status, is_ecommerce_source, address, city, department, created_at, updated_at
      ) VALUES (
        $1, 'BOD-AJ-${testSuffix}', 'Bodega Central Ajustes ${testSuffix}', 'WAREHOUSE', 'ACTIVE', false,
        'Av. 33 # 45-67', 'Medellín', 'Antioquia', NOW(), NOW()
      ) RETURNING id;
    `, [companyId])
    locPrincipalId = locRes.rows[0].id

    // 3. Usuario Auth y Perfil en public.users
    const userEmail = `seller_adj_${testSuffix}@supermas.test`
    const userPass = 'PasswordAdjustments2026*'
    const authRes = await supabaseAdmin.auth.admin.createUser({
      email: userEmail,
      password: userPass,
      email_confirm: true,
      app_metadata: { company_id: companyId, role: 'SELLER' },
    })
    authUserId = authRes.data.user!.id

    const adminRoleId = 'c0000000-0000-0000-0000-000000000001'

    await pgClient.query(`
      INSERT INTO public.users (id, company_id, email, full_name, role_id, is_active, created_at, updated_at)
      VALUES ($1, $2, $3, 'Carlos Vendedor', $4, true, NOW(), NOW())
      ON CONFLICT (id) DO UPDATE SET
        company_id = EXCLUDED.company_id,
        full_name = EXCLUDED.full_name,
        role_id = EXCLUDED.role_id,
        is_active = true;
    `, [authUserId, companyId, userEmail, adminRoleId])

    await pgClient.query(`
      INSERT INTO public.user_locations (user_id, location_id)
      VALUES ($1, $2) ON CONFLICT DO NOTHING;
    `, [authUserId, locPrincipalId])

    // Iniciar sesión con supabaseClient para que tenga la sesión activa del usuario
    const { error: signInErr } = await supabaseClient.auth.signInWithPassword({
      email: userEmail,
      password: userPass,
    })
    if (signInErr) {
      throw new Error(`Error autenticando supabaseClient: ${signInErr.message}`)
    }

    // 4. Cliente con cupo de crédito aprobado
    const custRes = await pgClient.query(`
      INSERT INTO public.customers (
        company_id, document_type, document_number, first_name, last_name,
        company_name, customer_type, customer_category, email, phone, address, city, department,
        credit_limit, current_balance, credit_days, is_active, created_at, updated_at
      ) VALUES (
        $1, 'NIT', '900555${testSuffix}', 'Carlos', 'Restrepo',
        'Restrepo y Cia SAS', 'COMPANY', 'WHOLESALE', 'carlos@restrepo.test', '3128889900',
        'Calle 10 # 40-50', 'Medellín', 'Antioquia', 5000000, 0, 30, true, NOW(), NOW()
      ) RETURNING id;
    `, [companyId])
    customerId = custRes.rows[0].id

    // 5. Categoría y Marca
    const catRes = await pgClient.query(`
      INSERT INTO public.categories (company_id, name, slug, is_active, created_at, updated_at)
      VALUES ($1, 'Abarrotes Ajustes ${testSuffix}', 'abarrotes-ajustes-${testSuffix}', true, NOW(), NOW())
      RETURNING id;
    `, [companyId])
    categoryId = catRes.rows[0].id

    const brandRes = await pgClient.query(`
      INSERT INTO public.brands (company_id, name, slug, is_active, created_at, updated_at)
      VALUES ($1, 'Oli Gourmet ${testSuffix}', 'oli-gourmet-${testSuffix}', true, NOW(), NOW())
      RETURNING id;
    `, [companyId])
    brandId = brandRes.rows[0].id

    // 6. Productos
    // Producto A: Aceite de Oliva 1L (IVA 19%, Precio $50.000, Costo $30.000)
    const p1Res = await pgClient.query(`
      INSERT INTO public.products (
        company_id, sku, barcode, name, slug, category_id, brand_id, inventory_type, unit_of_measure,
        cost_price, public_sale_price, wholesale_price, min_wholesale_quantity, tax_rate_percent,
        is_tax_exempt, is_published_supermas, is_published_distributor, min_stock_threshold,
        critical_stock_threshold, is_active, created_at, updated_at
      ) VALUES (
        $1, 'SKU-OLI-${testSuffix}', '770200${testSuffix}', 'Aceite de Oliva Extra Virgen 1L', 'aceite-oliva-${testSuffix}',
        $2, $3, 'MERCHANDISE', 'BOTELLA', 30000, 50000, 45000, 2, 19, false, true, true, 10, 5, true, NOW(), NOW()
      ) RETURNING id;
    `, [companyId, categoryId, brandId])
    prodAId = p1Res.rows[0].id

    // Producto B: Café Especial Gourmet 500g (Exento IVA 0%, Precio $25.000, Costo $15.000)
    const p2Res = await pgClient.query(`
      INSERT INTO public.products (
        company_id, sku, barcode, name, slug, category_id, brand_id, inventory_type, unit_of_measure,
        cost_price, public_sale_price, wholesale_price, min_wholesale_quantity, tax_rate_percent,
        is_tax_exempt, is_published_supermas, is_published_distributor, min_stock_threshold,
        critical_stock_threshold, is_active, created_at, updated_at
      ) VALUES (
        $1, 'SKU-CAF-${testSuffix}', '770300${testSuffix}', 'Café Especial Gourmet 500g', 'cafe-gourmet-${testSuffix}',
        $2, $3, 'MERCHANDISE', 'BOLSA', 15000, 25000, 22000, 2, 0, true, true, true, 10, 5, true, NOW(), NOW()
      ) RETURNING id;
    `, [companyId, categoryId, brandId])
    prodBId = p2Res.rows[0].id

    // Stock Inicial: 50 unidades de Aceite y 50 unidades de Café
    await pgClient.query(`
      INSERT INTO public.stock_levels (company_id, product_id, location_id, quantity, average_cost, min_stock, health_status, updated_at)
      VALUES
        ($1, $2, $3, 50, 30000, 5, 'AVAILABLE', NOW()),
        ($1, $4, $3, 50, 15000, 5, 'AVAILABLE', NOW());
    `, [companyId, prodAId, locPrincipalId, prodBId])

    console.log('✅ Setup completado: Empresa, Ubicación, Catálogo y Stock fiduciario listos.\n')

    // Contexto de vendedor estándar (límite 10% descuento, sin permiso sales.discount)
    const standardSellerUser: SalesUserContext = {
      userId: authUserId,
      userName: `Carlos Vendedor ${testSuffix}`,
      userRole: 'SELLER',
      maxAllowedDiscountPercent: 10,
      permissions: ['sales.read', 'sales.create', 'sales.cancel', 'sales.return'],
    }

    // Contexto de supervisor comercial (permiso explícito sales.discount)
    const supervisorUser: SalesUserContext = {
      userId: authUserId,
      userName: `Supervisor Comercial ${testSuffix}`,
      userRole: 'ADMIN',
      maxAllowedDiscountPercent: 30,
      permissions: ['sales.read', 'sales.create', 'sales.cancel', 'sales.discount', 'sales.return'],
    }

    // ========================================================================
    // T01: Venta con Descuento Estándar Dentro del Límite Autorizado (5% <= 10%)
    // ========================================================================
    const saleDto1: CreateSaleDTO = {
      customerId,
      locationId: locPrincipalId,
      paymentMethod: 'EFECTIVO',
      documentTypeToGenerate: 'FACTURA_POS',
      notes: 'Venta con descuento de fidelidad autorizado.',
      items: [
        {
          productId: prodAId,
          quantity: 2,
          discountPercent: 5, // 5% permitido (límite es 10%)
        },
      ],
    }

    const sale1 = await salesService.create(saleDto1, standardSellerUser)
    createdSale1Id = sale1.id
    createdSale1Number = sale1.saleNumber

    // Verificar en BD
    const checkSale1 = await pgClient.query(
      `SELECT id, sale_number, subtotal_amount, discount_amount, tax_amount, total_amount, status
       FROM public.sales WHERE id = $1;`,
      [createdSale1Id]
    )

    const t01Pass =
      checkSale1.rows.length === 1 &&
      checkSale1.rows[0].sale_number === createdSale1Number &&
      Number(checkSale1.rows[0].total_amount) > 0 &&
      sale1.items[0].discountPercent === 5

    recordResult(
      'T01',
      'Venta con Descuento Estándar Dentro del Límite Autorizado (5% <= 10%)',
      t01Pass,
      t01Pass
        ? `Venta ${createdSale1Number} creada con 5% de descuento sin requerir elevación de permisos.`
        : `Falla al crear venta con descuento autorizado.`
    )

    // ========================================================================
    // T02: Bloqueo de Venta con Descuento Superior al Límite sin Permiso Supervisor
    // ========================================================================
    let t02Blocked = false
    let t02ErrorMsg = ''
    try {
      await salesService.create(
        {
          customerId,
          locationId: locPrincipalId,
          paymentMethod: 'EFECTIVO',
          items: [
            {
              productId: prodAId,
              quantity: 1,
              discountPercent: 15, // 15% excede el límite del 10%
            },
          ],
        },
        standardSellerUser
      )
    } catch (err: any) {
      t02Blocked = true
      t02ErrorMsg = err.message
    }

    const t02Pass = t02Blocked && t02ErrorMsg.includes('excede su límite permitido')
    recordResult(
      'T02',
      'Bloqueo de Venta con Descuento Superior al Límite sin Autorización',
      t02Pass,
      t02Pass
        ? `Descuento del 15% bloqueado oportunamente: "${t02ErrorMsg}"`
        : `Falla: Se permitió aplicar descuento no autorizado.`
    )

    // ========================================================================
    // T03: Aprobación de Descuento Especial por Supervisor (sales.discount)
    // ========================================================================
    const supervisorSale = await salesService.create(
      {
        customerId,
        locationId: locPrincipalId,
        paymentMethod: 'EFECTIVO',
        items: [
          {
            productId: prodBId,
            quantity: 1,
            discountPercent: 20, // 20% autorizado por supervisor
          },
        ],
      },
      supervisorUser
    )

    const t03Pass = supervisorSale && supervisorSale.items[0].discountPercent === 20
    recordResult(
      'T03',
      'Aprobación de Descuento Especial por Supervisor (sales.discount)',
      t03Pass,
      t03Pass
        ? `Supervisor autorizó y aplicó 20% de descuento exitosamente en venta ${supervisorSale.saleNumber}.`
        : `Falla en autorización de descuento supervisor.`
    )

    // ========================================================================
    // T04: Recálculo Financiero Fiduciario en Servidor (Precios, Impuestos, Totales)
    // ========================================================================
    // Producto A: 2 unidades @ $50.000 = $100.000 bruto.
    // Descuento 5% = $5.000 -> Base gravable = $95.000.
    // IVA 19% de $95.000 = $18.050.
    // Total = $95.000 + $18.050 = $113.050.
    const subtotal = Number(checkSale1.rows[0].subtotal_amount)
    const discount = Number(checkSale1.rows[0].discount_amount)
    const tax = Number(checkSale1.rows[0].tax_amount)
    const total = Number(checkSale1.rows[0].total_amount)

    const t04Pass =
      subtotal === 95000 &&
      discount === 5000 &&
      tax === 18050 &&
      total === 113050

    recordResult(
      'T04',
      'Recálculo Financiero Fiduciario en Servidor (Subtotal, Descuento, IVA 19%, Total)',
      t04Pass,
      t04Pass
        ? `Valores exactos: Subtotal=$${subtotal}, Descuento=$${discount}, IVA=$${tax}, Total=$${total} COP.`
        : `Falla en cálculo financiero: Subtotal=${subtotal}, Desc=${discount}, Tax=${tax}, Total=${total}.`
    )

    // ========================================================================
    // T05: Venta a Crédito y Registro de Saldo Deudor en Cliente
    // ========================================================================
    // 2 Café Especial Gourmet @ $25.000 = $50.000 (Exento IVA).
    const creditSale = await salesService.create(
      {
        customerId,
        locationId: locPrincipalId,
        paymentMethod: 'CREDITO',
        documentTypeToGenerate: 'FACTURA_POS',
        notes: 'Venta a crédito 30 días para Restrepo y Cia SAS.',
        items: [
          {
            productId: prodBId,
            quantity: 2,
            discountPercent: 0,
          },
        ],
      },
      standardSellerUser
    )

    createdCreditSaleId = creditSale.id
    createdCreditSaleNumber = creditSale.saleNumber

    // Verificar saldo del cliente en public.customers
    const checkCustomerBalPostCredit = await pgClient.query(
      `SELECT current_balance FROM public.customers WHERE id = $1;`,
      [customerId]
    )
    const currentCustomerBalance = Number(checkCustomerBalPostCredit.rows[0].current_balance)

    const t05Pass =
      creditSale.paymentMethod === 'CREDITO' &&
      creditSale.totalAmount === 50000 &&
      currentCustomerBalance === 50000

    recordResult(
      'T05',
      'Venta a Crédito y Registro de Saldo Deudor en Cliente',
      t05Pass,
      t05Pass
        ? `Venta a crédito ${createdCreditSaleNumber} ($50.000 COP) incrementó cartera del cliente a $${currentCustomerBalance} COP.`
        : `Falla: Cartera no actualizada. Esperado: $50.000, Actual: $${currentCustomerBalance}.`
    )

    // ========================================================================
    // T06: Anulación de Venta (cancelSale) y Reversión Automática en Kardex
    // ========================================================================
    // Anulamos la Venta 1 (Aceite de Oliva, 2 unidades).
    // Antes de anular, el stock era 50 - 2 = 48.
    const cancelResult = await salesService.cancelSale(
      {
        saleId: createdSale1Id,
        reason: 'Error en orden de pedido y cancelación por parte del cliente.',
      },
      standardSellerUser
    )

    // Verificar estado CANCELLED en sales
    const checkSale1Cancelled = await pgClient.query(
      `SELECT status, notes FROM public.sales WHERE id = $1;`,
      [createdSale1Id]
    )

    // Verificar reposición de stock en stock_levels (debe volver a 50)
    const checkStockPostCancel = await pgClient.query(
      `SELECT quantity FROM public.stock_levels
       WHERE company_id = $1 AND product_id = $2 AND location_id = $3;`,
      [companyId, prodAId, locPrincipalId]
    )

    // Verificar movimiento de Kardex POSITIVE_ADJUSTMENT
    const checkKardexCancel = await pgClient.query(
      `SELECT movement_type, quantity_in, document_type, document_reference
       FROM public.inventory_movements
       WHERE company_id = $1 AND product_id = $2 AND movement_type = 'POSITIVE_ADJUSTMENT'
       ORDER BY created_at DESC LIMIT 1;`,
      [companyId, prodAId]
    )

    const t06Pass =
      cancelResult.status === 'CANCELLED' &&
      checkSale1Cancelled.rows[0].status === 'CANCELLED' &&
      Number(checkStockPostCancel.rows[0].quantity) === 50 &&
      checkKardexCancel.rows.length === 1 &&
      Number(checkKardexCancel.rows[0].quantity_in) === 2

    recordResult(
      'T06',
      'Anulación de Venta (cancelSale) y Reversión Automática en Kardex',
      t06Pass,
      t06Pass
        ? `Venta ${createdSale1Number} anulada. Stock de Aceite restituido a 50 unidades vía Kardex POSITIVE_ADJUSTMENT.`
        : `Falla en anulación o restitución de existencias en Kardex.`
    )

    // ========================================================================
    // T07: Reversión de Saldo Deudor del Cliente tras Anulación de Venta a Crédito
    // ========================================================================
    // Anulamos la venta a crédito de Café ($50.000 COP).
    // El saldo del cliente debe volver de $50.000 a $0 COP.
    await salesService.cancelSale(
      {
        saleId: createdCreditSaleId,
        reason: 'Devolución del pedido a crédito no despachado.',
      },
      standardSellerUser
    )

    const checkCustBalPostCancelCredit = await pgClient.query(
      `SELECT current_balance FROM public.customers WHERE id = $1;`,
      [customerId]
    )
    const balanceAfterCancel = Number(checkCustBalPostCancelCredit.rows[0].current_balance)

    const t07Pass = balanceAfterCancel === 0
    recordResult(
      'T07',
      'Reversión de Saldo Deudor del Cliente tras Anulación de Venta a Crédito',
      t07Pass,
      t07Pass
        ? `Saldo deudor del cliente revertido exitosamente de $50.000 a $0 COP tras anulación.`
        : `Falla: Saldo del cliente no se revertió (saldo actual: $${balanceAfterCancel}).`
    )

    // ========================================================================
    // T08: Salvaguarda de Idempotencia: Bloqueo de Re-Anulación
    // ========================================================================
    let t08Blocked = false
    let t08ErrorMsg = ''
    try {
      await salesService.cancelSale(
        {
          saleId: createdSale1Id,
          reason: 'Intento de anulación duplicada.',
        },
        standardSellerUser
      )
    } catch (err: any) {
      t08Blocked = true
      t08ErrorMsg = err.message
    }

    const t08Pass = t08Blocked && t08ErrorMsg.includes('ya se encuentra anulada')
    recordResult(
      'T08',
      'Salvaguarda de Idempotencia: Bloqueo de Re-Anulación de Venta Cancelada',
      t08Pass,
      t08Pass
        ? `Idempotencia garantizada: Re-anulación rechazada con mensaje: "${t08ErrorMsg}".`
        : `Falla: Se permitió duplicar la anulación de la venta.`
    )

    // ========================================================================
    // T09: Devolución Parcial de Mercancía (processReturn) y Reingreso a Kardex
    // ========================================================================
    // Creamos una nueva venta: 10 unidades de Aceite de Oliva ($50.000 c/u)
    const returnSale = await salesService.create(
      {
        customerId,
        locationId: locPrincipalId,
        paymentMethod: 'EFECTIVO',
        items: [
          {
            productId: prodAId,
            quantity: 10,
            discountPercent: 0,
          },
        ],
      },
      standardSellerUser
    )

    createdReturnSaleId = returnSale.id
    createdReturnSaleNumber = returnSale.saleNumber

    // Stock tras venta: 50 - 10 = 40.
    // Cliente devuelve 3 unidades por inconformidad de empaque.
    const partialReturnDto: SaleReturnDTO = {
      saleId: createdReturnSaleId,
      reason: 'Empaque de 3 botellas maltratado en transporte.',
      items: [
        {
          productId: prodAId,
          quantity: 3,
          reason: 'Empaque abollado',
        },
      ],
    }

    const returnedSaleObj = await salesService.processReturn(partialReturnDto, standardSellerUser)

    // Verificar en Kardex que se haya registrado CUSTOMER_RETURN por 3 unidades
    const checkKardexReturn = await pgClient.query(
      `SELECT movement_type, quantity_in, document_reference, reason
       FROM public.inventory_movements
       WHERE company_id = $1 AND product_id = $2 AND movement_type = 'CUSTOMER_RETURN'
       ORDER BY created_at DESC LIMIT 1;`,
      [companyId, prodAId]
    )

    // Verificar que el stock subió de 40 a 43
    const checkStockPostReturn = await pgClient.query(
      `SELECT quantity FROM public.stock_levels
       WHERE company_id = $1 AND product_id = $2 AND location_id = $3;`,
      [companyId, prodAId, locPrincipalId]
    )

    const t09Pass =
      checkKardexReturn.rows.length === 1 &&
      Number(checkKardexReturn.rows[0].quantity_in) === 3 &&
      Number(checkStockPostReturn.rows[0].quantity) === 43 &&
      returnedSaleObj.notes?.includes('Devolución procesada (3 uds)')

    recordResult(
      'T09',
      'Devolución Parcial de Mercancía (processReturn) y Reingreso a Kardex',
      t09Pass,
      t09Pass
        ? `Devolución de 3 unidades procesada. Kardex CUSTOMER_RETURN registrado y stock repuesto a 43 unidades.`
        : `Falla en procesamiento de devolución parcial en Kardex.`
    )

    // ========================================================================
    // T10: Validación de Integridad en Devoluciones (Bloqueo de Exceso y Productos Ajenos)
    // ========================================================================
    let t10ExceededBlocked = false
    let t10ForeignBlocked = false

    // 1. Exceso: intentar devolver 20 unidades cuando solo se compraron 10
    try {
      await salesService.processReturn(
        {
          saleId: createdReturnSaleId,
          reason: 'Devolución excesiva',
          items: [{ productId: prodAId, quantity: 20, reason: 'Exceso' }],
        },
        standardSellerUser
      )
    } catch (e: any) {
      t10ExceededBlocked = e.message.includes('no puede superar la cantidad vendida')
    }

    // 2. Producto ajeno: intentar devolver Café en una venta donde solo había Aceite
    try {
      await salesService.processReturn(
        {
          saleId: createdReturnSaleId,
          reason: 'Producto que no estaba en la venta',
          items: [{ productId: prodBId, quantity: 1, reason: 'Ajeno' }],
        },
        standardSellerUser
      )
    } catch (e: any) {
      t10ForeignBlocked = e.message.includes('no pertenece a la venta original')
    }

    const t10Pass = t10ExceededBlocked && t10ForeignBlocked
    recordResult(
      'T10',
      'Validación de Integridad en Devoluciones (Bloqueo de Exceso y Productos Ajenos)',
      t10Pass,
      t10Pass
        ? `Integridad blindada: Bloqueados con éxito intentos de devolución excedida y de productos ajenos.`
        : `Falla en validaciones de integridad de devoluciones.`
    )

    // ========================================================================
    // T11: Devolución Total de Venta a Crédito con Cambio a Estado RETURNED y Cartera
    // ========================================================================
    // Venta a crédito de 2 Cafés ($50.000 COP)
    const fullCreditSale = await salesService.create(
      {
        customerId,
        locationId: locPrincipalId,
        paymentMethod: 'CREDITO',
        items: [{ productId: prodBId, quantity: 2, discountPercent: 0 }],
      },
      standardSellerUser
    )

    // Devolución de las 2 unidades completas
    const fullReturnResult = await salesService.processReturn(
      {
        saleId: fullCreditSale.id,
        reason: 'Devolución total por no conformidad de lote.',
        items: [{ productId: prodBId, quantity: 2, reason: 'Lote no conforme' }],
      },
      standardSellerUser
    )

    // Verificar estado RETURNED en public.sales
    const checkSaleFullReturned = await pgClient.query(
      `SELECT status FROM public.sales WHERE id = $1;`,
      [fullCreditSale.id]
    )

    // Verificar saldo del cliente en public.customers (debe ser 0)
    const checkCustBalAfterFullReturn = await pgClient.query(
      `SELECT current_balance FROM public.customers WHERE id = $1;`,
      [customerId]
    )

    const t11Pass =
      fullReturnResult.status === 'RETURNED' &&
      checkSaleFullReturned.rows[0].status === 'RETURNED' &&
      Number(checkCustBalAfterFullReturn.rows[0].current_balance) === 0

    recordResult(
      'T11',
      'Devolución Total de Venta a Crédito con Estado RETURNED y Ajuste de Cartera',
      t11Pass,
      t11Pass
        ? `Devolución total confirmada. Venta marcada RETURNED y saldo deudor ajustado a $0 COP.`
        : `Falla en devolución total de venta a crédito.`
    )

    // ========================================================================
    // T12: Trazabilidad Inmutable en public.audit_logs
    // ========================================================================
    const auditQuery = await pgClient.query(
      `SELECT action, user_name, entity_name FROM public.audit_logs
       WHERE company_id = $1 OR user_name LIKE $2
       ORDER BY created_at DESC;`,
      [companyId, `%${testSuffix}%`]
    )

    const recordedActions = auditQuery.rows.map((r) => r.action)
    const hasSaleCreation = recordedActions.some((a) => a.includes('CREACIÓN') || a.includes('VENTA'))
    const hasSaleCancel = recordedActions.some((a) => a.includes('ANULACIÓN') || a.includes('CANCEL'))
    const hasSaleReturn = recordedActions.some((a) => a.includes('DEVOLUCIÓN') || a.includes('RETURN'))

    const t12Pass = hasSaleCreation && hasSaleCancel && hasSaleReturn
    recordResult(
      'T12',
      'Trazabilidad Inmutable en public.audit_logs para Creación, Anulación y Devolución',
      t12Pass,
      t12Pass
        ? `Registrados ${auditQuery.rows.length} eventos de auditoría (Creación, Anulación y Devolución verificados).`
        : `Falla en registro de auditoría. Acciones registradas: ${recordedActions.join(', ')}.`
    )
  } catch (err: any) {
    console.error('❌ Error catastrófico en suite E2E de Ajustes Comerciales:', err)
  } finally {
    // ========================================================================
    // T13: Zero Pollution: Purga Atómica 100% Limpia de Registros de Prueba
    // ========================================================================
    console.log('\n--- Ejecutando Purga Zero Pollution en Ajustes Comerciales ---')
    try {
      // Activar flag de prueba para omitir restricción inmutable de Kardex y Ventas
      await pgClient.query("SET app.is_test_cleanup = 'true';")

      // Purga incondicional por company_id para prevenir violaciones FK
      await pgClient.query(`DELETE FROM public.sale_items WHERE company_id = $1;`, [companyId])
      await pgClient.query(`DELETE FROM public.sales WHERE company_id = $1;`, [companyId])

      await pgClient.query(`DELETE FROM public.inventory_movements WHERE company_id = $1;`, [companyId])
      await pgClient.query(`DELETE FROM public.stock_levels WHERE company_id = $1;`, [companyId])
      await pgClient.query(`DELETE FROM public.products WHERE company_id = $1;`, [companyId])
      await pgClient.query(`DELETE FROM public.categories WHERE company_id = $1;`, [companyId])
      await pgClient.query(`DELETE FROM public.brands WHERE company_id = $1;`, [companyId])
      await pgClient.query(`DELETE FROM public.customers WHERE company_id = $1;`, [companyId])
      await pgClient.query(`DELETE FROM public.user_locations WHERE user_id = $1;`, [authUserId])
      await pgClient.query(`DELETE FROM public.users WHERE company_id = $1;`, [companyId])
      await pgClient.query(`DELETE FROM public.locations WHERE company_id = $1;`, [companyId])
      await pgClient.query(`DELETE FROM public.audit_logs WHERE company_id = $1 OR user_name LIKE $2;`, [companyId, `%${testSuffix}%`])
      await pgClient.query(`DELETE FROM public.companies WHERE id = $1;`, [companyId])

      if (authUserId) {
        await supabaseAdmin.auth.admin.deleteUser(authUserId)
      }

      // Verificación de cero residuos
      const checkRemnantsSales = await pgClient.query(`SELECT count(*) FROM public.sales WHERE company_id = $1;`, [companyId])
      const checkRemnantsKardex = await pgClient.query(`SELECT count(*) FROM public.inventory_movements WHERE company_id = $1;`, [companyId])
      const checkRemnantsComp = await pgClient.query(`SELECT count(*) FROM public.companies WHERE id = $1;`, [companyId])

      const cleanPass =
        Number(checkRemnantsSales.rows[0].count) === 0 &&
        Number(checkRemnantsKardex.rows[0].count) === 0 &&
        Number(checkRemnantsComp.rows[0].count) === 0

      recordResult(
        'T13',
        'Zero Pollution: Purga 100% limpia de Ventas, Kardex, Clientes y Catálogo',
        cleanPass,
        cleanPass
          ? `Todos los registros de prueba purgados atómicamente. Base de datos 100% libre de contaminación.`
          : `Advertencia: Se detectaron registros residuales tras la purga.`
      )
    } catch (cleanupErr: any) {
      console.error('Error durante la purga Zero Pollution:', cleanupErr)
    } finally {
      await pgClient.end()
    }
  }

  // --------------------------------------------------------------------------
  // RESUMEN FINAL
  // --------------------------------------------------------------------------
  console.log('\n============================================================')
  console.log('RESUMEN DE EJECUCIÓN - FASE 20: AJUSTES COMERCIALES')
  console.log('============================================================')
  const totalTests = testResults.length
  const passedTests = testResults.filter((t) => t.passed).length
  const failedTests = totalTests - passedTests

  testResults.forEach((t) => {
    console.log(`${t.passed ? '✅' : '❌'} [${t.code}] ${t.name}`)
  })

  console.log('============================================================')
  console.log(`TOTAL: ${totalTests} | PASARON: ${passedTests} | FALLARON: ${failedTests}`)
  console.log('============================================================\n')

  if (failedTests > 0) {
    process.exit(1)
  }
}

runPhase20AdjustmentsE2ETests().catch((err) => {
  console.error('Error no controlado en suite E2E Fase 20:', err)
  process.exit(1)
})
