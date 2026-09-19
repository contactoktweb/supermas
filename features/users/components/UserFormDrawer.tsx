'use client'

import React, { useState, useEffect } from 'react'
import { AppIcon } from '@/components/ui/Icon'
import { User, UserRole, UserStatus } from '../types'
import { CreateUserInput, UpdateUserInput } from '../schemas/user.schema'
import { SYSTEM_ROLES } from '../services/role-permissions'

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
  const [role, setRole] = useState<UserRole>('SELLER')
  const [selectedLocations, setSelectedLocations] = useState<string[]>([])
  const [status, setStatus] = useState<UserStatus>('ACTIVE')

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    if (initialData) {
      setFirstName(initialData.firstName || '')
      setLastName(initialData.lastName || '')
      setEmail(initialData.email || '')
      setUsername(initialData.username || '')
      setPhone(initialData.phone || '')
      setRole(initialData.role)
      setSelectedLocations(initialData.locationIds || [])
      setStatus(initialData.status)
    } else {
      setFirstName('')
      setLastName('')
      setEmail('')
      setUsername('')
      setPhone('')
      setRole('SELLER')
      setSelectedLocations(locations.length > 0 ? [locations[0].id] : [])
      setStatus('ACTIVE')
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)

    if (!firstName.trim() || !lastName.trim()) {
      setErrorMessage('El nombre y apellido son obligatorios.')
      return
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
        status,
      }

      await onSave(payload)
    } catch (err: any) {
      setErrorMessage(err.message || 'Ocurrió un error al guardar el colaborador.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const roleDef = SYSTEM_ROLES[role]

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
          width: 'min(100%, 620px)',
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

          {/* Selección de Rol Predefinido */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                Rol Predefinido del Sistema *
              </label>
              <span style={{ fontSize: 11, color: '#64748b' }}>Inmutable por UI</span>
            </div>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
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
              {Object.values(SYSTEM_ROLES).map((r) => (
                <option key={r.code} value={r.code}>
                  {r.name} ({r.code})
                </option>
              ))}
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
                  Alcance: {roleDef.scope === 'ALL_LOCATIONS' ? 'Acceso Global a todas las sedes' : 'Acceso restringido a sede(s) asignada(s)'}
                </div>
              </div>
            )}
          </div>

          {/* Asignación de Bodegas / Sedes */}
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
              <strong>Seguridad y Autenticación:</strong> Las contraseñas de acceso nunca se almacenan en las tablas administrativas.
              Al crear un nuevo usuario, se enviará una invitación segura a su correo electrónico a través de Supabase Auth para configurar sus credenciales.
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
