'use client'

/**
 * Panel fiscal DIAN del detalle de factura:
 * resolución (número, fecha, prefijo, rango desde–hasta, vigencia), estado REAL de transmisión,
 * CUFE, código QR, errores devueltos por la DIAN y acciones (enviar, consultar, XML, representación gráfica).
 */

import React, { useMemo, useState } from 'react'
import { AppIcon } from '@/components/ui/Icon'
import { qrSvg } from '@/lib/qr/qr-svg'
import { Invoice } from '../types'

export const TRANSMISSION_LABELS: Record<string, { label: string; color: string; bg: string; hint: string }> = {
  PENDING: { label: 'Pendiente', color: '#475569', bg: '#f1f5f9', hint: 'Aún no se ha generado el documento electrónico.' },
  NUMBERED: { label: 'Numerada', color: '#1d4ed8', bg: '#eff6ff', hint: 'Consecutivo DIAN asignado. Falta generar el XML.' },
  XML_BUILT: { label: 'XML generado (sin firma)', color: '#b45309', bg: '#fffbeb', hint: 'XML, CUFE/CUDE y QR listos. Falta el certificado digital para firmar y enviar.' },
  SIGNED: { label: 'Firmada', color: '#1d4ed8', bg: '#eff6ff', hint: 'Firmada digitalmente; pendiente de envío.' },
  SENDING: { label: 'Procesando en el servidor', color: '#1d4ed8', bg: '#eff6ff', hint: 'El servidor está generando o transmitiendo el documento.' },
  SENT: { label: 'Enviada — esperando DIAN', color: '#7c3aed', bg: '#f5f3ff', hint: 'La DIAN recibió el documento. Consulte el estado.' },
  ACCEPTED: { label: 'Aceptada por la DIAN', color: '#047857', bg: '#ecfdf5', hint: 'Respuesta real de la DIAN: documento válido.' },
  REJECTED: { label: 'Rechazada por la DIAN', color: '#b91c1c', bg: '#fef2f2', hint: 'La DIAN devolvió errores. Corrija y reintente con el mismo consecutivo.' },
  COMMUNICATION_ERROR: { label: 'Error de comunicación', color: '#b91c1c', bg: '#fef2f2', hint: 'No hubo respuesta de la DIAN. Se puede reintentar sin consumir otro consecutivo.' },
  BLOCKED_CONFIG: { label: 'Falta configuración', color: '#b45309', bg: '#fffbeb', hint: 'Falta un dato fiscal o un secreto del servidor. Vea el detalle.' },
}

const fmtDate = (d?: string) => {
  if (!d) return '—'
  const [y, m, day] = d.slice(0, 10).split('-')
  return `${day}/${m}/${y}`
}

/** Leyenda de autorización de numeración tal como debe aparecer en la factura. */
export function resolutionLegend(inv: Invoice): string | null {
  if (!inv.dianResolution) return null
  const parts = [`Autorización de numeración de facturación DIAN No. ${inv.dianResolution}`]
  if (inv.dianResolutionDate) parts[0] += ` del ${fmtDate(inv.dianResolutionDate)}`
  if (inv.dianPrefix) parts.push(`prefijo ${inv.dianPrefix}`)
  if (inv.resolutionRangeFrom !== undefined && inv.resolutionRangeTo !== undefined) {
    parts.push(`desde ${inv.dianPrefix}${inv.resolutionRangeFrom} hasta ${inv.dianPrefix}${inv.resolutionRangeTo}`)
  }
  if (inv.resolutionValidFrom && inv.resolutionValidTo) {
    parts.push(`vigencia del ${fmtDate(inv.resolutionValidFrom)} al ${fmtDate(inv.resolutionValidTo)}`)
  }
  return parts.join(', ') + '.'
}

interface Props {
  invoice: Invoice
  onSend: (id: string) => Promise<any>
  onCheckStatus?: (id: string) => Promise<any>
  onOpenXml: (invoice: Invoice) => void
}

export function DianFiscalPanel({ invoice, onSend, onCheckStatus, onOpenXml }: Props) {
  const [busy, setBusy] = useState<'send' | 'status' | null>(null)
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null)
  const [copied, setCopied] = useState(false)

  const isNote = invoice.type === 'NOTA_CREDITO' || invoice.type === 'NOTA_DEBITO'
  const keyLabel = isNote ? 'CUDE' : 'CUFE'
  const state = invoice.transmissionState || 'PENDING'
  const meta = TRANSMISSION_LABELS[state] || TRANSMISSION_LABELS.PENDING
  const legend = resolutionLegend(invoice)
  const qr = useMemo(() => (invoice.dianQrCode ? qrSvg(invoice.dianQrCode, { ecc: 'M' }) : null), [invoice.dianQrCode])
  const errors = [...(invoice.dianValidationErrors || [])]
  if (invoice.lastError && !errors.includes(invoice.lastError)) errors.unshift(invoice.lastError)

  const run = async (kind: 'send' | 'status') => {
    try {
      setBusy(kind)
      setFeedback(null)
      const res = kind === 'send' ? await onSend(invoice.id) : await onCheckStatus?.(invoice.id)
      const msg = res?.message || 'Proceso completado.'
      const errs: string[] = res?.errors || []
      setFeedback({ ok: errs.length === 0, text: errs.length ? `${msg} ${errs.join(' | ')}` : msg })
    } catch (e: any) {
      setFeedback({ ok: false, text: e?.message || 'Error en la facturación electrónica.' })
    } finally {
      setBusy(null)
    }
  }

  const canSend = !['ACCEPTED', 'SENT', 'SENDING'].includes(state)
  const box: React.CSSProperties = { background: '#f8fafc', padding: '14px 16px', borderRadius: 8, border: '1px solid #e2e8f0' }

  return (
    <div className="drawer-section" style={{ padding: 0 }}>
      <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--navy)', marginBottom: 10 }}>Datos fiscales DIAN</h3>

      <div style={{ ...box, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Estado real */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 800, color: meta.color, background: meta.bg }}>{meta.label}</span>
          {invoice.environment && (
            <span style={{ padding: '3px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700, color: '#92400e', background: '#fef3c7' }}>
              {invoice.environment === 'HABILITACION' ? 'AMBIENTE DE HABILITACIÓN (PRUEBAS)' : 'PRODUCCIÓN'}
            </span>
          )}
          <span style={{ fontSize: 11, color: '#64748b' }}>{meta.hint}</span>
        </div>

        {/* Resolución (factura) o documento referenciado (nota) */}
        {isNote ? (
          <div>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--navy)' }}>
              {invoice.type === 'NOTA_CREDITO' ? 'Nota crédito' : 'Nota débito'} sobre la factura electrónica
            </span>
            <p style={{ margin: '4px 0 0', fontSize: 12, color: '#334155' }}>
              {invoice.originalInvoiceNumber || '—'}
              {invoice.originalInvoiceDate ? ` del ${fmtDate(invoice.originalInvoiceDate)}` : ''}
              {invoice.noteConceptLabel ? ` · Concepto ${invoice.noteConceptCode}: ${invoice.noteConceptLabel}` : ''}
            </p>
            {invoice.originalInvoiceCufe && (
              <p style={{ margin: '2px 0 0', fontSize: 10, color: '#64748b', fontFamily: 'monospace', wordBreak: 'break-all' }}>
                CUFE factura: {invoice.originalInvoiceCufe}
              </p>
            )}
          </div>
        ) : (
          <div>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--navy)' }}>Resolución de numeración</span>
            {legend ? (
              <p style={{ margin: '4px 0 0', fontSize: 12, color: '#334155' }}>{legend}</p>
            ) : (
              <p style={{ margin: '4px 0 0', fontSize: 12, color: '#b45309' }}>Sin resolución asociada (documento creado antes de la numeración DIAN).</p>
            )}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: qr ? 'minmax(0,1fr) 132px' : '1fr', gap: 14, alignItems: 'start' }}>
          {/* CUFE */}
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--navy)' }}>{keyLabel} (SHA-384)</span>
              {invoice.dianCufe && (
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(invoice.dianCufe!)
                    setCopied(true)
                    setTimeout(() => setCopied(false), 2000)
                  }}
                  style={{ background: 'none', border: 'none', color: copied ? '#10b981' : 'var(--navy)', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                >
                  {copied ? 'Copiado' : 'Copiar'}
                </button>
              )}
            </div>
            <div style={{ fontFamily: 'monospace', fontSize: 10, background: '#fff', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', wordBreak: 'break-all', color: '#334155' }}>
              {invoice.dianCufe || `El ${keyLabel} se genera en el servidor al construir el XML.`}
            </div>
            {invoice.dianTrackId && (
              <p style={{ margin: '6px 0 0', fontSize: 11, color: '#64748b' }}>
                TrackId DIAN: <span style={{ fontFamily: 'monospace' }}>{invoice.dianTrackId}</span>
              </p>
            )}
            {invoice.dianResponseMessage && (
              <p style={{ margin: '6px 0 0', fontSize: 11, color: '#334155' }}>
                Respuesta DIAN{invoice.dianResponseDate ? ` (${new Date(invoice.dianResponseDate).toLocaleString('es-CO', { timeZone: 'America/Bogota' })})` : ''}: {invoice.dianResponseMessage}
              </p>
            )}
          </div>

          {/* QR */}
          {qr && (
            <div style={{ textAlign: 'center' }}>
              <div
                aria-label="Código QR de la factura electrónica"
                style={{ width: 132, height: 132, border: '1px solid #e2e8f0', borderRadius: 6, background: '#fff' }}
                dangerouslySetInnerHTML={{ __html: qr }}
              />
              <span style={{ fontSize: 10, color: '#64748b' }}>Consulta en la DIAN</span>
            </div>
          )}
        </div>

        {errors.length > 0 && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, padding: '8px 10px' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#b91c1c' }}>Detalle</span>
            <ul style={{ margin: '4px 0 0', paddingLeft: 18, fontSize: 11, color: '#7f1d1d' }}>
              {errors.slice(0, 12).map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          </div>
        )}

        {feedback && (
          <div style={{ fontSize: 11, padding: '8px 10px', borderRadius: 6, background: feedback.ok ? '#ecfdf5' : '#fef2f2', color: feedback.ok ? '#065f46' : '#7f1d1d' }}>
            {feedback.text}
          </div>
        )}

        {/* Acciones */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {canSend && (
            <button type="button" className="primary-button compact" onClick={() => run('send')} disabled={busy !== null} style={{ height: 32, fontSize: 11, padding: '0 12px' }}>
              <AppIcon name="refresh" size={13} className={busy === 'send' ? 'spin' : ''} />
              {busy === 'send' ? 'Procesando…' : state === 'PENDING' || state === 'NUMBERED' || state === 'BLOCKED_CONFIG' || state === 'XML_BUILT' ? 'Generar y enviar a la DIAN' : 'Reintentar envío a la DIAN'}
            </button>
          )}
          {state === 'SENT' && onCheckStatus && (
            <button type="button" className="primary-button compact" onClick={() => run('status')} disabled={busy !== null} style={{ height: 32, fontSize: 11, padding: '0 12px' }}>
              <AppIcon name="refresh" size={13} className={busy === 'status' ? 'spin' : ''} />
              {busy === 'status' ? 'Consultando…' : 'Consultar estado en la DIAN'}
            </button>
          )}
          {invoice.hasXml && (
            <button type="button" className="outline-button" onClick={() => onOpenXml(invoice)} style={{ height: 32, fontSize: 11, padding: '0 10px' }}>
              <AppIcon name="terminal" size={13} /> Ver XML
            </button>
          )}
          <a
            className="outline-button"
            href={`/facturacion/representacion/${invoice.id}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ height: 32, fontSize: 11, padding: '0 10px', display: 'inline-flex', alignItems: 'center', gap: 6, textDecoration: 'none' }}
          >
            <AppIcon name="print" size={13} /> Representación gráfica
          </a>
        </div>
      </div>
    </div>
  )
}
