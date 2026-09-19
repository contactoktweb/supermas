/**
 * SUPER MÁS ERP/POS - Repositorio de Auditoría
 *
 * Conecta con la capa centralizada lib/supabase/db.ts para persistir y consultar
 * eventos de auditoría inmutables del sistema.
 */

import { db } from '@/lib/supabase/db'
import { AuditLogEntry, AuditFilters, AuditStats } from '../types'

export class AuditRepository {
  /**
   * Consulta las entradas de auditoría aplicando filtros y orden cronológico descendente.
   */
  async getLogs(filters: AuditFilters = {}): Promise<AuditLogEntry[]> {
    let logs = (db.auditLogs as unknown as AuditLogEntry[]) || []

    // Filtrar por rango de fechas
    if (filters.dateFrom) {
      const fromTime = new Date(filters.dateFrom).getTime()
      logs = logs.filter((l) => new Date(l.timestamp).getTime() >= fromTime)
    }
    if (filters.dateTo) {
      const toTime = new Date(filters.dateTo).getTime() + 86400000 // Incluir fin de día
      logs = logs.filter((l) => new Date(l.timestamp).getTime() <= toTime)
    }

    // Filtrar por usuario
    if (filters.userId && filters.userId !== 'ALL') {
      logs = logs.filter((l) => l.userId === filters.userId)
    }

    // Filtrar por rol
    if (filters.userRole && filters.userRole !== 'ALL') {
      logs = logs.filter((l) => l.userRole === filters.userRole)
    }

    // Filtrar por módulo
    if (filters.module && filters.module !== 'ALL') {
      logs = logs.filter((l) => l.module === filters.module)
    }

    // Filtrar por acción
    if (filters.action && filters.action !== 'ALL') {
      logs = logs.filter((l) => l.action === filters.action)
    }

    // Filtrar por nivel de severidad
    if (filters.level && filters.level !== 'ALL') {
      logs = logs.filter((l) => l.level === filters.level)
    }

    // Filtrar por bodega
    if (filters.locationId && filters.locationId !== 'ALL') {
      logs = logs.filter((l) => l.locationId === filters.locationId)
    }

    // Filtrar por resultado
    if (filters.result && filters.result !== 'ALL') {
      logs = logs.filter((l) => l.result === filters.result)
    }

    // Solo acciones críticas
    if (filters.onlyCritical) {
      logs = logs.filter((l) => l.level === 'CRITICAL')
    }

    // Solo cambios (registros que posean diffs antes/después)
    if (filters.onlyWithChanges) {
      logs = logs.filter((l) => Array.isArray(l.changes) && l.changes.length > 0)
    }

    // Búsqueda textual
    if (filters.searchQuery && filters.searchQuery.trim()) {
      const q = filters.searchQuery.toLowerCase().trim()
      logs = logs.filter(
        (l) =>
          l.userName.toLowerCase().includes(q) ||
          (l.entityReference && l.entityReference.toLowerCase().includes(q)) ||
          l.entityId.toLowerCase().includes(q) ||
          l.action.toLowerCase().includes(q) ||
          l.details.toLowerCase().includes(q) ||
          l.module.toLowerCase().includes(q) ||
          (l.locationName && l.locationName.toLowerCase().includes(q))
      )
    }

    // Ordenar de más reciente a más antiguo
    return [...logs].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  }

  /**
   * Obtiene un registro individual de auditoría por ID.
   */
  async getLogById(id: string): Promise<AuditLogEntry | null> {
    const logs = (db.auditLogs as unknown as AuditLogEntry[]) || []
    return logs.find((l) => l.id === id) || null
  }

  /**
   * Calcula estadísticas analíticas sobre el conjunto de logs.
   */
  async getStats(filters: AuditFilters = {}): Promise<AuditStats> {
    const logs = await this.getLogs(filters)
    const allLogs = (db.auditLogs as unknown as AuditLogEntry[]) || []

    // Identificar la fecha de hoy en America/Bogota
    const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date())

    const todayEventsCount = allLogs.filter((l) => {
      const logDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date(l.timestamp))
      return logDate === todayStr
    }).length

    const uniqueUsers = new Set(logs.map((l) => l.userId).filter((u) => u && u !== 'unknown'))
    const criticalActionsCount = logs.filter((l) => l.level === 'CRITICAL').length
    const pendingReviewsCount = logs.filter((l) => l.level === 'CRITICAL' || l.result !== 'SUCCESS').length

    // Módulo con mayor actividad
    const moduleCounts: Record<string, number> = {}
    logs.forEach((l) => {
      moduleCounts[l.module] = (moduleCounts[l.module] || 0) + 1
    })

    let topActiveModule = 'N/A'
    let maxCount = 0
    Object.entries(moduleCounts).forEach(([mod, count]) => {
      if (count > maxCount) {
        maxCount = count
        topActiveModule = mod
      }
    })

    return {
      todayEventsCount,
      periodEventsCount: logs.length,
      activeUsersCount: uniqueUsers.size,
      criticalActionsCount,
      topActiveModule,
      pendingReviewsCount,
    }
  }

  /**
   * Registra un nuevo evento de auditoría. Es estrictamente inmutable (append-only).
   */
  async log(entry: Omit<AuditLogEntry, 'id' | 'timestamp'>): Promise<AuditLogEntry> {
    const newLog: AuditLogEntry = {
      ...entry,
      id: `aud-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date().toISOString(),
    }

    // Persistencia en mock-db (simulación de Supabase)
    const logs = db.auditLogs as unknown as AuditLogEntry[]
    logs.unshift(newLog)

    return newLog
  }
}

export const auditRepository = new AuditRepository()
