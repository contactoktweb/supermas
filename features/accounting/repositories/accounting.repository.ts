/**
 * SUPER MÁS ERP/POS - Repositorio de Contabilidad
 *
 * Conecta directamente con la capa de datos de Supabase (db.ts / mock-db)
 * integrando accounting_accounts, accounting_entries, accounting_movements,
 * sales, purchases, invoices, inventory_movements, products y locations.
 */

import { db } from '@/lib/supabase/db'
import {
  AccountingAccount,
  AccountingEntry,
  AccountingMovement,
  AccountingFilters,
  InventoryAccountMapping,
  AccountingPeriod,
} from '../types'
import { AccountFormData, ManualEntryFormData } from '../schemas/accounting.schema'

class AccountingRepository {
  /**
   * Consulta el catálogo de cuentas PUC con filtros y paginación
   */
  async getAccounts(filters?: AccountingFilters): Promise<{ data: AccountingAccount[]; total: number }> {
    let list = (db.accountingAccounts as unknown as AccountingAccount[]) || []

    if (filters?.query) {
      const q = filters.query.toLowerCase().trim()
      list = list.filter(
        (acc) =>
          acc.code.toLowerCase().includes(q) ||
          acc.name.toLowerCase().includes(q) ||
          acc.description?.toLowerCase().includes(q)
      )
    }

    if (filters?.accountClass && filters.accountClass !== ('ALL' as any)) {
      list = list.filter((acc) => acc.accountClass === Number(filters.accountClass))
    }

    if (filters?.nature && filters.nature !== ('ALL' as any)) {
      list = list.filter((acc) => acc.nature === filters.nature)
    }

    if (filters?.status && filters.status !== ('ALL' as any)) {
      list = list.filter((acc) => acc.status === filters.status)
    }

    // Ordenar naturalmente por código numérico contable
    list.sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }))

    const total = list.length
    const page = filters?.page || 1
    const pageSize = filters?.pageSize || 50
    const start = (page - 1) * pageSize
    const paginated = list.slice(start, start + pageSize)

    return { data: JSON.parse(JSON.stringify(paginated)), total }
  }

  async getAllAccounts(): Promise<AccountingAccount[]> {
    const list = (db.accountingAccounts as unknown as AccountingAccount[]) || []
    return JSON.parse(JSON.stringify(list))
  }

  async getAccountById(id: string): Promise<AccountingAccount | null> {
    const list = (db.accountingAccounts as unknown as AccountingAccount[]) || []
    const acc = list.find((a) => a.id === id)
    return acc ? JSON.parse(JSON.stringify(acc)) : null
  }

  async getAccountByCode(code: string): Promise<AccountingAccount | null> {
    const list = (db.accountingAccounts as unknown as AccountingAccount[]) || []
    const acc = list.find((a) => a.code === code)
    return acc ? JSON.parse(JSON.stringify(acc)) : null
  }

  async createAccount(data: AccountFormData): Promise<AccountingAccount> {
    const list = (db.accountingAccounts as unknown as AccountingAccount[]) || []

    // Verificar unicidad de código
    const existing = list.find((a) => a.code === data.code)
    if (existing) {
      throw new Error(`Ya existe una cuenta con el código ${data.code} (${existing.name}).`)
    }

    const newAccount: AccountingAccount = {
      id: `acc-${data.code}`,
      code: data.code,
      name: data.name,
      accountClass: data.accountClass,
      type: data.type,
      nature: data.nature,
      level: data.level,
      parentId: data.parentId || null,
      balance: 0,
      status: 'ACTIVE',
      requiresThirdParty: data.requiresThirdParty,
      requiresCostCenter: data.requiresCostCenter,
      isSystemAccount: false,
      description: data.description || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    list.push(newAccount)
    return JSON.parse(JSON.stringify(newAccount))
  }

  async updateAccount(id: string, data: Partial<AccountFormData>): Promise<AccountingAccount> {
    const list = (db.accountingAccounts as unknown as AccountingAccount[]) || []
    const index = list.findIndex((a) => a.id === id)
    if (index === -1) {
      throw new Error(`No se encontró la cuenta con ID ${id}.`)
    }

    const current = list[index]
    const updated: AccountingAccount = {
      ...current,
      ...data,
      updatedAt: new Date().toISOString(),
    }

    list[index] = updated
    return JSON.parse(JSON.stringify(updated))
  }

  /**
   * Consulta el libro de asientos contables (comprobantes de diario)
   */
  async getEntries(filters?: AccountingFilters): Promise<{ data: AccountingEntry[]; total: number }> {
    let list = (db.accountingEntries as unknown as AccountingEntry[]) || []

    if (filters?.query) {
      const q = filters.query.toLowerCase().trim()
      list = list.filter(
        (e) =>
          e.entryNumber.toLowerCase().includes(q) ||
          e.description.toLowerCase().includes(q) ||
          e.documentNumber?.toLowerCase().includes(q) ||
          e.thirdPartyName?.toLowerCase().includes(q) ||
          e.thirdPartyDoc?.toLowerCase().includes(q)
      )
    }

    if (filters?.entryStatus && filters.entryStatus !== ('ALL' as any)) {
      list = list.filter((e) => e.status === filters.entryStatus)
    }

    if (filters?.sourceType && filters.sourceType !== ('ALL' as any)) {
      list = list.filter((e) => e.sourceType === filters.sourceType)
    }

    if (filters?.locationId && filters.locationId !== ('ALL' as any)) {
      list = list.filter((e) => e.locationId === filters.locationId)
    }

    if (filters?.dateFrom) {
      list = list.filter((e) => e.date >= filters.dateFrom!)
    }
    if (filters?.dateTo) {
      list = list.filter((e) => e.date <= `${filters.dateTo!}T23:59:59Z`)
    }

    // Ordenar cronológicamente descendente (más recientes primero)
    list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

    const total = list.length
    const page = filters?.page || 1
    const pageSize = filters?.pageSize || 25
    const start = (page - 1) * pageSize
    const paginated = list.slice(start, start + pageSize)

    return { data: JSON.parse(JSON.stringify(paginated)), total }
  }

  async getAllEntries(): Promise<AccountingEntry[]> {
    const list = (db.accountingEntries as unknown as AccountingEntry[]) || []
    return JSON.parse(JSON.stringify(list))
  }

  async getEntryById(id: string): Promise<AccountingEntry | null> {
    const list = (db.accountingEntries as unknown as AccountingEntry[]) || []
    const entry = list.find((e) => e.id === id)
    return entry ? JSON.parse(JSON.stringify(entry)) : null
  }

  /**
   * Crea un asiento contable manual validando estricta partida doble
   */
  async createManualEntry(
    data: ManualEntryFormData,
    user: { id: string; name: string }
  ): Promise<AccountingEntry> {
    const totalDebit = data.lines.reduce((acc, l) => acc + (Number(l.debit) || 0), 0)
    const totalCredit = data.lines.reduce((acc, l) => acc + (Number(l.credit) || 0), 0)

    if (Math.abs(totalDebit - totalCredit) >= 0.01) {
      throw new Error(
        `Partida doble descuadrada: Débitos ($${totalDebit.toLocaleString()}) != Créditos ($${totalCredit.toLocaleString()}).`
      )
    }

    const list = (db.accountingEntries as unknown as AccountingEntry[]) || []
    const nextSeq = list.length + 1
    const entryNumber = `AST-${new Date().getFullYear()}-${String(nextSeq).padStart(6, '0')}`
    const entryId = `entry-manual-${Date.now()}`
    const period = data.date.substring(0, 7)

    const newEntry: AccountingEntry = {
      id: entryId,
      entryNumber,
      date: data.date.includes('T') ? data.date : `${data.date}T12:00:00Z`,
      period,
      sourceType: 'MANUAL',
      documentNumber: `MAN-${String(nextSeq).padStart(4, '0')}`,
      description: data.description,
      status: 'POSTED',
      locationId: data.locationId,
      locationName: data.locationId ? db.locations.find((l) => l.id === data.locationId)?.name : 'CEDI Principal',
      thirdPartyId: data.thirdPartyId,
      thirdPartyName: data.thirdPartyName,
      thirdPartyDoc: data.thirdPartyDoc,
      lines: data.lines.map((l, idx) => ({
        id: `line-${entryId}-${idx + 1}`,
        accountId: l.accountId,
        accountCode: l.accountCode,
        accountName: l.accountName,
        debit: Number(l.debit) || 0,
        credit: Number(l.credit) || 0,
        description: l.description,
        costCenterId: l.costCenterId,
        costCenterName: l.costCenterName,
      })),
      totalDebit,
      totalCredit,
      isBalanced: true,
      createdByUserId: user.id,
      createdByUserName: user.name,
      confirmedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    }

    list.unshift(newEntry)

    // Generar movimientos individuales en el libro auxiliar
    const movementsList = (db.accountingMovements as unknown as AccountingMovement[]) || []
    for (const line of newEntry.lines) {
      movementsList.push({
        id: `mov-${line.id}`,
        entryId: newEntry.id,
        entryNumber: newEntry.entryNumber,
        date: newEntry.date,
        period: newEntry.period,
        accountId: line.accountId,
        accountCode: line.accountCode,
        accountName: line.accountName,
        nature: line.debit > 0 ? 'DEBIT' : 'CREDIT',
        sourceType: 'MANUAL',
        sourceId: newEntry.id,
        sourceDocumentNumber: newEntry.documentNumber,
        locationId: newEntry.locationId,
        locationName: newEntry.locationName,
        thirdPartyId: newEntry.thirdPartyId,
        thirdPartyName: newEntry.thirdPartyName,
        thirdPartyDoc: newEntry.thirdPartyDoc,
        debit: line.debit,
        credit: line.credit,
        balanceAfter: 0,
        description: line.description,
        createdAt: new Date().toISOString(),
      })
    }

    return JSON.parse(JSON.stringify(newEntry))
  }

  /**
   * Reversión de asiento contable (principio de inmutabilidad: no se elimina, se reversa)
   */
  async reverseEntry(
    entryId: string,
    reason: string,
    user: { id: string; name: string }
  ): Promise<{ original: AccountingEntry; reversal: AccountingEntry }> {
    const list = (db.accountingEntries as unknown as AccountingEntry[]) || []
    const index = list.findIndex((e) => e.id === entryId)
    if (index === -1) {
      throw new Error(`Asiento con ID ${entryId} no encontrado.`)
    }

    const original = list[index]
    if (original.status === 'REVERSED') {
      throw new Error(`El asiento ${original.entryNumber} ya ha sido reversado previamente.`)
    }

    const nextSeq = list.length + 1
    const reversalEntryNumber = `AST-${new Date().getFullYear()}-${String(nextSeq).padStart(6, '0')}`
    const reversalId = `entry-rev-${Date.now()}`

    // Generar líneas invertidas (lo que era débito pasa a crédito y viceversa)
    const reversedLines = original.lines.map((l, idx) => ({
      id: `line-${reversalId}-${idx + 1}`,
      accountId: l.accountId,
      accountCode: l.accountCode,
      accountName: l.accountName,
      debit: l.credit,
      credit: l.debit,
      description: `Reversión: ${l.description}`,
      taxConfigId: l.taxConfigId,
      taxRatePercent: l.taxRatePercent,
      baseAmount: l.baseAmount,
    }))

    const reversalEntry: AccountingEntry = {
      id: reversalId,
      entryNumber: reversalEntryNumber,
      date: new Date().toISOString(),
      period: new Date().toISOString().substring(0, 7),
      sourceType: 'REVERSAL',
      sourceId: original.id,
      documentNumber: `REV-${original.entryNumber}`,
      description: `Reversión contable de ${original.entryNumber}. Motivo: ${reason}`,
      status: 'POSTED',
      locationId: original.locationId,
      locationName: original.locationName,
      thirdPartyId: original.thirdPartyId,
      thirdPartyName: original.thirdPartyName,
      thirdPartyDoc: original.thirdPartyDoc,
      lines: reversedLines,
      totalDebit: original.totalCredit,
      totalCredit: original.totalDebit,
      isBalanced: true,
      reversalOfEntryId: original.id,
      reversalReason: reason,
      createdByUserId: user.id,
      createdByUserName: user.name,
      confirmedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    }

    // Actualizar estado del original
    original.status = 'REVERSED'
    original.reversedByEntryId = reversalId
    original.reversalReason = reason

    list.unshift(reversalEntry)

    // Registrar movimientos de reversión en el auxiliar
    const movementsList = (db.accountingMovements as unknown as AccountingMovement[]) || []
    for (const line of reversalEntry.lines) {
      movementsList.push({
        id: `mov-${line.id}`,
        entryId: reversalEntry.id,
        entryNumber: reversalEntry.entryNumber,
        date: reversalEntry.date,
        period: reversalEntry.period,
        accountId: line.accountId,
        accountCode: line.accountCode,
        accountName: line.accountName,
        nature: line.debit > 0 ? 'DEBIT' : 'CREDIT',
        sourceType: 'REVERSAL',
        sourceId: reversalEntry.id,
        sourceDocumentNumber: reversalEntry.documentNumber,
        locationId: reversalEntry.locationId,
        locationName: reversalEntry.locationName,
        thirdPartyId: reversalEntry.thirdPartyId,
        thirdPartyName: reversalEntry.thirdPartyName,
        thirdPartyDoc: reversalEntry.thirdPartyDoc,
        debit: line.debit,
        credit: line.credit,
        balanceAfter: 0,
        description: line.description,
        createdAt: new Date().toISOString(),
      })
    }

    return {
      original: JSON.parse(JSON.stringify(original)),
      reversal: JSON.parse(JSON.stringify(reversalEntry)),
    }
  }

  /**
   * Consulta movimientos individuales del libro auxiliar
   */
  async getMovements(filters?: AccountingFilters): Promise<{ data: AccountingMovement[]; total: number }> {
    let list = (db.accountingMovements as unknown as AccountingMovement[]) || []

    if (filters?.query) {
      const q = filters.query.toLowerCase().trim()
      list = list.filter(
        (m) =>
          m.accountCode.includes(q) ||
          m.accountName.toLowerCase().includes(q) ||
          m.entryNumber.toLowerCase().includes(q) ||
          m.description.toLowerCase().includes(q) ||
          m.thirdPartyName?.toLowerCase().includes(q)
      )
    }

    if (filters?.accountId && filters.accountId !== ('ALL' as any)) {
      list = list.filter((m) => m.accountId === filters.accountId || m.accountCode === filters.accountId)
    }

    if (filters?.sourceType && filters.sourceType !== ('ALL' as any)) {
      list = list.filter((m) => m.sourceType === filters.sourceType)
    }

    if (filters?.locationId && filters.locationId !== ('ALL' as any)) {
      list = list.filter((m) => m.locationId === filters.locationId)
    }

    if (filters?.thirdPartyId && filters.thirdPartyId !== ('ALL' as any)) {
      list = list.filter(
        (m) =>
          m.thirdPartyId === filters.thirdPartyId ||
          m.thirdPartyDoc === filters.thirdPartyId ||
          m.thirdPartyName === filters.thirdPartyId
      )
    }

    if (filters?.costCenterId && filters.costCenterId !== ('ALL' as any)) {
      list = list.filter((m) => m.locationId === filters.costCenterId)
    }

    if (filters?.dateFrom) {
      list = list.filter((m) => m.date >= filters.dateFrom!)
    }
    if (filters?.dateTo) {
      list = list.filter((m) => m.date <= `${filters.dateTo!}T23:59:59Z`)
    }

    list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

    const total = list.length
    const page = filters?.page || 1
    const pageSize = filters?.pageSize || 50
    const start = (page - 1) * pageSize
    const paginated = list.slice(start, start + pageSize)

    return { data: JSON.parse(JSON.stringify(paginated)), total }
  }

  async getAllMovements(): Promise<AccountingMovement[]> {
    const list = (db.accountingMovements as unknown as AccountingMovement[]) || []
    return JSON.parse(JSON.stringify(list))
  }

  /**
   * Mapeo de cuentas contables por categoría de inventario (Estructura Multiclase: MP, PP, PT, Mercancías)
   */
  private categoryMappings: InventoryAccountMapping[] = [
    {
      categoryId: 'cat-inv-mp',
      categoryName: 'Materias Primas e Insumos',
      inventoryType: 'RAW_MATERIAL',
      inventoryTypeName: 'Materia Prima (Clase 1405)',
      inventoryAccountId: 'acc-140501',
      inventoryAccountCode: '140501',
      inventoryAccountName: 'Materias Primas - Harinas e Insumos de Panificación',
      costAccountId: 'acc-710501',
      costAccountCode: '710501',
      costAccountName: 'Consumo de Materia Prima - Harinas e Insumos',
      revenueAccountId: 'acc-413501',
      revenueAccountCode: '413501',
      revenueAccountName: 'Venta de Abarrotes y Víveres',
      description: 'Harinas, granos e ingredientes para elaboración y fraccionamiento.',
    },
    {
      categoryId: 'cat-inv-pp',
      categoryName: 'Productos en Proceso',
      inventoryType: 'WORK_IN_PROCESS',
      inventoryTypeName: 'Producto en Proceso (Clase 1410)',
      inventoryAccountId: 'acc-141001',
      inventoryAccountCode: '141001',
      inventoryAccountName: 'Productos en Proceso - Panadería y Mezclas',
      costAccountId: 'acc-612001',
      costAccountCode: '612001',
      costAccountName: 'Costo de Venta - Panadería y Elaborados Propios',
      revenueAccountId: 'acc-413501',
      revenueAccountCode: '413501',
      revenueAccountName: 'Venta de Abarrotes y Víveres',
      description: 'Masas preparadas y lotes en proceso de transformación industrial.',
    },
    {
      categoryId: 'cat-inv-pt',
      categoryName: 'Productos Terminados Panadería',
      inventoryType: 'FINISHED_GOOD',
      inventoryTypeName: 'Producto Terminado (Clase 1430)',
      inventoryAccountId: 'acc-143001',
      inventoryAccountCode: '143001',
      inventoryAccountName: 'Productos Terminados - Panadería y Alimentos Elaborados',
      costAccountId: 'acc-612001',
      costAccountCode: '612001',
      costAccountName: 'Costo de Venta - Panadería y Elaborados Propios',
      revenueAccountId: 'acc-413501',
      revenueAccountCode: '413501',
      revenueAccountName: 'Venta de Abarrotes y Víveres',
      description: 'Pan tajado, pastelería y alimentos manufacturados de marca propia.',
    },
    {
      categoryId: 'cat-001',
      categoryName: 'Granos y Cereales',
      inventoryType: 'MERCHANDISE',
      inventoryTypeName: 'Mercancía para la Venta (Clase 1435)',
      inventoryAccountId: 'acc-143501',
      inventoryAccountCode: '143501',
      inventoryAccountName: 'Mercancías - Abarrotes y Granos',
      costAccountId: 'acc-613501',
      costAccountCode: '613501',
      costAccountName: 'Costo de Venta - Abarrotes y Granos',
      revenueAccountId: 'acc-413501',
      revenueAccountCode: '413501',
      revenueAccountName: 'Venta de Abarrotes y Víveres',
      description: 'Arroz, frijol, lentejas y víveres comercializados al por mayor.',
    },
    {
      categoryId: 'cat-002',
      categoryName: 'Aceites y Grasas',
      inventoryType: 'MERCHANDISE',
      inventoryTypeName: 'Mercancía para la Venta (Clase 1435)',
      inventoryAccountId: 'acc-143501',
      inventoryAccountCode: '143501',
      inventoryAccountName: 'Mercancías - Abarrotes y Granos',
      costAccountId: 'acc-613501',
      costAccountCode: '613501',
      costAccountName: 'Costo de Venta - Abarrotes y Granos',
      revenueAccountId: 'acc-413501',
      revenueAccountCode: '413501',
      revenueAccountName: 'Venta de Abarrotes y Víveres',
      description: 'Aceites vegetales, mantecas y margarinas para reventa.',
    },
    {
      categoryId: 'cat-003',
      categoryName: 'Lácteos y Refrigerados',
      inventoryType: 'MERCHANDISE',
      inventoryTypeName: 'Mercancía para la Venta (Clase 1435)',
      inventoryAccountId: 'acc-143502',
      inventoryAccountCode: '143502',
      inventoryAccountName: 'Mercancías - Lácteos y Refrigerados',
      costAccountId: 'acc-613502',
      costAccountCode: '613502',
      costAccountName: 'Costo de Venta - Lácteos y Refrigerados',
      revenueAccountId: 'acc-413502',
      revenueAccountCode: '413502',
      revenueAccountName: 'Venta de Lácteos y Refrigerados',
      description: 'Línea fría comercializada.',
    },
    {
      categoryId: 'cat-004',
      categoryName: 'Aseo y Limpieza',
      inventoryType: 'MERCHANDISE',
      inventoryTypeName: 'Mercancía para la Venta (Clase 1435)',
      inventoryAccountId: 'acc-143503',
      inventoryAccountCode: '143503',
      inventoryAccountName: 'Mercancías - Aseo y Cuidado del Hogar',
      costAccountId: 'acc-613503',
      costAccountCode: '613503',
      costAccountName: 'Costo de Venta - Aseo y Hogar',
      revenueAccountId: 'acc-413503',
      revenueAccountCode: '413503',
      revenueAccountName: 'Venta de Aseo y Cuidado del Hogar',
      description: 'Productos de aseo y cuidado de superficies.',
    },
    {
      categoryId: 'cat-005',
      categoryName: 'Bebidas y Licores',
      inventoryType: 'MERCHANDISE',
      inventoryTypeName: 'Mercancía para la Venta (Clase 1435)',
      inventoryAccountId: 'acc-143504',
      inventoryAccountCode: '143504',
      inventoryAccountName: 'Mercancías - Bebidas y Confitería',
      costAccountId: 'acc-613504',
      costAccountCode: '613504',
      costAccountName: 'Costo de Venta - Bebidas y Confitería',
      revenueAccountId: 'acc-413504',
      revenueAccountCode: '413504',
      revenueAccountName: 'Venta de Bebidas y Confitería',
      description: 'Bebidas, refrescos y confitería comercial.',
    },
  ]

  async getCategoryMappings(): Promise<InventoryAccountMapping[]> {
    return JSON.parse(JSON.stringify(this.categoryMappings))
  }

  async updateCategoryMapping(mapping: InventoryAccountMapping): Promise<InventoryAccountMapping> {
    const idx = this.categoryMappings.findIndex((m) => m.categoryId === mapping.categoryId)
    if (idx !== -1) {
      this.categoryMappings[idx] = mapping
    } else {
      this.categoryMappings.push(mapping)
    }
    return JSON.parse(JSON.stringify(mapping))
  }

  // --- PERIODOS Y CIERRES CONTABLES ---

  async getPeriods(year?: number): Promise<AccountingPeriod[]> {
    let list = (db.accountingPeriods as unknown as AccountingPeriod[]) || []
    if (year) {
      list = list.filter((p) => p.year === year)
    }
    return JSON.parse(JSON.stringify(list))
  }

  async getPeriodByCode(periodCode: string): Promise<AccountingPeriod | null> {
    const list = (db.accountingPeriods as unknown as AccountingPeriod[]) || []
    const found = list.find((p) => p.periodCode === periodCode)
    return found ? JSON.parse(JSON.stringify(found)) : null
  }

  async isPeriodOpen(dateOrPeriod: string): Promise<boolean> {
    const periodCode = dateOrPeriod.includes('T') || dateOrPeriod.length === 10
      ? dateOrPeriod.slice(0, 7)
      : dateOrPeriod
    const period = await this.getPeriodByCode(periodCode)
    // Si el periodo no existe en el catálogo, se asume abierto por defecto
    if (!period) return true
    return period.status === 'OPEN'
  }

  async closePeriod(periodCode: string, user: { id: string; name: string }): Promise<AccountingPeriod> {
    const list = (db.accountingPeriods as unknown as AccountingPeriod[]) || []
    const period = list.find((p) => p.periodCode === periodCode)
    if (!period) {
      throw new Error(`Periodo contable "${periodCode}" no encontrado.`)
    }
    if (period.status === 'CLOSED') {
      throw new Error(`El periodo contable "${periodCode}" ya se encuentra CERRADO.`)
    }

    period.status = 'CLOSED'
    period.closedAt = new Date().toISOString()
    period.closedByUserId = user.id
    period.closedByUserName = user.name
    period.updatedAt = new Date().toISOString()

    return JSON.parse(JSON.stringify(period))
  }

  async reopenPeriod(
    periodCode: string,
    reason: string,
    user: { id: string; name: string }
  ): Promise<AccountingPeriod> {
    const list = (db.accountingPeriods as unknown as AccountingPeriod[]) || []
    const period = list.find((p) => p.periodCode === periodCode)
    if (!period) {
      throw new Error(`Periodo contable "${periodCode}" no encontrado.`)
    }
    if (period.status === 'OPEN') {
      throw new Error(`El periodo contable "${periodCode}" ya se encuentra ABIERTO.`)
    }
    if (!reason || reason.trim().length < 10) {
      throw new Error('Se requiere un motivo formal detallado (mínimo 10 caracteres) para autorizar la reapertura del periodo.')
    }

    period.status = 'OPEN'
    period.reopenedAt = new Date().toISOString()
    period.reopenedByUserId = user.id
    period.reopenedReason = reason
    period.updatedAt = new Date().toISOString()

    return JSON.parse(JSON.stringify(period))
  }
}

export const accountingRepository = new AccountingRepository()
