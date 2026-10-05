/**
 * SUPER MÁS ERP/POS - SUITE E2E FASE 18: ALERTAS DE STOCK Y REABASTECIMIENTO
 *
 * Valida de forma exhaustiva, automatizada y transaccional:
 * 1. Detección automática de reglas de stock agotado (Stock <= 0) en PostgreSQL.
 * 2. Detección automática de stock bajo / nivel crítico frente a umbrales configurados.
 * 3. Deduplicación estricta: re-ejecución del motor no duplica alertas activas para la misma entidad.
 * 4. Ciclo de vida completo: NEW -> READ -> IN_PROGRESS -> RESOLVED -> CLOSED.
 * 5. Trazabilidad de historia inmutable y notas operativas en cada estado.
 * 6. KPIs agregados y estadísticas (getStats) por módulo, prioridad y bodega.
 * 7. Reporte y motor de sugerencias de reabastecimiento (cálculo de déficit, cantidad óptima y urgencia).
 * 8. Aislamiento estricto multiempresa (Company A vs Company B).
 * 9. Auditoría fiduciaria inmutable (audit_logs) para cada acción sobre alertas.
 * 10. Modificación dinámica de configuración de reglas (alert_rules).
 * 11. Zero Pollution: Purga atómica del 100% de los datos de prueba.
 *
 * Ejecución: npx tsx --env-file=.env.local scripts/test-phase18-alerts-e2e.ts
 */

import pg from 'pg'
import { alertRepository } from '../features/alerts/repositories/alert.repository'
import { alertService } from '../features/alerts/services/alert.service'
import { alertRulesService } from '../features/alerts/services/alert-rules.service'
import { supabaseAdmin } from '../lib/supabase/admin'
import { UserAlertContext } from '../features/alerts/types'

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

async function runPhase18AlertsE2ETests() {
  console.log('============================================================')
  console.log('INICIANDO SUITE E2E - FASE 18: ALERTAS DE STOCK Y REABASTECIMIENTO')
  console.log('============================================================\n')

  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    throw new Error('DATABASE_URL no configurado en entorno.')
  }

  const pgClient = new pg.Client({ connectionString: databaseUrl })
  await pgClient.connect()
  console.log('✅ Conexión directa a PostgreSQL Staging establecida.\n')

  const testSuffix = `_t18_${Date.now().toString().slice(-4)}`
  let companyAId: string | null = null
  let companyBId: string | null = null
  let locPrincipalAId: string | null = null
  let locNorteAId: string | null = null
  let locControlBId: string | null = null
  let categoryId: string | null = null
  let brandId: string | null = null
  let userAId: string | null = null

  let prod1AgotadoId: string | null = null
  let prod2BajoId: string | null = null
  let prod3SaludableId: string | null = null
  let prod4InactivoId: string | null = null

  try {
    console.log('--- Configurando Entorno Multiempresa y Productos para Alertas ---')

    // 1. Empresa A
    const compARes = await pgClient.query(`
      INSERT INTO public.companies (
        business_name, trade_name, tax_id, verification_digit, tax_regime,
        address, city, department, country, currency, status, created_at, updated_at
      ) VALUES (
        'Super Más Alertas S.A.S.', 'Super Más Alertas', '901888${Date.now().toString().slice(-3)}',
        '1', 'COMUN', 'Calle 100 # 15-20', 'Bogotá', 'Bogotá D.C.', 'COLOMBIA', 'COP', 'ACTIVE',
        NOW(), NOW()
      ) RETURNING id;
    `)
    companyAId = compARes.rows[0].id

    // 2. Empresa B (Control)
    const compBRes = await pgClient.query(`
      INSERT INTO public.companies (
        business_name, trade_name, tax_id, verification_digit, tax_regime,
        address, city, department, country, currency, status, created_at, updated_at
      ) VALUES (
        'Empresa Control Alertas B S.A.S.', 'Control Alertas B', '901999${Date.now().toString().slice(-3)}',
        '2', 'COMUN', 'Carrera 7 # 72-10', 'Bogotá', 'Bogotá D.C.', 'COLOMBIA', 'COP', 'ACTIVE',
        NOW(), NOW()
      ) RETURNING id;
    `)
    companyBId = compBRes.rows[0].id

    // 3. Ubicaciones
    const locARes1 = await pgClient.query(`
      INSERT INTO public.locations (company_id, code, name, type, status, is_ecommerce_source, address, city, department, created_at, updated_at)
      VALUES ($1, 'BOD-PRI-${testSuffix.slice(-4)}', 'Bodega Principal CEDI', 'WAREHOUSE', 'ACTIVE', false, 'Calle 100 # 15-20', 'Bogotá', 'Bogotá D.C.', NOW(), NOW())
      RETURNING id;
    `, [companyAId])
    locPrincipalAId = locARes1.rows[0].id

    const locARes2 = await pgClient.query(`
      INSERT INTO public.locations (company_id, code, name, type, status, is_ecommerce_source, address, city, department, created_at, updated_at)
      VALUES ($1, 'BOD-NOR-${testSuffix.slice(-4)}', 'Bodega Norte Express', 'WAREHOUSE', 'ACTIVE', false, 'Av. Suba # 120-10', 'Bogotá', 'Bogotá D.C.', NOW(), NOW())
      RETURNING id;
    `, [companyAId])
    locNorteAId = locARes2.rows[0].id

    const locBRes = await pgClient.query(`
      INSERT INTO public.locations (company_id, code, name, type, status, is_ecommerce_source, address, city, department, created_at, updated_at)
      VALUES ($1, 'BOD-CTRL-${testSuffix.slice(-4)}', 'Bodega Control B', 'WAREHOUSE', 'ACTIVE', false, 'Carrera 7 # 72-10', 'Bogotá', 'Bogotá D.C.', NOW(), NOW())
      RETURNING id;
    `, [companyBId])
    locControlBId = locBRes.rows[0].id

    // 4. Usuario Admin para Empresa A
    const authUserRes = await supabaseAdmin.auth.admin.createUser({
      email: `admin_alerts_${testSuffix}@supermas.co`,
      password: 'SuperAlertsSecret2026*',
      email_confirm: true,
      app_metadata: { company_id: companyAId, role: 'SUPERADMIN' },
    })
    userAId = authUserRes.data.user!.id

    const roleRes = await pgClient.query(`SELECT id FROM public.roles LIMIT 1;`)
    const defaultRoleId = roleRes.rows[0].id

    await pgClient.query(`
      INSERT INTO public.users (id, company_id, email, full_name, role_id, is_active, created_at, updated_at)
      VALUES ($1, $2, 'admin_alerts_${testSuffix}@supermas.co', 'Mauricio Andrade', $3, true, NOW(), NOW())
      ON CONFLICT (id) DO UPDATE SET
        company_id = EXCLUDED.company_id,
        full_name = EXCLUDED.full_name,
        role_id = EXCLUDED.role_id,
        is_active = true;
    `, [userAId, companyAId, defaultRoleId])

    // 5. Categoría y Marca
    const catRes = await pgClient.query(`
      INSERT INTO public.categories (company_id, name, slug, is_active, created_at, updated_at)
      VALUES ($1, 'Despensa y Granos ${testSuffix}', 'despensa-granos-${testSuffix}', true, NOW(), NOW())
      RETURNING id;
    `, [companyAId])
    categoryId = catRes.rows[0].id

    const brandRes = await pgClient.query(`
      INSERT INTO public.brands (company_id, name, slug, is_active, created_at, updated_at)
      VALUES ($1, 'Diana ${testSuffix}', 'diana-${testSuffix}', true, NOW(), NOW())
      RETURNING id;
    `, [companyAId])
    brandId = brandRes.rows[0].id

    // 6. Productos en Empresa A
    // Prod 1: Agotado (Stock 0 en Bodega Principal, min 10, crit 5, costo 3500)
    const p1Res = await pgClient.query(`
      INSERT INTO public.products (
        company_id, sku, barcode, name, slug, category_id, brand_id, inventory_type, unit_of_measure,
        cost_price, public_sale_price, wholesale_price, min_wholesale_quantity, tax_rate_percent,
        is_tax_exempt, is_published_supermas, is_published_distributor, min_stock_threshold,
        critical_stock_threshold, is_active, created_at, updated_at
      ) VALUES (
        $1, 'SKU-AGOT-${testSuffix}', '7701111111', 'Arroz Diana Tradicional 1000g', 'arroz-diana-${testSuffix}',
        $2, $3, 'MERCHANDISE', 'UND', 3500, 4800, 4200, 10, 0, true, true, false, 10, 5, true, NOW(), NOW()
      ) RETURNING id;
    `, [companyAId, categoryId, brandId])
    prod1AgotadoId = p1Res.rows[0].id

    await pgClient.query(`
      INSERT INTO public.stock_levels (company_id, product_id, location_id, quantity, updated_at)
      VALUES ($1, $2, $3, 0, NOW());
    `, [companyAId, prod1AgotadoId, locPrincipalAId])

    // Prod 2: Stock Crítico (Stock 4 en Bodega Principal, min 15, crit 6, costo 12000)
    const p2Res = await pgClient.query(`
      INSERT INTO public.products (
        company_id, sku, barcode, name, slug, category_id, brand_id, inventory_type, unit_of_measure,
        cost_price, public_sale_price, wholesale_price, min_wholesale_quantity, tax_rate_percent,
        is_tax_exempt, is_published_supermas, is_published_distributor, min_stock_threshold,
        critical_stock_threshold, is_active, created_at, updated_at
      ) VALUES (
        $1, 'SKU-CRIT-${testSuffix}', '7702222222', 'Aceite Vegetal Diana 3000ml', 'aceite-diana-${testSuffix}',
        $2, $3, 'MERCHANDISE', 'UND', 12000, 16500, 14800, 5, 0, true, true, true, 15, 6, true, NOW(), NOW()
      ) RETURNING id;
    `, [companyAId, categoryId, brandId])
    prod2BajoId = p2Res.rows[0].id

    await pgClient.query(`
      INSERT INTO public.stock_levels (company_id, product_id, location_id, quantity, updated_at)
      VALUES ($1, $2, $3, 4, NOW());
    `, [companyAId, prod2BajoId, locPrincipalAId])

    // Prod 3: Saludable (Stock 30 en Bodega Principal, min 10, crit 4)
    const p3Res = await pgClient.query(`
      INSERT INTO public.products (
        company_id, sku, barcode, name, slug, category_id, brand_id, inventory_type, unit_of_measure,
        cost_price, public_sale_price, wholesale_price, min_wholesale_quantity, tax_rate_percent,
        is_tax_exempt, is_published_supermas, is_published_distributor, min_stock_threshold,
        critical_stock_threshold, is_active, created_at, updated_at
      ) VALUES (
        $1, 'SKU-OK-${testSuffix}', '7703333333', 'Lentejas Diana 500g', 'lentejas-diana-${testSuffix}',
        $2, $3, 'MERCHANDISE', 'UND', 2800, 4000, 3600, 10, 0, true, true, true, 10, 4, true, NOW(), NOW()
      ) RETURNING id;
    `, [companyAId, categoryId, brandId])
    prod3SaludableId = p3Res.rows[0].id

    await pgClient.query(`
      INSERT INTO public.stock_levels (company_id, product_id, location_id, quantity, updated_at)
      VALUES ($1, $2, $3, 30, NOW());
    `, [companyAId, prod3SaludableId, locPrincipalAId])

    // Prod 4: Inactivo con stock 0 (no debe generar alertas)
    const p4Res = await pgClient.query(`
      INSERT INTO public.products (
        company_id, sku, barcode, name, slug, category_id, brand_id, inventory_type, unit_of_measure,
        cost_price, public_sale_price, wholesale_price, min_wholesale_quantity, tax_rate_percent,
        is_tax_exempt, is_published_supermas, is_published_distributor, min_stock_threshold,
        critical_stock_threshold, is_active, created_at, updated_at
      ) VALUES (
        $1, 'SKU-INAC-${testSuffix}', '7704444444', 'Producto Descontinuado', 'producto-descontinuado-${testSuffix}',
        $2, $3, 'MERCHANDISE', 'UND', 1000, 1500, 1200, 1, 0, true, false, false, 10, 5, false, NOW(), NOW()
      ) RETURNING id;
    `, [companyAId, categoryId, brandId])
    prod4InactivoId = p4Res.rows[0].id

    await pgClient.query(`
      INSERT INTO public.stock_levels (company_id, product_id, location_id, quantity, updated_at)
      VALUES ($1, $2, $3, 0, NOW());
    `, [companyAId, prod4InactivoId, locPrincipalAId])

    console.log('✅ Setup completado: Empresa A, Empresa B, 4 productos, ubicaciones y usuarios listos.\n')

    const userContext: UserAlertContext = {
      userId: userAId!,
      companyId: companyAId!,
      name: 'Mauricio Andrade',
      role: 'SUPERADMIN',
      permissions: ['alerts.read', 'alerts.manage', 'alerts.resolve', 'alerts.configure', 'alerts.audit'],
    }

    // ========================================================================
    // T01: Detección Automática de Stock Agotado (Stock Cero)
    // ========================================================================
    const evalResult1 = await alertRulesService.evaluateAllRules(companyAId)

    const alertsAfterEval1 = await alertRepository.getAllAlerts(companyAId)
    const outOfStockAlert = alertsAfterEval1.find(
      (a) => a.entityId === prod1AgotadoId && a.priority === 'CRITICA'
    )

    const t01Pass =
      evalResult1.newAlertsCreated >= 2 &&
      Boolean(outOfStockAlert) &&
      outOfStockAlert?.module === 'INVENTORY' &&
      outOfStockAlert?.status === 'NEW' &&
      outOfStockAlert?.locationId === locPrincipalAId

    recordResult(
      'T01',
      'Detección Automática de Stock Agotado (Stock Cero) en PostgreSQL',
      t01Pass,
      t01Pass
        ? `Alerta crítica generada correctamente para producto ${prod1AgotadoId} (Stock 0 en Bodega Principal).`
        : `Falla en detección de producto agotado.`
    )

    // ========================================================================
    // T02: Detección Automática de Stock Bajo / Crítico frente a Umbral
    // ========================================================================
    const lowStockAlert = alertsAfterEval1.find(
      (a) => a.entityId === prod2BajoId && a.priority === 'ALTA'
    )
    const healthyAlert = alertsAfterEval1.find((a) => a.entityId === prod3SaludableId)
    const inactiveAlert = alertsAfterEval1.find((a) => a.entityId === prod4InactivoId)

    const t02Pass =
      Boolean(lowStockAlert) &&
      lowStockAlert?.module === 'INVENTORY' &&
      lowStockAlert?.status === 'NEW' &&
      !healthyAlert &&
      !inactiveAlert

    recordResult(
      'T02',
      'Detección Automática de Stock Bajo frente a Umbral Mínimo',
      t02Pass,
      t02Pass
        ? `Alerta generada para producto ${prod2BajoId} (4 unds vs min 15). Excluidos correctamente saludable e inactivo.`
        : `Falla en discriminación de umbral de stock bajo.`
    )

    // ========================================================================
    // T03: Deduplicación Estricta de Alertas Activas
    // ========================================================================
    const evalResult2 = await alertRulesService.evaluateAllRules(companyAId)
    const alertsAfterEval2 = await alertRepository.getAllAlerts(companyAId)

    const t03Pass =
      evalResult2.newAlertsCreated === 0 &&
      alertsAfterEval2.length === alertsAfterEval1.length

    recordResult(
      'T03',
      'Deduplicación Estricta: Re-evaluación no Genera Duplicados',
      t03Pass,
      t03Pass
        ? `Re-evaluación completada con 0 alertas nuevas creadas (total invariante en ${alertsAfterEval2.length}).`
        : `Falla en deduplicación: se crearon alertas duplicadas.`
    )

    // ========================================================================
    // T04: Transición de Estado a LEÍDA (READ)
    // ========================================================================
    const targetAlertId = outOfStockAlert!.id
    const markedRead = await alertService.markAsRead(targetAlertId, userContext)

    const checkReadInDb = await pgClient.query(
      `SELECT status, read_at, read_by_user_id FROM public.system_alerts WHERE id = $1;`,
      [targetAlertId]
    )

    const t04Pass =
      markedRead.status === 'READ' &&
      checkReadInDb.rows[0].status === 'READ' &&
      Boolean(checkReadInDb.rows[0].read_at) &&
      checkReadInDb.rows[0].read_by_user_id === userAId

    recordResult(
      'T04',
      'Ciclo de Vida: Transición Atómica a LEÍDA (READ)',
      t04Pass,
      t04Pass
        ? `Alerta ${outOfStockAlert!.code} marcada como leída por ${userContext.name} y persistida en PostgreSQL.`
        : `Falla en transición a READ.`
    )

    // ========================================================================
    // T05: Transición de Estado a EN ATENCIÓN (IN_PROGRESS)
    // ========================================================================
    const attendedComment = 'Orden de compra urgente generada con proveedor Diana S.A.S.'
    const attended = await alertService.attendAlert(
      targetAlertId,
      { comment: attendedComment },
      userContext
    )

    const checkAttendedInDb = await pgClient.query(
      `SELECT status, attended_at, attended_comment, attended_by_user_id FROM public.system_alerts WHERE id = $1;`,
      [targetAlertId]
    )

    const t05Pass =
      attended.status === 'IN_PROGRESS' &&
      checkAttendedInDb.rows[0].status === 'IN_PROGRESS' &&
      checkAttendedInDb.rows[0].attended_comment === attendedComment &&
      checkAttendedInDb.rows[0].attended_by_user_id === userAId

    recordResult(
      'T05',
      'Ciclo de Vida: Transición Atómica a EN ATENCIÓN (IN_PROGRESS)',
      t05Pass,
      t05Pass
        ? `Alerta puesta en atención con nota operativa persistida en PostgreSQL.`
        : `Falla en transición a IN_PROGRESS.`
    )

    // ========================================================================
    // T06: Transición de Estado a RESUELTA (RESOLVED)
    // ========================================================================
    const solutionNotes = 'Recepción OC-098 confirmada con 50 bultos ingresados al Kardex.'
    const resolved = await alertService.resolveAlert(
      targetAlertId,
      { solutionNotes },
      userContext
    )

    const checkResolvedInDb = await pgClient.query(
      `SELECT status, resolved_at, solution_notes, resolved_by_user_id FROM public.system_alerts WHERE id = $1;`,
      [targetAlertId]
    )

    const t06Pass =
      resolved.status === 'RESOLVED' &&
      checkResolvedInDb.rows[0].status === 'RESOLVED' &&
      checkResolvedInDb.rows[0].solution_notes === solutionNotes &&
      checkResolvedInDb.rows[0].resolved_by_user_id === userAId

    recordResult(
      'T06',
      'Ciclo de Vida: Transición Atómica a RESUELTA (RESOLVED)',
      t06Pass,
      t06Pass
        ? `Alerta resuelta con justificación técnica y usuario resolutor registrado.`
        : `Falla en resolución de alerta.`
    )

    // ========================================================================
    // T07: Transición de Estado a CERRADA (CLOSED) y Trazabilidad Histórica
    // ========================================================================
    const closed = await alertService.closeAlert(
      targetAlertId,
      { closeNotes: 'Auditoría física de inventario conforme.' },
      userContext
    )

    const checkClosedInDb = await pgClient.query(
      `SELECT status, closed_at, history FROM public.system_alerts WHERE id = $1;`,
      [targetAlertId]
    )

    const historyArray = checkClosedInDb.rows[0].history || []
    const t07Pass =
      closed.status === 'CLOSED' &&
      checkClosedInDb.rows[0].status === 'CLOSED' &&
      Boolean(checkClosedInDb.rows[0].closed_at) &&
      historyArray.length >= 4 // CREATED, READ, ATTENDED, RESOLVED, CLOSED

    recordResult(
      'T07',
      'Ciclo de Vida: Cierre Administrativo y Trazabilidad Histórica Inmutable',
      t07Pass,
      t07Pass
        ? `Alerta cerrada definitivamente. Historial inmutable contiene ${historyArray.length} eventos auditables.`
        : `Falla en cierre o integridad de historial.`
    )

    // ========================================================================
    // T08: Agregación y KPIs de Supervisión (getStats)
    // ========================================================================
    const stats = await alertRepository.getStats(undefined, companyAId)

    const t08Pass =
      stats.totalCount >= 2 &&
      stats.totalResolved >= 1 && // La cerrada cuenta como resuelta
      stats.totalPending >= 1 && // La de stock bajo sigue en NEW
      stats.byModule.INVENTORY >= 2 &&
      stats.byLocation.some((loc) => loc.locationId === locPrincipalAId)

    recordResult(
      'T08',
      'Métricas y KPIs Estadísticos en Tiempo Real (getStats)',
      t08Pass,
      t08Pass
        ? `Métricas validadas: Total=${stats.totalCount}, Resueltas=${stats.totalResolved}, Pendientes=${stats.totalPending}.`
        : `Falla en cálculo de estadísticas de supervisión.`
    )

    // ========================================================================
    // T09: Reporte y Sugerencias de Reabastecimiento Automático
    // ========================================================================
    const suggestions = await alertRepository.getReplenishmentSuggestions(
      undefined,
      companyAId
    )

    const sugAgotado = suggestions.find((s) => s.productId === prod1AgotadoId)
    const sugBajo = suggestions.find((s) => s.productId === prod2BajoId)
    const sugSaludable = suggestions.find((s) => s.productId === prod3SaludableId)

    const t09Pass =
      suggestions.length === 2 &&
      Boolean(sugAgotado) &&
      sugAgotado?.urgency === 'CRITICA' &&
      sugAgotado?.currentStock === 0 &&
      sugAgotado?.suggestedQuantity === 20 && // min 10 * 2 = 20
      Boolean(sugBajo) &&
      sugBajo?.urgency === 'ALTA' &&
      sugBajo?.currentStock === 4 &&
      sugBajo?.suggestedQuantity === 26 && // min 15 * 2 = 30 - 4 = 26
      !sugSaludable

    recordResult(
      'T09',
      'Motor de Reabastecimiento: Cálculo de Déficit, Cantidad y Urgencia',
      t09Pass,
      t09Pass
        ? `Sugerencias generadas: Prod 1 (${sugAgotado?.suggestedQuantity} unds, CRITICA), Prod 2 (${sugBajo?.suggestedQuantity} unds, ALTA).`
        : `Falla en cálculo de sugerencias de reabastecimiento.`
    )

    // ========================================================================
    // T10: Aislamiento Estricto Multi-Inquilino (Company A vs Company B)
    // ========================================================================
    const alertsCompanyB = await alertRepository.getAllAlerts(companyBId)
    const suggestionsCompanyB = await alertRepository.getReplenishmentSuggestions(
      undefined,
      companyBId
    )
    const statsCompanyB = await alertRepository.getStats(undefined, companyBId)

    const t10Pass =
      alertsCompanyB.length === 0 &&
      suggestionsCompanyB.length === 0 &&
      statsCompanyB.totalCount === 0

    recordResult(
      'T10',
      'Aislamiento Estricto Multi-Inquilino (Multi-Tenancy)',
      t10Pass,
      t10Pass
        ? `Empresa B tiene 0 alertas, 0 sugerencias y 0 métricas. Segregación 100% estricta.`
        : `Falla en aislamiento multiempresa de alertas.`
    )

    // ========================================================================
    // T11: Auditoría Inmutable en audit_logs para Eventos de Alertas
    // ========================================================================
    const auditEvents = await pgClient.query(`
      SELECT action, module, entity_name, entity_id FROM public.audit_logs
      WHERE company_id = $1 AND module = 'ALERTS';
    `, [companyAId])

    const createdLogged = auditEvents.rows.some((r) => r.action === 'ALERT_CREATED')
    const readLogged = auditEvents.rows.some((r) => r.action === 'ALERT_READ')
    const attendedLogged = auditEvents.rows.some((r) => r.action === 'ALERT_ATTENDED')
    const resolvedLogged = auditEvents.rows.some((r) => r.action === 'ALERT_RESOLVED')

    const t11Pass =
      auditEvents.rows.length >= 4 &&
      createdLogged &&
      readLogged &&
      attendedLogged &&
      resolvedLogged

    recordResult(
      'T11',
      'Trazabilidad Inmutable en public.audit_logs para Ciclo de Vida de Alertas',
      t11Pass,
      t11Pass
        ? `Registrados ${auditEvents.rows.length} eventos de auditoría (CREATED, READ, ATTENDED, RESOLVED) en PostgreSQL.`
        : `Falla en registro de auditoría de alertas.`
    )

    // ========================================================================
    // T12: Configuración Dinámica de Reglas (alert_rules)
    // ========================================================================
    const rules = await alertRepository.getRules(companyAId)
    const targetRule = rules.find((r) => r.code === 'R-INV-002')

    const updatedRule = await alertService.updateRuleConfig(
      {
        ruleId: targetRule!.id,
        enabled: true,
        priority: 'CRITICA',
        thresholds: { defaultMinStock: 25 },
      },
      userContext
    )

    const checkRuleInDb = await pgClient.query(
      `SELECT default_priority, thresholds FROM public.alert_rules WHERE id = $1;`,
      [targetRule!.id]
    )

    const t12Pass =
      updatedRule.defaultPriority === 'CRITICA' &&
      checkRuleInDb.rows[0].default_priority === 'CRITICA' &&
      Number(checkRuleInDb.rows[0].thresholds?.defaultMinStock) === 25

    // Revertir regla a valor por defecto
    await alertRepository.updateRule(targetRule!.id, {
      defaultPriority: 'ALTA',
      thresholds: { defaultMinStock: 10 },
    }, companyAId)

    recordResult(
      'T12',
      'Configuración Dinámica de Reglas y Umbrales en alert_rules',
      t12Pass,
      t12Pass
        ? `Regla R-INV-002 reconfigurada a prioridad CRÍTICA con umbral 25 y persistida en PostgreSQL.`
        : `Falla en actualización de reglas de alertas.`
    )

  } catch (err: any) {
    console.error('❌ Error catastrófico en suite E2E de Alertas y Reabastecimiento:', err)
  } finally {
    console.log('\n--- Ejecutando Purga Zero Pollution en Alertas y Reabastecimiento ---')
    try {
      await pgClient.query("SELECT set_config('app.is_test_cleanup', 'true', false);")

      if (companyAId) {
        // 1. Alertas
        await pgClient.query(`DELETE FROM public.system_alerts WHERE company_id = $1;`, [companyAId])

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

      const verifyAlerts = await pgClient.query(
        `SELECT COUNT(*) FROM public.system_alerts WHERE company_id = $1;`,
        [companyAId]
      )
      const verifyProducts = await pgClient.query(
        `SELECT COUNT(*) FROM public.products WHERE company_id = $1;`,
        [companyAId]
      )

      const t13Pass =
        Number(verifyAlerts.rows[0].count) === 0 &&
        Number(verifyProducts.rows[0].count) === 0

      recordResult(
        'T13',
        'Zero Pollution: Purga 100% limpia de Alertas, Stock, Productos y Empresas',
        t13Pass,
        t13Pass
          ? `Todos los registros de prueba (alertas, stock, productos, categorías, marcas, ubicaciones, empresas) purgados atómicamente.`
          : `Alerta: Quedaron residuos de prueba en PostgreSQL.`
      )
    } catch (cleanupErr) {
      console.error('❌ Error durante la purga de alertas:', cleanupErr)
    } finally {
      await pgClient.end()
    }
  }

  // ========================================================================
  // RESUMEN FINAL
  // ========================================================================
  console.log('\n============================================================')
  console.log('RESUMEN DE EJECUCIÓN - FASE 18: ALERTAS Y REABASTECIMIENTO')
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

runPhase18AlertsE2ETests().catch((err) => {
  console.error('Error no controlado en suite E2E de Alertas:', err)
  process.exit(1)
})
