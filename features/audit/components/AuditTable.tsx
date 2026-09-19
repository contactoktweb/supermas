'use client'

import React, { useState } from 'react'
import { AppIcon } from '@/components/ui/Icon'
import { AuditLogEntry, AuditLevel, AuditResult } from '../types'

interface AuditTableProps {
  logs: AuditLogEntry[]
  onSelectLog: (log: AuditLogEntry) => void
  isLoading?: boolean
}

export function AuditTable({ logs, onSelectLog, isLoading }: AuditTableProps) {
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 10

  const totalPages = Math.ceil(logs.length / pageSize) || 1
  const paginatedLogs = logs.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  const formatDateTime = (timestamp: string) => {
    try {
      return new Intl.DateTimeFormat('es-CO', {
        timeZone: 'America/Bogota',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      }).format(new Date(timestamp))
    } catch {
      return timestamp
    }
  }

  const getLevelBadge = (level: AuditLevel) => {
    switch (level) {
      case 'CRITICAL':
        return {
          label: 'Crítico',
          bg: '#fee2e2',
          text: '#991b1b',
          border: '#fecaca',
        }
      case 'WARNING':
        return {
          label: 'Aviso',
          bg: '#fef3c7',
          text: '#92400e',
          border: '#fde68a',
        }
      case 'INFO':
      default:
        return {
          label: 'Info',
          bg: '#eff6ff',
          text: '#1d4ed8',
          border: '#bfdbfe',
        }
    }
  }

  const getResultBadge = (result: AuditResult) => {
    switch (result) {
      case 'SUCCESS':
        return { label: 'Exitoso', color: '#166534', bg: '#dcfce7' }
      case 'FAILED':
        return { label: 'Fallido', color: '#991b1b', bg: '#fee2e2' }
      case 'REJECTED':
        return { label: 'Rechazado', color: '#9a3412', bg: '#ffedd5' }
    }
  }

  const getActionLabel = (action: string) => {
    switch (action) {
      case 'STOCK_ADJUSTED':
        return 'Ajuste de stock'
      case 'TRANSFER_APPROVED':
        return 'Transferencia aprobada'
      case 'SALE_CREATED':
        return 'Venta registrada'
      case 'SALE_CANCELLED':
        return 'Venta anulada'
      case 'PRICE_MODIFIED':
        return 'Precio modificado'
      case 'LOGIN':
        return 'Inicio de sesión'
      case 'LOGOUT':
        return 'Cierre de sesión'
      case 'LOGIN_FAILED':
        return 'Acceso fallido'
      case 'CASH_REGISTER_CLOSED':
        return 'Cierre de caja'
      case 'INVOICE_ISSUED':
        return 'Factura emitida'
      case 'INVOICE_CANCELLED':
        return 'Factura anulada'
      case 'PURCHASE_CREATED':
        return 'Compra registrada'
      case 'TAX_CONFIG_MODIFIED':
        return 'Impuesto modificado'
      case 'LOCATION_UPDATED':
        return 'Bodega editada'
      case 'EXOGENA_GENERATED':
        return 'Exógena generada'
      case 'EXPORT_EXECUTED':
        return 'Exportación CSV'
      default:
        return action.replace(/_/g, ' ')
    }
  }

  if (logs.length === 0 && !isLoading) {
    return (
      <div
        className="card"
        style={{
          padding: '48px 24px',
          textAlign: 'center',
          background: 'var(--surface, #ffffff)',
        }}
      >
        <div style={{ color: 'var(--muted)', marginBottom: 12 }}>
          <AppIcon name="audit" size={40} />
        </div>
        <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 4px', color: 'var(--text)' }}>
          No se encontraron eventos de auditoría
        </h3>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)' }}>
          Intenta ajustar los criterios de búsqueda o el rango de fechas seleccionado.
        </p>
      </div>
    )
  }

  return (
    <div
      className="table-panel animated-table warehouse-table-panel"
      style={{ background: 'var(--surface, #ffffff)', borderRadius: 10 }}
    >
      <div className="table-scroll">
        <table aria-label="Tabla de registros de auditoría">
          <thead>
            <tr>
              <th scope="col" style={{ width: 170 }}>
                Fecha y Hora (Bogotá)
              </th>
              <th scope="col">Usuario</th>
              <th scope="col">Módulo</th>
              <th scope="col">Acción</th>
              <th scope="col">Registro / Referencia</th>
              <th scope="col">Bodega</th>
              <th scope="col" style={{ textAlign: 'center' }}>
                Nivel
              </th>
              <th scope="col" style={{ textAlign: 'center' }}>
                Resultado
              </th>
              <th scope="col" style={{ textAlign: 'center', width: 90 }}>
                Acción
              </th>
            </tr>
          </thead>
          <tbody>
            {paginatedLogs.map((log) => {
              const level = getLevelBadge(log.level)
              const res = getResultBadge(log.result)
              const hasDiff = Array.isArray(log.changes) && log.changes.length > 0

              return (
                <tr
                  key={log.id}
                  onClick={() => onSelectLog(log)}
                  style={{
                    cursor: 'pointer',
                    transition: 'background 0.15s ease',
                  }}
                >
                  {/* Fecha y Hora */}
                  <td style={{ fontSize: 12, whiteSpace: 'nowrap', color: 'var(--text)' }}>
                    <div style={{ fontWeight: 600 }}>{formatDateTime(log.timestamp).split(',')[0]}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                      {formatDateTime(log.timestamp).split(',')[1] || ''}
                    </div>
                  </td>

                  {/* Usuario */}
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: '50%',
                          background: 'var(--table-header-bg, #f1f5f9)',
                          color: 'var(--primary, #00205B)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 700,
                          fontSize: 11,
                        }}
                      >
                        {log.userName
                          .split(' ')
                          .map((n) => n[0])
                          .slice(0, 2)
                          .join('')}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 12.5, color: 'var(--text)' }}>
                          {log.userName}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--muted)' }}>{log.userRole}</div>
                      </div>
                    </div>
                  </td>

                  {/* Módulo */}
                  <td>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        padding: '2px 6px',
                        borderRadius: 4,
                        background: '#f1f5f9',
                        color: '#334155',
                      }}
                    >
                      {log.module}
                    </span>
                  </td>

                  {/* Acción */}
                  <td>
                    <div style={{ fontWeight: 600, fontSize: 12.5, color: 'var(--text)' }}>
                      {getActionLabel(log.action)}
                    </div>
                    {hasDiff && (
                      <span
                        style={{
                          fontSize: 10.5,
                          color: 'var(--primary, #00205B)',
                          fontWeight: 600,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 3,
                        }}
                      >
                        <AppIcon name="edit" size={11} /> {log.changes?.length} campo(s) modificado(s)
                      </span>
                    )}
                  </td>

                  {/* Registro afectado */}
                  <td>
                    <div style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--text)' }}>
                      {log.entityReference || log.entityId}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                      Tipo: {log.entityType}
                    </div>
                  </td>

                  {/* Bodega */}
                  <td style={{ fontSize: 12, color: 'var(--muted)' }}>
                    {log.locationName || 'Global'}
                  </td>

                  {/* Nivel */}
                  <td style={{ textAlign: 'center' }}>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: 10,
                        background: level.bg,
                        color: level.text,
                        border: `1px solid ${level.border}`,
                      }}
                    >
                      {level.label}
                    </span>
                  </td>

                  {/* Resultado */}
                  <td style={{ textAlign: 'center' }}>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: 10,
                        background: res.bg,
                        color: res.color,
                      }}
                    >
                      {res.label}
                    </span>
                  </td>

                  {/* Acciones */}
                  <td style={{ textAlign: 'center' }}>
                    <button
                      type="button"
                      className="outline-button compact"
                      onClick={(e) => {
                        e.stopPropagation()
                        onSelectLog(log)
                      }}
                      title="Ver detalle del evento y diffs"
                      style={{ padding: '3px 8px', fontSize: 11 }}
                    >
                      <AppIcon name="eye" size={12} />
                      <span>Ver</span>
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Paginación */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '12px 18px',
          borderTop: '1px solid var(--line, #e2e8f0)',
          fontSize: 12,
          color: 'var(--muted)',
        }}
      >
        <span>
          Mostrando {(currentPage - 1) * pageSize + 1} -{' '}
          {Math.min(currentPage * pageSize, logs.length)} de {logs.length} eventos
        </span>

        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <button
            type="button"
            className="outline-button compact"
            disabled={currentPage === 1}
            onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
            style={{ padding: '4px 8px' }}
          >
            Anterior
          </button>
          <span>
            Página {currentPage} de {totalPages}
          </span>
          <button
            type="button"
            className="outline-button compact"
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
            style={{ padding: '4px 8px' }}
          >
            Siguiente
          </button>
        </div>
      </div>
    </div>
  )
}
