/**
 * SUPER MÁS ERP/POS - Motor de Reglas Automáticas (AlertRulesService)
 *
 * Escanea periódicamente o bajo demanda los registros de todos los módulos
 * del ERP, evaluando anomalías y creando alertas sin generar duplicados.
 */

import { db } from '@/lib/supabase/db'
import { alertRepository } from '../repositories/alert.repository'
import { AlertDefinitions, AlertCandidate } from '../rules/alert-definitions'
import { RuleEvaluationResult, AlertItem } from '../types'
import { auditService } from '@/features/audit/services/audit.service'

export class AlertRulesService {
  /**
   * Ejecuta la evaluación completa de todas las reglas habilitadas del ERP.
   * Aplica estricta deduplicación para no crear alertas redundantes.
   */
  async evaluateAllRules(): Promise<RuleEvaluationResult> {
    const rules = await alertRepository.getRules()
    const enabledRules = rules.filter((r) => r.enabled)
    const now = new Date()

    // 1. Recopilar candidatos de todos los módulos
    const candidates: AlertCandidate[] = [
      ...AlertDefinitions.evaluateInventory({
        stockLevels: db.stockLevels,
        products: db.products,
        rules: enabledRules,
      }),
      ...AlertDefinitions.evaluatePurchases({
        purchases: db.purchases,
        rules: enabledRules,
        now,
      }),
      ...AlertDefinitions.evaluateInvoicing({
        invoices: db.invoices,
        rules: enabledRules,
      }),
      ...AlertDefinitions.evaluateCashRegisters({
        cashRegisters: db.cashRegisters,
        rules: enabledRules,
        now,
      }),
      ...AlertDefinitions.evaluateWebOrders({
        webOrders: db.webOrders,
        rules: enabledRules,
        now,
      }),
      ...AlertDefinitions.evaluateTransfers({
        transfers: db.transfers,
        rules: enabledRules,
        now,
      }),
      ...AlertDefinitions.evaluateAccounting({
        accountingEntries: db.accountingEntries,
        rules: enabledRules,
      }),
    ]

    // 2. Obtener alertas actualmente activas para deduplicación
    const activeAlerts = await alertRepository.getActiveAlerts()

    let newAlertsCreated = 0

    // 3. Crear únicamente aquellas que no tengan alerta activa para la misma entidad y regla
    for (const candidate of candidates) {
      const alreadyExists = activeAlerts.some(
        (active) =>
          active.ruleId === candidate.ruleId &&
          active.entityType === candidate.entityType &&
          active.entityId === candidate.entityId &&
          (!candidate.locationId || active.locationId === candidate.locationId)
      )

      if (!alreadyExists) {
        const created = await alertRepository.createAlert({
          ruleId: candidate.ruleId,
          title: candidate.title,
          description: candidate.description,
          module: candidate.module,
          priority: candidate.priority,
          status: 'NEW',
          entityType: candidate.entityType,
          entityId: candidate.entityId,
          entityReference: candidate.entityReference,
          locationId: candidate.locationId,
          locationName: candidate.locationName,
          assignedRole: candidate.assignedRole,
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
          metadata: candidate.metadata,
        })

        // Registrar en auditoría inmutable
        await auditService.log({
          action: 'ALERT_CREATED',
          module: 'ALERTS',
          entityType: candidate.entityType,
          entityId: created.id,
          entityReference: created.code,
          userId: 'system',
          userName: 'Sistema de Reglas Automáticas',
          userRole: 'SYSTEM',
          locationId: candidate.locationId || undefined,
          locationName: candidate.locationName || undefined,
          level: candidate.priority === 'CRITICA' ? 'CRITICAL' : 'INFO',
          details: `Alerta automática generada (${candidate.title}) bajo regla ${candidate.ruleId}.`,
        })

        newAlertsCreated++
        activeAlerts.push(created)
      }
    }

    return {
      evaluatedRules: enabledRules.length,
      newAlertsCreated,
      activeAlertsCount: activeAlerts.length,
      timestamp: now.toISOString(),
    }
  }
}

export const alertRulesService = new AlertRulesService()
