'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { AppIcon } from '@/components/ui/Icon'
import { PageHeader } from '@/components/ui/PageHeader'
import { KpiCard } from '@/components/ui/KpiCard'
import { supabaseClient } from '@/lib/supabase/client'
import { displayLabel, PAYMENT_METHOD_LABELS } from '@/lib/labels/display-labels'

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

  const monthPrefix = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' }).slice(0, 7)
  const collectedThisMonth = payments
    .filter((p) => (p.paymentDate || '').slice(0, 7) === monthPrefix)
    .reduce((acc, p) => acc + p.amount, 0)
  const customersCount = new Set(payments.map((p) => p.customerDoc)).size

  return (
    <div className="products-module-wrapper customer-payments-module-wrapper page-enter">
      <PageHeader
        eyebrow="Clientes y cartera"
        title="Pagos Recibidos"
        subtitle="Comprobantes de recaudo y abonos que los clientes aplicaron a su cartera."
        actions={
          <button type="button" className="outline-button" onClick={() => loadPayments()} disabled={loading}>
            <AppIcon name="refresh" size={15} className={loading ? 'spin' : ''} />
            <span>Actualizar</span>
          </button>
        }
      />

      <section className="stats-grid dashboard-primary-grid page-enter" aria-label="Métricas de pagos recibidos">
        <KpiCard
          title="Total recaudado"
          value={loading ? '...' : formatCOP(totalAmount)}
          iconName="wallet"
          tone="blue"
          badge="Histórico"
          note={`${payments.length} comprobantes`}
          subtext="Abonos aplicados a cartera"
          index={1}
        />
        <KpiCard
          title="Recaudado este mes"
          value={loading ? '...' : formatCOP(collectedThisMonth)}
          iconName="receipt"
          tone="teal"
          badge="Mes actual"
          note="Ingresos a caja y bancos"
          subtext="Comprobantes del mes"
          index={2}
        />
        <KpiCard
          title="Clientes que pagaron"
          value={loading ? '...' : customersCount}
          iconName="users"
          tone="purple"
          badge="Clientes"
          note="Con al menos un abono"
          subtext="En el histórico"
          index={3}
        />
        <KpiCard
          title="Abono promedio"
          value={loading ? '...' : formatCOP(payments.length ? totalAmount / payments.length : 0)}
          iconName="pieChart"
          tone="amber"
          badge="Promedio"
          note="Por comprobante"
          subtext="Valor medio recaudado"
          index={4}
        />
      </section>

      <div className="products-toolbar toolbar inventory-toolbar flex-wrap">
        <div className="products-search-box search-box flex-1 min-w-[220px]">
          <AppIcon name="search" size={16} className="search-icon" />
          <input
            type="text"
            aria-label="Buscar pagos recibidos"
            placeholder="Buscar por comprobante, cliente, documento o venta..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button type="button" className="search-clear-btn" onClick={() => setQuery('')} title="Limpiar búsqueda">
              <AppIcon name="close" size={13} />
            </button>
          )}
        </div>
      </div>

      <div className="table-panel products-table-panel page-enter">
        {loading ? (
          <p role="status" style={{ margin: 0, padding: 40, textAlign: 'center', color: 'var(--muted)' }}>
            Cargando comprobantes de pago...
          </p>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 50, textAlign: 'center', color: 'var(--muted)' }}>
            <AppIcon name="receipt" size={32} />
            <p style={{ marginTop: 8, fontSize: 14 }}>No se encontraron comprobantes de recaudo.</p>
          </div>
        ) : (
          <div className="table-scroll" tabIndex={0} aria-label="Tabla de pagos recibidos">
            <table className="products-table">
              <thead>
                <tr>
                  <th style={{ minWidth: 150 }}>Comprobante</th>
                  <th style={{ minWidth: 200 }}>Cliente</th>
                  <th style={{ minWidth: 140 }}>Venta asociada</th>
                  <th style={{ minWidth: 130 }}>Medio de pago</th>
                  <th style={{ minWidth: 120 }}>Referencia</th>
                  <th style={{ minWidth: 130, textAlign: 'right' }}>Valor recaudado</th>
                  <th style={{ minWidth: 140 }}>Registrado por</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr key={row.id} className="table-row-hover">
                    <td className="product-code-col">
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <span className="sku-badge" style={{ fontWeight: 700 }}>{row.paymentNumber}</span>
                        <span style={{ fontSize: 11, color: 'var(--muted)' }}>{formatDate(row.paymentDate)}</span>
                      </div>
                    </td>
                    <td>
                      <div className="product-info-cell">
                        <strong className="product-name-text" style={{ fontSize: 13 }}>{row.customerName}</strong>
                        <span className="sku-meta-text">{row.customerDoc}</span>
                      </div>
                    </td>
                    <td>
                      <span style={{ fontWeight: 600, color: '#0369a1', fontSize: 12 }}>{row.saleNumber}</span>
                    </td>
                    <td>
                      <span className="kardex-type-badge type-badge-blue">{displayLabel(PAYMENT_METHOD_LABELS, row.paymentMethod)}</span>
                    </td>
                    <td style={{ color: '#64748b', fontSize: 12 }}>{row.reference || '—'}</td>
                    <td style={{ textAlign: 'right' }}>
                      <strong style={{ color: '#047857', fontSize: 14 }}>{formatCOP(row.amount)}</strong>
                    </td>
                    <td style={{ color: 'var(--muted)', fontSize: 12 }}>{row.userName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
