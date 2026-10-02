import { Client } from 'pg'
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { purchaseService } from '../features/purchases/services/purchase.service'
import { PurchaseRepository } from '../features/purchases/repositories/purchase.repository'
import { CreatePurchaseInput, UpdatePurchaseInput, UserPermissionContext } from '../features/purchases/types'

async function runStep3TestSuite() {
  console.log('================================================================================')
  console.log('🧪 INICIANDO SUITE DE PRUEBAS TÉCNICAS FASE 5.1 / PASO 3 — UI/SERVICE FLOW')
  console.log('================================================================================\n')

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  const connStr = process.env.DATABASE_URL || process.env.DIRECT_URL

  if (!connStr || !supabaseUrl || !serviceRoleKey) {
    throw new Error('Variables de entorno incompletas en .env.local.')
  }

  const pgClient = new Client({
    connectionString: connStr,
    ssl: { rejectUnauthorized: false },
  })
  await pgClient.connect()
  console.log('✅ Conexión directa a PostgreSQL Staging establecida.')

  const adminSupabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const runId = Date.now().toString().slice(-6)
  const tag = `TEST-P51-S3-${runId}`

  let companyAId = ''
  let companyBId = ''
  let locAId = ''
  let locBId = ''

  let categoryAId = ''
  let categoryBId = ''
  let supplierAId = ''
  let supplierBId = ''
  let productA1Id = ''
  let productB1Id = ''

  let authUserAId = ''
  let authUserBId = ''

  const userAEmail = `admin_s3_a_${runId}@supermas.test`
  const userBEmail = `admin_s3_b_${runId}@supermas.test`
  const testPassword = `P51Sec3*${runId}Pass!`

  const testResults: { name: string; pass: boolean; details?: string }[] = []

  try {
    console.log('--- SETUP BASE MULTI-TENANT & ENTIDADES STAGING ---')

    const compA = await pgClient.query("SELECT id FROM public.companies WHERE status = 'ACTIVE' ORDER BY created_at ASC LIMIT 1;")
    if (compA.rows.length === 0) throw new Error('No hay empresas activas en staging.')
    companyAId = compA.rows[0].id

    // Empresa B temporal
    const compBRes = await pgClient.query(`
      INSERT INTO public.companies (
        business_name, trade_name, tax_id, verification_digit, tax_regime,
        address, city, department, country, phone, email, invoice_email, status
      ) VALUES (
        'Empresa B Staging ${tag}', 'Distribuidora B', '900777${runId}', '4', 'RESPONSABLE_DE_IVA',
        'Calle 70 # 10-20', 'Bogotá', 'Bogotá D.C.', 'Colombia', '3128889900',
        'compb_${runId}@supermas.test', 'fact_${runId}@supermas.test', 'ACTIVE'
      ) RETURNING id;
    `)
    companyBId = compBRes.rows[0].id

    // Bodega A
    const locARes = await pgClient.query(
      "SELECT id FROM public.locations WHERE company_id = $1 AND status = 'ACTIVE' AND allow_purchases = true LIMIT 1;",
      [companyAId]
    )
    if (locARes.rows.length === 0) throw new Error('No hay bodegas con allow_purchases en Empresa A.')
    locAId = locARes.rows[0].id

    // Bodega B
    const locBRes = await pgClient.query(`
      INSERT INTO public.locations (
        company_id, code, name, type, address, city, department, allow_purchases, status
      ) VALUES (
        $1, 'LOC-S3-B-${runId}', 'Bodega Empresa B ${tag}', 'WAREHOUSE',
        'Carrera 30 # 45-10', 'Bogotá', 'Bogotá D.C.', true, 'ACTIVE'
      ) RETURNING id;
    `, [companyBId])
    locBId = locBRes.rows[0].id

    // Categorías
    const catARes = await pgClient.query(`
      INSERT INTO public.categories (
        company_id, code, name, slug, is_active, sort_order
      ) VALUES (
        $1, 'CAT-S3-A-${runId}', 'Categoría A ${tag}', 'cat-s3-a-${runId}', true, 0
      ) RETURNING id;
    `, [companyAId])
    categoryAId = catARes.rows[0].id

    const catBRes = await pgClient.query(`
      INSERT INTO public.categories (
        company_id, code, name, slug, is_active, sort_order
      ) VALUES (
        $1, 'CAT-S3-B-${runId}', 'Categoría B ${tag}', 'cat-s3-b-${runId}', true, 0
      ) RETURNING id;
    `, [companyBId])
    categoryBId = catBRes.rows[0].id

    // Proveedores
    const suppARes = await pgClient.query(`
      INSERT INTO public.suppliers (
        company_id, tax_id, verification_digit, name, legal_name, person_type,
        contact_name, email, phone, city, payment_terms_days, credit_limit, is_active
      ) VALUES (
        $1, '900333${runId}', '9', 'Lácteos Centrales A ${tag}', 'Lácteos Centrales S.A.S.', 'JURIDICA',
        'Rodrigo Soto', 'central_${runId}@supermas.test', '3007654321', 'Medellín', 30, 0, true
      ) RETURNING id;
    `, [companyAId])
    supplierAId = suppARes.rows[0].id

    const suppBRes = await pgClient.query(`
      INSERT INTO public.suppliers (
        company_id, tax_id, verification_digit, name, legal_name, person_type,
        contact_name, email, phone, city, payment_terms_days, credit_limit, is_active
      ) VALUES (
        $1, '900444${runId}', '5', 'Distribuciones Bogotá B ${tag}', 'Distribuciones Bogotá S.A.S.', 'JURIDICA',
        'Sandra López', 'bogota_${runId}@supermas.test', '3151234567', 'Bogotá', 30, 0, true
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
        $1, $2, 'SKU-S3-A1-${runId}', 'Arroz Flor Huila A ${tag}', 'arroz-flor-${runId}', 'UND',
        15000.00, 20000.00, 18000.00, 10,
        19.00, false, 5, 2,
        'STANDARD', true, false, false
      ) RETURNING id;
    `, [companyAId, categoryAId])
    productA1Id = prodA1Res.rows[0].id

    const prodB1Res = await pgClient.query(`
      INSERT INTO public.products (
        company_id, category_id, sku, name, slug, unit_of_measure,
        cost_price, public_sale_price, wholesale_price, min_wholesale_quantity,
        tax_rate_percent, is_tax_exempt, min_stock_threshold, critical_stock_threshold,
        inventory_type, is_active, is_published_supermas, is_published_distributor
      ) VALUES (
        $1, $2, 'SKU-S3-B1-${runId}', 'Aceite Girasol B ${tag}', 'aceite-girasol-${runId}', 'UND',
        22000.00, 28000.00, 25000.00, 6,
        19.00, false, 5, 2,
        'STANDARD', true, false, false
      ) RETURNING id;
    `, [companyBId, categoryBId])
    productB1Id = prodB1Res.rows[0].id

    // Roles
    const rSuperAdmin = await pgClient.query("SELECT id FROM public.roles WHERE code = 'SUPERADMIN' LIMIT 1;")
    const roleSuperAdminId = rSuperAdmin.rows[0]?.id

    // Usuarios Supabase Auth
    console.log('--- CREANDO USUARIOS EN SUPABASE AUTH ---')
    const userACreated = await adminSupabase.auth.admin.createUser({
      email: userAEmail,
      password: testPassword,
      email_confirm: true,
      user_metadata: { full_name: `Admin UI A ${tag}` },
    })
    if (userACreated.error) throw userACreated.error
    authUserAId = userACreated.data.user.id

    await pgClient.query(`
      INSERT INTO public.users (id, company_id, role_id, email, full_name, is_active)
      VALUES ($1, $2, $3, $4, $5, true)
      ON CONFLICT (id) DO UPDATE SET company_id = EXCLUDED.company_id, role_id = EXCLUDED.role_id, full_name = EXCLUDED.full_name;
    `, [authUserAId, companyAId, roleSuperAdminId, userAEmail, `Admin UI A ${tag}`])

    await pgClient.query(`
      INSERT INTO public.user_locations (user_id, location_id, is_primary)
      VALUES ($1, $2, true)
      ON CONFLICT (user_id, location_id) DO NOTHING;
    `, [authUserAId, locAId])

    const userBCreated = await adminSupabase.auth.admin.createUser({
      email: userBEmail,
      password: testPassword,
      email_confirm: true,
      user_metadata: { full_name: `Admin UI B ${tag}` },
    })
    if (userBCreated.error) throw userBCreated.error
    authUserBId = userBCreated.data.user.id

    await pgClient.query(`
      INSERT INTO public.users (id, company_id, role_id, email, full_name, is_active)
      VALUES ($1, $2, $3, $4, $5, true)
      ON CONFLICT (id) DO UPDATE SET company_id = EXCLUDED.company_id, role_id = EXCLUDED.role_id, full_name = EXCLUDED.full_name;
    `, [authUserBId, companyBId, roleSuperAdminId, userBEmail, `Admin UI B ${tag}`])

    await pgClient.query(`
      INSERT INTO public.user_locations (user_id, location_id, is_primary)
      VALUES ($1, $2, true)
      ON CONFLICT (user_id, location_id) DO NOTHING;
    `, [authUserBId, locBId])

    console.log('✅ Usuarios autenticados creados y vinculados a sus empresas.')

    // Inicializar clientes autenticados para Empresa A y Empresa B
    const clientA = createClient(supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const authAResp = await clientA.auth.signInWithPassword({
      email: userAEmail,
      password: testPassword,
    })
    if (authAResp.error) throw authAResp.error

    const clientB = createClient(supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const authBResp = await clientB.auth.signInWithPassword({
      email: userBEmail,
      password: testPassword,
    })
    if (authBResp.error) throw authBResp.error

    // Inyectar Servicios conectados a las sesiones activas
    const serviceA = purchaseService.withClient(clientA)
    const serviceB = purchaseService.withClient(clientB)

    console.log('✅ Sesiones JWT activas para Empresa A y Empresa B.\n')

    const userContextAdminA: UserPermissionContext = {
      userId: authUserAId,
      userName: `Admin UI A ${tag}`,
      userRole: 'ADMIN',
      permissions: ['purchases.read', 'purchases.create', 'cost.read'],
    }

    const userContextRestrictedA: UserPermissionContext = {
      userId: authUserAId,
      userName: `Operator NoCost ${tag}`,
      userRole: 'OPERATOR',
      permissions: ['purchases.read'], // Sin purchases.create ni cost.read
    }

    const userContextAdminB: UserPermissionContext = {
      userId: authUserBId,
      userName: `Admin UI B ${tag}`,
      userRole: 'ADMIN',
      permissions: ['purchases.read', 'purchases.create', 'cost.read'],
    }

    // =========================================================================
    // PRUEBA U01: Crear compra en BORRADOR vía PurchaseService
    // =========================================================================
    console.log('--- EJECUTANDO U01: CREAR COMPRA EN BORRADOR VÍA SERVICE ---')
    let createdPurchaseId = ''
    try {
      const input: CreatePurchaseInput = {
        supplierId: supplierAId,
        destinationLocationId: locAId,
        date: '2026-10-02',
        supplierInvoiceNumber: `FAC-S3-01-${runId}`,
        paymentType: 'CREDITO',
        dueDate: '2026-11-02',
        notes: 'Compra de prueba paso 3 UI',
        saveAsDraft: true,
        items: [
          {
            productId: productA1Id,
            productName: `Arroz Flor Huila A ${tag}`,
            sku: `SKU-S3-A1-${runId}`,
            unitOfMeasure: 'UND',
            quantity: 20,
            unitCost: 15000,
            discountPercent: 5,
            taxCode: 'IVA_19',
            taxRatePercent: 19,
          },
        ],
      }

      const created = await serviceA.createPurchase(input, userContextAdminA)
      createdPurchaseId = created.id

      if (!created.id || !created.purchaseNumber.startsWith('COM-') || created.status !== 'BORRADOR') {
        throw new Error(`Respuesta inválida: status=${created.status}, number=${created.purchaseNumber}`)
      }

      testResults.push({
        name: 'U01: Crear compra en BORRADOR vía Service',
        pass: true,
        details: `ID=${created.id}, Consecutivo=${created.purchaseNumber}, Subtotal=$${created.subtotal}, Total=$${created.total}`,
      })
      console.log(`✅ [U01] PASS: ${created.purchaseNumber} creada en estado BORRADOR.`)
    } catch (err: any) {
      testResults.push({
        name: 'U01: Crear compra en BORRADOR vía Service',
        pass: false,
        details: err.message,
      })
      console.error('❌ [U01] FAIL:', err.message)
    }

    // =========================================================================
    // PRUEBA U02: Listar compras y verificar filtros y paginación
    // =========================================================================
    console.log('\n--- EJECUTANDO U02: LISTAR COMPRAS CON FILTROS Y PAGINACIÓN ---')
    try {
      const listResp = await serviceA.list(
        {
          supplierId: supplierAId,
          status: 'BORRADOR',
          page: 1,
          pageSize: 10,
          sortField: 'date',
          sortDirection: 'desc',
        },
        userContextAdminA
      )

      const found = listResp.items.find((p) => p.id === createdPurchaseId)
      if (!found) {
        throw new Error(`La compra creada ${createdPurchaseId} no aparece en el listado filtrado.`)
      }

      testResults.push({
        name: 'U02: Listar compras con filtros y paginación',
        pass: true,
        details: `Total items=${listResp.total}, encontrados en página=${listResp.items.length}`,
      })
      console.log(`✅ [U02] PASS: Compra encontrada en listado con total=${listResp.total}.`)
    } catch (err: any) {
      testResults.push({
        name: 'U02: Listar compras con filtros y paginación',
        pass: false,
        details: err.message,
      })
      console.error('❌ [U02] FAIL:', err.message)
    }

    // =========================================================================
    // PRUEBA U03: Editar BORRADOR vía PurchaseService
    // =========================================================================
    console.log('\n--- EJECUTANDO U03: EDITAR BORRADOR VÍA SERVICE ---')
    try {
      const updateInput: UpdatePurchaseInput = {
        supplierId: supplierAId,
        destinationLocationId: locAId,
        date: '2026-10-02',
        supplierInvoiceNumber: `FAC-MOD-${runId}`,
        paymentType: 'CONTADO',
        notes: 'Nota modificada en paso 3',
        saveAsDraft: true,
        items: [
          {
            productId: productA1Id,
            productName: `Arroz Flor Huila A ${tag}`,
            sku: `SKU-S3-A1-${runId}`,
            unitOfMeasure: 'UND',
            quantity: 30, // Modificado de 20 a 30
            unitCost: 16000, // Modificado de 15000 a 16000
            discountPercent: 0,
            taxCode: 'IVA_19',
            taxRatePercent: 19,
          },
        ],
      }

      const updated = await serviceA.updatePurchase(createdPurchaseId, updateInput, userContextAdminA)
      if (updated.items[0].quantity !== 30 || updated.supplierInvoiceNumber !== `FAC-MOD-${runId}`) {
        throw new Error(`Valores no coinciden: quantity=${updated.items[0]?.quantity}`)
      }

      testResults.push({
        name: 'U03: Editar BORRADOR vía Service',
        pass: true,
        details: `Nueva cantidad=30, Nuevo total=$${updated.total}, Factura=${updated.supplierInvoiceNumber}`,
      })
      console.log(`✅ [U03] PASS: Borrador actualizado correctamente.`)
    } catch (err: any) {
      testResults.push({
        name: 'U03: Editar BORRADOR vía Service',
        pass: false,
        details: err.message,
      })
      console.error('❌ [U03] FAIL:', err.message)
    }

    // =========================================================================
    // PRUEBA U04: Confirmar compra vía PurchaseService sin alterar Kardex
    // =========================================================================
    console.log('\n--- EJECUTANDO U04: CONFIRMAR COMPRA VÍA SERVICE ---')
    try {
      const confirmed = await serviceA.confirmOrder(createdPurchaseId, userContextAdminA)
      if (confirmed.status !== 'CONFIRMADA') {
        throw new Error(`Estado esperado CONFIRMADA, recibido: ${confirmed.status}`)
      }

      // Verificar que confirmar compra NO haya generado movimientos de inventario
      const invMovs = await pgClient.query(`
        SELECT COUNT(*) FROM public.inventory_movements
        WHERE document_reference = '${createdPurchaseId}' OR document_reference = '${confirmed.purchaseNumber}';
      `)
      const count = parseInt(invMovs.rows[0].count, 10)
      if (count !== 0) {
        throw new Error(`¡VIOLACIÓN!: Confirmar orden generó ${count} movimientos de inventario en Kardex.`)
      }

      testResults.push({
        name: 'U04: Confirmar compra sin modificar inventario',
        pass: true,
        details: `Estado=CONFIRMADA, Movimientos inventario generados=${count}`,
      })
      console.log(`✅ [U04] PASS: Orden confirmada sin afectación de Kardex.`)
    } catch (err: any) {
      testResults.push({
        name: 'U04: Confirmar compra sin modificar inventario',
        pass: false,
        details: err.message,
      })
      console.error('❌ [U04] FAIL:', err.message)
    }

    // =========================================================================
    // PRUEBA U05: Impedir edición de orden CONFIRMADA
    // =========================================================================
    console.log('\n--- EJECUTANDO U05: IMPEDIR EDICIÓN DE ORDEN CONFIRMADA ---')
    try {
      const attemptUpdate: UpdatePurchaseInput = {
        supplierId: supplierAId,
        destinationLocationId: locAId,
        date: '2026-10-02',
        supplierInvoiceNumber: `FAC-ILLEGAL`,
        paymentType: 'CONTADO',
        saveAsDraft: true,
        items: [
          {
            productId: productA1Id,
            productName: `Arroz Flor Huila A ${tag}`,
            sku: `SKU-S3-A1-${runId}`,
            unitOfMeasure: 'UND',
            quantity: 999,
            unitCost: 1000,
            discountPercent: 0,
            taxCode: 'IVA_19',
            taxRatePercent: 19,
          },
        ],
      }

      let errorCaught = false
      try {
        await serviceA.updatePurchase(createdPurchaseId, attemptUpdate, userContextAdminA)
      } catch (err: any) {
        errorCaught = true
        testResults.push({
          name: 'U05: Bloquear edición de orden CONFIRMADA',
          pass: true,
          details: `Error capturado correctamente: ${err.message}`,
        })
        console.log(`✅ [U05] PASS: Bloqueado correctamente: ${err.message}`)
      }

      if (!errorCaught) {
        throw new Error('FALLO: Se permitió actualizar una orden confirmada.')
      }
    } catch (err: any) {
      testResults.push({
        name: 'U05: Bloquear edición de orden CONFIRMADA',
        pass: false,
        details: err.message,
      })
      console.error('❌ [U05] FAIL:', err.message)
    }

    // =========================================================================
    // PRUEBA U06: Anular orden con motivo obligatorio
    // =========================================================================
    console.log('\n--- EJECUTANDO U06: ANULAR ORDEN CON MOTIVO OBLIGATORIO ---')
    try {
      // 1. Validar que motivo vacío sea rechazado
      let emptyReasonRejected = false
      try {
        await serviceA.cancelPurchase(createdPurchaseId, '   ', userContextAdminA)
      } catch (err: any) {
        emptyReasonRejected = true
      }

      if (!emptyReasonRejected) {
        throw new Error('FALLO: Se permitió anular sin motivo válido.')
      }

      // 2. Anular con motivo válido
      const cancelled = await serviceA.cancelPurchase(
        createdPurchaseId,
        'Proveedor sin stock para despacho',
        userContextAdminA
      )

      if (cancelled.status !== 'CANCELADA') {
        throw new Error(`Estado esperado CANCELADA, recibido: ${cancelled.status}`)
      }

      testResults.push({
        name: 'U06: Anular orden con motivo obligatorio',
        pass: true,
        details: `Estado=${cancelled.status}, Motivo registrado exitosamente.`,
      })
      console.log(`✅ [U06] PASS: Orden anulada exitosamente con motivo.`)
    } catch (err: any) {
      testResults.push({
        name: 'U06: Anular orden con motivo obligatorio',
        pass: false,
        details: err.message,
      })
      console.error('❌ [U06] FAIL:', err.message)
    }

    // =========================================================================
    // PRUEBA U07: Impedir anulación si tiene mercancía recibida
    // =========================================================================
    console.log('\n--- EJECUTANDO U07: IMPEDIR ANULACIÓN CON MERCANCÍA RECIBIDA ---')
    try {
      const order2Input: CreatePurchaseInput = {
        supplierId: supplierAId,
        destinationLocationId: locAId,
        date: '2026-10-02',
        supplierInvoiceNumber: `FAC-RCV-${runId}`,
        paymentType: 'CONTADO',
        saveAsDraft: false,
        items: [
          {
            productId: productA1Id,
            productName: `Arroz Flor Huila A ${tag}`,
            sku: `SKU-S3-A1-${runId}`,
            unitOfMeasure: 'UND',
            quantity: 10,
            unitCost: 15000,
            discountPercent: 0,
            taxCode: 'EXENTO',
            taxRatePercent: 0,
          },
        ],
      }
      const order2 = await serviceA.createPurchase(order2Input, userContextAdminA)

      // Marcar ítem como recibido en BD
      await pgClient.query(`
        UPDATE public.purchase_items
        SET received_quantity = 5
        WHERE purchase_id = '${order2.id}';
      `)

      let rcvBlocked = false
      try {
        await serviceA.cancelPurchase(order2.id, 'Intento anulación', userContextAdminA)
      } catch (err: any) {
        rcvBlocked = true
        testResults.push({
          name: 'U07: Impedir anulación con mercancía recibida',
          pass: true,
          details: `Rechazado por backend: ${err.message}`,
        })
        console.log(`✅ [U07] PASS: Rechazado correctamente: ${err.message}`)
      }

      if (!rcvBlocked) {
        throw new Error('FALLO: Se permitió anular una orden con unidades recibidas.')
      }
    } catch (err: any) {
      testResults.push({
        name: 'U07: Impedir anulación con mercancía recibida',
        pass: false,
        details: err.message,
      })
      console.error('❌ [U07] FAIL:', err.message)
    }

    // =========================================================================
    // PRUEBA U08: Control de permisos RBAC y ofuscación de costos
    // =========================================================================
    console.log('\n--- EJECUTANDO U08: CONTROL DE PERMISOS RBAC EN SERVICE ---')
    try {
      // 1. Usuario sin permiso 'purchases.create' intenta crear
      let createBlocked = false
      try {
        await serviceA.createPurchase(
          {
            supplierId: supplierAId,
            destinationLocationId: locAId,
            date: '2026-10-02',
            paymentType: 'CONTADO',
            items: [
              {
                productId: productA1Id,
                productName: `Arroz Flor Huila A ${tag}`,
                sku: `SKU-S3-A1-${runId}`,
                unitOfMeasure: 'UND',
                quantity: 1,
                unitCost: 1000,
                discountPercent: 0,
                taxCode: 'EXENTO',
                taxRatePercent: 0,
              },
            ],
          },
          userContextRestrictedA
        )
      } catch (err: any) {
        createBlocked = true
      }

      if (!createBlocked) {
        throw new Error('FALLO: Usuario sin permiso purchases.create pudo crear orden.')
      }

      // 2. Usuario sin permiso 'cost.read' consulta listado -> costos ofuscados
      const listRedacted = await serviceA.list({ page: 1, pageSize: 5 }, userContextRestrictedA)
      if (!listRedacted.isCostRedacted) {
        throw new Error('FALLO: Usuario sin cost.read no recibió flag isCostRedacted=true.')
      }

      const firstItem = listRedacted.items[0]
      if (firstItem && firstItem.total !== 0) {
        throw new Error(`FALLO: Costo no ofuscado en backend: total=${firstItem.total}`)
      }

      testResults.push({
        name: 'U08: Control de permisos RBAC y ofuscación de costos',
        pass: true,
        details: `purchases.create bloqueado para operador, cost.read ofuscó montos (isCostRedacted=true).`,
      })
      console.log(`✅ [U08] PASS: Permisos RBAC y ofuscación de costos validados.`)
    } catch (err: any) {
      testResults.push({
        name: 'U08: Control de permisos RBAC y ofuscación de costos',
        pass: false,
        details: err.message,
      })
      console.error('❌ [U08] FAIL:', err.message)
    }

    // =========================================================================
    // PRUEBA U09: Aislamiento multi-tenant en listado
    // =========================================================================
    console.log('\n--- EJECUTANDO U09: AISLAMIENTO MULTI-TENANT EN SERVICE ---')
    try {
      const orderB = await serviceB.createPurchase(
        {
          supplierId: supplierBId,
          destinationLocationId: locBId,
          date: '2026-10-02',
          supplierInvoiceNumber: `FAC-S3-B-${runId}`,
          paymentType: 'CONTADO',
          saveAsDraft: true,
          items: [
            {
              productId: productB1Id,
              productName: `Aceite Girasol B ${tag}`,
              sku: `SKU-S3-B1-${runId}`,
              unitOfMeasure: 'UND',
              quantity: 5,
              unitCost: 22000,
              discountPercent: 0,
              taxCode: 'EXENTO',
              taxRatePercent: 0,
            },
          ],
        },
        userContextAdminB
      )

      // Usuario A consulta y NO debe ver la orden de Empresa B
      const listA = await serviceA.list({ page: 1, pageSize: 50 }, userContextAdminA)
      const leakedOrder = listA.items.find((p) => p.id === orderB.id)

      if (leakedOrder) {
        throw new Error(`¡VIOLACIÓN MULTI-TENANT!: Usuario A puede ver la orden ${orderB.id} de Empresa B.`)
      }

      testResults.push({
        name: 'U09: Aislamiento multi-tenant en Service',
        pass: true,
        details: `Orden Empresa B (${orderB.purchaseNumber}) completamente invisible para Empresa A.`,
      })
      console.log(`✅ [U09] PASS: Aislamiento multi-tenant confirmado.`)
    } catch (err: any) {
      testResults.push({
        name: 'U09: Aislamiento multi-tenant en Service',
        pass: false,
        details: err.message,
      })
      console.error('❌ [U09] FAIL:', err.message)
    }
  } finally {
    // =========================================================================
    // LIMPIEZA ZERO POLLUTION EN STAGING
    // =========================================================================
    console.log('\n--- PURGA ZERO POLLUTION EN STAGING ---')
    try {
      await pgClient.query("SELECT set_config('app.is_test_cleanup', 'true', false);")

      await pgClient.query(`
        DELETE FROM public.purchase_items
        WHERE purchase_id IN (
          SELECT id FROM public.purchases
          WHERE supplier_invoice_number LIKE '%' || $1 || '%' OR company_id = $2
        );
      `, [runId, companyBId])

      await pgClient.query(`
        DELETE FROM public.purchases
        WHERE supplier_invoice_number LIKE '%' || $1 || '%' OR company_id = $2;
      `, [runId, companyBId])

      await pgClient.query("DELETE FROM public.products WHERE sku LIKE '%' || $1 || '%';", [runId])
      await pgClient.query("DELETE FROM public.categories WHERE code LIKE '%' || $1 || '%';", [runId])
      await pgClient.query("DELETE FROM public.suppliers WHERE email LIKE '%' || $1 || '%' OR tax_id LIKE '%' || $1 || '%';", [runId])

      if (locBId) await pgClient.query("DELETE FROM public.user_locations WHERE location_id = $1;", [locBId])
      if (locBId) await pgClient.query("DELETE FROM public.locations WHERE id = $1;", [locBId])

      if (authUserAId) await pgClient.query("DELETE FROM public.user_locations WHERE user_id = $1;", [authUserAId])
      if (authUserBId) await pgClient.query("DELETE FROM public.user_locations WHERE user_id = $1;", [authUserBId])

      if (authUserAId) await pgClient.query("DELETE FROM public.users WHERE id = $1;", [authUserAId])
      if (authUserBId) await pgClient.query("DELETE FROM public.users WHERE id = $1;", [authUserBId])

      if (authUserAId) await adminSupabase.auth.admin.deleteUser(authUserAId)
      if (authUserBId) await adminSupabase.auth.admin.deleteUser(authUserBId)

      await pgClient.query(`
        DELETE FROM public.audit_logs
        WHERE company_id = $1 OR user_name LIKE '%' || $2 || '%';
      `, [companyBId, runId])

      if (companyBId) await pgClient.query("DELETE FROM public.companies WHERE id = $1;", [companyBId])

      await pgClient.query("SELECT set_config('app.is_test_cleanup', 'false', false);")

      const check = await pgClient.query(`
        SELECT
          (SELECT COUNT(*) FROM public.purchases WHERE supplier_invoice_number LIKE '%${runId}%') AS purchases,
          (SELECT COUNT(*) FROM public.products WHERE sku LIKE '%${runId}%') AS products,
          (SELECT COUNT(*) FROM public.companies WHERE id = '${companyBId}') AS companies;
      `)

      const counts = check.rows[0]
      console.log('📊 Conteo residual en PostgreSQL Staging:')
      console.log(`   - Compras residuales:   ${counts.purchases}`)
      console.log(`   - Productos residuales: ${counts.products}`)
      console.log(`   - Empresa B residual:   ${counts.companies}`)

      if (counts.purchases === '0' && counts.products === '0' && counts.companies === '0') {
        console.log('✅ ZERO POLLUTION COMPROBADO AL 100% (0 RESIDUOS).\n')
      } else {
        console.warn('⚠️ Alerta: Quedaron residuos en staging.')
      }
    } catch (cleanupErr: any) {
      console.error('Error durante limpieza Zero Pollution:', cleanupErr.message)
    }

    await pgClient.end()
  }

  // =========================================================================
  // RESUMEN FINAL
  // =========================================================================
  console.log('================================================================================')
  console.log('📋 RESUMEN FINAL DE PRUEBAS PASO 3 (UI / SERVICE FLOW)')
  console.log('================================================================================')
  let passedCount = 0
  for (const r of testResults) {
    const symbol = r.pass ? '✅ [PASS]' : '❌ [FAIL]'
    console.log(`${symbol} ${r.name}`)
    if (r.details) console.log(`   Detalle: ${r.details}`)
    if (r.pass) passedCount++
  }
  console.log(`\nTOTAL: ${testResults.length} | APROBADAS: ${passedCount} | FALLIDAS: ${testResults.length - passedCount}`)

  if (passedCount === testResults.length) {
    console.log('🏆 TODAS LAS PRUEBAS DEL PASO 3 FUERON SUPERADAS AL 100% (PASS).\n')
  } else {
    console.error('💥 ALGUNAS PRUEBAS FALLARON.\n')
    process.exit(1)
  }
}

runStep3TestSuite().catch((err) => {
  console.error('Error fatal ejecutando suite Paso 3:', err)
  process.exit(1)
})
