'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { AppIcon } from '@/components/ui/Icon'
import { BankAccount, ReceiptCustomerOption, TreasuryPostingResult, TreasuryReceipt } from '../types'

type ReceiptMethod = TreasuryReceipt['paymentMethod']

const METHOD_OPTIONS: { value: ReceiptMethod; label: string }[] = [
  { value: 'TRANSFERENCIA', label: 'Transferencia' },
  { value: 'CONSIGNACION', label: 'Consignación' },
  { value: 'EFECTIVO', label: 'Efectivo' },
  { value: 'TARJETA', label: 'Tarjeta' },
]

interface TreasuryReceiptModalProps {
  bankAccounts: BankAccount[]
  loadCustomers: () => Promise<ReceiptCustomerOption[]>
  onSubmit: (data: {
    customerId: string
    bankAccountId: string
    amount: number
    paymentMethod: ReceiptMethod
    referenceNumber?: string
    notes?: string
    idempotencyKey: string
  }) => Promise<TreasuryPostingResult>
  onRegistered: (result: TreasuryPostingResult) => void
  onClose: () => void
}

const formatCOP = (val: number) => `$${(Number(val) || 0).toLocaleString('es-CO')} COP`

/** Registro de un recaudo de cliente. El servidor causa su comprobante RC (caja) o CI (banco). */
export function TreasuryReceiptModal({ bankAccounts, loadCustomers, onSubmit, onRegistered, onClose }: TreasuryReceiptModalProps) {
  const [customers, setCustomers] = useState<ReceiptCustomerOption[]>([])
  const [loadingCustomers, setLoadingCustomers] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [customerQuery, setCustomerQuery] = useState('')
  const [customerId, setCustomerId] = useState('')
  const activeAccounts = useMemo(() => bankAccounts.filter((b) => b.status === 'ACTIVE'), [bankAccounts])
  const [bankAccountId, setBankAccountId] = useState(activeAccounts[0]?.id || '')
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState<ReceiptMethod>('TRANSFERENCIA')
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Una clave por intento: un reintento (doble clic, respuesta perdida) no registra el recaudo dos veces.
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID())

  useEffect(() => {
    let active = true
    loadCustomers()
      .then((list) => active && setCustomers(list))
      .catch((err: unknown) => active && setLoadError(err instanceof Error ? err.message : 'No se pudieron cargar los clientes.'))
      .finally(() => active && setLoadingCustomers(false))
    return () => {
      active = false
    }
  }, [loadCustomers])

  useEffect(() => {
    setIdempotencyKey(crypto.randomUUID())
  }, [customerId, bankAccountId, amount, method])

  const filteredCustomers = useMemo(() => {
    const q = customerQuery.trim().toLowerCase()
    if (!q) return customers
    return customers.filter((c) => c.name.toLowerCase().includes(q) || c.documentNumber.includes(q))
  }, [customers, customerQuery])

  const selectedBank = activeAccounts.find((b) => b.id === bankAccountId)
  const selectedCustomer = customers.find((c) => c.id === customerId)
  const parsedAmount = Number(amount)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!customerId || !bankAccountId || !(parsedAmount > 0)) {
      setError('Seleccione el cliente, la cuenta que recibe y un valor mayor a cero.')
      return
    }
    try {
      setSubmitting(true)
      setError(null)
      const result = await onSubmit({
        customerId,
        bankAccountId,
        amount: parsedAmount,
        paymentMethod: method,
        referenceNumber: reference.trim() || undefined,
        notes: notes.trim() || undefined,
        idempotencyKey,
      })
      onRegistered(result)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'No se pudo registrar el recaudo.')
    } finally {
      setSubmitting(false)
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[9999] bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="treasury-receipt-title"
        className="bg-white rounded-xl shadow-xl max-w-md w-full p-5 space-y-4 animate-scale-up relative max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between border-b pb-3">
          <h2 id="treasury-receipt-title" className="text-sm font-bold text-gray-900">Registrar Recaudo de Cliente</h2>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Cerrar registro de recaudo" disabled={submitting}>
            <AppIcon name="close" size={16} />
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-start gap-2" role="alert">
            <AppIcon name="warning" size={16} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <div>
            <label htmlFor="receipt-customer-search" className="block text-gray-700 font-semibold mb-1">Cliente *</label>
            {loadingCustomers ? (
              <p className="text-gray-500 animate-pulse">Cargando clientes...</p>
            ) : loadError ? (
              <p className="text-rose-700">{loadError}</p>
            ) : customers.length === 0 ? (
              <p className="text-gray-500">No hay clientes activos.</p>
            ) : (
              <>
                <input
                  id="receipt-customer-search"
                  className="filter-select w-full mb-1.5"
                  placeholder="Buscar por nombre o documento"
                  value={customerQuery}
                  onChange={(e) => setCustomerQuery(e.target.value)}
                />
                <select
                  aria-label="Cliente del recaudo"
                  className="filter-select w-full"
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                  required
                >
                  <option value="">Seleccione el cliente…</option>
                  {filteredCustomers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.documentNumber}) · Saldo {formatCOP(c.currentBalance)}
                    </option>
                  ))}
                </select>
                {selectedCustomer && (
                  <p className="text-[11px] text-gray-500 mt-1">Saldo en cartera: {formatCOP(selectedCustomer.currentBalance)}</p>
                )}
              </>
            )}
          </div>

          <div>
            <label htmlFor="receipt-bank" className="block text-gray-700 font-semibold mb-1">Cuenta o caja que recibe *</label>
            {activeAccounts.length === 0 ? (
              <p className="text-gray-500">No hay cuentas bancarias activas.</p>
            ) : (
              <select id="receipt-bank" className="filter-select w-full" value={bankAccountId} onChange={(e) => setBankAccountId(e.target.value)} required>
                {activeAccounts.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.bankName} ({b.accountNumber}){b.accountingAccountCode ? ` · PUC ${b.accountingAccountCode}` : ''}
                  </option>
                ))}
              </select>
            )}
            {selectedBank && !selectedBank.accountingAccountId && (
              <p className="text-[11px] text-amber-700 mt-1">Esta cuenta no tiene subcuenta PUC asignada: el recaudo no se podrá contabilizar.</p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="receipt-amount" className="block text-gray-700 font-semibold mb-1">Valor (COP) *</label>
              <input
                id="receipt-amount"
                type="number"
                min="0.01"
                step="0.01"
                inputMode="decimal"
                className="filter-select w-full font-mono"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </div>
            <div>
              <label htmlFor="receipt-method" className="block text-gray-700 font-semibold mb-1">Medio</label>
              <select id="receipt-method" className="filter-select w-full" value={method} onChange={(e) => setMethod(e.target.value as ReceiptMethod)}>
                {METHOD_OPTIONS.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="receipt-reference" className="block text-gray-700 font-semibold mb-1">Referencia bancaria / soporte</label>
            <input id="receipt-reference" className="filter-select w-full" maxLength={80} value={reference} onChange={(e) => setReference(e.target.value)} />
          </div>

          <div>
            <label htmlFor="receipt-notes" className="block text-gray-700 font-semibold mb-1">Observaciones</label>
            <input id="receipt-notes" className="filter-select w-full" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          <p className="p-3 bg-blue-50/70 rounded-lg text-blue-900 border border-blue-100">
            Al registrar se abona la cartera del cliente y se genera el comprobante contable: RC si entra a una caja, CI si entra a un banco.
          </p>

          <div className="flex items-center justify-end gap-2 pt-3 border-t">
            <button type="button" className="outline-button text-xs py-1.5 px-3" onClick={onClose} disabled={submitting}>
              Cancelar
            </button>
            <button
              type="submit"
              className="primary-button text-xs py-1.5 px-3 flex items-center gap-1.5"
              disabled={submitting || loadingCustomers || !customerId || activeAccounts.length === 0}
            >
              <AppIcon name="receipt" size={14} />
              <span>{submitting ? 'Registrando...' : 'Registrar y Contabilizar'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}
