'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
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

/** Conjuntos de datos que el módulo carga bajo demanda. */
export type AccountingResource =
  | 'dashboard'
  | 'accounts'
  | 'entries'
  | 'thirdParties'
  | 'movements'
  | 'auxiliary'
  | 'balanceSheet'
  | 'incomeStatement'
  | 'ledger'
  | 'receivables'
  | 'payables'
  | 'costs'
  | 'categoryMappings'
  | 'exogena'

/** Datos que necesita cada pestaña: solo se piden al abrirla. */
const TAB_RESOURCES: Record<AccountingTab, AccountingResource[]> = {
  dashboard: ['dashboard'],
  accounts: ['accounts'],
  entries: ['entries'],
  third_parties: ['thirdParties'],
  movements: ['accounts', 'entries', 'auxiliary'],
  journal: ['entries'],
  ledger: ['accounts', 'ledger'],
  balance: ['balanceSheet'],
  results: ['incomeStatement'],
  costs: ['costs'],
  receivables_payables: ['receivables', 'payables'],
  config: ['categoryMappings', 'exogena', 'accounts'],
}

const ALL_RESOURCES = Object.keys({
  dashboard: 1,
  accounts: 1,
  entries: 1,
  thirdParties: 1,
  movements: 1,
  auxiliary: 1,
  balanceSheet: 1,
  incomeStatement: 1,
  ledger: 1,
  receivables: 1,
  payables: 1,
  costs: 1,
  categoryMappings: 1,
  exogena: 1,
} satisfies Record<AccountingResource, 1>) as AccountingResource[]

const REPORT_PERIOD = '2026-09'

interface ResourceStatus {
  key: string
  state: 'loading' | 'ready' | 'error' | 'stale'
  hasData: boolean
  seq: number
}

interface UseAccountingOptions {
  /** Datos adicionales que requieren los paneles abiertos (drawers/modales). */
  extraResources?: AccountingResource[]
}

/**
 * Clave de cada recurso según los filtros que realmente usa su consulta:
 * si la clave no cambia, se reutilizan los datos ya cargados.
 */
function resourceKey(resource: AccountingResource, filters: AccountingFilters, ledgerAccountId: string | null): string {
  switch (resource) {
    case 'accounts':
      return JSON.stringify([filters.query, filters.accountClass, filters.nature, filters.status, filters.level, filters.page, filters.pageSize])
    case 'entries':
      return JSON.stringify([filters.query, filters.entryStatus, filters.sourceType, filters.locationId, filters.dateFrom, filters.dateTo, filters.page, filters.pageSize])
    case 'movements':
      return JSON.stringify([filters.entryStatus, filters.sourceType, filters.locationId, filters.accountId, filters.dateFrom, filters.dateTo])
    case 'auxiliary':
      return JSON.stringify([filters.periodMode, filters.year, filters.month, filters.dateFrom, filters.dateTo, filters.accountId, filters.query, filters.thirdPartyId, filters.costCenterId])
    case 'balanceSheet':
    case 'incomeStatement':
    case 'costs':
      return String(filters.locationId ?? '')
    case 'ledger':
      // El mayor por defecto se elige entre las cuentas de la página actual del PUC.
      return JSON.stringify([
        filters.locationId,
        ledgerAccountId ?? resourceKey('accounts', filters, null),
      ])
    default:
      return ''
  }
}

export function useAccounting(userRole: string = 'SUPERADMIN', options: UseAccountingOptions = {}) {
  const [activeTab, setActiveTab] = useState<AccountingTab>('dashboard')
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
  const [ledgerAccountId, setLedgerAccountId] = useState<string | null>(null)
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

  // Estado de carga por recurso: en ref para decidir de forma síncrona (StrictMode, efectos repetidos)
  // y espejado en estado para renderizar.
  const statusRef = useRef<Partial<Record<AccountingResource, ResourceStatus>>>({})
  const inFlightRef = useRef<Partial<Record<AccountingResource, Promise<void>>>>({})
  const seqRef = useRef(0)
  const [statusMap, setStatusMap] = useState<Partial<Record<AccountingResource, ResourceStatus>>>({})

  const filtersRef = useRef(filters)
  filtersRef.current = filters
  const ledgerAccountIdRef = useRef(ledgerAccountId)
  ledgerAccountIdRef.current = ledgerAccountId

  const extraResources = options.extraResources
  const extraKey = (extraResources || []).join(',')
  const requiredResources = useMemo<AccountingResource[]>(
    () => Array.from(new Set([...TAB_RESOURCES[activeTab], ...(extraKey ? (extraKey.split(',') as AccountingResource[]) : [])])),
    [activeTab, extraKey]
  )
  const requiredRef = useRef(requiredResources)
  requiredRef.current = requiredResources

  const writeStatus = useCallback((resource: AccountingResource, status: ResourceStatus) => {
    statusRef.current = { ...statusRef.current, [resource]: status }
    setStatusMap(statusRef.current)
  }, [])

  /** Ejecuta la consulta de un recurso y vuelca el resultado en su estado. */
  const fetchResource = useCallback(
    async (resource: AccountingResource, currentFilters: AccountingFilters, currentLedgerId: string | null) => {
      switch (resource) {
        case 'dashboard': {
          const res = await accountingService.getDashboard(userRole)
          return () => setDashboard(res)
        }
        case 'accounts': {
          const res = await accountingService.getAccounts(currentFilters, userRole)
          return () => {
            setAccounts(res.data)
            setTotalAccounts(res.total)
          }
        }
        case 'entries': {
          const res = await accountingService.getEntries(currentFilters, userRole)
          return () => {
            setEntries(res.data)
            setTotalEntries(res.total)
          }
        }
        case 'thirdParties': {
          const res = await accountingService.getThirdParties({}, userRole)
          return () => setThirdParties(res)
        }
        case 'movements': {
          const res = await accountingService.getMovements(currentFilters, userRole)
          return () => {
            setMovements(res.data)
            setTotalMovements(res.total)
          }
        }
        case 'auxiliary': {
          const res = await accountingService.getAuxiliaryLedgerReport(currentFilters, userRole)
          return () => setAuxiliaryReport(res)
        }
        case 'balanceSheet': {
          const res = await accountingService.getBalanceSheet(REPORT_PERIOD, currentFilters.locationId, userRole)
          return () => setBalanceSheet(res)
        }
        case 'incomeStatement': {
          const res = await accountingService.getIncomeStatement(REPORT_PERIOD, currentFilters.locationId, userRole)
          return () => setIncomeStatement(res)
        }
        case 'ledger': {
          let accountId = currentLedgerId
          if (!accountId) {
            // Libro mayor por defecto: 130505 (Clientes Nacionales), 111005 o la primera cuenta listada.
            const accsRes = await accountingService.getAccounts(currentFilters, userRole)
            const preferredAcc =
              accsRes.data.find((a) => a.code === '130505') ||
              accsRes.data.find((a) => a.code === '111005') ||
              accsRes.data[0]
            if (!preferredAcc) return () => undefined
            accountId = preferredAcc.id
          }
          const res = await accountingService.getGeneralLedger(accountId, REPORT_PERIOD, currentFilters.locationId, userRole)
          return () => setSelectedLedger(res)
        }
        case 'receivables': {
          const res = await accountingService.getAccountsReceivable(userRole)
          return () => setAccountsReceivable(res)
        }
        case 'payables': {
          const res = await accountingService.getAccountsPayable(userRole)
          return () => setAccountsPayable(res)
        }
        case 'costs': {
          const res = await accountingService.getCostAnalysis({ locationId: currentFilters.locationId }, userRole)
          return () => setCostAnalysis(res)
        }
        case 'categoryMappings': {
          const res = await accountingService.getCategoryMappings(userRole)
          return () => setCategoryMappings(res)
        }
        case 'exogena': {
          const res = await accountingService.getExogenaPreparation(userRole)
          return () => setExogenaPrep(res)
        }
      }
    },
    [userRole]
  )

  /**
   * Garantiza que los recursos indicados estén cargados para los filtros actuales.
   * Reutiliza lo ya cargado (misma clave) y no duplica peticiones en curso.
   */
  const ensureResources = useCallback(
    (resources: AccountingResource[], force = false): Promise<void> => {
      const currentFilters = filtersRef.current
      const currentLedgerId = ledgerAccountIdRef.current
      const pending: Promise<void>[] = []
      let startedAny = false

      for (const resource of resources) {
        const key = resourceKey(resource, currentFilters, currentLedgerId)
        const status = statusRef.current[resource]
        const sameKey = status?.key === key

        if (!force && sameKey && status?.state === 'ready') continue
        if (!force && sameKey && status?.state === 'loading') {
          const running = inFlightRef.current[resource]
          if (running) pending.push(running)
          continue
        }

        if (!startedAny) {
          startedAny = true
          setError(null)
        }
        const seq = ++seqRef.current
        writeStatus(resource, { key, state: 'loading', hasData: Boolean(status?.hasData), seq })

        const run = fetchResource(resource, currentFilters, currentLedgerId)
          .then((apply) => {
            if (statusRef.current[resource]?.seq !== seq) return
            apply?.()
            writeStatus(resource, { key, state: 'ready', hasData: true, seq })
          })
          .catch((err: any) => {
            if (statusRef.current[resource]?.seq !== seq) return
            setError(err?.message || 'Error al cargar los datos contables.')
            writeStatus(resource, { key, state: 'error', hasData: Boolean(status?.hasData), seq })
          })
          .finally(() => {
            if (inFlightRef.current[resource] === run) delete inFlightRef.current[resource]
          })

        inFlightRef.current[resource] = run
        pending.push(run)
      }

      return Promise.all(pending).then(() => undefined)
    },
    [fetchResource, writeStatus]
  )

  /** Marca todos los datos como desactualizados y recarga los que están a la vista. */
  const reloadVisible = useCallback(async () => {
    accountingService.invalidateCache()
    for (const resource of ALL_RESOURCES) {
      const status = statusRef.current[resource]
      if (status && status.state !== 'loading') {
        statusRef.current = { ...statusRef.current, [resource]: { ...status, state: 'stale' } }
      }
    }
    setStatusMap(statusRef.current)
    await ensureResources(requiredRef.current, true)
  }, [ensureResources])

  // Carga perezosa: solo lo que necesitan la pestaña activa y los paneles abiertos.
  const requiredSignature = requiredResources
    .map((resource) => `${resource}:${resourceKey(resource, filters, ledgerAccountId)}`)
    .join('|')

  useEffect(() => {
    ensureResources(requiredRef.current)
  }, [requiredSignature, ensureResources])

  // El esqueleto solo cubre la primera carga de la pestaña; los paneles cargan sin ocultarla.
  const isLoading = TAB_RESOURCES[activeTab].some((resource) => {
    const status = statusMap[resource]
    if (!status) return true
    return status.state === 'loading' && !status.hasData
  })

  // Recarga manual (botón Actualizar / Reintentar): ignora la caché.
  const loadData = reloadVisible

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

  // Cambia la cuenta del Libro Mayor; la consulta la lanza la carga perezosa de la pestaña.
  const loadLedgerForAccount = (accountId: string) => {
    ledgerAccountIdRef.current = accountId
    setLedgerAccountId(accountId)
  }

  const createAccount = async (data: AccountFormData) => {
    const created = await accountingService.createAccount(data, {
      id: 'usr-admin',
      name: 'Admin Mauricio',
      role: userRole,
    })
    await reloadVisible()
    return created
  }

  const updateAccount = async (id: string, data: Partial<AccountFormData>) => {
    const updated = await accountingService.updateAccount(id, data, {
      id: 'usr-admin',
      name: 'Admin Mauricio',
      role: userRole,
    })
    await reloadVisible()
    return updated
  }

  const updateAccountNature = async (id: string, nature: AccountNature) => {
    const updated = await accountingService.updateAccountNature(id, nature, {
      id: 'usr-admin',
      name: 'Admin Mauricio',
      role: userRole,
    })
    await reloadVisible()
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
    await reloadVisible()
    return created
  }

  const reverseEntry = async (entryId: string, reason: string) => {
    const result = await accountingService.reverseEntry(entryId, reason, {
      id: 'usr-admin',
      name: 'Admin Mauricio',
      role: userRole,
    })
    await reloadVisible()
    return result
  }

  const updateCategoryMapping = async (mapping: InventoryAccountMapping) => {
    const updated = await accountingService.updateCategoryMapping(mapping, {
      id: 'usr-admin',
      name: 'Admin Mauricio',
      role: userRole,
    })
    await reloadVisible()
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
