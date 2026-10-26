'use client'

/**
 * Representación gráfica de la Factura Electrónica de Venta y de sus Notas Crédito/Débito
 * (imprimible / PDF desde el navegador).
 * Incluye: emisor, adquiriente, resolución de numeración (número, fecha, prefijo, rango, vigencia),
 * líneas, impuestos, totales, CUFE y código QR de consulta en la DIAN.
 */

import React, { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabaseClient } from '@/lib/supabase/client'
import { invoiceService } from '@/features/invoices/services/invoice.service'
import { Invoice } from '@/features/invoices/types'
import { resolutionLegend, TRANSMISSION_LABELS } from '@/features/invoices/components/DianFiscalPanel'
import { qrSvg } from '@/lib/qr/qr-svg'

const cop = (v: number) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 2 }).format(v)

export default function InvoiceRepresentationPage() {
  const params = useParams<{ id: string }>()
  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [company, setCompany] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const inv = await invoiceService.getById(params.id)
        const { data: comp } = await supabaseClient
          .from('companies')
          .select('business_name, trade_name, tax_id, verification_digit, address, city, department, phone, email, invoice_email, logo_url, rut_responsibilities')
          .limit(1)
          .maybeSingle()
        if (!alive) return
        setInvoice(inv)
        setCompany(comp)
      } catch (e: any) {
        if (alive) setError(e?.message || 'No se pudo cargar la factura.')
      }
    })()
    return () => {
      alive = false
    }
  }, [params.id])

  const qr = useMemo(() => (invoice?.dianQrCode ? qrSvg(invoice.dianQrCode, { ecc: 'M' }) : null), [invoice?.dianQrCode])

  if (error) return <main style={{ padding: 32, fontFamily: 'system-ui' }}>{error}</main>
  if (!invoice) return <main style={{ padding: 32, fontFamily: 'system-ui' }}>Cargando documento…</main>

  const legend = resolutionLegend(invoice)
  const state = TRANSMISSION_LABELS[invoice.transmissionState || 'PENDING']
  const isTest = invoice.environment !== 'PRODUCCION'
  const accepted = invoice.transmissionState === 'ACCEPTED'
  const isNote = invoice.type === 'NOTA_CREDITO' || invoice.type === 'NOTA_DEBITO'
  const title = invoice.type === 'NOTA_CREDITO' ? 'NOTA CRÉDITO ELECTRÓNICA' : invoice.type === 'NOTA_DEBITO' ? 'NOTA DÉBITO ELECTRÓNICA' : 'FACTURA ELECTRÓNICA DE VENTA'
  const keyLabel = isNote ? 'CUDE' : 'CUFE'
  const ivaLabel = (it: Invoice['items'][number]) =>
    it.taxRatePercent > 0 ? `${it.taxRatePercent}%` : it.taxCode === 'EXCLUIDO' ? 'Excluido' : it.taxCode === 'EXENTO' ? 'Exento 0%' : '0%'

  return (
    <main className="fe-doc">
      <style>{`
        .fe-doc { max-width: 820px; margin: 0 auto; padding: 24px; font-family: system-ui, -apple-system, Segoe UI, sans-serif; color: #0f172a; font-size: 12px; background: #fff; }
        .fe-doc h1 { font-size: 16px; margin: 0; }
        .fe-row { display: flex; gap: 16px; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; }
        .fe-box { border: 1px solid #cbd5e1; border-radius: 6px; padding: 10px 12px; }
        .fe-muted { color: #475569; }
        .fe-table { width: 100%; border-collapse: collapse; margin-top: 12px; }
        .fe-table th, .fe-table td { border-bottom: 1px solid #e2e8f0; padding: 6px 4px; text-align: left; }
        .fe-table th { background: #f1f5f9; font-size: 11px; }
        .fe-num { text-align: right !important; white-space: nowrap; }
        .fe-banner { padding: 8px 10px; border-radius: 6px; font-weight: 700; margin-bottom: 12px; }
        .fe-actions { display: flex; gap: 8px; justify-content: flex-end; margin-bottom: 12px; }
        .fe-actions button { height: 32px; padding: 0 14px; border-radius: 6px; border: 1px solid #001B5C; background: #001B5C; color: #fff; font-weight: 700; cursor: pointer; }
        .fe-mono { font-family: ui-monospace, Menlo, monospace; word-break: break-all; font-size: 10px; }
        @media (max-width: 640px) { .fe-doc { padding: 16px; } }
        @media print { .fe-actions { display: none; } .fe-doc { padding: 0; } @page { size: letter; margin: 12mm; } }
      `}</style>

      <div className="fe-actions">
        <button type="button" onClick={() => window.print()}>Imprimir / Guardar PDF</button>
      </div>

      {isTest && (
        <div className="fe-banner" style={{ background: '#fef3c7', color: '#92400e' }}>
          DOCUMENTO DE PRUEBA — AMBIENTE DE HABILITACIÓN DIAN. SIN VALIDEZ FISCAL.
        </div>
      )}
      {!accepted && (
        <div className="fe-banner" style={{ background: '#fef2f2', color: '#991b1b' }}>
          Estado DIAN: {state?.label || invoice.transmissionState}. Esta representación no corresponde a un documento validado por la DIAN.
        </div>
      )}

      <div className="fe-row">
        <div>
          <h1>{company?.business_name || '—'}</h1>
          <div className="fe-muted">NIT {company?.tax_id}-{company?.verification_digit}</div>
          <div className="fe-muted">{company?.address} · {company?.city}, {company?.department}</div>
          {(company?.invoice_email || company?.email) && <div className="fe-muted">{company?.invoice_email || company?.email}</div>}
        </div>
        <div className="fe-box" style={{ minWidth: 220 }}>
          <div style={{ fontWeight: 800, fontSize: 13 }}>{title}</div>
          <div style={{ fontSize: 18, fontWeight: 800, fontFamily: 'ui-monospace, Menlo, monospace' }}>{invoice.invoiceNumber}</div>
          <div className="fe-muted">Fecha de emisión: {invoice.issueDate || invoice.date.slice(0, 10)}</div>
          <div className="fe-muted">Hora: {invoice.issueTime || invoice.issuedAtBogota}</div>
          {!isNote && <div className="fe-muted">Forma de pago: {invoice.paymentTerms}</div>}
        </div>
      </div>

      {!isNote && legend && <p className="fe-box" style={{ marginTop: 12 }}>{legend}</p>}
      {isNote && (
        <div className="fe-box" style={{ marginTop: 12 }}>
          <div>
            <strong>Factura electrónica afectada:</strong> {invoice.originalInvoiceNumber || '—'}
            {invoice.originalInvoiceDate ? ` del ${invoice.originalInvoiceDate}` : ''}
          </div>
          {invoice.originalInvoiceCufe && (
            <div>
              <strong>CUFE de la factura:</strong> <span className="fe-mono">{invoice.originalInvoiceCufe}</span>
            </div>
          )}
          {invoice.noteConceptLabel && (
            <div>
              <strong>Concepto de corrección:</strong> {invoice.noteConceptCode}. {invoice.noteConceptLabel}
            </div>
          )}
          {invoice.noteReason && <div><strong>Motivo:</strong> {invoice.noteReason}</div>}
        </div>
      )}

      <div className="fe-box" style={{ marginTop: 12 }}>
        <strong>Adquiriente:</strong> {invoice.customerName} — {invoice.customerDocType} {invoice.customerDoc}
        {invoice.customerAddress && <> · {invoice.customerAddress}{invoice.customerCity ? `, ${invoice.customerCity}` : ''}</>}
        {invoice.customerEmail && <> · {invoice.customerEmail}</>}
      </div>

      <table className="fe-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Código</th>
            <th>Descripción</th>
            <th className="fe-num">Cant.</th>
            <th className="fe-num">Vr. unitario</th>
            <th className="fe-num">Descuento</th>
            <th className="fe-num">IVA</th>
            <th className="fe-num">Vr. total</th>
          </tr>
        </thead>
        <tbody>
          {invoice.items.map((it, i) => (
            <tr key={it.id}>
              <td>{i + 1}</td>
              <td>{it.sku}</td>
              <td>{it.productName}</td>
              <td className="fe-num">{it.quantity}</td>
              <td className="fe-num">{cop(it.unitPrice)}</td>
              <td className="fe-num">{it.discountAmount > 0 ? cop(it.discountAmount) : '—'}</td>
              <td className="fe-num">{ivaLabel(it)}</td>
              <td className="fe-num">{cop(it.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="fe-row" style={{ marginTop: 12 }}>
        <div style={{ flex: '1 1 320px' }}>
          {invoice.dianCufe ? (
            <>
              <strong>{keyLabel}:</strong>
              <div className="fe-mono">{invoice.dianCufe}</div>
            </>
          ) : (
            <div className="fe-muted">{keyLabel} pendiente: el documento aún no se ha generado en el servidor.</div>
          )}
          <div className="fe-muted" style={{ marginTop: 8 }}>
            Software propio: Super Más ERP · Proveedor tecnológico: el mismo facturador (NIT {company?.tax_id}-{company?.verification_digit}).
          </div>
          {invoice.dianResponseDate && (
            <div className="fe-muted">Validación DIAN: {new Date(invoice.dianResponseDate).toLocaleString('es-CO', { timeZone: 'America/Bogota' })}</div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
          {qr && <div style={{ width: 140, height: 140 }} dangerouslySetInnerHTML={{ __html: qr }} aria-label="Código QR DIAN" />}
          <table style={{ borderCollapse: 'collapse', minWidth: 220 }}>
            <tbody>
              <tr><td>Subtotal (base)</td><td className="fe-num">{cop(invoice.subtotal)}</td></tr>
              {invoice.taxesBreakdown.map((t) => (
                <tr key={t.taxCode}><td>{t.taxName} sobre {cop(t.taxableBase)}</td><td className="fe-num">{cop(t.taxAmount)}</td></tr>
              ))}
              <tr><td style={{ fontWeight: 800 }}>{invoice.type === 'NOTA_CREDITO' ? 'Total acreditado' : invoice.type === 'NOTA_DEBITO' ? 'Total a cobrar' : 'Total a pagar'}</td><td className="fe-num" style={{ fontWeight: 800 }}>{cop(invoice.total)}</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </main>
  )
}
