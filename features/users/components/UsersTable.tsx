'use client'

import React, { useState } from 'react'
import { AppIcon } from '@/components/ui/Icon'
import { User } from '../types'
import { SYSTEM_ROLES } from '../services/role-permissions'

interface UsersTableProps {
  users: User[]
  onViewUser: (user: User) => void
  onEditUser: (user: User) => void
  onToggleStatus: (user: User) => void
  onViewActivity: (user: User) => void
  canUpdate: boolean
  canActivate: boolean
  isLoading?: boolean
}

export function UsersTable({
  users,
  onViewUser,
  onEditUser,
  onToggleStatus,
  onViewActivity,
  canUpdate,
  canActivate,
  isLoading,
}: UsersTableProps) {
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 10

  const totalPages = Math.ceil(users.length / pageSize) || 1
  const paginatedUsers = users.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  const formatDateTime = (timestamp: string | null) => {
    if (!timestamp) return 'Sin accesos registrados'
    try {
      return new Intl.DateTimeFormat('es-CO', {
        timeZone: 'America/Bogota',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      }).format(new Date(timestamp))
    } catch {
      return timestamp
    }
  }

  if (users.length === 0 && !isLoading) {
    return (
      <div
        style={{
          background: 'var(--surface, #ffffff)',
          border: '1px solid var(--line, #e2e8f0)',
          borderRadius: 10,
          padding: '48px 24px',
          textAlign: 'center',
          color: 'var(--muted, #64748b)',
        }}
      >
        <div style={{ display: 'inline-flex', padding: 12, borderRadius: '50%', background: '#f1f5f9', marginBottom: 12 }}>
          <AppIcon name="users" size={32} />
        </div>
        <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>
          No se encontraron usuarios
        </h3>
        <p style={{ fontSize: 14, maxWidth: 420, margin: '0 auto' }}>
          No hay colaboradores registrados que coincidan con los filtros o el término de búsqueda ingresado.
        </p>
      </div>
    )
  }

  return (
    <div
      style={{
        background: 'var(--surface, #ffffff)',
        border: '1px solid var(--line, #e2e8f0)',
        borderRadius: 10,
        overflow: 'hidden',
        boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
      }}
    >
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
          <thead>
            <tr
              style={{
                background: '#f8fafc',
                borderBottom: '1px solid var(--line, #e2e8f0)',
                color: 'var(--muted, #64748b)',
                fontSize: 12,
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              <th style={{ padding: '12px 16px' }}>Colaborador</th>
              <th style={{ padding: '12px 16px' }}>Usuario / Email</th>
              <th style={{ padding: '12px 16px' }}>Rol Predefinido</th>
              <th style={{ padding: '12px 16px' }}>Sede Asignada</th>
              <th style={{ padding: '12px 16px' }}>Estado</th>
              <th style={{ padding: '12px 16px' }}>Último Acceso</th>
              <th style={{ padding: '12px 16px', textAlign: 'right' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {paginatedUsers.map((user) => {
              const roleDef = SYSTEM_ROLES[user.role] || {
                name: user.role,
                badgeColor: '#475569',
                badgeBg: '#f1f5f9',
              }

              return (
                <tr
                  key={user.id}
                  style={{
                    borderBottom: '1px solid var(--line, #e2e8f0)',
                    transition: 'background-color 0.15s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f8fafc')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  {/* Colaborador & Avatar */}
                  <td style={{ padding: '14px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: '50%',
                          background: user.status === 'ACTIVE' ? 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)' : '#94a3b8',
                          color: '#ffffff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 600,
                          fontSize: 13,
                          flexShrink: 0,
                          boxShadow: '0 2px 4px rgba(0,0,0,0.08)',
                        }}
                      >
                        {user.avatar || 'U'}
                      </div>
                      <div>
                        <span style={{ fontWeight: 600, color: 'var(--text)', display: 'block', fontSize: 14 }}>
                          {user.name}
                        </span>
                        <span style={{ fontSize: 12, color: 'var(--muted, #64748b)' }}>
                          ID: {user.id}
                        </span>
                      </div>
                    </div>
                  </td>

                  {/* Usuario / Email */}
                  <td style={{ padding: '14px 16px' }}>
                    <span style={{ display: 'block', color: 'var(--text)', fontWeight: 500 }}>
                      {user.email}
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--muted, #64748b)' }}>
                      @{user.username} {user.phone ? `• ${user.phone}` : ''}
                    </span>
                  </td>

                  {/* Rol Predefinido */}
                  <td style={{ padding: '14px 16px' }}>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '4px 10px',
                        borderRadius: 999,
                        fontSize: 12,
                        fontWeight: 600,
                        backgroundColor: roleDef.badgeBg,
                        color: roleDef.badgeColor,
                        border: `1px solid ${roleDef.badgeColor}25`,
                      }}
                    >
                      <AppIcon name="lock" size={12} />
                      {roleDef.name}
                    </span>
                  </td>

                  {/* Sede Asignada */}
                  <td style={{ padding: '14px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <AppIcon name="warehouses" size={14} />
                      <span style={{ color: 'var(--text)', fontWeight: 500 }}>
                        {user.locationName}
                      </span>
                    </div>
                  </td>

                  {/* Estado */}
                  <td style={{ padding: '14px 16px' }}>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '3px 8px',
                        borderRadius: 6,
                        fontSize: 12,
                        fontWeight: 600,
                        backgroundColor: user.status === 'ACTIVE' ? '#dcfce7' : '#f1f5f9',
                        color: user.status === 'ACTIVE' ? '#15803d' : '#64748b',
                      }}
                    >
                      <span
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: '50%',
                          backgroundColor: user.status === 'ACTIVE' ? '#16a34a' : '#94a3b8',
                        }}
                      />
                      {user.status === 'ACTIVE' ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>

                  {/* Último Acceso */}
                  <td style={{ padding: '14px 16px', color: 'var(--muted, #64748b)', whiteSpace: 'nowrap' }}>
                    {formatDateTime(user.lastLoginAt)}
                  </td>

                  {/* Acciones */}
                  <td style={{ padding: '14px 16px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <div style={{ display: 'inline-flex', gap: 4 }}>
                      {/* Ver Detalle */}
                      <button
                        type="button"
                        className="outline-button"
                        style={{ padding: '6px 8px', minHeight: 'unset' }}
                        onClick={() => onViewUser(user)}
                        title="Ver detalle del usuario y permisos derivados"
                        aria-label={`Ver detalle de ${user.name}`}
                      >
                        <AppIcon name="eye" size={14} />
                      </button>

                      {/* Editar */}
                      {canUpdate && (
                        <button
                          type="button"
                          className="outline-button"
                          style={{ padding: '6px 8px', minHeight: 'unset' }}
                          onClick={() => onEditUser(user)}
                          title="Editar colaborador"
                          aria-label={`Editar ${user.name}`}
                        >
                          <AppIcon name="edit" size={14} />
                        </button>
                      )}

                      {/* Ver Actividad */}
                      <button
                        type="button"
                        className="outline-button"
                        style={{ padding: '6px 8px', minHeight: 'unset' }}
                        onClick={() => onViewActivity(user)}
                        title="Ver historial de actividad y sesiones"
                        aria-label={`Ver actividad de ${user.name}`}
                      >
                        <AppIcon name="calendar" size={14} />
                      </button>

                      {/* Cambiar Estado */}
                      {canActivate && (
                        <button
                          type="button"
                          className="outline-button"
                          style={{
                            padding: '6px 8px',
                            minHeight: 'unset',
                            color: user.status === 'ACTIVE' ? '#b91c1c' : '#15803d',
                            borderColor: user.status === 'ACTIVE' ? '#fecaca' : '#bbf7d0',
                          }}
                          onClick={() => onToggleStatus(user)}
                          title={user.status === 'ACTIVE' ? 'Desactivar acceso' : 'Activar acceso'}
                          aria-label={user.status === 'ACTIVE' ? `Desactivar a ${user.name}` : `Activar a ${user.name}`}
                        >
                          <AppIcon name={user.status === 'ACTIVE' ? 'close' : 'check'} size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Paginación */}
      {totalPages > 1 && (
        <div
          style={{
            padding: '12px 16px',
            background: '#f8fafc',
            borderTop: '1px solid var(--line, #e2e8f0)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: 13,
            color: 'var(--muted, #64748b)',
          }}
        >
          <div>
            Mostrando <strong>{(currentPage - 1) * pageSize + 1}</strong> a{' '}
            <strong>{Math.min(currentPage * pageSize, users.length)}</strong> de{' '}
            <strong>{users.length}</strong> colaboradores
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              type="button"
              className="outline-button"
              style={{ padding: '4px 8px', minHeight: 'unset' }}
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            >
              Anterior
            </button>
            <span style={{ alignSelf: 'center', padding: '0 8px' }}>
              Página {currentPage} de {totalPages}
            </span>
            <button
              type="button"
              className="outline-button"
              style={{ padding: '4px 8px', minHeight: 'unset' }}
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            >
              Siguiente
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
