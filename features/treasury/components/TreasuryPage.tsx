'use client'

import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useTreasury, TreasuryTab } from '../hooks/useTreasury'
import { AppIcon, LightIconName } from '@/components/ui/Icon'
import { ScrollableTabs } from '@/components/ui/ScrollableTabs'
import Link from 'next/link'

const TABS: { id: TreasuryTab; label: string; icon: LightIconName }[] = [
  { id: 'banks', label: 'Cuentas Bancarias y Saldos', icon: 'wallet' },
  { id: 'payments', label: 'Pagos a Proveedores (Egresos)', icon: 'creditCard' },
  { id: 'receipts', label: 'Recaudos de Clientes (Ingresos)', icon: 'receipt' },
  { id: 'flow', label: 'Flujo y Enlace Contable', icon: 'accounting' },
]

export function TreasuryPage() {
  const {
    activeTab,
    setActiveTab,
    isLoading,
    error,
    stats,
    bankAccounts,
    payments,
    receipts,
    filters,
    setFilters,
    loadData,
    executePayment,
  } = useTreasury()

  const [executingPaymentId, setExecutingPaymentId] = useState<string | null>(null)
  const [selectedBankId, setSelectedBankId] = useState<string>('bank-001')
  const [refNumber, setRefNumber] = useState<string>('')
  const [successToast, setSuccessToast] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const handleExecutePayment = async (paymentId: string) => {
    try {
      setActionError(null)
      const res = await executePayment(paymentId, {
        paymentDate: new Date().toISOString().slice(0, 10),
        bankAccountId: selectedBankId,
        referenceNumber: refNumber || `TRF-${Math.floor(100000 + Math.random() * 900000)}`,
        supportDocumentUrl: '/comprobantes/egreso-bancario.pdf',
      })
      setExecutingPaymentId(null)
      setSuccessToast(
        `Pago ${res.paymentNumber} ejecutado exitosamente. Se generó el comprobante contable ${res.accountingEntryNumber} (Débito: Proveedores / Crédito: Banco).`
      )
      setTimeout(() => setSuccessToast(null), 6000)
    } catch (err: any) {
      setActionError(err.message || 'Error al ejecutar el desembolso.')
    }
  }

  const formatCOP = (val: number) => `$${(Number(val) || 0).toLocaleString('es-CO')} COP`

  return (
    <div className="treasury-module page-enter space-y-6">
      {/* Toast Notification */}
      {successToast && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center justify-between shadow-sm animate-fade-in">
          <div className="flex items-center gap-2">
            <AppIcon name="check" size={18} />
            <span>{successToast}</span>
          </div>
          <button
            type="button"
            className="text-emerald-700 hover:text-emerald-900 font-bold"
            onClick={() => setSuccessToast(null)}
          >
            ×
          </button>
        </div>
      )}

      {actionError && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2">
            <AppIcon name="warning" size={18} />
            <span>{actionError}</span>
          </div>
          <button
            type="button"
            className="text-rose-700 hover:text-rose-900 font-bold"
            onClick={() => setActionError(null)}
          >
            ×
          </button>
        </div>
      )}

      {/* Header Principal */}
      <header className="page-heading">
        <div>
          <p className="eyebrow">ERP Financiero</p>
          <h1>Tesorería</h1>
          <p className="welcome-subtitle">
            Gestión independiente de pagos a proveedores, recaudos, cuentas bancarias y flujo de caja con contabilización automática.
          </p>
        </div>

        <div className="heading-actions">
          <button
            type="button"
            className="outline-button"
            onClick={loadData}
          >
            <AppIcon name="refresh" size={16} />
            <span>Actualizar Saldos</span>
          </button>
          <Link
            href="/contabilidad"
            className="primary-button"
          >
            <AppIcon name="accounting" size={16} />
            <span>Ir a Contabilidad</span>
          </Link>
        </div>
      </header>

      {/* Tarjetas KPI de Tesorería */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="stat-card p-4 rounded-xl bg-white border border-gray-100 shadow-xs flex flex-col justify-between">
          <span className="text-xs font-semibold text-gray-500">Liquidez Total (Bancos y Caja)</span>
          <div className="mt-2">
            <span className="text-lg font-bold font-mono text-blue-950">
              {formatCOP(stats.totalCashAndBanks)}
            </span>
            <div className="text-[11px] text-gray-400 mt-0.5">{stats.activeAccountsCount} cuentas operativas activas</div>
          </div>
        </div>

        <div className="stat-card p-4 rounded-xl bg-white border border-gray-100 shadow-xs flex flex-col justify-between">
          <span className="text-xs font-semibold text-amber-700">Pagos a Proveedores Programados</span>
          <div className="mt-2">
            <span className="text-lg font-bold font-mono text-amber-900">
              {formatCOP(stats.scheduledPaymentsTotal)}
            </span>
            <div className="text-[11px] text-amber-600 mt-0.5">{stats.scheduledPaymentsCount} desembolsos pendientes de ejecutar</div>
          </div>
        </div>

        <div className="stat-card p-4 rounded-xl bg-white border border-gray-100 shadow-xs flex flex-col justify-between">
          <span className="text-xs font-semibold text-rose-700">Egresos Pagados este Mes</span>
          <div className="mt-2">
            <span className="text-lg font-bold font-mono text-rose-900">
              {formatCOP(stats.paidThisMonthTotal)}
            </span>
            <div className="text-[11px] text-gray-400 mt-0.5">Asientos contables generados</div>
          </div>
        </div>

        <div className="stat-card p-4 rounded-xl bg-white border border-gray-100 shadow-xs flex flex-col justify-between">
          <span className="text-xs font-semibold text-emerald-700">Recaudos Cobrados este Mes</span>
          <div className="mt-2">
            <span className="text-lg font-bold font-mono text-emerald-900">
              {formatCOP(stats.collectedThisMonthTotal)}
            </span>
            <div className="text-[11px] text-emerald-600 mt-0.5">Cartera de clientes aplicada</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <ScrollableTabs>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`drawer-tab flex items-center gap-2 ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <AppIcon name={tab.icon} size={15} />
            <span>{tab.label}</span>
            {tab.id === 'payments' && stats.scheduledPaymentsCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                {stats.scheduledPaymentsCount}
              </span>
            )}
          </button>
        ))}
      </ScrollableTabs>

      {/* Contenido según Tab Activo */}
      {isLoading ? (
        <div className="p-8 text-center text-gray-500 text-xs">Cargando módulo de tesorería...</div>
      ) : (
        <>
          {/* TAB 1: CUENTAS BANCARIAS */}
          {activeTab === 'banks' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {bankAccounts.map((account) => (
                  <div
                    key={account.id}
                    className="p-5 bg-white rounded-xl border border-gray-200 shadow-xs hover:border-blue-400 transition-all space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-800 flex items-center justify-center font-bold text-xs">
                          {account.bankName.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <h3 className="text-xs font-bold text-gray-900">{account.bankName}</h3>
                          <span className="text-[11px] text-gray-500">{account.accountType} — {account.accountNumber}</span>
                        </div>
                      </div>
                      <span className="badge badge-emerald">Activa</span>
                    </div>

                    <div className="pt-2 border-t border-gray-100 flex items-baseline justify-between">
                      <span className="text-xs text-gray-500">Saldo Disponible:</span>
                      <span className="font-mono text-base font-bold text-blue-950">
                        {formatCOP(account.currentBalance)}
                      </span>
                    </div>

                    <div className="text-[11px] text-gray-400 font-mono bg-gray-50 p-2 rounded flex items-center justify-between">
                      <span>Cuenta PUC Asociada:</span>
                      <strong className="text-blue-900 font-bold">{account.accountingAccountCode}</strong>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 2: PAGOS A PROVEEDORES */}
          {activeTab === 'payments' && (
            <div className="space-y-4">
              {/* Barra de Filtros */}
              <div className="filters-bar flex flex-wrap items-center justify-between gap-3">
                <div className="search-box flex-1 max-w-sm">
                  <AppIcon name="search" size={16} />
                  <input
                    placeholder="Buscar proveedor, NIT o número de pago..."
                    value={filters.query || ''}
                    onChange={(e) => setFilters({ ...filters, query: e.target.value })}
                  />
                </div>

                <div className="flex items-center gap-2">
                  <select
                    className="filter-select text-xs"
                    value={filters.status || 'ALL'}
                    onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                  >
                    <option value="ALL">Todos los estados</option>
                    <option value="SCHEDULED">Programados (Pendientes)</option>
                    <option value="PAID">Pagados / Desembolsados</option>
                  </select>
                </div>
              </div>

              {/* Tabla de Pagos */}
              <div className="table-panel animated-table">
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>N° Pago</th>
                        <th>Proveedor / Tercero</th>
                        <th>Factura Prov.</th>
                        <th>Cuenta Bancaria</th>
                        <th style={{ textAlign: 'right' }}>Monto</th>
                        <th>Fecha Pago</th>
                        <th>Estado</th>
                        <th>Asiento Contable</th>
                        <th style={{ textAlign: 'right' }}>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payments.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="text-center py-8 text-gray-500">
                            No hay órdenes de pago registradas con los filtros actuales.
                          </td>
                        </tr>
                      ) : (
                        payments.map((payment) => (
                          <tr key={payment.id} className="hover:bg-blue-50/30">
                            <td>
                              <span className="font-mono text-xs font-bold text-gray-900">
                                {payment.paymentNumber}
                              </span>
                            </td>
                            <td>
                              <div className="flex flex-col">
                                <span className="font-medium text-xs text-gray-900">{payment.thirdPartyName}</span>
                                <span className="text-[11px] text-gray-500 font-mono">{payment.thirdPartyDoc}</span>
                              </div>
                            </td>
                            <td>
                              <span className="font-mono text-xs text-gray-700">
                                {payment.supplierInvoiceNumber || '—'}
                              </span>
                            </td>
                            <td>
                              <span className="text-xs text-gray-700">{payment.bankAccountName}</span>
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              <span className="font-mono text-xs font-bold text-gray-900">
                                {formatCOP(payment.amount)}
                              </span>
                            </td>
                            <td>
                              <span className="text-xs text-gray-600">
                                {payment.paymentDate?.slice(0, 10)}
                              </span>
                            </td>
                            <td>
                              {payment.status === 'PAID' ? (
                                <span className="badge badge-emerald">Pagado</span>
                              ) : (
                                <span className="badge badge-amber">Programado</span>
                              )}
                            </td>
                            <td>
                              {payment.accountingEntryNumber ? (
                                <span className="font-mono text-xs font-bold text-blue-800 bg-blue-50 px-2 py-0.5 rounded">
                                  {payment.accountingEntryNumber}
                                </span>
                              ) : (
                                <span className="text-gray-400 text-xs italic">Pendiente de asiento</span>
                              )}
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              {payment.status === 'SCHEDULED' && (
                                <button
                                  type="button"
                                  className="primary-button text-xs py-1 px-2.5"
                                  onClick={() => setExecutingPaymentId(payment.id)}
                                >
                                  Ejecutar Pago
                                </button>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: RECAUDOS DE CLIENTES */}
          {activeTab === 'receipts' && (
            <div className="space-y-4">
              <div className="table-panel animated-table">
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>N° Recaudo</th>
                        <th>Cliente</th>
                        <th>Factura Venta</th>
                        <th>Cuenta Bancaria</th>
                        <th>Método</th>
                        <th style={{ textAlign: 'right' }}>Valor Recaudado</th>
                        <th>Fecha</th>
                        <th>Asiento Generado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {receipts.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="text-center py-8 text-gray-500">
                            No hay recaudos registrados.
                          </td>
                        </tr>
                      ) : (
                        receipts.map((rec) => (
                          <tr key={rec.id} className="hover:bg-blue-50/30">
                            <td>
                              <span className="font-mono text-xs font-bold text-gray-900">
                                {rec.receiptNumber}
                              </span>
                            </td>
                            <td>
                              <div className="flex flex-col">
                                <span className="font-medium text-xs text-gray-900">{rec.customerName}</span>
                                <span className="text-[11px] text-gray-500 font-mono">{rec.customerDoc}</span>
                              </div>
                            </td>
                            <td>
                              <span className="font-mono text-xs text-blue-900 font-semibold">
                                {rec.invoiceNumber || '—'}
                              </span>
                            </td>
                            <td>
                              <span className="text-xs text-gray-700">{rec.bankAccountName}</span>
                            </td>
                            <td>
                              <span className="text-xs text-gray-600">{rec.paymentMethod}</span>
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              <span className="font-mono text-xs font-bold text-emerald-800">
                                {formatCOP(rec.amount)}
                              </span>
                            </td>
                            <td>
                              <span className="text-xs text-gray-600">
                                {rec.receiptDate?.slice(0, 10)}
                              </span>
                            </td>
                            <td>
                              <span className="font-mono text-xs font-bold text-blue-800 bg-blue-50 px-2 py-0.5 rounded">
                                {rec.accountingEntryNumber || 'AST-GENERADO'}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: ARQUITECTURA Y FLUJO */}
          {activeTab === 'flow' && (
            <div className="p-6 bg-white rounded-xl border border-gray-200 space-y-6">
              <div>
                <h3 className="text-sm font-bold text-gray-900">Flujo Canónico: Tesorería ↔ Contabilidad</h3>
                <p className="text-xs text-gray-500 mt-1">
                  Separación de responsabilidades: Tesorería administra desembolsos y recaudos; Contabilidad genera los comprobantes oficiales.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                  <span className="font-bold text-slate-800">1. Operación Base</span>
                  <p className="text-slate-600">
                    Compra a proveedor o Venta a cliente crea una obligación pendiente (CxP o CxC).
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 space-y-2">
                  <span className="font-bold text-amber-900">2. Programación Tesorería</span>
                  <p className="text-amber-800">
                    Tesorería calendariza el pago, selecciona banco de salida y valida liquidez disponible.
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 space-y-2">
                  <span className="font-bold text-blue-900">3. Ejecución Desembolso</span>
                  <p className="text-blue-800">
                    Se procesa la transferencia bancaria con número de soporte y comprobante de egreso.
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 space-y-2">
                  <span className="font-bold text-emerald-900">4. Asiento Contable Automático</span>
                  <p className="text-emerald-800">
                    Contabilidad genera el comprobante con partida doble:<br />
                    • <strong>Débito:</strong> Proveedor (220505)<br />
                    • <strong>Crédito:</strong> Banco (111005)
                  </p>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Modal de Ejecución de Pago */}
      {executingPaymentId && mounted && createPortal(
        <div className="fixed inset-0 z-[9999] bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-5 space-y-4 animate-scale-up relative">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-sm font-bold text-gray-900">Ejecutar Pago en Tesorería</h3>
              <button
                type="button"
                className="icon-button"
                onClick={() => setExecutingPaymentId(null)}
              >
                <AppIcon name="close" size={16} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-gray-700 font-semibold mb-1">Banco de Desembolso</label>
                <select
                  className="filter-select w-full"
                  value={selectedBankId}
                  onChange={(e) => setSelectedBankId(e.target.value)}
                >
                  {bankAccounts.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.bankName} ({b.accountNumber}) — Saldo: {formatCOP(b.currentBalance)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-gray-700 font-semibold mb-1">Número de Referencia Bancaria / Soporte</label>
                <input
                  className="filter-select w-full"
                  placeholder="Ej: TRF-9940129"
                  value={refNumber}
                  onChange={(e) => setRefNumber(e.target.value)}
                />
              </div>

              <div className="p-3 bg-blue-50/70 rounded-lg text-blue-900 border border-blue-100">
                <span className="font-bold block mb-1">Impacto Contable:</span>
                Al confirmar, se descontará el valor del banco y se creará automáticamente el comprobante contable con partida doble:
                <br />
                • Débito: <strong>220505 Proveedores Nacionales</strong>
                <br />
                • Crédito: <strong>111005 Bancos Nacionales</strong>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t">
              <button
                type="button"
                className="outline-button text-xs py-1.5 px-3"
                onClick={() => setExecutingPaymentId(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="primary-button text-xs py-1.5 px-3"
                onClick={() => handleExecutePayment(executingPaymentId)}
              >
                Confirmar Desembolso y Contabilizar
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
