'use client'

import React, { useState } from 'react'
import { AppIcon } from '@/components/ui/Icon'
import { LoginAuditItem, UserProfile } from '../types'
import { dashboardService } from '../services/dashboard.service'
import { DashboardAuditModal } from './DashboardAuditModal'

interface DashboardLoginAuditProps {
  audits: LoginAuditItem[]
  user: UserProfile
}

export function DashboardLoginAudit({ audits, user }: DashboardLoginAuditProps) {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const canSeeAudit = dashboardService.hasAuditAccess(user.role)

  if (!canSeeAudit || audits.length === 0) return null

  const previewList = audits.slice(0, 5)

  return (
    <>
      <section className="panel login-audit-panel page-enter">
        <div className="panel-heading">
          <div>
            <div className="panel-title-row">
              <AppIcon name="audit" size={18} color="var(--navy)" />
              <h2>Accesos recientes al sistema</h2>
            </div>
            <p>
              Trazabilidad de inicios de sesión, dispositivos e intentos de autenticación
            </p>
          </div>

          <button
            type="button"
            className="outline-button compact"
            onClick={() => setIsModalOpen(true)}
          >
            Ver historial completo <AppIcon name="chevronRight" size={14} />
          </button>
        </div>

        <div className="table-panel animated-table">
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Usuario</th>
                  <th>Rol / Sede</th>
                  <th>Fecha y hora exacta</th>
                  <th>Estado</th>
                  <th>Dispositivo</th>
                  <th>IP</th>
                </tr>
              </thead>
              <tbody>
                {previewList.map((log) => (
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
                      <small
                        style={{
                          display: 'block',
                          color: 'var(--muted)',
                          marginTop: 2,
                        }}
                      >
                        {log.locationName}
                      </small>
                    </td>

                    <td>
                      <strong>
                        {dashboardService.formatDateTime(log.loginAt, true)}
                      </strong>
                    </td>

                    <td>
                      <span
                        className={`state ${
                          log.status === 'SUCCESS' ? 'disponible' : 'agotado'
                        }`}
                      >
                        {log.status === 'SUCCESS' ? (
                          <>
                            <AppIcon name="check" size={12} /> Exitoso
                          </>
                        ) : (
                          <>
                            <AppIcon name="warning" size={12} /> Fallido
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
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <AppIcon name="laptop" size={14} color="var(--muted)" />
                        <span>{log.userAgent}</span>
                      </div>
                    </td>

                    <td>
                      <span className="mono">{log.ipAddress}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {isModalOpen && (
        <DashboardAuditModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          audits={audits}
        />
      )}
    </>
  )
}
