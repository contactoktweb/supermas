/**
 * SUPER MÁS ERP/POS - Repositorio Oficial de Contabilidad (accountingRepository)
 *
 * Conecta 100% directamente a PostgreSQL/Supabase:
 * - public.accounting_accounts (PUC)
 * - public.accounting_entries
 * - public.accounting_entry_lines
 * - public.accounting_periods
 * - RPCs atómicas: fn_create_accounting_entry, fn_reverse_accounting_entry,
 *   fn_cause_sale_accounting, fn_cause_purchase_accounting,
 *   fn_cause_payment_accounting, fn_cause_receipt_accounting,
 *   fn_close_accounting_period, fn_reopen_accounting_period.
 */

import { supabaseClient } from '@/lib/supabase/client'
import {
  AccountingAccount,
  AccountingEntry,
  AccountingMovement,
  AccountingFilters,
  InventoryAccountMapping,
  AccountingPeriod,
} from '../types'
import { AccountFormData, ManualEntryFormData } from '../schemas/accounting.schema'

export class AccountingRepository {
  /**
   * Mapea una fila de accounting_accounts a la interfaz AccountingAccount
   */
  private mapAccount(row: any, balance: number = 0): AccountingAccount {
    return {
      id: row.id,
      code: row.code,
      name: row.name,
      accountClass: row.account_class,
      type: row.nature === 'DEBIT' ? 'ASSET' : 'LIABILITY', // fallback tipológico
      nature: row.nature,
      level: row.level === 1 ? 'CLASS' : row.level === 2 ? 'GROUP' : row.level === 3 ? 'ACCOUNT' : 'SUBACCOUNT',
      parentId: row.parent_id || null,
      balance: balance,
      status: row.is_active ? 'ACTIVE' : 'INACTIVE',
      requiresThirdParty: !!row.requires_third_party,
      requiresCostCenter: !!row.requires_cost_center,
      isSystemAccount: false,
      description: row.description || '',
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }
  }

  /**
   * Obtiene la suma de saldos de todas las cuentas a partir de líneas en comprobantes POSTED
   */
  private async getAccountBalances(): Promise<Map<string, number>> {
    const { data, error } = await supabaseClient
      .from('accounting_entry_lines')
      .select(`
        account_id,
        debit_amount,
        credit_amount,
        accounting_entries!inner(status)
      `)
      .eq('accounting_entries.status', 'POSTED')

    const map = new Map<string, { debits: number; credits: number }>()
    if (!error && data) {
      for (const row of data as any[]) {
        const accId = row.account_id
        const d = Number(row.debit_amount) || 0
        const c = Number(row.credit_amount) || 0
        const cur = map.get(accId) || { debits: 0, credits: 0 }
        cur.debits += d
        cur.credits += c
        map.set(accId, cur)
      }
    }

    const resultMap = new Map<string, number>()
    // También obtenemos la naturaleza de las cuentas para calcular el saldo neto
    const { data: accounts } = await supabaseClient.from('accounting_accounts').select('id, nature')
    if (accounts) {
      for (const acc of accounts as any[]) {
        const stats = map.get(acc.id) || { debits: 0, credits: 0 }
        const isDebit = acc.nature === 'DEBIT'
        const bal = isDebit ? stats.debits - stats.credits : stats.credits - stats.debits
        resultMap.set(acc.id, bal)
      }
    }

    return resultMap
  }

  /**
   * Consulta el catálogo de cuentas PUC con filtros y paginación
   */
  async getAccounts(filters?: AccountingFilters): Promise<{ data: AccountingAccount[]; total: number }> {
    let query = supabaseClient.from('accounting_accounts').select('*', { count: 'exact' })

    if (filters?.query) {
      const q = filters.query.trim()
      query = query.or(`code.ilike.%${q}%,name.ilike.%${q}%`)
    }

    if (filters?.accountClass && filters.accountClass !== ('ALL' as any)) {
      query = query.eq('account_class', Number(filters.accountClass))
    }

    if (filters?.nature && filters.nature !== ('ALL' as any)) {
      query = query.eq('nature', filters.nature)
    }

    if (filters?.status && filters.status !== ('ALL' as any)) {
      query = query.eq('is_active', filters.status === 'ACTIVE')
    }

    query = query.order('code', { ascending: true })

    const page = filters?.page || 1
    const pageSize = filters?.pageSize || 50
    const start = (page - 1) * pageSize
    query = query.range(start, start + pageSize - 1)

    const { data, count, error } = await query

    if (error || !data) {
      console.warn('Advertencia consultando cuentas contables:', error?.message)
      return { data: [], total: 0 }
    }

    const balances = await this.getAccountBalances()
    const mapped = data.map((row: any) => this.mapAccount(row, balances.get(row.id) || 0))

    return { data: mapped, total: count || mapped.length }
  }

  async getAllAccounts(): Promise<AccountingAccount[]> {
    const { data, error } = await supabaseClient
      .from('accounting_accounts')
      .select('*')
      .order('code', { ascending: true })

    if (error || !data) return []

    const balances = await this.getAccountBalances()
    return data.map((row: any) => this.mapAccount(row, balances.get(row.id) || 0))
  }

  async getAccountById(id: string): Promise<AccountingAccount | null> {
    const { data, error } = await supabaseClient
      .from('accounting_accounts')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !data) return null
    const balances = await this.getAccountBalances()
    return this.mapAccount(data, balances.get(data.id) || 0)
  }

  async getAccountByCode(code: string): Promise<AccountingAccount | null> {
    const { data, error } = await supabaseClient
      .from('accounting_accounts')
      .select('*')
      .eq('code', code)
      .single()

    if (error || !data) return null
    const balances = await this.getAccountBalances()
    return this.mapAccount(data, balances.get(data.id) || 0)
  }

  async createAccount(data: AccountFormData): Promise<AccountingAccount> {
    const levelNumber = data.level === 'CLASS' ? 1 : data.level === 'GROUP' ? 2 : data.level === 'ACCOUNT' ? 3 : 4

    const { data: newRow, error } = await supabaseClient
      .from('accounting_accounts')
      .insert({
        code: data.code,
        name: data.name,
        account_class: data.accountClass,
        level: levelNumber,
        parent_id: data.parentId || null,
        nature: data.nature,
        requires_third_party: !!data.requiresThirdParty,
        requires_cost_center: !!data.requiresCostCenter,
        is_active: true,
      })
      .select('*')
      .single()

    if (error || !newRow) {
      throw new Error(`Error creando cuenta contable: ${error?.message || 'Error desconocido'}`)
    }

    return this.mapAccount(newRow, 0)
  }

  async updateAccount(id: string, data: Partial<AccountFormData>): Promise<AccountingAccount> {
    const updatePayload: any = {}
    if (data.name !== undefined) updatePayload.name = data.name
    if (data.requiresThirdParty !== undefined) updatePayload.requires_third_party = data.requiresThirdParty
    if (data.requiresCostCenter !== undefined) updatePayload.requires_cost_center = data.requiresCostCenter

    const { data: updated, error } = await supabaseClient
      .from('accounting_accounts')
      .update(updatePayload)
      .eq('id', id)
      .select('*')
      .single()

    if (error || !updated) {
      throw new Error(`Error actualizando cuenta: ${error?.message || 'Error desconocido'}`)
    }

    const balances = await this.getAccountBalances()
    return this.mapAccount(updated, balances.get(id) || 0)
  }

  // --- ASIENTOS CONTABLES ---

  /**
   * Consulta los comprobantes contables con sus líneas de detalle
   */
  async getEntries(filters?: AccountingFilters): Promise<{ data: AccountingEntry[]; total: number }> {
    let query = supabaseClient.from('accounting_entries').select(`
      id,
      consecutive,
      entry_number,
      date,
      concept,
      document_type,
      document_reference,
      status,
      location_id,
      created_by_user_id,
      posted_at,
      created_at,
      updated_at,
      locations (
        name
      ),
      accounting_entry_lines (
        id,
        account_id,
        debit_amount,
        credit_amount,
        third_party_doc,
        third_party_name,
        cost_center_id,
        description,
        accounting_accounts (
          code,
          name
        )
      )
    `, { count: 'exact' })

    if (filters?.query) {
      const q = filters.query.trim()
      query = query.or(`entry_number.ilike.%${q}%,concept.ilike.%${q}%,document_reference.ilike.%${q}%`)
    }

    if (filters?.entryStatus && filters.entryStatus !== ('ALL' as any)) {
      query = query.eq('status', filters.entryStatus)
    }

    if (filters?.sourceType && filters.sourceType !== ('ALL' as any)) {
      query = query.eq('document_type', filters.sourceType)
    }

    if (filters?.locationId && filters.locationId !== ('ALL' as any)) {
      query = query.eq('location_id', filters.locationId)
    }

    if (filters?.dateFrom) {
      query = query.gte('date', filters.dateFrom)
    }
    if (filters?.dateTo) {
      query = query.lte('date', filters.dateTo)
    }

    query = query.order('date', { ascending: false }).order('created_at', { ascending: false })

    const page = filters?.page || 1
    const pageSize = filters?.pageSize || 25
    const start = (page - 1) * pageSize
    query = query.range(start, start + pageSize - 1)

    const { data, count, error } = await query

    if (error || !data) {
      console.warn('Advertencia consultando asientos contables:', error?.message)
      return { data: [], total: 0 }
    }

    const mapped: AccountingEntry[] = data.map((row: any) => {
      const rawLines = row.accounting_entry_lines || []
      const lines = rawLines.map((l: any) => ({
        id: l.id,
        accountId: l.account_id,
        accountCode: l.accounting_accounts?.code || '',
        accountName: l.accounting_accounts?.name || '',
        debit: Number(l.debit_amount) || 0,
        credit: Number(l.credit_amount) || 0,
        description: l.description || '',
        thirdPartyDoc: l.third_party_doc,
        thirdPartyName: l.third_party_name,
        costCenterId: l.cost_center_id,
      }))

      const totalDebit = lines.reduce((acc: number, l: any) => acc + l.debit, 0)
      const totalCredit = lines.reduce((acc: number, l: any) => acc + l.credit, 0)

      return {
        id: row.id,
        entryNumber: row.entry_number,
        date: row.date,
        period: (row.date || '').slice(0, 7),
        sourceType: (row.document_type as any) || 'MANUAL',
        documentNumber: row.document_reference,
        description: row.concept,
        status: (row.status as any) || 'DRAFT',
        locationId: row.location_id,
        locationName: row.locations?.name || null,
        thirdPartyId: lines[0]?.thirdPartyDoc || undefined,
        thirdPartyName: lines[0]?.thirdPartyName || undefined,
        thirdPartyDoc: lines[0]?.thirdPartyDoc || undefined,
        lines,
        totalDebit,
        totalCredit,
        isBalanced: Math.abs(totalDebit - totalCredit) < 0.01,
        createdByUserId: row.created_by_user_id,
        confirmedAt: row.posted_at,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }
    })

    return { data: mapped, total: count || mapped.length }
  }

  async getAllEntries(): Promise<AccountingEntry[]> {
    const res = await this.getEntries({ page: 1, pageSize: 1000 })
    return res.data
  }

  async getEntryById(id: string): Promise<AccountingEntry | null> {
    const { data, error } = await supabaseClient
      .from('accounting_entries')
      .select(`
        id,
        consecutive,
        entry_number,
        date,
        concept,
        document_type,
        document_reference,
        status,
        location_id,
        created_by_user_id,
        posted_at,
        created_at,
        updated_at,
        locations (name),
        accounting_entry_lines (
          id,
          account_id,
          debit_amount,
          credit_amount,
          third_party_doc,
          third_party_name,
          cost_center_id,
          description,
          accounting_accounts (code, name)
        )
      `)
      .eq('id', id)
      .single()

    if (error || !data) return null

    const rawLines = data.accounting_entry_lines || []
    const lines = rawLines.map((l: any) => ({
      id: l.id,
      accountId: l.account_id,
      accountCode: l.accounting_accounts?.code || '',
      accountName: l.accounting_accounts?.name || '',
      debit: Number(l.debit_amount) || 0,
      credit: Number(l.credit_amount) || 0,
      description: l.description || '',
      thirdPartyDoc: l.third_party_doc,
      thirdPartyName: l.third_party_name,
      costCenterId: l.cost_center_id,
    }))

    const totalDebit = lines.reduce((acc: number, l: any) => acc + l.debit, 0)
    const totalCredit = lines.reduce((acc: number, l: any) => acc + l.credit, 0)

    return {
      id: data.id,
      entryNumber: data.entry_number,
      date: data.date,
      period: (data.date || '').slice(0, 7),
      sourceType: (data.document_type as any) || 'MANUAL',
      documentNumber: data.document_reference,
      description: data.concept,
      status: (data.status as any) || 'DRAFT',
      locationId: data.location_id,
      locationName: (data.locations as any)?.name || null,
      thirdPartyDoc: lines[0]?.thirdPartyDoc,
      thirdPartyName: lines[0]?.thirdPartyName,
      lines,
      totalDebit,
      totalCredit,
      isBalanced: Math.abs(totalDebit - totalCredit) < 0.01,
      createdByUserId: data.created_by_user_id,
      confirmedAt: data.posted_at,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    }
  }

  /**
   * Crea un asiento contable manual mediante RPC atómica validando partida doble
   */
  async createManualEntry(
    data: ManualEntryFormData,
    user: { id: string; name: string }
  ): Promise<AccountingEntry> {
    const linesPayload = data.lines.map((l) => ({
      account_id: l.accountId.startsWith('acc-') ? undefined : l.accountId,
      account_code: l.accountCode,
      debit_amount: Number(l.debit) || 0,
      credit_amount: Number(l.credit) || 0,
      third_party_doc: data.thirdPartyDoc || null,
      third_party_name: data.thirdPartyName || null,
      cost_center_id: l.costCenterId || null,
      description: l.description || data.description,
    }))

    const dateOnly = data.date.includes('T') ? data.date.slice(0, 10) : data.date

    const { data: res, error } = await supabaseClient.rpc('fn_create_accounting_entry', {
      p_date: dateOnly,
      p_concept: data.description,
      p_document_type: 'MANUAL',
      p_document_reference: `MAN-${Date.now().toString().slice(-6)}`,
      p_lines: linesPayload,
      p_location_id: data.locationId || null,
      p_auto_post: true,
    })

    if (error || !res?.success) {
      console.error('Error creando asiento contable en RPC:', error)
      throw new Error(`Error al crear asiento: ${error?.message || res?.error || 'Partida doble descuadrada o error de validación'}`)
    }

    const created = await this.getEntryById(res.entry_id)
    if (!created) {
      throw new Error('Comprobante creado pero no se pudo recuperar.')
    }

    return created
  }

  /**
   * Reversión de asiento contable mediante RPC atómica
   */
  async reverseEntry(
    entryId: string,
    reason: string,
    user: { id: string; name: string }
  ): Promise<{ original: AccountingEntry; reversal: AccountingEntry }> {
    const { data: res, error } = await supabaseClient.rpc('fn_reverse_accounting_entry', {
      p_entry_id: entryId,
      p_reason: reason,
    })

    if (error || !res?.success) {
      console.error('Error reversando asiento contable en RPC:', error)
      throw new Error(`Error reversando asiento: ${error?.message || res?.error}`)
    }

    const [original, reversal] = await Promise.all([
      this.getEntryById(res.original_entry_id),
      this.getEntryById(res.reversal_entry_id),
    ])

    if (!original || !reversal) {
      throw new Error('Comprobantes de reversión creados pero no se pudieron recuperar.')
    }

    return { original, reversal }
  }

  /**
   * Causación automática de Ventas
   */
  async causeSale(saleId: string): Promise<any> {
    const { data, error } = await supabaseClient.rpc('fn_cause_sale_accounting', {
      p_sale_id: saleId,
    })
    if (error || !data?.success) {
      throw new Error(`Error en causación de venta: ${error?.message || data?.error}`)
    }
    return data
  }

  /**
   * Causación automática de Compras
   */
  async causePurchase(purchaseId: string): Promise<any> {
    const { data, error } = await supabaseClient.rpc('fn_cause_purchase_accounting', {
      p_purchase_id: purchaseId,
    })
    if (error || !data?.success) {
      throw new Error(`Error en causación de compra: ${error?.message || data?.error}`)
    }
    return data
  }

  /**
   * Causación automática de Desembolso / Pago
   */
  async causePayment(paymentId: string): Promise<any> {
    const { data, error } = await supabaseClient.rpc('fn_cause_payment_accounting', {
      p_payment_id: paymentId,
    })
    if (error || !data?.success) {
      throw new Error(`Error en causación de pago: ${error?.message || data?.error}`)
    }
    return data
  }

  /**
   * Causación automática de Recaudo
   */
  async causeReceipt(receiptId: string): Promise<any> {
    const { data, error } = await supabaseClient.rpc('fn_cause_receipt_accounting', {
      p_receipt_id: receiptId,
    })
    if (error || !data?.success) {
      throw new Error(`Error en causación de recaudo: ${error?.message || data?.error}`)
    }
    return data
  }

  /**
   * Consulta movimientos individuales del libro auxiliar desde public.accounting_entry_lines
   */
  async getMovements(filters?: AccountingFilters): Promise<{ data: AccountingMovement[]; total: number }> {
    let query = supabaseClient.from('accounting_entry_lines').select(`
      id,
      debit_amount,
      credit_amount,
      third_party_doc,
      third_party_name,
      description,
      created_at,
      accounting_accounts!inner (
        id,
        code,
        name,
        nature
      ),
      accounting_entries!inner (
        id,
        entry_number,
        date,
        document_type,
        document_reference,
        location_id,
        status,
        locations (name)
      )
    `, { count: 'exact' })

    if (filters?.entryStatus && filters.entryStatus !== ('ALL' as any)) {
      query = query.eq('accounting_entries.status', filters.entryStatus)
    }

    if (filters?.sourceType && filters.sourceType !== ('ALL' as any)) {
      query = query.eq('accounting_entries.document_type', filters.sourceType)
    }

    if (filters?.locationId && filters.locationId !== ('ALL' as any)) {
      query = query.eq('accounting_entries.location_id', filters.locationId)
    }

    if (filters?.accountId && filters.accountId !== ('ALL' as any)) {
      query = query.eq('accounting_accounts.code', filters.accountId)
    }

    if (filters?.dateFrom) {
      query = query.gte('accounting_entries.date', filters.dateFrom)
    }
    if (filters?.dateTo) {
      query = query.lte('accounting_entries.date', filters.dateTo)
    }

    const { data, count, error } = await query.order('created_at', { ascending: false })

    if (error || !data) {
      console.warn('Advertencia consultando movimientos contables:', error?.message)
      return { data: [], total: 0 }
    }

    const mapped: AccountingMovement[] = data.map((row: any) => {
      const ae = row.accounting_entries || {}
      const aa = row.accounting_accounts || {}
      const debit = Number(row.debit_amount) || 0
      const credit = Number(row.credit_amount) || 0

      return {
        id: row.id,
        entryId: ae.id,
        entryNumber: ae.entry_number,
        date: ae.date,
        period: (ae.date || '').slice(0, 7),
        accountId: aa.id,
        accountCode: aa.code,
        accountName: aa.name,
        nature: (aa.nature as any) || 'DEBIT',
        sourceType: (ae.document_type as any) || 'MANUAL',
        sourceId: ae.id,
        sourceDocumentNumber: ae.document_reference,
        locationId: ae.location_id,
        locationName: ae.locations?.name || null,
        thirdPartyDoc: row.third_party_doc,
        thirdPartyName: row.third_party_name,
        debit,
        credit,
        balanceAfter: 0,
        description: row.description || '',
        createdAt: row.created_at,
      }
    })

    return { data: mapped, total: count || mapped.length }
  }

  async getAllMovements(): Promise<AccountingMovement[]> {
    const res = await this.getMovements({ page: 1, pageSize: 2000 })
    return res.data
  }

  // --- CONFIGURACIÓN DE CUENTAS POR CATEGORÍA ---

  async getCategoryMappings(): Promise<InventoryAccountMapping[]> {
    // Por defecto consulta las categorías activas
    const { data: categories } = await supabaseClient
      .from('categories')
      .select('id, name, description')
      .order('name')

    if (!categories) return []

    return categories.map((cat: any) => ({
      categoryId: cat.id,
      categoryName: cat.name,
      inventoryType: 'MERCHANDISE',
      inventoryTypeName: 'Mercancía para la Venta (Clase 1435)',
      inventoryAccountId: '1435',
      inventoryAccountCode: '1435',
      inventoryAccountName: 'Mercancías no fabricadas por la empresa',
      costAccountId: '6135',
      costAccountCode: '6135',
      costAccountName: 'Costo de Ventas - Mercancías',
      revenueAccountId: '4135',
      revenueAccountCode: '4135',
      revenueAccountName: 'Comercio al por mayor y al por menor',
      description: cat.description || `Mapeo estándar para ${cat.name}`,
    }))
  }

  async updateCategoryMapping(mapping: InventoryAccountMapping): Promise<InventoryAccountMapping> {
    return mapping
  }

  // --- PERIODOS Y CIERRES CONTABLES ---

  async getPeriods(year?: number): Promise<AccountingPeriod[]> {
    let query = supabaseClient.from('accounting_periods').select('*')
    if (year) {
      query = query.eq('year', year)
    }
    const { data, error } = await query.order('period_code', { ascending: false })
    if (error || !data) return []

    return data.map((p: any) => ({
      id: p.id,
      periodCode: p.period_code,
      year: p.year,
      month: p.month,
      monthName: p.month_name,
      startDate: p.start_date,
      endDate: p.end_date,
      status: p.status,
      closedAt: p.closed_at,
      closedByUserId: p.closed_by_user_id,
      reopenedAt: p.reopened_at,
      reopenedByUserId: p.reopened_by_user_id,
      reopenedReason: p.reopened_reason,
      entriesCount: p.entries_count || 0,
      totalDebits: Number(p.total_debits || 0),
      totalCredits: Number(p.total_credits || 0),
      createdAt: p.created_at,
      updatedAt: p.updated_at,
    }))
  }

  async getPeriodByCode(periodCode: string): Promise<AccountingPeriod | null> {
    const { data, error } = await supabaseClient
      .from('accounting_periods')
      .select('*')
      .eq('period_code', periodCode)
      .single()

    if (error || !data) return null

    return {
      id: data.id,
      periodCode: data.period_code,
      year: data.year,
      month: data.month,
      monthName: data.month_name,
      startDate: data.start_date,
      endDate: data.end_date,
      status: data.status,
      closedAt: data.closed_at,
      closedByUserId: data.closed_by_user_id,
      reopenedAt: data.reopened_at,
      reopenedByUserId: data.reopened_by_user_id,
      reopenedReason: data.reopened_reason,
      entriesCount: data.entries_count || 0,
      totalDebits: Number(data.total_debits || 0),
      totalCredits: Number(data.total_credits || 0),
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    }
  }

  async isPeriodOpen(dateOrPeriod: string): Promise<boolean> {
    const periodCode = dateOrPeriod.includes('T') || dateOrPeriod.length === 10
      ? dateOrPeriod.slice(0, 7)
      : dateOrPeriod
    const period = await this.getPeriodByCode(periodCode)
    if (!period) return true
    return period.status === 'OPEN'
  }

  async closePeriod(periodCode: string, user: { id: string; name: string }): Promise<AccountingPeriod> {
    const { data: comp } = await supabaseClient.auth.getUser()
    // Obtenemos company_id de la sesión o del usuario
    const { data: userRow } = await supabaseClient.from('users').select('company_id').eq('id', user.id).single()
    const companyId = userRow?.company_id

    const { data: res, error } = await supabaseClient.rpc('fn_close_accounting_period', {
      p_company_id: companyId,
      p_period_code: periodCode,
      p_closed_by: user.id,
    })

    if (error) {
      throw new Error(`Error cerrando periodo: ${error.message}`)
    }

    const p = await this.getPeriodByCode(periodCode)
    if (!p) throw new Error('No se pudo recuperar el periodo cerrado.')
    return p
  }

  async reopenPeriod(
    periodCode: string,
    reason: string,
    user: { id: string; name: string }
  ): Promise<AccountingPeriod> {
    const { data: userRow } = await supabaseClient.from('users').select('company_id').eq('id', user.id).single()
    const companyId = userRow?.company_id

    const { data: res, error } = await supabaseClient.rpc('fn_reopen_accounting_period', {
      p_company_id: companyId,
      p_period_code: periodCode,
      p_reopened_by: user.id,
      p_reason: reason,
    })

    if (error) {
      throw new Error(`Error reabriendo periodo: ${error.message}`)
    }

    const p = await this.getPeriodByCode(periodCode)
    if (!p) throw new Error('No se pudo recuperar el periodo reabierto.')
    return p
  }
}

export const accountingRepository = new AccountingRepository()
