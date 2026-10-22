'use client'

import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { AppIcon } from '@/components/ui/Icon'
import { CategoryWithRelations, CategoryDeleteCheck } from '../types'
import { categoryService } from '../services/category.service'
import { extractErrorMessage } from '@/lib/utils'

interface CategoryDeleteDialogProps {
  category: CategoryWithRelations | null
  isOpen: boolean
  onClose: () => void
  onConfirm: (id: string) => Promise<void>
  onDeactivateAlternative?: (category: CategoryWithRelations) => Promise<void>
}

export function CategoryDeleteDialog({
  category,
  isOpen,
  onClose,
  onConfirm,
  onDeactivateAlternative,
}: CategoryDeleteDialogProps) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
  }, [])

  const [check, setCheck] = useState<CategoryDeleteCheck | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (category && isOpen) {
      setIsLoading(true)
      setError(null)
      categoryService
        .validateCategoryDeletion(category.id)
        .then((result) => setCheck(result))
        .catch((err) => setError(extractErrorMessage(err, 'Error al validar dependencias de la categoría')))
        .finally(() => setIsLoading(false))
    }
  }, [category, isOpen])

  if (!isOpen || !category || !mounted) return null

  const handleDelete = async () => {
    if (!check?.canDelete || isSubmitting) return

    try {
      setIsSubmitting(true)
      await onConfirm(category.id)
      onClose()
    } catch (err: any) {
      setError(extractErrorMessage(err, 'No se pudo eliminar la categoría.'))
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeactivate = async () => {
    if (!onDeactivateAlternative || isSubmitting) return
    try {
      setIsSubmitting(true)
      await onDeactivateAlternative(category)
      onClose()
    } catch (err: any) {
      setError(extractErrorMessage(err, 'No se pudo desactivar la categoría.'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return createPortal(
    <div
      className="drawer-backdrop modal-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="deactivate-dialog-card page-enter"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '480px' }}
      >
        <div className={`dialog-header-warning ${!check?.canDelete ? 'dialog-header-blocked' : ''}`}>
          <div className="warning-icon-badge">
            <AppIcon name={check?.canDelete ? 'trash' : 'warning'} size={24} />
          </div>
          <div>
            <h3>Eliminar categoría</h3>
            <span className="mono">{category.name}</span>
          </div>
          <button
            type="button"
            className="icon-button close-dialog-btn"
            onClick={onClose}
            aria-label="Cerrar modal"
          >
            <AppIcon name="close" size={18} />
          </button>
        </div>

        <div className="dialog-body">
          {isLoading ? (
            <div className="dialog-loading-state">
              <div className="skeleton-line" style={{ height: 40 }} />
              <p>Verificando productos y subcategorías asociadas...</p>
            </div>
          ) : error ? (
            <div className="form-error-banner" role="alert">
              <AppIcon name="warning" size={16} />
              <span>{extractErrorMessage(error)}</span>
            </div>
          ) : !check?.canDelete ? (
            <div className="blocked-action-notice">
              <div className="blocked-explanation">
                <strong>No es posible eliminar esta categoría</strong>
                <p>{check?.reason}</p>
              </div>

              {category.isActive && onDeactivateAlternative && (
                <div className="alternative-action-box">
                  <p>
                    Recomendación: Puedes <strong>desactivar</strong> la categoría para ocultarla de nuevos
                    registros comerciales sin romper la trazabilidad de los productos existentes.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="confirm-delete-notice">
              <p className="dialog-text-main">
                ¿Estás seguro de que deseas eliminar permanentemente la categoría{' '}
                <strong>{category.name}</strong>?
              </p>
              <p className="delete-irreversible-note">
                <AppIcon name="warning" size={15} />
                <span>Esta acción no se puede deshacer.</span>
              </p>
            </div>
          )}
        </div>

        <div className="dialog-footer">
          <button
            type="button"
            className="outline-button"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancelar
          </button>

          {!check?.canDelete && category.isActive && onDeactivateAlternative && (
            <button
              type="button"
              className="warning-button"
              onClick={handleDeactivate}
              disabled={isSubmitting}
            >
              <AppIcon name="powerOff" size={16} />
              <span>Desactivar en su lugar</span>
            </button>
          )}

          {check?.canDelete && (
            <button
              type="button"
              className="danger-button"
              onClick={handleDelete}
              disabled={isSubmitting || isLoading}
            >
              {isSubmitting ? (
                <>
                  <AppIcon name="refresh" size={16} className="spin" />
                  <span>Eliminando...</span>
                </>
              ) : (
                <>
                  <AppIcon name="trash" size={16} />
                  <span>Sí, eliminar categoría</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
