/**
 * SUPER MÁS ERP/POS - Repositorio de Alertas y Supervisión (AlertRepository)
 *
 * Capa de persistencia desacoplada y 100% transaccional sobre PostgreSQL (Supabase).
 * Aislamiento multi-tenant estricto mediante company_id.
 */

import { supabaseClient } from '@/lib/supabase/client'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { resolveUserCompanyId } from '@/lib/supabase/tenant'
import {
  AlertItem,
  AlertRule,
  AlertFilterCriteria,
  AlertStats,
  AlertModule,
  AlertPriority,
  AlertStatus,
  AlertEntityType,
} from '../types'

export interface ReplenishmentSuggestion {
  productId: string
  sku: string
  productName: string
  barcode?: string
  locationId: string
  locationName: string
  currentStock: number
  minStockThreshold: number
  criticalStockThreshold: number
  suggestedQuantity: number
  unitCost: number
  estimatedTotalCost: number
  urgency: 'CRITICA' | 'ALTA' | 'MEDIA'
}

function getDbClient() {
  if (typeof window === 'undefined' && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return supabaseAdmin
  }
  return supabaseClient
}

export class AlertRepository {
  /**
   * Resuelve el company_id desde el contexto o parámetro
   */
  async resolveCompanyId(preferredCompanyId?: string): Promise<string> {
    if (preferredCompanyId) return preferredCompanyId
    const resolved = await resolveUserCompanyId()
    if (resolved) return resolved

    const client = getDbClient()
    const {
      data: { user },
    } = await client.auth.getUser()
    const appMetadata = user?.app_metadata
    if (appMetadata?.company_id) return appMetadata.company_id

    throw new Error('No se pudo resolver el company_id para el módulo de Alertas.')
  }

  /**
   * Mapea un registro de PostgreSQL (system_alerts) a AlertItem de dominio
   */
  private mapDbToAlertItem(row: any): AlertItem {
    return {
      id: row.id,
      ruleId: row.rule_id || '',
      code: row.code || `ALT-${row.id.slice(0, 8)}`,
      title: row.title,
      description: row.description || row.message || '',
      module: row.module as AlertModule,
      priority: row.priority as AlertPriority,
      status: row.status as AlertStatus,
      entityType: row.entity_type as AlertEntityType,
      entityId: row.entity_id || '',
      entityReference: row.entity_reference || row.entity_id || '',
      locationId: row.location_id || null,
      locationName: row.locations?.name || null,
      assignedRole: row.assigned_role || null,
      assignedUserId: row.assigned_user_id || null,
      assignedUserName: row.users?.full_name || null,
      readAt: row.read_at || null,
      readByUserId: row.read_by_user_id || null,
      attendedAt: row.attended_at || null,
      attendedByUserId: row.attended_by_user_id || null,
      attendedByUserName: row.attended_by_user_name || null,
      attendedComment: row.attended_comment || null,
      resolvedAt: row.resolved_at || null,
      resolvedByUserId: row.resolved_by_user_id || null,
      resolvedByUserName: row.resolved_by_user_name || null,
      solutionNotes: row.solution_notes || row.resolution_notes || null,
      closedAt: row.closed_at || null,
      closedByUserId: row.closed_by_user_id || null,
      metadata: row.metadata || {},
      history: Array.isArray(row.history) ? row.history : [],
      createdAt: row.created_at,
      updatedAt: row.updated_at || row.created_at,
    }
  }

  /**
   * Mapea un registro de PostgreSQL (alert_rules) a AlertRule de dominio
   */
  private mapDbToAlertRule(row: any): AlertRule {
    return {
      id: row.id,
      code: row.code,
      name: row.name,
      description: row.description || '',
      module: row.module as AlertModule,
      defaultPriority: (row.default_priority || row.severity || 'MEDIA') as AlertPriority,
      enabled: row.is_enabled ?? true,
      thresholds: row.thresholds || row.config_params || {},
      targetRoles: Array.isArray(row.target_roles) ? row.target_roles : [],
      autoResolve: row.auto_resolve ?? true,
      updatedAt: row.updated_at || row.created_at,
      updatedBy: row.updated_by || 'Sistema',
    }
  }

  /**
   * Obtiene la lista de alertas aplicando filtros, paginación y ordenamiento
   */
  async getAlerts(
    criteria?: AlertFilterCriteria,
    preferredCompanyId?: string
  ): Promise<{ data: AlertItem[]; total: number }> {
    const client = getDbClient()
    const companyId = await this.resolveCompanyId(preferredCompanyId)

    let query = client
      .from('system_alerts')
      .select(
        `
        *,
        locations:location_id ( id, name ),
        users:assigned_user_id ( id, full_name )
      `,
        { count: 'exact' }
      )
      .eq('company_id', companyId)

    if (criteria?.searchQuery && criteria.searchQuery.trim()) {
      const q = `%${criteria.searchQuery.trim()}%`
      query = query.or(
        `title.ilike.${q},description.ilike.${q},code.ilike.${q},entity_reference.ilike.${q}`
      )
    }

    if (criteria?.priority && criteria.priority !== 'ALL') {
      query = query.eq('priority', criteria.priority)
    }

    if (criteria?.module && criteria.module !== 'ALL') {
      query = query.eq('module', criteria.module)
    }

    if (criteria?.status && criteria.status !== 'ALL') {
      query = query.eq('status', criteria.status)
    }

    if (criteria?.locationId && criteria.locationId !== 'ALL') {
      query = query.eq('location_id', criteria.locationId)
    }

    if (criteria?.onlyCritical) {
      query = query.eq('priority', 'CRITICA')
    }

    if (criteria?.onlyUnread) {
      query = query.or('status.eq.NEW,read_at.is.null')
    }

    if (criteria?.assignedUserId && criteria.assignedUserId !== 'ALL') {
      query = query.eq('assigned_user_id', criteria.assignedUserId)
    }

    if (criteria?.startDate) {
      query = query.gte('created_at', criteria.startDate)
    }

    if (criteria?.endDate) {
      query = query.lte('created_at', criteria.endDate)
    }

    // Ordenamiento: primero por estado (pendientes primero) y fecha descendente
    query = query.order('created_at', { ascending: false })

    const page = criteria?.page || 1
    const pageSize = criteria?.pageSize || 15
    const startIdx = (page - 1) * pageSize
    query = query.range(startIdx, startIdx + pageSize - 1)

    const { data, count, error } = await query

    if (error) {
      throw new Error(`Error consultando alertas: ${error.message}`)
    }

    const items = (data || []).map((row: any) => this.mapDbToAlertItem(row))

    return {
      data: items,
      total: count || 0,
    }
  }

  /**
   * Obtiene una alerta por su ID
   */
  async getAlertById(id: string, preferredCompanyId?: string): Promise<AlertItem | null> {
    const client = getDbClient()
    let query = client
      .from('system_alerts')
      .select(
        `
        *,
        locations:location_id ( id, name ),
        users:assigned_user_id ( id, full_name )
      `
      )
      .eq('id', id)

    if (preferredCompanyId) {
      query = query.eq('company_id', preferredCompanyId)
    }

    const { data, error } = await query.maybeSingle()

    if (error || !data) return null
    return this.mapDbToAlertItem(data)
  }

  /**
   * Obtiene todas las alertas registradas para la empresa
   */
  async getAllAlerts(preferredCompanyId?: string): Promise<AlertItem[]> {
    const client = getDbClient()
    const companyId = await this.resolveCompanyId(preferredCompanyId)

    const { data, error } = await client
      .from('system_alerts')
      .select(
        `
        *,
        locations:location_id ( id, name ),
        users:assigned_user_id ( id, full_name )
      `
      )
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })

    if (error) {
      throw new Error(`Error obteniendo todas las alertas: ${error.message}`)
    }

    return (data || []).map((row: any) => this.mapDbToAlertItem(row))
  }

  /**
   * Obtiene todas las alertas activas (NEW, READ, IN_PROGRESS)
   */
  async getActiveAlerts(preferredCompanyId?: string): Promise<AlertItem[]> {
    const client = getDbClient()
    const companyId = await this.resolveCompanyId(preferredCompanyId)

    const { data, error } = await client
      .from('system_alerts')
      .select(
        `
        *,
        locations:location_id ( id, name ),
        users:assigned_user_id ( id, full_name )
      `
      )
      .eq('company_id', companyId)
      .in('status', ['NEW', 'READ', 'IN_PROGRESS'])
      .order('created_at', { ascending: false })

    if (error) {
      throw new Error(`Error obteniendo alertas activas: ${error.message}`)
    }

    return (data || []).map((row: any) => this.mapDbToAlertItem(row))
  }

  /**
   * Inserta una nueva alerta en PostgreSQL
   */
  async createAlert(
    alertData: Omit<AlertItem, 'id' | 'code' | 'createdAt' | 'updatedAt' | 'history'>,
    preferredCompanyId?: string
  ): Promise<AlertItem> {
    const client = getDbClient()
    const companyId = await this.resolveCompanyId(preferredCompanyId)

    const code = `ALT-${alertData.module.slice(0, 3)}-${Date.now().toString().slice(-6)}`
    const nowIso = new Date().toISOString()

    const initialHistory = [
      {
        timestamp: nowIso,
        actor: 'Sistema de Reglas Automáticas',
        action: 'CREATED',
        notes: 'Alerta creada automáticamente por detección de evento.',
      },
    ]

    const insertPayload: any = {
      company_id: companyId,
      rule_id: alertData.ruleId && alertData.ruleId.length === 36 ? alertData.ruleId : null,
      location_id: alertData.locationId || null,
      code,
      title: alertData.title,
      description: alertData.description,
      message: alertData.description,
      priority: alertData.priority,
      status: alertData.status || 'NEW',
      module: alertData.module,
      entity_type: alertData.entityType,
      entity_id: alertData.entityId,
      entity_reference: alertData.entityReference,
      assigned_role: alertData.assignedRole || null,
      assigned_user_id: alertData.assignedUserId || null,
      read_at: alertData.readAt || null,
      read_by_user_id: alertData.readByUserId || null,
      attended_at: alertData.attendedAt || null,
      attended_by_user_id: alertData.attendedByUserId || null,
      attended_by_user_name: alertData.attendedByUserName || null,
      attended_comment: alertData.attendedComment || null,
      resolved_at: alertData.resolvedAt || null,
      resolved_by_user_id: alertData.resolvedByUserId || null,
      resolved_by_user_name: alertData.resolvedByUserName || null,
      solution_notes: alertData.solutionNotes || null,
      resolution_notes: alertData.solutionNotes || null,
      closed_at: alertData.closedAt || null,
      closed_by_user_id: alertData.closedByUserId || null,
      metadata: alertData.metadata || {},
      history: initialHistory,
      created_at: nowIso,
      updated_at: nowIso,
    }

    const { data, error } = await client
      .from('system_alerts')
      .insert(insertPayload)
      .select(
        `
        *,
        locations:location_id ( id, name ),
        users:assigned_user_id ( id, full_name )
      `
      )
      .single()

    if (error || !data) {
      throw new Error(`Error insertando alerta en PostgreSQL: ${error?.message}`)
    }

    return this.mapDbToAlertItem(data)
  }

  /**
   * Actualiza una alerta existente
   */
  async updateAlert(
    id: string,
    updates: Partial<AlertItem>,
    preferredCompanyId?: string
  ): Promise<AlertItem> {
    const client = getDbClient()
    const nowIso = new Date().toISOString()

    const dbUpdates: any = {
      updated_at: nowIso,
    }

    if (updates.title !== undefined) dbUpdates.title = updates.title
    if (updates.description !== undefined) {
      dbUpdates.description = updates.description
      dbUpdates.message = updates.description
    }
    if (updates.priority !== undefined) dbUpdates.priority = updates.priority
    if (updates.status !== undefined) dbUpdates.status = updates.status
    if (updates.locationId !== undefined) dbUpdates.location_id = updates.locationId
    if (updates.assignedRole !== undefined) dbUpdates.assigned_role = updates.assignedRole
    if (updates.assignedUserId !== undefined) dbUpdates.assigned_user_id = updates.assignedUserId
    if (updates.readAt !== undefined) dbUpdates.read_at = updates.readAt
    if (updates.readByUserId !== undefined) dbUpdates.read_by_user_id = updates.readByUserId
    if (updates.attendedAt !== undefined) dbUpdates.attended_at = updates.attendedAt
    if (updates.attendedByUserId !== undefined) dbUpdates.attended_by_user_id = updates.attendedByUserId
    if (updates.attendedByUserName !== undefined) dbUpdates.attended_by_user_name = updates.attendedByUserName
    if (updates.attendedComment !== undefined) dbUpdates.attended_comment = updates.attendedComment
    if (updates.resolvedAt !== undefined) dbUpdates.resolved_at = updates.resolvedAt
    if (updates.resolvedByUserId !== undefined) dbUpdates.resolved_by_user_id = updates.resolvedByUserId
    if (updates.resolvedByUserName !== undefined) dbUpdates.resolved_by_user_name = updates.resolvedByUserName
    if (updates.solutionNotes !== undefined) {
      dbUpdates.solution_notes = updates.solutionNotes
      dbUpdates.resolution_notes = updates.solutionNotes
    }
    if (updates.closedAt !== undefined) dbUpdates.closed_at = updates.closedAt
    if (updates.closedByUserId !== undefined) dbUpdates.closed_by_user_id = updates.closedByUserId
    if (updates.metadata !== undefined) dbUpdates.metadata = updates.metadata
    if (updates.history !== undefined) dbUpdates.history = updates.history

    let query = client
      .from('system_alerts')
      .update(dbUpdates)
      .eq('id', id)

    if (preferredCompanyId) {
      query = query.eq('company_id', preferredCompanyId)
    }

    const { data, error } = await query
      .select(
        `
        *,
        locations:location_id ( id, name ),
        users:assigned_user_id ( id, full_name )
      `
      )
      .single()

    if (error || !data) {
      throw new Error(`Error actualizando alerta ${id}: ${error?.message}`)
    }

    return this.mapDbToAlertItem(data)
  }

  /**
   * Obtiene estadísticas agregadas de alertas
   */
  async getStats(locationId?: string, preferredCompanyId?: string): Promise<AlertStats> {
    const client = getDbClient()
    const companyId = await this.resolveCompanyId(preferredCompanyId)

    let query = client
      .from('system_alerts')
      .select(
        `
        id,
        module,
        priority,
        status,
        location_id,
        locations:location_id ( name )
      `
      )
      .eq('company_id', companyId)

    if (locationId && locationId !== 'ALL') {
      query = query.eq('location_id', locationId)
    }

    const { data, error } = await query

    if (error) {
      throw new Error(`Error obteniendo estadísticas de alertas: ${error.message}`)
    }

    const list = data || []

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

    list.forEach((a: any) => {
      if (byModule[a.module as AlertModule] !== undefined) byModule[a.module as AlertModule]++
      if (byPriority[a.priority as AlertPriority] !== undefined) byPriority[a.priority as AlertPriority]++
      if (byStatus[a.status as AlertStatus] !== undefined) byStatus[a.status as AlertStatus]++

      const locId = a.location_id || 'GLOBAL'
      const locName = (a.locations as any)?.name || 'Consolidado General'
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
      (a: any) => a.priority === 'CRITICA' && !['RESOLVED', 'CLOSED'].includes(a.status)
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
   * Obtiene la lista de reglas configurables (globales o de la empresa)
   */
  async getRules(preferredCompanyId?: string): Promise<AlertRule[]> {
    const client = getDbClient()
    const companyId = await this.resolveCompanyId(preferredCompanyId)

    const { data, error } = await client
      .from('alert_rules')
      .select('*')
      .or(`company_id.eq.${companyId},company_id.is.null`)
      .order('code', { ascending: true })

    if (error) {
      throw new Error(`Error obteniendo reglas de alerta: ${error.message}`)
    }

    return (data || []).map((row: any) => this.mapDbToAlertRule(row))
  }

  /**
   * Actualiza la configuración de una regla
   */
  async updateRule(
    ruleId: string,
    updates: Partial<AlertRule>,
    preferredCompanyId?: string
  ): Promise<AlertRule> {
    const client = getDbClient()
    const companyId = await this.resolveCompanyId(preferredCompanyId)
    const nowIso = new Date().toISOString()

    const dbUpdates: any = {
      updated_at: nowIso,
    }

    if (updates.name !== undefined) dbUpdates.name = updates.name
    if (updates.description !== undefined) dbUpdates.description = updates.description
    if (updates.defaultPriority !== undefined) {
      dbUpdates.default_priority = updates.defaultPriority
      dbUpdates.severity = updates.defaultPriority
    }
    if (updates.enabled !== undefined) dbUpdates.is_enabled = updates.enabled
    if (updates.thresholds !== undefined) {
      dbUpdates.thresholds = updates.thresholds
      dbUpdates.config_params = updates.thresholds
    }
    if (updates.targetRoles !== undefined) dbUpdates.target_roles = updates.targetRoles
    if (updates.autoResolve !== undefined) dbUpdates.auto_resolve = updates.autoResolve
    if (updates.updatedBy !== undefined) dbUpdates.updated_by = updates.updatedBy

    // Intentar actualizar por id (o por código si ruleId es un código como rule-inv-001)
    let query = client.from('alert_rules').update(dbUpdates)
    if (ruleId.length === 36) {
      query = query.eq('id', ruleId)
    } else {
      query = query.eq('code', ruleId.toUpperCase())
    }

    const { data, error } = await query.select('*').maybeSingle()

    if (error || !data) {
      throw new Error(`Error actualizando regla ${ruleId}: ${error?.message || 'No encontrada'}`)
    }

    return this.mapDbToAlertRule(data)
  }

  /**
   * Reporte y Sugerencias de Reabastecimiento de Inventario
   * Identifica productos cuyo stock actual en bodega está por debajo del umbral mínimo configurado.
   */
  async getReplenishmentSuggestions(
    locationId?: string,
    preferredCompanyId?: string
  ): Promise<ReplenishmentSuggestion[]> {
    const client = getDbClient()
    const companyId = await this.resolveCompanyId(preferredCompanyId)

    let query = client
      .from('stock_levels')
      .select(
        `
        product_id,
        location_id,
        quantity,
        products:product_id (
          id,
          sku,
          barcode,
          name,
          min_stock_threshold,
          critical_stock_threshold,
          cost_price,
          is_active
        ),
        locations:location_id (
          id,
          name,
          code,
          status
        )
      `
      )
      .eq('company_id', companyId)

    if (locationId && locationId !== 'ALL') {
      query = query.eq('location_id', locationId)
    }

    const { data, error } = await query

    if (error) {
      throw new Error(`Error calculando sugerencias de reabastecimiento: ${error.message}`)
    }

    const suggestions: ReplenishmentSuggestion[] = []

    for (const row of data || []) {
      const prod = row.products as any
      const loc = row.locations as any
      if (!prod || !prod.is_active || !loc || loc.status !== 'ACTIVE') continue

      const currentStock = Number(row.quantity) || 0
      const minStock = Number(prod.min_stock_threshold) || 10
      const criticalStock = Number(prod.critical_stock_threshold) || Math.floor(minStock / 2)
      const costPrice = Number(prod.cost_price) || 0

      if (currentStock <= minStock) {
        // Cálculo de cantidad a reabastecer: alcanzar el doble del mínimo
        const targetStock = minStock * 2
        const suggestedQuantity = Math.max(1, targetStock - currentStock)
        const estimatedTotalCost = suggestedQuantity * costPrice

        let urgency: 'CRITICA' | 'ALTA' | 'MEDIA' = 'MEDIA'
        if (currentStock <= 0) {
          urgency = 'CRITICA'
        } else if (currentStock <= criticalStock) {
          urgency = 'ALTA'
        }

        suggestions.push({
          productId: prod.id,
          sku: prod.sku,
          productName: prod.name,
          barcode: prod.barcode || undefined,
          locationId: loc.id,
          locationName: loc.name,
          currentStock,
          minStockThreshold: minStock,
          criticalStockThreshold: criticalStock,
          suggestedQuantity,
          unitCost: costPrice,
          estimatedTotalCost,
          urgency,
        })
      }
    }

    // Ordenar por urgencia (CRITICA > ALTA > MEDIA) y luego por déficit
    const urgencyWeight = { CRITICA: 3, ALTA: 2, MEDIA: 1 }
    suggestions.sort((a, b) => {
      const uDiff = urgencyWeight[b.urgency] - urgencyWeight[a.urgency]
      if (uDiff !== 0) return uDiff
      return (b.minStockThreshold - b.currentStock) - (a.minStockThreshold - a.currentStock)
    })

    return suggestions
  }
}

export const alertRepository = new AlertRepository()
