'use client'

import React, { useEffect, useRef, useState } from 'react'
import { AppIcon } from '@/components/ui/Icon'
import { ModalPortal } from '@/components/ui/ModalPortal'
import { Purchase } from '../types'
import { fetchPurchaseOrderPdf, sendPurchaseOrderPdf } from '../services/purchase-order-api.client'

interface PurchaseOrderPdfModalProps {
  purchase: Purchase
  onClose: () => void
}

type PreviewState = { status: 'loading' } | { status: 'ready'; url: string } | { status: 'error'; message: string }
type SendState = { status: 'idle' } | { status: 'sending' } | { status: 'sent'; message: string } | { status: 'error'; message: string }

/** Vista previa de la orden de compra en PDF, descarga y envío al correo del proveedor. */
export function PurchaseOrderPdfModal({ purchase, onClose }: PurchaseOrderPdfModalProps) {
  const [preview, setPreview] = useState<PreviewState>({ status: 'loading' })
  const [recipient, setRecipient] = useState(purchase.supplierEmail || '')
  const [message, setMessage] = useState('')
  const [send, setSend] = useState<SendState>({ status: 'idle' })
  const [attempt, setAttempt] = useState(0)
  const closeRef = useRef<HTMLButtonElement>(null)
  const fileName = `Orden-de-compra-${purchase.purchaseNumber}.pdf`

  useEffect(() => {
    let objectUrl: string | null = null
    let active = true
    setPreview({ status: 'loading' })
    fetchPurchaseOrderPdf(purchase.id)
      .then((blob) => {
        if (!active) return
        objectUrl = URL.createObjectURL(blob)
        setPreview({ status: 'ready', url: objectUrl })
      })
      .catch((err: unknown) => {
        if (active) setPreview({ status: 'error', message: err instanceof Error ? err.message : 'No se pudo generar la orden.' })
      })
    return () => {
      active = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [purchase.id, attempt])

  useEffect(() => {
    closeRef.current?.focus()
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  const handleSend = async (event: React.FormEvent) => {
    event.preventDefault()
    setSend({ status: 'sending' })
    try {
      const result = await sendPurchaseOrderPdf(purchase.id, recipient, message)
      setSend({ status: 'sent', message: result })
    } catch (err) {
      setSend({ status: 'error', message: err instanceof Error ? err.message : 'No se pudo enviar la orden.' })
    }
  }

  return (
    <ModalPortal>
      <div className="drawer-backdrop modal-center p-2 sm:p-4" style={{ zIndex: 1200 }} role="dialog" aria-modal="true" aria-labelledby="purchase-order-pdf-title" onClick={(e) => { e.stopPropagation(); onClose() }}>
        <div className="modal-card modal-card-flush animate-scale-up purchase-order-pdf-modal" onClick={(e) => e.stopPropagation()}>
          <header className="purchase-order-pdf-header">
            <div className="min-w-0">
              <span className="product-category-eyebrow">Orden de compra</span>
              <h2 id="purchase-order-pdf-title" className="purchase-order-pdf-title">
                {purchase.purchaseNumber} · {purchase.supplierName}
              </h2>
            </div>
            <button ref={closeRef} type="button" className="drawer-close-btn" onClick={onClose} aria-label="Cerrar orden de compra">
              <AppIcon name="close" size={18} />
            </button>
          </header>

          <div className="purchase-order-pdf-body">
            <section className="purchase-order-pdf-preview" aria-label="Vista previa del PDF">
              {preview.status === 'loading' && (
                <p role="status" className="purchase-order-pdf-placeholder">Generando la orden de compra...</p>
              )}
              {preview.status === 'error' && (
                <div className="purchase-order-pdf-placeholder" role="alert">
                  <AppIcon name="warning" size={22} />
                  <p>{preview.message}</p>
                  <button type="button" className="outline-button compact" onClick={() => setAttempt((n) => n + 1)}>
                    <AppIcon name="refresh" size={14} />
                    <span>Reintentar</span>
                  </button>
                </div>
              )}
              {preview.status === 'ready' && (
                <iframe title={`Vista previa de la orden ${purchase.purchaseNumber}`} src={preview.url} className="purchase-order-pdf-frame" />
              )}
            </section>

            <aside className="purchase-order-pdf-side">
              <a
                className={`primary-button purchase-order-pdf-download ${preview.status === 'ready' ? '' : 'is-disabled'}`}
                href={preview.status === 'ready' ? preview.url : undefined}
                download={fileName}
                aria-disabled={preview.status !== 'ready'}
              >
                <AppIcon name="download" size={15} color="#fff" />
                <span>Descargar PDF</span>
              </a>

              <form className="purchase-order-pdf-form" onSubmit={handleSend}>
                <h3 className="purchase-order-pdf-subtitle">Enviar al proveedor</h3>
                <label htmlFor="purchase-order-recipient">Correo del proveedor</label>
                <input
                  id="purchase-order-recipient"
                  type="email"
                  className="form-input"
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                  placeholder="compras@proveedor.com"
                  required
                  disabled={send.status === 'sending'}
                />
                <label htmlFor="purchase-order-message">Mensaje (opcional)</label>
                <textarea
                  id="purchase-order-message"
                  className="form-input"
                  rows={4}
                  maxLength={1000}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Ej.: favor confirmar la fecha de entrega."
                  disabled={send.status === 'sending'}
                />
                {send.status === 'sent' && (
                  <p className="toast-banner toast-success" role="status" style={{ margin: 0 }}>
                    {send.message}
                  </p>
                )}
                {send.status === 'error' && (
                  <p className="toast-banner toast-error" role="alert" style={{ margin: 0 }}>
                    {send.message}
                  </p>
                )}
                <button type="submit" className="outline-button" disabled={send.status === 'sending' || preview.status !== 'ready'}>
                  <AppIcon name="mail" size={15} />
                  <span>{send.status === 'sending' ? 'Enviando...' : 'Enviar por correo'}</span>
                </button>
              </form>
            </aside>
          </div>
        </div>
      </div>
    </ModalPortal>
  )
}
