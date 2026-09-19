/**
 * SUPER MÁS ERP/POS - Repositorio de Alertas (alertRepository)
 *
 * Capa de persistencia desacoplada para alertas y reglas automáticas.
 * Consume centralizadamente lib/supabase/db.ts.
 */

import { db } from '@/lib/supabase/db'
import {
  AlertItem,
  AlertRule,
  AlertFilterCriteria,
  AlertStats,
  AlertModule,
  AlertPriority,
  AlertStatus,
} from '../types'

export class AlertRepository {
  /**
   * Obtiene la lista de alertas aplicando filtros y paginación
   */
  async getAlerts(criteria?: AlertFilterCriteria): Promise<{ data: AlertItem[]; total: number }> {
    let list = (db.alerts as unknown as AlertItem[]) || []

    if (criteria?.searchQuery && criteria.searchQuery.trim()) {
      const q = criteria.searchQuery.toLowerCase().trim()
      list = list.filter(
        (a) =>
          a.code.toLowerCase().includes(q) ||
          a.title.toLowerCase().includes(q) ||
          a.description.toLowerCase().includes(q) ||
          a.entityReference.toLowerCase().includes(q) ||
          (a.locationName && a.locationName.toLowerCase().includes(q)) ||
          (a.assignedUserName && a.assignedUserName.toLowerCase().includes(q))
      )
    }

    if (criteria?.priority && criteria.priority !== 'ALL') {
      list = list.filter((a) => a.priority === criteria.priority)
    }

    if (criteria?.module && criteria.module !== 'ALL') {
      list = list.filter((a) => a.module === criteria.module)
    }

    if (criteria?.status && criteria.status !== 'ALL') {
      list = list.filter((a) => a.status === criteria.status)
    }

    if (criteria?.locationId && criteria.locationId !== 'ALL') {
      list = list.filter((a) => !a.locationId || a.locationId === criteria.locationId)
    }

    if (criteria?.onlyCritical) {
      list = list.filter((a) => a.priority === 'CRITICA')
    }

    if (criteria?.onlyUnread) {
      list = list.filter((a) => a.status === 'NEW' || a.readAt === null)
    }

    if (criteria?.assignedUserId && criteria.assignedUserId !== 'ALL') {
      list = list.filter((a) => a.assignedUserId === criteria.assignedUserId)
    }

    if (criteria?.startDate) {
      const start = new Date(criteria.startDate).getTime()
      list = list.filter((a) => new Date(a.createdAt).getTime() >= start)
    }

    if (criteria?.endDate) {
      const end = new Date(criteria.endDate).getTime()
      list = list.filter((a) => new Date(a.createdAt).getTime() <= end)
    }

    // Ordenar: primero no resueltas (NEW, IN_PROGRESS, READ), luego por prioridad y fecha desc
    const priorityWeight: Record<AlertPriority, number> = {
      CRITICA: 4,
      ALTA: 3,
      MEDIA: 2,
      BAJA: 1,
    }

    list.sort((a, b) => {
      const aResolved = ['RESOLVED', 'CLOSED'].includes(a.status) ? 1 : 0
      const bResolved = ['RESOLVED', 'CLOSED'].includes(b.status) ? 1 : 0
      if (aResolved !== bResolved) return aResolved - bResolved

      const pDiff = (priorityWeight[b.priority] || 0) - (priorityWeight[a.priority] || 0)
      if (pDiff !== 0) return pDiff

      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })

    const total = list.length
    const page = criteria?.page || 1
    const pageSize = criteria?.pageSize || 15
    const startIdx = (page - 1) * pageSize
    const paginated = list.slice(startIdx, startIdx + pageSize)

    return {
      data: JSON.parse(JSON.stringify(paginated)),
      total,
    }
  }

  /**
   * Obtiene una alerta por su ID
   */
  async getAlertById(id: string): Promise<AlertItem | null> {
    const list = (db.alerts as unknown as AlertItem[]) || []
    const alert = list.find((a) => a.id === id)
    return alert ? JSON.parse(JSON.stringify(alert)) : null
  }

  /**
   * Obtiene todas las alertas registradas en el sistema
   */
  async getAllAlerts(): Promise<AlertItem[]> {
    const list = (db.alerts as unknown as AlertItem[]) || []
    return JSON.parse(JSON.stringify(list))
  }

  /**
   * Obtiene todas las alertas activas (NEW, READ, IN_PROGRESS)
   */
  async getActiveAlerts(): Promise<AlertItem[]> {
    const list = (db.alerts as unknown as AlertItem[]) || []
    const active = list.filter((a) => ['NEW', 'READ', 'IN_PROGRESS'].includes(a.status))
    return JSON.parse(JSON.stringify(active))
  }

  /**
   * Inserta una nueva alerta en el almacén de datos (append-only inicial)
   */
  async createAlert(alertData: Omit<AlertItem, 'id' | 'code' | 'createdAt' | 'updatedAt' | 'history'>): Promise<AlertItem> {
    const list = db.alerts as unknown as AlertItem[]
    const nextSeq = list.length + 1
    const code = `ALT-${alertData.module.slice(0, 3)}-${String(nextSeq).padStart(3, '0')}`
    const now = new Date().toISOString()

    const newAlert: AlertItem = {
      ...alertData,
      id: `alt-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      code,
      history: [
        {
          timestamp: now,
          actor: 'Sistema de Reglas Automáticas',
          action: 'CREATED',
          notes: 'Alerta creada automáticamente por detección de evento.',
        },
      ],
      createdAt: now,
      updatedAt: now,
    }

    list.unshift(newAlert)
    return JSON.parse(JSON.stringify(newAlert))
  }

  /**
   * Actualiza una alerta existente
   */
  async updateAlert(id: string, updates: Partial<AlertItem>): Promise<AlertItem> {
    const list = db.alerts as unknown as AlertItem[]
    const index = list.findIndex((a) => a.id === id)

    if (index === -1) {
      throw new Error(`No se encontró la alerta con ID "${id}".`)
    }

    const current = list[index]
    const updated: AlertItem = {
      ...current,
      ...updates,
      updatedAt: new Date().toISOString(),
    }

    list[index] = updated
    return JSON.parse(JSON.stringify(updated))
  }

  /**
   * Obtiene estadísticas agregadas de alertas
   */
  async getStats(locationId?: string): Promise<AlertStats> {
    let list = (db.alerts as unknown as AlertItem[]) || []

    if (locationId && locationId !== 'ALL') {
      list = list.filter((a) => !a.locationId || a.locationId === locationId)
    }

    const byModule: Record<AlertModule, number> = {
      INVENTORY: 0,
      PURCHASES: 0,
      SALES: 0,
      INVOICING: 0,
      CASH: 0,
      WEB_ORDERS: 0,
      TRANSFERS: 0,
      ACCOUNTING: 0,
    }

    const byPriority: Record<AlertPriority, number> = {
      CRITICA: 0,
      ALTA: 0,
      MEDIA: 0,
      BAJA: 0,
    }

    const byStatus: Record<AlertStatus, number> = {
      NEW: 0,
      READ: 0,
      IN_PROGRESS: 0,
      RESOLVED: 0,
      CLOSED: 0,
    }

    const locationMap = new Map<string, { name: string; count: number; criticalCount: number }>()

    list.forEach((a) => {
      if (byModule[a.module] !== undefined) byModule[a.module]++
      if (byPriority[a.priority] !== undefined) byPriority[a.priority]++
      if (byStatus[a.status] !== undefined) byStatus[a.status]++

      const locId = a.locationId || 'GLOBAL'
      const locName = a.locationName || 'Consolidado General'
      const locData = locationMap.get(locId) || { name: locName, count: 0, criticalCount: 0 }
      locData.count++
      if (a.priority === 'CRITICA' && !['RESOLVED', 'CLOSED'].includes(a.status)) {
        locData.criticalCount++
      }
      locationMap.set(locId, locData)
    })

    const byLocation = Array.from(locationMap.entries()).map(([locId, d]) => ({
      locationId: locId,
      locationName: d.name,
      count: d.count,
      criticalCount: d.criticalCount,
    }))

    const totalNew = byStatus.NEW
    const totalCritical = list.filter(
      (a) => a.priority === 'CRITICA' && !['RESOLVED', 'CLOSED'].includes(a.status)
    ).length
    const totalPending = byStatus.NEW + byStatus.READ + byStatus.IN_PROGRESS
    const totalResolved = byStatus.RESOLVED + byStatus.CLOSED

    return {
      totalNew,
      totalCritical,
      totalPending,
      totalResolved,
      totalCount: list.length,
      byModule,
      byPriority,
      byStatus,
      byLocation,
    }
  }

  /**
   * Obtiene la lista de reglas configurables
   */
  async getRules(): Promise<AlertRule[]> {
    const list = (db.alertRules as unknown as AlertRule[]) || []
    return JSON.parse(JSON.stringify(list))
  }

  /**
   * Actualiza la configuración de una regla
   */
  async updateRule(ruleId: string, updates: Partial<AlertRule>): Promise<AlertRule> {
    const list = db.alertRules as unknown as AlertRule[]
    const index = list.findIndex((r) => r.id === ruleId)

    if (index === -1) {
      throw new Error(`No se encontró la regla con ID "${ruleId}".`)
    }

    const current = list[index]
    const updated: AlertRule = {
      ...current,
      ...updates,
      updatedAt: new Date().toISOString(),
    }

    list[index] = updated
    return JSON.parse(JSON.stringify(updated))
  }
}

export const alertRepository = new AlertRepository()
