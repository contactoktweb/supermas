'use client'

import { useState, useEffect, useCallback } from 'react'
import { accountingService } from '../services/accounting.service'
import {
  AccountingAccount,
  AccountingEntry,
  AccountingMovement,
  AccountingDashboard,
  BalanceSheetReport,
  IncomeStatementReport,
  GeneralLedgerReport,
  AccountsReceivableItem,
  AccountsPayableItem,
  CostAnalysisItem,
  InventoryAccountMapping,
  ExogenaPrepItem,
  AccountingFilters,
} from '../types'
import { AccountFormData, ManualEntryFormData } from '../schemas/accounting.schema'

export type AccountingTab =
  | 'dashboard'
  | 'accounts'
  | 'entries'
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
  const [movements, setMovements] = useState<AccountingMovement[]>([])
  const [totalMovements, setTotalMovements] = useState(0)

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
    locationId: 'ALL',
    accountId: 'ALL',
    page: 1,
    pageSize: 25,
  })

  // Carga inicial y reactiva de datos
  const loadData = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)

      const [dashRes, accsRes, entriesRes, movsRes, bsRes, isRes, cxcRes, cxpRes, costsRes, mapRes, exoRes] =
        await Promise.all([
          accountingService.getDashboard(userRole),
          accountingService.getAccounts(filters, userRole),
          accountingService.getEntries(filters, userRole),
          accountingService.getMovements(filters, userRole),
          accountingService.getBalanceSheet('2026-09', filters.locationId, userRole),
          accountingService.getIncomeStatement('2026-09', filters.locationId, userRole),
          accountingService.getAccountsReceivable(userRole),
          accountingService.getAccountsPayable(userRole),
          accountingService.getCostAnalysis({ locationId: filters.locationId }, userRole),
          accountingService.getCategoryMappings(userRole),
          accountingService.getExogenaPreparation(userRole),
        ])

      setDashboard(dashRes)
      setAccounts(accsRes.data)
      setTotalAccounts(accsRes.total)
      setEntries(entriesRes.data)
      setTotalEntries(entriesRes.total)
      setMovements(movsRes.data)
      setTotalMovements(movsRes.total)
      setBalanceSheet(bsRes)
      setIncomeStatement(isRes)
      setAccountsReceivable(cxcRes)
      setAccountsPayable(cxpRes)
      setCostAnalysis(costsRes)
      setCategoryMappings(mapRes)
      setExogenaPrep(exoRes)

      // Cargar libro mayor para la primera cuenta por defecto (110505)
      if (accsRes.data.length > 0) {
        const firstAcc = accsRes.data.find((a) => a.code === '110505') || accsRes.data[0]
        const ledgerRes = await accountingService.getGeneralLedger(firstAcc.id, '2026-09', filters.locationId, userRole)
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

  const exportCSV = async (type: 'entries' | 'accounts' | 'journal' | 'ledger' | 'balance' | 'exogena') => {
    let filename = `supermas-${type}-${new Date().toISOString().split('T')[0]}.csv`
    let csvContent = ''

    if (type === 'entries' || type === 'journal') {
      const headers = ['Numero', 'Fecha', 'Tipo', 'Documento', 'Descripcion', 'Tercero', 'Debito', 'Credito', 'Estado']
      const rows = entries.map((e) => [
        e.entryNumber,
        e.date,
        e.sourceType,
        e.documentNumber || '',
        `"${e.description.replace(/"/g, '""')}"`,
        `"${(e.thirdPartyName || '').replace(/"/g, '""')}"`,
        e.totalDebit,
        e.totalCredit,
        e.status,
      ])
      csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
    } else if (type === 'accounts') {
      const headers = ['Codigo', 'Nombre', 'Clase', 'Tipo', 'Naturaleza', 'Nivel', 'Saldo']
      const rows = accounts.map((a) => [
        a.code,
        `"${a.name.replace(/"/g, '""')}"`,
        a.accountClass,
        a.type,
        a.nature,
        a.level,
        a.balance,
      ])
      csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
    } else {
      const headers = ['Cuenta', 'Nombre', 'Saldo']
      const rows = accounts.map((a) => [a.code, `"${a.name}"`, a.balance])
      csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', filename)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
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
    movements,
    totalMovements,
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
    createManualEntry,
    reverseEntry,
    updateCategoryMapping,
    exportCSV,
  }
}
