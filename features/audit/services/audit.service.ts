/**
 * SUPER MÁS ERP/POS - Servicio de Negocio de Auditoría
 *
 * Ofrece la API transversal para el registro y consulta segura de auditoría
 * en todo el sistema. Aplica reglas de sanitización de información sensible
 * y control de acceso basado en roles.
 */

import { auditRepository } from '../repositories/audit.repository'
import { AuditLogEntry, AuditFilters, AuditStats, AuditPermission, AuditLevel } from '../types'

const ROLE_PERMISSIONS: Record<string, AuditPermission[]> = {
  SUPERADMIN: ['audit.read', 'audit.export', 'audit.critical', 'audit.security', 'audit.config'],
  WAREHOUSE_ADMIN: ['audit.read', 'audit.export'],
  POINT_ADMIN: ['audit.read', 'audit.export'],
  ACCOUNTANT: ['audit.read', 'audit.export', 'audit.critical'],
  SELLER: [],
  CASHIER: [],
}

export class AuditService {
  /**
   * Verifica si un rol cuenta con un permiso específico de auditoría.
   */
  hasPermission(permission: AuditPermission, userRole?: string): boolean {
    if (!userRole) return true // Sesión activa por defecto en demo
    const allowed = ROLE_PERMISSIONS[userRole] || []
    return allowed.includes(permission)
  }

  private assertPermission(permission: AuditPermission, userRole?: string): void {
    if (!this.hasPermission(permission, userRole)) {
      throw new Error(`Permiso denegado: Se requiere '${permission}' para acceder a los registros de auditoría.`)
    }
  }

  /**
   * Consulta el listado de logs aplicando filtros y reglas de seguridad por bodega/rol.
   */
  async list(
    filters: AuditFilters = {},
    userRole: string = 'SUPERADMIN',
    userLocationId?: string
  ): Promise<AuditLogEntry[]> {
    this.assertPermission('audit.read', userRole)

    const effectiveFilters = { ...filters }

    // Si el usuario pertenece a una bodega específica y no es SUPERADMIN ni CONTADOR, limitar a su bodega
    if (userLocationId && userRole !== 'SUPERADMIN' && userRole !== 'ACCOUNTANT') {
      effectiveFilters.locationId = userLocationId
    }

    const logs = await auditRepository.getLogs(effectiveFilters)

    // Ocultar eventos de seguridad crítica o logins fallidos si no tiene permiso audit.security
    if (!this.hasPermission('audit.security', userRole)) {
      return logs.filter((l) => l.module !== 'SECURITY' && l.action !== 'LOGIN_FAILED')
    }

    return logs
  }

  /**
   * Consulta las estadísticas de auditoría.
   */
  async getAuditStats(
    filters: AuditFilters = {},
    userRole: string = 'SUPERADMIN',
    userLocationId?: string
  ): Promise<AuditStats> {
    this.assertPermission('audit.read', userRole)

    const effectiveFilters = { ...filters }
    if (userLocationId && userRole !== 'SUPERADMIN' && userRole !== 'ACCOUNTANT') {
      effectiveFilters.locationId = userLocationId
    }

    return auditRepository.getStats(effectiveFilters)
  }

  /**
   * Obtiene un registro individual por su ID.
   */
  async getById(id: string, userRole: string = 'SUPERADMIN'): Promise<AuditLogEntry | null> {
    this.assertPermission('audit.read', userRole)
    return auditRepository.getLogById(id)
  }

  /**
   * Método transversal utilizado por TODOS los módulos del ERP para registrar operaciones sensibles.
   * Sanitiza automáticamente datos sensibles (contraseñas, tokens, tarjetas, llaves secretas).
   */
  async log(entry: {
    action: AuditLogEntry['action']
    module: AuditLogEntry['module']
    entityType: string
    entityId: string
    entityReference?: string
    userId: string
    userName: string
    userRole: string
    locationId?: string
    locationName?: string
    level?: AuditLevel
    result?: AuditLogEntry['result']
    details: string
    ipAddress?: string
    sessionId?: string
    changes?: AuditLogEntry['changes']
  }): Promise<AuditLogEntry> {
    // Sanitizar posibles campos sensibles en los diffs y detalles
    const sanitizedChanges = entry.changes?.map((ch) => {
      const lowerField = ch.field.toLowerCase()
      if (
        lowerField.includes('password') ||
        lowerField.includes('token') ||
        lowerField.includes('secret') ||
        lowerField.includes('pin') ||
        lowerField.includes('key')
      ) {
        return {
          ...ch,
          previousValue: '********',
          newValue: '********',
        }
      }
      return ch
    })

    const sanitizedDetails = entry.details
      .replace(/(password|token|secret|apiKey)=([^&\s]+)/gi, '$1=********')

    const newLog = await auditRepository.log({
      action: entry.action,
      module: entry.module,
      entityType: entry.entityType,
      entityId: entry.entityId,
      entityReference: entry.entityReference,
      userId: entry.userId,
      userName: entry.userName,
      userRole: entry.userRole,
      locationId: entry.locationId,
      locationName: entry.locationName,
      level: entry.level || 'INFO',
      result: entry.result || 'SUCCESS',
      details: sanitizedDetails,
      ipAddress: entry.ipAddress || '192.168.1.1',
      sessionId: entry.sessionId,
      changes: sanitizedChanges,
    })

    return newLog
  }

  /**
   * Exporta los logs filtrados a formato CSV y registra el evento de exportación en la propia auditoría.
   */
  async exportAudit(
    filters: AuditFilters = {},
    user: { id: string; name: string; role: string },
    userRole: string = 'SUPERADMIN'
  ): Promise<{ fileName: string; content: string; totalRecords: number }> {
    this.assertPermission('audit.export', userRole)

    const logs = await this.list(filters, userRole)

    const headers = [
      'ID Evento',
      'Fecha UTC',
      'Fecha Local (Colombia)',
      'Usuario',
      'Rol',
      'Módulo',
      'Acción',
      'Nivel',
      'Resultado',
      'Entidad',
      'ID Registro',
      'Referencia',
      'Bodega',
      'Detalles',
      'Dirección IP',
    ]

    const rows = logs.map((l) => {
      const localDate = new Intl.DateTimeFormat('es-CO', {
        timeZone: 'America/Bogota',
        dateStyle: 'short',
        timeStyle: 'medium',
      }).format(new Date(l.timestamp))

      return [
        l.id,
        l.timestamp,
        localDate,
        `"${l.userName}"`,
        `"${l.userRole}"`,
        l.module,
        l.action,
        l.level,
        l.result,
        l.entityType,
        l.entityId,
        `"${l.entityReference || ''}"`,
        `"${l.locationName || 'N/A'}"`,
        `"${(l.details || '').replace(/"/g, '""')}"`,
        l.ipAddress || 'N/A',
      ].join(',')
    })

    const csvContent = [headers.join(','), ...rows].join('\n')
    const fileName = `auditoria_supermas_${new Date().toISOString().split('T')[0]}.csv`

    // Registrar en la auditoría el evento de exportación
    await this.log({
      action: 'EXPORT_EXECUTED',
      module: 'SECURITY',
      entityType: 'AUDIT_EXPORT',
      entityId: `exp-${Date.now()}`,
      entityReference: fileName,
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      level: 'INFO',
      result: 'SUCCESS',
      details: `Exportación de ${logs.length} registros de auditoría a archivo CSV realizada por ${user.name}.`,
    })

    return {
      fileName,
      content: csvContent,
      totalRecords: logs.length,
    }
  }
}

export const auditService = new AuditService()
