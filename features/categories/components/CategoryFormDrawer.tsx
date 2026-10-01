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
    } catch (err: any) {
      setErrors({ form: extractErrorMessage(err, 'Error al guardar la categoría') })
    } finally {
      setIsSubmitting(false)
    }
  }

  const selectParentOptions = [
    { value: '', label: '📂 Categoría principal (Nivel raíz)' },
    ...parentOptions.map((opt) => ({
      value: opt.value,
      label: opt.label,
      badge: opt.code || undefined,
    })),
  ]

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
        style={{ maxWidth: '540px' }}
      >
        <div className="drawer-header">
          <div>
            <span className="badge badge-accent">
              {mode === 'create' ? 'Nueva Categoría' : 'Editar Categoría'}
            </span>
            <h2 className="drawer-title">
              {mode === 'create' ? 'Crear categoría de productos' : formData.name || 'Editar categoría'}
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
                <span>{extractErrorMessage(errors.form)}</span>
              </div>
            )}

            <div className="input-field-block">
              <label htmlFor="cat-name">
                Nombre de la categoría <span className="req">*</span>
              </label>
              <div className="input-wrap">
                <input
                  id="cat-name"
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="Ej: Lácteos, Bebidas, Aseo..."
                  autoFocus
                />
              </div>
              {errors.name && <span className="field-error">{errors.name}</span>}
            </div>

            <div className="form-grid-2">
              <div className="input-field-block">
                <label htmlFor="cat-code">Código interno</label>
                <div className="input-wrap">
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
                    className="mono"
                  />
                </div>
                {errors.code && <span className="field-error">{errors.code}</span>}
              </div>

              <div className="input-field-block">
                <label htmlFor="cat-slug">
                  Slug (URL amigable) <span className="req">*</span>
                </label>
                <div className="input-wrap">
                  <input
                    id="cat-slug"
                    type="text"
                    value={formData.slug}
                    onChange={(e) => handleSlugChange(e.target.value)}
                    placeholder="lacteos"
                    className="mono"
                  />
                </div>
                {errors.slug && <span className="field-error">{errors.slug}</span>}
              </div>
            </div>

            <div className="input-field-block">
              <label htmlFor="cat-parent">Categoría padre (Jerarquía)</label>
              <CustomSelect
                id="cat-parent"
                value={formData.parentId || ''}
                onChange={(val) => setFormData((prev) => ({ ...prev, parentId: val || null }))}
                options={selectParentOptions}
                placeholder={isLoadingParents ? 'Cargando categorías...' : 'Selecciona una categoría padre'}
                disabled={isLoadingParents}
              />
              <span className="field-helper">
                Si seleccionas una categoría padre, esta se convertirá en una subcategoría anidada.
              </span>
              {errors.parentId && <span className="field-error">{errors.parentId}</span>}
            </div>

            <div className="input-field-block">
              <label htmlFor="cat-desc">Descripción</label>
              <textarea
                id="cat-desc"
                rows={3}
                value={formData.description || ''}
                onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Breve detalle sobre los productos incluidos en esta clasificación..."
                className="styled-textarea"
              />
              {errors.description && <span className="field-error">{errors.description}</span>}
            </div>

            <div className="form-grid-2">
              <div className="input-field-block">
                <label htmlFor="cat-sort">Orden visual</label>
                <div className="input-wrap">
                  <input
                    id="cat-sort"
                    type="number"
                    min={0}
                    value={formData.sortOrder}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, sortOrder: parseInt(e.target.value, 10) || 0 }))
                    }
                  />
                </div>
                <span className="field-helper">0 = prioridad normal en listas</span>
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
                    <span>{formData.isActive ? 'Categoría Activa' : 'Categoría Inactiva'}</span>
                  </label>
                </div>
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
                  <span>{mode === 'create' ? 'Crear Categoría' : 'Guardar Cambios'}</span>
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
