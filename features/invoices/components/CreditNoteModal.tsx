'use client'

/**
 * Emisión de Nota Crédito / Nota Débito electrónica (DIAN) sobre una factura ACEPTADA.
 *
 * El navegador solo arma la solicitud: el servidor numera (consecutivo atómico), valida contra
 * la factura (no se acredita más de lo facturado), contabiliza, calcula el CUDE, firma y envía.
 * El inventario NO lo mueve la nota: si la mercancía vuelve, se registra primero en Devoluciones
 * y se elige aquí esa devolución.
 */

import React, { useEffect, useMemo, useState } from 'react'
import { AppIcon } from '@/components/ui/Icon'
import { CustomSelect } from '@/components/ui/CustomSelect'
import { Invoice } from '../types'
import { CREDIT_NOTE_CONCEPTS, DEBIT_NOTE_CONCEPTS } from '../services/dian/dian-concepts'
import { DianNoteRequest } from '../services/dian-api.client'
import { invoiceRepository } from '../repositories/invoice.repository'

interface CreditNoteModalProps {
  isOpen: boolean
  invoice: Invoice | null
  onClose: () => void
  /** Emite la nota con la clave de idempotencia del formulario */
  onCreateNote: (note: DianNoteRequest, idempotencyKey: string) => Promise<{ message?: string; documentNumber?: string } | void>
}

type NoteType = 'CREDIT_NOTE' | 'DEBIT_NOTE'
type CreditMode = 'QUANTITY' | 'VALUE'

interface CreditRow {
  saleItemId: string
  label: string
  maxQuantity: number
  unitPrice: number
  netAmount: number
  taxRatePercent: number
  taxCode: string
  quantity: number
  value: number
  selected: boolean
}

interface DebitRow {
  description: string
  quantity: number
  unitPrice: number
  iva: 'IVA_19' | 'IVA_5' | 'EXENTO' | 'EXCLUIDO'
}

const formatCOP = (val: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 2 }).format(val)

const IVA_RATE: Record<DebitRow['iva'], number> = { IVA_19: 19, IVA_5: 5, EXENTO: 0, EXCLUIDO: 0 }

const newKey = () => {
  try {
    return `NOTE-${crypto.randomUUID()}`
  } catch {
    return `NOTE-${Date.now()}-${Math.random().toString(16).slice(2)}`
  }
}

const label: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--navy)', marginBottom: 6 }
const input: React.CSSProperties = { width: '100%', height: 34, padding: '0 10px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13 }

export function CreditNoteModal({ isOpen, invoice, onClose, onCreateNote }: CreditNoteModalProps) {
  const [noteType, setNoteType] = useState<NoteType>('CREDIT_NOTE')
  const [concept, setConcept] = useState('1')
  const [reason, setReason] = useState('')
  const [creditMode, setCreditMode] = useState<CreditMode>('QUANTITY')
  const [rows, setRows] = useState<CreditRow[]>([])
  const [debitRows, setDebitRows] = useState<DebitRow[]>([{ description: '', quantity: 1, unitPrice: 0, iva: 'IVA_19' }])
  const [returns, setReturns] = useState<Array<{ id: string; code: string; date: string; total: number; linked: boolean; status: string }>>([])
  const [returnId, setReturnId] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)
  const [idemKey, setIdemKey] = useState(newKey)
  // Clave de idempotencia ligada al contenido: si el usuario cambia la nota tras un error, es otra solicitud.
  const [lastPayload, setLastPayload] = useState<string | null>(null)

  // Reinicio del formulario solo al abrir o al cambiar de factura (no cuando llega el detalle completo).
  useEffect(() => {
    if (!isOpen || !invoice) return
    setNoteType('CREDIT_NOTE')
    setConcept('1')
    setReason('')
    setCreditMode('QUANTITY')
    setReturnId('')
    setError(null)
    setDone(null)
    setIdemKey(newKey())
    setLastPayload(null)
    setDebitRows([{ description: '', quantity: 1, unitPrice: 0, iva: 'IVA_19' }])
    if (invoice.saleId) {
      invoiceRepository.listReturnsForSale(invoice.saleId).then(setReturns).catch(() => setReturns([]))
    } else {
      setReturns([])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, invoice?.id])

  // Líneas de la factura: se cargan cuando llega el detalle; no borran lo que el usuario ya marcó.
  useEffect(() => {
    if (!isOpen || !invoice) return
    setRows((prev) => {
      if (prev.length && prev.some((r) => r.selected) && prev[0] && (invoice.items || []).some((it) => it.id === prev[0].saleItemId)) return prev
      return (
      (invoice.items || []).map((it) => ({
        saleItemId: it.id,
        label: `${it.sku ? it.sku + ' · ' : ''}${it.productName}`,
        maxQuantity: it.quantity,
        unitPrice: it.unitPrice,
        netAmount: it.subtotal,
        taxRatePercent: it.taxRatePercent,
        taxCode: it.taxCode,
        quantity: 0,
        value: 0,
        selected: false,
      }))
      )
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, invoice?.id, invoice?.items])

  // Los conceptos determinan cómo se acredita
  useEffect(() => {
    if (noteType === 'CREDIT_NOTE') {
      if (concept === '1') setCreditMode('QUANTITY')
      else if (concept !== '2') setCreditMode('VALUE')
      if (concept !== '1') setReturnId('')
    }
    setError(null)
  }, [noteType, concept])

  const isAnnulment = noteType === 'CREDIT_NOTE' && concept === '2'
  const usesReturn = noteType === 'CREDIT_NOTE' && concept === '1' && Boolean(returnId)

  const preview = useMemo(() => {
    if (noteType === 'DEBIT_NOTE') {
      let net = 0
      let tax = 0
      for (const r of debitRows) {
        const n = Math.round(r.quantity * r.unitPrice * 100) / 100
        net += n
        tax += Math.round(n * IVA_RATE[r.iva]) / 100
      }
      return { net, tax, total: net + tax }
    }
    if (isAnnulment) {
      const net = rows.reduce((s, r) => s + r.netAmount, 0)
      const tax = rows.reduce((s, r) => s + Math.round(r.netAmount * r.taxRatePercent) / 100, 0)
      return { net, tax, total: net + tax }
    }
    if (usesReturn) return null // lo calcula el servidor con las cantidades de la devolución
    let net = 0
    let tax = 0
    for (const r of rows) {
      if (!r.selected) continue
      const n = creditMode === 'QUANTITY' ? Math.round((r.netAmount * r.quantity * 100) / r.maxQuantity) / 100 : r.value
      net += n
      tax += Math.round(n * r.taxRatePercent) / 100
    }
    return { net, tax, total: net + tax }
  }, [noteType, debitRows, rows, isAnnulment, usesReturn, creditMode])

  if (!isOpen || !invoice) return null

  const accepted = invoice.transmissionState === 'ACCEPTED'
  const linesLoaded = rows.length > 0
  const concepts = noteType === 'CREDIT_NOTE' ? CREDIT_NOTE_CONCEPTS : DEBIT_NOTE_CONCEPTS
  const hasPreviousNotes = (invoice.relatedNotes || []).some((n) => n.type === 'NOTA_CREDITO')

  const updateRow = (id: string, patch: Partial<CreditRow>) =>
    setRows((prev) => prev.map((r) => (r.saleItemId === id ? { ...r, ...patch } : r)))

  const buildRequest = (): DianNoteRequest => {
    const base = { originalInvoiceId: invoice.id, documentType: noteType, conceptCode: concept, reason: reason.trim() }
    if (noteType === 'DEBIT_NOTE') {
      return {
        ...base,
        lines: debitRows.map((r) => ({
          description: r.description.trim(),
          quantity: Number(r.quantity),
          unit_price: Number(r.unitPrice),
          iva: r.iva,
        })),
      }
    }
    if (isAnnulment) return { ...base, lines: [] }
    if (usesReturn) return { ...base, lines: [], returnId }
    const selected = rows.filter((r) => r.selected)
    return {
      ...base,
      lines: selected.map((r) =>
        creditMode === 'QUANTITY'
          ? { sale_item_id: r.saleItemId, quantity: Number(r.quantity) }
          : { sale_item_id: r.saleItemId, net_amount: Number(r.value) }
      ),
    }
  }

  const validate = (): string | null => {
    if (!accepted) return 'La factura debe estar ACEPTADA por la DIAN antes de emitirle notas.'
    if (reason.trim().length < 5) return 'Escriba el motivo de la nota (mínimo 5 caracteres).'
    if (noteType === 'DEBIT_NOTE') {
      for (const r of debitRows) {
        if (!r.description.trim()) return 'Cada línea de la nota débito necesita descripción.'
        if (!(r.quantity > 0) || !(r.unitPrice > 0)) return 'Cantidad y valor unitario deben ser mayores a cero.'
      }
      return null
    }
    if (isAnnulment) return hasPreviousNotes ? 'La factura ya tiene notas crédito: no se puede anular completa.' : null
    if (usesReturn) return null
    const selected = rows.filter((r) => r.selected)
    if (!selected.length) return 'Seleccione al menos un producto.'
    for (const r of selected) {
      if (creditMode === 'QUANTITY' && !(r.quantity > 0 && r.quantity <= r.maxQuantity)) return `Cantidad inválida para ${r.label}.`
      if (creditMode === 'VALUE' && !(r.value > 0 && r.value <= r.netAmount)) return `Valor inválido para ${r.label} (máximo ${formatCOP(r.netAmount)} antes de IVA).`
    }
    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const problem = validate()
    if (problem) {
      setError(problem)
      return
    }
    try {
      setSubmitting(true)
      setError(null)
      const request = buildRequest()
      const payload = JSON.stringify(request)
      let key = idemKey
      if (lastPayload !== null && lastPayload !== payload) {
        key = newKey()
        setIdemKey(key)
      }
      setLastPayload(payload)
      const res = await onCreateNote(request, key)
      setDone(res && (res as any).message ? `${(res as any).documentNumber || ''} ${(res as any).message}`.trim() : 'Nota emitida.')
    } catch (err: any) {
      setError(err?.message || 'No se pudo emitir la nota.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="drawer-backdrop modal-center" onClick={onClose}>
      <div
        className="modal-card animate-scale-up"
        onClick={(e) => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 760, maxHeight: '92vh', display: 'flex', flexDirection: 'column', background: '#fff', borderRadius: 14, overflow: 'hidden' }}
      >
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 800, color: 'var(--navy)', margin: 0 }}>Nota crédito / débito electrónica</h2>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>
              Factura {invoice.invoiceNumber} · {invoice.customerName} · {formatCOP(invoice.total)}
            </span>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Cerrar" style={{ width: 32, height: 32 }}>
            <AppIcon name="close" size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: 20, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {!accepted && (
            <div style={{ padding: '10px 14px', borderRadius: 8, background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e', fontSize: 12 }}>
              La DIAN aún no ha aceptado esta factura (estado: {invoice.transmissionState}). Las notas solo se emiten sobre facturas aceptadas.
            </div>
          )}
          {error && (
            <div style={{ padding: '10px 14px', borderRadius: 8, background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', fontSize: 12 }}>{error}</div>
          )}
          {done && (
            <div style={{ padding: '10px 14px', borderRadius: 8, background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#065f46', fontSize: 12 }}>
              {done} Puede cerrar esta ventana; la nota aparece en el listado con su estado DIAN.
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
            <div>
              <span style={label}>Tipo de nota *</span>
              <CustomSelect
                value={noteType}
                onChange={(v) => {
                  setNoteType(v as NoteType)
                  setConcept('1')
                }}
                options={[
                  { value: 'CREDIT_NOTE', label: 'Nota crédito (disminuye la factura)' },
                  { value: 'DEBIT_NOTE', label: 'Nota débito (aumenta la factura)' },
                ]}
              />
            </div>
            <div>
              <span style={label}>Concepto de corrección DIAN *</span>
              <CustomSelect
                value={concept}
                onChange={setConcept}
                options={Object.entries(concepts).map(([code, text]) => ({ value: code, label: `${code}. ${text}` }))}
              />
            </div>
          </div>

          <div>
            <span style={label}>Motivo (queda en la nota y en la auditoría) *</span>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              maxLength={500}
              placeholder="Ej.: El cliente devolvió 2 unidades en mal estado."
              style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13, resize: 'vertical' }}
            />
          </div>

          {noteType === 'CREDIT_NOTE' && concept === '1' && (
            <div>
              <span style={label}>¿La mercancía volvió al inventario?</span>
              <CustomSelect
                value={returnId}
                onChange={setReturnId}
                options={[
                  { value: '', label: 'No / elegir productos y cantidades aquí (no mueve inventario)' },
                  ...returns
                    .filter((r) => !r.linked && r.status === 'COMPLETED')
                    .map((r) => ({ value: r.id, label: `Devolución ${r.code} · ${new Date(r.date).toLocaleDateString('es-CO')} · ${formatCOP(r.total)}` })),
                ]}
              />
              <p style={{ margin: '6px 0 0', fontSize: 11, color: '#64748b' }}>
                Si el cliente devolvió productos, regístrelos primero en <b>Devoluciones</b> (eso mueve el inventario) y elíjala aquí: la nota toma
                esas cantidades y reversa el costo de ventas.
              </p>
            </div>
          )}

          {noteType === 'CREDIT_NOTE' && isAnnulment && (
            <div style={{ padding: '10px 14px', borderRadius: 8, background: '#f8fafc', border: '1px solid #e2e8f0', fontSize: 12, color: '#334155' }}>
              La nota acredita la factura completa ({rows.length} líneas). Si la mercancía regresa, regístrela también en Devoluciones.
            </div>
          )}

          {noteType === 'CREDIT_NOTE' && !isAnnulment && !usesReturn && (
            <div>
              <span style={label}>{creditMode === 'QUANTITY' ? 'Unidades a acreditar por producto' : 'Valor a acreditar por producto (antes de IVA)'}</span>
              <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
                {rows.map((r) => (
                  <div key={r.saleItemId} style={{ display: 'grid', gridTemplateColumns: '24px minmax(0,1fr) 120px 110px', gap: 10, alignItems: 'center', padding: '8px 10px', borderBottom: '1px solid #f1f5f9' }}>
                    <input type="checkbox" checked={r.selected} onChange={(e) => updateRow(r.saleItemId, { selected: e.target.checked })} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--navy)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.label}</div>
                      <div style={{ fontSize: 11, color: '#64748b' }}>
                        Facturado: {r.maxQuantity} × {formatCOP(r.unitPrice)} · neto {formatCOP(r.netAmount)} ·{' '}
                        {r.taxRatePercent > 0 ? `IVA ${r.taxRatePercent}%` : r.taxCode === 'EXCLUIDO' ? 'Excluido' : 'Exento'}
                      </div>
                    </div>
                    {creditMode === 'QUANTITY' ? (
                      <input
                        type="number"
                        min={0}
                        max={r.maxQuantity}
                        step="0.01"
                        value={r.quantity || ''}
                        placeholder="0"
                        onChange={(e) => updateRow(r.saleItemId, { quantity: Number(e.target.value) || 0, selected: Number(e.target.value) > 0 })}
                        style={input}
                      />
                    ) : (
                      <input
                        type="number"
                        min={0}
                        max={r.netAmount}
                        step="0.01"
                        value={r.value || ''}
                        placeholder="0"
                        onChange={(e) => updateRow(r.saleItemId, { value: Number(e.target.value) || 0, selected: Number(e.target.value) > 0 })}
                        style={input}
                      />
                    )}
                    <span style={{ fontSize: 11, color: '#64748b', textAlign: 'right' }}>{creditMode === 'QUANTITY' ? `máx. ${r.maxQuantity}` : `máx. ${formatCOP(r.netAmount)}`}</span>
                  </div>
                ))}
              </div>
              <p style={{ margin: '6px 0 0', fontSize: 11, color: '#64748b' }}>
                El servidor verifica que, sumando notas anteriores, no se acredite más de lo facturado.
              </p>
            </div>
          )}

          {noteType === 'DEBIT_NOTE' && (
            <div>
              <span style={label}>Cargos adicionales</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {debitRows.map((r, idx) => (
                  <div key={idx} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 80px 120px 150px 32px', gap: 8, alignItems: 'center' }}>
                    <input
                      value={r.description}
                      maxLength={300}
                      placeholder="Descripción (ej. intereses de mora)"
                      onChange={(e) => setDebitRows((p) => p.map((x, i) => (i === idx ? { ...x, description: e.target.value } : x)))}
                      style={input}
                    />
                    <input
                      type="number"
                      min={0.01}
                      step="0.01"
                      value={r.quantity || ''}
                      onChange={(e) => setDebitRows((p) => p.map((x, i) => (i === idx ? { ...x, quantity: Number(e.target.value) || 0 } : x)))}
                      style={input}
                      aria-label="Cantidad"
                    />
                    <input
                      type="number"
                      min={0.01}
                      step="0.01"
                      value={r.unitPrice || ''}
                      placeholder="Valor unitario"
                      onChange={(e) => setDebitRows((p) => p.map((x, i) => (i === idx ? { ...x, unitPrice: Number(e.target.value) || 0 } : x)))}
                      style={input}
                      aria-label="Valor unitario antes de IVA"
                    />
                    <CustomSelect
                      size="sm"
                      value={r.iva}
                      onChange={(v) => setDebitRows((p) => p.map((x, i) => (i === idx ? { ...x, iva: v as DebitRow['iva'] } : x)))}
                      options={[
                        { value: 'IVA_19', label: 'IVA 19%' },
                        { value: 'IVA_5', label: 'IVA 5%' },
                        { value: 'EXENTO', label: 'Exento (0%)' },
                        { value: 'EXCLUIDO', label: 'Excluido' },
                      ]}
                    />
                    <button
                      type="button"
                      className="icon-button"
                      disabled={debitRows.length === 1}
                      onClick={() => setDebitRows((p) => p.filter((_, i) => i !== idx))}
                      aria-label="Quitar línea"
                      style={{ width: 32, height: 32 }}
                    >
                      <AppIcon name="close" size={14} />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className="outline-button"
                  onClick={() => setDebitRows((p) => [...p, { description: '', quantity: 1, unitPrice: 0, iva: 'IVA_19' }])}
                  style={{ alignSelf: 'flex-start', height: 30, fontSize: 11, padding: '0 10px' }}
                >
                  + Agregar línea
                </button>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderRadius: 8, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
            <span style={{ fontSize: 12, color: '#334155' }}>
              {preview
                ? `Base ${formatCOP(preview.net)} · IVA ${formatCOP(preview.tax)}`
                : 'El valor se calcula con las cantidades de la devolución elegida.'}
            </span>
            <strong style={{ fontSize: 16, color: noteType === 'CREDIT_NOTE' ? 'var(--red)' : 'var(--navy)' }}>
              {preview ? `${noteType === 'CREDIT_NOTE' ? '−' : '+'}${formatCOP(preview.total)}` : '—'}
            </strong>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button type="button" className="outline-button" onClick={onClose} style={{ height: 36 }}>
              {done ? 'Cerrar' : 'Cancelar'}
            </button>
            {!done && (
              <button type="submit" className="primary-button" disabled={submitting || !accepted || (noteType === 'CREDIT_NOTE' && !linesLoaded)} style={{ height: 36 }}>
                {submitting ? 'Emitiendo…' : `Emitir ${noteType === 'CREDIT_NOTE' ? 'nota crédito' : 'nota débito'}`}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}
