/**
 * SUPER MÁS ERP/POS - Servicio Central de Contabilidad (accountingService)
 *
 * Fachada principal de negocio para la gestión contable, orquestando repositorios,
 * reglas de partida doble, reportes financieros y auditoría transversal del sistema.
 */

import { accountingRepository } from '../repositories/accounting.repository'
import { accountingRulesService } from './accounting-rules.service'
import { accountingReportService } from './accounting-report.service'
import { auditService } from '@/features/audit/services/audit.service'
import {
  AccountingAccount,
  AccountingEntry,
  AccountingMovement,
  AccountingFilters,
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
  AccountingPermission,
  AccountingPeriod,
} from '../types'
import { AccountFormData, ManualEntryFormData } from '../schemas/accounting.schema'

const ROLE_PERMISSIONS: Record<string, AccountingPermission[]> = {
  SUPERADMIN: [
    'accounting.read',
    'accounting.accounts',
    'accounting.entries',
    'accounting.confirm',
    'accounting.cancel',
    'accounting.reports',
    'accounting.costs',
    'accounting.config',
    'accounting.periods',
  ],
  ACCOUNTANT: [
    'accounting.read',
    'accounting.accounts',
    'accounting.entries',
    'accounting.confirm',
    'accounting.cancel',
    'accounting.reports',
    'accounting.costs',
    'accounting.config',
    'accounting.periods',
  ],
  WAREHOUSE_ADMIN: ['accounting.read', 'accounting.costs'],
  POINT_ADMIN: ['accounting.read', 'accounting.costs'],
  SELLER: [],
  CASHIER: [],
}

export class AccountingService {
  /**
   * Valida si un rol cuenta con un permiso específico
   */
  hasPermission(permission: AccountingPermission, userRole: string = 'SUPERADMIN'): boolean {
    const allowed = ROLE_PERMISSIONS[userRole] || []
    return allowed.includes(permission)
  }

  private assertPermission(permission: AccountingPermission, userRole: string = 'SUPERADMIN'): void {
    if (!this.hasPermission(permission, userRole)) {
      throw new Error(`Acceso denegado: Se requiere el permiso "${permission}" para esta operación contable.`)
    }
  }

  // --- CUENTAS CONTABLES (PUC) ---

  async getAccounts(
    filters?: AccountingFilters,
    userRole: string = 'SUPERADMIN'
  ): Promise<{ data: AccountingAccount[]; total: number }> {
    this.assertPermission('accounting.read', userRole)
    return accountingRepository.getAccounts(filters)
  }

  async getAllAccounts(userRole: string = 'SUPERADMIN'): Promise<AccountingAccount[]> {
    this.assertPermission('accounting.read', userRole)
    return accountingRepository.getAllAccounts()
  }

  async createAccount(
    data: AccountFormData,
    user: { id: string; name: string; role: string }
  ): Promise<AccountingAccount> {
    this.assertPermission('accounting.accounts', user.role)
    const newAccount = await accountingRepository.createAccount(data)

    // Auditoría
    await auditService.log({
      action: 'ACCOUNT_CREATED' as any,
      module: 'ACCOUNTING' as any,
      entityType: 'ACCOUNTING_ACCOUNT',
      entityId: newAccount.id,
      entityReference: `${newAccount.code} - ${newAccount.name}`,
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      level: 'INFO',
      result: 'SUCCESS',
      details: `Creación de cuenta contable PUC ${newAccount.code} (${newAccount.name}) clase ${newAccount.accountClass}`,
      changes: [
        { field: 'code', label: 'Código PUC', previousValue: '—', newValue: newAccount.code },
        { field: 'name', label: 'Nombre de Cuenta', previousValue: '—', newValue: newAccount.name },
        { field: 'nature', label: 'Naturaleza', previousValue: '—', newValue: newAccount.nature },
      ],
    })

    return newAccount
  }

  async updateAccount(
    id: string,
    data: Partial<AccountFormData>,
    user: { id: string; name: string; role: string }
  ): Promise<AccountingAccount> {
    this.assertPermission('accounting.accounts', user.role)
    const previous = await accountingRepository.getAccountById(id)
    const updated = await accountingRepository.updateAccount(id, data)

    // Auditoría
    await auditService.log({
      action: 'ACCOUNT_UPDATED' as any,
      module: 'ACCOUNTING' as any,
      entityType: 'ACCOUNTING_ACCOUNT',
      entityId: updated.id,
      entityReference: `${updated.code} - ${updated.name}`,
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      level: 'INFO',
      result: 'SUCCESS',
      details: `Modificación de cuenta contable ${updated.code}`,
      changes: [
        { field: 'name', label: 'Nombre', previousValue: previous?.name || '—', newValue: updated.name || '—' },
        { field: 'description', label: 'Descripción', previousValue: previous?.description || '—', newValue: updated.description || '—' },
      ],
    })

    return updated
  }

  // --- ASIENTOS CONTABLES ---

  async getEntries(
    filters?: AccountingFilters,
    userRole: string = 'SUPERADMIN'
  ): Promise<{ data: AccountingEntry[]; total: number }> {
    this.assertPermission('accounting.read', userRole)
    return accountingRepository.getEntries(filters)
  }

  async getEntryById(id: string, userRole: string = 'SUPERADMIN'): Promise<AccountingEntry | null> {
    this.assertPermission('accounting.read', userRole)
    return accountingRepository.getEntryById(id)
  }

  async createManualEntry(
    data: ManualEntryFormData,
    user: { id: string; name: string; role: string }
  ): Promise<AccountingEntry> {
    this.assertPermission('accounting.entries', user.role)
    await this.assertPeriodOpen(data.date)
    const entry = await accountingRepository.createManualEntry(data, user)

    await auditService.log({
      action: 'ACCOUNTING_ENTRY_CREATED' as any,
      module: 'ACCOUNTING' as any,
      entityType: 'ACCOUNTING_ENTRY',
      entityId: entry.id,
      entityReference: entry.entryNumber,
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      level: 'INFO',
      result: 'SUCCESS',
      details: `Creación de asiento contable manual ${entry.entryNumber} por valor de $${entry.totalDebit.toLocaleString()} COP`,
      changes: [
        { field: 'totalDebit', label: 'Total Débito', previousValue: '0', newValue: String(entry.totalDebit) },
        { field: 'totalCredit', label: 'Total Crédito', previousValue: '0', newValue: String(entry.totalCredit) },
        { field: 'isBalanced', label: 'Partida Doble', previousValue: 'false', newValue: String(entry.isBalanced) },
      ],
    })

    return entry
  }

  async reverseEntry(
    entryId: string,
    reason: string,
    user: { id: string; name: string; role: string }
  ): Promise<{ original: AccountingEntry; reversal: AccountingEntry }> {
    this.assertPermission('accounting.cancel', user.role)
    await this.assertPeriodOpen(new Date().toISOString())
    const result = await accountingRepository.reverseEntry(entryId, reason, user)

    await auditService.log({
      action: 'ACCOUNTING_ENTRY_REVERSED' as any,
      module: 'ACCOUNTING' as any,
      entityType: 'ACCOUNTING_ENTRY',
      entityId: result.original.id,
      entityReference: `${result.original.entryNumber} -> ${result.reversal.entryNumber}`,
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      level: 'WARNING',
      result: 'SUCCESS',
      details: `Reversión contable de ${result.original.entryNumber} mediante comprobante ${result.reversal.entryNumber}. Justificación: ${reason}`,
      changes: [
        { field: 'status', label: 'Estado Comprobante', previousValue: 'POSTED', newValue: 'REVERSED' },
        { field: 'reversalReason', label: 'Motivo Reversión', previousValue: '—', newValue: reason },
      ],
    })

    return result
  }

  // --- MOVIMIENTOS Y LIBRO AUXILIAR ---

  async getMovements(
    filters?: AccountingFilters,
    userRole: string = 'SUPERADMIN'
  ): Promise<{ data: AccountingMovement[]; total: number }> {
    this.assertPermission('accounting.read', userRole)
    return accountingRepository.getMovements(filters)
  }

  async getAuxiliaryLedgerReport(
    filters?: AccountingFilters,
    userRole: string = 'SUPERADMIN'
  ): Promise<AuxiliaryLedgerReport> {
    this.assertPermission('accounting.read', userRole)
    return accountingReportService.getAuxiliaryLedgerReport(filters)
  }

  // --- REPORTES FINANCIEROS Y DASHBOARD ---

  async getDashboard(userRole: string = 'SUPERADMIN'): Promise<AccountingDashboard> {
    this.assertPermission('accounting.read', userRole)
    return accountingReportService.getDashboard()
  }

  async getBalanceSheet(
    period?: string,
    locationId?: string,
    userRole: string = 'SUPERADMIN'
  ): Promise<BalanceSheetReport> {
    this.assertPermission('accounting.reports', userRole)
    return accountingReportService.getBalanceSheet(period, locationId)
  }

  async getIncomeStatement(
    period?: string,
    locationId?: string,
    userRole: string = 'SUPERADMIN'
  ): Promise<IncomeStatementReport> {
    this.assertPermission('accounting.reports', userRole)
    return accountingReportService.getIncomeStatement(period, locationId)
  }

  async getGeneralLedger(
    accountId: string,
    period?: string,
    locationId?: string,
    userRole: string = 'SUPERADMIN'
  ): Promise<GeneralLedgerReport> {
    this.assertPermission('accounting.reports', userRole)
    return accountingReportService.getGeneralLedger(accountId, period, locationId)
  }

  async getAccountsReceivable(userRole: string = 'SUPERADMIN'): Promise<AccountsReceivableItem[]> {
    this.assertPermission('accounting.read', userRole)
    return accountingReportService.getAccountsReceivable()
  }

  async getAccountsPayable(userRole: string = 'SUPERADMIN'): Promise<AccountsPayableItem[]> {
    this.assertPermission('accounting.read', userRole)
    return accountingReportService.getAccountsPayable()
  }

  async getCostAnalysis(
    filters?: { locationId?: string; category?: string },
    userRole: string = 'SUPERADMIN'
  ): Promise<CostAnalysisItem[]> {
    this.assertPermission('accounting.costs', userRole)
    return accountingReportService.getCostAnalysis(filters)
  }

  async getExogenaPreparation(userRole: string = 'SUPERADMIN'): Promise<ExogenaPrepItem[]> {
    this.assertPermission('accounting.reports', userRole)
    return accountingReportService.getExogenaPreparation()
  }

  // --- CONFIGURACIÓN DE CUENTAS DE INVENTARIO ---

  async getCategoryMappings(userRole: string = 'SUPERADMIN'): Promise<InventoryAccountMapping[]> {
    this.assertPermission('accounting.config', userRole)
    return accountingRepository.getCategoryMappings()
  }

  async updateCategoryMapping(
    mapping: InventoryAccountMapping,
    user: { id: string; name: string; role: string }
  ): Promise<InventoryAccountMapping> {
    this.assertPermission('accounting.config', user.role)
    const updated = await accountingRepository.updateCategoryMapping(mapping)

    await auditService.log({
      action: 'INVENTORY_ACCOUNT_MAPPING_UPDATED' as any,
      module: 'ACCOUNTING' as any,
      entityType: 'INVENTORY_ACCOUNT_MAPPING',
      entityId: mapping.categoryId,
      entityReference: mapping.categoryName,
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      level: 'INFO',
      result: 'SUCCESS',
      details: `Actualización de mapeo de cuentas para la categoría ${mapping.categoryName}: Inventario ${mapping.inventoryAccountCode}, Costo ${mapping.costAccountCode}, Ingreso ${mapping.revenueAccountCode}`,
    })

    return updated
  }

  // --- VALIDACIÓN Y GESTIÓN DE PERIODOS CONTABLES ---

  /**
   * Verifica que el periodo contable correspondiente a la fecha esté ABIERTO.
   * Si el mes está CERRADO, bloquea la mutación para preservar la integridad fiduciaria.
   */
  async assertPeriodOpen(dateOrPeriod: string): Promise<void> {
    const isOpen = await accountingRepository.isPeriodOpen(dateOrPeriod)
    if (!isOpen) {
      const periodCode = dateOrPeriod.includes('T') || dateOrPeriod.length === 10
        ? dateOrPeriod.slice(0, 7)
        : dateOrPeriod
      throw new Error(
        `El periodo contable ${periodCode} se encuentra CERRADO. Operación bloqueada: no es posible crear, modificar ni anular comprobantes en meses clausurados. Se requiere reapertura autorizada por el Contador General.`
      )
    }
  }

  async getPeriods(year?: number, userRole: string = 'SUPERADMIN'): Promise<AccountingPeriod[]> {
    this.assertPermission('accounting.read', userRole)
    return accountingRepository.getPeriods(year)
  }

  async closePeriod(
    periodCode: string,
    user: { id: string; name: string; role: string }
  ): Promise<AccountingPeriod> {
    this.assertPermission('accounting.periods', user.role)
    const closed = await accountingRepository.closePeriod(periodCode, user)

    await auditService.log({
      action: 'ACCOUNTING_PERIOD_CLOSED' as any,
      module: 'ACCOUNTING' as any,
      entityType: 'ACCOUNTING_PERIOD',
      entityId: closed.id,
      entityReference: closed.periodCode,
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      level: 'WARNING',
      result: 'SUCCESS',
      details: `Cierre contable mensual definitivo ${closed.periodCode} (${closed.monthName} ${closed.year}). Comprobantes clausurados: ${closed.entriesCount}. Total débitos: $${(closed.totalDebits || 0).toLocaleString()} COP`,
      changes: [
        { field: 'status', label: 'Estado Periodo', previousValue: 'OPEN', newValue: 'CLOSED' },
        { field: 'closedAt', label: 'Fecha Cierre', previousValue: '—', newValue: closed.closedAt || '' },
      ],
    })

    return closed
  }

  async reopenPeriod(
    periodCode: string,
    reason: string,
    user: { id: string; name: string; role: string }
  ): Promise<AccountingPeriod> {
    this.assertPermission('accounting.periods', user.role)
    const reopened = await accountingRepository.reopenPeriod(periodCode, reason, user)

    await auditService.log({
      action: 'ACCOUNTING_PERIOD_REOPENED' as any,
      module: 'ACCOUNTING' as any,
      entityType: 'ACCOUNTING_PERIOD',
      entityId: reopened.id,
      entityReference: reopened.periodCode,
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      level: 'CRITICAL',
      result: 'SUCCESS',
      details: `Reapertura formal autorizada para periodo contable cerrado ${reopened.periodCode}. Justificación del contador: ${reason}`,
      changes: [
        { field: 'status', label: 'Estado Periodo', previousValue: 'CLOSED', newValue: 'OPEN' },
        { field: 'reopenedReason', label: 'Motivo Reapertura', previousValue: '—', newValue: reason },
      ],
    })

    return reopened
  }
}

export const accountingService = new AccountingService()
