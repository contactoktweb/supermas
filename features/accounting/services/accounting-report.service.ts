/**
 * SUPER MÁS ERP/POS - Servicio de Reportes Financieros y Costos (accountingReportService)
 *
 * Consolida la información financiera y operativa a partir de los movimientos
 * contables reales generados por el ERP. Ningún valor es inventado ni hardcodeado.
 */

import { accountingRepository } from '../repositories/accounting.repository'
import { supabaseClient } from '@/lib/supabase/client'
import { resolveUserCompanyId } from '@/lib/supabase/tenant'
import {
  AccountingDashboard,
  BalanceSheetReport,
  IncomeStatementReport,
  GeneralLedgerReport,
  AuxiliaryLedgerReport,
  AuxiliaryLedgerAccountSummary,
  AuxiliaryLedgerMovementItem,
  AccountingFilters,
  AccountsReceivableItem,
  AccountsPayableItem,
  CostAnalysisItem,
  WarehouseFinancialSummary,
  ExogenaPrepItem,
  BalanceSheetParams,
  IncomeStatementParams,
  FinancialStatementNode,
  TrialBalanceTotals,
} from '../types'
import {
  buildAccountTree,
  isZeroAmount,
  nodeHasActivity,
  roundCurrency,
  sumTotalsByCodePrefix,
} from '../utils/account-tree'
import { formatPucRangeLabel, isPucCodeInRange, normalizePucRange } from '../utils/puc-code-range'
import {
  currentBogotaMonthRange,
  formatDateRangeEs,
  formatIsoDateEs,
  formatNowBogota,
  isIsoDate,
  todayBogotaIsoDate,
} from '../utils/report-format'

/** Suma días a una fecha 'YYYY-MM-DD' (aritmética en UTC: es una fecha contable, sin hora). */
function shiftIsoDate(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split('-').map(Number)
  const shifted = new Date(Date.UTC(year, (month || 1) - 1, day || 1) + days * 86_400_000)
  return shifted.toISOString().slice(0, 10)
}

export class AccountingReportService {
  /**
   * Genera el Dashboard financiero consolidado
   */
  async getDashboard(): Promise<AccountingDashboard> {
    // Lecturas independientes en paralelo; catálogo, saldos y movimientos salen de la caché compartida.
    const [accounts, entryStatuses, allMovements, warehouseBreakdown] = await Promise.all([
      accountingRepository.getAllAccounts(),
      accountingRepository.getRecentEntryStatuses(),
      accountingRepository.getAllMovements(),
      this.getWarehouseFinancials(),
    ])

    let totalAssets = 0
    let totalLiabilities = 0
    let totalEquity = 0
    let totalRevenues = 0
    let totalExpenses = 0
    let totalCosts = 0
    let totalValuedInventory = 0
    let cashAndBanks = 0
    let cxcTotal = 0
    let cxpTotal = 0
    let taxPayable = 0

    for (const acc of accounts) {
      const bal = Number(acc.balance) || 0
      switch (acc.accountClass) {
        case 1:
          totalAssets += bal
          if (acc.code.startsWith('14')) totalValuedInventory += bal
          if (acc.code.startsWith('11')) cashAndBanks += bal
          if (acc.code.startsWith('13')) cxcTotal += bal
          break
        case 2:
          totalLiabilities += bal
          if (acc.code.startsWith('22')) cxpTotal += bal
          if (acc.code.startsWith('24')) taxPayable += bal
          break
        case 3:
          totalEquity += bal
          break
        case 4:
          totalRevenues += bal
          break
        case 5:
          totalExpenses += bal
          break
        case 6:
        case 7:
          totalCosts += bal
          break
      }
    }

    const netProfit = totalRevenues - totalCosts - totalExpenses
    const profitMarginPercent = totalRevenues > 0 ? Number(((netProfit / totalRevenues) * 100).toFixed(1)) : 0

    // Conteo de comprobantes reales
    const postedEntriesCount = entryStatuses.filter((status) => status === 'POSTED').length
    const pendingDraftEntriesCount = entryStatuses.filter((status) => status === 'DRAFT').length

    // Puntos mensuales calculados a partir de movimientos contables reales
    const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
    const now = new Date()
    const currentYear = now.getFullYear()
    const currentMonth = now.getMonth()

    const monthlyFinancials = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(currentYear, currentMonth - i, 1)
      const yr = d.getFullYear()
      const mo = String(d.getMonth() + 1).padStart(2, '0')
      const periodKey = `${yr}-${mo}`
      const label = monthNames[d.getMonth()]

      const monthMovements = allMovements.filter((m) => m.period === periodKey || m.date.startsWith(periodKey))
      let rev = 0
      let cst = 0
      let exp = 0

      for (const m of monthMovements) {
        const code = m.accountCode || ''
        const debit = Number(m.debit) || 0
        const credit = Number(m.credit) || 0
        if (code.startsWith('4')) {
          rev += (credit - debit)
        } else if (code.startsWith('6') || code.startsWith('7')) {
          cst += (debit - credit)
        } else if (code.startsWith('5')) {
          exp += (debit - credit)
        }
      }

      monthlyFinancials.push({
        month: periodKey,
        label,
        revenue: Math.max(0, rev),
        cost: Math.max(0, cst),
        expenses: Math.max(0, exp),
        profit: rev - cst - exp,
      })
    }

    return {
      totalAssets,
      totalLiabilities,
      totalEquity,
      totalRevenues,
      totalExpenses,
      totalCosts,
      netProfit,
      profitMarginPercent,
      totalValuedInventory,
      accountsReceivableTotal: cxcTotal,
      accountsPayableTotal: cxpTotal,
      cashAndBanksTotal: cashAndBanks,
      taxPayableTotal: taxPayable,
      postedEntriesCount,
      pendingDraftEntriesCount,
      monthlyFinancials,
      warehouseBreakdown,
    }
  }

  /** Nombre de la sede para los encabezados (undefined = consolidado). */
  private async resolveLocationName(locationId?: string | null): Promise<string | undefined> {
    if (!locationId || locationId === 'ALL') return undefined
    const locations = await accountingRepository.getActiveLocations().catch(() => [])
    const fromCache = locations.find((l) => l.id === locationId)?.name
    if (fromCache) return fromCache
    const { data: loc } = await supabaseClient.from('locations').select('name').eq('id', locationId).maybeSingle()
    return loc?.name || undefined
  }

  /**
   * Estado de Situación Financiera (Balance General) desglosado Clase → Grupo → Cuenta →
   * Subcuenta → Auxiliar, con saldos acumulados hasta la fecha de corte (incluida).
   *
   * - Saldos: fn_accounting_account_balances_range(NULL, corte, sede, desde, hasta) → débitos y
   *   créditos por cuenta; cada nivel suma su subárbol según su naturaleza (ver account-tree).
   * - ACTIVO = clase 1 (D − C), PASIVO = clase 2 (C − D), PATRIMONIO = clase 3 (C − D)
   *   + resultado del ejercicio no cerrado = Ingresos 4 (C − D) − Gastos 5 − Costos 6 − Costos 7 (D − C).
   *   Tras el cierre las clases 4 a 7 quedan en cero y el resultado ya está en la clase 3.
   * - Ecuación: Activo = Pasivo + Patrimonio (cuadra si la diferencia redondeada a centavos es 0).
   */
  async getBalanceSheet(params: Partial<BalanceSheetParams> = {}): Promise<BalanceSheetReport> {
    const cutoffDate = /^\d{4}-\d{2}-\d{2}$/.test(params.cutoffDate || '') ? params.cutoffDate! : todayBogotaIsoDate()
    const locationId = params.locationId && params.locationId !== 'ALL' ? params.locationId : undefined
    const range = normalizePucRange({ from: params.accountFrom, to: params.accountTo })
    const rangeActive = Boolean(range.from || range.to)
    // El resultado del ejercicio pertenece al patrimonio (3605/3610): solo se muestra si el rango lo cubre.
    const includesCurrentResult = !rangeActive || isPucCodeInRange('3605', range) || isPucCodeInRange('3610', range)

    const [accounts, totals, resultTotals, locationName] = await Promise.all([
      accountingRepository.getAllAccounts(),
      accountingRepository.getAccountBalanceTotals({
        dateTo: cutoffDate,
        locationId,
        accountFrom: range.from,
        accountTo: range.to,
      }),
      rangeActive && includesCurrentResult
        ? accountingRepository.getAccountBalanceTotals({ dateTo: cutoffDate, locationId, accountFrom: '4', accountTo: '7' })
        : Promise.resolve(null),
      this.resolveLocationName(locationId),
    ])

    const tree = buildAccountTree(accounts, totals, { classes: [1, 2, 3], range })
    const resultTree = buildAccountTree(accounts, resultTotals || totals, { classes: [4, 5, 6, 7] })
    const rootOf = (nodes: FinancialStatementNode[], accountClass: number) =>
      nodes.find((node) => node.accountClass === accountClass) || null

    const assets = rootOf(tree, 1)
    const liabilities = rootOf(tree, 2)
    const equity = rootOf(tree, 3)

    // Cada raíz trae débitos y créditos de todo su subárbol.
    const creditMinusDebit = (node: FinancialStatementNode | null) => (node ? node.credit - node.debit : 0)
    const debitMinusCredit = (node: FinancialStatementNode | null) => (node ? node.debit - node.credit : 0)
    const revenues = includesCurrentResult ? roundCurrency(creditMinusDebit(rootOf(resultTree, 4))) : 0
    const expenses = includesCurrentResult ? roundCurrency(debitMinusCredit(rootOf(resultTree, 5))) : 0
    const costOfSales = includesCurrentResult ? roundCurrency(debitMinusCredit(rootOf(resultTree, 6))) : 0
    const productionCosts = includesCurrentResult ? roundCurrency(debitMinusCredit(rootOf(resultTree, 7))) : 0
    const currentYearResult = roundCurrency(revenues - expenses - costOfSales - productionCosts)

    const totalAssets = assets?.balance ?? 0
    const totalLiabilities = liabilities?.balance ?? 0
    const totalEquityAccounts = equity?.balance ?? 0
    const totalEquity = roundCurrency(totalEquityAccounts + currentYearResult)
    const totalLiabilitiesAndEquity = roundCurrency(totalLiabilities + totalEquity)
    const difference = roundCurrency(totalAssets - totalLiabilitiesAndEquity)

    return {
      period: `Corte al ${formatIsoDateEs(cutoffDate)}`,
      cutoffDate,
      locationId,
      locationName,
      accountFrom: range.from || undefined,
      accountTo: range.to || undefined,
      accountRangeLabel: formatPucRangeLabel(range),
      assets,
      liabilities,
      equity,
      currentYearResult,
      resultBreakdown: { revenues, expenses, costOfSales, productionCosts },
      totalAssets,
      totalLiabilities,
      totalEquityAccounts,
      totalEquity,
      totalLiabilitiesAndEquity,
      isBalanced: isZeroAmount(difference),
      difference,
      hasBalances: tree.some(nodeHasActivity) || !isZeroAmount(currentYearResult),
      generatedAt: formatNowBogota(),
    }
  }

  /**
   * Totales del Balance de Comprobación consultados en la base:
   * saldo anterior = movimientos hasta el día previo a `startDate`; periodo = [startDate, endDate].
   */
  async getTrialBalanceTotals(params: {
    startDate?: string
    endDate?: string
    locationId?: string
    accountFrom?: string
    accountTo?: string
  }): Promise<TrialBalanceTotals> {
    const locationId = params.locationId && params.locationId !== 'ALL' ? params.locationId : undefined
    const range = { accountFrom: params.accountFrom, accountTo: params.accountTo }
    const dayBeforeStart = params.startDate ? shiftIsoDate(params.startDate, -1) : null

    const [opening, period] = await Promise.all([
      dayBeforeStart
        ? accountingRepository.getAccountBalanceTotals({ dateTo: dayBeforeStart, locationId, ...range })
        : Promise.resolve(new Map() as TrialBalanceTotals['opening']),
      accountingRepository.getAccountBalanceTotals({
        dateFrom: params.startDate || null,
        dateTo: params.endDate || null,
        locationId,
        ...range,
      }),
    ])
    return { opening, period }
  }

  /**
   * Estado de Resultados Integral del periodo [dateFrom, dateTo] (por defecto el mes en curso en
   * America/Bogota), desglosado Clase → Grupo → Cuenta → Subcuenta → Auxiliar.
   *
   * - Importes: fn_accounting_account_balances_range(desde, hasta, sede) → movimientos del periodo
   *   (asientos POSTED y REVERSED: un asiento y su reversión se compensan).
   * - Estructura (PUC comercial, Decreto 2650 de 1993):
   *   Ingresos operacionales (41) − Costos (6 y 7) = Utilidad bruta
   *   − Gastos operacionales de administración (51) y de ventas (52) = Utilidad operacional
   *   + Ingresos no operacionales (resto de la clase 4) − Gastos no operacionales (53)
   *   = Utilidad antes de impuestos − Impuesto de renta (54) − otros gastos de la clase 5
   *   = Utilidad neta = Ingresos (4) − Gastos (5) − Costos (6 y 7).
   */
  async getIncomeStatement(params: Partial<IncomeStatementParams> = {}): Promise<IncomeStatementReport> {
    const defaults = currentBogotaMonthRange()
    let dateFrom = isIsoDate(params.dateFrom) ? params.dateFrom : defaults.dateFrom
    let dateTo = isIsoDate(params.dateTo) ? params.dateTo : defaults.dateTo
    if (dateFrom > dateTo) [dateFrom, dateTo] = [dateTo, dateFrom]
    const locationId = params.locationId && params.locationId !== 'ALL' ? params.locationId : undefined

    const [accounts, totals, locationName] = await Promise.all([
      accountingRepository.getAllAccounts(),
      accountingRepository.getAccountBalanceTotals({ dateFrom, dateTo, locationId, accountFrom: '4', accountTo: '7' }),
      this.resolveLocationName(locationId),
    ])

    const tree = buildAccountTree(accounts, totals, { classes: [4, 5, 6, 7] })
    const rootOf = (accountClass: number) => tree.find((node) => node.accountClass === accountClass) || null
    const creditBalance = (prefix: string) => {
      const sum = sumTotalsByCodePrefix(accounts, totals, prefix)
      return roundCurrency(sum.credit - sum.debit)
    }
    const debitBalance = (prefix: string) => {
      const sum = sumTotalsByCodePrefix(accounts, totals, prefix)
      return roundCurrency(sum.debit - sum.credit)
    }
    const percentOf = (value: number, base: number) =>
      isZeroAmount(base) ? 0 : Math.round((value / base) * 1000) / 10

    const totalRevenues = creditBalance('4')
    const operatingRevenues = creditBalance('41')
    const nonOperatingIncome = roundCurrency(totalRevenues - operatingRevenues)

    const totalCosts = roundCurrency(debitBalance('6') + debitBalance('7'))
    const grossProfit = roundCurrency(operatingRevenues - totalCosts)

    const totalExpenses = debitBalance('5')
    const administrativeExpenses = debitBalance('51')
    const sellingExpenses = debitBalance('52')
    const totalOperatingExpenses = roundCurrency(administrativeExpenses + sellingExpenses)
    const operatingProfit = roundCurrency(grossProfit - totalOperatingExpenses)

    const nonOperatingExpenses = debitBalance('53')
    const profitBeforeTax = roundCurrency(operatingProfit + nonOperatingIncome - nonOperatingExpenses)
    const incomeTax = debitBalance('54')
    const otherExpenses = roundCurrency(totalExpenses - totalOperatingExpenses - nonOperatingExpenses - incomeTax)
    const netProfit = roundCurrency(profitBeforeTax - incomeTax - otherExpenses)

    return {
      period: formatDateRangeEs(dateFrom, dateTo),
      dateFrom,
      dateTo,
      locationId,
      locationName,
      revenues: rootOf(4),
      expenses: rootOf(5),
      costOfSales: rootOf(6),
      productionCosts: rootOf(7),
      totalRevenues,
      operatingRevenues,
      nonOperatingIncome,
      totalCosts,
      grossProfit,
      grossMarginPercent: percentOf(grossProfit, operatingRevenues),
      administrativeExpenses,
      sellingExpenses,
      totalOperatingExpenses,
      operatingProfit,
      nonOperatingExpenses,
      profitBeforeTax,
      incomeTax,
      otherExpenses,
      totalExpenses,
      netProfit,
      netMarginPercent: percentOf(netProfit, totalRevenues),
      hasActivity: tree.some(nodeHasActivity),
      generatedAt: formatNowBogota(),
    }
  }

  /**
   * Libro Mayor por cuenta contable
   */
  async getGeneralLedger(accountId: string, period?: string, locationId?: string): Promise<GeneralLedgerReport> {
    const account = await accountingRepository.findAccountByIdOrCode(accountId)

    if (!account) {
      throw new Error(`Cuenta contable con identificador "${accountId}" no existe.`)
    }

    let movements = await accountingRepository.getAllMovements()
    movements = movements.filter((m) => m.accountId === account.id || m.accountCode === account.code)

    if (locationId && locationId !== 'ALL') {
      movements = movements.filter((m) => m.locationId === locationId)
    }

    if (period) {
      movements = movements.filter((m) => m.period === period)
    }

    const totalDebit = movements.reduce((acc, m) => acc + (Number(m.debit) || 0), 0)
    const totalCredit = movements.reduce((acc, m) => acc + (Number(m.credit) || 0), 0)

    const initialBalance = 0
    const isDebitNature = account.nature === 'DEBIT'
    const finalBalance = isDebitNature
      ? initialBalance + totalDebit - totalCredit
      : initialBalance + totalCredit - totalDebit

    return {
      accountId: account.id,
      accountCode: account.code,
      accountName: account.name,
      period: period || todayBogotaIsoDate().slice(0, 7),
      initialBalance,
      movements,
      totalDebit,
      totalCredit,
      finalBalance,
    }
  }

  /**
   * Libro Auxiliar: Consulta avanzada por cuenta contable y periodo (mes, año o rango de fechas)
   * con cálculo de saldo inicial, movimientos débitos (+), movimientos créditos (-) y saldo final.
   */
  async getAuxiliaryLedgerReport(filters?: AccountingFilters): Promise<AuxiliaryLedgerReport> {
    // Con rango de cuentas los movimientos se filtran en la base; sin rango se reutiliza la caché.
    const accountRange = normalizePucRange({ from: filters?.accountFrom, to: filters?.accountTo })
    const hasAccountRange = Boolean(accountRange.from || accountRange.to)
    const [allAccounts, allMovements] = await Promise.all([
      accountingRepository.getAllAccounts(),
      hasAccountRange
        ? accountingRepository
            .getMovements({ accountFrom: accountRange.from, accountTo: accountRange.to, page: 1, pageSize: 2000 })
            .then((res) => res.data)
        : accountingRepository.getAllMovements(),
    ])
    const accounts = hasAccountRange
      ? allAccounts.filter((acc) => isPucCodeInRange(acc.code, accountRange))
      : allAccounts

    // 1. Determinar el periodo
    const periodMode = filters?.periodMode || 'MONTH'
    const now = new Date()
    const currentYear = filters?.year || now.getFullYear()
    const currentMonthNum = filters?.month ? parseInt(filters.month, 10) : now.getMonth() + 1
    const monthStr = String(currentMonthNum).padStart(2, '0')

    let dateFrom = ''
    let dateTo = ''
    let periodLabel = ''

    if (periodMode === 'MONTH') {
      dateFrom = `${currentYear}-${monthStr}-01`
      const lastDay = new Date(currentYear, currentMonthNum, 0).getDate()
      dateTo = `${currentYear}-${monthStr}-${String(lastDay).padStart(2, '0')}`
      const monthNames = [
        'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
      ]
      periodLabel = `${monthNames[currentMonthNum - 1]} ${currentYear}`
    } else if (periodMode === 'YEAR') {
      dateFrom = `${currentYear}-01-01`
      dateTo = `${currentYear}-12-31`
      periodLabel = `Año Fiscal ${currentYear}`
    } else {
      dateFrom = filters?.dateFrom || `${currentYear}-${monthStr}-01`
      dateTo = filters?.dateTo || `${currentYear}-${monthStr}-30`
      periodLabel = `${dateFrom} al ${dateTo}`
    }

    // 2. Determinar si hay una cuenta específica seleccionada
    const accountFilter = filters?.accountId && filters.accountId !== 'ALL' ? filters.accountId : null
    const selectedAccount = accountFilter
      ? allAccounts.find((a) => a.id === accountFilter || a.code === accountFilter) || null
      : null

    const q = filters?.query ? filters.query.toLowerCase().trim() : ''

    const isMatchAccount = (m: any, accIdOrCode: string) =>
      m.accountId === accIdOrCode || m.accountCode === accIdOrCode

    // 3. Saldo inicial: movimientos históricos anteriores a dateFrom
    let initialBalance = 0
    if (selectedAccount) {
      const isDebitNature = selectedAccount.nature === 'DEBIT'
      const priorMovements = allMovements.filter(
        (m) => isMatchAccount(m, selectedAccount.id) && m.date < dateFrom
      )
      const priorDebits = priorMovements.reduce((acc, m) => acc + (Number(m.debit) || 0), 0)
      const priorCredits = priorMovements.reduce((acc, m) => acc + (Number(m.credit) || 0), 0)

      // Saldo inicial real basado estrictamente en movimientos previos a dateFrom
      initialBalance = isDebitNature
        ? priorDebits - priorCredits
        : priorCredits - priorDebits
    }

    // 4. Movimientos dentro del periodo seleccionado
    const periodMovements = allMovements.filter((m) => {
      // Filtro de fechas
      if (m.date < dateFrom || m.date > `${dateTo}T23:59:59Z`) return false

      // Cuenta específica
      if (selectedAccount && !isMatchAccount(m, selectedAccount.id)) return false

      // Tercero
      if (filters?.thirdPartyId && filters.thirdPartyId !== 'ALL') {
        const tId = filters.thirdPartyId.toLowerCase()
        const matchTercero =
          m.thirdPartyId?.toLowerCase() === tId ||
          m.thirdPartyDoc?.toLowerCase().includes(tId) ||
          m.thirdPartyName?.toLowerCase().includes(tId)
        if (!matchTercero) return false
      }

      // Centro de Costo / Bodega
      if (filters?.costCenterId && filters.costCenterId !== 'ALL') {
        if (m.locationId !== filters.costCenterId) return false
      }

      // Query de texto
      if (q) {
        const matchCode = m.accountCode.toLowerCase().includes(q)
        const matchName = m.accountName.toLowerCase().includes(q)
        const matchDoc =
          m.sourceDocumentNumber?.toLowerCase().includes(q) || m.entryNumber?.toLowerCase().includes(q)
        const matchDesc = m.description.toLowerCase().includes(q)
        const matchThird = m.thirdPartyName?.toLowerCase().includes(q) || m.thirdPartyDoc?.includes(q)
        if (!matchCode && !matchName && !matchDoc && !matchDesc && !matchThird) return false
      }

      return true
    })

    // Ordenar cronológicamente ascendente para cálculo del saldo progresivo
    periodMovements.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

    let running = initialBalance
    const isDebit = selectedAccount ? selectedAccount.nature === 'DEBIT' : true

    const movementsWithBalance: AuxiliaryLedgerMovementItem[] = periodMovements.map((m) => {
      const debit = Number(m.debit) || 0
      const credit = Number(m.credit) || 0
      if (isDebit) {
        running = running + debit - credit
      } else {
        running = running + credit - debit
      }

      return {
        ...m,
        runningBalance: running,
        costCenterName: m.locationName || 'Bodega Principal',
      }
    })

    const totalDebit = movementsWithBalance.reduce((acc, m) => acc + m.debit, 0)
    const totalCredit = movementsWithBalance.reduce((acc, m) => acc + m.credit, 0)
    const finalBalance = selectedAccount
      ? isDebit
        ? initialBalance + totalDebit - totalCredit
        : initialBalance + totalCredit - totalDebit
      : totalDebit - totalCredit

    // 5. Resumen agrupado por cuenta para consulta consolidada
    const accountSummaries: AuxiliaryLedgerAccountSummary[] = accounts
      .map((acc) => {
        const accMovements = allMovements.filter((m) => {
          if (!isMatchAccount(m, acc.id)) return false
          if (m.date < dateFrom || m.date > `${dateTo}T23:59:59Z`) return false
          if (filters?.thirdPartyId && filters.thirdPartyId !== 'ALL') {
            const tId = filters.thirdPartyId!.toLowerCase()
            const matchThird =
              m.thirdPartyId?.toLowerCase() === tId ||
              m.thirdPartyDoc?.toLowerCase().includes(tId) ||
              m.thirdPartyName?.toLowerCase().includes(tId)
            if (!matchThird) return false
          }
          if (filters?.costCenterId && filters.costCenterId !== 'ALL' && m.locationId !== filters.costCenterId) {
            return false
          }
          return true
        })

        const dSum = accMovements.reduce((sum, m) => sum + (Number(m.debit) || 0), 0)
        const cSum = accMovements.reduce((sum, m) => sum + (Number(m.credit) || 0), 0)
        const isAccDebit = acc.nature === 'DEBIT'
        const priorAccMovements = allMovements.filter((m) => isMatchAccount(m, acc.id) && m.date < dateFrom)
        const priorD = priorAccMovements.reduce((s, m) => s + (Number(m.debit) || 0), 0)
        const priorC = priorAccMovements.reduce((s, m) => s + (Number(m.credit) || 0), 0)
        const accInitial = isAccDebit ? priorD - priorC : priorC - priorD
        const accFinal = isAccDebit ? accInitial + dSum - cSum : accInitial + cSum - dSum

        return {
          accountId: acc.id,
          accountCode: acc.code,
          accountName: acc.name,
          nature: acc.nature,
          accountClass: acc.accountClass,
          initialBalance: accInitial,
          totalDebit: dSum,
          totalCredit: cSum,
          finalBalance: accFinal,
          movementsCount: accMovements.length,
        }
      })
      .filter((s) => s.totalDebit > 0 || s.totalCredit > 0 || !isZeroAmount(s.initialBalance))

    // Movimientos ordenados del más reciente al más antiguo para visualización
    const movementsDisplay = [...movementsWithBalance].reverse()

    return {
      selectedAccount,
      periodMode,
      periodLabel,
      dateFrom,
      dateTo,
      initialBalance,
      totalDebit,
      totalCredit,
      finalBalance,
      accountSummaries,
      movements: movementsDisplay,
      accountRangeLabel: formatPucRangeLabel(accountRange),
    }
  }

  /**
   * Cartera de Clientes - Cuentas por Cobrar (CxC)
   */
  async getAccountsReceivable(companyIdOverride?: string): Promise<AccountsReceivableItem[]> {
    let companyId: string | null = null
    try {
      companyId = await resolveUserCompanyId(supabaseClient, companyIdOverride)
    } catch {
      companyId = companyIdOverride || null
    }
    if (!companyId) return []

    const { data: sales, error } = await supabaseClient
      .from('sales')
      .select(`
        id,
        sale_number,
        total_amount,
        paid_amount,
        created_at,
        due_date,
        customer_id,
        customers (id, company_name, first_name, last_name, document_type, document_number),
        locations (id, name)
      `)
      .eq('company_id', companyId)
      .neq('status', 'CANCELLED')
      .order('created_at', { ascending: false })

    if (error || !sales) return []

    const results: AccountsReceivableItem[] = []
    const now = new Date().getTime()

    for (const sale of sales as any[]) {
      const total = Number(sale.total_amount) || 0
      const paid = Number(sale.paid_amount) || 0
      const pending = Math.max(0, total - paid)
      if (pending <= 0) continue

      const dueTime = new Date(sale.due_date || sale.created_at).getTime()
      const diffDays = Math.floor((now - dueTime) / (1000 * 60 * 60 * 24))
      const daysOverdue = Math.max(0, diffDays)

      let status: 'CURRENT' | 'OVERDUE' | 'CRITICAL' = 'CURRENT'
      if (daysOverdue > 30) status = 'CRITICAL'
      else if (daysOverdue > 0) status = 'OVERDUE'

      const cust = sale.customers || {}
      const customerName = cust.company_name || `${cust.first_name || ''} ${cust.last_name || ''}`.trim() || 'Cliente'
      const customerDoc = cust.document_number ? `${cust.document_type || 'CC'} ${cust.document_number}` : ''
      const loc = sale.locations || {}

      results.push({
        customerId: sale.customer_id,
        customerName,
        customerDoc,
        invoiceId: sale.id,
        invoiceNumber: sale.sale_number,
        locationName: loc.name || 'Bodega Principal',
        date: sale.created_at,
        dueDate: sale.due_date || sale.created_at,
        total,
        paidAmount: paid,
        pendingBalance: pending,
        daysOverdue,
        status,
      })
    }

    return results
  }

  /**
   * Cartera de Proveedores - Cuentas por Pagar (CxP)
   */
  async getAccountsPayable(companyIdOverride?: string): Promise<AccountsPayableItem[]> {
    let companyId: string | null = null
    try {
      companyId = await resolveUserCompanyId(supabaseClient, companyIdOverride)
    } catch {
      companyId = companyIdOverride || null
    }
    if (!companyId) return []

    const { data: purchases, error } = await supabaseClient
      .from('purchases')
      .select(`
        id,
        purchase_number,
        supplier_invoice_number,
        total_amount,
        paid_amount,
        issue_date,
        due_date,
        supplier_id,
        suppliers (id, name, legal_name, tax_id),
        locations (id, name)
      `)
      .eq('company_id', companyId)
      .neq('inventory_status', 'CANCELLED')
      .order('created_at', { ascending: false })

    if (error || !purchases) return []

    const results: AccountsPayableItem[] = []
    const now = new Date().getTime()

    for (const pur of purchases as any[]) {
      const total = Number(pur.total_amount) || 0
      const paid = Number(pur.paid_amount) || 0
      const pending = Math.max(0, total - paid)
      if (pending <= 0) continue

      const dueTime = new Date(pur.due_date || pur.issue_date).getTime()
      const diffDays = Math.floor((now - dueTime) / (1000 * 60 * 60 * 24))
      const daysOverdue = Math.max(0, diffDays)

      let status: 'CURRENT' | 'OVERDUE' | 'CRITICAL' = 'CURRENT'
      if (daysOverdue > 30) status = 'CRITICAL'
      else if (daysOverdue > 0) status = 'OVERDUE'

      const sup = pur.suppliers || {}
      const supplierName = sup.name || sup.legal_name || 'Proveedor'
      const supplierDoc = sup.tax_id || ''
      const loc = pur.locations || {}

      results.push({
        supplierId: pur.supplier_id,
        supplierName,
        supplierDoc,
        purchaseId: pur.id,
        purchaseNumber: pur.purchase_number,
        supplierInvoiceNumber: pur.supplier_invoice_number || pur.purchase_number || '',
        locationName: loc.name || 'Bodega Principal',
        date: pur.issue_date,
        dueDate: pur.due_date || pur.issue_date,
        total,
        paidAmount: paid,
        pendingBalance: pending,
        daysOverdue,
        status,
      })
    }

    return results
  }

  /**
   * Sistema de Costos: Análisis Compra vs Venta por Producto y Bodega
   */
  async getCostAnalysis(filters?: { locationId?: string; category?: string }): Promise<CostAnalysisItem[]> {
    const companyId = await resolveUserCompanyId(supabaseClient)
    let prodQuery = supabaseClient
      .from('products')
      .select(`
        id,
        sku,
        barcode,
        name,
        category,
        unit_type,
        cost_price,
        sale_price,
        wholesale_price,
        stock_levels (quantity, location_id, cost:average_cost)
      `)
      .eq('company_id', companyId)
      .eq('is_active', true)

    if (filters?.category && filters.category !== 'ALL') {
      prodQuery = prodQuery.eq('category', filters.category)
    }

    const [{ data: products }, { data: locations }] = await Promise.all([
      prodQuery,
      supabaseClient.from('locations').select('id, name').eq('company_id', companyId),
    ])

    const locMap = new Map((locations || []).map((l: any) => [l.id, l.name]))
    const results: CostAnalysisItem[] = []

    for (const prod of (products as any[]) || []) {
      const cost = Number(prod.cost_price) || 0
      const normalPrice = Number(prod.sale_price) || 0
      const wholesalePrice = Number(prod.wholesale_price) || 0
      const marginCOP = normalPrice - cost
      const marginPercent = normalPrice > 0 ? Number(((marginCOP / normalPrice) * 100).toFixed(1)) : 0

      const rawStock = (prod.stock_levels as any[]) || []
      const filteredStock = filters?.locationId && filters.locationId !== 'ALL'
        ? rawStock.filter((st: any) => st.location_id === filters.locationId)
        : rawStock

      const stock = filteredStock.reduce((acc: number, st: any) => acc + (Number(st.quantity) || 0), 0)
      const totalValuedCost = stock * cost

      const targetLocId = (filters?.locationId && filters.locationId !== 'ALL') ? filters.locationId : (filteredStock[0]?.location_id || 'loc-001')

      results.push({
        productId: prod.id,
        sku: prod.sku,
        barcode: prod.barcode || '',
        name: prod.name,
        category: prod.category || 'General',
        unitOfMeasure: prod.unit_type || 'UND',
        locationId: targetLocId,
        locationName: locMap.get(targetLocId) || 'Bodega Principal',
        averageCost: cost,
        lastPurchaseCost: cost,
        normalPrice,
        wholesalePrice,
        profitMarginCOP: marginCOP,
        profitMarginPercent: marginPercent,
        stockQuantity: stock,
        totalValuedCost,
      })
    }

    return results
  }

  /**
   * Resumen Financiero Desglosado por Bodega / Centro de Costos
   */
  async getWarehouseFinancials(): Promise<WarehouseFinancialSummary[]> {
    const companyId = await resolveUserCompanyId(supabaseClient)
    const [{ data: locations }, movements, { data: sales }, { data: purchases }, { data: stockLevels }] =
      await Promise.all([
        supabaseClient
          .from('locations')
          .select('id, name, code, type')
          .eq('company_id', companyId)
          .neq('status', 'INACTIVE'),
        accountingRepository.getAllMovements(),
        supabaseClient
          .from('sales')
          .select('location_id, total_amount, paid_amount, status')
          .eq('company_id', companyId)
          .neq('status', 'CANCELLED'),
        supabaseClient
          .from('purchases')
          .select('location_id, total_amount, paid_amount, inventory_status')
          .eq('company_id', companyId)
          .neq('inventory_status', 'CANCELLED'),
        supabaseClient
          .from('stock_levels')
          .select('location_id, quantity, cost:average_cost')
          .eq('company_id', companyId),
      ])

    return ((locations as any[]) || []).map((loc: any) => {
      const locMovements = movements.filter((m) => m.locationId === loc.id)
      const locSales = ((sales as any[]) || []).filter((s: any) => s.location_id === loc.id)
      const salesTotal = locSales.reduce((acc: number, s: any) => acc + (Number(s.total_amount) || 0), 0)

      const locPurchases = ((purchases as any[]) || []).filter((p: any) => p.location_id === loc.id)
      const costsTotal = locPurchases.reduce((acc: number, p: any) => acc + (Number(p.total_amount) || 0), 0)

      const grossProfit = salesTotal - costsTotal
      const marginPercent = salesTotal > 0 ? Number(((grossProfit / salesTotal) * 100).toFixed(1)) : 0

      const locStock = ((stockLevels as any[]) || []).filter((st: any) => st.location_id === loc.id)
      const inventoryValued = locStock.reduce((acc: number, st: any) => acc + ((Number(st.quantity) || 0) * (Number(st.cost) || 0)), 0)

      const pendingReceivables = locSales.reduce((acc: number, s: any) => acc + Math.max(0, (Number(s.total_amount) || 0) - (Number(s.paid_amount) || 0)), 0)
      const pendingPayables = locPurchases.reduce((acc: number, p: any) => acc + Math.max(0, (Number(p.total_amount) || 0) - (Number(p.paid_amount) || 0)), 0)

      return {
        locationId: loc.id,
        locationCode: loc.code || 'BOD',
        locationName: loc.name,
        type: loc.type,
        salesTotal,
        costsTotal,
        grossProfit,
        marginPercent,
        inventoryValued,
        pendingReceivables,
        pendingPayables,
        movementsCount: locMovements.length,
      }
    })
  }

  /**
   * Preparación de Datos para Exógena DIAN
   */
  async getExogenaPreparation(): Promise<ExogenaPrepItem[]> {
    const movements = await accountingRepository.getAllMovements()
    const results: ExogenaPrepItem[] = []

    for (const m of movements) {
      if (!m.thirdPartyDoc) continue

      let conceptCode = '5001'
      let conceptDescription = 'Pagos o abonos en cuenta por compra de inventario'
      if (m.accountCode.startsWith('41')) {
        conceptCode = '4001'
        conceptDescription = 'Ingresos brutos operacionales recibidos para terceros o propios'
      } else if (m.accountCode.startsWith('2408')) {
        conceptCode = '5005'
        conceptDescription = 'Impuesto sobre las ventas (IVA) descontable / generado'
      } else if (m.accountCode.startsWith('1305')) {
        conceptCode = '1315'
        conceptDescription = 'Cuentas por cobrar a clientes nacionales al cierre del año gravable'
      } else if (m.accountCode.startsWith('2205')) {
        conceptCode = '2201'
        conceptDescription = 'Cuentas por pagar a proveedores al cierre fiscal'
      }

      results.push({
        conceptCode,
        conceptDescription,
        thirdPartyDoc: m.thirdPartyDoc,
        thirdPartyName: m.thirdPartyName || 'Tercero Registrado',
        accountCode: m.accountCode,
        paymentAmount: m.debit > 0 ? m.debit : m.credit,
        taxBaseAmount: m.debit > 0 ? m.debit : m.credit,
        withholdingTaxAmount: 0,
      })
    }

    return results
  }
}

export const accountingReportService = new AccountingReportService()
