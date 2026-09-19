'use client'

import React, { useState } from 'react'
import { AppIcon } from '@/components/ui/Icon'
import { WebOrder } from '../../types'

interface WebOrderCancelModalProps {
  isOpen: boolean
  order: WebOrder | null
  onClose: () => void
  onConfirmCancel: (orderId: string, reason: string) => Promise<any>
}

export function WebOrderCancelModal({
  isOpen,
  order,
  onClose,
  onConfirmCancel,
}: WebOrderCancelModalProps) {
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen || !order) return null

  const hasReservation = ['CONFIRMED', 'PREPARING', 'READY_TO_DISPATCH'].includes(order.status)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (reason.trim().length < 5) {
      setError('El motivo de cancelación debe contener al menos 5 caracteres.')
      return
    }

    try {
      setSubmitting(true)
      setError(null)
      await onConfirmCancel(order.id, reason.trim())
      onClose()
    } catch (err: any) {
      setError(err.message || 'Error al cancelar el pedido.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="drawer-backdrop modal-center" onClick={onClose}>
      <div
        className="modal-card animate-scale-up"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 460,
          background: '#ffffff',
          borderRadius: 14,
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div className="p-5 border-b border-rose-100 bg-rose-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center">
              <AppIcon name="close" size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-rose-950 m-0">Cancelar Pedido Web</h2>
              <p className="text-xs text-rose-700 m-0">{order.orderNumber}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-rose-400 hover:text-rose-600 hover:bg-rose-200/50"
          >
            <AppIcon name="close" size={16} />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs">
              {error}
            </div>
          )}

          <div className="p-3.5 rounded-xl bg-rose-50/70 border border-rose-200 text-xs text-rose-900 leading-relaxed">
            <p className="font-bold mb-1">Políticas de Cancelación:</p>
            El pedido no será borrado físicamente para preservar la trazabilidad contable y de auditoría.
            {hasReservation && (
              <span className="block mt-1 font-semibold text-rose-800">
                ✓ Se liberará automáticamente la reserva de stock en Bodega CEDI ({order.totalUnits} unidades).
              </span>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700">
              Motivo obligatorio de cancelación *
            </label>
            <textarea
              rows={3}
              placeholder="Ej: Cliente solicitó anulación por error en dirección o falta de pago..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full text-xs p-3 rounded-lg border border-slate-200 focus:border-rose-500 focus:ring-1 focus:ring-rose-500 outline-none resize-none"
              required
            />
            <span className="text-[10px] text-slate-400">Mínimo 5 caracteres. Se guardará en auditoría.</span>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <button type="button" onClick={onClose} className="outline-button text-xs py-2 px-4">
              Volver
            </button>
            <button
              type="submit"
              disabled={submitting || reason.trim().length < 5}
              className="px-4 py-2 rounded-lg bg-rose-600 text-white font-semibold text-xs hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
            >
              <AppIcon name="close" size={14} />
              <span>{submitting ? 'Cancelando...' : 'Confirmar Cancelación'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
