'use client'

import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { AppIcon } from '@/components/ui/Icon'
import { WebOrder, WebOrderSalePayment } from '../../types'
import { webOrderService } from '../../services/web-order.service'
import { SelectField } from '@/components/ui/SelectField'

interface WebOrderDispatchModalProps {
  isOpen: boolean
  order: WebOrder | null
  onClose: () => void
  onConfirmDispatch: (
    orderId: string,
    data: { courier: string; trackingNumber: string; deliveryNotes?: string },
    payment: WebOrderSalePayment
  ) => Promise<unknown>
}

type SalePaymentMethod = WebOrderSalePayment['paymentMethod']

const PAYMENT_OPTIONS: Array<{ id: SalePaymentMethod; label: string }> = [
  { id: 'TRANSFERENCIA', label: 'Transferencia' },
  { id: 'TARJETA', label: 'Tarjeta' },
  { id: 'EFECTIVO', label: 'Efectivo (contraentrega)' },
  { id: 'CREDITO', label: 'Crédito' },
]

const formatCOP = (amount: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(amount)

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
  const [paymentMethod, setPaymentMethod] = useState<SalePaymentMethod>('TRANSFERENCIA')
  const [bankAccountId, setBankAccountId] = useState('')
  const [bankOptions, setBankOptions] = useState<Array<{ id: string; label: string }>>([])
  const [banksLoading, setBanksLoading] = useState(false)
  const [banksError, setBanksError] = useState<string | null>(null)
  // Una clave por pedido abierto: si la respuesta se pierde, reintentar no duplica la venta.
  const [idempotencyKey, setIdempotencyKey] = useState<string>(() => crypto.randomUUID())

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!isOpen || !order) return
    setIdempotencyKey(crypto.randomUUID())
    setError(null)
  }, [isOpen, order?.id])

  useEffect(() => {
    if (!isOpen) return
    let active = true
    setBanksLoading(true)
    setBanksError(null)
    webOrderService
      .listPaymentBankAccounts()
      .then((accounts) => {
        if (!active) return
        setBankOptions(accounts)
        setBankAccountId((current) => current || accounts[0]?.id || '')
      })
      .catch((err: unknown) => {
        if (active) setBanksError(err instanceof Error ? err.message : 'No se pudieron cargar las cuentas bancarias.')
      })
      .finally(() => {
        if (active) setBanksLoading(false)
      })
    return () => {
      active = false
    }
  }, [isOpen])

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

  const needsBankAccount = paymentMethod === 'TRANSFERENCIA' || paymentMethod === 'TARJETA'

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
    if (needsBankAccount && !bankAccountId) {
      setError('Selecciona la cuenta bancaria que recibió el pago del pedido.')
      return
    }

    try {
      setSubmitting(true)
      setError(null)
      await onConfirmDispatch(
        order.id,
        {
          courier,
          trackingNumber,
          deliveryNotes: deliveryNotes.trim() || undefined,
        },
        {
          paymentMethod,
          bankAccountId: needsBankAccount ? bankAccountId : undefined,
          idempotencyKey,
        }
      )
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al despachar el pedido.')
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
            aria-label="Cerrar"
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
              <li>Registrará la <strong>Venta oficial</strong> con los precios vigentes del catálogo, su pago y su asiento contable.</li>
              <li>Actualizará el estado a <strong>ENVIADO</strong> con trazabilidad en auditoría.</li>
            </ul>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700">Transportadora o Medio de Despacho *</label>
            <SelectField
              value={courier}
              className="w-full"
              size="sm"
              onChange={(value) => setCourier(value)}
            >
              <option value="Coordinadora Mercantil">Coordinadora Mercantil</option>
              <option value="Servientrega">Servientrega</option>
              <option value="Envía Colvanes">Envía Colvanes</option>
              <option value="Inter Rapidísimo">Inter Rapidísimo</option>
              <option value="Vehículo Propio CEDI Super Más">Vehículo Propio CEDI Super Más</option>
              <option value="Entrega en Punto / Tienda">Entrega en Punto / Tienda</option>
            </SelectField>
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

          <fieldset className="space-y-2 p-3.5 rounded-xl border border-slate-200 bg-slate-50/60">
            <legend className="text-xs font-bold text-slate-700 px-1">Pago de la venta *</legend>
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Medio de pago de la venta">
              {PAYMENT_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  role="radio"
                  aria-checked={paymentMethod === opt.id}
                  onClick={() => setPaymentMethod(opt.id)}
                  className={`text-xs py-2 px-2.5 rounded-lg border transition-colors ${
                    paymentMethod === opt.id
                      ? 'border-sky-600 bg-sky-50 text-sky-800 font-semibold'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {needsBankAccount && (
              <div className="space-y-1.5">
                <label htmlFor="dispatch-bank-account" className="text-xs font-bold text-slate-700">
                  Cuenta bancaria que recibió el pago *
                </label>
                {banksLoading ? (
                  <div className="h-9 rounded-lg bg-slate-200/70 animate-pulse" aria-label="Cargando cuentas bancarias" />
                ) : banksError ? (
                  <p className="text-xs text-rose-700 m-0">{banksError}</p>
                ) : bankOptions.length === 0 ? (
                  <p className="text-xs text-amber-800 m-0">
                    No hay cuentas bancarias con cuenta contable asignada. Configúrelas en Tesorería.
                  </p>
                ) : (
                  <SelectField
                    id="dispatch-bank-account"
                    value={bankAccountId}
                    className="w-full"
                    size="sm"
                    onChange={(value) => setBankAccountId(value)}
                  >
                    {bankOptions.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.label}
                      </option>
                    ))}
                  </SelectField>
                )}
              </div>
            )}

            {paymentMethod === 'EFECTIVO' && (
              <p className="text-[11px] text-slate-600 m-0">
                El efectivo entra a su caja abierta en {order.assignedLocationName}.
              </p>
            )}
            {paymentMethod === 'CREDITO' && (
              <p className="text-[11px] text-slate-600 m-0">
                Se carga a la cartera del cliente registrado, dentro de su cupo de crédito.
              </p>
            )}
            {order.shippingCost > 0 && (
              <p className="text-[11px] text-slate-600 m-0">
                El envío ({formatCOP(order.shippingCost)}) no hace parte de la venta.
              </p>
            )}
          </fieldset>

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
              disabled={submitting || (needsBankAccount && (banksLoading || bankOptions.length === 0))}
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
