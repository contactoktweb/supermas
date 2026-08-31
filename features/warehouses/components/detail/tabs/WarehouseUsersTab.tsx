import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Users, UserPlus, UserCheck, Shield, Trash2, X } from 'lucide-react'
import { WarehouseUserAssignment, LocationWithMetrics } from '../../../types'
import { WarehouseEmptyState } from '../../WarehouseEmptyState'
import { CustomSelect } from '@/components/ui/CustomSelect'

interface WarehouseUsersTabProps {
  users: WarehouseUserAssignment[]
  warehouse: LocationWithMetrics
  canManageUsers: boolean
  onAssignUser: (user: { name: string; email: string; role: WarehouseUserAssignment['userRole'] }) => Promise<void>
  onUnassignUser: (userId: string) => Promise<void>
}

export function WarehouseUsersTab({
  users,
  warehouse,
  canManageUsers,
  onAssignUser,
  onUnassignUser,
}: WarehouseUsersTabProps) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
  }, [])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [userName, setUserName] = useState('')
  const [userEmail, setUserEmail] = useState('')
  const [userRole, setUserRole] = useState<WarehouseUserAssignment['userRole']>('SELLER')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!userName.trim() || !userEmail.trim()) return

    try {
      setIsSubmitting(true)
      await onAssignUser({ name: userName.trim(), email: userEmail.trim(), role: userRole })
      setIsModalOpen(false)
      setUserName('')
      setUserEmail('')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="warehouse-users-tab page-enter">
      <div className="toolbar">
        <p className="welcome-subtitle">
          Personal administrativo, operarios de inventario y cajeros asignados a <b>{warehouse.name}</b>.
        </p>

        {canManageUsers && (
          <button
            type="button"
            className="primary-button compact export"
            onClick={() => setIsModalOpen(true)}
          >
            <UserPlus size={15} />
            <span>Asignar usuario</span>
          </button>
        )}
      </div>

      {users.length === 0 ? (
        <WarehouseEmptyState
          type="NO_ITEMS"
          customTitle="No hay usuarios asignados"
          customDescription="Asigna responsables y personal operativo a esta sede para gestionar accesos."
          actionLabel="Asignar primer usuario"
          onAction={() => setIsModalOpen(true)}
        />
      ) : (
        <div className="table-panel animated-table">
          <div className="table-scroll">
            <table aria-label="Usuarios asignados a esta sede">
              <thead>
                <tr>
                  <th>Usuario</th>
                  <th>Correo corporativo</th>
                  <th>Rol operativo</th>
                  <th>Sede principal</th>
                  <th>Fecha de asignación</th>
                  <th>Último acceso</th>
                  <th>Estado</th>
                  {canManageUsers && <th aria-label="Acciones">Acciones</th>}
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <div className="product-cell">
                        <div className="avatar">{u.userName.substring(0, 2).toUpperCase()}</div>
                        <strong>{u.userName}</strong>
                      </div>
                    </td>
                    <td>{u.userEmail}</td>
                    <td>
                      <span className="location-type-badge warehouse">
                        <Shield size={11} style={{ marginRight: 4 }} />
                        {u.userRole === 'SUPERADMIN'
                          ? 'Superadministrador'
                          : u.userRole === 'STORE_ADMIN'
                          ? 'Administrador de bodega'
                          : u.userRole === 'POINT_ADMIN'
                          ? 'Administrador de punto'
                          : u.userRole === 'INVENTORY_CLERK'
                          ? 'Auxiliar de inventario'
                          : 'Vendedor / Cajero'}
                      </span>
                    </td>
                    <td>
                      <b>{u.isPrimaryLocation ? 'Sí' : 'Secundaria'}</b>
                    </td>
                    <td>{u.assignedAt}</td>
                    <td>
                      <span className="time-muted">{u.lastAccessAt}</span>
                    </td>
                    <td>
                      <span
                        className={`state ${
                          u.status === 'ACTIVE' ? 'disponible' : 'agotado'
                        }`}
                      >
                        {u.status === 'ACTIVE' ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    {canManageUsers && (
                      <td>
                        <button
                          type="button"
                          className="icon-button text-danger"
                          onClick={() => onUnassignUser(u.userId)}
                          title="Retirar asignación de esta sede"
                          aria-label={`Desvincular a ${u.userName}`}
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Assign User Modal */}
      {isModalOpen && mounted && createPortal(
        <div
          className="drawer-backdrop modal-center"
          onClick={() => setIsModalOpen(false)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="deactivate-dialog-card page-enter"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="dialog-header-standard">
              <div className="dialog-header-title">
                <div className="stat-icon blue">
                  <UserPlus size={20} />
                </div>
                <div>
                  <p className="eyebrow">Seguridad y gobierno de accesos</p>
                  <h3>Asignar usuario a {warehouse.name}</h3>
                </div>
              </div>
              <button
                type="button"
                className="icon-button"
                onClick={() => setIsModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAssign} style={{ marginTop: 16 }}>
              <div className="input-field-block">
                <label>Nombre del colaborador *</label>
                <div className="input-wrap">
                  <input
                    type="text"
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    placeholder="Ej. Andrés Morales"
                    required
                  />
                </div>
              </div>

              <div className="input-field-block">
                <label>Correo electrónico corporativo *</label>
                <div className="input-wrap">
                  <input
                    type="email"
                    value={userEmail}
                    onChange={(e) => setUserEmail(e.target.value)}
                    placeholder="andres.morales@supermas.com.co"
                    required
                  />
                </div>
              </div>

              <div className="input-field-block">
                <label>Rol asignado en esta sede *</label>
                <CustomSelect
                  value={userRole}
                  onChange={(val) =>
                    setUserRole(val as WarehouseUserAssignment['userRole'])
                  }
                  options={[
                    {
                      value: 'STORE_ADMIN',
                      label: 'Administrador de Bodega',
                      description: 'Control total de stock, ajustes y despachos',
                    },
                    {
                      value: 'POINT_ADMIN',
                      label: 'Administrador de Punto de Venta',
                      description: 'Control de caja, ventas y recepción',
                    },
                    {
                      value: 'INVENTORY_CLERK',
                      label: 'Auxiliar de Inventario (Kardex)',
                      description: 'Conteo físico y registro de movimientos',
                    },
                    {
                      value: 'SELLER',
                      label: 'Vendedor / Cajero',
                      description: 'Facturación POS y consulta de inventario',
                    },
                  ]}
                />
              </div>

              <div className="dialog-footer">
                <button
                  type="button"
                  className="outline-button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSubmitting}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="primary-button"
                  disabled={isSubmitting}
                >
                  <UserCheck size={16} />
                  <span>{isSubmitting ? 'Asignando...' : 'Asignar a bodega'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
