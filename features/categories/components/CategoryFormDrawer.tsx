'use client'

import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { AppIcon } from '@/components/ui/Icon'
import { CategoryWithRelations } from '../types'
import { categoryFormSchema, CategoryFormData, slugify } from '../schemas/category.schema'
import { categoryService, CategorySelectOption } from '../services/category.service'
import { CustomSelect } from '@/components/ui/CustomSelect'
import { extractErrorMessage } from '@/lib/utils'

interface CategoryFormDrawerProps {
  mode: 'create' | 'edit'
  category?: CategoryWithRelations | null
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: CategoryFormData) => Promise<void>
}

export function CategoryFormDrawer({
  mode,
  category,
  isOpen,
  onClose,
  onSubmit,
}: CategoryFormDrawerProps) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
  }, [])

  const [formData, setFormData] = useState<CategoryFormData>({
    name: '',
    code: '',
    slug: '',
    description: '',
    parentId: null,
    isActive: true,
    sortOrder: 0,
  })

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [parentOptions, setParentOptions] = useState<CategorySelectOption[]>([])
  const [isLoadingParents, setIsLoadingParents] = useState(false)
  const [autoSlug, setAutoSlug] = useState(true)

  // Cargar opciones para selector de categoría padre
  useEffect(() => {
    if (isOpen) {
      setIsLoadingParents(true)
      categoryService
        .getParentSelectOptions(category?.id)
        .then((options) => setParentOptions(options))
        .catch((err) => console.error('Error cargando categorías padre:', err))
        .finally(() => setIsLoadingParents(false))
    }
  }, [isOpen, category])

  // Cargar o limpiar datos al abrir
  useEffect(() => {
    if (category && mode === 'edit') {
      setFormData({
        name: category.name,
        code: category.code || '',
        slug: category.slug,
        description: category.description || '',
        parentId: category.parentId || null,
        isActive: category.isActive,
        sortOrder: category.sortOrder,
      })
      setAutoSlug(false)
    } else {
      setFormData({
        name: '',
        code: '',
        slug: '',
        description: '',
        parentId: null,
        isActive: true,
        sortOrder: 0,
      })
      setAutoSlug(true)
    }
    setErrors({})
  }, [category, mode, isOpen])

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

    const result = categoryFormSchema.safeParse(formData)
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
      setErrors({ form: extractErrorMessage(err, 'Error al guardar la categoría') })
    } finally {
      setIsSubmitting(false)
    }
  }

  const selectParentOptions = [
    { value: '', label: 'Categoría principal (nivel raíz)' },
    ...parentOptions.map((opt) => ({
      value: opt.value,
      label: opt.label,
      badge: opt.code || undefined,
    })),
  ]

  const fieldErrorId = (field: string) => `cat-${field}-error`

  return createPortal(
    <div className="drawer-backdrop" onClick={() => !isSubmitting && onClose()}>
      <aside
        className="product-drawer product-form-drawer catalog-form-drawer page-enter"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="category-form-title"
      >
        <header className="drawer-header catalog-form-header">
          <div className="catalog-form-title">
            <span className="stat-icon blue" aria-hidden="true">
              <AppIcon name={mode === 'create' ? 'plus' : 'edit'} size={20} />
            </span>
            <div>
              <span className="product-category-eyebrow">
                {mode === 'create' ? 'Nueva categoría' : 'Editar categoría'}
              </span>
              <h2 id="category-form-title">
                {mode === 'create' ? 'Crear categoría de productos' : formData.name || 'Editar categoría'}
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
              <label htmlFor="cat-name">
                Nombre de la categoría <em>*</em>
              </label>
              <div className={`input-wrap ${errors.name ? 'is-invalid' : ''}`}>
                <input
                  id="cat-name"
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="Ej: Lácteos, Bebidas, Aseo..."
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

            <div className="form-grid-2">
              <div className="form-field">
                <label htmlFor="cat-code">Código interno</label>
                <div className={`input-wrap ${errors.code ? 'is-invalid' : ''}`}>
                  <input
                    id="cat-code"
                    type="text"
                    value={formData.code || ''}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        code: e.target.value.toUpperCase().replace(/\s+/g, '-'),
                      }))
                    }
                    placeholder="Ej: CAT-LAC"
                    aria-invalid={Boolean(errors.code)}
                    aria-describedby={errors.code ? fieldErrorId('code') : undefined}
                  />
                </div>
                {errors.code && (
                  <span id={fieldErrorId('code')} className="field-error-text">
                    {errors.code}
                  </span>
                )}
              </div>

              <div className="form-field">
                <label htmlFor="cat-slug">
                  Slug (URL amigable) <em>*</em>
                </label>
                <div className={`input-wrap ${errors.slug ? 'is-invalid' : ''}`}>
                  <input
                    id="cat-slug"
                    type="text"
                    value={formData.slug}
                    onChange={(e) => handleSlugChange(e.target.value)}
                    placeholder="lacteos"
                    aria-invalid={Boolean(errors.slug)}
                    aria-describedby={errors.slug ? fieldErrorId('slug') : 'cat-slug-hint'}
                  />
                </div>
                {errors.slug ? (
                  <span id={fieldErrorId('slug')} className="field-error-text">
                    {errors.slug}
                  </span>
                ) : (
                  <small id="cat-slug-hint" className="field-hint">
                    Se genera automáticamente a partir del nombre.
                  </small>
                )}
              </div>
            </div>

            <div className="form-field">
              <label htmlFor="cat-parent">Categoría padre (jerarquía)</label>
              <CustomSelect
                id="cat-parent"
                value={formData.parentId || ''}
                onChange={(val) => setFormData((prev) => ({ ...prev, parentId: val || null }))}
                options={selectParentOptions}
                placeholder={isLoadingParents ? 'Cargando categorías...' : 'Selecciona una categoría padre'}
                disabled={isLoadingParents}
                error={errors.parentId}
              />
              {errors.parentId ? (
                <span className="field-error-text">{errors.parentId}</span>
              ) : (
                <small className="field-hint">
                  Si seleccionas una categoría padre, esta se convertirá en una subcategoría anidada.
                </small>
              )}
            </div>

            <div className="form-field">
              <label htmlFor="cat-desc">Descripción</label>
              <textarea
                id="cat-desc"
                rows={3}
                value={formData.description || ''}
                onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Breve detalle sobre los productos incluidos en esta clasificación..."
                className="custom-form-textarea"
                aria-invalid={Boolean(errors.description)}
                aria-describedby={errors.description ? fieldErrorId('description') : undefined}
              />
              {errors.description && (
                <span id={fieldErrorId('description')} className="field-error-text">
                  {errors.description}
                </span>
              )}
            </div>

            <div className="form-grid-2">
              <div className="form-field">
                <label htmlFor="cat-sort">Orden visual</label>
                <div className={`input-wrap ${errors.sortOrder ? 'is-invalid' : ''}`}>
                  <input
                    id="cat-sort"
                    type="number"
                    min={0}
                    value={formData.sortOrder}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, sortOrder: parseInt(e.target.value, 10) || 0 }))
                    }
                    aria-describedby="cat-sort-hint"
                  />
                </div>
                {errors.sortOrder ? (
                  <span className="field-error-text">{errors.sortOrder}</span>
                ) : (
                  <small id="cat-sort-hint" className="field-hint">
                    0 = prioridad normal en listas
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
                  <span>{formData.isActive ? 'Categoría activa' : 'Categoría inactiva'}</span>
                </label>
              </fieldset>
            </div>
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
                {isSubmitting ? 'Guardando...' : mode === 'create' ? 'Crear categoría' : 'Guardar cambios'}
              </span>
            </button>
          </footer>
        </form>
      </aside>
    </div>,
    document.body
  )
}
