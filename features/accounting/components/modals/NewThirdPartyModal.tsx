'use client'

import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { AppIcon } from '@/components/ui/Icon'
import { LegalNature, ThirdParty, ThirdPartyType } from '../../types'
import { ThirdPartyFormData } from '../../schemas/accounting.schema'
import { SelectField } from '@/components/ui/SelectField'

interface NewThirdPartyModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: ThirdPartyFormData) => Promise<ThirdParty>
  onSuccess?: (created: ThirdParty) => void
  defaultType?: ThirdPartyType
}

/**
 * Algoritmo oficial DIAN (Módulo 11) para cálculo de Dígito de Verificación (DV)
 */
export function calculateDianDv(nit: string): string {
  const cleaned = nit.replace(/\D/g, '')
  if (!cleaned) return ''
  const primes = [3, 7, 13, 17, 19, 23, 29, 37, 41, 43, 47, 53, 59, 67, 71]
  let sum = 0
  const len = cleaned.length
  for (let i = 0; i < len; i++) {
    const digit = parseInt(cleaned.charAt(len - 1 - i), 10)
    sum += digit * primes[i]
  }
  const remainder = sum % 11
  if (remainder === 0 || remainder === 1) {
    return remainder.toString()
  }
  return (11 - remainder).toString()
}

export function NewThirdPartyModal({
  isOpen,
  onClose,
  onSubmit,
  onSuccess,
  defaultType = 'CLIENTE',
}: NewThirdPartyModalProps) {
  const [mounted, setMounted] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  // 1. Rol principal del tercero: Cliente vs Proveedor vs Otros
  const [thirdPartyType, setThirdPartyType] = useState<ThirdPartyType>(defaultType)

  // 2. Naturaleza Jurídica
  const [legalNature, setLegalNature] = useState<LegalNature>('JURIDICA')

  // 3. Documento de Identificación
  const [documentType, setDocumentType] = useState('NIT')
  const [documentNumber, setDocumentNumber] = useState('')
  const [verificationDigit, setVerificationDigit] = useState('')

  // 4. Datos Persona Jurídica
  const [companyName, setCompanyName] = useState('')
  const [commercialName, setCommercialName] = useState('')

  // 5. Datos Persona Natural
  const [firstName, setFirstName] = useState('')
  const [otherNames, setOtherNames] = useState('')
  const [firstSurname, setFirstSurname] = useState('')
  const [secondSurname, setSecondSurname] = useState('')

  // 6. Contacto y Ubicación
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [city, setCity] = useState('Medellín')
  const [department, setDepartment] = useState('Antioquia')

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (isOpen) {
      setThirdPartyType(defaultType || 'CLIENTE')
    }
  }, [isOpen, defaultType])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  // Ajustar tipo de documento según naturaleza jurídica
  const handleNatureChange = (nature: LegalNature) => {
    setLegalNature(nature)
    if (nature === 'JURIDICA') {
      setDocumentType('NIT')
      if (documentNumber) {
        setVerificationDigit(calculateDianDv(documentNumber))
      }
    } else {
      if (documentType === 'NIT') {
        setDocumentType('CC')
        setVerificationDigit('')
      }
    }
  }

  // Recalcular DV automáticamente cuando cambia el número de documento si es NIT
  const handleDocChange = (val: string) => {
    const cleaned = val.replace(/[^0-9A-Za-z-]/g, '')
    setDocumentNumber(cleaned)
    if (documentType === 'NIT') {
      setVerificationDigit(calculateDianDv(cleaned))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)

    if (!documentNumber.trim()) {
      setFormError('El número de documento o NIT es obligatorio.')
      return
    }

    let finalName = companyName.trim()
    if (legalNature === 'NATURAL') {
      const parts = [firstSurname.trim(), secondSurname.trim(), firstName.trim(), otherNames.trim()].filter(Boolean)
      if (parts.length === 0 && !finalName) {
        setFormError('Para personas naturales, debes ingresar al menos primer nombre y primer apellido.')
        return
      }
      if (parts.length > 0) {
        finalName = parts.join(' ')
      }
    } else {
      if (!finalName) {
        setFormError('La razón social de la persona jurídica es obligatoria.')
        return
      }
    }

    try {
      setIsSubmitting(true)
      const created = await onSubmit({
        documentType: documentType as any,
        documentNumber: documentNumber.trim(),
        verificationDigit: verificationDigit.trim() || undefined,
        legalNature,
        firstName: legalNature === 'NATURAL' ? firstName.trim() || undefined : undefined,
        otherNames: legalNature === 'NATURAL' ? otherNames.trim() || undefined : undefined,
        firstSurname: legalNature === 'NATURAL' ? firstSurname.trim() || undefined : undefined,
        secondSurname: legalNature === 'NATURAL' ? secondSurname.trim() || undefined : undefined,
        companyName: finalName,
        commercialName: commercialName.trim() || undefined,
        thirdPartyType,
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        address: address.trim() || undefined,
        city: city.trim() || 'Medellín',
        department: department.trim() || 'Antioquia',
      })

      if (onSuccess) {
        onSuccess(created)
      }
      onClose()
    } catch (err: any) {
      setFormError(err.message || 'Error al registrar el tercero.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen || !mounted) return null

  return createPortal(
    <div className="drawer-backdrop modal-center p-3 sm:p-4" onClick={onClose} aria-modal="true" role="dialog">
      <div
        className="modal-card modal-card-flush animate-scale-up"
        style={{
          width: '100%',
          maxWidth: 720,
          maxHeight: '94vh',
          display: 'flex',
          flexDirection: 'column',
          background: '#ffffff',
          borderRadius: 16,
          boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.25)',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera del Modal */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-900 flex items-center justify-center font-bold shrink-0">
              <AppIcon name="users" size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Registrar Nuevo Tercero</h2>
              <p className="text-xs text-slate-500">
                Define si es <strong className="text-emerald-700">Cliente</strong> o <strong className="text-blue-700">Proveedor</strong> para compras, ventas y asientos contables.
              </p>
            </div>
          </div>
          <button
            type="button"
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
            onClick={onClose}
            aria-label="Cerrar modal"
          >
            <AppIcon name="close" size={20} />
          </button>
        </div>

        {formError && (
          <div className="mx-6 mt-4 p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-center gap-2">
            <AppIcon name="warning" size={16} />
            <span>{formError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="p-6 space-y-5 overflow-y-auto flex-1 text-xs">
            {/* 1. SELECCIÓN PRINCIPAL: CLIENTE O PROVEEDOR */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="font-bold text-slate-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-blue-600 text-white inline-flex items-center justify-center text-[11px] font-bold">1</span>
                  ¿Qué tipo de tercero deseas crear? (Cliente o Proveedor) *
                </label>
                <span className="text-[11px] text-slate-500 font-medium">Selección rápida</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {/* Opción Cliente */}
                <button
                  type="button"
                  onClick={() => setThirdPartyType('CLIENTE')}
                  className={`p-3 rounded-xl border text-left transition-all relative flex flex-col justify-between ${
                    thirdPartyType === 'CLIENTE'
                      ? 'border-emerald-600 bg-emerald-50/80 text-emerald-950 ring-2 ring-emerald-500/20 shadow-sm'
                      : 'border-slate-200 hover:border-emerald-300 bg-white text-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <AppIcon name="purchases" size={20} color="#059669" />
                    {thirdPartyType === 'CLIENTE' && (
                      <span className="w-4 h-4 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px]">
                        <AppIcon name="check" size={10} color="#ffffff" />
                      </span>
                    )}
                  </div>
                  <div>
                    <strong className="block text-xs font-bold text-slate-900">Cliente</strong>
                    <span className="text-[10px] text-slate-500 leading-tight block mt-0.5">
                      Ventas, facturación y cobro de cartera (1305).
                    </span>
                  </div>
                </button>

                {/* Opción Proveedor */}
                <button
                  type="button"
                  onClick={() => setThirdPartyType('PROVEEDOR')}
                  className={`p-3 rounded-xl border text-left transition-all relative flex flex-col justify-between ${
                    thirdPartyType === 'PROVEEDOR'
                      ? 'border-blue-600 bg-blue-50/80 text-blue-950 ring-2 ring-blue-500/20 shadow-sm'
                      : 'border-slate-200 hover:border-blue-300 bg-white text-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <AppIcon name="package" size={20} color="#2563eb" />
                    {thirdPartyType === 'PROVEEDOR' && (
                      <span className="w-4 h-4 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px]">
                        <AppIcon name="check" size={10} color="#ffffff" />
                      </span>
                    )}
                  </div>
                  <div>
                    <strong className="block text-xs font-bold text-slate-900">Proveedor</strong>
                    <span className="text-[10px] text-slate-500 leading-tight block mt-0.5">
                      Compras, insumos y cuentas por pagar (2205).
                    </span>
                  </div>
                </button>

                {/* Opción Empleado */}
                <button
                  type="button"
                  onClick={() => setThirdPartyType('EMPLEADO')}
                  className={`p-3 rounded-xl border text-left transition-all relative flex flex-col justify-between ${
                    thirdPartyType === 'EMPLEADO'
                      ? 'border-purple-600 bg-purple-50/80 text-purple-950 ring-2 ring-purple-500/20 shadow-sm'
                      : 'border-slate-200 hover:border-purple-300 bg-white text-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <AppIcon name="users" size={20} color="#7c3aed" />
                    {thirdPartyType === 'EMPLEADO' && (
                      <span className="w-4 h-4 rounded-full bg-purple-600 text-white flex items-center justify-center text-[10px]">
                        <AppIcon name="check" size={10} color="#ffffff" />
                      </span>
                    )}
                  </div>
                  <div>
                    <strong className="block text-xs font-bold text-slate-900">Empleado</strong>
                    <span className="text-[10px] text-slate-500 leading-tight block mt-0.5">
                      Nómina, prestaciones y liquidaciones (2505).
                    </span>
                  </div>
                </button>

                {/* Opción Acreedor / Otro */}
                <button
                  type="button"
                  onClick={() => setThirdPartyType('ACREEDOR')}
                  className={`p-3 rounded-xl border text-left transition-all relative flex flex-col justify-between ${
                    thirdPartyType === 'ACREEDOR' || thirdPartyType === 'OTRO'
                      ? 'border-amber-600 bg-amber-50/80 text-amber-950 ring-2 ring-amber-500/20 shadow-sm'
                      : 'border-slate-200 hover:border-amber-300 bg-white text-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <AppIcon name="warehouse" size={20} color="#d97706" />
                    {(thirdPartyType === 'ACREEDOR' || thirdPartyType === 'OTRO') && (
                      <span className="w-4 h-4 rounded-full bg-amber-600 text-white flex items-center justify-center text-[10px]">
                        <AppIcon name="check" size={10} color="#ffffff" />
                      </span>
                    )}
                  </div>
                  <div>
                    <strong className="block text-xs font-bold text-slate-900">Acreedor / Otro</strong>
                    <span className="text-[10px] text-slate-500 leading-tight block mt-0.5">
                      Servicios públicos, arriendos, bancos o DIAN.
                    </span>
                  </div>
                </button>
              </div>

              {/* Mensaje Contextual de Clasificación */}
              <div className="mt-2 py-1.5 px-3 bg-slate-50 rounded-lg border border-slate-200 text-[11px] flex items-center justify-between">
                <span className="text-slate-600">
                  Clasificación seleccionada: <strong className="text-slate-900">
                    {thirdPartyType === 'CLIENTE' && 'CLIENTE (Módulo de Ventas & Cartera)'}
                    {thirdPartyType === 'PROVEEDOR' && 'PROVEEDOR (Módulo de Compras & Cuentas por Pagar)'}
                    {thirdPartyType === 'EMPLEADO' && 'EMPLEADO (Nómina & Seguridad Social)'}
                    {thirdPartyType === 'ACREEDOR' && 'ACREEDOR VARIOS (Servicios, Bancos, Arriendos)'}
                    {thirdPartyType === 'OTRO' && 'OTRO TERCERO'}
                  </strong>
                </span>
                <span className="text-blue-700 font-semibold text-[10px]">Tercero Contable Oficial</span>
              </div>
            </div>

            {/* 2. SELECTOR DE NATURALEZA JURÍDICA */}
            <div>
              <label className="font-bold text-slate-900 text-xs uppercase tracking-wider flex items-center gap-1.5 mb-2">
                <span className="w-5 h-5 rounded-full bg-blue-600 text-white inline-flex items-center justify-center text-[11px] font-bold">2</span>
                Naturaleza Jurídica del Tercero *
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => handleNatureChange('JURIDICA')}
                  className={`p-3 rounded-xl border text-left transition-all flex items-start gap-3 ${
                    legalNature === 'JURIDICA'
                      ? 'border-blue-600 bg-blue-50/70 text-blue-950 ring-2 ring-blue-500/20 shadow-sm'
                      : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                    legalNature === 'JURIDICA' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'
                  }`}>
                    <AppIcon name="warehouse" size={16} />
                  </div>
                  <div>
                    <strong className="block text-xs">Persona Jurídica</strong>
                    <span className="text-[11px] text-slate-500 leading-tight block mt-0.5">
                      Empresas, sociedades, SAS y entidades con NIT corporativo y DV DIAN.
                    </span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handleNatureChange('NATURAL')}
                  className={`p-3 rounded-xl border text-left transition-all flex items-start gap-3 ${
                    legalNature === 'NATURAL'
                      ? 'border-blue-600 bg-blue-50/70 text-blue-950 ring-2 ring-blue-500/20 shadow-sm'
                      : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                    legalNature === 'NATURAL' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'
                  }`}>
                    <AppIcon name="users" size={16} />
                  </div>
                  <div>
                    <strong className="block text-xs">Persona Natural</strong>
                    <span className="text-[11px] text-slate-500 leading-tight block mt-0.5">
                      Individuos, profesionales independientes, empleados o clientes con CC.
                    </span>
                  </div>
                </button>
              </div>
            </div>

            {/* 3. IDENTIFICACIÓN Y DOCUMENTO */}
            <div>
              <label className="font-bold text-slate-900 text-xs uppercase tracking-wider flex items-center gap-1.5 mb-2">
                <span className="w-5 h-5 rounded-full bg-blue-600 text-white inline-flex items-center justify-center text-[11px] font-bold">3</span>
                Identificación Fiscal y Nombres Oficiales *
              </label>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Tipo de Documento:</label>
                  <SelectField
                    value={documentType}
                    className="w-full"
                    size="sm"
                    onChange={(value) => {
                      const dt = value
                      setDocumentType(dt)
                      if (dt === 'NIT' && documentNumber) {
                        setVerificationDigit(calculateDianDv(documentNumber))
                      } else if (dt !== 'NIT') {
                        setVerificationDigit('')
                      }
                    }}
                  >
                    <option value="NIT">NIT (Número de Identificación Tributaria)</option>
                    <option value="CC">CC (Cédula de Ciudadanía)</option>
                    <option value="CE">CE (Cédula de Extranjería)</option>
                    <option value="PASSPORT">Pasaporte</option>
                    <option value="TI">TI (Tarjeta de Identidad)</option>
                  </SelectField>
                </div>

                <div className="md:col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">
                    Número de Documento / NIT *
                  </label>
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      placeholder={documentType === 'NIT' ? 'Ej: 900123456' : 'Ej: 1020304050'}
                      className="w-full h-9 px-3 text-xs font-mono font-semibold bg-white border border-slate-300 rounded-lg text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all shadow-sm"
                      value={documentNumber}
                      onChange={(e) => handleDocChange(e.target.value)}
                      required
                    />
                    {documentType === 'NIT' && (
                      <div className="w-16 shrink-0 flex items-center gap-1">
                        <span className="text-slate-400 font-bold">-</span>
                        <input
                          type="text"
                          placeholder="DV"
                          maxLength={1}
                          title="Dígito de verificación DIAN (Módulo 11)"
                          className="w-full h-9 px-1.5 text-center text-xs font-mono font-bold bg-blue-50/70 border border-blue-300 rounded-lg text-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                          value={verificationDigit}
                          onChange={(e) => setVerificationDigit(e.target.value.replace(/\D/g, ''))}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Campos según Naturaleza Jurídica */}
            {legalNature === 'JURIDICA' ? (
              <div className="space-y-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Razón Social Oficial (según RUT o Cámara de Comercio) *
                  </label>
                  <input
                    type="text"
                    placeholder="Ej: Distribuidora Nacional de Alimentos S.A.S."
                    className="w-full h-9 px-3 text-xs bg-white border border-slate-300 rounded-lg text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all shadow-sm"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Nombre Comercial (Opcional):</label>
                  <input
                    type="text"
                    placeholder="Ej: Super Distribuidor"
                    className="w-full h-9 px-3 text-xs bg-white border border-slate-300 rounded-lg text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all shadow-sm"
                    value={commercialName}
                    onChange={(e) => setCommercialName(e.target.value)}
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Primer Apellido *</label>
                    <input
                      type="text"
                      placeholder="Ej: Gómez"
                      className="w-full h-9 px-3 text-xs bg-white border border-slate-300 rounded-lg text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all shadow-sm"
                      value={firstSurname}
                      onChange={(e) => setFirstSurname(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Segundo Apellido:</label>
                    <input
                      type="text"
                      placeholder="Ej: Restrepo"
                      className="w-full h-9 px-3 text-xs bg-white border border-slate-300 rounded-lg text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all shadow-sm"
                      value={secondSurname}
                      onChange={(e) => setSecondSurname(e.target.value)}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Primer Nombre *</label>
                    <input
                      type="text"
                      placeholder="Ej: Carlos"
                      className="w-full h-9 px-3 text-xs bg-white border border-slate-300 rounded-lg text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all shadow-sm"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Otros Nombres:</label>
                    <input
                      type="text"
                      placeholder="Ej: Alberto"
                      className="w-full h-9 px-3 text-xs bg-white border border-slate-300 rounded-lg text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all shadow-sm"
                      value={otherNames}
                      onChange={(e) => setOtherNames(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* 4. DATOS DE CONTACTO Y UBICACIÓN */}
            <div>
              <label className="font-bold text-slate-900 text-xs uppercase tracking-wider flex items-center gap-1.5 mb-2">
                <span className="w-5 h-5 rounded-full bg-blue-600 text-white inline-flex items-center justify-center text-[11px] font-bold">4</span>
                Datos de Contacto y Ubicación
              </label>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Correo Electrónico (Facturación):</label>
                  <input
                    type="email"
                    placeholder="facturacion@empresa.com"
                    className="w-full h-9 px-3 text-xs bg-white border border-slate-300 rounded-lg text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all shadow-sm"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Teléfono / WhatsApp:</label>
                  <input
                    type="text"
                    placeholder="Ej: (604) 444-1234 o 300 123 4567"
                    className="w-full h-9 px-3 text-xs bg-white border border-slate-300 rounded-lg text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all shadow-sm"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Ciudad / Municipio:</label>
                  <input
                    type="text"
                    className="w-full h-9 px-3 text-xs bg-white border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all shadow-sm"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Departamento:</label>
                  <input
                    type="text"
                    className="w-full h-9 px-3 text-xs bg-white border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all shadow-sm"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Dirección Fiscal:</label>
                  <input
                    type="text"
                    placeholder="Ej: Carrera 50 # 10-20"
                    className="w-full h-9 px-3 text-xs bg-white border border-slate-300 rounded-lg text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all shadow-sm"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Pie del Formulario */}
          <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
            <span className="text-[11px] text-slate-500 hidden sm:inline">
              Se guardará en la tabla contable oficial de Terceros (DIAN).
            </span>
            <div className="flex items-center gap-3 ml-auto">
              <button
                type="button"
                className="outline-button compact text-xs"
                onClick={onClose}
                disabled={isSubmitting}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="primary-button compact text-xs flex items-center gap-2"
                disabled={isSubmitting}
              >
                <AppIcon name="check" size={14} />
                <span>
                  {isSubmitting
                    ? 'Guardando...'
                    : `Guardar ${thirdPartyType === 'CLIENTE' ? 'Cliente' : thirdPartyType === 'PROVEEDOR' ? 'Proveedor' : 'Tercero'}`}
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
