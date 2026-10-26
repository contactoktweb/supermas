'use client'

import React, { useMemo } from 'react'
import { qrSvg } from '@/lib/qr/qr-svg'
import { CustomerReceiptData } from '../types'
import { displayLabel, ID_DOCUMENT_LABELS } from '@/lib/labels/display-labels'

const DEFAULT_LOGO = '/logo-distribuidora.png'
const KYT_URL = 'https://www.kytcode.lat'

const money = (v: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(v)
const qty = (v: number) => new Intl.NumberFormat('es-CO', { maximumFractionDigits: 2 }).format(v)

const SALE_STATUS_NOTICES: Record<string, string> = {
  CANCELLED: 'VENTA ANULADA',
  RETURNED: 'VENTA CON DEVOLUCIÓN REGISTRADA',
}

interface Props {
  data: CustomerReceiptData
}

/** Hoja de 15 × 20 cm en blanco y negro con el comprobante de la venta para el cliente. */
export function CustomerReceiptSheet({ data }: Props) {
  const { issuer, customer, fiscal } = data
  const qr = useMemo(() => (fiscal?.qrData ? qrSvg(fiscal.qrData, { ecc: 'M' }) : null), [fiscal?.qrData])

  const title = fiscal ? 'Factura electrónica de venta' : 'Comprobante de venta'
  const number = fiscal ? fiscal.documentNumber : data.saleNumber
  const location = [issuer.address, [issuer.city, issuer.department].filter(Boolean).join(', ')].filter(Boolean).join(' · ')
  const saleNotice = SALE_STATUS_NOTICES[data.saleStatus]

  return (
    <article className="cr-sheet" aria-labelledby="cr-title">
      <header className="cr-head">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className="cr-logo"
          src={issuer.logoUrl || DEFAULT_LOGO}
          alt={`Logo de ${issuer.tradeName || issuer.legalName || 'la empresa'}`}
          onError={(e) => {
            // Logo guardado que ya no existe (p. ej. un archivo de marca anterior): se usa el de la plataforma
            if (!e.currentTarget.src.endsWith(DEFAULT_LOGO)) e.currentTarget.src = DEFAULT_LOGO
          }}
        />
        <div className="cr-issuer">
          <p className="cr-issuer-name">{issuer.legalName || '—'}</p>
          {issuer.tradeName && issuer.tradeName !== issuer.legalName && <p>{issuer.tradeName}</p>}
          {issuer.nit && <p>NIT {issuer.nit}{issuer.dv ? `-${issuer.dv}` : ''}</p>}
          {location && <p>{location}</p>}
          {issuer.phone && <p>Tel. {issuer.phone}</p>}
        </div>
        <div className="cr-docbox">
          <h1 id="cr-title" className="cr-doc-title">{title}</h1>
          <p className="cr-doc-number">No. {number}</p>
          {fiscal && <p>Venta interna {data.saleNumber}</p>}
        </div>
      </header>

      {saleNotice && <p className="cr-notice cr-notice-strong" role="status">{saleNotice}</p>}
      {!fiscal && (
        <p className="cr-notice">Comprobante interno de venta. Este documento no es una factura electrónica de venta.</p>
      )}
      {fiscal && fiscal.environment !== 'PRODUCCION' && (
        <p className="cr-notice cr-notice-strong">Documento de prueba — ambiente de habilitación DIAN. Sin validez fiscal.</p>
      )}
      {fiscal && !fiscal.isAccepted && (
        <p className="cr-notice">
          {fiscal.transmissionState === 'REJECTED'
            ? 'Documento electrónico rechazado por la DIAN.'
            : 'Documento electrónico pendiente de validación DIAN.'}{' '}
          Estado: {fiscal.transmissionLabel}.
        </p>
      )}

      <section className="cr-meta" aria-labelledby="cr-meta-title">
        <h2 id="cr-meta-title" className="cr-sr-only">Datos de la venta y del cliente</h2>
        <dl className="cr-grid">
          <div><dt>Fecha</dt><dd>{data.issuedDate}</dd></div>
          <div><dt>Hora</dt><dd>{data.issuedTime}</dd></div>
          {data.sellerName && <div><dt>Vendedor</dt><dd>{data.sellerName}</dd></div>}
          {data.cashRegisterLabel && <div><dt>Caja</dt><dd>{data.cashRegisterLabel}</dd></div>}
          {data.locationName && <div><dt>Sede</dt><dd>{data.locationName}</dd></div>}
        </dl>
        <dl className="cr-grid cr-customer">
          <div className="cr-span"><dt>Cliente</dt><dd>{customer.name}</dd></div>
          <div>
            <dt>Documento</dt>
            <dd>{customer.documentNumber ? `${customer.documentType ? `${displayLabel(ID_DOCUMENT_LABELS, customer.documentType)} ` : ''}${customer.documentNumber}` : '—'}</dd>
          </div>
          {customer.taxLevelCodes && <div><dt>Resp. fiscal</dt><dd>{customer.taxLevelCodes}</dd></div>}
        </dl>
      </section>

      <section aria-labelledby="cr-items-title">
        <h2 id="cr-items-title" className="cr-sr-only">Detalle de productos</h2>
        <table className="cr-table">
          <thead>
            <tr>
              <th scope="col" className="cr-num">Cant.</th>
              <th scope="col">Descripción</th>
              <th scope="col" className="cr-num">Vr. unit.</th>
              <th scope="col" className="cr-num">IVA</th>
              <th scope="col" className="cr-num">Total</th>
            </tr>
          </thead>
          <tbody>
            {data.lines.length === 0 && (
              <tr><td colSpan={5} className="cr-empty">La venta no tiene productos registrados.</td></tr>
            )}
            {data.lines.map((line) => (
              <tr key={line.id}>
                <td className="cr-num">{qty(line.quantity)}</td>
                <td>
                  {line.description}
                  {line.discountAmount > 0 && (
                    <span className="cr-line-note">
                      Descuento{line.discountPercent > 0 ? ` ${qty(line.discountPercent)}%` : ''}: -{money(line.discountAmount)}
                    </span>
                  )}
                </td>
                <td className="cr-num">{money(line.unitPrice)}</td>
                <td className="cr-num">{line.ivaLabel}</td>
                <td className="cr-num">{money(line.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="cr-footnote">Valores unitarios antes de IVA. Total por línea con IVA incluido.</p>
      </section>

      <section className="cr-summary" aria-labelledby="cr-pay-title">
        <div className="cr-payments">
          <h2 id="cr-pay-title" className="cr-h2">Medios de pago</h2>
          {data.payments.length === 0 ? (
            <p>Sin pagos registrados.</p>
          ) : (
            <ul>
              {data.payments.map((p, i) => (
                <li key={i}>
                  <span>
                    {p.methodLabel}
                    {p.bankName && ` · ${p.bankName}`}
                    {p.accountLast4 && ` ****${p.accountLast4}`}
                    {p.reference && ` · Ref. ${p.reference}`}
                  </span>
                  <span className="cr-num">{money(p.amount)}</span>
                </li>
              ))}
              {data.cashReceived !== undefined && (
                <li><span>Efectivo recibido</span><span className="cr-num">{money(data.cashReceived)}</span></li>
              )}
              {data.changeAmount !== undefined && (
                <li className="cr-strong"><span>Cambio</span><span className="cr-num">{money(data.changeAmount)}</span></li>
              )}
            </ul>
          )}
        </div>
        <table className="cr-totals" aria-label="Totales">
          <tbody>
            <tr><th scope="row">Subtotal</th><td className="cr-num">{money(data.grossSubtotal)}</td></tr>
            {data.discountTotal > 0 && (
              <tr><th scope="row">Descuentos</th><td className="cr-num">-{money(data.discountTotal)}</td></tr>
            )}
            <tr><th scope="row">Base</th><td className="cr-num">{money(data.netSubtotal)}</td></tr>
            {data.taxes.map((t) => (
              <tr key={t.key}>
                <th scope="row">{t.label} <span className="cr-base">(base {money(t.taxableBase)})</span></th>
                <td className="cr-num">{money(t.taxAmount)}</td>
              </tr>
            ))}
            <tr className="cr-grand"><th scope="row">Total</th><td className="cr-num">{money(data.total)}</td></tr>
          </tbody>
        </table>
      </section>

      {fiscal && (
        <section className="cr-fiscal" aria-labelledby="cr-fiscal-title">
          <h2 id="cr-fiscal-title" className="cr-sr-only">Información fiscal DIAN</h2>
          <div className="cr-fiscal-text">
            {fiscal.resolutionLegend && <p>{fiscal.resolutionLegend}</p>}
            {fiscal.cufe ? (
              <p>
                <strong>CUFE:</strong> <span className="cr-mono">{fiscal.cufe}</span>
              </p>
            ) : (
              <p>CUFE pendiente: el documento electrónico aún no se ha generado.</p>
            )}
            {fiscal.validatedAt && <p>Validación DIAN: {fiscal.validatedAt}</p>}
          </div>
          {qr && (
            <div className="cr-qr" role="img" aria-label="Código QR de consulta del documento en la DIAN" dangerouslySetInnerHTML={{ __html: qr }} />
          )}
        </section>
      )}

      <footer className="cr-foot">
        <p className="cr-thanks">Gracias por su compra</p>
        <a className="cr-kyt" href={KYT_URL} target="_blank" rel="noopener noreferrer">
          <span>Desarrollado por K&amp;T</span>
          <svg viewBox="0 0 24 24" width="10" height="10" fill="#000000" aria-hidden="true" focusable="false">
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
          </svg>
        </a>
      </footer>
    </article>
  )
}
