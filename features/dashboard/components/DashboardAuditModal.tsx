'use client'

import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import {
  ShieldCheck,
  ShieldAlert,
  X,
  Search,
  UserRound,
  Laptop,
  Check,
  AlertTriangle,
  Globe,
} from 'lucide-react'
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

  return createPortal(
    <div className="drawer-backdrop modal-center" onClick={onClose}>
      <div
        className="dialog-box audit-modal-box"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="dialog-header">
          <div className="dialog-title-group">
            <div className="dialog-icon-badge">
              <ShieldCheck size={20} color="var(--navy)" />
            </div>
            <div>
              <h2>Historial de inicios de sesión y accesos</h2>
              <p>
                Trazabilidad de sesiones, direcciones IP y dispositivos en tiempo real
              </p>
            </div>
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label="Cerrar modal de auditoría"
          >
            <X size={18} />
          </button>
        </div>

        {/* Filters bar inside modal */}
        <div className="audit-modal-filters">
          <div className="search-box wide" style={{ flex: 1 }}>
            <Search size={14} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por usuario, correo, sede o IP..."
            />
          </div>

          <div className="segmented">
            <button
              className={statusFilter === 'ALL' ? 'selected' : ''}
              onClick={() => setStatusFilter('ALL')}
            >
              Todos ({audits.length})
            </button>
            <button
              className={statusFilter === 'SUCCESS' ? 'selected' : ''}
              onClick={() => setStatusFilter('SUCCESS')}
            >
              Exitosos
            </button>
            <button
              className={statusFilter === 'FAILED' ? 'selected' : ''}
              onClick={() => setStatusFilter('FAILED')}
            >
              Fallidos
            </button>
          </div>
        </div>

        {/* Audit Table */}
        <div className="table-panel animated-table" style={{ maxHeight: 420, overflow: 'auto' }}>
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
                    <td colSpan={6} style={{ textAlign: 'center', padding: 24 }}>
                      No se encontraron registros de acceso con los filtros aplicados.
                    </td>
                  </tr>
                ) : (
                  filtered.map((log) => (
                    <tr key={log.id}>
                      <td>
                        <div className="product-cell">
                          <div className="product-thumb">
                            <UserRound size={16} />
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
                              <Check size={11} /> Exitoso
                            </>
                          ) : (
                            <>
                              <AlertTriangle size={11} /> Fallido
                            </>
                          )}
                        </span>
                        {log.failureReason && (
                          <small
                            style={{
                              display: 'block',
                              color: 'var(--red)',
                              fontSize: 10,
                              marginTop: 2,
                            }}
                          >
                            {log.failureReason}
                          </small>
                        )}
                      </td>

                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <Laptop size={13} color="var(--muted)" />
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
          <button type="button" className="primary-button" onClick={onClose}>
            Entendido
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
