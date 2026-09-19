'use client'

import React, { useState, useCallback } from 'react'
import { useAccounting, AccountingTab } from '../hooks/useAccounting'
import { useAccountingPermissions } from '../hooks/useAccountingPermissions'
import { AccountingHeader } from './AccountingHeader'
import { ScrollableTabs } from '@/components/ui/ScrollableTabs'
import { AppIcon, LightIconName } from '@/components/ui/Icon'

// Tabs
import { AccountingDashboardTab } from './tabs/AccountingDashboardTab'
import { AccountingAccountsTab } from './tabs/AccountingAccountsTab'
import { AccountingEntriesTab } from './tabs/AccountingEntriesTab'
import { AccountingMovementsTab } from './tabs/AccountingMovementsTab'
import { AccountingGeneralJournalTab } from './tabs/AccountingGeneralJournalTab'
import { AccountingGeneralLedgerTab } from './tabs/AccountingGeneralLedgerTab'
import { AccountingBalanceSheetTab } from './tabs/AccountingBalanceSheetTab'
import { AccountingIncomeStatementTab } from './tabs/AccountingIncomeStatementTab'
import { AccountingCostsTab } from './tabs/AccountingCostsTab'
import { AccountingReceivablesPayablesTab } from './tabs/AccountingReceivablesPayablesTab'
import { AccountingConfigTab } from './tabs/AccountingConfigTab'

// Drawers & Modales
import { AccountingEntryDetailDrawer } from './drawers/AccountingEntryDetailDrawer'
import { NewManualEntryDrawer } from './drawers/NewManualEntryDrawer'
import { NewAccountDrawer } from './drawers/NewAccountDrawer'

// Skeletons & Toasts
import { AccountingStatsSkeleton, AccountingTableSkeleton } from './AccountingSkeleton'
import { AccountingToastContainer, AccountingToastMessage } from './AccountingToast'
import { AccountingEntry } from '../types'
import { AccountFormData, ManualEntryFormData } from '../schemas/accounting.schema'

const TABS_CONFIG: { id: AccountingTab; label: string; icon: LightIconName }[] = [
  { id: 'dashboard', label: 'Dashboard Contable', icon: 'dashboard' },
  { id: 'accounts', label: 'Plan de Cuentas (PUC)', icon: 'layers' },
  { id: 'entries', label: 'Asientos Contables', icon: 'receipt' },
  { id: 'movements', label: 'Libro Auxiliar', icon: 'table' },
  { id: 'journal', label: 'Libro Diario', icon: 'fileText' },
  { id: 'ledger', label: 'Libro Mayor', icon: 'accounting' },
  { id: 'balance', label: 'Balance General', icon: 'wallet' },
  { id: 'results', label: 'Estado de Resultados', icon: 'pieChart' },
  { id: 'costs', label: 'Sistema de Costos', icon: 'purchases' },
  { id: 'receivables_payables', label: 'Cartera (CxC / CxP)', icon: 'creditCard' },
  { id: 'config', label: 'Configuración Contable', icon: 'settings' },
]

export function AccountingPage() {
  const permissions = useAccountingPermissions('SUPERADMIN')
  const {
    activeTab,
    setActiveTab,
    isLoading,
    error,
    dashboard,
    accounts,
    entries,
    movements,
    balanceSheet,
    incomeStatement,
    selectedLedger,
    accountsReceivable,
    accountsPayable,
    costAnalysis,
    categoryMappings,
    exogenaPrep,
    filters,
    updateFilters,
    loadData,
    loadLedgerForAccount,
    createAccount,
    createManualEntry,
    reverseEntry,
    updateCategoryMapping,
    exportCSV,
  } = useAccounting('SUPERADMIN')

  // Notificaciones Toast
  const [toasts, setToasts] = useState<AccountingToastMessage[]>([])
  const addToast = useCallback((type: 'success' | 'error' | 'info', title: string, description?: string) => {
    setToasts((prev) => [
      ...prev,
      { id: `toast-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`, type, title, description },
    ])
  }, [])
  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  // Modales y Drawers
  const [isNewEntryOpen, setIsNewEntryOpen] = useState(false)
  const [isNewAccountOpen, setIsNewAccountOpen] = useState(false)
  const [selectedEntry, setSelectedEntry] = useState<AccountingEntry | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const handleRefresh = async () => {
    setIsRefreshing(true)
    await loadData()
    setIsRefreshing(false)
    addToast('info', 'Datos Contables Actualizados', 'La información de movimientos y estados financieros está al día.')
  }

  const handleCreateManualEntry = async (data: ManualEntryFormData) => {
    try {
      const entry = await createManualEntry(data)
      addToast(
        'success',
        'Asiento Contable Confirmado',
        `Comprobante ${entry.entryNumber} registrado con partida doble balanceada ($${entry.totalDebit.toLocaleString('es-CO')} COP).`
      )
    } catch (err: any) {
      addToast('error', 'Error al Guardar Asiento', err.message)
      throw err
    }
  }

  const handleCreateAccount = async (data: AccountFormData) => {
    try {
      const acc = await createAccount(data)
      addToast(
        'success',
        'Cuenta PUC Registrada',
        `Cuenta ${acc.code} (${acc.name}) añadida exitosamente al Plan Único de Cuentas.`
      )
    } catch (err: any) {
      addToast('error', 'No se pudo crear la cuenta', err.message)
      throw err
    }
  }

  const handleReverseEntry = async (entryId: string, reason: string) => {
    try {
      const result = await reverseEntry(entryId, reason)
      addToast(
        'info',
        'Asiento Reversado',
        `Se generó el comprobante de reversión ${result.reversal.entryNumber} para anular ${result.original.entryNumber}.`
      )
    } catch (err: any) {
      addToast('error', 'Error al Revertir Asiento', err.message)
      throw err
    }
  }

  const handleExportCSV = async () => {
    try {
      await exportCSV(
        activeTab === 'accounts'
          ? 'accounts'
          : activeTab === 'journal'
          ? 'journal'
          : activeTab === 'entries'
          ? 'entries'
          : 'balance'
      )
      addToast('success', 'Archivo Exportado', 'El reporte contable ha sido descargado en formato CSV.')
    } catch (err: any) {
      addToast('error', 'Error en Exportación', err.message)
    }
  }

  const handleInspectAccountInLedger = (accountId: string) => {
    loadLedgerForAccount(accountId)
    setActiveTab('ledger')
  }

  return (
    <div className="accounting-module page-enter space-y-5">
      {/* Encabezado General */}
      <AccountingHeader
        onOpenNewEntry={() => setIsNewEntryOpen(true)}
        onOpenNewAccount={() => setIsNewAccountOpen(true)}
        onExport={handleExportCSV}
        onRefresh={handleRefresh}
        canCreateEntry={permissions.canCreateEntries}
        canManageAccounts={permissions.canManageAccounts}
        isRefreshing={isRefreshing}
      />

      {/* Pestañas de Navegación con soporte para desplazamiento y swipe en móviles */}
      <ScrollableTabs>
        {TABS_CONFIG.map((tab) => {
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              className={`drawer-tab flex items-center gap-2 ${isActive ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <AppIcon name={tab.icon} size={15} />
              <span>{tab.label}</span>
              {tab.id === 'entries' && entries.length > 0 && (
                <b className="text-[10px] px-1.5 py-0.2 rounded-full bg-blue-100 text-blue-800">
                  {entries.length}
                </b>
              )}
            </button>
          )
        })}
      </ScrollableTabs>

      {/* Alerta de Error si ocurre */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <AppIcon name="warning" size={18} />
            <span>{error}</span>
          </div>
          <button
            type="button"
            className="outline-button text-xs py-1"
            onClick={loadData}
          >
            Reintentar
          </button>
        </div>
      )}

      {/* Contenido Dinámico según la Pestaña Activa */}
      {isLoading ? (
        activeTab === 'dashboard' ? (
          <AccountingStatsSkeleton />
        ) : (
          <AccountingTableSkeleton />
        )
      ) : (
        <>
          {activeTab === 'dashboard' && (
            <AccountingDashboardTab
              dashboard={dashboard}
              onNavigateToTab={(tab) => setActiveTab(tab)}
            />
          )}

          {activeTab === 'accounts' && (
            <AccountingAccountsTab
              accounts={accounts}
              filters={filters}
              onFilterChange={updateFilters}
              onOpenNewAccount={() => setIsNewAccountOpen(true)}
              onInspectAccount={handleInspectAccountInLedger}
              canManageAccounts={permissions.canManageAccounts}
            />
          )}

          {activeTab === 'entries' && (
            <AccountingEntriesTab
              entries={entries}
              filters={filters}
              onFilterChange={updateFilters}
              onSelectEntry={(e) => setSelectedEntry(e)}
              onOpenNewEntry={() => setIsNewEntryOpen(true)}
              canCreateEntry={permissions.canCreateEntries}
            />
          )}

          {activeTab === 'movements' && (
            <AccountingMovementsTab
              movements={movements}
              accounts={accounts}
              filters={filters}
              onFilterChange={updateFilters}
            />
          )}

          {activeTab === 'journal' && (
            <AccountingGeneralJournalTab
              entries={entries}
              onExport={handleExportCSV}
            />
          )}

          {activeTab === 'ledger' && (
            <AccountingGeneralLedgerTab
              accounts={accounts}
              selectedLedger={selectedLedger}
              onSelectAccount={(accId) => loadLedgerForAccount(accId)}
            />
          )}

          {activeTab === 'balance' && (
            <AccountingBalanceSheetTab
              balanceSheet={balanceSheet}
              locationId={filters.locationId}
              onLocationChange={(locId) => updateFilters({ locationId: locId })}
            />
          )}

          {activeTab === 'results' && (
            <AccountingIncomeStatementTab
              incomeStatement={incomeStatement}
              locationId={filters.locationId}
              onLocationChange={(locId) => updateFilters({ locationId: locId })}
            />
          )}

          {activeTab === 'costs' && (
            <AccountingCostsTab
              costs={costAnalysis}
              locationId={filters.locationId}
              onLocationChange={(locId) => updateFilters({ locationId: locId })}
            />
          )}

          {activeTab === 'receivables_payables' && (
            <AccountingReceivablesPayablesTab
              receivables={accountsReceivable}
              payables={accountsPayable}
            />
          )}

          {activeTab === 'config' && (
            <AccountingConfigTab
              categoryMappings={categoryMappings}
              exogenaPrep={exogenaPrep}
              accounts={accounts}
              onUpdateMapping={updateCategoryMapping}
              canManageConfig={permissions.canManageConfig}
            />
          )}
        </>
      )}

      {/* Drawers y Modales */}
      <AccountingEntryDetailDrawer
        entry={selectedEntry}
        isOpen={Boolean(selectedEntry)}
        onClose={() => setSelectedEntry(null)}
        onReverse={handleReverseEntry}
        canCancelEntry={permissions.canCancelEntries}
      />

      <NewManualEntryDrawer
        isOpen={isNewEntryOpen}
        onClose={() => setIsNewEntryOpen(false)}
        accounts={accounts}
        onSubmit={handleCreateManualEntry}
      />

      <NewAccountDrawer
        isOpen={isNewAccountOpen}
        onClose={() => setIsNewAccountOpen(false)}
        accounts={accounts}
        onSubmit={handleCreateAccount}
      />

      {/* Notificaciones flotantes */}
      <AccountingToastContainer toasts={toasts} onDismiss={removeToast} />
    </div>
  )
}
