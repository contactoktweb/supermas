'use client'

import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { AppIcon } from '@/components/ui/Icon'
import { WebOrder } from '../../types'

interface WebOrderDispatchModalProps {
  isOpen: boolean
  order: WebOrder | null
  onClose: () => void
  onConfirmDispatch: (
    orderId: string,
    data: { courier: string; trackingNumber: string; deliveryNotes?: string }
  ) => Promise<any>
}

export function WebOrderDispatchModal({
  isOpen,
  order,
  onClose,
  onConfirmDispatch,
}: WebOrderDispatchModalProps) {
  const [mounted, setMounted] = useState(false)
  const [courier, setCourier] = useState('Coordinadora Mercantil')
  const [trackingNumber, setTrackingNumber] = useState('')
  const [deliveryNotes, setDeliveryNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen || !order || !mounted) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!courier.trim()) {
      setError('Debes especificar la empresa transportadora o medio de entrega.')
      return
    }
    if (!trackingNumber.trim()) {
      setError('Debes ingresar el número de guía o tracking de despacho.')
      return
    }

    try {
      setSubmitting(true)
      setError(null)
      await onConfirmDispatch(order.id, {
        courier,
        trackingNumber,
        deliveryNotes: deliveryNotes.trim() || undefined,
      })
      onClose()
    } catch (err: any) {
      setError(err.message || 'Error al despachar el pedido.')
    } finally {
      setSubmitting(false)
    }
  }

  return createPortal(
    <div className="drawer-backdrop modal-center" onClick={onClose}>
      <div
        className="modal-card animate-scale-up"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(100% - 32px, 480px)',
          background: '#ffffff',
          borderRadius: 14,
          boxShadow: '0 20px 60px rgba(10, 24, 48, 0.25)',
          overflow: 'hidden',
          animation: 'fade .2s ease',
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dispatch-modal-title"
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center shadow-2xs">
              <AppIcon name="transfers" size={20} />
            </div>
            <div>
              <h2 id="dispatch-modal-title" className="text-base font-bold text-slate-900 m-0">Despacho de Mercancía</h2>
              <p className="text-xs text-slate-500 m-0">Pedido {order.orderNumber}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 transition-colors"
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

          <div className="p-3.5 rounded-xl bg-sky-50 border border-sky-200 text-xs text-sky-900 leading-relaxed">
            <p className="font-bold mb-1">Impacto en el Sistema:</p>
            Al confirmar el despacho, el sistema:
            <ul className="list-disc pl-4 mt-1 space-y-0.5 text-[11px]">
              <li>Registrará la salida física del inventario desde <strong>{order.assignedLocationName}</strong>.</li>
              <li>Generará automáticamente el documento de <strong>Venta oficial</strong> en el ERP.</li>
              <li>Actualizará el estado a <strong>ENVIADO</strong> con trazabilidad en auditoría.</li>
            </ul>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700">Transportadora o Medio de Despacho *</label>
            <select
              value={courier}
              onChange={(e) => setCourier(e.target.value)}
              className="w-full text-xs p-2.5 rounded-lg border border-slate-200 bg-white"
            >
              <option value="Coordinadora Mercantil">Coordinadora Mercantil</option>
              <option value="Servientrega">Servientrega</option>
              <option value="Envía Colvanes">Envía Colvanes</option>
              <option value="Inter Rapidísimo">Inter Rapidísimo</option>
              <option value="Vehículo Propio CEDI Super Más">Vehículo Propio CEDI Super Más</option>
              <option value="Entrega en Punto / Tienda">Entrega en Punto / Tienda</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700">Número de Guía o Tracking *</label>
            <input
              type="text"
              placeholder="Ej: ENV-2026-99841 o Guía #10293847"
              value={trackingNumber}
              onChange={(e) => setTrackingNumber(e.target.value)}
              className="w-full text-xs p-2.5 rounded-lg border border-slate-200"
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700">Observaciones del Despacho (Opcional)</label>
            <textarea
              rows={2}
              placeholder="Notas para el conductor o número de bultos..."
              value={deliveryNotes}
              onChange={(e) => setDeliveryNotes(e.target.value)}
              className="w-full text-xs p-2.5 rounded-lg border border-slate-200 resize-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <button type="button" onClick={onClose} className="outline-button text-xs py-2 px-4">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 rounded-lg bg-sky-600 text-white font-semibold text-xs hover:bg-sky-700 disabled:opacity-50 transition-colors flex items-center gap-1.5 shadow-xs"
            >
              <AppIcon name="transfers" size={15} />
              <span>{submitting ? 'Despachando...' : 'Confirmar Despacho y Generar Venta'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}
