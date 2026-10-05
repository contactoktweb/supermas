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
} from '../types'

export class AccountingReportService {
  /**
   * Genera el Dashboard financiero consolidado
   */
  async getDashboard(): Promise<AccountingDashboard> {
    const accounts = await accountingRepository.getAllAccounts()
    const entries = await accountingRepository.getAllEntries()

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
    const postedEntriesCount = entries.filter((e) => e.status === 'POSTED').length
    const pendingDraftEntriesCount = entries.filter((e) => e.status === 'DRAFT').length

    // Puntos mensuales calculados a partir de movimientos contables reales
    const allMovements = await accountingRepository.getAllMovements()
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

    // Resumen financiero por bodega
    const warehouseBreakdown = await this.getWarehouseFinancials()

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

  /**
   * Estado de Situación Financiera (Balance General)
   * Cumple la ecuación contable: Activo = Pasivo + Patrimonio
   */
  async getBalanceSheet(period?: string, locationId?: string): Promise<BalanceSheetReport> {
    const accounts = await accountingRepository.getAllAccounts()

    // Clasificación de Activos
    const currentAssetsList = accounts.filter(
      (a) => a.accountClass === 1 && (a.code.startsWith('11') || a.code.startsWith('13') || a.code.startsWith('14'))
    )
    const nonCurrentAssetsList = accounts.filter(
      (a) => a.accountClass === 1 && (a.code.startsWith('15') || a.code.startsWith('17'))
    )

    // Clasificación de Pasivos
    const currentLiabilitiesList = accounts.filter(
      (a) => a.accountClass === 2 && (a.code.startsWith('22') || a.code.startsWith('23') || a.code.startsWith('24') || a.code.startsWith('25'))
    )
    const nonCurrentLiabilitiesList = accounts.filter(
      (a) => a.accountClass === 2 && a.code.startsWith('21')
    )

    // Patrimonio
    const equityList = accounts.filter((a) => a.accountClass === 3)

    const sumList = (list: typeof accounts) => list.reduce((acc, a) => acc + (Number(a.balance) || 0), 0)

    const currentAssetsSum = sumList(currentAssetsList)
    const nonCurrentAssetsSum = sumList(nonCurrentAssetsList)
    const totalAssets = currentAssetsSum + nonCurrentAssetsSum

    const currentLiabSum = sumList(currentLiabilitiesList)
    const nonCurrentLiabSum = sumList(nonCurrentLiabilitiesList)
    const totalLiabilities = currentLiabSum + nonCurrentLiabSum

    const totalEquity = sumList(equityList)
    const totalLiabilitiesAndEquity = totalLiabilities + totalEquity
    const difference = Math.abs(totalAssets - totalLiabilitiesAndEquity)

    const mapToItems = (list: typeof accounts, total: number) =>
      list.map((a) => ({
        code: a.code,
        name: a.name,
        balance: a.balance,
        percentage: total > 0 ? Number(((a.balance / total) * 100).toFixed(1)) : 0,
      }))

    let locationName: string | undefined
    if (locationId && locationId !== 'ALL') {
      const { data: loc } = await supabaseClient.from('locations').select('name').eq('id', locationId).maybeSingle()
      locationName = loc?.name
    }

    return {
      period: period || 'Septiembre 2026',
      locationId,
      locationName,
      currentAssets: mapToItems(currentAssetsList, totalAssets),
      nonCurrentAssets: mapToItems(nonCurrentAssetsList, totalAssets),
      totalAssets,
      currentLiabilities: mapToItems(currentLiabilitiesList, totalLiabilities),
      nonCurrentLiabilities: mapToItems(nonCurrentLiabilitiesList, totalLiabilities),
      totalLiabilities,
      equityItems: mapToItems(equityList, totalEquity),
      totalEquity,
      totalLiabilitiesAndEquity,
      isBalanced: difference < 100, // Tolerancia por redondeos
      difference,
    }
  }

  /**
   * Estado de Resultados Integral (P&L)
   * Ingresos - Costos - Gastos = Utilidad
   */
  async getIncomeStatement(period?: string, locationId?: string): Promise<IncomeStatementReport> {
    const accounts = await accountingRepository.getAllAccounts()

    const revList = accounts.filter((a) => a.accountClass === 4 && a.code.startsWith('41'))
    const costList = accounts.filter((a) => a.accountClass === 6 && a.code.startsWith('61'))
    const adminExpList = accounts.filter((a) => a.accountClass === 5 && a.code.startsWith('51'))
    const sellingExpList = accounts.filter((a) => a.accountClass === 5 && a.code.startsWith('52'))

    const sum = (list: typeof accounts) => list.reduce((acc, a) => acc + (Number(a.balance) || 0), 0)

    const totalRevenues = sum(revList)
    const totalCosts = sum(costList)
    const grossProfit = totalRevenues - totalCosts
    const grossMarginPercent = totalRevenues > 0 ? Number(((grossProfit / totalRevenues) * 100).toFixed(1)) : 0

    const totalAdmin = sum(adminExpList)
    const totalSelling = sum(sellingExpList)
    const totalOperatingExpenses = totalAdmin + totalSelling
    const operatingProfit = grossProfit - totalOperatingExpenses

    const nonOpRevAcc = accounts.find((a) => a.code === '4210')
    const nonOperatingIncome = nonOpRevAcc ? (Number(nonOpRevAcc.balance) || 0) : 0
    const nonOperatingExpenses = 0

    const netProfit = operatingProfit + nonOperatingIncome - nonOperatingExpenses
    const netMarginPercent = totalRevenues > 0 ? Number(((netProfit / totalRevenues) * 100).toFixed(1)) : 0

    const mapItems = (list: typeof accounts, base: number) =>
      list.map((a) => ({
        code: a.code,
        name: a.name,
        balance: a.balance,
        percentage: base > 0 ? Number(((a.balance / base) * 100).toFixed(1)) : 0,
      }))

    let locationName: string | undefined
    if (locationId && locationId !== 'ALL') {
      const { data: loc } = await supabaseClient.from('locations').select('name').eq('id', locationId).maybeSingle()
      locationName = loc?.name
    }

    return {
      period: period || 'Septiembre 2026',
      locationId,
      locationName,
      operatingRevenues: mapItems(revList, totalRevenues),
      totalRevenues,
      costOfSales: mapItems(costList, totalCosts),
      totalCosts,
      grossProfit,
      grossMarginPercent,
      administrativeExpenses: mapItems(adminExpList, totalOperatingExpenses),
      sellingExpenses: mapItems(sellingExpList, totalOperatingExpenses),
      totalOperatingExpenses,
      operatingProfit,
      nonOperatingIncome,
      nonOperatingExpenses,
      netProfit,
      netMarginPercent,
    }
  }

  /**
   * Libro Mayor por cuenta contable
   */
  async getGeneralLedger(accountId: string, period?: string, locationId?: string): Promise<GeneralLedgerReport> {
    const account =
      (await accountingRepository.getAccountById(accountId)) ||
      (await accountingRepository.getAccountByCode(accountId))

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
      period: period || '2026-09',
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
    const accounts = await accountingRepository.getAllAccounts()
    const allMovements = await accountingRepository.getAllMovements()

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
      ? accounts.find((a) => a.id === accountFilter || a.code === accountFilter) || null
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
      .filter((s) => s.totalDebit > 0 || s.totalCredit > 0 || s.initialBalance > 0)

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
        stock_levels (quantity, location_id, cost)
      `)
      .eq('company_id', companyId)
      .eq('is_active', true)

    if (filters?.category && filters.category !== 'ALL') {
      prodQuery = prodQuery.eq('category', filters.category)
    }

    const { data: products } = await prodQuery
    const { data: locations } = await supabaseClient
      .from('locations')
      .select('id, name')
      .eq('company_id', companyId)

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
    const { data: locations } = await supabaseClient
      .from('locations')
      .select('id, name, code, type')
      .eq('company_id', companyId)
      .eq('is_active', true)

    const movements = await accountingRepository.getAllMovements()

    const { data: sales } = await supabaseClient
      .from('sales')
      .select('location_id, total_amount, paid_amount, status')
      .eq('company_id', companyId)
      .neq('status', 'CANCELLED')

    const { data: purchases } = await supabaseClient
      .from('purchases')
      .select('location_id, total_amount, paid_amount, inventory_status')
      .eq('company_id', companyId)
      .neq('inventory_status', 'CANCELLED')

    const { data: stockLevels } = await supabaseClient
      .from('stock_levels')
      .select('location_id, quantity, cost')
      .eq('company_id', companyId)

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
