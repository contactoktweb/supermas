'use client'

import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { AppIcon } from '@/components/ui/Icon'
import { LoginAuditItem } from '../types'
import { dashboardService } from '../services/dashboard.service'

interface DashboardAuditModalProps {
  isOpen: boolean
  onClose: () => void
  audits: LoginAuditItem[]
}

export function DashboardAuditModal({
  isOpen,
  onClose,
  audits,
}: DashboardAuditModalProps) {
  const [mounted, setMounted] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'SUCCESS' | 'FAILED'>('ALL')

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!isOpen || !mounted) return null

  const filtered = audits.filter((log) => {
    const matchesSearch =
      log.userName.toLowerCase().includes(search.toLowerCase()) ||
      log.userEmail.toLowerCase().includes(search.toLowerCase()) ||
      log.locationName.toLowerCase().includes(search.toLowerCase()) ||
      log.ipAddress.includes(search)
    const matchesStatus =
      statusFilter === 'ALL' ? true : log.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const successCount = audits.filter((a) => a.status === 'SUCCESS').length
  const failedCount = audits.filter((a) => a.status === 'FAILED').length

  return createPortal(
    <div
      className="drawer-backdrop modal-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="deactivate-dialog-card modal-lg audit-dialog-card page-enter"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="dialog-header-standard">
          <div className="dialog-header-title">
            <div className="stat-icon blue">
              <AppIcon name="audit" size={20} />
            </div>
            <div>
              <p className="eyebrow">Auditoría de seguridad</p>
              <h3>Historial de inicios de sesión y accesos</h3>
            </div>
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label="Cerrar modal de auditoría"
          >
            <AppIcon name="close" size={18} />
          </button>
        </div>

        {/* Filters bar inside modal */}
        <div className="audit-modal-filters">
          <div className="search-box wide" style={{ flex: 1 }}>
            <AppIcon name="search" size={14} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por usuario, correo, sede o IP..."
            />
          </div>

          <div className="period-segmented-tabs audit-filter-segmented" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={statusFilter === 'ALL'}
              className={`period-tab-btn ${statusFilter === 'ALL' ? 'selected' : ''}`}
              onClick={() => setStatusFilter('ALL')}
            >
              <span>Todos</span>
              <span className="count-pill">{audits.length}</span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={statusFilter === 'SUCCESS'}
              className={`period-tab-btn ${statusFilter === 'SUCCESS' ? 'selected' : ''}`}
              onClick={() => setStatusFilter('SUCCESS')}
            >
              <AppIcon name="check" size={13} />
              <span>Exitosos</span>
              <span className="count-pill success">{successCount}</span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={statusFilter === 'FAILED'}
              className={`period-tab-btn ${statusFilter === 'FAILED' ? 'selected' : ''}`}
              onClick={() => setStatusFilter('FAILED')}
            >
              <AppIcon name="warning" size={13} />
              <span>Fallidos</span>
              {failedCount > 0 && (
                <span className="count-pill danger">{failedCount}</span>
              )}
            </button>
          </div>
        </div>

        {/* Audit Table */}
        <div className="table-panel animated-table audit-table-container">
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Usuario</th>
                  <th>Rol / Sede</th>
                  <th>Fecha y hora exacta</th>
                  <th>Estado</th>
                  <th>Dispositivo / Navegador</th>
                  <th>IP</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: 28, color: 'var(--muted)' }}>
                      No se encontraron registros de acceso con los filtros aplicados.
                    </td>
                  </tr>
                ) : (
                  filtered.map((log) => (
                    <tr key={log.id}>
                      <td>
                        <div className="product-cell">
                          <div className="product-thumb">
                            <AppIcon name="users" size={16} />
                          </div>
                          <div>
                            <strong>{log.userName}</strong>
                            <small>{log.userEmail}</small>
                          </div>
                        </div>
                      </td>

                      <td>
                        <span className="code-badge">{log.roleSnapshot}</span>
                        <small style={{ display: 'block', color: 'var(--muted)', marginTop: 2 }}>
                          {log.locationName}
                        </small>
                      </td>

                      <td>
                        <strong>{dashboardService.formatDateTime(log.loginAt, true)}</strong>
                      </td>

                      <td>
                        <span
                          className={`state ${
                            log.status === 'SUCCESS' ? 'disponible' : 'agotado'
                          }`}
                        >
                          {log.status === 'SUCCESS' ? (
                            <>
                              <AppIcon name="check" size={11} /> Exitoso
                            </>
                          ) : (
                            <>
                              <AppIcon name="warning" size={11} /> Fallido
                            </>
                          )}
                        </span>
                        {log.failureReason && (
                          <small
                            style={{
                              display: 'block',
                              color: 'var(--red)',
                              fontSize: 10,
                              marginTop: 3,
                              fontWeight: 600,
                            }}
                          >
                            {log.failureReason}
                          </small>
                        )}
                      </td>

                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <AppIcon name="laptop" size={13} color="var(--muted)" />
                          <span>{log.userAgent}</span>
                        </div>
                      </td>

                      <td>
                        <span className="mono">{log.ipAddress}</span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="dialog-footer">
          <button
            type="button"
            className="primary-button"
            onClick={onClose}
          >
            <AppIcon name="check" size={16} />
            <span>Entendido</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
