'use client'

import React, { useState, useEffect } from 'react'
import { AppIcon } from '@/components/ui/Icon'
import { CustomSelect } from '@/components/ui/CustomSelect'
import {
  Customer,
  CustomerType,
  CustomerDocumentType,
  CustomerCategory,
  CustomerPriceList,
  CreateCustomerDTO,
  UpdateCustomerDTO,
} from '../types'

interface CustomerFormDrawerProps {
  isOpen: boolean
  customerToEdit?: Customer | null
  onClose: () => void
  onSubmit: (data: CreateCustomerDTO | UpdateCustomerDTO) => Promise<void>
  locations: { id: string; name: string; code: string }[]
}

const DOCUMENT_TYPES: { value: CustomerDocumentType; label: string; description?: string }[] = [
  { value: 'CC', label: 'CC - Cédula de Ciudadanía', description: 'Persona natural colombiana' },
  { value: 'NIT', label: 'NIT - Número de Identificación Tributaria', description: 'Empresa o persona con RUT' },
  { value: 'CE', label: 'CE - Cédula de Extranjería', description: 'Extranjero residente' },
  { value: 'PASSPORT', label: 'Pasaporte', description: 'Documento internacional' },
  { value: 'OTHER', label: 'Otro Documento', description: 'Identificación especial' },
]

const CUSTOMER_CATEGORIES: { value: CustomerCategory; label: string; description: string }[] = [
  { value: 'FREQUENT', label: 'Cliente Frecuente', description: 'Compras recurrentes de mostrador' },
  { value: 'WHOLESALE', label: 'Mayorista', description: 'Volúmenes altos con precio preferencial' },
  { value: 'COMPANY', label: 'Empresa Institucional', description: 'Contratos corporativos y catering' },
  { value: 'FINAL_CONSUMER', label: 'Consumidor Final', description: 'Venta rápida sin fidelización' },
]

const PRICE_LISTS: { value: CustomerPriceList; label: string; description: string }[] = [
  { value: 'DEFAULT', label: 'Lista Normal / Mostrador', description: 'Precios estándar de venta al público' },
  { value: 'WHOLESALE', label: 'Lista Mayorista', description: 'Precios de escala con margen ajustado' },
  { value: 'VIP', label: 'Lista VIP Especial', description: 'Tarifas preferenciales por volumen alto' },
]

export function CustomerFormDrawer({
  isOpen,
  customerToEdit,
  onClose,
  onSubmit,
  locations,
}: CustomerFormDrawerProps) {
  const isEditing = Boolean(customerToEdit)
  const [activeTab, setActiveTab] = useState<'basic' | 'contact' | 'commercial'>('basic')

  // Form States
  const [customerType, setCustomerType] = useState<CustomerType>('NATURAL')
  const [documentType, setDocumentType] = useState<CustomerDocumentType>('CC')
  const [documentNumber, setDocumentNumber] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [businessName, setBusinessName] = useState('')
  const [commercialName, setCommercialName] = useState('')
  const [contactPerson, setContactPerson] = useState('')
  const [phone, setPhone] = useState('')
  const [mobile, setMobile] = useState('')
  const [email, setEmail] = useState('')
  const [address, setAddress] = useState('')
  const [city, setCity] = useState('Cali')
  const [department, setDepartment] = useState('Valle del Cauca')
  const [country, setCountry] = useState('Colombia')
  const [category, setCategory] = useState<CustomerCategory>('FREQUENT')
  const [priceList, setPriceList] = useState<CustomerPriceList>('DEFAULT')
  const [creditLimit, setCreditLimit] = useState<number>(0)
  const [creditDays, setCreditDays] = useState<number>(0)
  const [preferredLocationId, setPreferredLocationId] = useState('loc-001')
  const [notes, setNotes] = useState('')

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (customerToEdit) {
      setCustomerType(customerToEdit.customerType || 'NATURAL')
      setDocumentType(customerToEdit.documentType || 'CC')
      setDocumentNumber(customerToEdit.documentNumber || '')
      setFirstName(customerToEdit.firstName || '')
      setLastName(customerToEdit.lastName || '')
      setBusinessName(customerToEdit.businessName || '')
      setCommercialName(customerToEdit.commercialName || '')
      setContactPerson(customerToEdit.contactPerson || '')
      setPhone(customerToEdit.phone || '')
      setMobile(customerToEdit.mobile || '')
      setEmail(customerToEdit.email || '')
      setAddress(customerToEdit.address || '')
      setCity(customerToEdit.city || 'Cali')
      setDepartment(customerToEdit.department || 'Valle del Cauca')
      setCountry(customerToEdit.country || 'Colombia')
      setCategory(customerToEdit.category || 'FREQUENT')
      setPriceList(customerToEdit.priceList || 'DEFAULT')
      setCreditLimit(customerToEdit.creditLimit || 0)
      setCreditDays(customerToEdit.creditDays || 0)
      setPreferredLocationId(customerToEdit.preferredLocationId || 'loc-001')
      setNotes(customerToEdit.notes || '')
    } else {
      setCustomerType('NATURAL')
      setDocumentType('CC')
      setDocumentNumber('')
      setFirstName('')
      setLastName('')
      setBusinessName('')
      setCommercialName('')
      setContactPerson('')
      setPhone('')
      setMobile('')
      setEmail('')
      setAddress('')
      setCity('Cali')
      setDepartment('Valle del Cauca')
      setCountry('Colombia')
      setCategory('FREQUENT')
      setPriceList('DEFAULT')
      setCreditLimit(0)
      setCreditDays(0)
      setPreferredLocationId('loc-001')
      setNotes('')
    }
    setActiveTab('basic')
    setError(null)
  }, [customerToEdit, isOpen])

  if (!isOpen) return null

  const locationOptions = locations.map((l) => ({
    value: l.id,
    label: l.name,
    description: l.code,
  }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    // Validaciones básicas antes de enviar
    if (!documentNumber.trim()) {
      setError('El número de documento es requerido.')
      setActiveTab('basic')
      return
    }

    if (customerType === 'COMPANY' && !businessName.trim()) {
      setError('La razón social de la empresa es requerida.')
      setActiveTab('basic')
      return
    }

    if (customerType === 'NATURAL' && !firstName.trim()) {
      setError('El nombre del cliente es requerido.')
      setActiveTab('basic')
      return
    }

    if (!phone.trim()) {
      setError('El teléfono principal de contacto es requerido.')
      setActiveTab('contact')
      return
    }

    if (!email.trim() || !email.includes('@')) {
      setError('Debe ingresar un correo electrónico válido.')
      setActiveTab('contact')
      return
    }

    if (!address.trim()) {
      setError('La dirección física es requerida.')
      setActiveTab('contact')
      return
    }

    try {
      setSaving(true)
      const payload: CreateCustomerDTO = {
        customerType,
        documentType,
        documentNumber: documentNumber.trim(),
        firstName: customerType === 'NATURAL' ? firstName.trim() : undefined,
        lastName: customerType === 'NATURAL' ? lastName.trim() : undefined,
        businessName: customerType === 'COMPANY' ? businessName.trim() : undefined,
        commercialName: commercialName.trim() || undefined,
        contactPerson: contactPerson.trim() || undefined,
        phone: phone.trim(),
        mobile: mobile.trim() || undefined,
        email: email.trim().toLowerCase(),
        address: address.trim(),
        city: city.trim(),
        department: department.trim(),
        country: country.trim() || 'Colombia',
        category,
        priceList,
        creditLimit: Number(creditLimit) || 0,
        creditDays: Number(creditDays) || 0,
        preferredLocationId,
        notes: notes.trim() || undefined,
      }

      await onSubmit(payload)
      onClose()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al guardar el cliente'
      setError(msg)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <div
        className="product-drawer"
        style={{ width: 'min(100%, 620px)', maxWidth: '620px' }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={isEditing ? 'Editar Cliente' : 'Nuevo Cliente'}
      >
        {/* Header */}
        <div className="drawer-header" style={{ alignItems: 'center', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                display: 'grid',
                placeItems: 'center',
                width: 38,
                height: 38,
                borderRadius: 10,
                background: 'var(--navy)',
                color: '#ffffff',
              }}
            >
              <AppIcon name="customers" size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: 19, fontWeight: 800, margin: 0 }}>
                {isEditing ? 'Editar Cliente' : 'Nuevo Cliente'}
              </h2>
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                {isEditing
                  ? `Modificando registro de ${customerToEdit?.displayName}`
                  : 'Registra un cliente para facturación, ventas POS y pedidos'}
              </span>
            </div>
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

        {/* Tab Navigation */}
        <div className="drawer-tabs" style={{ marginBottom: 20 }}>
          <button
            type="button"
            className={activeTab === 'basic' ? 'active' : ''}
            onClick={() => setActiveTab('basic')}
          >
            <AppIcon name="customers" size={13} />
            <span>1. Información Básica</span>
          </button>
          <button
            type="button"
            className={activeTab === 'contact' ? 'active' : ''}
            onClick={() => setActiveTab('contact')}
          >
            <AppIcon name="warehouse" size={13} />
            <span>2. Contacto & Ubicación</span>
          </button>
          <button
            type="button"
            className={activeTab === 'commercial' ? 'active' : ''}
            onClick={() => setActiveTab('commercial')}
          >
            <AppIcon name="wallet" size={13} />
            <span>3. Comercial & Crédito</span>
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div
            className="page-enter"
            style={{
              padding: '12px 14px',
              borderRadius: 10,
              background: '#fef2f2',
              border: '1.5px solid #fecaca',
              color: '#dc2626',
              fontSize: 12,
              fontWeight: 600,
              marginBottom: 16,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <AppIcon name="warning" size={16} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* TAB 1: INFORMACIÓN BÁSICA */}
          {activeTab === 'basic' && (
            <div className="page-enter">
              {/* Selector Tipo Cliente */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 8 }}>
                  Tipo de persona / contribuyente <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <button
                    type="button"
                    className={`tab-pill ${customerType === 'NATURAL' ? 'active' : ''}`}
                    onClick={() => {
                      setCustomerType('NATURAL')
                      if (documentType === 'NIT') setDocumentType('CC')
                    }}
                    style={{
                      height: 44,
                      justifyContent: 'center',
                      borderRadius: 10,
                      fontWeight: 700,
                      border: customerType === 'NATURAL' ? '2px solid var(--navy)' : '1.5px solid #cbd5e1',
                    }}
                  >
                    <AppIcon name="users" size={15} />
                    <span>Persona Natural</span>
                  </button>

                  <button
                    type="button"
                    className={`tab-pill ${customerType === 'COMPANY' ? 'active' : ''}`}
                    onClick={() => {
                      setCustomerType('COMPANY')
                      setDocumentType('NIT')
                    }}
                    style={{
                      height: 44,
                      justifyContent: 'center',
                      borderRadius: 10,
                      fontWeight: 700,
                      border: customerType === 'COMPANY' ? '2px solid var(--navy)' : '1.5px solid #cbd5e1',
                    }}
                  >
                    <AppIcon name="warehouse" size={15} />
                    <span>Empresa / Persona Jurídica</span>
                  </button>
                </div>
              </div>

              {/* Documento */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 14, marginBottom: 16 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
                    Tipo de documento <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <CustomSelect
                    value={documentType}
                    onChange={(val) => setDocumentType(val as CustomerDocumentType)}
                    options={DOCUMENT_TYPES}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
                    Número de documento / NIT <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <input
                    type="text"
                    className="filter-date-input"
                    placeholder={documentType === 'NIT' ? 'Ej. 901.442.118-2' : 'Ej. 1.144.520.890'}
                    value={documentNumber}
                    onChange={(e) => setDocumentNumber(e.target.value)}
                    required
                  />
                </div>
              </div>

              {/* Nombres Persona Natural */}
              {customerType === 'NATURAL' ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
                      Nombres <span style={{ color: '#dc2626' }}>*</span>
                    </label>
                    <input
                      type="text"
                      className="filter-date-input"
                      placeholder="Ej. Carlos Alberto"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      required
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
                      Apellidos
                    </label>
                    <input
                      type="text"
                      className="filter-date-input"
                      placeholder="Ej. Restrepo Gómez"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                    />
                  </div>
                </div>
              ) : (
                /* Razón Social Empresa */
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
                    Razón Social <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <input
                    type="text"
                    className="filter-date-input"
                    placeholder="Ej. Comercializadora El Sol S.A.S."
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    required
                  />
                </div>
              )}

              {/* Nombre Comercial y Persona de Contacto */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
                    Nombre Comercial (Opcional)
                  </label>
                  <input
                    type="text"
                    className="filter-date-input"
                    placeholder="Ej. El Sol Mayorista"
                    value={commercialName}
                    onChange={(e) => setCommercialName(e.target.value)}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
                    Contacto / Representante
                  </label>
                  <input
                    type="text"
                    className="filter-date-input"
                    placeholder="Ej. Mauricio Gómez"
                    value={contactPerson}
                    onChange={(e) => setContactPerson(e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: INFORMACIÓN DE CONTACTO & UBICACIÓN */}
          {activeTab === 'contact' && (
            <div className="page-enter">
              {/* Teléfono & Celular */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
                    Teléfono principal <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <input
                    type="text"
                    className="filter-date-input"
                    placeholder="Ej. +57 602 884 1200"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
                    Celular / WhatsApp
                  </label>
                  <input
                    type="text"
                    className="filter-date-input"
                    placeholder="Ej. +57 300 458 2011"
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value)}
                  />
                </div>
              </div>

              {/* Correo Electrónico */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
                  Correo electrónico para facturación <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <input
                  type="email"
                  className="filter-date-input"
                  placeholder="Ej. compras@cliente.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              {/* Dirección */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
                  Dirección de despacho / comercial <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <input
                  type="text"
                  className="filter-date-input"
                  placeholder="Ej. Cra 15 # 45-20, Barrio San Fernando"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  required
                />
              </div>

              {/* Ciudad, Departamento y País */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
                    Ciudad <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <input
                    type="text"
                    className="filter-date-input"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
                    Departamento <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <input
                    type="text"
                    className="filter-date-input"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
                    País
                  </label>
                  <input
                    type="text"
                    className="filter-date-input"
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: INFORMACIÓN COMERCIAL & CRÉDITO */}
          {activeTab === 'commercial' && (
            <div className="page-enter">
              {/* Categoría y Lista de Precios */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
                    Categoría de cliente <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <CustomSelect
                    value={category}
                    onChange={(val) => setCategory(val as CustomerCategory)}
                    options={CUSTOMER_CATEGORIES}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
                    Lista de precios asignada <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <CustomSelect
                    value={priceList}
                    onChange={(val) => setPriceList(val as CustomerPriceList)}
                    options={PRICE_LISTS}
                  />
                </div>
              </div>

              {/* Cupo de Crédito y Días */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
                    Cupo de crédito autorizado ($COP)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="100000"
                    className="filter-date-input"
                    style={{ fontSize: 14, fontWeight: 700 }}
                    value={creditLimit}
                    onChange={(e) => setCreditLimit(Number(e.target.value) || 0)}
                  />
                  <small style={{ fontSize: 10, color: 'var(--muted)', marginTop: 4, display: 'block' }}>
                    0 = Sin crédito autorizado
                  </small>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
                    Días de crédito
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="180"
                    className="filter-date-input"
                    value={creditDays}
                    onChange={(e) => setCreditDays(Number(e.target.value) || 0)}
                  />
                  <small style={{ fontSize: 10, color: 'var(--muted)', marginTop: 4, display: 'block' }}>
                    {creditDays === 0 ? 'Venta de contado' : `Plazo ${creditDays} días`}
                  </small>
                </div>
              </div>

              {/* Bodega Preferida */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
                  Bodega o punto de despacho preferido
                </label>
                <CustomSelect
                  value={preferredLocationId}
                  onChange={(val) => setPreferredLocationId(val)}
                  options={locationOptions}
                />
              </div>

              {/* Observaciones */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
                  Observaciones comerciales o acuerdos de entrega
                </label>
                <textarea
                  className="filter-date-input"
                  style={{ minHeight: 70 }}
                  placeholder="Instrucciones de entrega, horarios de descargue, acuerdos comerciales..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* Footer Actions */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingTop: 18,
              borderTop: '1px solid var(--line)',
              marginTop: 20,
            }}
          >
            {activeTab !== 'basic' ? (
              <button
                type="button"
                className="outline-button"
                onClick={() =>
                  setActiveTab(activeTab === 'commercial' ? 'contact' : 'basic')
                }
              >
                ← Anterior
              </button>
            ) : (
              <div />
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                className="outline-button"
                onClick={onClose}
                disabled={saving}
              >
                Cancelar
              </button>

              {activeTab !== 'commercial' ? (
                <button
                  type="button"
                  className="outline-button"
                  style={{ fontWeight: 700, color: 'var(--navy)' }}
                  onClick={() =>
                    setActiveTab(activeTab === 'basic' ? 'contact' : 'commercial')
                  }
                >
                  Siguiente paso →
                </button>
              ) : (
                <button
                  type="submit"
                  className="primary-button"
                  disabled={saving}
                >
                  <AppIcon name="check" size={16} />
                  <span>{saving ? 'Guardando...' : isEditing ? 'Guardar Cambios' : 'Crear Cliente'}</span>
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
