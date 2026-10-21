'use client'

import React, { useState, useEffect } from 'react'
import { AppIcon } from '@/components/ui/Icon'
import { User, UserRole, UserStatus } from '../types'
import { CreateUserInput, UpdateUserInput } from '../schemas/user.schema'
import { SYSTEM_ROLES, DEFINITIVE_ROLES } from '../services/role-permissions'
import { userService } from '../services/user.service'
import { evaluatePasswordStrength, newPasswordSchema } from '@/features/auth/schemas/password-policy.schema'
import { PasswordStrengthMeter } from '@/features/auth/components/PasswordStrengthMeter'

interface UserFormDrawerProps {
  isOpen: boolean
  onClose: () => void
  onSave: (data: CreateUserInput | UpdateUserInput) => Promise<void>
  initialData: User | null
  locations: Array<{ id: string; code: string; name: string; type: string }>
}

export function UserFormDrawer({
  isOpen,
  onClose,
  onSave,
  initialData,
  locations,
}: UserFormDrawerProps) {
  const isEditing = Boolean(initialData)

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [phone, setPhone] = useState('')
  const [role, setRole] = useState<UserRole>('VENDEDORES')
  const [selectedLocations, setSelectedLocations] = useState<string[]>([])
  const [assignedCashRegisterId, setAssignedCashRegisterId] = useState<string>('')
  const [status, setStatus] = useState<UserStatus>('ACTIVE')
  const [password, setPassword] = useState('')
  const trimmedPassword = password.trim()

  const [cashRegisters, setCashRegisters] = useState<Array<{ id: string; code: string; name: string; locationId: string; status: string }>>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Cargar cajas registradoras del sistema
  useEffect(() => {
    if (isOpen) {
      userService
        .getCashRegisters()
        .then((regs) => {
          setCashRegisters(regs)
        })
        .catch((err) => {
          console.error('Error al cargar cajas registradoras:', err)
        })
    }
  }, [isOpen])

  useEffect(() => {
    if (initialData) {
      setFirstName(initialData.firstName || '')
      setLastName(initialData.lastName || '')
      setEmail(initialData.email || '')
      setUsername(initialData.username || '')
      setPhone(initialData.phone || '')
      setRole(initialData.role)
      setSelectedLocations(initialData.locationIds || [])
      setAssignedCashRegisterId(initialData.assignedCashRegisterId || '')
      setStatus(initialData.status)
      setPassword('')
    } else {
      setFirstName('')
      setLastName('')
      setEmail('')
      setUsername('')
      setPhone('')
      setRole('VENDEDORES')
      setSelectedLocations(locations.length > 0 ? [locations[0].id] : [])
      setAssignedCashRegisterId('')
      setStatus('ACTIVE')
      setPassword('')
    }
    setErrorMessage(null)
  }, [initialData, isOpen, locations])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const handleToggleLocation = (locId: string) => {
    if (selectedLocations.includes(locId)) {
      if (selectedLocations.length === 1) return // Requiere al menos una ubicación
      setSelectedLocations((prev) => prev.filter((id) => id !== locId))
    } else {
      setSelectedLocations((prev) => [...prev, locId])
    }
  }

  // Filtrar cajas registradoras para la sede actualmente seleccionada
  const activeLocationId = selectedLocations[0] || ''
  const availableRegistersForLocation = cashRegisters.filter(
    (cr) => cr.locationId === activeLocationId
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)

    if (!firstName.trim() || !lastName.trim()) {
      setErrorMessage('El nombre y apellido son obligatorios.')
      return
    }

    if (!isEditing && trimmedPassword) {
      const passwordCheck = newPasswordSchema.safeParse(trimmedPassword)
      if (!passwordCheck.success) {
        setErrorMessage(passwordCheck.error.issues[0]?.message || 'La contraseña no cumple la política de seguridad.')
        return
      }
    }

    if (!email.trim() || !email.includes('@')) {
      setErrorMessage('Ingresa un correo electrónico corporativo válido.')
      return
    }

    if (!username.trim() || username.length < 3) {
      setErrorMessage('El nombre de usuario debe tener al menos 3 caracteres.')
      return
    }

    if (selectedLocations.length === 0) {
      setErrorMessage('Debes asignar al menos una sede o bodega al colaborador.')
      return
    }

    // Validación de Encargada de Venta: Caja Asignada obligatoria
    if (role === 'ENCARGADA_VENTA') {
      if (!assignedCashRegisterId) {
        setErrorMessage('Debes seleccionar una caja registradora asignada para la Encargada de Venta.')
        return
      }
      // Verificar consistencia: la caja debe pertenecer a la sede asignada
      const matchingReg = cashRegisters.find((cr) => cr.id === assignedCashRegisterId)
      if (matchingReg && !selectedLocations.includes(matchingReg.locationId)) {
        setErrorMessage(`La caja seleccionada (${matchingReg.name}) no pertenece al punto de venta asignado.`)
        return
      }
    }

    // Validación de Jefe de Bodega: Bodega Asignada obligatoria
    if (role === 'JEFE_BODEGA') {
      if (selectedLocations.length !== 1) {
        setErrorMessage('El Jefe de Bodega debe tener exactamente una bodega asignada como base de operación.')
        return
      }
    }

    try {
      setIsSubmitting(true)
      const payload: CreateUserInput = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim().toLowerCase(),
        username: username.trim().toLowerCase(),
        phone: phone.trim() || '',
        role,
        locationIds: selectedLocations,
        assignedCashRegisterId: role === 'ENCARGADA_VENTA' ? assignedCashRegisterId : undefined,
        status,
        password: trimmedPassword || undefined,
      }

      await onSave(payload)
    } catch (err: any) {
      setErrorMessage(err.message || 'Ocurrió un error al guardar el colaborador.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const roleDef = SYSTEM_ROLES[role]
  const warehouseLocations = locations.filter((l) => l.type === 'WAREHOUSE')
  const availableWarehouses = warehouseLocations.length > 0 ? warehouseLocations : locations

  return (
    <div
      className="drawer-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="user-drawer-title"
    >
      <div
        className="product-drawer"
        style={{
          width: 'min(100%, 640px)',
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
        {/* Encabezado */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingBottom: 16,
            borderBottom: '1px solid var(--line, #e2e8f0)',
            marginBottom: 20,
          }}
        >
          <div>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: 'var(--brand-blue, #1e3a8a)',
              }}
            >
              Directorio de Colaboradores
            </span>
            <h2 id="user-drawer-title" style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', margin: '2px 0 0' }}>
              {isEditing ? `Editar: ${initialData?.name}` : 'Registrar Nuevo Usuario'}
            </h2>
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label="Cerrar formulario"
          >
            <AppIcon name="close" size={18} />
          </button>
        </div>

        {/* Mensaje de error si falla validación */}
        {errorMessage && (
          <div
            style={{
              padding: '12px 16px',
              borderRadius: 8,
              backgroundColor: '#fee2e2',
              border: '1px solid #fecaca',
              color: '#991b1b',
              fontSize: 13,
              marginBottom: 16,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <AppIcon name="warning" size={16} />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* Nombre y Apellido */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>
                Nombres *
              </label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Ej. Carlos Eduardo"
                required
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: 6,
                  border: '1px solid var(--line, #cbd5e1)',
                  fontSize: 14,
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>
                Apellidos *
              </label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Ej. Gómez Restrepo"
                required
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: 6,
                  border: '1px solid var(--line, #cbd5e1)',
                  fontSize: 14,
                }}
              />
            </div>
          </div>

          {/* Email y Usuario */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>
                Correo Electrónico *
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="carlos.gomez@supermas.com.co"
                required
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: 6,
                  border: '1px solid var(--line, #cbd5e1)',
                  fontSize: 14,
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>
                Nombre de Usuario (@) *
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="cgomez"
                required
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: 6,
                  border: '1px solid var(--line, #cbd5e1)',
                  fontSize: 14,
                }}
              />
            </div>
          </div>

          {/* Teléfono y Estado */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>
                Teléfono / Celular
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+57 310 555 1234"
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: 6,
                  border: '1px solid var(--line, #cbd5e1)',
                  fontSize: 14,
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>
                Estado Operativo *
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as UserStatus)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: 6,
                  border: '1px solid var(--line, #cbd5e1)',
                  fontSize: 14,
                  background: 'var(--surface, #ffffff)',
                }}
              >
                <option value="ACTIVE">Activo (Habilitado para operar)</option>
                <option value="INACTIVE">Inactivo (Acceso bloqueado)</option>
              </select>
            </div>
          </div>

          {/* Contraseña Inicial (Solo al registrar nuevo usuario) */}
          {!isEditing && (
            <div>
              <label
                htmlFor="user-initial-password"
                style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}
              >
                Contraseña Inicial (Opcional)
              </label>
              <input
                id="user-initial-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Déjela en blanco para generar una segura"
                autoComplete="new-password"
                aria-describedby="user-initial-password-help"
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: 6,
                  border: '1px solid var(--line, #cbd5e1)',
                  fontSize: 14,
                }}
              />
              <span id="user-initial-password-help" style={{ fontSize: 11, color: '#64748b', marginTop: 4, display: 'block', lineHeight: 1.5 }}>
                Si se deja en blanco, el sistema generará una contraseña temporal aleatoria y se la mostrará una sola vez al guardar.
              </span>
              {trimmedPassword && (
                <div style={{ marginTop: 8 }}>
                  <PasswordStrengthMeter id="user-initial-password-strength" strength={evaluatePasswordStrength(trimmedPassword)} />
                </div>
              )}
              <span
                style={{
                  marginTop: 8,
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 6,
                  padding: '8px 10px',
                  borderRadius: 6,
                  background: '#eff6ff',
                  border: '1px solid #bfdbfe',
                  color: '#1e3a8a',
                  fontSize: 12,
                  lineHeight: 1.5,
                }}
              >
                <AppIcon name="shield" size={15} aria-hidden="true" style={{ flexShrink: 0, marginTop: 1 }} />
                Por seguridad, el colaborador deberá cambiar esta contraseña por una personal en su primer ingreso.
              </span>
            </div>
          )}

          {/* Selección de Rol Predefinido */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                Rol del Colaborador (7 Roles Oficiales) *
              </label>
              <span style={{ fontSize: 11, color: '#64748b' }}>Inmutable por UI</span>
            </div>
            <select
              value={role}
              onChange={(e) => {
                const newRole = e.target.value as UserRole
                setRole(newRole)
                if (newRole !== 'ENCARGADA_VENTA') {
                  setAssignedCashRegisterId('')
                }
              }}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 6,
                border: '1px solid var(--line, #cbd5e1)',
                fontSize: 14,
                background: 'var(--surface, #ffffff)',
                fontWeight: 600,
              }}
            >
              <optgroup label="7 Roles Definitivos del ERP">
                {DEFINITIVE_ROLES.map((roleCode) => {
                  const r = SYSTEM_ROLES[roleCode]
                  return (
                    <option key={roleCode} value={roleCode}>
                      {r?.name || roleCode}
                    </option>
                  )
                })}
              </optgroup>
              {/* Opciones legacy si el usuario actual fue creado con rol legacy */}
              {Object.keys(SYSTEM_ROLES).some((k) => !DEFINITIVE_ROLES.includes(k as UserRole)) && (
                <optgroup label="Roles Legacy (Compatibilidad)">
                  {Object.keys(SYSTEM_ROLES)
                    .filter((k) => !DEFINITIVE_ROLES.includes(k as UserRole))
                    .map((legacyCode) => {
                      const r = SYSTEM_ROLES[legacyCode as UserRole]
                      return (
                        <option key={legacyCode} value={legacyCode}>
                          {r?.name || legacyCode} ({legacyCode})
                        </option>
                      )
                    })}
                </optgroup>
              )}
            </select>

            {/* Explicación del rol seleccionado */}
            {roleDef && (
              <div
                style={{
                  marginTop: 8,
                  padding: '10px 14px',
                  borderRadius: 6,
                  backgroundColor: roleDef.badgeBg,
                  border: `1px solid ${roleDef.badgeColor}30`,
                  fontSize: 12,
                  color: roleDef.badgeColor,
                }}
              >
                <div style={{ fontWeight: 600, marginBottom: 2 }}>{roleDef.name}</div>
                <div>{roleDef.description}</div>
                <div style={{ marginTop: 6, fontWeight: 600, fontSize: 11 }}>
                  Alcance: {roleDef.scope === 'ALL_LOCATIONS' ? 'Acceso Global a todas las sedes' : 'Acceso restringido a sede o caja asignada'}
                </div>
              </div>
            )}
          </div>

          {/* CASO ESPECIAL: ENCARGADA DE VENTA (Punto de Venta Asignado + Caja Asignada) */}
          {role === 'ENCARGADA_VENTA' && (
            <div
              style={{
                padding: '14px',
                borderRadius: 8,
                backgroundColor: '#f5f3ff',
                border: '1px solid #ddd6fe',
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#6d28d9', fontWeight: 700, fontSize: 13 }}>
                <AppIcon name="cashRegisters" size={16} />
                <span>Configuración de Punto de Venta y Caja (Encargada de Venta)</span>
              </div>

              {/* Punto de Venta Asignado */}
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>
                  Punto de Venta Asignado *
                </label>
                <select
                  value={selectedLocations[0] || ''}
                  onChange={(e) => {
                    setSelectedLocations([e.target.value])
                    setAssignedCashRegisterId('')
                  }}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 6,
                    border: '1px solid #c4b5fd',
                    fontSize: 13,
                    background: '#ffffff',
                  }}
                >
                  {locations.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name} ({loc.code} - {loc.type})
                    </option>
                  ))}
                </select>
              </div>

              {/* Caja Asignada */}
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>
                  Caja Registradora Asignada *
                </label>
                <select
                  value={assignedCashRegisterId}
                  onChange={(e) => setAssignedCashRegisterId(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 6,
                    border: '1px solid #c4b5fd',
                    fontSize: 13,
                    background: '#ffffff',
                  }}
                >
                  <option value="">-- Seleccionar Caja Registradora --</option>
                  {availableRegistersForLocation.map((cr) => (
                    <option key={cr.id} value={cr.id}>
                      {cr.name} ({cr.code}) — Estado: {cr.status === 'OPEN' ? 'ABIERTA' : 'CERRADA'}
                    </option>
                  ))}
                </select>
                {availableRegistersForLocation.length === 0 && (
                  <span style={{ fontSize: 11, color: '#dc2626', marginTop: 4, display: 'block' }}>
                    No hay cajas registradoras creadas en esta sede. Crea una caja en el módulo POS antes de asignar.
                  </span>
                )}
              </div>

              <span style={{ fontSize: 11, color: '#6d28d9' }}>
                Restricción: La encargada solo podrá abrir sesión y operar cobros en la caja asignada a su punto.
              </span>
            </div>
          )}

          {/* CASO ESPECIAL: JEFE DE BODEGA (Bodega Asignada Obligatoria) */}
          {role === 'JEFE_BODEGA' && (
            <div
              style={{
                padding: '14px',
                borderRadius: 8,
                backgroundColor: '#f0fdf4',
                border: '1px solid #bbf7d0',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#15803d', fontWeight: 700, fontSize: 13 }}>
                <AppIcon name="warehouse" size={16} />
                <span>Asignación Exclusiva de Bodega (Jefe de Bodega)</span>
              </div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>
                Bodega Asignada *
              </label>
              <select
                value={selectedLocations[0] || ''}
                onChange={(e) => setSelectedLocations([e.target.value])}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: 6,
                  border: '1px solid #86efac',
                  fontSize: 13,
                  background: '#ffffff',
                }}
              >
                {availableWarehouses.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name} ({loc.code} - {loc.type})
                  </option>
                ))}
              </select>
              <span style={{ fontSize: 11, color: '#166534' }}>
                Restricción: El Jefe de Bodega solo podrá consultar existencias, despachar y recibir transferencias en la bodega asignada.
              </span>
            </div>
          )}

          {/* Asignación estándar de Bodegas / Sedes (Para roles generales) */}
          {role !== 'ENCARGADA_VENTA' && role !== 'JEFE_BODEGA' && (
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>
                Sedes / Puntos de Venta Asignados *
              </label>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  padding: '12px',
                  border: '1px solid var(--line, #cbd5e1)',
                  borderRadius: 6,
                  maxHeight: 180,
                  overflowY: 'auto',
                  background: '#f8fafc',
                }}
              >
                {locations.map((loc) => {
                  const isSelected = selectedLocations.includes(loc.id)
                  return (
                    <label
                      key={loc.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        cursor: 'pointer',
                        fontSize: 13,
                        padding: '6px 8px',
                        borderRadius: 4,
                        backgroundColor: isSelected ? '#ffffff' : 'transparent',
                        border: isSelected ? '1px solid #bfdbfe' : '1px solid transparent',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleLocation(loc.id)}
                      />
                      <div>
                        <strong style={{ color: 'var(--text)' }}>{loc.name}</strong>{' '}
                        <span style={{ color: '#64748b', fontSize: 11 }}>({loc.code} - {loc.type})</span>
                      </div>
                    </label>
                  )
                })}
              </div>
              <span style={{ fontSize: 11, color: '#64748b', marginTop: 4, display: 'block' }}>
                Puedes asignar múltiples sedes si el rol lo requiere. La primera sede actúa como base operativa principal.
              </span>
            </div>
          )}

          {/* Aviso de Seguridad de Contraseña */}
          <div
            style={{
              padding: '12px 14px',
              backgroundColor: '#eff6ff',
              borderRadius: 6,
              border: '1px solid #bfdbfe',
              fontSize: 12,
              color: '#1e40af',
              display: 'flex',
              gap: 10,
              alignItems: 'flex-start',
            }}
          >
            <AppIcon name="lock" size={16} />
            <div>
              <strong>Seguridad y Autenticación:</strong> Las contraseñas nunca se almacenan en tablas administrativas.
              Al crear un nuevo usuario, se enviará una invitación segura o podrá acceder con la clave inicial configurada.
            </div>
          </div>

          {/* Acciones del formulario */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 10,
              paddingTop: 16,
              borderTop: '1px solid var(--line, #e2e8f0)',
              marginTop: 10,
            }}
          >
            <button
              type="button"
              className="outline-button"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="primary-button"
              disabled={isSubmitting}
            >
              <AppIcon name={isEditing ? 'edit' : 'plus'} size={16} />
              <span>{isSubmitting ? 'Guardando...' : isEditing ? 'Guardar Cambios' : 'Registrar Colaborador'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
