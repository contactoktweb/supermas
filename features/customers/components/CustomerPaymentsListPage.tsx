'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { AppIcon } from '@/components/ui/Icon'
import { supabaseClient } from '@/lib/supabase/client'

function formatCOP(val: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(val || 0)
}

function formatDate(iso?: string): string {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    return d.toLocaleDateString('es-CO', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  } catch {
    return iso
  }
}

interface PaymentRow {
  id: string
  paymentNumber: string
  paymentDate: string
  amount: number
  paymentMethod: string
  reference?: string
  notes?: string
  saleNumber: string
  customerName: string
  customerDoc: string
  userName: string
}

export function CustomerPaymentsListPage() {
  const [payments, setPayments] = useState<PaymentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [totalAmount, setTotalAmount] = useState(0)

  const loadPayments = useCallback(async () => {
    try {
      setLoading(true)
      const { data, error } = await supabaseClient
        .from('customer_payments')
        .select(`
          id,
          payment_number,
          payment_date,
          amount,
          payment_method,
          transaction_reference,
          notes,
          sales (sale_number),
          customers (first_name, last_name, company_name, document_number),
          users:created_by_user_id (full_name)
        `)
        .order('payment_date', { ascending: false })

      if (error) throw error

      const mapped: PaymentRow[] = (data || []).map((row: any) => {
        const cust = row.customers || {}
        const sale = row.sales || {}
        const user = row.users || {}
        const customerName =
          cust.company_name ||
          [cust.first_name, cust.last_name].filter(Boolean).join(' ') ||
          'Cliente'

        return {
          id: row.id,
          paymentNumber: row.payment_number,
          paymentDate: row.payment_date,
          amount: Number(row.amount || 0),
          paymentMethod: row.payment_method,
          reference: row.transaction_reference || undefined,
          notes: row.notes || undefined,
          saleNumber: sale.sale_number || 'Venta',
          customerName,
          customerDoc: cust.document_number || '—',
          userName: user.full_name || 'Sistema',
        }
      })

      setPayments(mapped)
      setTotalAmount(mapped.reduce((acc, p) => acc + p.amount, 0))
    } catch (err: any) {
      console.error('Error cargando pagos recibidos:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadPayments()
  }, [loadPayments])

  const filtered = payments.filter((p) => {
    if (!query.trim()) return true
    const q = query.toLowerCase().trim()
    return (
      p.paymentNumber.toLowerCase().includes(q) ||
      p.customerName.toLowerCase().includes(q) ||
      p.customerDoc.includes(q) ||
      p.saleNumber.toLowerCase().includes(q) ||
      p.reference?.toLowerCase().includes(q)
    )
  })

  return (
    <div className="customer-payments-list-page page-enter" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--navy)', margin: 0, letterSpacing: '-0.5px' }}>
            Pagos Recibidos de Clientes
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--muted)' }}>
            Registro histórico de comprobantes de recaudo y abonos aplicados a cartera.
          </p>
        </div>

        <div style={{ padding: '10px 18px', background: '#ecfdf5', borderRadius: 10, border: '1px solid #a7f3d0' }}>
          <span style={{ fontSize: 11, color: '#065f46', fontWeight: 600 }}>Total Recaudado Histórico:</span>
          <strong style={{ display: 'block', fontSize: 18, color: '#047857' }}>{formatCOP(totalAmount)}</strong>
        </div>
      </div>

      {/* Filter Bar */}
      <div style={{ display: 'flex', gap: 10, padding: 12, background: '#ffffff', borderRadius: 12, border: '1.5px solid #cbd5e1' }}>
        <input
          type="text"
          className="filter-input"
          placeholder="Buscar por comprobante, cliente, documento, venta..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ width: '100%', maxWidth: 450 }}
        />
      </div>

      {/* Table */}
      <div className="table-container" style={{ background: '#ffffff', borderRadius: 14, border: '1.5px solid #cbd5e1', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>Cargando comprobantes de pago...</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 50, textAlign: 'center', color: 'var(--muted)' }}>
            <AppIcon name="receipt" size={32} />
            <p style={{ marginTop: 8, fontSize: 14 }}>No se encontraron comprobantes de recaudo.</p>
          </div>
        ) : (
          <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left', fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase' }}>
                <th style={{ padding: '12px 16px' }}>Comprobante / Fecha</th>
                <th style={{ padding: '12px 16px' }}>Cliente</th>
                <th style={{ padding: '12px 16px' }}>Venta Asociada</th>
                <th style={{ padding: '12px 16px' }}>Medio de Pago</th>
                <th style={{ padding: '12px 16px' }}>Referencia</th>
                <th style={{ padding: '12px 16px', textAlign: 'right' }}>Valor Recaudado</th>
                <th style={{ padding: '12px 16px' }}>Registrado Por</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.id} style={{ borderBottom: '1px solid #f1f5f9', fontSize: 13 }}>
                  <td style={{ padding: '14px 16px' }}>
                    <strong style={{ color: 'var(--navy)', display: 'block' }}>{row.paymentNumber}</strong>
                    <span style={{ fontSize: 11, color: 'var(--muted)' }}>{formatDate(row.paymentDate)}</span>
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <strong style={{ display: 'block', color: 'var(--navy)' }}>{row.customerName}</strong>
                    <span style={{ fontSize: 11, color: 'var(--muted)' }}>{row.customerDoc}</span>
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <span style={{ fontWeight: 600, color: '#0369a1' }}>{row.saleNumber}</span>
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <span className="status-badge" style={{ background: '#f1f5f9', color: '#334155' }}>
                      {row.paymentMethod}
                    </span>
                  </td>
                  <td style={{ padding: '14px 16px', color: '#64748b' }}>
                    {row.reference || '—'}
                  </td>
                  <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                    <strong style={{ color: '#047857', fontSize: 14 }}>{formatCOP(row.amount)}</strong>
                  </td>
                  <td style={{ padding: '14px 16px', color: 'var(--muted)', fontSize: 12 }}>
                    {row.userName}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
