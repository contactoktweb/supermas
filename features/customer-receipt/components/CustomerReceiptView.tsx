'use client'

import React, { useEffect, useRef, useState } from 'react'
import { AppIcon } from '@/components/ui/Icon'
import { useCustomerReceipt } from '../hooks/useCustomerReceipt'
import { CustomerReceiptSheet } from './CustomerReceiptSheet'
import { customerReceiptCss, SHEET_WIDTH_MM } from './customerReceiptStyles'

const CSS_PX_PER_MM = 96 / 25.4
const SHEET_WIDTH_PX = SHEET_WIDTH_MM * CSS_PX_PER_MM

interface Props {
  saleId: string
  cashReceived?: number
}

/** Ajusta la hoja (150 mm) al ancho disponible en pantallas pequeñas sin alterar la impresión. */
function useFitToWidth(enabled: boolean) {
  const stageRef = useRef<HTMLDivElement>(null)
  const [zoom, setZoom] = useState(1)

  useEffect(() => {
    const stage = stageRef.current
    if (!enabled || !stage) return
    const update = () => setZoom(Math.min(1, stage.clientWidth / SHEET_WIDTH_PX))
    update()
    const observer = new ResizeObserver(update)
    observer.observe(stage)
    return () => observer.disconnect()
  }, [enabled])

  return { stageRef, zoom }
}

export function CustomerReceiptView({ saleId, cashReceived }: Props) {
  const state = useCustomerReceipt(saleId, cashReceived)
  const ready = state.status === 'ready'
  const { stageRef, zoom } = useFitToWidth(ready)

  return (
    <main className="cr-page">
      <style>{customerReceiptCss}</style>

      {state.status === 'loading' && (
        <div className="cr-state" role="status" aria-live="polite">
          <div className="cr-skeleton" aria-hidden="true" />
          <p>Cargando comprobante…</p>
        </div>
      )}

      {state.status === 'not_found' && (
        <div className="cr-state" role="alert">
          <AppIcon name="search" size={28} />
          <h1 className="cr-state-title">Venta no encontrada</h1>
          <p>La venta no existe o su usuario no tiene permiso para consultarla.</p>
        </div>
      )}

      {state.status === 'error' && (
        <div className="cr-state" role="alert">
          <AppIcon name="alertTriangle" size={28} color="#b91c1c" />
          <h1 className="cr-state-title">No se pudo cargar el comprobante</h1>
          <p>{state.message}</p>
          <button type="button" className="cr-btn cr-btn-outline" onClick={() => window.location.reload()}>
            <AppIcon name="refresh" size={16} /> Reintentar
          </button>
        </div>
      )}

      {ready && (
        <>
          <nav className="cr-toolbar" aria-label="Acciones del comprobante">
            {state.data.fiscal && (
              <a className="cr-btn cr-btn-outline" href={`/facturacion/representacion/${state.data.fiscal.invoiceId}`} target="_blank" rel="noopener noreferrer">
                <AppIcon name="fileText" size={16} /> Representación gráfica DIAN
              </a>
            )}
            <button type="button" className="cr-btn cr-btn-primary" onClick={() => window.print()}>
              <AppIcon name="print" size={16} /> Imprimir (15 × 20 cm)
            </button>
          </nav>
          <div className="cr-stage" ref={stageRef}>
            <div className="cr-zoom" style={{ zoom }}>
              <CustomerReceiptSheet data={state.data} />
            </div>
          </div>
        </>
      )}
    </main>
  )
}
