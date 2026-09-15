'use client'

import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { AppIcon } from '@/components/ui/Icon'
import { TaxConfig, TaxType, TaxStatus } from '../types'
import { taxConfigFormSchema, TaxConfigFormData } from '../schemas/tax.schema'
import { CustomSelect } from '@/components/ui/CustomSelect'

interface TaxFormDrawerProps {
  mode: 'create' | 'edit'
  tax?: TaxConfig | null
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: TaxConfigFormData) => Promise<void>
}

const DEFAULT_FORM: TaxConfigFormData = {
  name: '',
  code: '',
  type: 'IVA',
  ratePercent: 19,
  status: 'ACTIVE',
  validFrom: new Date().toISOString().split('T')[0],
  validUntil: '',
  description: '',
  isDefault: false,
  generatedTaxAccountId: '240805',
  generatedTaxAccountName: '240805 - IVA generado en ventas y servicios (19%)',
  deductibleTaxAccountId: '240810',
  deductibleTaxAccountName: '240810 - IVA descontable en compras de inventario (19%)',
}

export function TaxFormDrawer({
  mode,
  tax,
  isOpen,
  onClose,
  onSubmit,
}: TaxFormDrawerProps) {
  const [mounted, setMounted] = useState(false)
  const [formData, setFormData] = useState<TaxConfigFormData>(DEFAULT_FORM)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (tax && mode === 'edit') {
      setFormData({
        name: tax.name || '',
        code: tax.code || '',
        type: tax.type || 'IVA',
        ratePercent: tax.ratePercent ?? 0,
        status: tax.status || 'ACTIVE',
        validFrom: tax.validFrom || new Date().toISOString().split('T')[0],
        validUntil: tax.validUntil || '',
        description: tax.description || '',
        isDefault: Boolean(tax.isDefault),
        generatedTaxAccountId: tax.generatedTaxAccountId || '240805',
        generatedTaxAccountName: tax.generatedTaxAccountName || '',
        deductibleTaxAccountId: tax.deductibleTaxAccountId || '240810',
        deductibleTaxAccountName: tax.deductibleTaxAccountName || '',
      })
    } else if (mode === 'create') {
      setFormData(DEFAULT_FORM)
    }
    setErrors({})
  }, [tax, mode, isOpen])

  // Cerrar con Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!mounted || !isOpen) return null

  const handleInputChange = (field: keyof TaxConfigFormData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev }
        delete next[field]
        return next
      })
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setErrors({})

    try {
      const parsed = taxConfigFormSchema.parse(formData)
      await onSubmit(parsed)
      onClose()
    } catch (err: any) {
      if (err.issues && Array.isArray(err.issues)) {
        const fieldErrors: Record<string, string> = {}
        for (const issue of err.issues) {
          const path = issue.path[0] as string
          if (path && !fieldErrors[path]) {
            fieldErrors[path] = issue.message
          }
        }
        setErrors(fieldErrors)
      } else {
        setErrors({ form: err.message || 'Error al guardar la configuración tributaria.' })
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const hasTransactions = Boolean(
    tax && ((tax.salesCount || 0) > 0 || (tax.purchasesCount || 0) > 0)
  )

  const drawerContent = (
    <div
      className="drawer-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="tax-drawer-title"
    >
      <div
        className="product-drawer"
        style={{ width: 'min(100%, 540px)', padding: '28px' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="drawer-header">
          <div>
            <p className="eyebrow" style={{ margin: '0 0 4px', fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 1.2 }}>
              {mode === 'create' ? 'Parametrización DIAN' : 'Modificación de Configuración'}
            </p>
            <h2 id="tax-drawer-title" style={{ margin: 0, fontSize: 20 }}>
              {mode === 'create' ? 'Nueva Configuración Tributaria' : `Editar: ${tax?.name}`}
            </h2>
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label="Cerrar panel"
          >
            <AppIcon name="close" size={18} />
          </button>
        </div>

        {hasTransactions && (
          <div
            style={{
              display: 'flex',
              gap: 10,
              padding: 12,
              borderRadius: 8,
              background: '#eff6ff',
              border: '1px solid #bfdbfe',
              color: '#1e40af',
              fontSize: 11,
              marginTop: 16,
              marginBottom: 10,
            }}
          >
            <AppIcon name="info" size={18} />
            <div>
              <strong>Trazabilidad Histórica Protegida:</strong> Esta configuración ya posee {tax?.salesCount} ventas y {tax?.purchasesCount} compras. Para alterar su tarifa o código fiscal se debe generar una nueva vigencia para no corromper documentos anteriores.
            </div>
          </div>
        )}

        {errors.form && (
          <div
            style={{
              padding: 12,
              borderRadius: 8,
              background: '#fef2f2',
              border: '1px solid #fecaca',
              color: 'var(--red)',
              fontSize: 12,
              marginTop: 14,
            }}
          >
            {errors.form}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* Nombre */}
          <div className="input-field-block">
            <label htmlFor="tax-name" style={{ display: 'block', fontSize: 11, fontWeight: 700, marginBottom: 6 }}>
              Nombre de la configuración <span style={{ color: 'var(--red)' }}>*</span>
            </label>
            <input
              id="tax-name"
              type="text"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              placeholder="Ej. IVA General 19%, Bienes Exentos Art. 477"
              required
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid var(--line)',
                borderRadius: 8,
                fontSize: 13,
                outline: 'none',
              }}
            />
            {errors.name && (
              <span style={{ color: 'var(--red)', fontSize: 11, marginTop: 4, display: 'block' }}>
                {errors.name}
              </span>
            )}
          </div>

          {/* Código y Tipo */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div className="input-field-block">
              <label htmlFor="tax-code" style={{ display: 'block', fontSize: 11, fontWeight: 700, marginBottom: 6 }}>
                Código tributario <span style={{ color: 'var(--red)' }}>*</span>
              </label>
              <input
                id="tax-code"
                type="text"
                value={formData.code}
                onChange={(e) => handleInputChange('code', e.target.value)}
                placeholder="Ej. IVA_19, EXENTO"
                disabled={hasTransactions}
                required
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid var(--line)',
                  borderRadius: 8,
                  fontSize: 13,
                  outline: 'none',
                  textTransform: 'uppercase',
                  background: hasTransactions ? '#f8fafc' : '#fff',
                }}
              />
              {errors.code && (
                <span style={{ color: 'var(--red)', fontSize: 11, marginTop: 4, display: 'block' }}>
                  {errors.code}
                </span>
              )}
            </div>

            <div className="input-field-block">
              <label htmlFor="tax-type" style={{ display: 'block', fontSize: 11, fontWeight: 700, marginBottom: 6 }}>
                Tipo de impuesto <span style={{ color: 'var(--red)' }}>*</span>
              </label>
              <CustomSelect
                id="tax-type"
                value={formData.type}
                onChange={(val) => handleInputChange('type', val as TaxType)}
                options={[
                  { value: 'IVA', label: 'IVA (Impuesto sobre las Ventas)' },
                  { value: 'EXCLUIDO', label: 'Excluido de IVA (Art. 424 E.T.)' },
                  { value: 'NO_GRAVADO', label: 'No Gravado' },
                  { value: 'OTRO', label: 'Otro (INC, etc.)' },
                ]}
              />
            </div>
          </div>

          {/* Tarifa y Estado */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div className="input-field-block">
              <label htmlFor="tax-rate" style={{ display: 'block', fontSize: 11, fontWeight: 700, marginBottom: 6 }}>
                Tarifa o porcentaje (%) <span style={{ color: 'var(--red)' }}>*</span>
              </label>
              <input
                id="tax-rate"
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={formData.ratePercent}
                onChange={(e) => handleInputChange('ratePercent', e.target.value)}
                disabled={hasTransactions}
                required
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid var(--line)',
                  borderRadius: 8,
                  fontSize: 13,
                  outline: 'none',
                  background: hasTransactions ? '#f8fafc' : '#fff',
                }}
              />
              {errors.ratePercent && (
                <span style={{ color: 'var(--red)', fontSize: 11, marginTop: 4, display: 'block' }}>
                  {errors.ratePercent}
                </span>
              )}
            </div>

            <div className="input-field-block">
              <label htmlFor="tax-status" style={{ display: 'block', fontSize: 11, fontWeight: 700, marginBottom: 6 }}>
                Estado de asignación <span style={{ color: 'var(--red)' }}>*</span>
              </label>
              <CustomSelect
                id="tax-status"
                value={formData.status}
                onChange={(val) => handleInputChange('status', val as TaxStatus)}
                options={[
                  { value: 'ACTIVE', label: 'Activo (Permite nuevas asignaciones)' },
                  { value: 'INACTIVE', label: 'Inactivo (Bloqueado para nuevos docs)' },
                ]}
              />
            </div>
          </div>

          {/* Vigencia: Inicio y Fin */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div className="input-field-block">
              <label htmlFor="tax-valid-from" style={{ display: 'block', fontSize: 11, fontWeight: 700, marginBottom: 6 }}>
                Inicio de vigencia <span style={{ color: 'var(--red)' }}>*</span>
              </label>
              <input
                id="tax-valid-from"
                type="date"
                value={formData.validFrom}
                onChange={(e) => handleInputChange('validFrom', e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid var(--line)',
                  borderRadius: 8,
                  fontSize: 13,
                  outline: 'none',
                }}
              />
              {errors.validFrom && (
                <span style={{ color: 'var(--red)', fontSize: 11, marginTop: 4, display: 'block' }}>
                  {errors.validFrom}
                </span>
              )}
            </div>

            <div className="input-field-block">
              <label htmlFor="tax-valid-until" style={{ display: 'block', fontSize: 11, fontWeight: 700, marginBottom: 6 }}>
                Fin de vigencia (Opcional)
              </label>
              <input
                id="tax-valid-until"
                type="date"
                value={formData.validUntil || ''}
                onChange={(e) => handleInputChange('validUntil', e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid var(--line)',
                  borderRadius: 8,
                  fontSize: 13,
                  outline: 'none',
                }}
              />
              {errors.validUntil && (
                <span style={{ color: 'var(--red)', fontSize: 11, marginTop: 4, display: 'block' }}>
                  {errors.validUntil}
                </span>
              )}
            </div>
          </div>

          {/* Cuentas Contables */}
          <div style={{ borderTop: '1px solid var(--line)', paddingTop: 16 }}>
            <p style={{ margin: '0 0 10px', fontSize: 12, fontWeight: 700, color: 'var(--navy)' }}>
              Parametrización Contable (PUC Comercial)
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div className="input-field-block">
                <label htmlFor="acc-vta" style={{ display: 'block', fontSize: 11, fontWeight: 600, marginBottom: 4 }}>
                  Cuenta IVA Generado (Ventas)
                </label>
                <input
                  id="acc-vta"
                  type="text"
                  value={formData.generatedTaxAccountId || ''}
                  onChange={(e) => handleInputChange('generatedTaxAccountId', e.target.value)}
                  placeholder="Ej. 240805"
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    border: '1px solid var(--line)',
                    borderRadius: 7,
                    fontSize: 12,
                    outline: 'none',
                  }}
                />
              </div>

              <div className="input-field-block">
                <label htmlFor="acc-cpr" style={{ display: 'block', fontSize: 11, fontWeight: 600, marginBottom: 4 }}>
                  Cuenta IVA Descontable (Compras)
                </label>
                <input
                  id="acc-cpr"
                  type="text"
                  value={formData.deductibleTaxAccountId || ''}
                  onChange={(e) => handleInputChange('deductibleTaxAccountId', e.target.value)}
                  placeholder="Ej. 240810"
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    border: '1px solid var(--line)',
                    borderRadius: 7,
                    fontSize: 12,
                    outline: 'none',
                  }}
                />
              </div>
            </div>
          </div>

          {/* Descripción */}
          <div className="input-field-block">
            <label htmlFor="tax-desc" style={{ display: 'block', fontSize: 11, fontWeight: 700, marginBottom: 6 }}>
              Fundamento legal / Descripción
            </label>
            <textarea
              id="tax-desc"
              rows={3}
              value={formData.description || ''}
              onChange={(e) => handleInputChange('description', e.target.value)}
              placeholder="Base jurídica, excepciones DIAN o notas para los vendedores..."
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid var(--line)',
                borderRadius: 8,
                fontSize: 12,
                outline: 'none',
                resize: 'vertical',
              }}
            />
            {errors.description && (
              <span style={{ color: 'var(--red)', fontSize: 11, marginTop: 4, display: 'block' }}>
                {errors.description}
              </span>
            )}
          </div>

          {/* Acciones */}
          <div style={{ display: 'flex', gap: 12, marginTop: 10 }}>
            <button
              type="button"
              className="outline-button"
              onClick={onClose}
              disabled={isSubmitting}
              style={{ flex: 1 }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="primary-button"
              disabled={isSubmitting}
              style={{ flex: 2 }}
            >
              {isSubmitting ? (
                <>
                  <AppIcon name="refresh" size={16} className="animate-spin" />
                  <span>Guardando...</span>
                </>
              ) : (
                <>
                  <AppIcon name="save" size={16} />
                  <span>{mode === 'create' ? 'Crear configuración' : 'Guardar cambios'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )

  return createPortal(drawerContent, document.body)
}
