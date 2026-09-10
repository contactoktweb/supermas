'use client'

import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { AppIcon } from '@/components/ui/Icon'
import { Supplier } from '../types'

interface SupplierDeactivateModalProps {
  supplier: Supplier | null
  isOpen: boolean
  onClose: () => void
  onConfirm: (supplierId: string) => Promise<void>
}

export function SupplierDeactivateModal({
  supplier,
  isOpen,
  onClose,
  onConfirm,
}: SupplierDeactivateModalProps) {
  const [mounted, setMounted] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (supplier) setError(null)
  }, [supplier])

  if (!isOpen || !supplier || !mounted) return null

  const handleConfirm = async () => {
    setError(null)
    setIsSubmitting(true)
    try {
      await onConfirm(supplier.id)
      onClose()
    } catch (err: any) {
      setError(err.message || 'Error al desactivar el proveedor.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const hasPendingBalance = (supplier.currentBalance || 0) > 0

  return createPortal(
    <div
      className="drawer-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="deactivate-modal-title"
    >
      <div
        className="product-drawer product-detail-drawer page-enter"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 480, width: '92vw' }}
      >
        {/* Header */}
        <div className="drawer-header" style={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              className="stat-icon red"
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                background: '#fef2f2',
                color: '#dc2626',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <AppIcon name="warning" size={20} />
            </div>
            <div>
              <span className="product-category-eyebrow">
                Gestión Comercial
              </span>
              <h3
                id="deactivate-modal-title"
                style={{
                  margin: 0,
                  fontSize: 16,
                  fontWeight: 800,
                  color: 'var(--navy)',
                }}
              >
                Desactivar Proveedor
              </h3>
            </div>
          </div>
          <button
            type="button"
            className="drawer-close-btn"
            onClick={onClose}
            aria-label="Cerrar modal"
          >
            <AppIcon name="close" size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="drawer-body" style={{ padding: 20 }}>
          {error && (
            <div
              className="incident-alert-banner page-enter"
              style={{
                background: '#fef2f2',
                borderColor: '#fca5a5',
                padding: '10px 14px',
                borderRadius: 8,
                marginBottom: 14,
                color: '#dc2626',
                fontSize: 12,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <AppIcon name="warning" size={16} />
              <span>{error}</span>
            </div>
          )}

          <p style={{ margin: '0 0 14px', fontSize: 13, color: 'var(--text-main)' }}>
            ¿Está seguro de desactivar al proveedor{' '}
            <strong>{supplier.businessName || supplier.supplierName}</strong> (NIT{' '}
            {supplier.documentNumber || supplier.nit})?
          </p>

          {hasPendingBalance ? (
            <div
              style={{
                padding: 12,
                background: '#fef2f2',
                borderRadius: 8,
                border: '1px solid #fecaca',
                color: '#991b1b',
                fontSize: 12,
                marginBottom: 16,
              }}
            >
              <strong>Bloqueo por obligación activa:</strong>
              <p style={{ margin: '4px 0 0' }}>
                El proveedor posee un saldo pendiente de{' '}
                <strong>
                  ${supplier.currentBalance.toLocaleString('es-CO')}
                </strong>
                . El sistema no permite desactivar proveedores con cuentas por pagar abiertas.
              </p>
            </div>
          ) : (
            <div
              style={{
                padding: 12,
                background: '#fffbeb',
                borderRadius: 8,
                border: '1px solid #fef3c7',
                color: '#b45309',
                fontSize: 12,
                marginBottom: 16,
              }}
            >
              <strong>Regla de preservación histórica:</strong>
              <p style={{ margin: '4px 0 0' }}>
                El proveedor no será eliminado físicamente. Continuará visible en
                compras históricas, reportes contables y Kardex, pero no podrá
                recibir nuevas órdenes de compra hasta ser reactivado.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="drawer-footer"
          style={{
            padding: '14px 20px',
            borderTop: '1px solid var(--border)',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 10,
            background: '#fff',
          }}
        >
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
            className="primary-button"
            onClick={handleConfirm}
            disabled={isSubmitting || hasPendingBalance}
            style={{ background: '#dc2626', borderColor: '#dc2626' }}
          >
            <AppIcon name="close" size={14} />
            <span>{isSubmitting ? 'Desactivando...' : 'Confirmar Desactivación'}</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
