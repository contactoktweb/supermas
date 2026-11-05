'use client'

import React, { forwardRef, useMemo } from 'react'
import { qrSvg } from '@/lib/qr/qr-svg'
import { CustomerReceiptData } from '@/features/customer-receipt'
import { displayLabel, ID_DOCUMENT_LABELS } from '@/lib/labels/display-labels'

/** Logo de la plataforma para documentos impresos (se usa si el de la empresa no carga). */
const DEFAULT_TICKET_LOGO = '/logo-super-documento.jpg'

const money = (v: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v)
const qty = (v: number) => new Intl.NumberFormat('es-CO', { maximumFractionDigits: 2 }).format(v)

interface POSThermalTicketProps {
  data: CustomerReceiptData
  /** Consecutivo del comprobante POS (p. ej. POS-0001). */
  voucherNumber: string
  cashierName?: string
}

/** Tirilla de 80 mm de una venta POS; si la venta tiene documento electrónico DIAN, incluye resolución, CUFE/CUDE y QR. */
export const POSThermalTicket = forwardRef<HTMLDivElement, POSThermalTicketProps>(function POSThermalTicket(
  { data, voucherNumber, cashierName },
  ref
) {
  const { issuer, customer, fiscal } = data
  const qr = useMemo(() => (fiscal?.qrData ? qrSvg(fiscal.qrData, { ecc: 'M' }) : null), [fiscal?.qrData])
  const issuerLocation = [issuer.address, issuer.city].filter(Boolean).join(', ')
  const customerDoc = customer.documentNumber
    ? `${displayLabel(ID_DOCUMENT_LABELS, customer.documentType || '')} ${customer.documentNumber}`.trim()
    : null

  return (
    <div ref={ref} className="tk" role="document" aria-label={`Tirilla de la venta ${data.saleNumber}`}>
      <header className="tk-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className="tk-logo"
          src={DEFAULT_TICKET_LOGO}
          alt={`Logo de ${issuer.tradeName || issuer.legalName || 'la empresa'}`}
        />
        <p className="tk-issuer-name">{issuer.legalName || '—'}</p>
        {issuer.nit && <p>NIT {issuer.nit}{issuer.dv ? `-${issuer.dv}` : ''}</p>}
        {issuer.taxRegime && <p>{issuer.taxRegime}</p>}
        {issuerLocation && <p>{issuerLocation}</p>}
        {issuer.phone && <p>Tel. {issuer.phone}</p>}
        {data.locationName && <p>Sede: {data.locationName}</p>}
      </header>

      <hr className="tk-sep" />

      <section className="tk-center" aria-label="Documento">
        <h2 className="tk-doc-title">{fiscal ? 'Factura electrónica de venta' : 'Tiquete de venta'}</h2>
        <p className="tk-strong">No. {fiscal ? fiscal.documentNumber : voucherNumber}</p>
      </section>
      <div className="tk-row"><span>Venta:</span><span>{data.saleNumber}</span></div>
      <div className="tk-row"><span>Fecha:</span><span>{data.issuedDate} {data.issuedTime}</span></div>
      {data.cashRegisterLabel && <div className="tk-row"><span>Caja:</span><span>{data.cashRegisterLabel}</span></div>}
      {(cashierName || data.sellerName) && <div className="tk-row"><span>Cajero:</span><span>{cashierName || data.sellerName}</span></div>}
      <div className="tk-row"><span>Cliente:</span><span>{customer.name}</span></div>
      {customerDoc && <div className="tk-row"><span>Doc.:</span><span>{customerDoc}</span></div>}

      <hr className="tk-sep" />

      <ul className="tk-items" aria-label="Productos">
        {data.lines.map((line) => (
          <li key={line.id}>
            <p className="tk-item-name">{line.description}</p>
            <div className="tk-row">
              <span>
                {qty(line.quantity)} x {money(line.unitPrice)} · IVA {line.ivaLabel}
              </span>
              <span className="tk-strong">{money(line.total)}</span>
            </div>
            {line.discountAmount > 0 && <p className="tk-muted">Descuento -{money(line.discountAmount)}</p>}
          </li>
        ))}
      </ul>
      <p className="tk-muted">Valores unitarios antes de IVA.</p>

      <hr className="tk-sep" />

      <div className="tk-row"><span>Subtotal</span><span>{money(data.grossSubtotal)}</span></div>
      {data.discountTotal > 0 && <div className="tk-row"><span>Descuentos</span><span>-{money(data.discountTotal)}</span></div>}
      {data.taxes.map((t) => (
        <div key={t.key} className="tk-row">
          <span>{t.label} (base {money(t.taxableBase)})</span>
          <span>{money(t.taxAmount)}</span>
        </div>
      ))}
      <div className="tk-row tk-total"><span>TOTAL</span><span>{money(data.total)}</span></div>

      <hr className="tk-sep" />

      {data.payments.map((p, idx) => (
        <div key={`${p.methodLabel}-${idx}`} className="tk-row">
          <span>{p.methodLabel}{p.accountLast4 ? ` *${p.accountLast4}` : ''}</span>
          <span>{money(p.amount)}</span>
        </div>
      ))}
      {data.creditDueDate && <div className="tk-row tk-strong"><span>Crédito: vence el</span><span>{data.creditDueDate}</span></div>}
      {data.cashReceived !== undefined && <div className="tk-row"><span>Efectivo recibido</span><span>{money(data.cashReceived)}</span></div>}
      {data.changeAmount !== undefined && (
        <div className="tk-row tk-strong"><span>Cambio</span><span>{money(data.changeAmount)}</span></div>
      )}

      <hr className="tk-sep" />

      {fiscal ? (
        <section className="tk-fiscal" aria-label="Información fiscal DIAN">
          {fiscal.resolutionLegend && <p>{fiscal.resolutionLegend}</p>}
          {fiscal.cufe && (
            <p>
              <span className="tk-strong">CUFE: </span>
              <span className="tk-cufe">{fiscal.cufe}</span>
            </p>
          )}
          {fiscal.validatedAt && <p>Validación DIAN: {fiscal.validatedAt}</p>}
          {qr && (
            <div className="tk-qr" role="img" aria-label="Código QR de consulta del documento en la DIAN" dangerouslySetInnerHTML={{ __html: qr }} />
          )}
        </section>
      ) : (
        <p className="tk-center tk-muted">Si necesita factura electrónica, solicítela en caja.</p>
      )}

      <hr className="tk-sep" />
      <p className="tk-center tk-thanks">¡Gracias por su compra en Super Más!</p>
    </div>
  )
})
