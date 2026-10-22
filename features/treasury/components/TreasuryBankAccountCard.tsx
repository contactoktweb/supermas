'use client'

import React from 'react'
import { AppIcon } from '@/components/ui/Icon'
import { CustomSelect, type SelectOption } from '@/components/ui/CustomSelect'
import type { BankAccount } from '../types'

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  AHORROS: 'Cuenta de ahorros',
  AHORRO: 'Cuenta de ahorros',
  CORRIENTE: 'Cuenta corriente',
}

interface TreasuryBankAccountCardProps {
  account: BankAccount
  formattedBalance: string
  /** Prefijo PUC de 4 dígitos al que deben pertenecer las subcuentas (vacío si el tipo no aplica). */
  ledgerPrefix: string
  ledgerOptions: SelectOption[]
  draftLedgerId: string
  isSaving: boolean
  onDraftChange: (ledgerId: string) => void
  onSave: () => void
}

export function TreasuryBankAccountCard({
  account,
  formattedBalance,
  ledgerPrefix,
  ledgerOptions,
  draftLedgerId,
  isSaving,
  onDraftChange,
  onSave,
}: TreasuryBankAccountCardProps) {
  const isActive = account.status !== 'INACTIVE'
  const hasLedger = Boolean(account.accountingAccountCode)
  const canSave = Boolean(draftLedgerId) && draftLedgerId !== account.accountingAccountId && !isSaving

  return (
    <article className="bank-account-card">
      <header className="bank-account-card-header">
        <div className="bank-account-avatar" aria-hidden="true">
          <AppIcon name="wallet" size={18} />
        </div>
        <div className="bank-account-identity">
          <h3>{account.bankName}</h3>
          <span>
            {ACCOUNT_TYPE_LABELS[account.accountType] || account.accountType} · terminada en {account.accountNumber.slice(-4)}
          </span>
        </div>
        <span className={`state ${isActive ? 'disponible' : 'agotado'}`}>
          <AppIcon name={isActive ? 'check' : 'powerOff'} size={12} />
          <span>{isActive ? 'Activa' : 'Inactiva'}</span>
        </span>
      </header>

      <div className="bank-account-balance">
        <span>Saldo disponible</span>
        <strong>{formattedBalance}</strong>
      </div>

      <section className="bank-account-ledger" aria-label="Cuenta contable enlazada">
        <span className="bank-account-ledger-caption">Subcuenta PUC enlazada</span>
        {hasLedger ? (
          <div className="bank-account-ledger-value">
            <b>{account.accountingAccountCode}</b>
            <span>{account.accountingAccountName}</span>
          </div>
        ) : (
          <p className="bank-account-ledger-missing">
            <AppIcon name="warning" size={14} />
            <span>Sin subcuenta asignada: los pagos y recaudos de esta cuenta no se pueden contabilizar.</span>
          </p>
        )}

        {ledgerPrefix && ledgerOptions.length > 0 && (
          <div className="bank-account-ledger-form">
            <CustomSelect
              size="sm"
              value={draftLedgerId}
              onChange={onDraftChange}
              options={ledgerOptions}
              placeholder={`Elegir subcuenta ${ledgerPrefix}xx`}
            />
            <button type="button" className="outline-button compact" disabled={!canSave} onClick={onSave}>
              {isSaving ? 'Guardando…' : hasLedger ? 'Cambiar' : 'Asignar'}
            </button>
          </div>
        )}

        {ledgerPrefix && ledgerOptions.length === 0 && (
          <p className="bank-account-ledger-missing">
            <AppIcon name="info" size={14} />
            <span>No hay subcuentas {ledgerPrefix}xx en el plan de cuentas.</span>
          </p>
        )}
      </section>
    </article>
  )
}
