'use client'

import React, { useState, useCallback, useMemo } from 'react'
import { useAccounting, AccountingTab, AccountingResource } from '../hooks/useAccounting'
import { useAccountingPermissions } from '../hooks/useAccountingPermissions'
import { AccountingHeader } from './AccountingHeader'
import { ScrollableTabs } from '@/components/ui/ScrollableTabs'
import { AppIcon, LightIconName } from '@/components/ui/Icon'

// Tabs
import { AccountingDashboardTab } from './tabs/AccountingDashboardTab'
import { AccountingAccountsTab } from './tabs/AccountingAccountsTab'
import { AccountingEntriesTab } from './tabs/AccountingEntriesTab'
import { AccountingThirdPartiesTab } from './tabs/AccountingThirdPartiesTab'
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
import { NewThirdPartyModal } from './modals/NewThirdPartyModal'
import { AccountingExportModal } from './modals/AccountingExportModal'
import { TrialBalancePdfModal } from './modals/TrialBalancePdfModal'
import { AccountNatureConfirmModal, PendingNatureChange } from './modals/AccountNatureConfirmModal'
import { AccountNatureChangeConfirmationError } from '../services/accounting.service'

// Skeletons & Toasts
import { AccountingStatsSkeleton, AccountingTableSkeleton } from './AccountingSkeleton'
import { AccountingToastContainer, AccountingToastMessage } from './AccountingToast'
import {
  AccountingEntry,
  AccountNature,
  ThirdPartyType,
  AccountingExportType,
  TrialBalanceLevelFilter,
  AccountingExportPdfParams,
} from '../types'
import { AccountFormData, ManualEntryFormData, ThirdPartyFormData } from '../schemas/accounting.schema'

const TABS_CONFIG: { id: AccountingTab; label: string; icon: LightIconName }[] = [
  { id: 'dashboard', label: 'Dashboard Contable', icon: 'dashboard' },
  { id: 'accounts', label: 'Plan de Cuentas (PUC)', icon: 'layers' },
  { id: 'entries', label: 'Asientos Contables', icon: 'receipt' },
  { id: 'third_parties', label: 'Terceros (DIAN)', icon: 'users' },
  { id: 'movements', label: 'Libro Auxiliar', icon: 'table' },
  { id: 'journal', label: 'Libro Diario', icon: 'fileText' },
  { id: 'ledger', label: 'Libro Mayor', icon: 'accounting' },
  { id: 'balance', label: 'Balance General', icon: 'wallet' },
  { id: 'results', label: 'Estado de Resultados', icon: 'pieChart' },
  { id: 'costs', label: 'Sistema de Costos', icon: 'purchases' },
  { id: 'receivables_payables', label: 'Cartera (CxC / CxP)', icon: 'creditCard' },
  { id: 'config', label: 'Configuración Contable', icon: 'settings' },
]

// Datos que necesita cada panel flotante mientras está abierto.
const NEW_ENTRY_RESOURCES: AccountingResource[] = ['accounts', 'thirdParties', 'voucherTypes']
const NEW_ACCOUNT_RESOURCES: AccountingResource[] = ['accounts']
const EXPORT_RESOURCES: AccountingResource[] = ['thirdParties', 'entries', 'movements', 'accounts']

export function AccountingPage() {
  const permissions = useAccountingPermissions('SUPERADMIN')

  // Modales y Drawers
  const [isNewEntryOpen, setIsNewEntryOpen] = useState(false)
  const [isNewAccountOpen, setIsNewAccountOpen] = useState(false)
  const [isNewThirdPartyOpen, setIsNewThirdPartyOpen] = useState(false)
  const [isExportModalOpen, setIsExportModalOpen] = useState(false)
  const [isTrialBalancePdfOpen, setIsTrialBalancePdfOpen] = useState(false)

  const panelResources = useMemo<AccountingResource[]>(() => {
    const resources: AccountingResource[] = []
    if (isNewEntryOpen) resources.push(...NEW_ENTRY_RESOURCES)
    if (isNewAccountOpen) resources.push(...NEW_ACCOUNT_RESOURCES)
    if (isExportModalOpen || isTrialBalancePdfOpen) resources.push(...EXPORT_RESOURCES)
    return Array.from(new Set(resources))
  }, [isNewEntryOpen, isNewAccountOpen, isExportModalOpen, isTrialBalancePdfOpen])

  const {
    activeTab,
    setActiveTab,
    isLoading,
    error,
    dashboard,
    accounts,
    entries,
    thirdParties,
    movements,
    auxiliaryReport,
    balanceSheet,
    incomeStatement,
    selectedLedger,
    accountsReceivable,
    accountsPayable,
    costAnalysis,
    inventoryLineAccounts,
    inventoryLineAccountsState,
    voucherTypes,
    voucherTypesState,
    updateVoucherType,
    exogenaPrep,
    filters,
    updateFilters,
    loadData,
    loadLedgerForAccount,
    createAccount,
    updateAccountNature,
    createThirdParty,
    updateThirdPartyType,
    createManualEntry,
    reverseEntry,
    saveInventoryLineAccounts,
    resetInventoryLineAccounts,
  } = useAccounting('SUPERADMIN', { extraResources: panelResources })

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

  const [exportInitialType, setExportInitialType] = useState<AccountingExportType>('third_parties')
  const [pdfReportType, setPdfReportType] = useState<AccountingExportType>('trial_balance')
  const [accountingPdfParams, setAccountingPdfParams] = useState<AccountingExportPdfParams>({
    reportType: 'trial_balance',
    mainAccountCode: 'ALL',
    maxLevel: 'SUBACCOUNT',
    includeThirdParties: true,
    hideZeroBalances: true,
  })
  const [selectedEntry, setSelectedEntry] = useState<AccountingEntry | null>(null)
  const [pendingNatureChange, setPendingNatureChange] = useState<PendingNatureChange | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const handleOpenAccountingPdf = useCallback(
    (type: AccountingExportType, params?: Partial<AccountingExportPdfParams>) => {
      setPdfReportType(type)
      if (params) {
        setAccountingPdfParams({
          reportType: type,
          mainAccountCode: params.mainAccountCode || 'ALL',
          startAccountCode: params.startAccountCode || '',
          endAccountCode: params.endAccountCode || '',
          locationId: params.locationId || 'ALL',
          voucherType: params.voucherType || 'TODOS',
          selectedThirdPartyId: params.selectedThirdPartyId || 'ALL',
          thirdPartyType: params.thirdPartyType || 'ALL',
          legalNature: params.legalNature || 'ALL',
          entryStatus: params.entryStatus || 'ALL',
          searchQuery: params.searchQuery || '',
          maxLevel: params.maxLevel || 'SUBACCOUNT',
          includeThirdParties: params.includeThirdParties !== undefined ? params.includeThirdParties : true,
          hideZeroBalances: params.hideZeroBalances !== undefined ? params.hideZeroBalances : true,
          startDate: params.startDate,
          endDate: params.endDate,
        })
      }
      setIsTrialBalancePdfOpen(true)
    },
    []
  )

  const handleOpenTrialBalancePdf = useCallback(() => {
    handleOpenAccountingPdf('trial_balance')
  }, [handleOpenAccountingPdf])

  // Balance General en PDF con la fecha de corte y la sede de la pestaña.
  const handleOpenBalancePdf = useCallback(() => {
    handleOpenAccountingPdf('balance', {
      endDate: filters.cutoffDate,
      locationId: filters.locationId,
      maxLevel: 'AUXILIARY',
      hideZeroBalances: true,
    })
  }, [handleOpenAccountingPdf, filters.cutoffDate, filters.locationId])

  // Estado de Resultados en PDF con el periodo y la sede de la pestaña.
  const handleOpenIncomeStatementPdf = useCallback(() => {
    handleOpenAccountingPdf('income_statement', {
      startDate: filters.resultsDateFrom,
      endDate: filters.resultsDateTo,
      locationId: filters.locationId,
      maxLevel: 'AUXILIARY',
      hideZeroBalances: true,
    })
  }, [handleOpenAccountingPdf, filters.resultsDateFrom, filters.resultsDateTo, filters.locationId])

  const handleOpenExportModal = useCallback((preferredType?: AccountingExportType) => {
    if (preferredType) {
      setExportInitialType(preferredType)
    } else {
      const tabToExportMap: Partial<Record<AccountingTab, AccountingExportType>> = {
        third_parties: 'third_parties',
        entries: 'entries',
        movements: 'movements',
        journal: 'journal',
        accounts: 'accounts',
        balance: 'trial_balance',
      }
      setExportInitialType(tabToExportMap[activeTab] || 'third_parties')
    }
    setIsExportModalOpen(true)
  }, [activeTab])

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

  const handleCreateThirdParty = async (data: ThirdPartyFormData) => {
    try {
      const created = await createThirdParty(data)
      addToast(
        'success',
        'Tercero Registrado Exitosamente',
        `${created.companyName} (${created.legalNature === 'JURIDICA' ? 'Persona Jurídica' : 'Persona Natural'}) ha sido guardado.`
      )
      return created
    } catch (err: any) {
      addToast('error', 'Error al registrar tercero', err.message)
      throw err
    }
  }

  const handleUpdateThirdPartyType = async (id: string, newType: ThirdPartyType) => {
    try {
      await updateThirdPartyType(id, newType)
      const roleName =
        newType === 'CLIENTE'
          ? 'Cliente (Ventas)'
          : newType === 'PROVEEDOR'
          ? 'Proveedor (Compras)'
          : newType === 'EMPLEADO'
          ? 'Empleado'
          : newType === 'ACREEDOR'
          ? 'Acreedor'
          : 'Otro'
      addToast('success', 'Rol de Tercero Actualizado', `Clasificación modificada a: ${roleName}.`)
    } catch (err: any) {
      addToast('error', 'Error al cambiar rol del tercero', err.message)
      throw err
    }
  }

  const applyAccountNatureChange = async (accountId: string, nature: AccountNature, confirmedWithMovements: boolean) => {
    const updated = await updateAccountNature(accountId, nature, { confirmedWithMovements })
    addToast(
      'success',
      'Naturaleza Contable Actualizada',
      `Cuenta ${updated.code} configurada como naturaleza ${nature === 'DEBIT' ? 'Débito' : 'Crédito'}.`
    )
  }

  const handleUpdateAccountNature = async (accountId: string, nature: AccountNature) => {
    try {
      await applyAccountNatureChange(accountId, nature, false)
    } catch (err: any) {
      // Cuenta con movimientos: se pide confirmación explícita antes de cambiarla.
      if (err instanceof AccountNatureChangeConfirmationError) {
        setPendingNatureChange({
          accountId,
          accountCode: err.account.code,
          accountName: err.account.name,
          currentNature: err.account.nature,
          requestedNature: nature,
          movementLines: err.movementLines,
        })
        return
      }
      addToast('error', 'Error al actualizar naturaleza', err.message)
      throw err
    }
  }

  const handleConfirmNatureChange = async () => {
    if (!pendingNatureChange) return
    try {
      await applyAccountNatureChange(pendingNatureChange.accountId, pendingNatureChange.requestedNature, true)
      setPendingNatureChange(null)
    } catch (err: any) {
      addToast('error', 'Error al actualizar naturaleza', err.message)
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
    handleOpenExportModal()
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
        onOpenNewThirdParty={() => setIsNewThirdPartyOpen(true)}
        onExport={() => handleOpenExportModal()}
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
              onUpdateNature={handleUpdateAccountNature}
              canManageAccounts={permissions.canManageAccounts}
            />
          )}

          {activeTab === 'entries' && (
            <AccountingEntriesTab
              entries={entries}
              filters={filters}
              voucherTypes={voucherTypes}
              onFilterChange={updateFilters}
              onSelectEntry={(e) => setSelectedEntry(e)}
            />
          )}

          {activeTab === 'third_parties' && (
            <AccountingThirdPartiesTab
              thirdParties={thirdParties}
              onOpenNewThirdParty={() => setIsNewThirdPartyOpen(true)}
              onExport={() => handleOpenExportModal('third_parties')}
              canManageThirdParties={permissions.canManageAccounts}
              onUpdateThirdPartyType={handleUpdateThirdPartyType}
            />
          )}

          {activeTab === 'movements' && (
            <AccountingMovementsTab
              movements={movements}
              accounts={accounts}
              entries={entries}
              auxiliaryReport={auxiliaryReport}
              filters={filters}
              onFilterChange={updateFilters}
              onSelectEntry={(e) => setSelectedEntry(e)}
              onExportAuxiliary={() => handleOpenExportModal('movements')}
            />
          )}

          {activeTab === 'journal' && (
            <AccountingGeneralJournalTab
              entries={entries}
              onExport={() => handleOpenExportModal('journal')}
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
              cutoffDate={filters.cutoffDate}
              onFiltersChange={(changes) => updateFilters(changes)}
              onOpenBalancePdf={handleOpenBalancePdf}
              onOpenTrialBalancePdf={() => handleOpenTrialBalancePdf()}
            />
          )}

          {activeTab === 'results' && (
            <AccountingIncomeStatementTab
              incomeStatement={incomeStatement}
              locationId={filters.locationId}
              dateFrom={filters.resultsDateFrom}
              dateTo={filters.resultsDateTo}
              onFiltersChange={(changes) => updateFilters(changes)}
              onOpenPdf={handleOpenIncomeStatementPdf}
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
              inventoryLineAccounts={inventoryLineAccounts}
              inventoryLineAccountsState={inventoryLineAccountsState}
              voucherTypes={voucherTypes}
              voucherTypesState={voucherTypesState}
              onUpdateVoucherType={async (voucherType, changes) => {
                try {
                  const updated = await updateVoucherType(voucherType, changes)
                  addToast('success', `Tipo de comprobante ${updated.code} actualizado`)
                } catch (err: any) {
                  addToast('error', 'No se pudo actualizar el tipo de comprobante', err?.message)
                  throw err
                }
              }}
              exogenaPrep={exogenaPrep}
              onSaveInventoryLine={async (data) => {
                await saveInventoryLineAccounts(data)
                addToast('success', 'Cuentas de la línea de inventario guardadas')
              }}
              onResetInventoryLine={async (line) => {
                await resetInventoryLineAccounts(line)
                addToast('info', `La línea ${line.inventoryAccount.code} usa ahora las cuentas por defecto`)
              }}
              onRetry={loadData}
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
        voucherTypes={voucherTypes}
      />

      <NewManualEntryDrawer
        isOpen={isNewEntryOpen}
        onClose={() => setIsNewEntryOpen(false)}
        accounts={accounts}
        voucherTypes={voucherTypes}
        thirdParties={thirdParties}
        onOpenNewThirdParty={() => setIsNewThirdPartyOpen(true)}
        onSubmit={handleCreateManualEntry}
      />

      <NewAccountDrawer
        isOpen={isNewAccountOpen}
        onClose={() => setIsNewAccountOpen(false)}
        accounts={accounts}
        onSubmit={handleCreateAccount}
      />

      <NewThirdPartyModal
        isOpen={isNewThirdPartyOpen}
        onClose={() => setIsNewThirdPartyOpen(false)}
        onSubmit={handleCreateThirdParty}
      />

      <AccountingExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        initialType={exportInitialType}
        thirdParties={thirdParties}
        entries={entries}
        movements={movements}
        accounts={accounts}
        onSuccessToast={(title, desc) => addToast('success', title, desc)}
        onOpenPdfReport={handleOpenAccountingPdf}
        onOpenTrialBalancePdf={(params) =>
          handleOpenAccountingPdf('trial_balance', {
            reportType: 'trial_balance',
            ...params,
          })
        }
      />

      <TrialBalancePdfModal
        isOpen={isTrialBalancePdfOpen}
        onClose={() => setIsTrialBalancePdfOpen(false)}
        reportType={pdfReportType}
        accounts={accounts}
        movements={movements}
        entries={entries}
        thirdParties={thirdParties}
        initialMainAccountCode={accountingPdfParams.mainAccountCode}
        initialStartAccountCode={accountingPdfParams.startAccountCode}
        initialEndAccountCode={accountingPdfParams.endAccountCode}
        initialLocationId={accountingPdfParams.locationId}
        initialVoucherType={accountingPdfParams.voucherType}
        initialSelectedThirdPartyId={accountingPdfParams.selectedThirdPartyId}
        initialThirdPartyType={accountingPdfParams.thirdPartyType}
        initialLegalNature={accountingPdfParams.legalNature}
        initialEntryStatus={accountingPdfParams.entryStatus}
        initialSearchQuery={accountingPdfParams.searchQuery}
        initialMaxLevel={accountingPdfParams.maxLevel}
        initialIncludeThirdParties={accountingPdfParams.includeThirdParties}
        initialHideZeroBalances={accountingPdfParams.hideZeroBalances}
        initialStartDate={accountingPdfParams.startDate}
        initialEndDate={accountingPdfParams.endDate}
      />

      <AccountNatureConfirmModal
        pending={pendingNatureChange}
        onCancel={() => setPendingNatureChange(null)}
        onConfirm={handleConfirmNatureChange}
      />

      {/* Notificaciones flotantes */}
      <AccountingToastContainer toasts={toasts} onDismiss={removeToast} />
    </div>
  )
}
