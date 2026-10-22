'use client'

import React, { useEffect, useRef, useState } from 'react'
import { AppIcon } from '@/components/ui/Icon'
import {
  type CustomerDisplayCart,
  type CustomerDisplayMessage,
  type CustomerDisplaySale,
  openCustomerDisplayChannel,
} from './customerDisplayChannel'

/** Tiempo que permanece el agradecimiento si no se empieza otra venta. */
const THANK_YOU_MS = 12_000

const formatCOP = (amount: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(amount)

/**
 * Pantalla para el cliente: muestra en vivo lo que se le factura en la caja. Solo lectura;
 * recibe los datos de la ventana del POS por BroadcastChannel.
 */
export function CustomerDisplayView() {
  const [cart, setCart] = useState<CustomerDisplayCart | null>(null)
  const [completedSale, setCompletedSale] = useState<CustomerDisplaySale | null>(null)
  const [connected, setConnected] = useState(true)
  const listEndRef = useRef<HTMLLIElement>(null)

  useEffect(() => {
    const channel = openCustomerDisplayChannel()
    if (!channel) {
      setConnected(false)
      return
    }
    let thankYouTimer: number | undefined
    channel.onmessage = (event: MessageEvent<CustomerDisplayMessage>) => {
      const message = event.data
      if (message?.type === 'cart') {
        setCart(message.cart)
        // Una venta nueva reemplaza el agradecimiento de la anterior.
        if (message.cart.items.length > 0) setCompletedSale(null)
      } else if (message?.type === 'sale-completed') {
        setCompletedSale(message.sale)
        window.clearTimeout(thankYouTimer)
        thankYouTimer = window.setTimeout(() => setCompletedSale(null), THANK_YOU_MS)
      }
    }
    channel.postMessage({ type: 'request-state' } satisfies CustomerDisplayMessage)
    return () => {
      window.clearTimeout(thankYouTimer)
      channel.close()
    }
  }, [])

  useEffect(() => {
    listEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [cart?.items.length, cart?.lastChangedItemId])

  const items = cart?.items ?? []
  const hasItems = items.length > 0

  return (
    <div className="customer-display">
      <header className="customer-display-header">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/super-mas-logo.svg" alt="Super Más" className="customer-display-logo" />
        <div className="customer-display-header-text">
          <span>{cart?.locationName || 'Super Más'}</span>
          {hasItems && cart?.customerName && <strong>Cliente: {cart.customerName}</strong>}
        </div>
      </header>

      {!connected ? (
        <section className="customer-display-message">
          <AppIcon name="warning" size={48} />
          <h1>Pantalla no disponible</h1>
          <p>Abre esta pantalla desde el botón «Pantalla cliente» del punto de venta.</p>
        </section>
      ) : completedSale ? (
        <section className="customer-display-message is-success" aria-live="polite">
          <span className="customer-display-check">
            <AppIcon name="check" size={56} />
          </span>
          <h1>¡Gracias por su compra!</h1>
          <dl className="customer-display-sale">
            <div>
              <dt>Total pagado</dt>
              <dd>{formatCOP(completedSale.totalAmount)}</dd>
            </div>
            {completedSale.changeAmount > 0 && (
              <div>
                <dt>Su cambio</dt>
                <dd>{formatCOP(completedSale.changeAmount)}</dd>
              </div>
            )}
          </dl>
          <p>Factura {completedSale.saleNumber}</p>
        </section>
      ) : !hasItems ? (
        <section className="customer-display-message">
          <AppIcon name="sales" size={56} />
          <h1>Bienvenido a Super Más</h1>
          <p>Aquí verás cada producto que se registre en tu compra.</p>
        </section>
      ) : (
        <main className="customer-display-body">
          <section className="customer-display-items" aria-label="Productos de tu compra">
            <ul aria-live="polite">
              {items.map((item) => (
                <li key={item.id} className={item.id === cart?.lastChangedItemId ? 'is-latest' : undefined}>
                  <div className="customer-display-item-name">
                    <strong>{item.name}</strong>
                    <span>
                      {item.quantity} {item.unitOfMeasure} × {formatCOP(item.unitPrice)}
                      {item.discountAmount > 0 && ` · descuento ${formatCOP(item.discountAmount)}`}
                    </span>
                  </div>
                  <b>{formatCOP(item.total)}</b>
                </li>
              ))}
              <li ref={listEndRef} aria-hidden="true" className="customer-display-list-end" />
            </ul>
          </section>

          <aside className="customer-display-summary" aria-label="Total de tu compra">
            <dl>
              <div>
                <dt>Productos</dt>
                <dd>{cart?.totalUnits ?? 0}</dd>
              </div>
              <div>
                <dt>Subtotal</dt>
                <dd>{formatCOP(cart?.subtotal ?? 0)}</dd>
              </div>
              {(cart?.discountTotal ?? 0) > 0 && (
                <div className="is-discount">
                  <dt>Descuentos</dt>
                  <dd>-{formatCOP(cart?.discountTotal ?? 0)}</dd>
                </div>
              )}
              <div>
                <dt>IVA</dt>
                <dd>{formatCOP(cart?.taxTotal ?? 0)}</dd>
              </div>
            </dl>
            <div className="customer-display-total">
              <span>Total a pagar</span>
              <strong>{formatCOP(cart?.totalAmount ?? 0)}</strong>
            </div>
          </aside>
        </main>
      )}
    </div>
  )
}
