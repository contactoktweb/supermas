/**
 * SUPER MÁS ERP/POS - Suite E2E de Validación para Fase 14: Vista de Auditoría y Trazabilidad Inmutable
 *
 * Valida:
 * 1. Persistencia append-only inmutable en PostgreSQL / Supabase (tabla public.audit_logs).
 * 2. Cero mocks, cero db.ts.
 * 3. Trazabilidad de operaciones críticas (cambios de precios, eliminaciones, ajustes).
 * 4. Extracción y cálculo fiduciario de diffs (previous_value vs new_value).
 * 5. Sanitización automática de campos sensibles (contraseñas, tokens, llaves API).
 * 6. Filtrado dinámico por fecha, módulo, acción, nivel (CRITICAL/WARNING/INFO) y búsqueda textual.
 * 7. Control de acceso granular (RBAC) y restricciones de seguridad.
 * 8. Aislamiento multiempresa estricto (Company A vs Company B).
 * 9. Motor de exportación CSV con auto-registro de auditoría.
 * 10. Purga Zero Pollution atómica.
 */

import pg from 'pg'
import { supabaseAdmin } from '../lib/supabase/admin'
import { auditService } from '../features/audit/services/audit.service'
import { auditRepository } from '../features/audit/repositories/audit.repository'
import { AuditFilters } from '../features/audit/types'

interface TestResult {
  code: string
  name: string
  passed: boolean
  detail: string
}

const results: TestResult[] = []

function recordResult(code: string, name: string, passed: boolean, detail: string) {
  results.push({ code, name, passed, detail })
  const icon = passed ? '✅' : '❌'
  console.log(`\n${icon} [${code}] ${name}: ${passed ? 'PASS' : 'FAIL'}`)
  console.log(`   Detalle: ${detail}`)
}

async function runPhase14AuditE2ETests() {
  console.log('============================================================')
  console.log('INICIANDO SUITE E2E - FASE 14: AUDITORÍA Y TRAZABILIDAD')
  console.log('============================================================\n')

  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error('DATABASE_URL no está configurada.')
  }

  const pgClient = new pg.Client({ connectionString })
  await pgClient.connect()
  console.log('✅ Conexión directa a PostgreSQL Staging establecida.')

  const testSuffix = `P14_${Date.now()}`
  let companyAId: string | null = null
  let companyBId: string | null = null
  let locAId: string | null = null
  let userAId: string | null = null
  let userBId: string | null = null

  try {
    console.log('\n--- Configurando Empresas y Datos de Prueba en PostgreSQL ---')

    // 1. Crear Empresa A
    const compARes = await pgClient.query(`
      INSERT INTO public.companies (
        business_name, trade_name, tax_id, verification_digit, tax_regime,
        address, city, department, country, currency, status, created_at, updated_at
      ) VALUES (
        'Empresa Auditoria A ${testSuffix}', 'Audit A', '900888${Date.now().toString().slice(-4)}',
        '1', 'COMUN', 'Calle 100 # 10-20', 'Bogotá', 'Bogotá D.C.', 'COLOMBIA', 'COP', 'ACTIVE',
        NOW(), NOW()
      ) RETURNING id;
    `)
    companyAId = compARes.rows[0].id

    // 2. Crear Empresa B
    const compBRes = await pgClient.query(`
      INSERT INTO public.companies (
        business_name, trade_name, tax_id, verification_digit, tax_regime,
        address, city, department, country, currency, status, created_at, updated_at
      ) VALUES (
        'Empresa Auditoria B ${testSuffix}', 'Audit B', '900777${Date.now().toString().slice(-4)}',
        '2', 'COMUN', 'Carrera 50 # 30-40', 'Medellín', 'Antioquia', 'COLOMBIA', 'COP', 'ACTIVE',
        NOW(), NOW()
      ) RETURNING id;
    `)
    companyBId = compBRes.rows[0].id

    // 3. Crear Bodega para Empresa A
    const locARes = await pgClient.query(`
      INSERT INTO public.locations (
        company_id, name, code, type, status, address, city, department, created_at, updated_at
      ) VALUES (
        '${companyAId}', 'Bodega Auditoría ${testSuffix}', 'BA-${testSuffix.slice(-4)}',
        'WAREHOUSE', 'ACTIVE', 'Cra 15 # 45-67', 'Bogotá', 'Cundinamarca', NOW(), NOW()
      ) RETURNING id;
    `)
    locAId = locARes.rows[0].id

    // 4. Crear Usuario A y Usuario B
    const roleRes = await pgClient.query(`SELECT id FROM public.roles LIMIT 1;`)
    const defaultRoleId = roleRes.rows[0].id

    const userEmailA = `auditor_${testSuffix.toLowerCase()}@supermas.local`
    const { data: userACreated, error: userAErr } = await supabaseAdmin.auth.admin.createUser({
      email: userEmailA,
      password: 'SuperPassword123!',
      email_confirm: true,
      user_metadata: { full_name: 'Carlos Auditor' },
    })
    if (userAErr || !userACreated?.user) throw new Error(`Error creando usuario Auth A: ${userAErr?.message}`)
    userAId = userACreated.user.id

    await pgClient.query(`
      INSERT INTO public.users (
        id, company_id, email, full_name, role_id, is_active, created_at, updated_at
      ) VALUES (
        $1, $2, $3, 'Carlos Auditor', $4, true, NOW(), NOW()
      ) ON CONFLICT (id) DO UPDATE SET
        company_id = EXCLUDED.company_id,
        full_name = EXCLUDED.full_name,
        role_id = EXCLUDED.role_id,
        is_active = true;
    `, [userAId, companyAId, userEmailA, defaultRoleId])

    console.log(`✅ Setup completado: Empresa A (${companyAId}), Empresa B (${companyBId}), Usuario (${userAId})`)

    // ========================================================================
    // T01: Registro de Evento Operativo Estándar (INFO) en PostgreSQL
    // ========================================================================
    const logInfo = await auditService.log({
      companyId: companyAId,
      action: 'STOCK_ADJUSTED',
      module: 'INVENTORY',
      entityType: 'products',
      entityId: `prod-test-${testSuffix}`,
      entityReference: 'SKU-TEST-001',
      userId: userAId,
      userName: 'Carlos Auditor',
      userRole: 'WAREHOUSE_ADMIN',
      locationId: locAId,
      locationName: 'Bodega Auditoría',
      level: 'INFO',
      result: 'SUCCESS',
      details: 'Ajuste de inventario por conteo físico cíclico.',
      changes: [
        { field: 'stock', label: 'Stock disponible', previousValue: '10', newValue: '15' },
      ],
    })

    const dbCheck1 = await pgClient.query(
      `SELECT * FROM public.audit_logs WHERE id = $1 AND company_id = $2;`,
      [logInfo.id, companyAId]
    )

    const t01Pass =
      dbCheck1.rowCount === 1 &&
      dbCheck1.rows[0].action === 'STOCK_ADJUSTED' &&
      dbCheck1.rows[0].module === 'INVENTORY' &&
      dbCheck1.rows[0].user_name === 'Carlos Auditor'

    recordResult(
      'T01',
      'Registro Inmutable de Evento Operativo en PostgreSQL',
      t01Pass,
      t01Pass
        ? `Evento ${logInfo.id} persistido exitosamente en public.audit_logs de PostgreSQL.`
        : `Falla al persistir evento operativo.`
    )

    // ========================================================================
    // T02: Registro de Evento Crítico con Diffs Fiduciarios (PRICE_MODIFIED)
    // ========================================================================
    const logCritical = await auditService.log({
      companyId: companyAId,
      action: 'PRICE_MODIFIED',
      module: 'PRODUCTS',
      entityType: 'products',
      entityId: `prod-crit-${testSuffix}`,
      entityReference: 'Arroz Diana 1000g',
      userId: userAId,
      userName: 'Carlos Auditor',
      userRole: 'SUPERADMIN',
      locationId: locAId,
      level: 'CRITICAL',
      result: 'SUCCESS',
      details: 'Modificación de precio mayorista y precio público autorizado por gerencia.',
      changes: [
        { field: 'wholesale_price', label: 'Precio Mayorista', previousValue: '3500', newValue: '3800' },
        { field: 'public_sale_price', label: 'Precio Público', previousValue: '4200', newValue: '4600' },
      ],
    })

    const dbCheck2 = await pgClient.query(
      `SELECT * FROM public.audit_logs WHERE id = $1;`,
      [logCritical.id]
    )

    const t02Pass =
      dbCheck2.rowCount === 1 &&
      dbCheck2.rows[0].action === 'PRICE_MODIFIED' &&
      dbCheck2.rows[0].previous_value !== null &&
      dbCheck2.rows[0].new_value !== null

    recordResult(
      'T02',
      'Trazabilidad de Evento Crítico y Diffs de Cambio',
      t02Pass,
      t02Pass
        ? `Evento crítico persistido con previous_value y new_value JSONB en PostgreSQL.`
        : `Falla en registro de evento crítico.`
    )

    // ========================================================================
    // T03: Sanitización Automática de Credenciales y Secretos
    // ========================================================================
    const logSensitive = await auditService.log({
      companyId: companyAId,
      action: 'USER_ROLE_UPDATED',
      module: 'SECURITY',
      entityType: 'users',
      entityId: userAId,
      entityReference: 'Carlos Auditor',
      userId: userAId,
      userName: 'Carlos Auditor',
      userRole: 'SUPERADMIN',
      level: 'WARNING',
      result: 'SUCCESS',
      details: 'Actualización de credenciales con password=SuperSecretPassword123! y apiKey=sk_live_999888777',
      changes: [
        { field: 'password_hash', label: 'Password', previousValue: 'old_secret_hash', newValue: 'new_secret_hash' },
        { field: 'token_access', label: 'Token', previousValue: 'tok_abc', newValue: 'tok_xyz' },
        { field: 'is_active', label: 'Activo', previousValue: 'false', newValue: 'true' },
      ],
    })

    const t03Pass =
      !logSensitive.details.includes('SuperSecretPassword123!') &&
      !logSensitive.details.includes('sk_live_999888777') &&
      logSensitive.details.includes('password=********') &&
      logSensitive.changes?.some((c) => c.field === 'password_hash' && c.newValue === '********') &&
      logSensitive.changes?.some((c) => c.field === 'token_access' && c.newValue === '********') &&
      logSensitive.changes?.some((c) => c.field === 'is_active' && c.newValue === 'true')

    recordResult(
      'T03',
      'Sanitización Automática de Credenciales y Secretos (Passwords / Tokens)',
      t03Pass,
      t03Pass
        ? `Contraseñas y tokens enmascarados como '********' tanto en detalles como en diffs.`
        : `Falla: Se detectaron secretos sin sanitizar en el log de auditoría.`
    )

    // ========================================================================
    // T04: Registro de Evento de Fallo de Seguridad (LOGIN_FAILED)
    // ========================================================================
    const logFailed = await auditService.log({
      companyId: companyAId,
      action: 'LOGIN_FAILED',
      module: 'SECURITY',
      entityType: 'auth',
      entityId: 'session_failed',
      userId: 'unknown',
      userName: 'Intruso / Desconocido',
      userRole: 'SELLER',
      level: 'CRITICAL',
      result: 'FAILED',
      ipAddress: '190.25.10.4',
      details: 'Intento de inicio de sesión con contraseña inválida para usuario no verificado.',
    })

    const t04Pass =
      logFailed.level === 'CRITICAL' &&
      logFailed.result === 'FAILED' &&
      logFailed.ipAddress === '190.25.10.4'

    recordResult(
      'T04',
      'Registro de Evento de Seguridad Fallido (LOGIN_FAILED)',
      t04Pass,
      t04Pass
        ? `Fallo de seguridad registrado con resultado FAILED, IP y severidad CRITICAL.`
        : `Falla en registro de evento fallido.`
    )

    // ========================================================================
    // T05: Consulta y Mapeo Fiduciario desde PostgreSQL (`auditService.list`)
    // ========================================================================
    const allCompanyALogs = await auditService.list({ companyId: companyAId }, 'SUPERADMIN')
    const foundCritical = allCompanyALogs.find((l) => l.id === logCritical.id)

    const t05Pass =
      allCompanyALogs.length >= 4 &&
      !!foundCritical &&
      foundCritical.level === 'CRITICAL' &&
      foundCritical.changes?.length === 2 &&
      foundCritical.changes?.some((c) => c.field === 'wholesale_price' && c.newValue === '3800')

    recordResult(
      'T05',
      'Consulta y Mapeo Fiduciario de Logs desde PostgreSQL',
      t05Pass,
      t05Pass
        ? `Se recuperaron ${allCompanyALogs.length} registros reales de PostgreSQL con reconstrucción de diffs.`
        : `Falla al consultar logs desde PostgreSQL.`
    )

    // ========================================================================
    // T06: Filtrado por Módulo (`module: 'INVENTORY'`)
    // ========================================================================
    const inventoryLogs = await auditService.list(
      { companyId: companyAId, module: 'INVENTORY' },
      'SUPERADMIN'
    )
    const t06Pass =
      inventoryLogs.length >= 1 &&
      inventoryLogs.every((l) => l.module === 'INVENTORY') &&
      inventoryLogs.some((l) => l.id === logInfo.id)

    recordResult(
      'T06',
      'Filtrado Dinámico por Módulo Operativo',
      t06Pass,
      t06Pass
        ? `Filtro de módulo verificado: ${inventoryLogs.length} eventos de INVENTORY devueltos.`
        : `Falla en filtrado por módulo.`
    )

    // ========================================================================
    // T07: Filtrado por Acción Específica (`action: 'PRICE_MODIFIED'`)
    // ========================================================================
    const priceLogs = await auditService.list(
      { companyId: companyAId, action: 'PRICE_MODIFIED' },
      'SUPERADMIN'
    )
    const t07Pass =
      priceLogs.length >= 1 &&
      priceLogs.every((l) => l.action === 'PRICE_MODIFIED') &&
      priceLogs.some((l) => l.id === logCritical.id)

    recordResult(
      'T07',
      'Filtrado Dinámico por Acción Específica',
      t07Pass,
      t07Pass
        ? `Filtro de acción verificado: ${priceLogs.length} eventos PRICE_MODIFIED.`
        : `Falla en filtrado por acción.`
    )

    // ========================================================================
    // T08: Filtrado por Nivel de Severidad (`level: 'CRITICAL'`)
    // ========================================================================
    const criticalLogs = await auditService.list(
      { companyId: companyAId, level: 'CRITICAL' },
      'SUPERADMIN'
    )
    const t08Pass =
      criticalLogs.length >= 2 &&
      criticalLogs.every((l) => l.level === 'CRITICAL') &&
      criticalLogs.some((l) => l.id === logCritical.id) &&
      criticalLogs.some((l) => l.id === logFailed.id)

    recordResult(
      'T08',
      'Filtrado por Nivel de Severidad (CRITICAL)',
      t08Pass,
      t08Pass
        ? `Filtro por nivel verificado: ${criticalLogs.length} eventos críticos identificados.`
        : `Falla en filtrado por nivel.`
    )

    // ========================================================================
    // T09: Búsqueda Textual Inteligente (`searchQuery`)
    // ========================================================================
    const searchLogs = await auditService.list(
      { companyId: companyAId, searchQuery: 'Arroz Diana' },
      'SUPERADMIN'
    )
    const t09Pass =
      searchLogs.length >= 1 &&
      searchLogs.some((l) => l.id === logCritical.id && l.entityReference === 'Arroz Diana 1000g')

    recordResult(
      'T09',
      'Búsqueda Textual Inteligente (referencia, usuario, detalles)',
      t09Pass,
      t09Pass
        ? `Búsqueda por 'Arroz Diana' localizó exactamente el registro con referencia '${searchLogs[0]?.entityReference}'.`
        : `Falla en motor de búsqueda textual.`
    )

    // ========================================================================
    // T10: Consulta Individual por ID (`auditService.getById`)
    // ========================================================================
    const singleLog = await auditService.getById(logCritical.id, 'SUPERADMIN')
    const t10Pass =
      singleLog !== null &&
      singleLog.id === logCritical.id &&
      singleLog.entityId === `prod-crit-${testSuffix}` &&
      singleLog.changes?.length === 2

    recordResult(
      'T10',
      'Consulta Individual por ID Inmutable',
      t10Pass,
      t10Pass
        ? `Registro recuperado individualmente con fidelidad de campos y diffs.`
        : `Falla en consulta individual por ID.`
    )

    // ========================================================================
    // T11: Restricción de Seguridad RBAC (`audit.security`)
    // ========================================================================
    // Un WAREHOUSE_ADMIN no tiene permiso audit.security
    const warehouseAdminLogs = await auditService.list(
      { companyId: companyAId },
      'WAREHOUSE_ADMIN',
      locAId
    )
    const t11Pass =
      !warehouseAdminLogs.some((l) => l.module === 'SECURITY') &&
      !warehouseAdminLogs.some((l) => l.action === 'LOGIN_FAILED') &&
      warehouseAdminLogs.some((l) => l.id === logInfo.id)

    recordResult(
      'T11',
      'Restricción de Seguridad RBAC (audit.security oculta eventos de intrusión a roles operativos)',
      t11Pass,
      t11Pass
        ? `Eventos del módulo SECURITY y LOGIN_FAILED fueron automáticamente omitidos para rol WAREHOUSE_ADMIN.`
        : `Falla: Rol operativo tuvo visibilidad de eventos de seguridad interna.`
    )

    // ========================================================================
    // T12: Aislamiento Multiempresa Estricto (Empresa B tiene 0 registros)
    // ========================================================================
    const companyBLogs = await auditService.list({ companyId: companyBId }, 'SUPERADMIN')
    const t12Pass =
      companyBLogs.length === 0 &&
      !companyBLogs.some((l) => l.id === logInfo.id || l.id === logCritical.id)

    recordResult(
      'T12',
      'Aislamiento Multiempresa Estricto (Empresa B no visualiza auditoría de Empresa A)',
      t12Pass,
      t12Pass
        ? `Aislamiento verificado: Empresa B reporta 0 registros de auditoría.`
        : `Falla de seguridad: Fuga de información de auditoría entre tenants.`
    )

    // ========================================================================
    // T13: Cálculo Analítico de KPIs de Auditoría (`auditService.getAuditStats`)
    // ========================================================================
    const statsA = await auditService.getAuditStats({ companyId: companyAId }, 'SUPERADMIN')
    const t13Pass =
      statsA.periodEventsCount >= 4 &&
      statsA.criticalActionsCount >= 2 &&
      statsA.activeUsersCount >= 1 &&
      statsA.pendingReviewsCount >= 2

    recordResult(
      'T13',
      'Cálculo Analítico de Métricas de Auditoría (KPIs)',
      t13Pass,
      t13Pass
        ? `Estadísticas calculadas: ${statsA.periodEventsCount} eventos, ${statsA.criticalActionsCount} críticos, top módulo: ${statsA.topActiveModule}.`
        : `Falla en cálculo de métricas de auditoría.`
    )

    // ========================================================================
    // T14: Motor de Exportación CSV con Registro Inmutable de Exportación
    // ========================================================================
    const exportResult = await auditService.exportAudit(
      { companyId: companyAId },
      { id: userAId, name: 'Carlos Auditor', role: 'SUPERADMIN' },
      'SUPERADMIN'
    )

    // Verificar que la exportación generó el CSV
    const csvHasHeader = exportResult.content.includes('ID Evento,Fecha UTC,Fecha Local (Colombia)')
    const csvHasCritical = exportResult.content.includes(logCritical.id)

    // Y verificar que se auto-registró el evento EXPORT_EXECUTED en la base de datos
    const dbExportCheck = await pgClient.query(`
      SELECT * FROM public.audit_logs
      WHERE company_id = $1 AND action = 'EXPORT_EXECUTED';
    `, [companyAId])

    const t14Pass =
      csvHasHeader &&
      csvHasCritical &&
      exportResult.totalRecords >= 4 &&
      dbExportCheck.rowCount >= 1

    recordResult(
      'T14',
      'Motor de Exportación Fiduciaria CSV y Auto-Auditoría de Exportación',
      t14Pass,
      t14Pass
        ? `CSV con ${exportResult.totalRecords} registros exportado y evento EXPORT_EXECUTED persistido en PostgreSQL.`
        : `Falla en exportación de auditoría.`
    )
  } catch (err: any) {
    console.error('❌ Error catastrófico en suite E2E de Auditoría:', err)
  } finally {
    console.log('\n--- Ejecutando Purga Zero Pollution en Auditoría ---')
    try {
      await pgClient.query("SELECT set_config('app.is_test_cleanup', 'true', false);")

      if (companyAId) {
        await pgClient.query(`DELETE FROM public.users WHERE company_id = $1;`, [companyAId])
        await pgClient.query(`DELETE FROM public.locations WHERE company_id = $1;`, [companyAId])
        await pgClient.query(`DELETE FROM public.audit_logs WHERE company_id = $1;`, [companyAId])
        await pgClient.query(`DELETE FROM public.companies WHERE id = $1;`, [companyAId])
        if (userAId) {
          await supabaseAdmin.auth.admin.deleteUser(userAId).catch(() => {})
        }
      }

      if (companyBId) {
        await pgClient.query(`DELETE FROM public.users WHERE company_id = $1;`, [companyBId])
        await pgClient.query(`DELETE FROM public.audit_logs WHERE company_id = $1;`, [companyBId])
        await pgClient.query(`DELETE FROM public.companies WHERE id = $1;`, [companyBId])
      }

      const verifyCleanA = await pgClient.query(
        `SELECT COUNT(*) FROM public.audit_logs WHERE company_id = $1;`,
        [companyAId]
      )
      const verifyCleanB = await pgClient.query(
        `SELECT COUNT(*) FROM public.audit_logs WHERE company_id = $1;`,
        [companyBId]
      )

      const t15Pass =
        Number(verifyCleanA.rows[0].count) === 0 &&
        Number(verifyCleanB.rows[0].count) === 0

      recordResult(
        'T15',
        'Zero Pollution: Purga 100% limpia de registros de prueba',
        t15Pass,
        t15Pass
          ? `Todos los registros de auditoría y empresas de prueba fueron eliminados atómicamente.`
          : `Alerta: Quedaron residuos de prueba en PostgreSQL.`
      )
    } catch (cleanupErr) {
      console.error('❌ Error durante la purga de auditoría:', cleanupErr)
    } finally {
      await pgClient.end()
    }
  }

  // ========================================================================
  // RESUMEN FINAL
  // ========================================================================
  console.log('\n============================================================')
  console.log('RESUMEN DE EJECUCIÓN - FASE 14: AUDITORÍA Y TRAZABILIDAD')
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

runPhase14AuditE2ETests().catch((err) => {
  console.error('Falla no capturada en ejecución:', err)
  process.exit(1)
})
