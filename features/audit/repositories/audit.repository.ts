/**
 * SUPER MÁS ERP/POS - Repositorio de Auditoría (AuditRepository)
 *
 * Conecta directamente con la tabla inmutable public.audit_logs en PostgreSQL / Supabase
 * garantizando persistencia real, trazabilidad fiduciaria y estricto aislamiento multiempresa (company_id).
 *
 * Cero simulaciones (db.ts), cero mocks.
 */

import { supabaseClient } from '@/lib/supabase/client'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { resolveUserCompanyId } from '@/lib/supabase/tenant'
import {
  AuditLogEntry,
  AuditFilters,
  AuditStats,
  AuditDiffField,
  AuditLevel,
  AuditResult,
  AuditModule,
  AuditActionType,
} from '../types'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function isValidUUID(id?: string | null): boolean {
  if (!id) return false
  return UUID_REGEX.test(id)
}

function getDbClient() {
  if (typeof window === 'undefined' && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return supabaseAdmin
  }
  return supabaseClient
}

export class AuditRepository {
  /**
   * Resuelve el company_id activo de forma segura
   */
  private async getCompanyId(preferredCompanyId?: string): Promise<string | null> {
    if (preferredCompanyId) return preferredCompanyId
    try {
      return await resolveUserCompanyId(getDbClient(), preferredCompanyId)
    } catch {
      return preferredCompanyId || null
    }
  }

  /**
   * Transforma una fila de public.audit_logs de PostgreSQL a la interfaz AuditLogEntry
   */
  private mapRowToEntry(row: any, locationMap?: Map<string, string>): AuditLogEntry {
    const newVal = row.new_value || {}
    const prevVal = row.previous_value || {}

    // 1. Determinar nivel (CRITICAL, WARNING, INFO)
    let level: AuditLevel = newVal.level || 'INFO'
    if (!newVal.level) {
      const act = (row.action || '').toUpperCase()
      if (
        act.includes('DELETE') ||
        act.includes('CANCEL') ||
        act.includes('REJECT') ||
        act.includes('CRITICAL') ||
        act.includes('DROP')
      ) {
        level = 'CRITICAL'
      } else if (
        act.includes('UPDATE') ||
        act.includes('ADJUST') ||
        act.includes('MODIF') ||
        act.includes('WARNING')
      ) {
        level = 'WARNING'
      }
    }

    // 2. Determinar resultado
    let result: AuditResult = newVal.result || 'SUCCESS'
    if (!newVal.result) {
      const act = (row.action || '').toUpperCase()
      if (act.includes('FAIL') || act.includes('ERROR')) {
        result = 'FAILED'
      } else if (act.includes('REJECT')) {
        result = 'REJECTED'
      }
    }

    // 3. Determinar rol
    const userRole: string = newVal.userRole || (row.user_name === 'Sistema' ? 'SUPERADMIN' : 'USUARIO')

    // 4. Determinar referencia de la entidad
    let entityReference: string =
      newVal.entityReference ||
      newVal.sku ||
      newVal.name ||
      newVal.code ||
      newVal.invoice_number ||
      newVal.purchase_number ||
      newVal.document_number ||
      prevVal.sku ||
      prevVal.name ||
      prevVal.code ||
      prevVal.purchase_number ||
      prevVal.document_number ||
      ''

    // 5. Detalles descriptivos
    let details: string = newVal.details
    if (!details) {
      const refPart = entityReference ? ` [${entityReference}]` : ''
      details = `${row.action} ejecutado en ${row.entity_name}${refPart} por ${row.user_name}`
    }

    // 6. Construir lista de diffs / cambios
    let changes: AuditDiffField[] = []
    if (newVal.diff_after && Array.isArray(newVal.diff_after)) {
      // Formato custom diffs
      changes = newVal.diff_after.map((item: any, idx: number) => {
        const k = Object.keys(item)[0] || `campo_${idx}`
        const vAfter = item[k]
        const vBefore =
          newVal.diff_before && newVal.diff_before[idx] ? newVal.diff_before[idx][k] : '(Previo)'
        return {
          field: k,
          label: k,
          previousValue: String(vBefore ?? ''),
          newValue: String(vAfter ?? ''),
        }
      })
    } else if (prevVal && typeof prevVal === 'object' && newVal && typeof newVal === 'object' && Object.keys(newVal).length > 0 && Object.keys(prevVal).length > 0) {
      const allKeys = new Set([...Object.keys(prevVal), ...Object.keys(newVal)])
      allKeys.forEach((key) => {
        if (key === 'updated_at' || key === 'created_at' || key.startsWith('_')) return
        const v1 = prevVal[key]
        const v2 = newVal[key]
        if (JSON.stringify(v1) !== JSON.stringify(v2)) {
          changes.push({
            field: key,
            label: key,
            previousValue: v1 !== undefined && v1 !== null ? (typeof v1 === 'object' ? JSON.stringify(v1) : String(v1)) : '(Vacío)',
            newValue: v2 !== undefined && v2 !== null ? (typeof v2 === 'object' ? JSON.stringify(v2) : String(v2)) : '(Vacío)',
          })
        }
      })
    } else if (prevVal && Object.keys(prevVal).length > 0 && (!newVal || Object.keys(newVal).length === 0)) {
      changes = [
        {
          field: 'registro',
          label: 'Registro Eliminado',
          previousValue: JSON.stringify(prevVal).slice(0, 160),
          newValue: '(Registro purgado/eliminado)',
        },
      ]
    } else if (newVal && Object.keys(newVal).length > 0 && (!prevVal || Object.keys(prevVal).length === 0)) {
      changes = [
        {
          field: 'registro',
          label: 'Registro Creado',
          previousValue: '(Ninguno)',
          newValue: JSON.stringify(newVal).slice(0, 160),
        },
      ]
    }

    const locationName = row.location_id
      ? locationMap?.get(row.location_id) || newVal.locationName || 'Bodega'
      : undefined

    return {
      id: row.id,
      companyId: row.company_id || undefined,
      timestamp: row.created_at,
      action: row.action as AuditActionType,
      level,
      module: (row.module as AuditModule) || 'SYSTEM',
      entityType: row.entity_name || 'Desconocido',
      entityId: row.entity_id || row.id,
      entityReference: entityReference || undefined,
      userId: row.user_id || 'unknown',
      userName: row.user_name || 'Sistema',
      userRole,
      locationId: row.location_id || undefined,
      locationName,
      result,
      details,
      ipAddress: row.ip_address || undefined,
      sessionId: newVal.sessionId || undefined,
      changes: changes.length > 0 ? changes : undefined,
    }
  }

  /**
   * Consulta las entradas de auditoría aplicando filtros y orden cronológico descendente desde PostgreSQL
   */
  async getLogs(filters: AuditFilters = {}): Promise<AuditLogEntry[]> {
    const client = getDbClient()
    const companyId = await this.getCompanyId(filters.companyId)

    let query = client.from('audit_logs').select('*')

    if (companyId) {
      query = query.eq('company_id', companyId)
    }

    if (filters.dateFrom) {
      query = query.gte('created_at', new Date(filters.dateFrom).toISOString())
    }

    if (filters.dateTo) {
      const toDate = new Date(filters.dateTo)
      if (filters.dateTo.length <= 10) {
        toDate.setUTCHours(23, 59, 59, 999)
      }
      query = query.lte('created_at', toDate.toISOString())
    }

    if (filters.userId && filters.userId !== 'ALL') {
      query = query.eq('user_id', filters.userId)
    }

    if (filters.module && filters.module !== 'ALL') {
      query = query.eq('module', filters.module)
    }

    if (filters.action && filters.action !== 'ALL') {
      query = query.eq('action', filters.action)
    }

    if (filters.locationId && filters.locationId !== 'ALL') {
      query = query.eq('location_id', filters.locationId)
    }

    query = query.order('created_at', { ascending: false }).limit(250)

    const { data: rows, error } = await query

    if (error) {
      console.error('❌ Error al consultar audit_logs en Supabase:', error)
      return []
    }

    // Resolver mapa de nombres de bodegas
    const locationMap = new Map<string, string>()
    try {
      let locQuery = client.from('locations').select('id, name')
      if (companyId) locQuery = locQuery.eq('company_id', companyId)
      const { data: locData } = await locQuery
      if (locData) {
        locData.forEach((l: any) => locationMap.set(l.id, l.name))
      }
    } catch (e) {
      // Ignorar si falla lectura auxiliar de bodegas
    }

    let entries = (rows || []).map((r: any) => this.mapRowToEntry(r, locationMap))

    // Filtros secundarios en memoria para atributos derivados
    if (filters.userRole && filters.userRole !== 'ALL') {
      entries = entries.filter((e) => e.userRole === filters.userRole)
    }

    if (filters.level && filters.level !== 'ALL') {
      entries = entries.filter((e) => e.level === filters.level)
    }

    if (filters.result && filters.result !== 'ALL') {
      entries = entries.filter((e) => e.result === filters.result)
    }

    if (filters.onlyCritical) {
      entries = entries.filter((e) => e.level === 'CRITICAL')
    }

    if (filters.onlyWithChanges) {
      entries = entries.filter((e) => Array.isArray(e.changes) && e.changes.length > 0)
    }

    if (filters.searchQuery && filters.searchQuery.trim()) {
      const q = filters.searchQuery.toLowerCase().trim()
      entries = entries.filter(
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

    return entries
  }

  /**
   * Obtiene un registro individual de auditoría por ID desde PostgreSQL
   */
  async getLogById(id: string): Promise<AuditLogEntry | null> {
    const client = getDbClient()
    const { data: row, error } = await client
      .from('audit_logs')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (error || !row) return null

    let locMap: Map<string, string> | undefined
    if (row.location_id) {
      const { data: loc } = await client
        .from('locations')
        .select('id, name')
        .eq('id', row.location_id)
        .maybeSingle()
      if (loc) {
        locMap = new Map([[loc.id, loc.name]])
      }
    }

    return this.mapRowToEntry(row, locMap)
  }

  /**
   * Calcula estadísticas analíticas sobre el conjunto de logs en PostgreSQL
   */
  async getStats(filters: AuditFilters = {}): Promise<AuditStats> {
    const client = getDbClient()
    const companyId = await this.getCompanyId(filters.companyId)

    // Consultar logs filtrados
    const logs = await this.getLogs(filters)

    // Contar eventos ocurridos hoy en zona horaria America/Bogota
    const todayBogota = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date())
    const startOfTodayIso = new Date(`${todayBogota}T00:00:00-05:00`).toISOString()

    let todayQuery = client.from('audit_logs').select('*', { count: 'exact', head: true }).gte('created_at', startOfTodayIso)
    if (companyId) {
      todayQuery = todayQuery.eq('company_id', companyId)
    }
    const { count: todayCount } = await todayQuery

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
      todayEventsCount: todayCount ?? logs.length,
      periodEventsCount: logs.length,
      activeUsersCount: uniqueUsers.size,
      criticalActionsCount,
      topActiveModule,
      pendingReviewsCount,
    }
  }

  /**
   * Registra un nuevo evento de auditoría en PostgreSQL (append-only inmutable)
   */
  async log(entry: Omit<AuditLogEntry, 'id' | 'timestamp'> & { companyId?: string }): Promise<AuditLogEntry> {
    const client = getDbClient()
    const companyId = await this.getCompanyId(entry.companyId)
    const id = crypto.randomUUID()
    const timestamp = new Date().toISOString()

    const diffBefore = entry.changes ? entry.changes.map((c) => ({ [c.field]: c.previousValue })) : null
    const diffAfter = entry.changes ? entry.changes.map((c) => ({ [c.field]: c.newValue })) : null

    const rowToInsert = {
      id,
      user_id: isValidUUID(entry.userId) ? entry.userId : null,
      user_name: entry.userName || 'Sistema',
      action: entry.action,
      module: entry.module || 'SYSTEM',
      entity_name: entry.entityType || 'audit_logs',
      entity_id: entry.entityId || id,
      location_id: isValidUUID(entry.locationId) ? entry.locationId : null,
      company_id: companyId,
      previous_value: diffBefore ? { diff_before: diffBefore } : null,
      new_value: {
        details: entry.details,
        level: entry.level || 'INFO',
        result: entry.result || 'SUCCESS',
        userRole: entry.userRole || 'SUPERADMIN',
        entityReference: entry.entityReference,
        locationName: entry.locationName,
        sessionId: entry.sessionId,
        diff_after: diffAfter,
      },
      ip_address: entry.ipAddress || null,
      created_at: timestamp,
    }

    const { error } = await client.from('audit_logs').insert(rowToInsert)

    if (error) {
      console.error('❌ Error insertando audit_log en PostgreSQL:', error)
      throw new Error(`Error al persistir evento de auditoría: ${error.message}`)
    }

    return {
      ...entry,
      id,
      companyId: companyId || undefined,
      timestamp,
      level: entry.level || 'INFO',
      result: entry.result || 'SUCCESS',
      userRole: entry.userRole || 'SUPERADMIN',
    }
  }
}

export const auditRepository = new AuditRepository()
