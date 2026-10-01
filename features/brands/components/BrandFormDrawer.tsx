'use client'

import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { AppIcon } from '@/components/ui/Icon'
import { BrandWithRelations } from '../types'
import { brandFormSchema, BrandFormData, slugify } from '../schemas/brand.schema'

interface BrandFormDrawerProps {
  mode: 'create' | 'edit'
  brand?: BrandWithRelations | null
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: BrandFormData) => Promise<void>
}

export function BrandFormDrawer({
  mode,
  brand,
  isOpen,
  onClose,
  onSubmit,
}: BrandFormDrawerProps) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
  }, [])

  const [formData, setFormData] = useState<BrandFormData>({
    name: '',
    slug: '',
    logoUrl: null,
    isActive: true,
  })

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [autoSlug, setAutoSlug] = useState(true)

  // Cargar o limpiar datos al abrir
  useEffect(() => {
    if (brand && mode === 'edit') {
      setFormData({
        name: brand.name,
        slug: brand.slug,
        logoUrl: brand.logoUrl || null,
        isActive: brand.isActive,
      })
      setAutoSlug(false)
    } else {
      setFormData({
        name: '',
        slug: '',
        logoUrl: null,
        isActive: true,
      })
      setAutoSlug(true)
    }
    setErrors({})
  }, [brand, mode, isOpen])

  // Cerrar con Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isSubmitting) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, isSubmitting, onClose])

  if (!isOpen || !mounted) return null

  const handleNameChange = (val: string) => {
    setFormData((prev) => ({
      ...prev,
      name: val,
      slug: autoSlug ? slugify(val) : prev.slug,
    }))
    if (errors.name) setErrors((prev) => ({ ...prev, name: '' }))
  }

  const handleSlugChange = (val: string) => {
    setAutoSlug(false)
    setFormData((prev) => ({ ...prev, slug: slugify(val) }))
    if (errors.slug) setErrors((prev) => ({ ...prev, slug: '' }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrors({})

    const result = brandFormSchema.safeParse(formData)
    if (!result.success) {
      const fieldErrors: Record<string, string> = {}
      result.error.issues.forEach((err) => {
        const fieldName = err.path[0] as string
        if (fieldName && !fieldErrors[fieldName]) {
          fieldErrors[fieldName] = err.message
        }
      })
      setErrors(fieldErrors)
      return
    }

    try {
      setIsSubmitting(true)
      await onSubmit(result.data)
      onClose()
    } catch (err: any) {
      setErrors({ form: err.message || 'Error al guardar la marca' })
    } finally {
      setIsSubmitting(false)
    }
  }

  return createPortal(
    <div
      className="drawer-backdrop"
      onClick={() => !isSubmitting && onClose()}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="drawer-card page-enter"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '500px' }}
      >
        <div className="drawer-header">
          <div>
            <span className="badge badge-accent">
              {mode === 'create' ? 'Nueva Marca' : 'Editar Marca'}
            </span>
            <h2 className="drawer-title">
              {mode === 'create' ? 'Registrar marca' : formData.name || 'Editar marca'}
            </h2>
          </div>
          <button
            type="button"
            className="icon-button close-drawer-btn"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Cerrar formulario"
          >
            <AppIcon name="close" size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="drawer-form">
          <div className="drawer-body">
            {errors.form && (
              <div className="form-error-banner" role="alert">
                <AppIcon name="warning" size={16} />
                <span>{errors.form}</span>
              </div>
            )}

            <div className="input-field-block">
              <label htmlFor="brand-name">
                Nombre de la marca <span className="req">*</span>
              </label>
              <div className="input-wrap">
                <input
                  id="brand-name"
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="Ej: Colanta, Nestlé, Coca-Cola..."
                  autoFocus
                />
              </div>
              {errors.name && <span className="field-error">{errors.name}</span>}
            </div>

            <div className="input-field-block">
              <label htmlFor="brand-slug">
                Slug (URL amigable) <span className="req">*</span>
              </label>
              <div className="input-wrap">
                <input
                  id="brand-slug"
                  type="text"
                  value={formData.slug}
                  onChange={(e) => handleSlugChange(e.target.value)}
                  placeholder="colanta"
                  className="mono"
                />
              </div>
              {errors.slug && <span className="field-error">{errors.slug}</span>}
            </div>

            <div className="input-field-block">
              <label htmlFor="brand-logo">URL del Logo (Opcional)</label>
              <div className="input-wrap">
                <input
                  id="brand-logo"
                  type="url"
                  value={formData.logoUrl || ''}
                  onChange={(e) => setFormData((prev) => ({ ...prev, logoUrl: e.target.value || null }))}
                  placeholder="https://ejemplo.com/logo.png"
                />
              </div>
              <span className="field-helper">Enlace directo a imagen PNG, SVG o JPG</span>
              {errors.logoUrl && <span className="field-error">{errors.logoUrl}</span>}
            </div>

            <div className="input-field-block">
              <label>Estado de operación</label>
              <div className="checkbox-toggle-card">
                <label className="toggle-row-simple">
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => setFormData((prev) => ({ ...prev, isActive: e.target.checked }))}
                  />
                  <span>{formData.isActive ? 'Marca Activa' : 'Marca Inactiva'}</span>
                </label>
              </div>
            </div>
          </div>

          <div className="drawer-footer">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="btn btn-primary icon-button-text"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <AppIcon name="refresh" size={16} className="spin" />
                  <span>Guardando...</span>
                </>
              ) : (
                <>
                  <AppIcon name="save" size={16} />
                  <span>{mode === 'create' ? 'Crear Marca' : 'Guardar Cambios'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}
