'use client'

import React from 'react'
import { AppIcon } from '@/components/ui/Icon'

interface CustomerAuditTabProps {
  auditLogs: {
    id: string
    timestamp: string
    user: string
    action: string
    details: string
    oldValues?: Record<string, unknown>
    newValues?: Record<string, unknown>
  }[]
}

function formatAuditDate(isoString: string): string {
  try {
    const d = new Date(isoString)
    return d.toLocaleDateString('es-CO', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return isoString
  }
}

export function CustomerAuditTab({ auditLogs }: CustomerAuditTabProps) {
  if (auditLogs.length === 0) {
    return (
      <div className="table-empty-state" style={{ padding: '40px 20px', textAlign: 'center' }}>
        <div
          style={{
            display: 'grid',
            placeItems: 'center',
            width: 48,
            height: 48,
            borderRadius: 12,
            background: '#e9eef8',
            color: 'var(--navy)',
            margin: '0 auto 12px',
          }}
        >
          <AppIcon name="audit" size={24} />
        </div>
        <strong style={{ fontSize: 14 }}>Sin eventos de auditoría</strong>
        <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--muted)' }}>
          No hay registros de cambios de estado o modificaciones críticas para este cliente.
        </p>
      </div>
    )
  }

  return (
    <div className="page-enter" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {auditLogs.map((log) => (
        <div
          key={log.id}
          style={{
            padding: 14,
            borderRadius: 10,
            background: '#ffffff',
            border: '1px solid var(--line)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 12,
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: '#f1f5f9',
              display: 'grid',
              placeItems: 'center',
              color: 'var(--navy)',
              flexShrink: 0,
            }}
          >
            <AppIcon name="audit" size={15} />
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <strong style={{ fontSize: 12, color: 'var(--navy)' }}>{log.action}</strong>
              <span style={{ fontSize: 10, color: 'var(--muted)' }}>
                {formatAuditDate(log.timestamp)}
              </span>
            </div>

            <p style={{ margin: '4px 0 0', fontSize: 12, color: '#334155' }}>
              {log.details}
            </p>

            <span style={{ display: 'block', fontSize: 10, color: 'var(--muted)', marginTop: 4 }}>
              Responsable: <strong>{log.user}</strong>
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}
