'use client'

import React, { useEffect } from 'react'
import { AppIcon } from '@/components/ui/Icon'
import { AuditLogEntry, AuditLevel, AuditResult } from '../types'
import Link from 'next/link'

interface AuditDetailDrawerProps {
  isOpen: boolean
  onClose: () => void
  log: AuditLogEntry | null
}

export function AuditDetailDrawer({ isOpen, onClose, log }: AuditDetailDrawerProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen || !log) return null

  const formatLocalTime = (timestamp: string) => {
    try {
      return new Intl.DateTimeFormat('es-CO', {
        timeZone: 'America/Bogota',
        dateStyle: 'full',
        timeStyle: 'medium',
      }).format(new Date(timestamp))
    } catch {
      return timestamp
    }
  }

  const getLevelBadge = (level: AuditLevel) => {
    switch (level) {
      case 'CRITICAL':
        return { label: 'CRÍTICO', bg: '#fee2e2', text: '#991b1b', border: '#fecaca' }
      case 'WARNING':
        return { label: 'ADVERTENCIA', bg: '#fef3c7', text: '#92400e', border: '#fde68a' }
      case 'INFO':
      default:
        return { label: 'INFORMATIVO', bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe' }
    }
  }

  const getResultBadge = (result: AuditResult) => {
    switch (result) {
      case 'SUCCESS':
        return { label: 'Operación Exitosa', bg: '#dcfce7', text: '#166534' }
      case 'FAILED':
        return { label: 'Operación Fallida', bg: '#fee2e2', text: '#991b1b' }
      case 'REJECTED':
        return { label: 'Operación Rechazada', bg: '#ffedd5', text: '#9a3412' }
    }
  }

  const getOriginModuleLink = (entityType: string) => {
    switch (entityType) {
      case 'SALE':
        return { label: 'Ver Módulo de Ventas', href: '/ventas' }
      case 'PURCHASE':
        return { label: 'Ver Módulo de Compras', href: '/compras' }
      case 'INVOICE':
        return { label: 'Ver Módulo de Facturación', href: '/facturacion' }
      case 'CUSTOMER':
        return { label: 'Ver Módulo de Clientes', href: '/clientes' }
      case 'SUPPLIER':
        return { label: 'Ver Módulo de Proveedores', href: '/proveedores' }
      case 'LOCATION':
      case 'WAREHOUSE':
        return { label: 'Ver Módulo de Bodegas', href: '/bodegas' }
      case 'PRODUCT':
        return { label: 'Ver Productos / Inventario', href: '/inventario' }
      case 'TRANSFER':
        return { label: 'Ver Transferencias', href: '/transferencias' }
      case 'CASH_REGISTER':
        return { label: 'Ver Punto de Venta / POS', href: '/pos' }
      case 'TAX_CONFIG':
        return { label: 'Ver Configuración de Impuestos', href: '/impuestos' }
      case 'EXOGENA_BATCH':
        return { label: 'Ver Módulo de Exógena', href: '/exogena' }
      default:
        return null
    }
  }

  const level = getLevelBadge(log.level)
  const result = getResultBadge(log.result)
  const originLink = getOriginModuleLink(log.entityType)
  const hasDiffs = Array.isArray(log.changes) && log.changes.length > 0

  return (
    <div
      className="drawer-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="audit-detail-title"
    >
      <div
        className="product-drawer"
        style={{
          width: 'min(100%, 720px)',
          padding: '28px',
          display: 'flex',
          flexDirection: 'column',
          height: '100vh',
          maxHeight: '100vh',
          background: 'var(--surface, #ffffff)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Encabezado del Drawer */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            paddingBottom: 16,
            borderBottom: '1px solid var(--line, #e2e8f0)',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span
                style={{
                  fontSize: 10.5,
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: 4,
                  background: level.bg,
                  color: level.text,
                  border: `1px solid ${level.border}`,
                }}
              >
                {level.label}
              </span>
              <span
                style={{
                  fontSize: 10.5,
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: 4,
                  background: result.bg,
                  color: result.text,
                }}
              >
                {result.label}
              </span>
              <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>ID: {log.id}</span>
            </div>
            <h2 id="audit-detail-title" style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>
              Detalle del Evento de Auditoría
            </h2>
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label="Cerrar detalle de auditoría"
          >
            <AppIcon name="close" size={18} />
          </button>
        </div>

        {/* Contenido con scroll */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 0', display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Descripción de la acción */}
          <div
            style={{
              padding: 16,
              background: 'var(--table-header-bg, #f8fafc)',
              borderRadius: 8,
              border: '1px solid var(--line, #e2e8f0)',
            }}
          >
            <span style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', fontWeight: 600 }}>
              Detalles de la Operación
            </span>
            <p style={{ margin: '4px 0 0', fontSize: 13.5, color: 'var(--text)', lineHeight: 1.5, fontWeight: 500 }}>
              {log.details}
            </p>
          </div>

          {/* Grilla de Metadatos del Evento */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: 14,
            }}
          >
            <div style={{ padding: 12, borderRadius: 6, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
              <span style={{ fontSize: 11, color: 'var(--muted)', display: 'block' }}>Usuario Responsable</span>
              <strong style={{ fontSize: 13, color: 'var(--text)' }}>{log.userName}</strong>
              <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>{log.userRole}</div>
            </div>

            <div style={{ padding: 12, borderRadius: 6, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
              <span style={{ fontSize: 11, color: 'var(--muted)', display: 'block' }}>Módulo del Sistema</span>
              <strong style={{ fontSize: 13, color: 'var(--primary, #00205B)' }}>{log.module}</strong>
              <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>Acción: {log.action}</div>
            </div>

            <div style={{ padding: 12, borderRadius: 6, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
              <span style={{ fontSize: 11, color: 'var(--muted)', display: 'block' }}>Bodega / Sede</span>
              <strong style={{ fontSize: 13, color: 'var(--text)' }}>{log.locationName || 'Consolidado General'}</strong>
              <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>ID: {log.locationId || 'GLOBAL'}</div>
            </div>

            <div style={{ padding: 12, borderRadius: 6, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
              <span style={{ fontSize: 11, color: 'var(--muted)', display: 'block' }}>Registro Afectado</span>
              <strong style={{ fontSize: 13, color: 'var(--text)' }}>
                {log.entityReference || log.entityId}
              </strong>
              <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>Tipo: {log.entityType}</div>
            </div>
          </div>

          {/* Fecha y Hora en Diferentes Formatos */}
          <div style={{ padding: 12, borderRadius: 6, background: '#f8fafc', border: '1px solid #e2e8f0', fontSize: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ color: 'var(--muted)' }}>Fecha Local (Bogotá):</span>
              <strong style={{ color: 'var(--text)' }}>{formatLocalTime(log.timestamp)}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ color: 'var(--muted)' }}>Marca de Tiempo UTC:</span>
              <code style={{ fontSize: 11 }}>{log.timestamp}</code>
            </div>
            {log.ipAddress && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--muted)' }}>Dirección IP / Origen:</span>
                <span style={{ color: 'var(--text)' }}>{log.ipAddress}</span>
              </div>
            )}
          </div>

          {/* Comparativa de Cambios (Diffs Antes vs Después) */}
          {hasDiffs && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                <AppIcon name="edit" size={16} />
                <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0, color: 'var(--text)' }}>
                  Modificaciones Realizadas (Diffs)
                </h3>
              </div>

              <div className="table-wrapper" style={{ border: '1px solid var(--line, #e2e8f0)', borderRadius: 6 }}>
                <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                  <thead>
                    <tr style={{ background: '#f1f5f9' }}>
                      <th style={{ textAlign: 'left', padding: '8px 12px' }}>Campo</th>
                      <th style={{ textAlign: 'left', padding: '8px 12px', color: '#991b1b' }}>Valor Anterior</th>
                      <th style={{ textAlign: 'left', padding: '8px 12px', color: '#166534' }}>Valor Nuevo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {log.changes?.map((ch, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                        <td style={{ padding: '8px 12px', fontWeight: 600 }}>
                          {ch.label || ch.field}
                        </td>
                        <td style={{ padding: '8px 12px', color: '#dc2626', background: '#fef2f2' }}>
                          <del>{ch.previousValue}</del>
                        </td>
                        <td style={{ padding: '8px 12px', color: '#16a34a', background: '#f0fdf4', fontWeight: 600 }}>
                          {ch.newValue}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Navegación al Origen */}
          {originLink && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px 18px',
                borderRadius: 8,
                background: '#eff6ff',
                border: '1px solid #bfdbfe',
              }}
            >
              <div>
                <strong style={{ fontSize: 13, color: '#1e40af', display: 'block' }}>
                  Trazabilidad al Registro Original
                </strong>
                <span style={{ fontSize: 12, color: '#3b82f6' }}>
                  Puedes consultar el documento o entidad afectada directamente en su módulo.
                </span>
              </div>

              <Link
                href={originLink.href}
                className="primary-button compact"
                style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <span>{originLink.label}</span>
                <AppIcon name="arrowRight" size={13} />
              </Link>
            </div>
          )}
        </div>

        {/* Pie del Drawer */}
        <div
          style={{
            paddingTop: 16,
            borderTop: '1px solid var(--line, #e2e8f0)',
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <button type="button" className="outline-button compact" onClick={onClose}>
            Cerrar Ficha
          </button>
        </div>
      </div>
    </div>
  )
}
