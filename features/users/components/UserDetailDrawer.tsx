'use client'

import React, { useState, useEffect } from 'react'
import { AppIcon } from '@/components/ui/Icon'
import { User } from '../types'
import { SYSTEM_ROLES } from '../services/role-permissions'
import { AuditLogEntry } from '@/features/audit/types'

interface UserDetailDrawerProps {
  isOpen: boolean
  onClose: () => void
  user: User | null
  activity: AuditLogEntry[]
  isLoadingActivity: boolean
  onEditUser: (user: User) => void
  onToggleStatus: (user: User) => void
  canUpdate: boolean
  canActivate: boolean
}

type TabType = 'PROFILE' | 'PERMISSIONS' | 'ACTIVITY'

export function UserDetailDrawer({
  isOpen,
  onClose,
  user,
  activity,
  isLoadingActivity,
  onEditUser,
  onToggleStatus,
  canUpdate,
  canActivate,
}: UserDetailDrawerProps) {
  const [activeTab, setActiveTab] = useState<TabType>('PROFILE')

  useEffect(() => {
    if (isOpen) {
      setActiveTab('PROFILE')
    }
  }, [isOpen])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen || !user) return null

  const roleDef = SYSTEM_ROLES[user.role] || {
    name: user.role,
    description: 'Rol operativo',
    badgeColor: '#475569',
    badgeBg: '#f1f5f9',
    scope: 'ASSIGNED_LOCATION',
    permissions: [],
  }

  const formatDateTime = (timestamp: string | null) => {
    if (!timestamp) return 'Nunca registrado'
    try {
      return new Intl.DateTimeFormat('es-CO', {
        timeZone: 'America/Bogota',
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(new Date(timestamp))
    } catch {
      return timestamp
    }
  }

  // Agrupación de permisos para consulta amigable
  const categorizedPermissions = {
    'Inventario & Logística': roleDef.permissions.filter((p) =>
      ['warehouses.read', 'warehouses.write', 'inventory.read', 'inventory.adjust', 'inventory.transfer', 'kardex.read'].includes(p)
    ),
    'Ventas, POS & Facturación': roleDef.permissions.filter((p) =>
      ['sales.read', 'sales.create', 'sales.cancel', 'pos.access', 'pos.cash_register', 'invoices.read', 'invoices.create', 'invoices.cancel', 'remissions.read', 'remissions.create'].includes(p)
    ),
    'Clientes & Proveedores': roleDef.permissions.filter((p) =>
      ['customers.read', 'customers.write', 'suppliers.read', 'suppliers.write', 'purchases.read', 'purchases.create'].includes(p)
    ),
    'Fiscal, Impuestos & Exógena': roleDef.permissions.filter((p) =>
      ['taxes.read', 'taxes.write', 'exogena.read', 'exogena.configure', 'exogena.generate', 'exogena.validate', 'exogena.export'].includes(p)
    ),
    'Seguridad, Auditoría & Usuarios': roleDef.permissions.filter((p) =>
      ['audit.read', 'audit.export', 'audit.critical', 'audit.security', 'reports.read', 'reports.financial', 'reports.export', 'users.read', 'users.create', 'users.update', 'users.activate', 'users.assign', 'users.view_activity', 'users.export'].includes(p)
    ),
  }

  return (
    <div
      className="drawer-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="user-detail-title"
    >
      <div
        className="product-drawer"
        style={{
          width: 'min(100%, 680px)',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          height: '100vh',
          maxHeight: '100vh',
          background: 'var(--surface, #ffffff)',
          overflowY: 'auto',
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: '50%',
                background: user.status === 'ACTIVE' ? 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)' : '#94a3b8',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: 18,
                flexShrink: 0,
                boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
              }}
            >
              {user.avatar || 'U'}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h2 id="user-detail-title" style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', margin: 0 }}>
                  {user.name}
                </h2>
                <span
                  style={{
                    padding: '2px 8px',
                    borderRadius: 4,
                    fontSize: 11,
                    fontWeight: 700,
                    backgroundColor: user.status === 'ACTIVE' ? '#dcfce7' : '#f1f5f9',
                    color: user.status === 'ACTIVE' ? '#15803d' : '#64748b',
                  }}
                >
                  {user.status === 'ACTIVE' ? 'Activo' : 'Inactivo'}
                </span>
              </div>
              <p style={{ fontSize: 13, color: 'var(--muted, #64748b)', margin: '2px 0 0' }}>
                @{user.username} • {user.email}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {canUpdate && (
              <button
                type="button"
                className="outline-button"
                style={{ padding: '6px 12px', fontSize: 13 }}
                onClick={() => {
                  onClose()
                  onEditUser(user)
                }}
              >
                <AppIcon name="edit" size={14} />
                <span>Editar</span>
              </button>
            )}
            <button
              type="button"
              className="icon-button"
              onClick={onClose}
              aria-label="Cerrar detalle"
            >
              <AppIcon name="close" size={18} />
            </button>
          </div>
        </div>

        {/* Pestañas de Navegación */}
        <div
          style={{
            display: 'flex',
            gap: 8,
            borderBottom: '1px solid var(--line, #e2e8f0)',
            marginTop: 16,
            marginBottom: 20,
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab('PROFILE')}
            style={{
              padding: '10px 16px',
              border: 'none',
              background: 'none',
              borderBottom: activeTab === 'PROFILE' ? '2px solid var(--brand-blue, #1e3a8a)' : '2px solid transparent',
              color: activeTab === 'PROFILE' ? 'var(--brand-blue, #1e3a8a)' : '#64748b',
              fontWeight: activeTab === 'PROFILE' ? 700 : 500,
              cursor: 'pointer',
              fontSize: 13,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <AppIcon name="users" size={14} />
            <span>Perfil & Sedes</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('PERMISSIONS')}
            style={{
              padding: '10px 16px',
              border: 'none',
              background: 'none',
              borderBottom: activeTab === 'PERMISSIONS' ? '2px solid var(--brand-blue, #1e3a8a)' : '2px solid transparent',
              color: activeTab === 'PERMISSIONS' ? 'var(--brand-blue, #1e3a8a)' : '#64748b',
              fontWeight: activeTab === 'PERMISSIONS' ? 700 : 500,
              cursor: 'pointer',
              fontSize: 13,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <AppIcon name="lock" size={14} />
            <span>Permisos Derivados ({roleDef.permissions.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('ACTIVITY')}
            style={{
              padding: '10px 16px',
              border: 'none',
              background: 'none',
              borderBottom: activeTab === 'ACTIVITY' ? '2px solid var(--brand-blue, #1e3a8a)' : '2px solid transparent',
              color: activeTab === 'ACTIVITY' ? 'var(--brand-blue, #1e3a8a)' : '#64748b',
              fontWeight: activeTab === 'ACTIVITY' ? 700 : 500,
              cursor: 'pointer',
              fontSize: 13,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <AppIcon name="calendar" size={14} />
            <span>Actividad ({activity.length})</span>
          </button>
        </div>

        {/* CONTENIDO TAB 1: PERFIL & SEDES */}
        {activeTab === 'PROFILE' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Tarjeta de Rol */}
            <div
              style={{
                padding: '16px',
                borderRadius: 8,
                backgroundColor: roleDef.badgeBg,
                border: `1px solid ${roleDef.badgeColor}30`,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    color: roleDef.badgeColor,
                    letterSpacing: '0.04em',
                  }}
                >
                  Rol Predefinido del Sistema
                </span>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    padding: '3px 8px',
                    borderRadius: 999,
                    backgroundColor: '#ffffff',
                    color: roleDef.badgeColor,
                  }}
                >
                  {roleDef.name}
                </span>
              </div>
              <p style={{ margin: '8px 0 0', fontSize: 13, color: 'var(--text)' }}>
                {roleDef.description}
              </p>
              <div style={{ marginTop: 8, fontSize: 12, fontWeight: 600, color: roleDef.badgeColor }}>
                Alcance operativo: {roleDef.scope === 'ALL_LOCATIONS' ? 'Acceso global a todas las bodegas' : 'Acceso a sedes asignadas'}
              </div>
            </div>

            {/* Grid de Datos */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: 16,
                background: '#f8fafc',
                padding: '16px',
                borderRadius: 8,
                border: '1px solid var(--line, #e2e8f0)',
              }}
            >
              <div>
                <span style={{ fontSize: 12, color: 'var(--muted, #64748b)', display: 'block' }}>Identificador</span>
                <strong style={{ fontSize: 14, color: 'var(--text)' }}>{user.id}</strong>
              </div>
              <div>
                <span style={{ fontSize: 12, color: 'var(--muted, #64748b)', display: 'block' }}>Teléfono</span>
                <strong style={{ fontSize: 14, color: 'var(--text)' }}>{user.phone || 'No registrado'}</strong>
              </div>
              <div>
                <span style={{ fontSize: 12, color: 'var(--muted, #64748b)', display: 'block' }}>Fecha de Registro</span>
                <strong style={{ fontSize: 14, color: 'var(--text)' }}>{formatDateTime(user.createdAt)}</strong>
              </div>
              <div>
                <span style={{ fontSize: 12, color: 'var(--muted, #64748b)', display: 'block' }}>Último Acceso al Sistema</span>
                <strong style={{ fontSize: 14, color: 'var(--text)' }}>{formatDateTime(user.lastLoginAt)}</strong>
              </div>
            </div>

            {/* Sedes Asignadas */}
            <div>
              <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 10 }}>
                Sedes y Bodegas Asignadas
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 14px',
                    borderRadius: 6,
                    border: '1px solid var(--line, #e2e8f0)',
                    background: '#ffffff',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ padding: 8, borderRadius: 6, background: '#eff6ff', color: '#1e40af' }}>
                      <AppIcon name="warehouses" size={16} />
                    </div>
                    <div>
                      <strong style={{ fontSize: 13, color: 'var(--text)', display: 'block' }}>
                        {user.locationName}
                      </strong>
                      <span style={{ fontSize: 12, color: 'var(--muted, #64748b)' }}>
                        ID(s): {user.locationIds?.join(', ') || 'Global'}
                      </span>
                    </div>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 4, background: '#dbeafe', color: '#1e40af' }}>
                    Sede Operativa
                  </span>
                </div>
              </div>
            </div>

            {/* Acciones Rápidas */}
            {canActivate && (
              <div style={{ marginTop: 10, paddingTop: 16, borderTop: '1px solid var(--line, #e2e8f0)' }}>
                <button
                  type="button"
                  className="outline-button"
                  style={{
                    color: user.status === 'ACTIVE' ? '#b91c1c' : '#15803d',
                    borderColor: user.status === 'ACTIVE' ? '#fecaca' : '#bbf7d0',
                  }}
                  onClick={() => onToggleStatus(user)}
                >
                  <AppIcon name={user.status === 'ACTIVE' ? 'close' : 'check'} size={14} />
                  <span>{user.status === 'ACTIVE' ? 'Desactivar acceso del usuario' : 'Habilitar acceso del usuario'}</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* CONTENIDO TAB 2: PERMISOS DERIVADOS */}
        {activeTab === 'PERMISSIONS' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div
              style={{
                padding: '12px 14px',
                backgroundColor: '#eff6ff',
                borderRadius: 6,
                border: '1px solid #bfdbfe',
                fontSize: 12,
                color: '#1e40af',
                display: 'flex',
                gap: 8,
                alignItems: 'center',
              }}
            >
              <AppIcon name="lock" size={16} />
              <span>
                <strong>Permisos del Rol:</strong> Estos privilegios se derivan automáticamente del rol predefinido <strong>{roleDef.name}</strong>. No son editables de forma individual para preservar la seguridad e integridad del ERP.
              </span>
            </div>

            {Object.entries(categorizedPermissions).map(([category, perms]) => {
              if (perms.length === 0) return null
              return (
                <div
                  key={category}
                  style={{
                    border: '1px solid var(--line, #e2e8f0)',
                    borderRadius: 8,
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      padding: '10px 14px',
                      background: '#f8fafc',
                      borderBottom: '1px solid var(--line, #e2e8f0)',
                      fontWeight: 600,
                      fontSize: 13,
                      color: 'var(--text)',
                      display: 'flex',
                      justifyContent: 'space-between',
                    }}
                  >
                    <span>{category}</span>
                    <span style={{ fontSize: 11, color: '#64748b' }}>{perms.length} privilegios</span>
                  </div>
                  <div style={{ padding: '12px 14px', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {perms.map((p) => (
                      <span
                        key={p}
                        style={{
                          fontSize: 11.5,
                          fontFamily: 'monospace',
                          padding: '4px 8px',
                          borderRadius: 4,
                          background: '#f1f5f9',
                          color: '#334155',
                          border: '1px solid #e2e8f0',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        <AppIcon name="check" size={10} />
                        {p}
                      </span>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* CONTENIDO TAB 3: ACTIVIDAD */}
        {activeTab === 'ACTIVITY' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: 'var(--muted, #64748b)' }}>
                Trazabilidad inmutable desde audit_logs.json
              </span>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>
                {activity.length} registros
              </span>
            </div>

            {isLoadingActivity ? (
              <div style={{ padding: '36px', textAlign: 'center', color: '#64748b' }}>
                <AppIcon name="refresh" size={20} />
                <p style={{ fontSize: 13, marginTop: 8 }}>Cargando actividad reciente...</p>
              </div>
            ) : activity.length === 0 ? (
              <div
                style={{
                  padding: '36px 16px',
                  textAlign: 'center',
                  background: '#f8fafc',
                  borderRadius: 8,
                  border: '1px solid var(--line, #e2e8f0)',
                  color: '#64748b',
                }}
              >
                <AppIcon name="calendar" size={24} />
                <p style={{ fontSize: 13, marginTop: 6, fontWeight: 500 }}>
                  No se han registrado operaciones para este usuario.
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {activity.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      padding: '12px 14px',
                      borderRadius: 6,
                      border: '1px solid var(--line, #e2e8f0)',
                      background: '#ffffff',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span
                          style={{
                            fontSize: 10.5,
                            fontWeight: 700,
                            padding: '2px 6px',
                            borderRadius: 4,
                            background: item.level === 'CRITICAL' ? '#fee2e2' : item.level === 'WARNING' ? '#fef3c7' : '#eff6ff',
                            color: item.level === 'CRITICAL' ? '#991b1b' : item.level === 'WARNING' ? '#92400e' : '#1e40af',
                          }}
                        >
                          {item.action}
                        </span>
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>
                          {item.module}
                        </span>
                      </div>
                      <span style={{ fontSize: 11, color: 'var(--muted, #64748b)' }}>
                        {formatDateTime(item.timestamp)}
                      </span>
                    </div>
                    <p style={{ margin: '4px 0 0', fontSize: 12.5, color: '#334155' }}>
                      {item.details}
                    </p>
                    {item.entityReference && (
                      <span style={{ fontSize: 11, color: '#64748b', fontStyle: 'italic' }}>
                        Ref: {item.entityReference}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
