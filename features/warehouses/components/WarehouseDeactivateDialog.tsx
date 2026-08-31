import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { AppIcon } from '@/components/ui/Icon'
import { LocationWithMetrics, WarehouseDeactivationCheck } from '../types'
import { warehouseService } from '../services/warehouse.service'

interface WarehouseDeactivateDialogProps {
  warehouse: LocationWithMetrics | null
  isOpen: boolean
  onClose: () => void
  onConfirm: (id: string) => Promise<void>
}

export function WarehouseDeactivateDialog({
  warehouse,
  isOpen,
  onClose,
  onConfirm,
}: WarehouseDeactivateDialogProps) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
  }, [])
  const [check, setCheck] = useState<WarehouseDeactivationCheck | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (warehouse && isOpen) {
      setIsLoading(true)
      setError(null)
      warehouseService
        .validateDeactivation(warehouse.id)
        .then((result) => {
          setCheck(result)
        })
        .catch((err) => {
          setError(err.message || 'Error al validar condiciones de desactivación')
        })
        .finally(() => {
          setIsLoading(false)
        })
    }
  }, [warehouse, isOpen])

  if (!isOpen || !warehouse || !mounted) return null

  const handleDeactivate = async () => {
    if (!check?.canDeactivate || isSubmitting) return

    try {
      setIsSubmitting(true)
      await onConfirm(warehouse.id)
      onClose()
    } catch (err: any) {
      setError(err.message || 'No se pudo desactivar la bodega.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return createPortal(
    <div className="drawer-backdrop modal-center" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className="deactivate-dialog-card page-enter"
        onClick={(e) => e.stopPropagation()}
        aria-labelledby="deactivate-dialog-title"
      >
        <div className="dialog-header-warning">
          <div className="warning-icon-badge">
            <AppIcon name="warning" size={24} />
          </div>
          <div>
            <h3 id="deactivate-dialog-title">Desactivar {warehouse.name}</h3>
            <span className="mono">{warehouse.code}</span>
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
          <p className="dialog-text-main">
            La bodega dejará de estar disponible para registrar nuevas ventas, compras o
            movimientos. <strong>Toda su información histórica y Kardex se conservará intacta.</strong>
          </p>

          {isLoading ? (
            <div className="dialog-loading-state">
              <div className="skeleton-box" style={{ width: '100%', height: 60 }} />
              <p>Verificando transferencias en tránsito y cajas abiertas...</p>
            </div>
          ) : error ? (
            <div className="form-error-banner" role="alert">
              <AppIcon name="warning" size={16} />
              <span>{error}</span>
            </div>
          ) : check && !check.canDeactivate ? (
            <div className="blocker-warning-box" role="alert">
              <div className="blocker-head">
                <AppIcon name="warning" size={18} />
                <strong>Operaciones críticas pendientes</strong>
              </div>
              <p>
                No es posible desactivar la bodega en este momento debido a las siguientes
                condiciones:
              </p>
              <ul>
                {check.blockingReasons.map((reason, idx) => (
                  <li key={idx}>{reason}</li>
                ))}
              </ul>
              <small>
                Finaliza o cancela estas operaciones antes de proceder con la desactivación.
              </small>
            </div>
          ) : (
            <div className="check-success-box">
              <AppIcon name="check" size={18} />
              <div>
                <strong>Validación exitosa</strong>
                <p>No existen transferencias activas ni cajas abiertas en esta sede.</p>
              </div>
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

          <button
            type="button"
            className="danger-button"
            disabled={!check?.canDeactivate || isSubmitting || isLoading}
            onClick={handleDeactivate}
          >
            <AppIcon name="powerOff" size={16} />
            <span>{isSubmitting ? 'Desactivando...' : 'Desactivar bodega'}</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
