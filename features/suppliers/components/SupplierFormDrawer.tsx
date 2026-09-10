'use client'

import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { AppIcon } from '@/components/ui/Icon'
import { CustomSelect } from '@/components/ui/CustomSelect'
import {
  Supplier,
  CreateSupplierInput,
  UpdateSupplierInput,
  DocumentType,
  SupplierStatus,
} from '../types'
import { createSupplierSchema, updateSupplierSchema } from '../schemas/supplier.schema'

interface SupplierFormDrawerProps {
  isOpen: boolean
  mode: 'create' | 'edit'
  supplier?: Supplier | null
  onClose: () => void
  onSubmit: (input: CreateSupplierInput | UpdateSupplierInput) => Promise<void>
}

const DOCUMENT_TYPE_OPTIONS: { value: DocumentType; label: string }[] = [
  { value: 'NIT', label: 'NIT - Número de Identificación Tributaria' },
  { value: 'CC', label: 'Cédula de Ciudadanía' },
  { value: 'CE', label: 'Cédula de Extranjería' },
  { value: 'RUT', label: 'RUT - Registro Único Tributario' },
  { value: 'PASAPORTE', label: 'Pasaporte Extranjero' },
]

const STATUS_OPTIONS: { value: SupplierStatus; label: string }[] = [
  { value: 'ACTIVE', label: 'Activo (Habilitado para compras)' },
  { value: 'INACTIVE', label: 'Inactivo (Suspendido temporalmente)' },
]

export function SupplierFormDrawer({
  isOpen,
  mode,
  supplier,
  onClose,
  onSubmit,
}: SupplierFormDrawerProps) {
  const [mounted, setMounted] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [activeTab, setActiveTab] = useState<'general' | 'commercial'>('general')
  const [error, setError] = useState<string | null>(null)

  // Form Fields - Información General
  const [documentType, setDocumentType] = useState<DocumentType>('NIT')
  const [documentNumber, setDocumentNumber] = useState('')
  const [businessName, setBusinessName] = useState('')
  const [commercialName, setCommercialName] = useState('')
  const [contactName, setContactName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [address, setAddress] = useState('')
  const [city, setCity] = useState('')
  const [department, setDepartment] = useState('')
  const [country, setCountry] = useState('Colombia')

  // Form Fields - Información Comercial
  const [status, setStatus] = useState<SupplierStatus>('ACTIVE')
  const [creditDays, setCreditDays] = useState<number>(30)
  const [creditLimit, setCreditLimit] = useState<number>(10000000)
  const [notes, setNotes] = useState('')

  useEffect(() => {
    setMounted(true)
  }, [])

  // Populate data when editing or opening
  useEffect(() => {
    if (mode === 'edit' && supplier) {
      setDocumentType(supplier.documentType || 'NIT')
      setDocumentNumber(supplier.documentNumber || supplier.nit || '')
      setBusinessName(supplier.businessName || supplier.supplierName || '')
      setCommercialName(supplier.commercialName || '')
      setContactName(supplier.contactName || '')
      setPhone(supplier.phone || '')
      setEmail(supplier.email || '')
      setAddress(supplier.address || '')
      setCity(supplier.city || '')
      setDepartment(supplier.department || '')
      setCountry(supplier.country || 'Colombia')
      setStatus(supplier.status || 'ACTIVE')
      setCreditDays(supplier.creditDays || 0)
      setCreditLimit(supplier.creditLimit || 0)
      setNotes(supplier.notes || '')
      setError(null)
    } else if (mode === 'create') {
      setDocumentType('NIT')
      setDocumentNumber('')
      setBusinessName('')
      setCommercialName('')
      setContactName('')
      setPhone('')
      setEmail('')
      setAddress('')
      setCity('Medellín')
      setDepartment('Antioquia')
      setCountry('Colombia')
      setStatus('ACTIVE')
      setCreditDays(30)
      setCreditLimit(20000000)
      setNotes('')
      setError(null)
    }
    setActiveTab('general')
  }, [mode, supplier, isOpen])

  if (!isOpen || !mounted) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const formData = {
      documentType,
      documentNumber: documentNumber.trim(),
      businessName: businessName.trim(),
      commercialName: commercialName.trim() || undefined,
      contactName: contactName.trim(),
      phone: phone.trim(),
      email: email.trim().toLowerCase(),
      address: address.trim(),
      city: city.trim(),
      department: department.trim(),
      country: country.trim() || 'Colombia',
      status,
      creditDays: Number(creditDays) || 0,
      creditLimit: Number(creditLimit) || 0,
      notes: notes.trim() || undefined,
    }

    try {
      // Validate schema on client before dispatching to server service
      if (mode === 'create') {
        createSupplierSchema.parse(formData)
        setIsSubmitting(true)
        await onSubmit(formData)
      } else {
        if (!supplier) throw new Error('No se ha especificado el proveedor a editar')
        const editData = { ...formData, id: supplier.id }
        updateSupplierSchema.parse(editData)
        setIsSubmitting(true)
        await onSubmit(editData)
      }
      onClose()
    } catch (err: any) {
      if (err.errors && err.errors[0]) {
        setError(err.errors[0].message)
      } else {
        setError(err.message || 'Error al guardar los datos del proveedor.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return createPortal(
    <div
      className="drawer-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="supplier-form-title"
    >
      <div
        className="product-drawer product-detail-drawer page-enter"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 680, width: '92vw' }}
      >
        {/* Header */}
        <div className="drawer-header" style={{ padding: '18px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              className="stat-icon blue"
              style={{ width: 42, height: 42, borderRadius: 12 }}
            >
              <AppIcon name="suppliers" size={22} />
            </div>
            <div>
              <span className="product-category-eyebrow">
                Gestión de Proveedores
              </span>
              <h2
                id="supplier-form-title"
                style={{
                  margin: 0,
                  fontSize: 18,
                  fontWeight: 800,
                  color: 'var(--navy)',
                }}
              >
                {mode === 'create'
                  ? 'Registrar Nuevo Proveedor'
                  : `Editar Proveedor • ${supplier?.businessName || supplier?.supplierName}`}
              </h2>
            </div>
          </div>
          <button
            type="button"
            className="drawer-close-btn"
            onClick={onClose}
            aria-label="Cerrar formulario"
          >
            <AppIcon name="close" size={18} />
          </button>
        </div>

        {/* Tab Selector */}
        <div
          style={{
            display: 'flex',
            borderBottom: '1px solid var(--border)',
            background: 'var(--bg-subtle, #f8fafc)',
            padding: '0 24px',
          }}
        >
          <button
            type="button"
            className={`period-tab-btn ${activeTab === 'general' ? 'selected' : ''}`}
            onClick={() => setActiveTab('general')}
            style={{
              padding: '12px 16px',
              borderBottom:
                activeTab === 'general'
                  ? '2px solid var(--navy)'
                  : '2px solid transparent',
              borderRadius: 0,
            }}
          >
            <AppIcon name="suppliers" size={14} />
            <span>1. Información General</span>
          </button>

          <button
            type="button"
            className={`period-tab-btn ${activeTab === 'commercial' ? 'selected' : ''}`}
            onClick={() => setActiveTab('commercial')}
            style={{
              padding: '12px 16px',
              borderBottom:
                activeTab === 'commercial'
                  ? '2px solid var(--navy)'
                  : '2px solid transparent',
              borderRadius: 0,
            }}
          >
            <AppIcon name="wallet" size={14} />
            <span>2. Información Comercial & Crédito</span>
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
          <div
            className="drawer-body"
            style={{ padding: 24, overflowY: 'auto', flex: 1 }}
          >
            {error && (
              <div
                className="incident-alert-banner page-enter"
                style={{
                  background: '#fef2f2',
                  borderColor: '#fca5a5',
                  padding: '10px 14px',
                  borderRadius: 8,
                  marginBottom: 16,
                  color: '#dc2626',
                  fontSize: 12,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <AppIcon name="warning" size={16} />
                <span>{error}</span>
              </div>
            )}

            {/* TAB 1: INFORMACIÓN GENERAL */}
            {activeTab === 'general' && (
              <div className="page-enter">
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1.2fr',
                    gap: 16,
                    marginBottom: 16,
                  }}
                >
                  {/* Tipo Documento */}
                  <div>
                    <label
                      style={{
                        display: 'block',
                        fontSize: 12,
                        fontWeight: 700,
                        marginBottom: 6,
                      }}
                    >
                      Tipo de documento <span style={{ color: '#dc2626' }}>*</span>
                    </label>
                    <CustomSelect
                      value={documentType}
                      onChange={(val) => setDocumentType(val as DocumentType)}
                      options={DOCUMENT_TYPE_OPTIONS}
                    />
                  </div>

                  {/* Número de Documento / NIT */}
                  <div>
                    <label
                      style={{
                        display: 'block',
                        fontSize: 12,
                        fontWeight: 700,
                        marginBottom: 6,
                      }}
                    >
                      Número de Documento / NIT <span style={{ color: '#dc2626' }}>*</span>
                    </label>
                    <input
                      type="text"
                      className="filter-date-input"
                      style={{ width: '100%' }}
                      placeholder="Ej. 900.421.882-1"
                      value={documentNumber}
                      onChange={(e) => setDocumentNumber(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: 16,
                    marginBottom: 16,
                  }}
                >
                  {/* Razón Social */}
                  <div>
                    <label
                      style={{
                        display: 'block',
                        fontSize: 12,
                        fontWeight: 700,
                        marginBottom: 6,
                      }}
                    >
                      Razón social <span style={{ color: '#dc2626' }}>*</span>
                    </label>
                    <input
                      type="text"
                      className="filter-date-input"
                      style={{ width: '100%' }}
                      placeholder="Ej. Distribuciones La 14 S.A.S."
                      value={businessName}
                      onChange={(e) => setBusinessName(e.target.value)}
                      required
                    />
                  </div>

                  {/* Nombre Comercial */}
                  <div>
                    <label
                      style={{
                        display: 'block',
                        fontSize: 12,
                        fontWeight: 700,
                        marginBottom: 6,
                      }}
                    >
                      Nombre comercial (Opcional)
                    </label>
                    <input
                      type="text"
                      className="filter-date-input"
                      style={{ width: '100%' }}
                      placeholder="Ej. La 14 Mayorista"
                      value={commercialName}
                      onChange={(e) => setCommercialName(e.target.value)}
                    />
                  </div>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: 16,
                    marginBottom: 16,
                  }}
                >
                  {/* Contacto Principal */}
                  <div>
                    <label
                      style={{
                        display: 'block',
                        fontSize: 12,
                        fontWeight: 700,
                        marginBottom: 6,
                      }}
                    >
                      Contacto principal <span style={{ color: '#dc2626' }}>*</span>
                    </label>
                    <input
                      type="text"
                      className="filter-date-input"
                      style={{ width: '100%' }}
                      placeholder="Ej. Andrés Pérez"
                      value={contactName}
                      onChange={(e) => setContactName(e.target.value)}
                      required
                    />
                  </div>

                  {/* Teléfono */}
                  <div>
                    <label
                      style={{
                        display: 'block',
                        fontSize: 12,
                        fontWeight: 700,
                        marginBottom: 6,
                      }}
                    >
                      Teléfono de contacto <span style={{ color: '#dc2626' }}>*</span>
                    </label>
                    <input
                      type="text"
                      className="filter-date-input"
                      style={{ width: '100%' }}
                      placeholder="Ej. +57 310 445 8821"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1.2fr 1fr',
                    gap: 16,
                    marginBottom: 16,
                  }}
                >
                  {/* Email */}
                  <div>
                    <label
                      style={{
                        display: 'block',
                        fontSize: 12,
                        fontWeight: 700,
                        marginBottom: 6,
                      }}
                    >
                      Correo electrónico <span style={{ color: '#dc2626' }}>*</span>
                    </label>
                    <input
                      type="email"
                      className="filter-date-input"
                      style={{ width: '100%' }}
                      placeholder="ventas@proveedor.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>

                  {/* Dirección */}
                  <div>
                    <label
                      style={{
                        display: 'block',
                        fontSize: 12,
                        fontWeight: 700,
                        marginBottom: 6,
                      }}
                    >
                      Dirección comercial <span style={{ color: '#dc2626' }}>*</span>
                    </label>
                    <input
                      type="text"
                      className="filter-date-input"
                      style={{ width: '100%' }}
                      placeholder="Calle 14 # 85-30"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr 1fr',
                    gap: 16,
                    marginBottom: 16,
                  }}
                >
                  {/* Ciudad */}
                  <div>
                    <label
                      style={{
                        display: 'block',
                        fontSize: 12,
                        fontWeight: 700,
                        marginBottom: 6,
                      }}
                    >
                      Ciudad <span style={{ color: '#dc2626' }}>*</span>
                    </label>
                    <input
                      type="text"
                      className="filter-date-input"
                      style={{ width: '100%' }}
                      placeholder="Ej. Cali"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      required
                    />
                  </div>

                  {/* Departamento */}
                  <div>
                    <label
                      style={{
                        display: 'block',
                        fontSize: 12,
                        fontWeight: 700,
                        marginBottom: 6,
                      }}
                    >
                      Departamento <span style={{ color: '#dc2626' }}>*</span>
                    </label>
                    <input
                      type="text"
                      className="filter-date-input"
                      style={{ width: '100%' }}
                      placeholder="Ej. Valle del Cauca"
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      required
                    />
                  </div>

                  {/* País */}
                  <div>
                    <label
                      style={{
                        display: 'block',
                        fontSize: 12,
                        fontWeight: 700,
                        marginBottom: 6,
                      }}
                    >
                      País
                    </label>
                    <input
                      type="text"
                      className="filter-date-input"
                      style={{ width: '100%' }}
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: INFORMACIÓN COMERCIAL & CRÉDITO */}
            {activeTab === 'commercial' && (
              <div className="page-enter">
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: 16,
                    marginBottom: 16,
                  }}
                >
                  {/* Estado */}
                  <div>
                    <label
                      style={{
                        display: 'block',
                        fontSize: 12,
                        fontWeight: 700,
                        marginBottom: 6,
                      }}
                    >
                      Estado operativo <span style={{ color: '#dc2626' }}>*</span>
                    </label>
                    <CustomSelect
                      value={status}
                      onChange={(val) => setStatus(val as SupplierStatus)}
                      options={STATUS_OPTIONS}
                    />
                  </div>

                  {/* Días de Crédito */}
                  <div>
                    <label
                      style={{
                        display: 'block',
                        fontSize: 12,
                        fontWeight: 700,
                        marginBottom: 6,
                      }}
                    >
                      Días de crédito concedidos <span style={{ color: '#dc2626' }}>*</span>
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="180"
                      className="filter-date-input"
                      style={{ width: '100%' }}
                      placeholder="0 = Contado"
                      value={creditDays}
                      onChange={(e) => setCreditDays(Number(e.target.value) || 0)}
                      required
                    />
                    <span style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4, display: 'block' }}>
                      {creditDays === 0
                        ? 'Compra de contado inmediato'
                        : `Plazo de pago a ${creditDays} días calendario`}
                    </span>
                  </div>
                </div>

                {/* Cupo de Crédito */}
                <div style={{ marginBottom: 16 }}>
                  <label
                    style={{
                      display: 'block',
                      fontSize: 12,
                      fontWeight: 700,
                      marginBottom: 6,
                    }}
                  >
                    Cupo de crédito autorizado ($COP)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="100000"
                    className="filter-date-input"
                    style={{ width: '100%', fontSize: 14, fontWeight: 700 }}
                    value={creditLimit}
                    onChange={(e) => setCreditLimit(Number(e.target.value) || 0)}
                  />
                  <span style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4, display: 'block' }}>
                    Límite máximo de obligaciones abiertas permitidas con este proveedor.
                  </span>
                </div>

                {/* Observaciones */}
                <div style={{ marginBottom: 16 }}>
                  <label
                    style={{
                      display: 'block',
                      fontSize: 12,
                      fontWeight: 700,
                      marginBottom: 6,
                    }}
                  >
                    Observaciones comerciales y acuerdos de flete
                  </label>
                  <textarea
                    className="filter-date-input"
                    style={{
                      width: '100%',
                      minHeight: 80,
                      resize: 'vertical',
                      fontFamily: 'inherit',
                      fontSize: 12,
                    }}
                    placeholder="Acuerdos de entrega, horarios de descargue, políticas de pronto pago..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Drawer Footer */}
          <div
            className="drawer-footer"
            style={{
              padding: '16px 24px',
              borderTop: '1px solid var(--border)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: '#fff',
            }}
          >
            <div>
              {activeTab === 'commercial' ? (
                <button
                  type="button"
                  className="outline-button"
                  onClick={() => setActiveTab('general')}
                >
                  ← Información General
                </button>
              ) : (
                <button
                  type="button"
                  className="outline-button"
                  onClick={() => setActiveTab('commercial')}
                >
                  Condiciones Comerciales →
                </button>
              )}
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
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
                <AppIcon name="save" size={14} />
                <span>
                  {isSubmitting
                    ? 'Guardando...'
                    : mode === 'create'
                    ? 'Crear Proveedor'
                    : 'Guardar Cambios'}
                </span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}
