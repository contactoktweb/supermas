'use client'

import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { AppIcon } from '@/components/ui/Icon'
import { BrandWithRelations } from '../types'
import { brandFormSchema, BrandFormData, slugify } from '../schemas/brand.schema'
import { extractErrorMessage } from '@/lib/utils'

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
    } catch (err: unknown) {
      setErrors({ form: extractErrorMessage(err, 'Error al guardar la marca') })
    } finally {
      setIsSubmitting(false)
    }
  }

  const fieldErrorId = (field: string) => `brand-${field}-error`

  return createPortal(
    <div className="drawer-backdrop" onClick={() => !isSubmitting && onClose()}>
      <aside
        className="product-drawer product-form-drawer catalog-form-drawer page-enter"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="brand-form-title"
      >
        <header className="drawer-header catalog-form-header">
          <div className="catalog-form-title">
            <span className="stat-icon blue" aria-hidden="true">
              <AppIcon name={mode === 'create' ? 'plus' : 'edit'} size={20} />
            </span>
            <div>
              <span className="product-category-eyebrow">
                {mode === 'create' ? 'Nueva marca' : 'Editar marca'}
              </span>
              <h2 id="brand-form-title">
                {mode === 'create' ? 'Registrar marca' : formData.name || 'Editar marca'}
              </h2>
            </div>
          </div>
          <button
            type="button"
            className="icon-button catalog-form-close"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Cerrar formulario"
          >
            <AppIcon name="close" size={20} />
          </button>
        </header>

        {errors.form && (
          <div className="form-error-banner page-enter" role="alert">
            <AppIcon name="warning" size={16} />
            <span>{extractErrorMessage(errors.form)}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="product-form-body" noValidate>
          <div className="form-tab-content">
            <div className="form-field">
              <label htmlFor="brand-name">
                Nombre de la marca <em>*</em>
              </label>
              <div className={`input-wrap ${errors.name ? 'is-invalid' : ''}`}>
                <input
                  id="brand-name"
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="Ej: Colanta, Nestlé, Coca-Cola..."
                  aria-invalid={Boolean(errors.name)}
                  aria-describedby={errors.name ? fieldErrorId('name') : undefined}
                  autoFocus
                />
              </div>
              {errors.name && (
                <span id={fieldErrorId('name')} className="field-error-text">
                  {errors.name}
                </span>
              )}
            </div>

            <div className="form-field">
              <label htmlFor="brand-slug">
                Slug (URL amigable) <em>*</em>
              </label>
              <div className={`input-wrap ${errors.slug ? 'is-invalid' : ''}`}>
                <input
                  id="brand-slug"
                  type="text"
                  value={formData.slug}
                  onChange={(e) => handleSlugChange(e.target.value)}
                  placeholder="colanta"
                  aria-invalid={Boolean(errors.slug)}
                  aria-describedby={errors.slug ? fieldErrorId('slug') : 'brand-slug-hint'}
                />
              </div>
              {errors.slug ? (
                <span id={fieldErrorId('slug')} className="field-error-text">
                  {errors.slug}
                </span>
              ) : (
                <small id="brand-slug-hint" className="field-hint">
                  Se genera automáticamente a partir del nombre.
                </small>
              )}
            </div>

            <div className="form-field">
              <label htmlFor="brand-logo">URL del logo (opcional)</label>
              <div className={`input-wrap ${errors.logoUrl ? 'is-invalid' : ''}`}>
                <input
                  id="brand-logo"
                  type="url"
                  value={formData.logoUrl || ''}
                  onChange={(e) => setFormData((prev) => ({ ...prev, logoUrl: e.target.value || null }))}
                  placeholder="https://ejemplo.com/logo.png"
                  aria-invalid={Boolean(errors.logoUrl)}
                  aria-describedby={errors.logoUrl ? fieldErrorId('logoUrl') : 'brand-logo-hint'}
                />
              </div>
              {errors.logoUrl ? (
                <span id={fieldErrorId('logoUrl')} className="field-error-text">
                  {errors.logoUrl}
                </span>
              ) : (
                <small id="brand-logo-hint" className="field-hint">
                  Enlace directo a imagen PNG, SVG o JPG
                </small>
              )}
            </div>

            <fieldset className="form-field catalog-form-fieldset">
              <legend>Estado de operación</legend>
              <label className="toggle-row-simple catalog-form-toggle">
                <input
                  type="checkbox"
                  checked={formData.isActive}
                  onChange={(e) => setFormData((prev) => ({ ...prev, isActive: e.target.checked }))}
                />
                <span>{formData.isActive ? 'Marca activa' : 'Marca inactiva'}</span>
              </label>
            </fieldset>
          </div>

          <footer className="dialog-footer form-drawer-footer">
            <button type="button" className="outline-button" onClick={onClose} disabled={isSubmitting}>
              Cancelar
            </button>
            <button type="submit" className="primary-button" disabled={isSubmitting} aria-busy={isSubmitting}>
              <AppIcon
                name={isSubmitting ? 'refresh' : 'save'}
                size={16}
                className={isSubmitting ? 'spin-animation' : ''}
              />
              <span>
                {isSubmitting ? 'Guardando...' : mode === 'create' ? 'Crear marca' : 'Guardar cambios'}
              </span>
            </button>
          </footer>
        </form>
      </aside>
    </div>,
    document.body
  )
}
