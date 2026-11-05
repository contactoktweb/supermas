'use client'

import React, { useEffect, useRef, useState } from 'react'
import { POSTicketReceipt } from '../types'
import { AppIcon } from '@/components/ui/Icon'
import { customerReceiptHref, CustomerReceiptData } from '@/features/customer-receipt'
import { customerReceiptService } from '@/features/customer-receipt/services/customer-receipt.service'
import { getRuntimeSettings } from '@/features/settings/services/runtime-settings'
import { POSThermalTicket } from './ticket/POSThermalTicket'
import { posThermalTicketStyles } from './ticket/posThermalTicketStyles'
import { printThermalTicket } from '../utils/print-thermal-ticket'
import { dianApiClient } from '@/features/invoices/services/dian-api.client'

interface POSTicketReceiptModalProps {
  isOpen: boolean
  onClose: () => void
  receipt: POSTicketReceipt | null
}

type TicketState =
  | { status: 'invoicing' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: CustomerReceiptData; invoiceError: string | null }

export const POSTicketReceiptModal: React.FC<POSTicketReceiptModalProps> = ({
  isOpen,
  onClose,
  receipt,
}) => {
  const ticketRef = useRef<HTMLDivElement>(null)
  const [state, setState] = useState<TicketState>({ status: 'loading' })
  const saleId = receipt?.saleId ?? null
  const cashReceived = receipt?.paymentMethod === 'EFECTIVO' ? receipt.amountPaid : undefined

  const [attempt, setAttempt] = useState(0)

  // Cada venta del POS se factura electrónicamente; luego la tirilla se arma con los datos guardados
  // de la venta y su documento DIAN (resolución, CUFE y QR). Si la factura falla, sale el tiquete normal.
  useEffect(() => {
    if (!isOpen || !saleId) return
    let alive = true
    const build = async () => {
      setState({ status: 'invoicing' })
      let invoiceError: string | null = null
      try {
        await dianApiClient.emitPosSale(saleId)
      } catch (e: unknown) {
        invoiceError = e instanceof Error ? e.message : 'No se pudo emitir la factura electrónica.'
      }
      if (!alive) return
      setState({ status: 'loading' })
      const data = await customerReceiptService.getBySaleId(saleId, { cashReceived })
      if (!alive) return
      setState(data ? { status: 'ready', data, invoiceError } : { status: 'error', message: 'No se encontró la venta para armar la tirilla.' })
    }
    build().catch((e: unknown) => {
      if (alive) setState({ status: 'error', message: e instanceof Error ? e.message : 'No se pudo cargar la tirilla.' })
    })
    return () => {
      alive = false
    }
  }, [isOpen, saleId, cashReceived, attempt])

  const handlePrint = () => {
    if (ticketRef.current) void printThermalTicket(ticketRef.current)
  }

  // Configuración → Punto de Venta: impresión automática de la tirilla al cobrar.
  const isReady = state.status === 'ready'
  useEffect(() => {
    if (!isOpen || !isReady) return
    let cancelled = false
    getRuntimeSettings().then((settings) => {
      if (!cancelled && settings.pos.autoPrintReceipt && ticketRef.current) void printThermalTicket(ticketRef.current)
    })
    return () => {
      cancelled = true
    }
  }, [isOpen, isReady])

  if (!isOpen || !receipt) return null

  return (
    <div className="drawer-backdrop modal-center" onClick={onClose}>
      <div
        className="modal-card animate-scale-up"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="receipt-modal-title"
        style={{
          width: 'min(100%, 460px)',
          background: '#ffffff',
          borderRadius: 16,
          boxShadow: '0 24px 50px rgba(0, 27, 92, 0.22)',
          padding: 24,
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          border: '1px solid var(--line)',
        }}
      >
        {/* Header */}
        <div className="modal-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div className="modal-header-title" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              className="modal-icon-badge"
              style={{
                width: 42,
                height: 42,
                borderRadius: 10,
                background: '#dcfce7',
                display: 'grid',
                placeItems: 'center',
                flexShrink: 0,
              }}
            >
              <AppIcon name="check" size={20} color="#15803d" />
            </div>
            <div>
              <h3 id="receipt-modal-title" style={{ margin: 0, fontSize: 17, fontWeight: 800, color: 'var(--navy)' }}>
                ¡Venta Exitosa!
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: '#15803d', fontWeight: 600 }}>
                Comprobante generado correctamente
              </p>
            </div>
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label="Cerrar recibo"
            style={{ width: 32, height: 32 }}
          >
            <AppIcon name="close" size={16} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', background: '#f8fafc', padding: 12, borderRadius: 12, border: '1px solid var(--line)' }}>
          <style>{posThermalTicketStyles}</style>
          {state.status === 'ready' && state.invoiceError && (
            <div
              role="alert"
              style={{ marginBottom: 10, padding: '10px 12px', borderRadius: 10, background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 10 }}
            >
              <AppIcon name="alertTriangle" size={16} />
              <span style={{ flex: 1 }}>No se emitió la factura electrónica: {state.invoiceError}</span>
              <button type="button" className="outline-button" onClick={() => setAttempt((n) => n + 1)} style={{ height: 32, fontSize: 12, fontWeight: 700 }}>
                Reintentar
              </button>
            </div>
          )}
          {state.status === 'ready' && (
            <div style={{ background: '#ffffff', padding: '12px 8px', border: '1px dashed #cbd5e1', borderRadius: 8 }}>
              <POSThermalTicket ref={ticketRef} data={state.data} voucherNumber={receipt.invoiceNumber} cashierName={receipt.cashierName} />
            </div>
          )}
          {(state.status === 'invoicing' || state.status === 'loading') && (
            <p role="status" style={{ margin: 0, padding: 24, textAlign: 'center', fontSize: 13, color: '#64748b' }}>
              {state.status === 'invoicing' ? 'Emitiendo factura electrónica...' : 'Cargando tirilla...'}
            </p>
          )}
          {state.status === 'error' && (
            <p role="alert" style={{ margin: 0, padding: 24, textAlign: 'center', fontSize: 13, color: '#b91c1c', fontWeight: 600 }}>
              {state.message}
            </p>
          )}
        </div>

        {/* Actions */}
        <a
          href={customerReceiptHref(receipt.saleId, {
            cashReceived: receipt.paymentMethod === 'EFECTIVO' ? receipt.amountPaid : undefined,
          })}
          target="_blank"
          rel="noopener noreferrer"
          className="outline-button"
          style={{ height: 42, fontSize: 13, fontWeight: 700, gap: 6, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }}
        >
          <AppIcon name="fileText" size={16} />
          <span>Imprimir para cliente (15×20)</span>
        </a>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 4 }}>
          <button
            type="button"
            onClick={handlePrint}
            disabled={!isReady}
            className="outline-button"
            style={{ flex: 1, height: 42, fontSize: 13, fontWeight: 700, gap: 6 }}
          >
            <AppIcon name="print" size={16} />
            <span>Imprimir Ticket</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="primary-button"
            style={{ flex: 1, height: 42, fontSize: 13, fontWeight: 800, background: 'var(--navy)', gap: 6 }}
          >
            <span>Nueva Venta</span>
            <AppIcon name="chevronRight" size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}
