/**
 * SUPER MÁS ERP/POS - Suite de Pruebas Automatizadas de Lógica del Módulo Alertas
 *
 * Valida:
 * 1. Validación Zod de esquemas (filtros, atención, resolución, configuración de reglas).
 * 2. Detección automática de reglas del sistema (inventario, compras, facturación, cajas, etc.).
 * 3. Garantía estricta de no duplicación (deduplicación sobre alertas activas).
 * 4. Detección de cuentas por pagar vencidas y rechazos de facturación electrónica DIAN.
 * 5. Detección de descuadres de caja y arqueos.
 * 6. Detección de pedidos web pendientes y transferencias retrasadas.
 * 7. Detección de asientos contables descuadrados (violación de partida doble).
 * 8. Ciclo de vida completo de la alerta (NUEVA -> LEIDA -> EN_ATENCION -> RESUELTA -> CERRADA).
 * 9. Inmutabilidad e integridad histórica (no eliminación física).
 * 10. Seguridad y visibilidad contextual según rol y bodega (RBAC).
 * 11. Configuración de reglas y modificación de umbrales dinámicos.
 * 12. Centro de notificaciones (bell helper) y trazabilidad inmutable en auditService / db.auditLogs.
 *
 * Ejecutable vía: npx tsx features/alerts/tests/alert.logic.test.ts
 */

import { alertService } from '../services/alert.service'
import { alertRulesService } from '../services/alert-rules.service'
import { alertNotificationService } from '../services/alert-notification.service'
import { alertRepository } from '../repositories/alert.repository'
import {
  alertFilterCriteriaSchema,
  attendAlertSchema,
  resolveAlertSchema,
  alertRuleConfigSchema,
} from '../schemas/alert.schema'
import { UserAlertContext } from '../types'
import { db } from '@/lib/supabase/db'

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`)
    throw new Error(message)
  }
  console.log(`✓ ${message}`)
}

const SUPERADMIN_USER: UserAlertContext = {
  userId: 'usr-admin-01',
  name: 'Admin Mauricio',
  role: 'SUPERADMIN',
  permissions: ['alerts.read', 'alerts.manage', 'alerts.resolve', 'alerts.configure', 'alerts.audit'],
}

const CAJERO_USER: UserAlertContext = {
  userId: 'usr-cajero-02',
  name: 'Pedro Cajero',
  role: 'CASHIER',
  locationId: 'loc-002',
  permissions: ['alerts.read'],
}

const BODEGUERO_USER: UserAlertContext = {
  userId: 'usr-bodega-03',
  name: 'Carlos Ruiz',
  role: 'WAREHOUSE_ADMIN',
  locationId: 'loc-001',
  permissions: ['alerts.read', 'alerts.manage'],
}

async function runTests() {
  console.log('--- INICIANDO PRUEBAS DE LÓGICA DE MONITOREO Y ALERTAS (ERP SUPER MÁS) ---\n')

  // TEST 1: Validación Zod de Esquemas
  console.log('[Test 1] Validación de esquemas Zod')
  const validFilters = alertFilterCriteriaSchema.parse({
    priority: 'CRITICA',
    module: 'INVENTORY',
    status: 'NEW',
    onlyCritical: true,
    pageSize: 20,
    page: 1,
  })
  assert(validFilters.priority === 'CRITICA', 'Filtro de prioridad validado')
  assert(validFilters.onlyCritical === true, 'Filtro onlyCritical validado')

  const validAttend = attendAlertSchema.parse({
    comment: 'Iniciando verificación física de existencias en bodega',
  })
  assert(validAttend.comment.length > 0, 'Esquema de atención de alerta validado')

  const validResolve = resolveAlertSchema.parse({
    solutionNotes: 'Se realizó el conteo físico y se ajustó el kardex mediante ajuste de inventario aprobado.',
  })
  assert(validResolve.solutionNotes.length > 0, 'Esquema de resolución validado')

  const validRuleConfig = alertRuleConfigSchema.parse({
    ruleId: 'rule-inv-002',
    enabled: true,
    priority: 'ALTA',
    thresholds: { defaultMinStock: 15 },
  })
  assert(validRuleConfig.thresholds.defaultMinStock === 15, 'Esquema de configuración de regla validado')

  // TEST 2: Detección automática y ejecución de Reglas del Sistema
  console.log('\n[Test 2] Ejecución del motor de reglas del sistema (alertRulesService.evaluateAllRules)')
  const scanResult = await alertRulesService.evaluateAllRules()
  assert(typeof scanResult.evaluatedRules === 'number' && scanResult.evaluatedRules >= 8, 'Reglas del sistema evaluadas correctamente')
  console.log(`  -> Reglas evaluadas: ${scanResult.evaluatedRules}, Nuevas alertas creadas: ${scanResult.newAlertsCreated}, Alertas activas: ${scanResult.activeAlertsCount}`)

  // TEST 3: Garantía de Deduplicación Estricta
  console.log('\n[Test 3] Verificación de Deduplicación en re-escaneo')
  const scanResult2 = await alertRulesService.evaluateAllRules()
  assert(scanResult2.newAlertsCreated === 0, 'El segundo escaneo consecutivo no generó duplicados (0 alertas nuevas creadas)')

  // TEST 4: Detección de Proveedores (Cuentas Vencidas) y Facturación DIAN
  console.log('\n[Test 4] Detección de facturas de compra vencidas y DIAN rechazada')
  const allAlerts = await alertRepository.getAllAlerts()
  const overdueInvoiceAlert = allAlerts.find((a) => a.ruleId === 'rule-pur-001')
  assert(!!overdueInvoiceAlert, 'Alerta de factura vencida de proveedor detectada')
  if (overdueInvoiceAlert) {
    assert(overdueInvoiceAlert.module === 'PURCHASES', 'Módulo de alerta de compra correcto: PURCHASES')
    assert(overdueInvoiceAlert.entityType === 'PURCHASE_INVOICE', 'Tipo de entidad correcto: PURCHASE_INVOICE')
  }

  const dianAlert = allAlerts.find((a) => a.ruleId === 'rule-invc-001')
  assert(!!dianAlert, 'Alerta de factura rechazada DIAN detectada')
  if (dianAlert) {
    assert(dianAlert.module === 'INVOICING', 'Módulo DIAN es INVOICING')
    assert(dianAlert.priority === 'CRITICA', 'Prioridad de rechazo DIAN es CRITICA')
  }

  // TEST 5: Detección de Cajas y Arqueos
  console.log('\n[Test 5] Detección de descuadres de caja y arqueos')
  const cashDiscrepancyAlert = allAlerts.find((a) => a.ruleId === 'rule-cash-001')
  assert(!!cashDiscrepancyAlert, 'Alerta de descuadre de caja detectada')
  if (cashDiscrepancyAlert) {
    assert(cashDiscrepancyAlert.module === 'CASH', 'Módulo de caja correcto: CASH')
    assert(cashDiscrepancyAlert.priority === 'CRITICA', 'Prioridad de descuadre de caja es CRITICA')
  }

  // TEST 6: Detección de Pedidos Web y Transferencias Retrasadas
  console.log('\n[Test 6] Detección de pedidos web y transferencias en tránsito')
  const webOrderAlert = allAlerts.find((a) => a.ruleId === 'rule-web-001')
  assert(!!webOrderAlert, 'Alerta de pedido web pendiente/retrasado detectada')

  const transferAlert = allAlerts.find((a) => a.ruleId === 'rule-trans-001')
  assert(!!transferAlert, 'Alerta de transferencia retrasada detectada')

  // TEST 7: Detección de Contabilidad (Asiento Descuadrado)
  console.log('\n[Test 7] Detección de desbalance contable (Partida Doble)')
  const accountingAlert = allAlerts.find((a) => a.ruleId === 'rule-acc-001')
  assert(!!accountingAlert, 'Alerta de asiento contable descuadrado detectada')
  if (accountingAlert) {
    assert(accountingAlert.module === 'ACCOUNTING', 'Módulo contable es ACCOUNTING')
  }

  // TEST 8: Ciclo de Vida y Transiciones de Estado
  console.log('\n[Test 8] Ciclo de vida completo de una alerta')
  const testAlert = await alertRepository.createAlert({
    ruleId: 'rule-inv-002',
    title: 'Alerta Test Ciclo de Vida',
    description: 'Verificando estados de transición en ciclo de vida',
    module: 'INVENTORY',
    priority: 'MEDIA',
    status: 'NEW',
    entityType: 'PRODUCT',
    entityId: 'prod-test-01',
    entityReference: 'SKU-TEST-001',
    locationId: 'loc-001',
    locationName: 'Bodega Principal',
    assignedRole: 'WAREHOUSE_ADMIN',
    assignedUserId: null,
    assignedUserName: null,
    readAt: null,
    readByUserId: null,
    attendedAt: null,
    attendedByUserId: null,
    attendedByUserName: null,
    attendedComment: null,
    resolvedAt: null,
    resolvedByUserId: null,
    resolvedByUserName: null,
    solutionNotes: null,
    closedAt: null,
    closedByUserId: null,
    metadata: { currentStock: 5, minStock: 20 },
  })
  assert(testAlert.status === 'NEW', 'Estado inicial es NEW')

  // Marcar como leída
  const readAlert = await alertService.markAsRead(testAlert.id, SUPERADMIN_USER)
  assert(readAlert.status === 'READ', 'Estado transitó a READ')
  assert(!!readAlert.readAt, 'readAt registrado correctamente')

  // Atender alerta
  const inProgressAlert = await alertService.attendAlert(
    testAlert.id,
    { comment: 'Revisando existencias físicas en pasillo 4' },
    SUPERADMIN_USER
  )
  assert(inProgressAlert.status === 'IN_PROGRESS', 'Estado transitó a IN_PROGRESS')
  assert(inProgressAlert.assignedUserId === 'usr-admin-01', 'Responsable asignado correctamente')

  // Resolver alerta
  const resolvedAlert = await alertService.resolveAlert(
    testAlert.id,
    { solutionNotes: 'Se transfirieron 50 unidades desde Bodega Norte. Stock restablecido.' },
    SUPERADMIN_USER
  )
  assert(resolvedAlert.status === 'RESOLVED', 'Estado transitó a RESUELTA')
  assert(!!resolvedAlert.resolvedAt, 'resolvedAt registrado')
  assert(resolvedAlert.solutionNotes?.includes('Bodega Norte') ?? false, 'Notas de solución almacenadas')

  // Cerrar alerta
  const closedAlert = await alertService.closeAlert(
    testAlert.id,
    { closeNotes: 'Cierre administrativo finalizado con éxito.' },
    SUPERADMIN_USER
  )
  assert(closedAlert.status === 'CLOSED', 'Estado transitó a CLOSED')

  // TEST 9: Inmutabilidad e Historial (No eliminación física)
  console.log('\n[Test 9] Inmutabilidad histórica de alertas')
  const foundAlert = await alertRepository.getAlertById(testAlert.id)
  assert(foundAlert !== null, 'La alerta nunca se borra de la base de datos (Inmutabilidad garantizada)')
  assert(foundAlert?.status === 'CLOSED', 'El registro histórico conserva el estado final CLOSED')

  // TEST 10: Control de Acceso Basado en Roles (RBAC Scoped Visibility)
  console.log('\n[Test 10] Control de Acceso y Visibilidad según Rol (RBAC)')
  const adminAlerts = await alertService.getAlerts({}, SUPERADMIN_USER)
  assert(adminAlerts.total > 0, `Superadmin visualiza todas las alertas (${adminAlerts.total})`)

  const cajeroAlerts = await alertService.getAlerts({}, CAJERO_USER)
  const nonCashAlertsForCajero = cajeroAlerts.data.filter((a) => a.module !== 'CASH' && a.assignedUserId !== CAJERO_USER.userId)
  assert(nonCashAlertsForCajero.length === 0, 'Cajero únicamente tiene acceso a alertas de módulo CASH')

  const bodegueroAlerts = await alertService.getAlerts({}, BODEGUERO_USER)
  const unauthorizedBodegaAlerts = bodegueroAlerts.data.filter(
    (a) => a.locationId && a.locationId !== 'loc-001'
  )
  assert(
    unauthorizedBodegaAlerts.length === 0,
    'Encargado de bodega únicamente visualiza alertas pertenecientes a su sede asignada (loc-001)'
  )

  // TEST 11: Configuración de Reglas y Umbrales Dinámicos
  console.log('\n[Test 11] Modificación de configuración de reglas')
  const updatedRule = await alertService.updateRuleConfig(
    {
      ruleId: 'rule-pur-002',
      enabled: true,
      priority: 'ALTA',
      thresholds: { daysBeforeDue: 7 },
    },
    SUPERADMIN_USER
  )
  assert(updatedRule.thresholds.daysBeforeDue === 7, 'Umbral de días actualizado a 7')
  assert(updatedRule.defaultPriority === 'ALTA', 'Prioridad de la regla actualizada a ALTA')

  // TEST 12: Centro de Notificaciones y Auditoría
  console.log('\n[Test 12] Centro de notificaciones y registro de auditoría')
  const unreadCount = await alertNotificationService.getUnreadCount()
  assert(typeof unreadCount === 'number', `Contador de no leídas obtenido: ${unreadCount}`)

  const recentAlerts = await alertNotificationService.getRecentAlerts(3)
  assert(recentAlerts.length <= 3, 'Top de alertas recientes obtenido para popover de notificación')

  // Verificar que se haya registrado en auditoría
  const alertAuditLogs = db.auditLogs.filter(
    (log: any) => log.module === 'ALERTS' || log.action?.startsWith('ALERT_')
  )
  assert(alertAuditLogs.length > 0, `Registros de auditoría generados en auditLogs (${alertAuditLogs.length} eventos)`)
  assert(alertAuditLogs.some((l: any) => l.action === 'ALERT_RULE_MODIFIED'), 'Registro de auditoría ALERT_RULE_MODIFIED registrado')
  assert(alertAuditLogs.some((l: any) => l.action === 'ALERT_RESOLVED'), 'Registro de auditoría ALERT_RESOLVED registrado')
  assert(alertAuditLogs.some((l: any) => l.action === 'ALERT_ATTENDED'), 'Registro de auditoría ALERT_ATTENDED registrado')
  assert(alertAuditLogs.some((l: any) => l.action === 'ALERT_READ'), 'Registro de auditoría ALERT_READ registrado')
  assert(alertAuditLogs.some((l: any) => l.action === 'ALERT_CREATED'), 'Registro de auditoría ALERT_CREATED registrado')

  console.log('\n🎉 ¡TODAS LAS 12 PRUEBAS DE LÓGICA DE ALERTAS PASARON SATISFACTORIAMENTE!\n')
}

runTests().catch((err) => {
  console.error('\n❌ ERROR EJECUTANDO PRUEBAS:', err)
  process.exit(1)
})
