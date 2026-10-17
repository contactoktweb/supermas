'use client'

import { useState, useEffect, useCallback } from 'react'
import { accountingService } from '../services/accounting.service'
import { accountingExportService } from '../services/accounting-export.service'
import {
  AccountingAccount,
  AccountingEntry,
  AccountingMovement,
  AccountingDashboard,
  BalanceSheetReport,
  IncomeStatementReport,
  GeneralLedgerReport,
  AuxiliaryLedgerReport,
  AccountsReceivableItem,
  AccountsPayableItem,
  CostAnalysisItem,
  InventoryAccountMapping,
  ExogenaPrepItem,
  AccountingFilters,
  ThirdParty,
  LegalNature,
  ThirdPartyType,
  AccountNature,
} from '../types'
import {
  AccountFormData,
  ManualEntryFormData,
  ThirdPartyFormData,
} from '../schemas/accounting.schema'

export type AccountingTab =
  | 'dashboard'
  | 'accounts'
  | 'entries'
  | 'third_parties'
  | 'movements'
  | 'journal'
  | 'ledger'
  | 'balance'
  | 'results'
  | 'costs'
  | 'receivables_payables'
  | 'config'

export function useAccounting(userRole: string = 'SUPERADMIN') {
  const [activeTab, setActiveTab] = useState<AccountingTab>('dashboard')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Datos principales
  const [dashboard, setDashboard] = useState<AccountingDashboard | null>(null)
  const [accounts, setAccounts] = useState<AccountingAccount[]>([])
  const [totalAccounts, setTotalAccounts] = useState(0)
  const [entries, setEntries] = useState<AccountingEntry[]>([])
  const [totalEntries, setTotalEntries] = useState(0)
  const [thirdParties, setThirdParties] = useState<ThirdParty[]>([])
  const [movements, setMovements] = useState<AccountingMovement[]>([])
  const [totalMovements, setTotalMovements] = useState(0)
  const [auxiliaryReport, setAuxiliaryReport] = useState<AuxiliaryLedgerReport | null>(null)

  // Reportes y sub-vistas
  const [balanceSheet, setBalanceSheet] = useState<BalanceSheetReport | null>(null)
  const [incomeStatement, setIncomeStatement] = useState<IncomeStatementReport | null>(null)
  const [selectedLedger, setSelectedLedger] = useState<GeneralLedgerReport | null>(null)
  const [accountsReceivable, setAccountsReceivable] = useState<AccountsReceivableItem[]>([])
  const [accountsPayable, setAccountsPayable] = useState<AccountsPayableItem[]>([])
  const [costAnalysis, setCostAnalysis] = useState<CostAnalysisItem[]>([])
  const [categoryMappings, setCategoryMappings] = useState<InventoryAccountMapping[]>([])
  const [exogenaPrep, setExogenaPrep] = useState<ExogenaPrepItem[]>([])

  // Filtros globales
  const [filters, setFilters] = useState<AccountingFilters>({
    query: '',
    accountClass: 'ALL',
    nature: 'ALL',
    status: 'ALL',
    sourceType: 'ALL',
    entryStatus: 'ALL',
    periodMode: 'MONTH',
    year: 2026,
    month: '09',
    locationId: 'ALL',
    accountId: 'ALL',
    thirdPartyId: 'ALL',
    costCenterId: 'ALL',
    page: 1,
    pageSize: 25,
  })

  // Carga inicial y reactiva de datos
  const loadData = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)

      const [dashRes, accsRes, entriesRes, movsRes, auxRes, bsRes, isRes, cxcRes, cxpRes, costsRes, mapRes, exoRes, tpsRes] =
        await Promise.all([
          accountingService.getDashboard(userRole),
          accountingService.getAccounts(filters, userRole),
          accountingService.getEntries(filters, userRole),
          accountingService.getMovements(filters, userRole),
          accountingService.getAuxiliaryLedgerReport(filters, userRole),
          accountingService.getBalanceSheet('2026-09', filters.locationId, userRole),
          accountingService.getIncomeStatement('2026-09', filters.locationId, userRole),
          accountingService.getAccountsReceivable(userRole),
          accountingService.getAccountsPayable(userRole),
          accountingService.getCostAnalysis({ locationId: filters.locationId }, userRole),
          accountingService.getCategoryMappings(userRole),
          accountingService.getExogenaPreparation(userRole),
          accountingService.getThirdParties({}, userRole),
        ])

      setDashboard(dashRes)
      setAccounts(accsRes.data)
      setTotalAccounts(accsRes.total)
      setEntries(entriesRes.data)
      setTotalEntries(entriesRes.total)
      setThirdParties(tpsRes)
      setMovements(movsRes.data)
      setTotalMovements(movsRes.total)
      setAuxiliaryReport(auxRes)
      setBalanceSheet(bsRes)
      setIncomeStatement(isRes)
      setAccountsReceivable(cxcRes)
      setAccountsPayable(cxpRes)
      setCostAnalysis(costsRes)
      setCategoryMappings(mapRes)
      setExogenaPrep(exoRes)

      // Cargar libro mayor para la primera cuenta con movimientos (130505 - Clientes Nacionales)
      if (accsRes.data.length > 0) {
        const preferredAcc =
          accsRes.data.find((a) => a.code === '130505') ||
          accsRes.data.find((a) => a.code === '111005') ||
          accsRes.data[0]
        const ledgerRes = await accountingService.getGeneralLedger(preferredAcc.id, '2026-09', filters.locationId, userRole)
        setSelectedLedger(ledgerRes)
      }
    } catch (err: any) {
      setError(err.message || 'Error al cargar los datos contables.')
    } finally {
      setIsLoading(false)
    }
  }, [filters, userRole])

  useEffect(() => {
    loadData()
  }, [loadData])

  const updateFilters = (newFilters: Partial<AccountingFilters>) => {
    setFilters((prev) => ({ ...prev, ...newFilters, page: 1 }))
  }

  const resetFilters = () => {
    setFilters({
      query: '',
      accountClass: 'ALL',
      nature: 'ALL',
      status: 'ALL',
      sourceType: 'ALL',
      entryStatus: 'ALL',
      locationId: 'ALL',
      accountId: 'ALL',
      page: 1,
      pageSize: 25,
    })
  }

  const loadLedgerForAccount = async (accountId: string) => {
    try {
      const ledger = await accountingService.getGeneralLedger(accountId, '2026-09', filters.locationId, userRole)
      setSelectedLedger(ledger)
    } catch (err: any) {
      setError(err.message)
    }
  }

  const createAccount = async (data: AccountFormData) => {
    const created = await accountingService.createAccount(data, {
      id: 'usr-admin',
      name: 'Admin Mauricio',
      role: userRole,
    })
    await loadData()
    return created
  }

  const updateAccount = async (id: string, data: Partial<AccountFormData>) => {
    const updated = await accountingService.updateAccount(id, data, {
      id: 'usr-admin',
      name: 'Admin Mauricio',
      role: userRole,
    })
    await loadData()
    return updated
  }

  const updateAccountNature = async (id: string, nature: AccountNature) => {
    const updated = await accountingService.updateAccountNature(id, nature, {
      id: 'usr-admin',
      name: 'Admin Mauricio',
      role: userRole,
    })
    await loadData()
    return updated
  }

  const loadThirdParties = async (filters?: { query?: string; nature?: LegalNature | 'ALL'; type?: ThirdPartyType | 'ALL' }) => {
    const data = await accountingService.getThirdParties(filters, userRole)
    setThirdParties(data)
    return data
  }

  const createThirdParty = async (data: ThirdPartyFormData) => {
    const created = await accountingService.createThirdParty(data, {
      id: 'usr-admin',
      name: 'Admin Mauricio',
      role: userRole,
    })
    setThirdParties((prev) => [created, ...prev])
    return created
  }

  const updateThirdPartyType = async (id: string, type: ThirdPartyType) => {
    const updated = await accountingService.updateThirdPartyType(id, type, {
      id: 'usr-admin',
      name: 'Admin Mauricio',
      role: userRole,
    })
    setThirdParties((prev) => prev.map((tp) => (tp.id === id ? { ...tp, thirdPartyType: type } : tp)))
    return updated
  }

  const createManualEntry = async (data: ManualEntryFormData) => {
    const created = await accountingService.createManualEntry(data, {
      id: 'usr-admin',
      name: 'Admin Mauricio',
      role: userRole,
    })
    await loadData()
    return created
  }

  const reverseEntry = async (entryId: string, reason: string) => {
    const result = await accountingService.reverseEntry(entryId, reason, {
      id: 'usr-admin',
      name: 'Admin Mauricio',
      role: userRole,
    })
    await loadData()
    return result
  }

  const updateCategoryMapping = async (mapping: InventoryAccountMapping) => {
    const updated = await accountingService.updateCategoryMapping(mapping, {
      id: 'usr-admin',
      name: 'Admin Mauricio',
      role: userRole,
    })
    await loadData()
    return updated
  }

  const exportCSV = async (
    type: 'entries' | 'accounts' | 'journal' | 'ledger' | 'balance' | 'exogena' | 'auxiliary' | 'third_parties',
    format: 'CSV' | 'EXCEL' | 'JSON' = 'CSV'
  ) => {
    if (type === 'third_parties') {
      return accountingExportService.exportThirdParties(thirdParties, format)
    }
    if (type === 'auxiliary') {
      return accountingExportService.exportAuxiliary(auxiliaryReport?.movements || movements, format)
    }
    if (type === 'entries') {
      return accountingExportService.exportEntries(entries, format)
    }
    if (type === 'journal') {
      return accountingExportService.exportJournal(entries, format)
    }
    if (type === 'accounts') {
      return accountingExportService.exportAccounts(accounts, format)
    }
    if (type === 'balance') {
      return accountingExportService.exportBalance(accounts, format)
    }

    // Fallback estándar
    return accountingExportService.exportAccounts(accounts, format)
  }

  return {
    activeTab,
    setActiveTab,
    isLoading,
    error,
    dashboard,
    accounts,
    totalAccounts,
    entries,
    totalEntries,
    thirdParties,
    movements,
    totalMovements,
    auxiliaryReport,
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
    resetFilters,
    loadData,
    loadLedgerForAccount,
    createAccount,
    updateAccount,
    updateAccountNature,
    createThirdParty,
    updateThirdPartyType,
    loadThirdParties,
    createManualEntry,
    reverseEntry,
    updateCategoryMapping,
    exportCSV,
  }
}
