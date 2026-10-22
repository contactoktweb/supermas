'use client'

import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useTreasury, TreasuryTab } from '../hooks/useTreasury'
import { AppIcon, LightIconName } from '@/components/ui/Icon'
import { ScrollableTabs } from '@/components/ui/ScrollableTabs'
import Link from 'next/link'
import { TreasuryReceiptModal } from './TreasuryReceiptModal'
import { TreasuryBankAccountCard } from './TreasuryBankAccountCard'
import { TreasuryPostingResult } from '../types'
import { SelectField } from '@/components/ui/SelectField'

const TABS: { id: TreasuryTab; label: string; icon: LightIconName }[] = [
  { id: 'banks', label: 'Cuentas Bancarias y Saldos', icon: 'wallet' },
  { id: 'payments', label: 'Pagos a Proveedores (Egresos)', icon: 'creditCard' },
  { id: 'receipts', label: 'Recaudos de Clientes (Ingresos)', icon: 'receipt' },
  { id: 'movements', label: 'Extracto y Conciliación', icon: 'kardex' },
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
    bankMovements,
    filters,
    setFilters,
    loadData,
    executePayment,
    executeCustomerCollection,
    causePendingAccounting,
    getReceiptCustomers,
    createBankAccount,
    reconcileMovement,
    getBankLedgerOptions,
    setBankAccountLedger,
  } = useTreasury()

  // Subcuentas PUC de bancos (1110xx corrientes / 1120xx ahorros)
  const [ledgerOptions, setLedgerOptions] = useState<Array<{ id: string; code: string; name: string }>>([])
  const [ledgerDraft, setLedgerDraft] = useState<Record<string, string>>({})
  const [savingLedgerId, setSavingLedgerId] = useState<string | null>(null)
  const [newLedgerId, setNewLedgerId] = useState('')

  useEffect(() => {
    getBankLedgerOptions().then(setLedgerOptions).catch(() => setLedgerOptions([]))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bankAccounts.length])

  const ledgerPrefixFor = (type: string) => (type === 'AHORROS' || type === 'AHORRO' ? '1120' : type === 'CORRIENTE' ? '1110' : '')
  const ledgerOptionsFor = (type: string) => {
    const prefix = ledgerPrefixFor(type)
    return prefix ? ledgerOptions.filter((o) => o.code.startsWith(prefix)) : []
  }

  const handleSaveLedger = async (bankAccountId: string) => {
    const ledgerId = ledgerDraft[bankAccountId]
    if (!ledgerId) return
    try {
      setSavingLedgerId(bankAccountId)
      setActionError(null)
      const res = await setBankAccountLedger(bankAccountId, ledgerId)
      setSuccessToast(`Subcuenta PUC ${res?.code || ''} asignada. Las ventas pagadas a esta cuenta se contabilizan allí.`)
      setTimeout(() => setSuccessToast(null), 6000)
    } catch (err: any) {
      setActionError(err.message || 'No se pudo asignar la subcuenta PUC.')
    } finally {
      setSavingLedgerId(null)
    }
  }

  const [executingPaymentId, setExecutingPaymentId] = useState<string | null>(null)
  const [isExecutingPayment, setIsExecutingPayment] = useState(false)
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false)
  const [causingDocumentId, setCausingDocumentId] = useState<string | null>(null)
  const [selectedBankId, setSelectedBankId] = useState<string>('')
  const [refNumber, setRefNumber] = useState<string>('')
  const [successToast, setSuccessToast] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)

  // Modal Crear Cuenta Bancaria
  const [isCreateBankOpen, setIsCreateBankOpen] = useState(false)
  const [newBankName, setNewBankName] = useState('')
  const [newAccountNumber, setNewAccountNumber] = useState('')
  const [newAccountType, setNewAccountType] = useState('CORRIENTE')
  const [newBankDesc, setNewBankDesc] = useState('')
  const [isSubmittingBank, setIsSubmittingBank] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!selectedBankId && bankAccounts && bankAccounts.length > 0) {
      setSelectedBankId(bankAccounts[0].id)
    }
  }, [bankAccounts, selectedBankId])

  const showPostingToast = (label: string, res: TreasuryPostingResult) => {
    setSuccessToast(
      `${label} ${res.documentNumber} registrado por ${formatCOP(res.amount)}. Comprobante contable ${res.accountingEntryNumber || 'generado'}.`
    )
    setTimeout(() => setSuccessToast(null), 8000)
  }

  const handleExecutePayment = async (paymentId: string) => {
    try {
      setIsExecutingPayment(true)
      setActionError(null)
      const res = await executePayment(paymentId, {
        bankAccountId: selectedBankId,
        referenceNumber: refNumber.trim() || undefined,
      })
      setExecutingPaymentId(null)
      setRefNumber('')
      showPostingToast('Pago', res)
    } catch (err: any) {
      setActionError(err.message || 'Error al ejecutar el desembolso.')
    } finally {
      setIsExecutingPayment(false)
    }
  }

  const handleReceiptRegistered = (res: TreasuryPostingResult) => {
    setIsReceiptModalOpen(false)
    setActionError(null)
    showPostingToast(res.idempotentReplay ? 'Recaudo (ya registrado)' : 'Recaudo', res)
  }

  const handleCausePending = async (kind: 'PAYMENT' | 'RECEIPT', documentId: string, documentNumber: string) => {
    try {
      setCausingDocumentId(documentId)
      setActionError(null)
      const entryNumber = await causePendingAccounting(kind, documentId)
      setSuccessToast(`${documentNumber} contabilizado con el comprobante ${entryNumber || 'generado'}.`)
      setTimeout(() => setSuccessToast(null), 6000)
    } catch (err: any) {
      setActionError(err.message || `No se pudo contabilizar ${documentNumber}.`)
    } finally {
      setCausingDocumentId(null)
    }
  }

  const handleCreateBank = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newBankName || !newAccountNumber) {
      setActionError('Nombre del banco y número de cuenta son obligatorios.')
      return
    }
    try {
      setIsSubmittingBank(true)
      setActionError(null)
      const created = await createBankAccount({
        bankName: newBankName,
        accountNumber: newAccountNumber,
        accountType: newAccountType,
        description: newBankDesc || undefined,
      })
      if (newLedgerId && created?.bank_account_id) {
        await setBankAccountLedger(created.bank_account_id, newLedgerId)
      }
      setNewLedgerId('')
      setIsCreateBankOpen(false)
      setNewBankName('')
      setNewAccountNumber('')
      setNewAccountType('CORRIENTE')
      setNewBankDesc('')
      setSuccessToast(`Cuenta bancaria ${newBankName} (${newAccountNumber}) creada exitosamente.`)
      setTimeout(() => setSuccessToast(null), 6000)
    } catch (err: any) {
      setActionError(err.message || 'Error al crear cuenta bancaria.')
    } finally {
      setIsSubmittingBank(false)
    }
  }

  const handleToggleReconciliation = async (movementId: string, currentStatus: boolean) => {
    try {
      setActionError(null)
      await reconcileMovement(movementId, !currentStatus)
      setSuccessToast(
        `Movimiento ${!currentStatus ? 'conciliado' : 'marcado como pendiente'}.`
      )
      setTimeout(() => setSuccessToast(null), 4000)
    } catch (err: any) {
      setActionError(err.message || 'Error al conciliar movimiento.')
    }
  }

  const formatCOP = (val: number) => `$${(Number(val) || 0).toLocaleString('es-CO')} COP`

  return (
    <div className="treasury-module page-enter space-y-6">
      {/* Toast Notification */}
      {successToast && (
        <div role="status" aria-live="polite" className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center justify-between shadow-sm animate-fade-in">
          <div className="flex items-center gap-2">
            <AppIcon name="check" size={18} />
            <span>{successToast}</span>
          </div>
          <button
            type="button"
            className="text-emerald-700 hover:text-emerald-900 font-bold"
            onClick={() => setSuccessToast(null)}
            aria-label="Cerrar mensaje"
          >
            <AppIcon name="closeSimple" size={16} />
          </button>
        </div>
      )}

      {actionError && (
        <div role="alert" className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2">
            <AppIcon name="warning" size={18} />
            <span>{actionError}</span>
          </div>
          <button
            type="button"
            className="text-rose-700 hover:text-rose-900 font-bold"
            onClick={() => setActionError(null)}
            aria-label="Cerrar mensaje de error"
          >
            <AppIcon name="closeSimple" size={16} />
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
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h2 className="text-sm font-bold text-gray-900">Cuentas Bancarias Registradas</h2>
                  <p className="text-xs text-gray-500">Cuentas de la empresa con su saldo y la subcuenta contable donde se registran sus movimientos.</p>
                </div>
                <button
                  type="button"
                  className="primary-button text-xs py-1.5 px-3 flex items-center gap-1.5 whitespace-nowrap"
                  onClick={() => setIsCreateBankOpen(true)}
                >
                  <AppIcon name="plus" size={14} />
                  <span>Nueva Cuenta Bancaria</span>
                </button>
              </div>

              <div className="bank-account-grid">
                {bankAccounts.map((account) => (
                  <TreasuryBankAccountCard
                    key={account.id}
                    account={account}
                    formattedBalance={formatCOP(account.currentBalance)}
                    ledgerPrefix={ledgerPrefixFor(account.accountType)}
                    ledgerOptions={ledgerOptionsFor(account.accountType).map((o) => ({
                      value: o.id,
                      label: `${o.code} · ${o.name}`,
                    }))}
                    draftLedgerId={ledgerDraft[account.id] ?? account.accountingAccountId ?? ''}
                    isSaving={savingLedgerId === account.id}
                    onDraftChange={(ledgerId) => setLedgerDraft({ ...ledgerDraft, [account.id]: ledgerId })}
                    onSave={() => handleSaveLedger(account.id)}
                  />
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
                  <SelectField
                    value={filters.status || 'ALL'}
                    size="sm"
                    onChange={(value) => setFilters({ ...filters, status: value })}
                  >
                    <option value="ALL">Todos los estados</option>
                    <option value="SCHEDULED">Programados (Pendientes)</option>
                    <option value="PAID">Pagados / Desembolsados</option>
                  </SelectField>
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
                        <th>Comprobante Contable</th>
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
                              {payment.accountingEntryNumber || payment.accountingEntryId ? (
                                <span className="font-mono text-xs font-bold text-blue-800 bg-blue-50 px-2 py-0.5 rounded">
                                  {payment.accountingEntryNumber || 'Contabilizado'}
                                </span>
                              ) : payment.status === 'PAID' ? (
                                <button
                                  type="button"
                                  className="outline-button text-[11px] py-1 px-2.5"
                                  disabled={causingDocumentId === payment.id}
                                  onClick={() => handleCausePending('PAYMENT', payment.id, payment.paymentNumber)}
                                >
                                  {causingDocumentId === payment.id ? 'Contabilizando...' : 'Contabilizar'}
                                </button>
                              ) : (
                                <span className="text-gray-400 text-xs italic">Se genera al ejecutar</span>
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
              <div className="filters-bar flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs text-gray-500">
                  Cada recaudo abona la cartera del cliente y genera su comprobante RC (caja) o CI (banco).
                </div>
                <button
                  type="button"
                  className="primary-button text-xs py-1.5 px-3 flex items-center gap-1.5"
                  onClick={() => setIsReceiptModalOpen(true)}
                >
                  <AppIcon name="plus" size={14} />
                  <span>Registrar Recaudo</span>
                </button>
              </div>
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
                        <th>Comprobante Contable</th>
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
                              {rec.accountingEntryNumber || rec.accountingEntryId ? (
                                <span className="font-mono text-xs font-bold text-blue-800 bg-blue-50 px-2 py-0.5 rounded">
                                  {rec.accountingEntryNumber || 'Contabilizado'}
                                </span>
                              ) : rec.status === 'CANCELLED' ? (
                                <span className="text-gray-400 text-xs italic">Anulado</span>
                              ) : (
                                <button
                                  type="button"
                                  className="outline-button text-[11px] py-1 px-2.5"
                                  disabled={causingDocumentId === rec.id}
                                  onClick={() => handleCausePending('RECEIPT', rec.id, rec.receiptNumber)}
                                >
                                  {causingDocumentId === rec.id ? 'Contabilizando...' : 'Contabilizar'}
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

          {/* TAB 4: ARQUITECTURA Y FLUJO */}
          {activeTab === 'flow' && (
            <div className="p-6 bg-white rounded-xl border border-gray-200 space-y-6">
              <div>
                <h3 className="text-sm font-bold text-gray-900">Flujo Canónico: Tesorería y Contabilidad</h3>
                <p className="text-xs text-gray-500 mt-1">
                  Tesorería administra desembolsos y recaudos; cada operación genera en el mismo registro su comprobante contable oficial.
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
                  <span className="font-bold text-emerald-900">4. Comprobante Contable Automático</span>
                  <p className="text-emerald-800">
                    Pago a proveedor: comprobante <strong>CE</strong> (Débito proveedores, Crédito subcuenta del banco).<br />
                    Recaudo de cliente: <strong>RC</strong> en caja o <strong>CI</strong> en banco (Débito subcuenta, Crédito cartera).
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: EXTRACTO Y CONCILIACIÓN BANCARIA */}
          {activeTab === 'movements' && (
            <div className="space-y-4">
              <div className="filters-bar flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs text-gray-500">
                  Mostrando <strong>{bankMovements.length}</strong> movimientos registrados en cuentas bancarias.
                </div>
                <div className="flex items-center gap-2">
                  <SelectField
                    value={filters.bankAccountId || 'ALL'}
                    size="sm"
                    onChange={(value) => setFilters({ ...filters, bankAccountId: value })}
                  >
                    <option value="ALL">Todas las cuentas bancarias</option>
                    {bankAccounts.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.bankName} ({b.accountNumber})
                      </option>
                    ))}
                  </SelectField>
                </div>
              </div>

              <div className="table-container bg-white rounded-xl border border-gray-200 overflow-x-auto shadow-xs">
                <table className="data-table w-full text-xs">
                  <thead>
                    <tr className="border-b bg-gray-50/70 text-gray-500 font-semibold text-left">
                      <th className="p-3">Fecha</th>
                      <th className="p-3">Comprobante</th>
                      <th className="p-3">Cuenta Bancaria</th>
                      <th className="p-3">Concepto</th>
                      <th className="p-3">Tipo</th>
                      <th className="p-3 text-right">Monto</th>
                      <th className="p-3 text-right">Saldo Posterior</th>
                      <th className="p-3 text-center">Conciliación</th>
                      <th className="p-3 text-center">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {bankMovements.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="p-8 text-center text-gray-400">
                          No hay movimientos bancarios registrados para los filtros seleccionados.
                        </td>
                      </tr>
                    ) : (
                      bankMovements.map((m) => (
                        <tr key={m.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="p-3 font-mono text-[11px] text-gray-600">{m.date}</td>
                          <td className="p-3 font-mono font-bold text-gray-800">{m.movementNumber || m.id.slice(0, 8)}</td>
                          <td className="p-3 text-gray-700">{m.bankAccountName || 'Cuenta Bancaria'}</td>
                          <td className="p-3 text-gray-900 max-w-xs truncate" title={m.concept}>{m.concept}</td>
                          <td className="p-3">
                            <span className={`badge ${m.type === 'CREDIT' ? 'badge-emerald' : 'badge-rose'}`}>
                              {m.type === 'CREDIT' ? 'CRÉDITO (+)' : 'DÉBITO (-)'}
                            </span>
                          </td>
                          <td className="p-3 font-mono text-right font-bold text-gray-900">
                            {formatCOP(m.amount)}
                          </td>
                          <td className="p-3 font-mono text-right text-gray-600">
                            {formatCOP(m.balanceAfter)}
                          </td>
                          <td className="p-3 text-center">
                            {m.isReconciled ? (
                              <span className="badge badge-emerald flex items-center justify-center gap-1 mx-auto w-fit">
                                <AppIcon name="check" size={12} />
                                <span>Conciliado</span>
                              </span>
                            ) : (
                              <span className="badge badge-amber mx-auto w-fit">Pendiente</span>
                            )}
                          </td>
                          <td className="p-3 text-center">
                            <button
                              type="button"
                              className={`outline-button text-[11px] py-1 px-2.5 ${m.isReconciled ? 'text-amber-700 border-amber-200' : 'text-emerald-700 border-emerald-200'}`}
                              onClick={() => handleToggleReconciliation(m.id, !!m.isReconciled)}
                            >
                              {m.isReconciled ? 'Desmarcar' : 'Conciliar'}
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Modal de Nueva Cuenta Bancaria */}
      {isCreateBankOpen && mounted && createPortal(
        <div className="fixed inset-0 z-[9999] bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-5 space-y-4 animate-scale-up relative">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-sm font-bold text-gray-900">Registrar Cuenta Bancaria</h3>
              <button
                type="button"
                className="icon-button"
                onClick={() => setIsCreateBankOpen(false)}
              >
                <AppIcon name="close" size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateBank} className="space-y-3 text-xs">
              <div>
                <label className="block text-gray-700 font-semibold mb-1">Entidad Bancaria *</label>
                <input
                  required
                  className="filter-select w-full"
                  placeholder="Ej: Bancolombia, Davivienda, BBVA..."
                  value={newBankName}
                  onChange={(e) => setNewBankName(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-gray-700 font-semibold mb-1">Número de Cuenta *</label>
                <input
                  required
                  className="filter-select w-full"
                  placeholder="Ej: 9812-4412-0091"
                  value={newAccountNumber}
                  onChange={(e) => setNewAccountNumber(e.target.value)}
                />
              </div>

              <div>
                <div>
                  <label className="block text-gray-700 font-semibold mb-1">Tipo de Cuenta</label>
                  <SelectField
                    value={newAccountType}
                    className="w-full"
                    size="sm"
                    onChange={(value) => {
                      setNewAccountType(value)
                      setNewLedgerId('')
                    }}
                  >
                    <option value="CORRIENTE">Corriente</option>
                    <option value="AHORROS">Ahorros</option>
                    <option value="FIDUCIARIA">Fiduciaria</option>
                  </SelectField>
                </div>
              </div>

              {ledgerPrefixFor(newAccountType) && (
                <div>
                  <label className="block text-gray-700 font-semibold mb-1">Subcuenta PUC ({ledgerPrefixFor(newAccountType)}xx)</label>
                  <SelectField
                    value={newLedgerId}
                    className="w-full"
                    size="sm"
                    onChange={(value) => setNewLedgerId(value)}
                  >
                    <option value="">Asignar después</option>
                    {ledgerOptionsFor(newAccountType).map((o) => (
                      <option key={o.id} value={o.id}>{o.code} · {o.name}</option>
                    ))}
                  </SelectField>
                  <p className="text-[10px] text-gray-500 mt-1">Cada cuenta bancaria debe tener su propia subcuenta para diferenciar en contabilidad cuál recibió el dinero.</p>
                </div>
              )}

              <div>
                <label className="block text-gray-700 font-semibold mb-1">Descripción / Uso</label>
                <input
                  className="filter-select w-full"
                  placeholder="Ej: Cuenta principal para pago de nómina y proveedores"
                  value={newBankDesc}
                  onChange={(e) => setNewBankDesc(e.target.value)}
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  className="outline-button text-xs py-1.5 px-3"
                  onClick={() => setIsCreateBankOpen(false)}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingBank}
                  className="primary-button text-xs py-1.5 px-3 flex items-center gap-1.5"
                >
                  <AppIcon name="plus" size={14} />
                  <span>{isSubmittingBank ? 'Guardando...' : 'Crear Cuenta'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
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
                <SelectField
                  value={selectedBankId}
                  className="w-full"
                  size="sm"
                  onChange={(value) => setSelectedBankId(value)}
                >
                  {bankAccounts.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.bankName} ({b.accountNumber}) — Saldo: {formatCOP(b.currentBalance)}
                    </option>
                  ))}
                </SelectField>
              </div>

              <div>
                <label className="block text-gray-700 font-semibold mb-1">Número de Referencia Bancaria / Soporte</label>
                <input
                  className="filter-select w-full"
                  placeholder="Ej: TRF-9940129"
                  maxLength={80}
                  value={refNumber}
                  onChange={(e) => setRefNumber(e.target.value)}
                />
              </div>

              <div className="p-3 bg-blue-50/70 rounded-lg text-blue-900 border border-blue-100">
                <span className="font-bold block mb-1">Impacto Contable:</span>
                Al confirmar se descuenta el valor del banco y se genera el comprobante de egreso (CE):
                <br />
                Débito: <strong>Proveedores</strong> · Crédito:{' '}
                <strong>
                  {(() => {
                    const bank = bankAccounts.find((b) => b.id === selectedBankId)
                    return bank?.accountingAccountCode
                      ? `${bank.accountingAccountCode} ${bank.accountingAccountName}`
                      : 'subcuenta PUC de la cuenta bancaria'
                  })()}
                </strong>
                {!bankAccounts.find((b) => b.id === selectedBankId)?.accountingAccountId && (
                  <span className="block mt-1 text-amber-700">Esta cuenta no tiene subcuenta PUC asignada: el pago no se podrá contabilizar.</span>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t">
              <button
                type="button"
                className="outline-button text-xs py-1.5 px-3"
                disabled={isExecutingPayment}
                onClick={() => setExecutingPaymentId(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="primary-button text-xs py-1.5 px-3"
                disabled={isExecutingPayment || !selectedBankId}
                onClick={() => handleExecutePayment(executingPaymentId)}
              >
                {isExecutingPayment ? 'Procesando...' : 'Confirmar Desembolso y Contabilizar'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {isReceiptModalOpen && mounted && (
        <TreasuryReceiptModal
          bankAccounts={bankAccounts}
          loadCustomers={getReceiptCustomers}
          onSubmit={executeCustomerCollection}
          onRegistered={handleReceiptRegistered}
          onClose={() => setIsReceiptModalOpen(false)}
        />
      )}
    </div>
  )
}

