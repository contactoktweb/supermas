/**
 * ==============================================================================
 * SUITE DE INTEGRACIÓN TYPESCRIPT REAL — FASE 5.1 / PASO 2
 * ERP SUPER MÁS S.A.S. — Supabase PostgreSQL (Staging)
 * ==============================================================================
 *
 * Flujo validado en cada prueba:
 *   PurchaseService -> PurchaseRepository -> supabaseClient.rpc() -> PostgreSQL
 *
 * Pruebas de integración:
 *   TS01 — createPurchase() en modo BORRADOR mediante PurchaseService
 *   TS02 — Consecutivo COM-XXXXXX correlativo generado por PostgreSQL
 *   TS03 — updatePurchase() de orden en BORRADOR mediante PurchaseService
 *   TS04 — confirmOrder() mediante PurchaseService con auth.uid() real
 *   TS05 — Confirmar orden NO genera movimientos en inventory_movements (Kardex)
 *   TS06 — Rechazar updatePurchase() sobre orden CONFIRMADA
 *   TS07 — cancelPurchase() mediante PurchaseService con motivo obligatorio
 *   TS08 — Rechazar cancelPurchase() si la orden tuviera mercancía recibida
 *   TS09 — Rechazar proveedor de otra empresa (Cross-tenant) en PurchaseService
 *   TS10 — Rechazar producto de otra empresa (Cross-tenant) en PurchaseService
 *   TS11 — Rechazar quantity <= 0 (Validación Zod / Service / DB)
 *   TS12 — Rechazar unit_cost < 0 (Validación Zod / Service / DB)
 *   TS13 — Aislamiento Multi-Tenant: User B no puede leer compras de Empresa A
 *   TS14 — Aislamiento Multi-Tenant: User B crea orden con consecutivo independiente
 *   TS15 — Aislamiento Multi-Tenant: User B no puede usar proveedor de Empresa A
 *   TS16 — Purga Zero Pollution comprobada al 100% en PostgreSQL Staging
 */

import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { Client } from 'pg'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { supabaseClient } from '../lib/supabase/client'
import { PurchaseRepository } from '../features/purchases/repositories/purchase.repository'
import { PurchaseService } from '../features/purchases/services/purchase.service'
import { CreatePurchaseInput, UpdatePurchaseInput, UserPermissionContext } from '../features/purchases/types'

interface TestResult {
  code: string
  name: string
  status: 'PASS' | 'FAIL'
  details: string
}

const results: TestResult[] = []

function recordResult(code: string, name: string, pass: boolean, details: string) {
  const status = pass ? 'PASS' : 'FAIL'
  results.push({ code, name, status, details })
  const icon = pass ? '✅' : '❌'
  console.log(`${icon} [${code}] ${name}: ${status}`)
  console.log(`   Detalle: ${details}
`)
}

async function runTypeScriptIntegrationSuite() {
  console.log('================================================================================')
  console.log('🧪 SUITE DE INTEGRACIÓN TYPESCRIPT REAL — FASE 5.1 / PASO 2')
  console.log('   PurchaseService -> PurchaseRepository -> Supabase RPC -> PostgreSQL')
  console.log('================================================================================\n')

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  const connStr = process.env.DATABASE_URL || process.env.DIRECT_URL

  // Cliente PostgreSQL exclusivo para Setup y Assertions
  const pgClient = new Client({
    connectionString: connStr,
    ssl: { rejectUnauthorized: false },
  })
  await pgClient.connect()
  console.log('✅ Conexión administrativa directa a PostgreSQL Staging establecida (Setup & Assertions).\n')

  const adminSupabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const runId = Date.now().toString().slice(-6)
  const tag = `TS-INT-${runId}`

  let companyAId = ''
  let companyBId = ''
  let locAId = ''
  let locBId = ''

  let authUserAId = ''
  let authUserBId = ''

  const userAEmail = `admin_ts_a_${runId}@supermas.test`
  const userBEmail = `admin_ts_b_${runId}@supermas.test`
  const testPassword = `TSInt*${runId}P51!`

  let categoryAId = ''
  let categoryBId = ''
  let supplierAId = ''
  let supplierBId = ''
  let productA1Id = ''
  let productA2Id = ''
  let productB1Id = ''

  let createdOrder1Id = ''
  let createdOrder2Id = ''
  let cancelOrder3Id = ''

  let serviceA: PurchaseService
  let serviceB: PurchaseService
  let userBClient: SupabaseClient

  try {
    // -------------------------------------------------------------------------
    // SETUP BASE MULTI-TENANT & ENTIDADES EN STAGING (SOLO PG PARA PREPARAR DATOS)
    // -------------------------------------------------------------------------
    console.log('--- SETUP ENTIDADES STAGING ---')

    const compA = await pgClient.query("SELECT id FROM public.companies WHERE status = 'ACTIVE' ORDER BY created_at ASC LIMIT 1;")
    if (compA.rows.length === 0) throw new Error('No hay empresas activas en staging.')
    companyAId = compA.rows[0].id

    // Empresa B para pruebas de aislamiento multiempresa
    const compBRes = await pgClient.query(`
      INSERT INTO public.companies (
        business_name, trade_name, tax_id, verification_digit, tax_regime,
        address, city, department, country, phone, email, invoice_email, status
      ) VALUES (
        'Empresa B Integración ${tag}', 'Distribuidora B TS', '900777${runId}', '3', 'RESPONSABLE_DE_IVA',
        'Carrera 15 # 80-10', 'Bogotá', 'Bogotá D.C.', 'Colombia', '3157778899',
        'compb_ts_${runId}@supermas.test', 'fact_ts_${runId}@supermas.test', 'ACTIVE'
      ) RETURNING id;
    `)
    companyBId = compBRes.rows[0].id

    // Bodega Sede A con allow_purchases = true
    const locARes = await pgClient.query(
      "SELECT id FROM public.locations WHERE company_id = $1 AND status = 'ACTIVE' AND allow_purchases = true LIMIT 1;",
      [companyAId]
    )
    if (locARes.rows.length === 0) throw new Error('No hay bodegas con allow_purchases activas en Empresa A.')
    locAId = locARes.rows[0].id

    // Bodega Sede B
    const locBRes = await pgClient.query(`
      INSERT INTO public.locations (
        company_id, code, name, type, address, city, department, allow_purchases, status
      ) VALUES (
        $1, 'LOC-TS-B-${runId}', 'Bodega Empresa B ${tag}', 'WAREHOUSE',
        'Calle 45 # 20-30', 'Bogotá', 'Bogotá D.C.', true, 'ACTIVE'
      ) RETURNING id;
    `, [companyBId])
    locBId = locBRes.rows[0].id

    // Rol SuperAdmin
    const rSuperAdmin = await pgClient.query("SELECT id FROM public.roles WHERE code = 'SUPERADMIN' LIMIT 1;")
    const roleSuperAdminId = rSuperAdmin.rows[0]?.id

    // Categorías
    const catRes = await pgClient.query(`
      INSERT INTO public.categories (
        company_id, code, name, slug, is_active, sort_order
      ) VALUES (
        $1, 'CAT-TS-A-${runId}', 'Categoría A ${tag}', 'cat-ts-a-${runId}', true, 0
      ) RETURNING id;
    `, [companyAId])
    categoryAId = catRes.rows[0].id

    const catBRes = await pgClient.query(`
      INSERT INTO public.categories (
        company_id, code, name, slug, is_active, sort_order
      ) VALUES (
        $1, 'CAT-TS-B-${runId}', 'Categoría B ${tag}', 'cat-ts-b-${runId}', true, 0
      ) RETURNING id;
    `, [companyBId])
    categoryBId = catBRes.rows[0].id

    // Proveedores
    const suppARes = await pgClient.query(`
      INSERT INTO public.suppliers (
        company_id, tax_id, verification_digit, name, legal_name, person_type,
        contact_name, email, phone, city, payment_terms_days, credit_limit, is_active
      ) VALUES (
        $1, '900333${runId}', '8', 'Distribuidora Láctea del Valle ${tag}', 'Distribuidora Láctea del Valle S.A.S.', 'JURIDICA',
        'Carlos Gómez', 'lactea_ts_${runId}@supermas.test', '3001234567', 'Cali', 30, 0, true
      ) RETURNING id;
    `, [companyAId])
    supplierAId = suppARes.rows[0].id

    const suppBRes = await pgClient.query(`
      INSERT INTO public.suppliers (
        company_id, tax_id, verification_digit, name, legal_name, person_type,
        contact_name, email, phone, city, payment_terms_days, credit_limit, is_active
      ) VALUES (
        $1, '900444${runId}', '2', 'Mayorista Central B ${tag}', 'Mayorista Central B S.A.S.', 'JURIDICA',
        'Elena Rojas', 'mayorista_ts_${runId}@supermas.test', '3187654321', 'Bogotá', 30, 0, true
      ) RETURNING id;
    `, [companyBId])
    supplierBId = suppBRes.rows[0].id

    // Productos
    const prodA1Res = await pgClient.query(`
      INSERT INTO public.products (
        company_id, category_id, sku, name, slug, unit_of_measure,
        cost_price, public_sale_price, wholesale_price, min_wholesale_quantity,
        tax_rate_percent, is_tax_exempt, min_stock_threshold, critical_stock_threshold,
        inventory_type, is_active, is_published_supermas, is_published_distributor
      ) VALUES (
        $1, $2, 'SKU-TS-A1-${runId}', 'Queso Campesino 500g ${tag}', 'queso-campesino-${runId}', 'UND',
        12000.00, 16000.00, 14500.00, 10,
        19.00, false, 5, 2,
        'STANDARD', true, false, false
      ) RETURNING id;
    `, [companyAId, categoryAId])
    productA1Id = prodA1Res.rows[0].id

    const prodA2Res = await pgClient.query(`
      INSERT INTO public.products (
        company_id, category_id, sku, name, slug, unit_of_measure,
        cost_price, public_sale_price, wholesale_price, min_wholesale_quantity,
        tax_rate_percent, is_tax_exempt, min_stock_threshold, critical_stock_threshold,
        inventory_type, is_active, is_published_supermas, is_published_distributor
      ) VALUES (
        $1, $2, 'SKU-TS-A2-${runId}', 'Mantequilla 250g ${tag}', 'mantequilla-${runId}', 'UND',
        6500.00, 9000.00, 8000.00, 12,
        19.00, false, 5, 2,
        'STANDARD', true, false, false
      ) RETURNING id;
    `, [companyAId, categoryAId])
    productA2Id = prodA2Res.rows[0].id

    const prodB1Res = await pgClient.query(`
      INSERT INTO public.products (
        company_id, category_id, sku, name, slug, unit_of_measure,
        cost_price, public_sale_price, wholesale_price, min_wholesale_quantity,
        tax_rate_percent, is_tax_exempt, min_stock_threshold, critical_stock_threshold,
        inventory_type, is_active, is_published_supermas, is_published_distributor
      ) VALUES (
        $1, $2, 'SKU-TS-B1-${runId}', 'Aceite de Palma 1L B ${tag}', 'aceite-palma-${runId}', 'UND',
        7000.00, 9500.00, 8500.00, 12,
        5.00, false, 5, 2,
        'STANDARD', true, false, false
      ) RETURNING id;
    `, [companyBId, categoryBId])
    productB1Id = prodB1Res.rows[0].id

    // Crear usuarios de Supabase Auth
    console.log('--- CREANDO USUARIOS REALES EN SUPABASE AUTH ---\n')
    const userACreated = await adminSupabase.auth.admin.createUser({
      email: userAEmail,
      password: testPassword,
      email_confirm: true,
      user_metadata: { full_name: `Admin TS A ${tag}` },
    })
    if (userACreated.error) throw userACreated.error
    authUserAId = userACreated.data.user.id

    await pgClient.query(`
      INSERT INTO public.users (id, company_id, role_id, email, full_name, is_active)
      VALUES ($1, $2, $3, $4, $5, true)
      ON CONFLICT (id) DO UPDATE SET company_id = EXCLUDED.company_id, role_id = EXCLUDED.role_id, full_name = EXCLUDED.full_name;
    `, [authUserAId, companyAId, roleSuperAdminId, userAEmail, `Admin TS A ${tag}`])

    await pgClient.query(`
      INSERT INTO public.user_locations (user_id, location_id, is_primary)
      VALUES ($1, $2, true)
      ON CONFLICT (user_id, location_id) DO NOTHING;
    `, [authUserAId, locAId])

    const userBCreated = await adminSupabase.auth.admin.createUser({
      email: userBEmail,
      password: testPassword,
      email_confirm: true,
      user_metadata: { full_name: `Admin TS B ${tag}` },
    })
    if (userBCreated.error) throw userBCreated.error
    authUserBId = userBCreated.data.user.id

    await pgClient.query(`
      INSERT INTO public.users (id, company_id, role_id, email, full_name, is_active)
      VALUES ($1, $2, $3, $4, $5, true)
      ON CONFLICT (id) DO UPDATE SET company_id = EXCLUDED.company_id, role_id = EXCLUDED.role_id, full_name = EXCLUDED.full_name;
    `, [authUserBId, companyBId, roleSuperAdminId, userBEmail, `Admin TS B ${tag}`])

    await pgClient.query(`
      INSERT INTO public.user_locations (user_id, location_id, is_primary)
      VALUES ($1, $2, true)
      ON CONFLICT (user_id, location_id) DO NOTHING;
    `, [authUserBId, locBId])

    console.log('✅ Entidades y Usuarios Auth creados.\n')

    // -------------------------------------------------------------------------
    // AUTENTICACIÓN REAL EN SUPABASE CLIENT (NODE SESSION)
    // -------------------------------------------------------------------------
    console.log('--- AUTENTICANDO CLIENTES SUPABASE REALES ---')

    // 1. Cliente A: se autentica en la instancia singleton supabaseClient
    const { data: signInA, error: errSignInA } = await supabaseClient.auth.signInWithPassword({
      email: userAEmail,
      password: testPassword,
    })
    if (errSignInA || !signInA.session) {
      throw new Error(`Fallo en autenticación de Usuario A: ${errSignInA?.message}`)
    }
    console.log(`✅ Usuario A autenticado en supabaseClient: ${signInA.user.email} (UID: ${signInA.user.id})`)

    const repoA = new PurchaseRepository(supabaseClient)
    serviceA = new PurchaseService(repoA)

    // 2. Cliente B: instancia separada para simular Tenant B
    userBClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data: signInB, error: errSignInB } = await userBClient.auth.signInWithPassword({
      email: userBEmail,
      password: testPassword,
    })
    if (errSignInB || !signInB.session) {
      throw new Error(`Fallo en autenticación de Usuario B: ${errSignInB?.message}`)
    }
    console.log(`✅ Usuario B autenticado en userBClient: ${signInB.user.email} (UID: ${signInB.user.id})
`)

    const repoB = new PurchaseRepository(userBClient)
    serviceB = new PurchaseService(repoB)

    const userContextA: UserPermissionContext = {
      userId: authUserAId,
      userName: `Admin TS A ${tag}`,
      userRole: 'SUPERADMIN',
      permissions: ['purchases.create', 'purchases.read'],
    }

    const userContextB: UserPermissionContext = {
      userId: authUserBId,
      userName: `Admin TS B ${tag}`,
      userRole: 'SUPERADMIN',
      permissions: ['purchases.create', 'purchases.read'],
    }

    // =========================================================================
    // PRUEBAS DE INTEGRACIÓN TYPESCRIPT
    // =========================================================================

    // -------------------------------------------------------------------------
    // TS01 — createPurchase() mediante PurchaseService
    // -------------------------------------------------------------------------
    console.log('--- EJECUTANDO TS01: createPurchase() MEDIANTE PURCHASE SERVICE ---')
    let ts01Pass = false
    let ts01Details = ''
    try {
      const payload: CreatePurchaseInput = {
        supplierId: supplierAId,
        destinationLocationId: locAId,
        supplierInvoiceNumber: `FAC-TS-01-${runId}`,
        date: '2026-10-02',
        dueDate: '2026-11-01',
        paymentType: 'CREDITO',
        notes: 'Orden 1 creada a través de PurchaseService.createPurchase()',
        saveAsDraft: true,
        items: [
          {
            productId: productA1Id,
            productName: 'Queso Campesino',
            sku: `SKU-TS-A1-${runId}`,
            quantity: 10,
            unitCost: 12000,
            discountPercent: 0,
            taxRatePercent: 19,
          },
        ],
      }

      const order1 = await serviceA.createPurchase(payload, userContextA)
      createdOrder1Id = order1.id

      const hasId = Boolean(order1.id)
      const hasNumber = /^COM-[0-9]{6}$/.test(order1.purchaseNumber)
      const isDraft = order1.status === 'BORRADOR'
      const hasItems = order1.items && order1.items.length === 1
      const totalMatch = order1.subtotal === 120000 && order1.total === 142800

      ts01Pass = hasId && hasNumber && isDraft && hasItems && totalMatch
      ts01Details = `Orden retornada por Service: ID=${order1.id}, Consecutivo="${order1.purchaseNumber}", Status=${order1.status}, Subtotal=$${order1.subtotal}, Total=$${order1.total}.`
    } catch (err: any) {
      ts01Details = `Error en TS01: ${err.message}`
    }
    recordResult('TS01', 'createPurchase() en BORRADOR mediante PurchaseService', ts01Pass, ts01Details)

    // -------------------------------------------------------------------------
    // TS02 — Consecutivo COM-XXXXXX correlativo generado por PostgreSQL
    // -------------------------------------------------------------------------
    console.log('--- EJECUTANDO TS02: CONSECUTIVOS CORRELATIVOS EN TYPESCRIPT ---')
    let ts02Pass = false
    let ts02Details = ''
    try {
      const payload2: CreatePurchaseInput = {
        supplierId: supplierAId,
        destinationLocationId: locAId,
        supplierInvoiceNumber: `FAC-TS-02-${runId}`,
        date: '2026-10-02',
        paymentType: 'CONTADO',
        notes: 'Orden 2 para correlatividad',
        saveAsDraft: true,
        items: [
          {
            productId: productA2Id,
            productName: 'Mantequilla',
            sku: `SKU-TS-A2-${runId}`,
            quantity: 20,
            unitCost: 6500,
            discountPercent: 0,
            taxRatePercent: 19,
          },
        ],
      }

      const order2 = await serviceA.createPurchase(payload2, userContextA)
      createdOrder2Id = order2.id

      // Obtenemos Orden 1 y Orden 2 a través de serviceA.getById
      const o1 = await serviceA.getById(createdOrder1Id, userContextA)
      const o2 = await serviceA.getById(createdOrder2Id, userContextA)

      if (o1 && o2) {
        const n1 = parseInt(o1.purchaseNumber.replace('COM-', ''), 10)
        const n2 = parseInt(o2.purchaseNumber.replace('COM-', ''), 10)
        ts02Pass = n2 === n1 + 1
        ts02Details = `Orden 1: ${o1.purchaseNumber} -> Orden 2: ${o2.purchaseNumber}. Correlativo estricto verificado.`
      } else {
        ts02Details = 'No se pudieron recuperar ambas órdenes mediante service.getById.'
      }
    } catch (err: any) {
      ts02Details = `Error en TS02: ${err.message}`
    }
    recordResult('TS02', 'Consecutivo COM-XXXXXX correlativo generado por PostgreSQL', ts02Pass, ts02Details)

    // -------------------------------------------------------------------------
    // TS03 — updatePurchase() de orden en BORRADOR mediante PurchaseService
    // -------------------------------------------------------------------------
    console.log('--- EJECUTANDO TS03: updatePurchase() DE BORRADOR ---')
    let ts03Pass = false
    let ts03Details = ''
    try {
      const updatePayload: UpdatePurchaseInput = {
        supplierId: supplierAId,
        destinationLocationId: locAId,
        supplierInvoiceNumber: `FAC-TS-01-UPD-${runId}`,
        date: '2026-10-02',
        dueDate: '2026-11-15',
        paymentType: 'CREDITO',
        notes: 'Orden 1 actualizada exitosamente vía PurchaseService',
        saveAsDraft: true,
        items: [
          {
            productId: productA1Id,
            productName: 'Queso Campesino Modificado',
            sku: `SKU-TS-A1-${runId}`,
            quantity: 25, // Cambiado de 10 a 25
            unitCost: 12000,
            discountPercent: 5, // Descuento del 5%
            taxRatePercent: 19,
          },
        ],
      }

      const updated = await serviceA.updatePurchase(createdOrder1Id, updatePayload, userContextA)

      // Base = 25 * 12000 = 300.000. Desc 5% = 15.000. Subtotal base gravable = 285.000. IVA 19% = 54.150. Total = 339.150.
      const qtyMatch = updated.items[0]?.quantity === 25
      const totalMatch = updated.total === 339150
      const statusDraft = updated.status === 'BORRADOR'

      ts03Pass = qtyMatch && totalMatch && statusDraft
      ts03Details = `Borrador editado vía Service: Cantidad=${updated.items[0]?.quantity}, Total=$${updated.total}, Status=${updated.status}.`
    } catch (err: any) {
      ts03Details = `Error en TS03: ${err.message}`
    }
    recordResult('TS03', 'updatePurchase() de orden en BORRADOR mediante PurchaseService', ts03Pass, ts03Details)

    // -------------------------------------------------------------------------
    // TS04 — confirmOrder() mediante PurchaseService con auth.uid() real
    // -------------------------------------------------------------------------
    console.log('--- EJECUTANDO TS04: confirmOrder() MEDIANTE PURCHASE SERVICE ---')
    let ts04Pass = false
    let ts04Details = ''
    try {
      const confirmed = await serviceA.confirmOrder(createdOrder1Id, userContextA)

      const statusConf = confirmed.status === 'CONFIRMADA'
      const hasDate = Boolean(confirmed.confirmedAt)
      const hasUser = confirmed.confirmedByUserId === authUserAId

      ts04Pass = statusConf && hasDate && hasUser
      ts04Details = `Orden confirmada vía Service: Status=${confirmed.status}, confirmedAt=${confirmed.confirmedAt}, confirmedByUserId=${confirmed.confirmedByUserId}.`
    } catch (err: any) {
      ts04Details = `Error en TS04: ${err.message}`
    }
    recordResult('TS04', 'confirmOrder() mediante PurchaseService con auth.uid() real', ts04Pass, ts04Details)

    // -------------------------------------------------------------------------
    // TS05 — Confirmar orden NO genera movimientos en inventory_movements
    // -------------------------------------------------------------------------
    console.log('--- EJECUTANDO TS05: ASSERTION DE INVENTARIO TRAS CONFIRMACIÓN ---')
    let ts05Pass = false
    let ts05Details = ''
    try {
      // Assertion vía pgClient (conforme a la regla 8)
      const movsCount = await pgClient.query(
        "SELECT count(*) FROM public.inventory_movements WHERE company_id = $1 AND (document_reference = $2 OR document_reference = $3 OR product_id = $4);",
        [companyAId, createdOrder1Id, `FAC-TS-01-UPD-${runId}`, productA1Id]
      )

      const count = Number(movsCount.rows[0].count)
      ts05Pass = count === 0
      ts05Details = `Movimientos de inventario generados tras confirmación = ${count} (0 esperado). Stock físico no modificado.`
    } catch (err: any) {
      ts05Details = `Error en TS05: ${err.message}`
    }
    recordResult('TS05', 'Confirmar orden NO genera movimientos en inventory_movements', ts05Pass, ts05Details)

    // -------------------------------------------------------------------------
    // TS06 — Rechazar updatePurchase() sobre orden CONFIRMADA
    // -------------------------------------------------------------------------
    console.log('--- EJECUTANDO TS06: RECHAZAR EDICIÓN DE ORDEN CONFIRMADA ---')
    let ts06Pass = false
    let ts06Details = ''
    try {
      await serviceA.updatePurchase(createdOrder1Id, {
        supplierId: supplierAId,
        destinationLocationId: locAId,
        supplierInvoiceNumber: 'FAC-HACK-CONF',
        date: '2026-10-02',
        paymentType: 'CONTADO',
        items: [
          { productId: productA1Id, quantity: 1, unitCost: 1000, discountPercent: 0, taxRatePercent: 19 }
        ]
      }, userContextA)
      ts06Details = 'Se permitió editar orden confirmada indebidamente.'
    } catch (err: any) {
      if (err.message.includes('borrador') || err.message.includes('CONFIRMADA')) {
        ts06Pass = true
        ts06Details = `Bloqueado correctamente por la capa TypeScript / RPC: "${err.message}".`
      } else {
        ts06Details = `Error inesperado: ${err.message}`
      }
    }
    recordResult('TS06', 'Rechazar updatePurchase() sobre orden CONFIRMADA', ts06Pass, ts06Details)

    // -------------------------------------------------------------------------
    // TS07 — cancelPurchase() mediante PurchaseService con motivo obligatorio
    // -------------------------------------------------------------------------
    console.log('--- EJECUTANDO TS07: cancelPurchase() MEDIANTE PURCHASE SERVICE ---')
    let ts07Pass = false
    let ts07Details = ''
    try {
      // 1. Creamos una tercera orden para anular
      const order3 = await serviceA.createPurchase({
        supplierId: supplierAId,
        destinationLocationId: locAId,
        supplierInvoiceNumber: `FAC-TS-03-${runId}`,
        date: '2026-10-02',
        paymentType: 'CONTADO',
        notes: 'Orden 3 creada para anular',
        saveAsDraft: true,
        items: [
          { productId: productA2Id, quantity: 5, unitCost: 6500, discountPercent: 0, taxRatePercent: 19 }
        ]
      }, userContextA)
      cancelOrder3Id = order3.id

      // 2. Anulamos mediante PurchaseService
      const cancelled = await serviceA.cancelPurchase(
        cancelOrder3Id,
        'Cancelada por el comprador: error en cantidad pactada con proveedor',
        userContextA
      )

      const isCancelled = cancelled.status === 'CANCELADA'
      const noteContainsReason = (cancelled.notes || '').includes('Cancelada por el comprador')

      ts07Pass = isCancelled && noteContainsReason
      ts07Details = `Orden anulada vía Service: Status=${cancelled.status}, Notes="${cancelled.notes}".`
    } catch (err: any) {
      ts07Details = `Error en TS07: ${err.message}`
    }
    recordResult('TS07', 'cancelPurchase() mediante PurchaseService con motivo', ts07Pass, ts07Details)

    // -------------------------------------------------------------------------
    // TS08 — Rechazar cancelPurchase() si la orden tuviera mercancía recibida
    // -------------------------------------------------------------------------
    console.log('--- EJECUTANDO TS08: RECHAZAR CANCELACIÓN CON MERCANCÍA RECIBIDA ---')
    let ts08Pass = false
    let ts08Details = ''
    try {
      // Simulamos que createdOrder2Id tiene mercancía recibida > 0
      await pgClient.query("SELECT set_config('app.is_test_cleanup', 'true', false);")
      await pgClient.query("UPDATE public.purchase_items SET received_quantity = 5 WHERE purchase_id = $1;", [createdOrder2Id])
      await pgClient.query("SELECT set_config('app.is_test_cleanup', 'false', false);")

      await serviceA.cancelPurchase(createdOrder2Id, 'Intento de anulación con recepción', userContextA)
      ts08Details = 'Se permitió anular orden con mercancía recibida indebidamente.'
    } catch (err: any) {
      if (err.message.includes('mercancía recibida') || err.message.includes('cantidades recibidas')) {
        ts08Pass = true
        ts08Details = `Bloqueado correctamente: "${err.message}".`
      } else {
        ts08Details = `Error inesperado: ${err.message}`
      }
    }
    recordResult('TS08', 'Rechazar cancelPurchase() si la orden tiene mercancía recibida', ts08Pass, ts08Details)

    // -------------------------------------------------------------------------
    // TS09 — Rechazar proveedor de otra empresa (Cross-tenant) en PurchaseService
    // -------------------------------------------------------------------------
    console.log('--- EJECUTANDO TS09: RECHAZAR PROVEEDOR CROSS-TENANT ---')
    let ts09Pass = false
    let ts09Details = ''
    try {
      await serviceA.createPurchase({
        supplierId: supplierBId, // Proveedor de Empresa B
        destinationLocationId: locAId,
        supplierInvoiceNumber: `FAC-FAIL-SUPP-${runId}`,
        date: '2026-10-02',
        paymentType: 'CONTADO',
        saveAsDraft: true,
        items: [
          { productId: productA1Id, quantity: 1, unitCost: 12000, discountPercent: 0, taxRatePercent: 19 }
        ]
      }, userContextA)
      ts09Details = 'Se permitió usar proveedor de otra empresa.'
    } catch (err: any) {
      if (err.message.includes('otra empresa') || err.message.includes('no existe')) {
        ts09Pass = true
        ts09Details = `Rechazado correctamente: "${err.message}".`
      } else {
        ts09Details = `Error inesperado: ${err.message}`
      }
    }
    recordResult('TS09', 'Rechazar proveedor de otra empresa en PurchaseService', ts09Pass, ts09Details)

    // -------------------------------------------------------------------------
    // TS10 — Rechazar producto de otra empresa (Cross-tenant) en PurchaseService
    // -------------------------------------------------------------------------
    console.log('--- EJECUTANDO TS10: RECHAZAR PRODUCTO CROSS-TENANT ---')
    let ts10Pass = false
    let ts10Details = ''
    try {
      await serviceA.createPurchase({
        supplierId: supplierAId,
        destinationLocationId: locAId,
        supplierInvoiceNumber: `FAC-FAIL-PROD-${runId}`,
        date: '2026-10-02',
        paymentType: 'CONTADO',
        saveAsDraft: true,
        items: [
          { productId: productB1Id, quantity: 1, unitCost: 7000, discountPercent: 0, taxRatePercent: 19 }
        ]
      }, userContextA)
      ts10Details = 'Se permitió usar producto de otra empresa.'
    } catch (err: any) {
      if (err.message.includes('otra empresa') || err.message.includes('no existe')) {
        ts10Pass = true
        ts10Details = `Rechazado correctamente: "${err.message}".`
      } else {
        ts10Details = `Error inesperado: ${err.message}`
      }
    }
    recordResult('TS10', 'Rechazar producto de otra empresa en PurchaseService', ts10Pass, ts10Details)

    // -------------------------------------------------------------------------
    // TS11 — Rechazar quantity <= 0 (Validación Zod / Service / DB)
    // -------------------------------------------------------------------------
    console.log('--- EJECUTANDO TS11: RECHAZAR QUANTITY <= 0 ---')
    let ts11Pass = false
    let ts11Details = ''
    try {
      await serviceA.createPurchase({
        supplierId: supplierAId,
        destinationLocationId: locAId,
        supplierInvoiceNumber: `FAC-FAIL-QTY-${runId}`,
        date: '2026-10-02',
        paymentType: 'CONTADO',
        saveAsDraft: true,
        items: [
          { productId: productA1Id, quantity: 0, unitCost: 12000, discountPercent: 0, taxRatePercent: 19 }
        ]
      }, userContextA)
      ts11Details = 'Se permitió crear compra con cantidad 0.'
    } catch (err: any) {
      if (err.message.includes('mayor a 0') || err.message.includes('Cantidad')) {
        ts11Pass = true
        ts11Details = `Rechazado por validación Zod / Service: "${err.message}".`
      } else {
        ts11Details = `Error inesperado: ${err.message}`
      }
    }
    recordResult('TS11', 'Rechazar quantity <= 0 en TypeScript', ts11Pass, ts11Details)

    // -------------------------------------------------------------------------
    // TS12 — Rechazar unit_cost < 0 (Validación Zod / Service / DB)
    // -------------------------------------------------------------------------
    console.log('--- EJECUTANDO TS12: RECHAZAR UNIT_COST < 0 ---')
    let ts12Pass = false
    let ts12Details = ''
    try {
      await serviceA.createPurchase({
        supplierId: supplierAId,
        destinationLocationId: locAId,
        supplierInvoiceNumber: `FAC-FAIL-COST-${runId}`,
        date: '2026-10-02',
        paymentType: 'CONTADO',
        saveAsDraft: true,
        items: [
          { productId: productA1Id, quantity: 5, unitCost: -200, discountPercent: 0, taxRatePercent: 19 }
        ]
      }, userContextA)
      ts12Details = 'Se permitió costo negativo.'
    } catch (err: any) {
      if (err.message.includes('negativo') || err.message.includes('costo')) {
        ts12Pass = true
        ts12Details = `Rechazado por validación Zod / Service: "${err.message}".`
      } else {
        ts12Details = `Error inesperado: ${err.message}`
      }
    }
    recordResult('TS12', 'Rechazar unit_cost < 0 en TypeScript', ts12Pass, ts12Details)

    // -------------------------------------------------------------------------
    // CAMBIO DE SESIÓN ACTIVA A USUARIO B (EMPRESA B)
    // -------------------------------------------------------------------------
    await supabaseClient.auth.signInWithPassword({
      email: userBEmail,
      password: testPassword,
    })
    serviceB = new PurchaseService(new PurchaseRepository(supabaseClient))

    // -------------------------------------------------------------------------
    // TS13 — Aislamiento Multi-Tenant: User B no puede leer compras de Empresa A
    // -------------------------------------------------------------------------
    console.log('--- EJECUTANDO TS13: USER B NO PUEDE LEER COMPRAS DE EMPRESA A ---')
    let ts13Pass = false
    let ts13Details = ''
    try {
      // 1. getById de orden de Empresa A usando serviceB (autenticado como User B)
      const orderASeenByB = await serviceB.getById(createdOrder1Id, userContextB)

      // 2. list de compras usando serviceB
      const listSeenByB = await serviceB.list({ page: 1, pageSize: 50 }, userContextB)
      const containsOrderA = listSeenByB.items.some((p) => p.id === createdOrder1Id || p.id === createdOrder2Id)

      ts13Pass = orderASeenByB === null && !containsOrderA
      ts13Details = `getById(OrdenA)=${orderASeenByB} (null esperado). OrdenA visible en list()=${containsOrderA} (false esperado).`
    } catch (err: any) {
      ts13Details = `Error en TS13: ${err.message}`
    }
    recordResult('TS13', 'Aislamiento Multi-Tenant: User B no puede leer compras de Empresa A', ts13Pass, ts13Details)

    // -------------------------------------------------------------------------
    // TS14 — Aislamiento Multi-Tenant: User B crea orden con consecutivo independiente
    // -------------------------------------------------------------------------
    console.log('--- EJECUTANDO TS14: USER B CREA ORDEN CON CONSECUTIVO INDEPENDIENTE ---')
    let ts14Pass = false
    let ts14Details = ''
    try {
      const orderB = await serviceB.createPurchase({
        supplierId: supplierBId,
        destinationLocationId: locBId,
        supplierInvoiceNumber: `FAC-TS-B-01-${runId}`,
        date: '2026-10-02',
        paymentType: 'CONTADO',
        notes: 'Orden 1 de Empresa B mediante serviceB real',
        saveAsDraft: false,
        items: [
          {
            productId: productB1Id,
            productName: 'Aceite de Palma',
            sku: `SKU-TS-B1-${runId}`,
            quantity: 10,
            unitCost: 7000,
            discountPercent: 0,
            taxRatePercent: 5,
          },
        ],
      }, userContextB)

      const isConsecutive1 = orderB.purchaseNumber === 'COM-000001'
      const statusConf = orderB.status === 'CONFIRMADA'
      const totalMatch = orderB.total === 73500 // 70.000 + 5% IVA = 73.500

      ts14Pass = isConsecutive1 && statusConf && totalMatch
      ts14Details = `Orden de Empresa B creada vía serviceB: Consecutivo="${orderB.purchaseNumber}" (COM-000001 esperado), Status=${orderB.status}, Total=$${orderB.total}.`
    } catch (err: any) {
      ts14Details = `Error en TS14: ${err.message}`
    }
    recordResult('TS14', 'Aislamiento Multi-Tenant: User B crea orden con consecutivo independiente', ts14Pass, ts14Details)

    // -------------------------------------------------------------------------
    // TS15 — Aislamiento Multi-Tenant: User B no puede usar proveedor de Empresa A
    // -------------------------------------------------------------------------
    console.log('--- EJECUTANDO TS15: USER B NO PUEDE USAR PROVEEDOR DE EMPRESA A ---')
    let ts15Pass = false
    let ts15Details = ''
    try {
      await serviceB.createPurchase({
        supplierId: supplierAId, // Proveedor ajeno de Empresa A
        destinationLocationId: locBId,
        supplierInvoiceNumber: `FAC-TS-B-FAIL-${runId}`,
        date: '2026-10-02',
        paymentType: 'CONTADO',
        saveAsDraft: true,
        items: [
          { productId: productB1Id, quantity: 5, unitCost: 7000, discountPercent: 0, taxRatePercent: 5 }
        ],
      }, userContextB)
      ts15Details = 'User B pudo usar proveedor de Empresa A indebidamente.'
    } catch (err: any) {
      if (err.message.includes('otra empresa') || err.message.includes('no existe') || err.message.includes('activo')) {
        ts15Pass = true
        ts15Details = `Bloqueado correctamente: "${err.message}".`
      } else {
        ts15Details = `Error inesperado: ${err.message}`
      }
    }
    recordResult('TS15', 'Aislamiento Multi-Tenant: User B no puede usar proveedor de Empresa A', ts15Pass, ts15Details)

  } finally {
    // -------------------------------------------------------------------------
    // TS16 / PURGA ZERO POLLUTION EN STAGING
    // -------------------------------------------------------------------------
    console.log('--- PURGA ZERO POLLUTION EN STAGING ---')
    let ts16Pass = false
    let ts16Details = ''
    try {
      await pgClient.query("SELECT set_config('app.is_test_cleanup', 'true', false);")

      // 1. Eliminar líneas de compras del test
      await pgClient.query(`
        DELETE FROM public.purchase_items
        WHERE purchase_id IN (
          SELECT id FROM public.purchases
          WHERE supplier_invoice_number LIKE '%' || $1 || '%' OR company_id = $2
        );
      `, [runId, companyBId])

      // 2. Eliminar compras del test
      await pgClient.query(`
        DELETE FROM public.purchases
        WHERE supplier_invoice_number LIKE '%' || $1 || '%' OR company_id = $2;
      `, [runId, companyBId])

      // 3. Eliminar productos del test
      await pgClient.query("DELETE FROM public.products WHERE sku LIKE '%' || $1 || '%';", [runId])

      // 4. Eliminar categorías del test
      await pgClient.query("DELETE FROM public.categories WHERE code LIKE '%' || $1 || '%';", [runId])

      // 5. Eliminar proveedores del test
      await pgClient.query("DELETE FROM public.suppliers WHERE email LIKE '%' || $1 || '%' OR tax_id LIKE '%' || $1 || '%';", [runId])

      // 6. Eliminar ubicaciones temporales
      if (locBId) await pgClient.query("DELETE FROM public.user_locations WHERE location_id = $1;", [locBId])
      if (locBId) await pgClient.query("DELETE FROM public.locations WHERE id = $1;", [locBId])

      // 7. Eliminar sedes de usuarios
      if (authUserAId) await pgClient.query("DELETE FROM public.user_locations WHERE user_id = $1;", [authUserAId])
      if (authUserBId) await pgClient.query("DELETE FROM public.user_locations WHERE user_id = $1;", [authUserBId])

      // 8. Eliminar usuarios de public.users
      if (authUserAId) await pgClient.query("DELETE FROM public.users WHERE id = $1;", [authUserAId])
      if (authUserBId) await pgClient.query("DELETE FROM public.users WHERE id = $1;", [authUserBId])

      // 9. Eliminar usuarios de Supabase Auth
      if (authUserAId) await adminSupabase.auth.admin.deleteUser(authUserAId)
      if (authUserBId) await adminSupabase.auth.admin.deleteUser(authUserBId)

      // 10. Eliminar logs de auditoría creados
      await pgClient.query(`
        DELETE FROM public.audit_logs
        WHERE company_id = $1 OR user_name LIKE '%' || $2 || '%';
      `, [companyBId, runId])

      // 11. Eliminar Empresa B
      if (companyBId) await pgClient.query("DELETE FROM public.companies WHERE id = $1;", [companyBId])

      await pgClient.query("SELECT set_config('app.is_test_cleanup', 'false', false);")

      // Conteo residual
      const resPurchases = await pgClient.query("SELECT count(*) FROM public.purchases WHERE supplier_invoice_number LIKE '%' || $1 || '%';", [runId])
      const resProds = await pgClient.query("SELECT count(*) FROM public.products WHERE sku LIKE '%' || $1 || '%';", [runId])
      const resSupps = await pgClient.query("SELECT count(*) FROM public.suppliers WHERE email LIKE '%' || $1 || '%';", [runId])
      const resUsers = await pgClient.query("SELECT count(*) FROM public.users WHERE email LIKE '%' || $1 || '%';", [runId])
      const resComps = await pgClient.query("SELECT count(*) FROM public.companies WHERE business_name LIKE '%' || $1 || '%';", [runId])

      console.log('📊 Conteo residual en PostgreSQL Staging:')
      console.log(`   - Compras residuales:   ${resPurchases.rows[0].count}`)
      console.log(`   - Productos residuales: ${resProds.rows[0].count}`)
      console.log(`   - Proveedores residual: ${resSupps.rows[0].count}`)
      console.log(`   - Usuarios residuales:  ${resUsers.rows[0].count}`)
      console.log(`   - Empresas residuales:  ${resComps.rows[0].count}`)

      const zero = Number(resPurchases.rows[0].count) === 0 &&
                   Number(resProds.rows[0].count) === 0 &&
                   Number(resSupps.rows[0].count) === 0 &&
                   Number(resUsers.rows[0].count) === 0 &&
                   Number(resComps.rows[0].count) === 0

      ts16Pass = zero
      ts16Details = `0 residuos en compras, productos, proveedores, usuarios y empresas.`
    } catch (cleanupErr: any) {
      ts16Details = `Error durante la purga: ${cleanupErr.message}`
    } finally {
      await pgClient.end()
    }
    recordResult('TS16', 'Purga Zero Pollution comprobada al 100% en PostgreSQL Staging', ts16Pass, ts16Details)
  }

  // ---------------------------------------------------------------------------
  // RESUMEN FINAL
  // ---------------------------------------------------------------------------
  console.log('\n================================================================================')
  console.log('📋 RESUMEN FINAL DE LA SUITE DE INTEGRACIÓN TYPESCRIPT REAL (PASO 2)')
  console.log('================================================================================')
  const total = results.length
  const passed = results.filter((r) => r.status === 'PASS').length
  const failed = results.filter((r) => r.status === 'FAIL').length

  for (const r of results) {
    const icon = r.status === 'PASS' ? '✅' : '❌'
    console.log(`${icon} [${r.status}] ${r.code}: ${r.name}`)
  }

  console.log(`\nTOTAL: ${total} | APROBADAS: ${passed} | FALLIDAS: ${failed}`)
  if (failed > 0) {
    console.error('❌ CONDICIÓN DE CIERRE NO SUPERADA: Hay pruebas de integración fallidas.')
    process.exit(1)
  } else {
    console.log('🏆 TODAS LAS PRUEBAS DE INTEGRACIÓN TYPESCRIPT FUERON SUPERADAS AL 100% (PASS).')
  }
}

runTypeScriptIntegrationSuite().catch((err) => {
  console.error('Fallo fatal en la suite de integración:', err)
  process.exit(1)
})
