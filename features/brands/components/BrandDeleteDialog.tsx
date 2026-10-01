'use client'

import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { AppIcon } from '@/components/ui/Icon'
import { BrandWithRelations, BrandDeleteCheck } from '../types'
import { brandService } from '../services/brand.service'
import { extractErrorMessage } from '@/lib/utils'

interface BrandDeleteDialogProps {
  brand: BrandWithRelations | null
  isOpen: boolean
  onClose: () => void
  onConfirm: (id: string) => Promise<void>
  onDeactivateAlternative?: (brand: BrandWithRelations) => Promise<void>
}

export function BrandDeleteDialog({
  brand,
  isOpen,
  onClose,
  onConfirm,
  onDeactivateAlternative,
}: BrandDeleteDialogProps) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
  }, [])

  const [check, setCheck] = useState<BrandDeleteCheck | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (brand && isOpen) {
      setIsLoading(true)
      setError(null)
      brandService
        .validateBrandDeletion(brand.id)
        .then((result) => setCheck(result))
        .catch((err) => setError(extractErrorMessage(err, 'Error al validar dependencias de la marca')))
        .finally(() => setIsLoading(false))
    }
  }, [brand, isOpen])

  if (!isOpen || !brand || !mounted) return null

  const handleDelete = async () => {
    if (!check?.canDelete || isSubmitting) return

    try {
      setIsSubmitting(true)
      await onConfirm(brand.id)
      onClose()
    } catch (err: any) {
      setError(extractErrorMessage(err, 'No se pudo eliminar la marca.'))
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeactivate = async () => {
    if (!onDeactivateAlternative || isSubmitting) return
    try {
      setIsSubmitting(true)
      await onDeactivateAlternative(brand)
      onClose()
    } catch (err: any) {
      setError(extractErrorMessage(err, 'No se pudo desactivar la marca.'))
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
            <h3>Eliminar Marca</h3>
            <span className="mono">{brand.name}</span>
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
              <p>Verificando productos asociados a la marca...</p>
            </div>
          ) : error ? (
            <div className="form-error-banner" role="alert">
              <AppIcon name="warning" size={16} />
              <span>{extractErrorMessage(error)}</span>
            </div>
          ) : !check?.canDelete ? (
            <div className="blocked-action-notice">
              <div className="blocked-explanation">
                <strong>No es posible eliminar esta marca</strong>
                <p>{check?.reason}</p>
              </div>

              {brand.isActive && onDeactivateAlternative && (
                <div className="alternative-action-box">
                  <p>
                    Recomendación: Puedes <strong>desactivar</strong> la marca para que no aparezca en nuevas
                    creaciones de productos, manteniendo el historial de inventario.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="confirm-delete-notice">
              <p className="dialog-text-main">
                ¿Estás seguro de que deseas eliminar permanentemente la marca{' '}
                <strong>{brand.name}</strong>?
              </p>
              <p className="field-helper">
                Esta acción es irreversible y eliminará el registro de la base de datos.
              </p>
            </div>
          )}
        </div>

        <div className="dialog-footer">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancelar
          </button>

          {!check?.canDelete && brand.isActive && onDeactivateAlternative && (
            <button
              type="button"
              className="btn btn-warning icon-button-text"
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
              className="btn btn-danger icon-button-text"
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
                  <span>Confirmar Eliminación</span>
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
