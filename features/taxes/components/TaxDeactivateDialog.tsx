'use client'

import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { AppIcon } from '@/components/ui/Icon'
import { TaxConfig } from '../types'

interface TaxDeactivateDialogProps {
  tax: TaxConfig | null
  isOpen: boolean
  onClose: () => void
  onConfirm: (id: string, reason: string) => Promise<void>
}

export function TaxDeactivateDialog({
  tax,
  isOpen,
  onClose,
  onConfirm,
}: TaxDeactivateDialogProps) {
  const [mounted, setMounted] = useState(false)
  const [reason, setReason] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (isOpen) {
      setReason('')
      setError(null)
    }
  }, [isOpen])

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

  if (!mounted || !isOpen || !tax) return null

  const handleDeactivate = async () => {
    if (!reason.trim()) {
      setError('Por favor indica un motivo o justificación para la desactivación.')
      return
    }

    try {
      setIsSubmitting(true)
      setError(null)
      await onConfirm(tax.id, reason.trim())
      onClose()
    } catch (err: any) {
      setError(err.message || 'Error al desactivar la configuración.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const dialogContent = (
    <div
      className="drawer-backdrop modal-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="deactivate-dialog-title"
    >
      <div
        className="product-card"
        style={{
          width: 'min(90vw, 480px)',
          padding: 24,
          background: '#fff',
          borderRadius: 14,
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
          cursor: 'default',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div
            style={{
              display: 'grid',
              placeItems: 'center',
              width: 40,
              height: 40,
              borderRadius: 10,
              background: '#fee2e2',
              color: 'var(--red)',
            }}
          >
            <AppIcon name="warning" size={20} />
          </div>
          <div>
            <h2 id="deactivate-dialog-title" style={{ margin: 0, fontSize: 16, color: 'var(--foreground)' }}>
              Desactivar Configuración Tributaria
            </h2>
            <small style={{ color: 'var(--muted)', fontSize: 11 }}>
              {tax.name} ({tax.code})
            </small>
          </div>
        </div>

        <div
          style={{
            padding: 12,
            borderRadius: 8,
            background: '#fffbeb',
            border: '1px solid #fde68a',
            color: '#92400e',
            fontSize: 11,
            lineHeight: 1.5,
            marginBottom: 16,
          }}
        >
          <strong>Protección de trazabilidad:</strong> La configuración no se eliminará del sistema. Permanecerá disponible para consultar auditorías y documentos históricos previos, pero no podrá ser asignada a nuevos productos ni facturaciones.
        </div>

        {error && (
          <div
            style={{
              padding: 10,
              borderRadius: 6,
              background: '#fef2f2',
              border: '1px solid #fecaca',
              color: 'var(--red)',
              fontSize: 11,
              marginBottom: 12,
            }}
          >
            {error}
          </div>
        )}

        <div className="input-field-block" style={{ marginBottom: 20 }}>
          <label htmlFor="deactivate-reason" style={{ display: 'block', fontSize: 11, fontWeight: 700, marginBottom: 6 }}>
            Motivo de desactivación <span style={{ color: 'var(--red)' }}>*</span>
          </label>
          <textarea
            id="deactivate-reason"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ej. Derogada por reforma tributaria, sustituida por nueva tarifa..."
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
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
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
            type="button"
            className="primary-button"
            onClick={handleDeactivate}
            disabled={isSubmitting}
            style={{ flex: 1, background: 'var(--red)', borderColor: 'var(--red)' }}
          >
            {isSubmitting ? 'Desactivando...' : 'Confirmar desactivación'}
          </button>
        </div>
      </div>
    </div>
  )

  return createPortal(dialogContent, document.body)
}
