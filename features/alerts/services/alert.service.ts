/**
 * SUPER MÁS ERP/POS - Servicio Central de Alertas (AlertService)
 *
 * Fachada de negocio encargada de:
 * 1. Control de acceso RBAC y verificación de permisos (alerts.*).
 * 2. Filtrado de visibilidad por rol y bodega (Cajero ve sus cajas, Bodeguero ve su sede).
 * 3. Transiciones de estado seguras (NEW -> READ -> IN_PROGRESS -> RESOLVED -> CLOSED).
 * 4. Trazabilidad inmutable mediante auditService.log().
 * 5. Orquestación del motor de reglas automáticas (alertRulesService).
 */

import { alertRepository } from '../repositories/alert.repository'
import { alertRulesService } from './alert-rules.service'
import { auditService } from '@/features/audit/services/audit.service'
import {
  AlertItem,
  AlertRule,
  AlertStats,
  AlertFilterCriteria,
  UserAlertContext,
  AlertPermission,
  RuleEvaluationResult,
} from '../types'
import {
  alertFilterCriteriaSchema,
  attendAlertSchema,
  resolveAlertSchema,
  closeAlertSchema,
  alertRuleConfigSchema,
  AlertRuleConfigInput,
} from '../schemas/alert.schema'

export const DEFAULT_ALERT_USER: UserAlertContext = {
  userId: 'usr-001',
  name: 'Mauricio Andrade',
  role: 'SUPERADMIN',
  locationId: 'loc-001',
  permissions: ['alerts.read', 'alerts.manage', 'alerts.resolve', 'alerts.configure', 'alerts.audit'],
}

export class AlertService {
  /**
   * Verifica permisos del usuario
   */
  private assertPermission(permission: AlertPermission, user: UserAlertContext): void {
    if (user.role === 'SUPERADMIN') return
    if (!user.permissions.includes(permission)) {
      throw new Error(`Acceso denegado: Se requiere el permiso '${permission}' para esta operación.`)
    }
  }

  /**
   * Consulta el listado de alertas aplicando filtros, paginación y seguridad de alcance
   */
  async getAlerts(
    rawCriteria?: AlertFilterCriteria,
    user: UserAlertContext = DEFAULT_ALERT_USER
  ): Promise<{ data: AlertItem[]; total: number }> {
    this.assertPermission('alerts.read', user)

    const criteria = alertFilterCriteriaSchema.parse(rawCriteria || {})

    // Filtrar por bodega si el usuario está atado a una sede y no es SUPERADMIN ni CONTADOR
    let effectiveCriteria: AlertFilterCriteria = { ...criteria }
    if (user.locationId && user.role !== 'SUPERADMIN' && user.role !== 'ACCOUNTANT') {
      if (criteria.locationId === 'ALL') {
        effectiveCriteria.locationId = user.locationId
      }
    }

    const result = await alertRepository.getAlerts(effectiveCriteria)

    // Filtrar adicionalmente por módulo/rol si es cajero
    if (user.role === 'CASHIER') {
      result.data = result.data.filter(
        (a) => a.module === 'CASH' || a.assignedUserId === user.userId
      )
      result.total = result.data.length
    }

    return result
  }

  /**
   * Consulta el detalle de una alerta individual
   */
  async getAlertById(id: string, user: UserAlertContext = DEFAULT_ALERT_USER): Promise<AlertItem | null> {
    this.assertPermission('alerts.read', user)
    return alertRepository.getAlertById(id)
  }

  /**
   * Obtiene estadísticas agregadas del dashboard de alertas
   */
  async getStats(locationId?: string, user: UserAlertContext = DEFAULT_ALERT_USER): Promise<AlertStats> {
    this.assertPermission('alerts.read', user)
    const effectiveLoc =
      user.role !== 'SUPERADMIN' && user.locationId ? user.locationId : locationId
    return alertRepository.getStats(effectiveLoc)
  }

  /**
   * Marca una alerta como leída
   */
  async markAsRead(id: string, user: UserAlertContext = DEFAULT_ALERT_USER): Promise<AlertItem> {
    this.assertPermission('alerts.manage', user)

    const alert = await alertRepository.getAlertById(id)
    if (!alert) {
      throw new Error(`Alerta con ID "${id}" no encontrada.`)
    }

    // Solo actualizar si está en estado NEW
    if (alert.status !== 'NEW' && alert.readAt) {
      return alert
    }

    const now = new Date().toISOString()
    const historyEntry = {
      timestamp: now,
      actor: user.name,
      action: 'READ' as const,
      notes: `Alerta visualizada y marcada como leída por ${user.name} (${user.role}).`,
    }

    const updated = await alertRepository.updateAlert(id, {
      status: 'READ',
      readAt: now,
      readByUserId: user.userId,
      history: [...alert.history, historyEntry],
    })

    await auditService.log({
      action: 'ALERT_READ',
      module: 'ALERTS',
      entityType: alert.entityType,
      entityId: alert.id,
      entityReference: alert.code,
      userId: user.userId,
      userName: user.name,
      userRole: user.role,
      locationId: alert.locationId || undefined,
      locationName: alert.locationName || undefined,
      level: 'INFO',
      details: `Alerta ${alert.code} marcada como leída por ${user.name}.`,
    })

    return updated
  }

  /**
   * Marca todas las alertas no leídas pertinentes como leídas
   */
  async markAllAsRead(user: UserAlertContext = DEFAULT_ALERT_USER): Promise<number> {
    this.assertPermission('alerts.manage', user)

    const { data } = await this.getAlerts({ onlyUnread: true, pageSize: 100 }, user)
    let count = 0

    for (const alert of data) {
      if (alert.status === 'NEW') {
        await this.markAsRead(alert.id, user)
        count++
      }
    }

    return count
  }

  /**
   * Pasa una alerta a estado 'IN_PROGRESS' (En atención)
   */
  async attendAlert(
    id: string,
    rawInput: { comment: string },
    user: UserAlertContext = DEFAULT_ALERT_USER
  ): Promise<AlertItem> {
    this.assertPermission('alerts.manage', user)
    const { comment } = attendAlertSchema.parse(rawInput)

    const alert = await alertRepository.getAlertById(id)
    if (!alert) {
      throw new Error(`Alerta con ID "${id}" no encontrada.`)
    }

    if (alert.status === 'RESOLVED' || alert.status === 'CLOSED') {
      throw new Error(`No se puede atender una alerta que ya está en estado ${alert.status}.`)
    }

    const now = new Date().toISOString()
    const historyEntry = {
      timestamp: now,
      actor: user.name,
      action: 'ATTENDED' as const,
      notes: comment,
    }

    const updated = await alertRepository.updateAlert(id, {
      status: 'IN_PROGRESS',
      assignedUserId: user.userId,
      assignedUserName: user.name,
      attendedAt: now,
      attendedByUserId: user.userId,
      attendedByUserName: user.name,
      attendedComment: comment,
      history: [...alert.history, historyEntry],
    })

    await auditService.log({
      action: 'ALERT_ATTENDED',
      module: 'ALERTS',
      entityType: alert.entityType,
      entityId: alert.id,
      entityReference: alert.code,
      userId: user.userId,
      userName: user.name,
      userRole: user.role,
      locationId: alert.locationId || undefined,
      locationName: alert.locationName || undefined,
      level: 'INFO',
      details: `Alerta ${alert.code} puesta en atención por ${user.name}: "${comment}".`,
    })

    return updated
  }

  /**
   * Resuelve una alerta registrando la solución aplicada
   */
  async resolveAlert(
    id: string,
    rawInput: { solutionNotes: string },
    user: UserAlertContext = DEFAULT_ALERT_USER
  ): Promise<AlertItem> {
    this.assertPermission('alerts.resolve', user)
    const { solutionNotes } = resolveAlertSchema.parse(rawInput)

    const alert = await alertRepository.getAlertById(id)
    if (!alert) {
      throw new Error(`Alerta con ID "${id}" no encontrada.`)
    }

    if (alert.status === 'CLOSED') {
      throw new Error('La alerta ya fue cerrada administrativamente.')
    }

    const now = new Date().toISOString()
    const historyEntry = {
      timestamp: now,
      actor: user.name,
      action: 'RESOLVED' as const,
      notes: solutionNotes,
    }

    const updated = await alertRepository.updateAlert(id, {
      status: 'RESOLVED',
      resolvedAt: now,
      resolvedByUserId: user.userId,
      resolvedByUserName: user.name,
      solutionNotes,
      history: [...alert.history, historyEntry],
    })

    await auditService.log({
      action: 'ALERT_RESOLVED',
      module: 'ALERTS',
      entityType: alert.entityType,
      entityId: alert.id,
      entityReference: alert.code,
      userId: user.userId,
      userName: user.name,
      userRole: user.role,
      locationId: alert.locationId || undefined,
      locationName: alert.locationName || undefined,
      level: 'INFO',
      details: `Alerta ${alert.code} resuelta por ${user.name}: "${solutionNotes}".`,
    })

    return updated
  }

  /**
   * Cierra administrativamente una alerta
   */
  async closeAlert(
    id: string,
    rawInput?: { closeNotes?: string },
    user: UserAlertContext = DEFAULT_ALERT_USER
  ): Promise<AlertItem> {
    this.assertPermission('alerts.resolve', user)
    const { closeNotes } = closeAlertSchema.parse(rawInput || {})

    const alert = await alertRepository.getAlertById(id)
    if (!alert) {
      throw new Error(`Alerta con ID "${id}" no encontrada.`)
    }

    const now = new Date().toISOString()
    const historyEntry = {
      timestamp: now,
      actor: user.name,
      action: 'CLOSED' as const,
      notes: closeNotes || 'Cierre administrativo finalizado.',
    }

    const updated = await alertRepository.updateAlert(id, {
      status: 'CLOSED',
      closedAt: now,
      closedByUserId: user.userId,
      history: [...alert.history, historyEntry],
    })

    return updated
  }

  /**
   * Consulta el catálogo de reglas del sistema
   */
  async getRules(user: UserAlertContext = DEFAULT_ALERT_USER): Promise<AlertRule[]> {
    this.assertPermission('alerts.read', user)
    return alertRepository.getRules()
  }

  /**
   * Actualiza la configuración de una regla
   */
  async updateRuleConfig(
    rawInput: AlertRuleConfigInput,
    user: UserAlertContext = DEFAULT_ALERT_USER
  ): Promise<AlertRule> {
    this.assertPermission('alerts.configure', user)
    const data = alertRuleConfigSchema.parse(rawInput)

    const currentRules = await alertRepository.getRules()
    const prev = currentRules.find((r) => r.id === data.ruleId)
    if (!prev) {
      throw new Error(`No existe la regla con ID "${data.ruleId}".`)
    }

    const updated = await alertRepository.updateRule(data.ruleId, {
      enabled: data.enabled,
      defaultPriority: data.priority,
      thresholds: data.thresholds,
      updatedAt: new Date().toISOString(),
      updatedBy: user.name,
    })

    await auditService.log({
      action: 'ALERT_RULE_MODIFIED',
      module: 'ALERTS',
      entityType: 'ALERT_RULE',
      entityId: updated.id,
      entityReference: updated.code,
      userId: user.userId,
      userName: user.name,
      userRole: user.role,
      level: 'INFO',
      details: `Regla ${updated.code} modificada: Estado=${updated.enabled ? 'Activa' : 'Inactiva'}, Prioridad=${updated.defaultPriority}.`,
      changes: [
        { label: 'Estado', field: 'enabled', previousValue: String(prev.enabled), newValue: String(updated.enabled) },
        { label: 'Prioridad', field: 'priority', previousValue: String(prev.defaultPriority), newValue: String(updated.defaultPriority) },
      ],
    })

    return updated
  }

  /**
   * Ejecuta el escaneo del sistema disparando la evaluación de reglas
   */
  async scanAndEvaluate(user: UserAlertContext = DEFAULT_ALERT_USER): Promise<RuleEvaluationResult> {
    this.assertPermission('alerts.manage', user)
    return alertRulesService.evaluateAllRules()
  }
}

export const alertService = new AlertService()
