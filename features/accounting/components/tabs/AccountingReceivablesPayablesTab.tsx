'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { AppIcon } from '@/components/ui/Icon'
import { AccountsReceivableItem, AccountsPayableItem } from '../../types'

interface AccountingReceivablesPayablesTabProps {
  receivables: AccountsReceivableItem[]
  payables: AccountsPayableItem[]
}

export function AccountingReceivablesPayablesTab({
  receivables,
  payables,
}: AccountingReceivablesPayablesTabProps) {
  const [activeSection, setActiveSection] = useState<'CXC' | 'CXP'>('CXC')
  const [query, setQuery] = useState('')

  const formatDate = (isoStr: string) => {
    try {
      return new Date(isoStr).toLocaleDateString('es-CO', {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
      })
    } catch {
      return isoStr
    }
  }

  const totalCxc = receivables.reduce((acc, r) => acc + r.pendingBalance, 0)
  const totalCxp = payables.reduce((acc, p) => acc + p.pendingBalance, 0)

  const filteredReceivables = receivables.filter(
    (r) =>
      r.customerName.toLowerCase().includes(query.toLowerCase()) ||
      r.customerDoc.toLowerCase().includes(query.toLowerCase()) ||
      r.invoiceNumber.toLowerCase().includes(query.toLowerCase())
  )

  const filteredPayables = payables.filter(
    (p) =>
      p.supplierName.toLowerCase().includes(query.toLowerCase()) ||
      p.supplierDoc.toLowerCase().includes(query.toLowerCase()) ||
      p.purchaseNumber.toLowerCase().includes(query.toLowerCase())
  )

  return (
    <div className="space-y-4 page-enter">
      {/* Selector de Cartera CxC vs CxP */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-white rounded-xl border border-gray-100 shadow-sm">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Control de Cartera Comercial y Compromisos</h2>
          <p className="text-xs text-gray-500">
            Monitoreo en tiempo real de cuentas por cobrar (clientes) y cuentas por pagar (proveedores)
          </p>
        </div>

        <div className="flex items-center gap-2 p-1 bg-gray-100 rounded-lg">
          <button
            type="button"
            className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all flex items-center gap-1.5 ${
              activeSection === 'CXC'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
            onClick={() => setActiveSection('CXC')}
          >
            <AppIcon name="customers" size={14} />
            <span>Cuentas por Cobrar (${totalCxc.toLocaleString('es-CO')})</span>
          </button>
          <button
            type="button"
            className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all flex items-center gap-1.5 ${
              activeSection === 'CXP'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
            onClick={() => setActiveSection('CXP')}
          >
            <AppIcon name="suppliers" size={14} />
            <span>Cuentas por Pagar (${totalCxp.toLocaleString('es-CO')})</span>
          </button>
        </div>
      </div>

      {/* Banner de Integración con Módulo de Tesorería */}
      <div className="bg-gradient-to-r from-blue-900 to-indigo-900 text-white rounded-xl p-4 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-white/10 rounded-lg backdrop-blur-xs">
            <AppIcon name="wallet" size={20} className="text-blue-300" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Módulo de Tesorería Integrado</h3>
            <p className="text-xs text-blue-200 mt-0.5 max-w-2xl">
              La programación y dispersión de pagos a proveedores (CXP), así como la recaudación de cartera (CXC) y conciliaciones bancarias se gestionan de forma centralizada e independiente en <strong className="text-white">Tesorería</strong>. Cada egreso o ingreso genera automáticamente el asiento contable con su afectación bancaria.
            </p>
          </div>
        </div>
        <Link
          href="/tesoreria"
          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-white text-blue-900 font-semibold text-xs hover:bg-blue-50 transition-colors shadow-xs"
        >
          <AppIcon name="wallet" size={14} />
          <span>Ir a Tesorería</span>
        </Link>
      </div>

      {/* Barra de Búsqueda */}
      <div className="search-box max-w-md">
        <AppIcon name="search" size={16} />
        <input
          placeholder={
            activeSection === 'CXC'
              ? 'Buscar cliente, NIT o factura...'
              : 'Buscar proveedor, NIT o número de compra...'
          }
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {/* Tabla según la sección activa */}
      {activeSection === 'CXC' ? (
        <div className="table-panel animated-table">
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Cliente y Documento</th>
                  <th style={{ width: 140 }}>Factura</th>
                  <th style={{ width: 110 }}>Emisión</th>
                  <th style={{ width: 110 }}>Vencimiento</th>
                  <th style={{ width: 120, textAlign: 'right' }}>Total Factura</th>
                  <th style={{ width: 120, textAlign: 'right' }}>Abonos</th>
                  <th style={{ width: 130, textAlign: 'right' }}>Saldo Pendiente</th>
                  <th style={{ width: 110 }}>Estado</th>
                </tr>
              </thead>
              <tbody>
                {filteredReceivables.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-8 text-gray-500">
                      No hay cuentas por cobrar pendientes.
                    </td>
                  </tr>
                ) : (
                  filteredReceivables.map((r) => (
                    <tr key={r.invoiceId} className="hover:bg-blue-50/40 transition-colors">
                      <td>
                        <div className="flex flex-col">
                          <strong className="text-xs text-gray-900 font-semibold">{r.customerName}</strong>
                          <span className="text-[11px] text-gray-500 font-mono">{r.customerDoc}</span>
                        </div>
                      </td>
                      <td>
                        <span className="font-mono text-xs font-bold text-blue-900 bg-blue-50 px-2 py-0.5 rounded">
                          {r.invoiceNumber}
                        </span>
                      </td>
                      <td>
                        <span className="text-xs text-gray-600">{formatDate(r.date)}</span>
                      </td>
                      <td>
                        <span
                          className={`text-xs font-semibold ${
                            r.status === 'CRITICAL'
                              ? 'text-rose-600'
                              : r.status === 'OVERDUE'
                              ? 'text-amber-600'
                              : 'text-gray-700'
                          }`}
                        >
                          {formatDate(r.dueDate)}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <span className="font-mono text-xs text-gray-800">
                          ${r.total.toLocaleString('es-CO')}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <span className="font-mono text-xs text-emerald-700 font-medium">
                          ${r.paidAmount.toLocaleString('es-CO')}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <span className="font-mono text-xs font-bold text-blue-900">
                          ${r.pendingBalance.toLocaleString('es-CO')}
                        </span>
                      </td>
                      <td>
                        {r.status === 'CRITICAL' ? (
                          <span className="badge badge-red font-semibold">Vencida (+30d)</span>
                        ) : r.status === 'OVERDUE' ? (
                          <span className="badge badge-amber font-semibold">Vencida</span>
                        ) : (
                          <span className="badge badge-teal font-semibold">Al día</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="table-panel animated-table">
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Proveedor y NIT</th>
                  <th style={{ width: 140 }}>Orden Compra</th>
                  <th style={{ width: 130 }}>Fact. Proveedor</th>
                  <th style={{ width: 110 }}>Emisión</th>
                  <th style={{ width: 110 }}>Vencimiento</th>
                  <th style={{ width: 120, textAlign: 'right' }}>Total Facturado</th>
                  <th style={{ width: 120, textAlign: 'right' }}>Pagos Hechos</th>
                  <th style={{ width: 130, textAlign: 'right' }}>Saldo por Pagar</th>
                  <th style={{ width: 110 }}>Estado</th>
                </tr>
              </thead>
              <tbody>
                {filteredPayables.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center py-8 text-gray-500">
                      No hay cuentas por pagar a proveedores registradas.
                    </td>
                  </tr>
                ) : (
                  filteredPayables.map((p) => (
                    <tr key={p.purchaseId} className="hover:bg-blue-50/40 transition-colors">
                      <td>
                        <div className="flex flex-col">
                          <strong className="text-xs text-gray-900 font-semibold">{p.supplierName}</strong>
                          <span className="text-[11px] text-gray-500 font-mono">{p.supplierDoc}</span>
                        </div>
                      </td>
                      <td>
                        <span className="font-mono text-xs font-bold text-blue-900 bg-blue-50 px-2 py-0.5 rounded">
                          {p.purchaseNumber}
                        </span>
                      </td>
                      <td>
                        <span className="font-mono text-xs text-gray-700">
                          {p.supplierInvoiceNumber || '—'}
                        </span>
                      </td>
                      <td>
                        <span className="text-xs text-gray-600">{formatDate(p.date)}</span>
                      </td>
                      <td>
                        <span
                          className={`text-xs font-semibold ${
                            p.status === 'CRITICAL'
                              ? 'text-rose-600'
                              : p.status === 'OVERDUE'
                              ? 'text-amber-600'
                              : 'text-gray-700'
                          }`}
                        >
                          {formatDate(p.dueDate)}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <span className="font-mono text-xs text-gray-800">
                          ${p.total.toLocaleString('es-CO')}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <span className="font-mono text-xs text-emerald-700 font-medium">
                          ${p.paidAmount.toLocaleString('es-CO')}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <span className="font-mono text-xs font-bold text-rose-900">
                          ${p.pendingBalance.toLocaleString('es-CO')}
                        </span>
                      </td>
                      <td>
                        {p.status === 'CRITICAL' ? (
                          <span className="badge badge-red font-semibold">Vencida (+30d)</span>
                        ) : p.status === 'OVERDUE' ? (
                          <span className="badge badge-amber font-semibold">Por vencer</span>
                        ) : (
                          <span className="badge badge-teal font-semibold">Al día</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
