/**
 * SUPER MÁS ERP/POS - Repositorio Oficial de Contabilidad (accountingRepository)
 *
 * Conecta 100% directamente a PostgreSQL/Supabase:
 * - public.accounting_accounts (PUC)
 * - public.accounting_entries
 * - public.accounting_entry_lines
 * - public.accounting_periods
 * - RPCs atómicas: fn_create_manual_accounting_entry, fn_reverse_accounting_entry,
 *   fn_cause_sale_accounting, fn_cause_purchase_accounting,
 *   fn_cause_payment_accounting, fn_cause_receipt_accounting,
 *   fn_close_accounting_period, fn_reopen_accounting_period,
 *   fn_accounting_account_balances (saldos agregados, migración 061).
 *
 * Las lecturas compartidas (catálogo PUC, saldos, movimientos, sedes) se memoizan en el
 * navegador (ver accounting-cache) y se invalidan en cada mutación contable.
 */

import { supabaseClient } from '@/lib/supabase/client'
import { getAuthenticatedCompany, resolveUserCompanyId } from '@/lib/supabase/tenant'
import {
  ACCOUNTING_CATALOG_TTL_MS,
  ACCOUNTING_DATA_TTL_MS,
  createCachedResource,
  invalidateAccountingCache,
} from './accounting-cache'
import {
  AccountingAccount,
  AccountingEntry,
  AccountingMovement,
  AccountingFilters,
  InventoryAccountMapping,
  InventoryLineAccounts,
  InventoryLineAccountsConfig,
  AccountingVoucherType,
  AccountingAccountRef,
  AccountingPeriod,
  ThirdParty,
  LegalNature,
  ThirdPartyType,
  AccountNature,
  AccountingCompanyHeader,
  AccountMovementTotalsMap,
} from '../types'
import { isPucCodeInRange, normalizePucRange, pucCodeSortKey, pucRangeUpperKey } from '../utils/puc-code-range'
import {
  AccountFormData,
  InventoryLineAccountsFormData,
  ManualEntryFormData,
  ThirdPartyFormData,
  VoucherTypeUpdateData,
  DEFAULT_MANUAL_VOUCHER_TYPE_CODE,
} from '../schemas/accounting.schema'
import {
  PucAccountRow,
  isAnyCostAccountCode,
  isInventoryAccountCode,
  isSalesIncomeAccountCode,
  selectPostingAccounts,
} from '../utils/posting-accounts'

const BOGOTA_TIME_ZONE = 'America/Bogota'

/** Estados que forman parte de los libros: el original reversado y su reversión se compensan. */
const BOOKED_ENTRY_STATUSES = ['POSTED', 'REVERSED']

/** Parámetros de la consulta de saldos por cuenta (fn_accounting_account_balances_range, 065). */
export interface AccountBalanceTotalsQuery {
  dateFrom?: string | null
  dateTo?: string | null
  locationId?: string | null
  accountFrom?: string | null
  accountTo?: string | null
}

/**
 * Código de periodo contable (YYYY-MM) a partir de una fecha, un timestamp o un código ya armado.
 * Los timestamps (con hora) se interpretan en America/Bogota: una operación del 31 a las 20:00
 * pertenece a ese mes aunque en UTC ya sea el día 1 del siguiente.
 */
export function toBogotaPeriodCode(dateOrPeriod: string): string {
  if (/^\d{4}-\d{2}$/.test(dateOrPeriod)) return dateOrPeriod
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateOrPeriod)) return dateOrPeriod.slice(0, 7)
  const instant = new Date(dateOrPeriod)
  if (Number.isNaN(instant.getTime())) return dateOrPeriod.slice(0, 7)
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: BOGOTA_TIME_ZONE, year: 'numeric', month: '2-digit' }).formatToParts(instant)
  const year = parts.find((p) => p.type === 'year')?.value
  const month = parts.find((p) => p.type === 'month')?.value
  return `${year}-${month}`
}

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
      level:
        row.level === 1
          ? 'CLASS'
          : row.level === 2
          ? 'GROUP'
          : row.level === 3
          ? 'ACCOUNT'
          : row.level === 4
          ? 'SUBACCOUNT'
          : 'AUXILIARY',
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

  /** Catálogo PUC completo (todas las cuentas visibles por RLS), ordenado por código. */
  private readonly catalogCache = createCachedResource(async () => {
    // select('*'): mapAccount usa columnas (description, updated_at) que no figuran en las
    // migraciones; listarlas explícitamente rompería la consulta si no existen en la base.
    const { data, error } = await supabaseClient
      .from('accounting_accounts')
      .select('*')
      .order('code', { ascending: true })
    if (error) throw new Error(`Error consultando el catálogo PUC: ${error.message}`)
    return (data || []) as any[]
  }, ACCOUNTING_CATALOG_TTL_MS)

  /** Débitos y créditos acumulados por cuenta en comprobantes POSTED. */
  private readonly postedTotalsCache = createCachedResource(
    () => this.loadPostedTotalsByAccount(),
    ACCOUNTING_DATA_TTL_MS
  )

  private readonly movementsCache = createCachedResource(
    () => this.getMovements({ page: 1, pageSize: 2000 }).then((res) => res.data),
    ACCOUNTING_DATA_TTL_MS
  )

  private readonly entryStatusesCache = createCachedResource(
    () => this.loadRecentEntryStatuses(),
    ACCOUNTING_DATA_TTL_MS
  )

  private readonly inventoryLineAccountsCache = createCachedResource(
    () => this.loadInventoryLineAccounts(),
    ACCOUNTING_CATALOG_TTL_MS
  )

  /** Catálogo de tipos de comprobante de la empresa (RLS), en el orden definido por sort_order. */
  private readonly voucherTypesCache = createCachedResource(
    () => this.loadVoucherTypes(),
    ACCOUNTING_CATALOG_TTL_MS
  )

  private readonly activeLocationsCache = createCachedResource(async () => {
    const { data } = await supabaseClient
      .from('locations')
      .select('id, name')
      .neq('status', 'INACTIVE')
      .order('name')
    return (data || []) as { id: string; name: string }[]
  }, ACCOUNTING_CATALOG_TTL_MS)

  /** Descarta las lecturas memoizadas; se usa tras cualquier mutación contable. */
  invalidateCache(): void {
    invalidateAccountingCache()
  }

  private async getCatalogRows(): Promise<any[]> {
    try {
      return await this.catalogCache.get()
    } catch (err: any) {
      console.warn('Advertencia consultando cuentas contables:', err?.message)
      return []
    }
  }

  /**
   * Totales POSTED por cuenta agregados en la base (RPC fn_accounting_account_balances).
   * Si la RPC aún no está desplegada o falla, se calcula como antes leyendo las líneas.
   */
  private async loadPostedTotalsByAccount(): Promise<Map<string, { debits: number; credits: number }>> {
    const { data, error } = await supabaseClient.rpc('fn_accounting_account_balances')
    if (!error && Array.isArray(data)) {
      const map = new Map<string, { debits: number; credits: number }>()
      for (const row of data as any[]) {
        map.set(row.account_id, {
          debits: Number(row.total_debit) || 0,
          credits: Number(row.total_credit) || 0,
        })
      }
      return map
    }
    return this.loadPostedTotalsFromLines()
  }

  /**
   * Cálculo legado en el cliente: suma las líneas de comprobantes POSTED y REVERSED
   * (el original reversado y su comprobante de reversión se compensan; ver migración 065).
   */
  private async loadPostedTotalsFromLines(): Promise<Map<string, { debits: number; credits: number }>> {
    const { data, error } = await supabaseClient
      .from('accounting_entry_lines')
      .select(`
        account_id,
        debit_amount,
        credit_amount,
        accounting_entries!inner(status)
      `)
      .in('accounting_entries.status', BOOKED_ENTRY_STATUSES)

    const map = new Map<string, { debits: number; credits: number }>()
    if (!error && data) {
      for (const row of data as any[]) {
        const accId = row.account_id
        const cur = map.get(accId) || { debits: 0, credits: 0 }
        cur.debits += Number(row.debit_amount) || 0
        cur.credits += Number(row.credit_amount) || 0
        map.set(accId, cur)
      }
    }
    return map
  }

  /**
   * Saldo neto de cada cuenta del catálogo según su naturaleza:
   * DEBIT = débitos - créditos; CREDIT = créditos - débitos.
   */
  private async getAccountBalances(): Promise<Map<string, number>> {
    const [catalog, totals] = await Promise.all([
      this.getCatalogRows(),
      this.postedTotalsCache.get().catch(() => new Map<string, { debits: number; credits: number }>()),
    ])

    const resultMap = new Map<string, number>()
    for (const acc of catalog) {
      const stats = totals.get(acc.id) || { debits: 0, credits: 0 }
      const isDebit = acc.nature === 'DEBIT'
      resultMap.set(acc.id, isDebit ? stats.debits - stats.credits : stats.credits - stats.debits)
    }
    return resultMap
  }

  /**
   * Consulta el catálogo de cuentas PUC con filtros y paginación.
   * Filtra en memoria sobre el catálogo compartido (mismo orden por código y mismos criterios
   * que la consulta original), por lo que cambiar filtros o página no genera peticiones.
   */
  async getAccounts(filters?: AccountingFilters): Promise<{ data: AccountingAccount[]; total: number }> {
    const [catalog, balances] = await Promise.all([this.getCatalogRows(), this.getAccountBalances()])

    const q = filters?.query?.trim().toLowerCase() || ''
    const lvlMap: Record<string, number> = { CLASS: 1, GROUP: 2, ACCOUNT: 3, SUBACCOUNT: 4, AUXILIARY: 5 }

    const filtered = catalog.filter((row: any) => {
      if (q) {
        const code = String(row.code || '').toLowerCase()
        const name = String(row.name || '').toLowerCase()
        if (!code.includes(q) && !name.includes(q)) return false
      }
      if (filters?.accountClass && filters.accountClass !== ('ALL' as any)) {
        if (Number(row.account_class) !== Number(filters.accountClass)) return false
      }
      if (filters?.nature && filters.nature !== ('ALL' as any)) {
        if (row.nature !== filters.nature) return false
      }
      if (filters?.status && filters.status !== ('ALL' as any)) {
        if (Boolean(row.is_active) !== (filters.status === 'ACTIVE')) return false
      }
      if (filters?.level && filters.level !== ('ALL' as any)) {
        if (filters.level === 'IMPUTABLE') {
          if (row.level !== 4 && row.level !== 5) return false
        } else if (lvlMap[filters.level] && row.level !== lvlMap[filters.level]) {
          return false
        }
      }
      return true
    })

    const page = filters?.page || 1
    const pageSize = filters?.pageSize || 50
    const start = (page - 1) * pageSize
    const pageRows = filtered.slice(start, start + pageSize)

    return {
      data: pageRows.map((row: any) => this.mapAccount(row, balances.get(row.id) || 0)),
      total: filtered.length,
    }
  }

  async getAllAccounts(): Promise<AccountingAccount[]> {
    const [catalog, balances] = await Promise.all([this.getCatalogRows(), this.getAccountBalances()])
    return catalog.map((row: any) => this.mapAccount(row, balances.get(row.id) || 0))
  }

  /** Busca una cuenta del catálogo compartido por id o, en su defecto, por código. */
  async findAccountByIdOrCode(idOrCode: string): Promise<AccountingAccount | null> {
    const [catalog, balances] = await Promise.all([this.getCatalogRows(), this.getAccountBalances()])
    const row = catalog.find((a: any) => a.id === idOrCode) || catalog.find((a: any) => a.code === idOrCode)
    return row ? this.mapAccount(row, balances.get(row.id) || 0) : null
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

  /** Sedes activas (id, nombre) para los selectores de los reportes contables. */
  async getActiveLocations(): Promise<{ id: string; name: string }[]> {
    const rows = await this.activeLocationsCache.get()
    return [...rows]
  }

  async createAccount(data: AccountFormData): Promise<AccountingAccount> {
    const levelNumber =
      data.level === 'CLASS'
        ? 1
        : data.level === 'GROUP'
        ? 2
        : data.level === 'ACCOUNT'
        ? 3
        : data.level === 'SUBACCOUNT'
        ? 4
        : 5

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

    this.invalidateCache()
    return this.mapAccount(newRow, 0)
  }

  async updateAccount(id: string, data: Partial<AccountFormData>): Promise<AccountingAccount> {
    const updatePayload: any = {}
    if (data.name !== undefined) updatePayload.name = data.name
    if (data.level !== undefined) {
      updatePayload.level =
        data.level === 'CLASS'
          ? 1
          : data.level === 'GROUP'
          ? 2
          : data.level === 'ACCOUNT'
          ? 3
          : data.level === 'SUBACCOUNT'
          ? 4
          : 5
    }
    if (data.requiresThirdParty !== undefined) updatePayload.requires_third_party = data.requiresThirdParty
    if (data.requiresCostCenter !== undefined) updatePayload.requires_cost_center = data.requiresCostCenter
    if (data.nature !== undefined) {
      if (data.nature !== 'DEBIT' && data.nature !== 'CREDIT') {
        throw new Error('La naturaleza de la cuenta debe ser Débito o Crédito.')
      }
      updatePayload.nature = data.nature
    }

    if (Object.keys(updatePayload).length === 0) {
      throw new Error('No hay cambios para guardar en la cuenta contable.')
    }

    const { data: updated, error } = await supabaseClient
      .from('accounting_accounts')
      .update(updatePayload)
      .eq('id', id)
      .select('*')
      .maybeSingle()

    if (error) {
      throw new Error(`Error actualizando cuenta: ${error.message}`)
    }
    // Sin fila devuelta: la RLS (administrador o contador) no permitió el cambio o la cuenta no existe.
    if (!updated) {
      throw new Error('No tiene permiso para modificar el Plan de Cuentas o la cuenta ya no existe.')
    }

    this.invalidateCache()
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
      due_date,
      concept,
      document_type,
      document_reference,
      voucher_type_code,
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
        due_date,
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
      // Comas y paréntesis romperían el filtro .or() de PostgREST: se quitan del texto buscado.
      const q = filters.query.trim().replace(/[,()]/g, ' ').trim()
      if (q) {
        // "FC" encuentra todos los comprobantes FC; "FC-000012" uno puntual.
        query = query.or(
          `entry_number.ilike.%${q}%,voucher_type_code.ilike.%${q}%,concept.ilike.%${q}%,document_reference.ilike.%${q}%`
        )
      }
    }

    if (filters?.entryStatus && filters.entryStatus !== ('ALL' as any)) {
      query = query.eq('status', filters.entryStatus)
    }

    if (filters?.sourceType && filters.sourceType !== ('ALL' as any)) {
      query = query.eq('document_type', filters.sourceType)
    }

    if (filters?.voucherTypeCode && filters.voucherTypeCode !== 'ALL') {
      query = query.eq('voucher_type_code', filters.voucherTypeCode)
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
        dueDate: l.due_date || (row as any).due_date || undefined,
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
        dueDate: (row as any).due_date || undefined,
        period: (row.date || '').slice(0, 7),
        sourceType: (row.document_type as any) || 'MANUAL',
        documentNumber: row.document_reference,
        voucherTypeCode: row.voucher_type_code || undefined,
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

  /**
   * Estados de los mismos comprobantes que getAllEntries (1000 más recientes, mismo orden),
   * sin descargar líneas: basta para los contadores del dashboard.
   */
  async getRecentEntryStatuses(): Promise<string[]> {
    const statuses = await this.entryStatusesCache.get()
    return [...statuses]
  }

  private async loadRecentEntryStatuses(): Promise<string[]> {
    const { data, error } = await supabaseClient
      .from('accounting_entries')
      .select('status')
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
      .range(0, 999)

    if (error || !data) {
      console.warn('Advertencia consultando asientos contables:', error?.message)
      return []
    }
    return (data as any[]).map((row) => (row.status as string) || 'DRAFT')
  }

  async getEntryById(id: string): Promise<AccountingEntry | null> {
    const { data, error } = await supabaseClient
      .from('accounting_entries')
      .select(`
        id,
        consecutive,
        entry_number,
        date,
        due_date,
        concept,
        document_type,
        document_reference,
        voucher_type_code,
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
          due_date,
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

    const rawLines = (data as any).accounting_entry_lines || []
    const lines = rawLines.map((l: any) => ({
      id: l.id,
      accountId: l.account_id,
      accountCode: l.accounting_accounts?.code || '',
      accountName: l.accounting_accounts?.name || '',
      debit: Number(l.debit_amount) || 0,
      credit: Number(l.credit_amount) || 0,
      description: l.description || '',
      dueDate: l.due_date || (data as any).due_date || undefined,
      thirdPartyDoc: l.third_party_doc,
      thirdPartyName: l.third_party_name,
      costCenterId: l.cost_center_id,
    }))

    const totalDebit = lines.reduce((acc: number, l: any) => acc + l.debit, 0)
    const totalCredit = lines.reduce((acc: number, l: any) => acc + l.credit, 0)

    return {
      id: data.id,
      entryNumber: (data as any).entry_number,
      date: (data as any).date,
      dueDate: (data as any).due_date || undefined,
      period: ((data as any).date || '').slice(0, 7),
      sourceType: ((data as any).document_type as any) || 'MANUAL',
      documentNumber: (data as any).document_reference,
      voucherTypeCode: (data as any).voucher_type_code || undefined,
      description: (data as any).concept,
      status: ((data as any).status as any) || 'DRAFT',
      locationId: (data as any).location_id,
      locationName: ((data as any).locations as any)?.name || null,
      thirdPartyDoc: lines[0]?.thirdPartyDoc,
      thirdPartyName: lines[0]?.thirdPartyName,
      lines,
      totalDebit,
      totalCredit,
      isBalanced: Math.abs(totalDebit - totalCredit) < 0.01,
      createdByUserId: (data as any).created_by_user_id,
      confirmedAt: (data as any).posted_at,
      createdAt: (data as any).created_at,
      updatedAt: (data as any).updated_at,
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
    const dueDateOnly = data.dueDate ? (data.dueDate.includes('T') ? data.dueDate.slice(0, 10) : data.dueDate) : null

    const { data: res, error } = await supabaseClient.rpc('fn_create_manual_accounting_entry', {
      p_date: dateOnly,
      p_concept: data.description,
      p_document_type: 'MANUAL',
      p_document_reference: `MAN-${Date.now().toString().slice(-6)}`,
      p_lines: linesPayload,
      p_location_id: data.locationId || null,
      p_auto_post: true,
      p_due_date: dueDateOnly,
      p_voucher_type_code: data.voucherTypeCode || DEFAULT_MANUAL_VOUCHER_TYPE_CODE,
    })

    if (error || !res?.success) {
      console.error('Error creando asiento contable en RPC:', error)
      throw new Error(`Error al crear asiento: ${error?.message || res?.error || 'Partida doble descuadrada o error de validación'}`)
    }

    this.invalidateCache()
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

    this.invalidateCache()

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
    this.invalidateCache()
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
    this.invalidateCache()
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
    this.invalidateCache()
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
    this.invalidateCache()
    return data
  }

  /**
   * Consulta movimientos individuales del libro auxiliar desde public.accounting_entry_lines
   */
  async getMovements(filters?: AccountingFilters): Promise<{ data: AccountingMovement[]; total: number }> {
    const range = normalizePucRange({ from: filters?.accountFrom, to: filters?.accountTo })
    if (!range.from && !range.to) return this.queryMovements(filters, null)

    // Rango de cuentas en la base (columna code_sort_key, migración 065). Si la columna aún no
    // existe, se consulta sin rango y se filtra en memoria con la misma regla de orden del PUC.
    try {
      return await this.queryMovements(filters, range)
    } catch {
      const all = await this.queryMovements(filters, null)
      const data = all.data.filter((m) => isPucCodeInRange(m.accountCode, range))
      return { data, total: data.length }
    }
  }

  private async queryMovements(
    filters: AccountingFilters | undefined,
    range: { from: string; to: string } | null
  ): Promise<{ data: AccountingMovement[]; total: number }> {
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

    if (range?.from) {
      query = query.gte('accounting_accounts.code_sort_key', pucCodeSortKey(range.from))
    }
    if (range?.to) {
      query = query.lte('accounting_accounts.code_sort_key', pucRangeUpperKey(range.to))
    }

    const { data, count, error } = await query.order('created_at', { ascending: false })

    if (range && error) {
      // Lo resuelve getMovements con el filtro en memoria.
      throw new Error(error.message)
    }

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

  /** Todos los movimientos (memoizado y compartido por dashboard, auxiliar, mayor y exógena). */
  async getAllMovements(): Promise<AccountingMovement[]> {
    const movements = await this.movementsCache.get()
    return [...movements]
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

  // --- CUENTAS POR LÍNEA DE INVENTARIO (accounting_inventory_account_map, migración 062) ---

  /** Líneas de inventario (auxiliares 14) con su costo e ingreso, más las cuentas elegibles. */
  async getInventoryLineAccounts(): Promise<InventoryLineAccountsConfig> {
    return this.inventoryLineAccountsCache.get()
  }

  private async loadInventoryLineAccounts(): Promise<InventoryLineAccountsConfig> {
    const [catalog, mapRes, defaultsRes] = await Promise.all([
      this.catalogCache.get(),
      supabaseClient
        .from('accounting_inventory_account_map')
        .select('id, inventory_account_id, cost_account_id, income_account_id, is_active'),
      supabaseClient
        .from('accounting_default_accounts')
        .select('purpose, accounting_account_id')
        .in('purpose', ['COST_OF_SALES', 'SALES_INCOME']),
    ])
    if (mapRes.error) {
      throw new Error(`Error consultando las cuentas por línea de inventario: ${mapRes.error.message}`)
    }
    if (defaultsRes.error) {
      throw new Error(`Error consultando las cuentas contables por defecto: ${defaultsRes.error.message}`)
    }

    const rows = catalog as PucAccountRow[]
    const byId = new Map(rows.map((row) => [row.id, row]))
    const toRef = (id: string | null | undefined): AccountingAccountRef | null => {
      const row = id ? byId.get(id) : undefined
      return row ? { id: row.id, code: row.code, name: row.name } : null
    }
    const mapByInventory = new Map((mapRes.data || []).map((m: any) => [m.inventory_account_id as string, m]))
    const defaultFor = (purpose: string) =>
      toRef((defaultsRes.data || []).find((d: any) => d.purpose === purpose)?.accounting_account_id)

    const lines: InventoryLineAccounts[] = selectPostingAccounts(rows, isInventoryAccountCode).map((inv) => {
      const map = mapByInventory.get(inv.id)
      const isActive = Boolean(map?.is_active)
      return {
        mapId: map?.id ?? null,
        inventoryAccount: inv,
        costAccount: isActive ? toRef(map.cost_account_id) : null,
        incomeAccount: isActive ? toRef(map.income_account_id) : null,
        isActive,
      }
    })

    return {
      lines,
      costAccounts: selectPostingAccounts(rows, isAnyCostAccountCode),
      incomeAccounts: selectPostingAccounts(rows, isSalesIncomeAccountCode),
      defaultCostAccount: defaultFor('COST_OF_SALES'),
      defaultIncomeAccount: defaultFor('SALES_INCOME'),
    }
  }

  /** Crea o actualiza (y reactiva) las cuentas de una línea de inventario de la empresa del usuario. */
  async saveInventoryLineAccounts(data: InventoryLineAccountsFormData): Promise<void> {
    const companyId = await resolveUserCompanyId(supabaseClient)
    const { error } = await supabaseClient
      .from('accounting_inventory_account_map')
      .upsert(
        {
          company_id: companyId,
          inventory_account_id: data.inventoryAccountId,
          cost_account_id: data.costAccountId,
          income_account_id: data.incomeAccountId,
          is_active: true,
        },
        { onConflict: 'company_id,inventory_account_id' }
      )
    if (error) {
      throw new Error(`No se pudieron guardar las cuentas de la línea de inventario: ${error.message}`)
    }
    this.invalidateCache()
  }

  /** La línea vuelve a las cuentas por defecto (la fila se conserva inactiva, sin borrar historia). */
  async deactivateInventoryLineAccounts(mapId: string): Promise<void> {
    const { error } = await supabaseClient
      .from('accounting_inventory_account_map')
      .update({ is_active: false })
      .eq('id', mapId)
    if (error) {
      throw new Error(`No se pudo restablecer la línea de inventario: ${error.message}`)
    }
    this.invalidateCache()
  }

  // --- TIPOS DE COMPROBANTE (migración 064) ---

  /** Tipos de comprobante de la empresa del usuario (se carga una vez y se memoiza). */
  async getVoucherTypes(): Promise<AccountingVoucherType[]> {
    const types = await this.voucherTypesCache.get()
    return [...types]
  }

  private async loadVoucherTypes(): Promise<AccountingVoucherType[]> {
    const { data, error } = await supabaseClient
      .from('accounting_voucher_types')
      .select('id, code, name, description, default_document_types, is_system, is_active, sort_order')
      .order('sort_order', { ascending: true })
      .order('code', { ascending: true })

    if (error) throw new Error(`Error consultando los tipos de comprobante: ${error.message}`)
    return ((data || []) as any[]).map((row) => this.mapVoucherType(row))
  }

  private mapVoucherType(row: any): AccountingVoucherType {
    return {
      id: row.id,
      code: row.code,
      name: row.name,
      description: row.description || undefined,
      defaultDocumentTypes: Array.isArray(row.default_document_types) ? row.default_document_types : [],
      isSystem: Boolean(row.is_system),
      isActive: Boolean(row.is_active),
      sortOrder: Number(row.sort_order) || 0,
    }
  }

  /**
   * Renombra o activa/desactiva un tipo no-system. La base (RLS + permisos por columna + trigger)
   * exige administrador y rechaza cualquier cambio sobre los tipos del sistema.
   */
  async updateVoucherType(id: string, changes: VoucherTypeUpdateData): Promise<AccountingVoucherType> {
    const payload: { name?: string; is_active?: boolean } = {}
    if (changes.name !== undefined) payload.name = changes.name
    if (changes.isActive !== undefined) payload.is_active = changes.isActive

    const { data, error } = await supabaseClient
      .from('accounting_voucher_types')
      .update(payload)
      .eq('id', id)
      .select('id, code, name, description, default_document_types, is_system, is_active, sort_order')
      .maybeSingle()

    if (error) throw new Error(`No se pudo actualizar el tipo de comprobante: ${error.message}`)
    if (!data) throw new Error('No tiene permiso para modificar este tipo de comprobante o ya no existe.')

    this.voucherTypesCache.invalidate()
    return this.mapVoucherType(data)
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
    const periodCode = toBogotaPeriodCode(dateOrPeriod)
    const period = await this.getPeriodByCode(periodCode)
    if (!period) return true
    return period.status === 'OPEN'
  }

  async closePeriod(periodCode: string, user: { id: string; name: string }): Promise<AccountingPeriod> {
    const companyId = await resolveUserCompanyId(supabaseClient).catch(() => undefined)

    const { data: res, error } = await supabaseClient.rpc('fn_close_accounting_period', {
      p_company_id: companyId,
      p_period_code: periodCode,
      p_closed_by: user.id,
    })

    if (error) {
      throw new Error(`Error cerrando periodo: ${error.message}`)
    }

    this.invalidateCache()

    const p = await this.getPeriodByCode(periodCode)
    if (!p) throw new Error('No se pudo recuperar el periodo cerrado.')
    return p
  }

  async reopenPeriod(
    periodCode: string,
    reason: string,
    user: { id: string; name: string }
  ): Promise<AccountingPeriod> {
    const companyId = await resolveUserCompanyId(supabaseClient).catch(() => undefined)

    const { data: res, error } = await supabaseClient.rpc('fn_reopen_accounting_period', {
      p_company_id: companyId,
      p_period_code: periodCode,
      p_reopened_by: user.id,
      p_reason: reason,
    })

    if (error) {
      throw new Error(`Error reabriendo periodo: ${error.message}`)
    }

    this.invalidateCache()

    const p = await this.getPeriodByCode(periodCode)
    if (!p) throw new Error('No se pudo recuperar el periodo reabierto.')
    return p
  }

  /**
   * Mapeo de fila a ThirdParty
   */
  private mapThirdParty(row: any): ThirdParty {
    return {
      id: row.id,
      companyId: row.company_id,
      documentType: row.document_type || 'NIT',
      documentNumber: row.document_number,
      verificationDigit: row.verification_digit || undefined,
      legalNature: (row.legal_nature as LegalNature) || 'JURIDICA',
      firstName: row.first_name || undefined,
      otherNames: row.other_names || undefined,
      firstSurname: row.first_surname || undefined,
      secondSurname: row.second_surname || undefined,
      companyName: row.company_name || row.document_number,
      commercialName: row.commercial_name || undefined,
      thirdPartyType: (row.third_party_type as ThirdPartyType) || 'OTRO',
      email: row.email || undefined,
      phone: row.phone || undefined,
      address: row.address || undefined,
      city: row.city || 'Medellín',
      department: row.department || 'Antioquia',
      isActive: row.is_active ?? true,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }
  }

  /**
   * Obtiene la lista de terceros registrados con filtros opcionales
   */
  async getThirdParties(filters?: {
    query?: string
    nature?: LegalNature | 'ALL'
    type?: ThirdPartyType | 'ALL'
  }): Promise<ThirdParty[]> {
    let query = supabaseClient
      .from('third_parties')
      .select('*')
      .eq('is_active', true)
      .order('company_name', { ascending: true })

    if (filters?.nature && filters.nature !== 'ALL') {
      query = query.eq('legal_nature', filters.nature)
    }

    if (filters?.type && filters.type !== 'ALL') {
      query = query.eq('third_party_type', filters.type)
    }

    if (filters?.query?.trim()) {
      const q = filters.query.trim()
      query = query.or(`document_number.ilike.%${q}%,company_name.ilike.%${q}%,commercial_name.ilike.%${q}%`)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error consultando terceros:', error)
      return []
    }

    return (data || []).map((row) => this.mapThirdParty(row))
  }

  /**
   * Crea un nuevo tercero contable especificando naturaleza jurídica
   */
  async createThirdParty(data: ThirdPartyFormData): Promise<ThirdParty> {
    // La empresa sale siempre del usuario autenticado; nunca se toma "la primera" de la base.
    let companyId: string
    try {
      companyId = await resolveUserCompanyId(supabaseClient)
    } catch (err: any) {
      throw new Error(`No se pudo registrar el tercero: ${err?.message || 'su usuario no tiene una empresa asignada.'}`)
    }

    // Normalizar nombre completo para persona natural si no se suministró explícitamente
    let finalCompanyName = data.companyName?.trim()
    if (data.legalNature === 'NATURAL') {
      const parts = [data.firstSurname, data.secondSurname, data.firstName, data.otherNames].filter(Boolean)
      if (parts.length > 0) {
        finalCompanyName = parts.join(' ')
      }
    }

    const payload = {
      company_id: companyId,
      document_type: data.documentType,
      document_number: data.documentNumber.trim(),
      verification_digit: data.verificationDigit?.trim() || null,
      legal_nature: data.legalNature,
      first_name: data.firstName?.trim() || null,
      other_names: data.otherNames?.trim() || null,
      first_surname: data.firstSurname?.trim() || null,
      second_surname: data.secondSurname?.trim() || null,
      company_name: finalCompanyName,
      commercial_name: data.commercialName?.trim() || null,
      third_party_type: data.thirdPartyType,
      email: data.email?.trim() || null,
      phone: data.phone?.trim() || null,
      address: data.address?.trim() || null,
      city: data.city?.trim() || 'Medellín',
      department: data.department?.trim() || 'Antioquia',
      is_active: true,
    }

    const { data: created, error } = await supabaseClient
      .from('third_parties')
      .insert(payload)
      .select()
      .single()

    if (error || !created) {
      console.error('Error creando tercero en Supabase:', error)
      throw new Error(`Error al registrar tercero: ${error?.message || 'Error desconocido'}`)
    }

    const mapped = this.mapThirdParty(created)

    // Sincronización preventiva con módulos de Clientes o Proveedores según el rol
    try {
      if (data.thirdPartyType === 'CLIENTE' && companyId) {
        const { data: existingCust } = await supabaseClient
          .from('customers')
          .select('id')
          .eq('document_number', data.documentNumber.trim())
          .limit(1)
        if (!existingCust || existingCust.length === 0) {
          await supabaseClient.from('customers').insert({
            company_id: companyId,
            document_type: data.documentType || 'CC',
            document_number: data.documentNumber.trim(),
            verification_digit: data.verificationDigit?.trim() || null,
            first_name: data.legalNature === 'NATURAL' ? data.firstName?.trim() || null : null,
            last_name: data.legalNature === 'NATURAL' ? data.firstSurname?.trim() || null : null,
            company_name: finalCompanyName,
            commercial_name: data.commercialName?.trim() || finalCompanyName,
            person_type: data.legalNature === 'JURIDICA' ? 'COMPANY' : 'NATURAL',
            customer_type: data.legalNature === 'JURIDICA' ? 'COMPANY' : 'INDIVIDUAL',
            customer_category: 'RETAIL',
            phone: data.phone?.trim() || null,
            email: data.email?.trim().toLowerCase() || null,
            address: data.address?.trim() || null,
            city: data.city?.trim() || 'Medellín',
            department: data.department?.trim() || 'Antioquia',
            is_active: true,
          })
        }
      } else if (data.thirdPartyType === 'PROVEEDOR' && companyId) {
        const { data: existingSupp } = await supabaseClient
          .from('suppliers')
          .select('id')
          .eq('tax_id', data.documentNumber.trim())
          .limit(1)
        if (!existingSupp || existingSupp.length === 0) {
          await supabaseClient.from('suppliers').insert({
            company_id: companyId,
            tax_id: data.documentNumber.trim(),
            verification_digit: data.verificationDigit?.trim() || null,
            legal_name: finalCompanyName,
            commercial_name: data.commercialName?.trim() || finalCompanyName,
            name: data.commercialName?.trim() || finalCompanyName,
            person_type: data.legalNature === 'JURIDICA' ? 'JURIDICA' : 'NATURAL',
            phone: data.phone?.trim() || null,
            email: data.email?.trim().toLowerCase() || null,
            address: data.address?.trim() || null,
            city: data.city?.trim() || 'Medellín',
            department: data.department?.trim() || 'Antioquia',
            is_active: true,
          })
        }
      }
    } catch (syncErr) {
      console.warn('Sincronización opcional de tercero con tabla legacy (clientes/proveedores):', syncErr)
    }

    return mapped
  }

  /**
   * Actualiza el tipo o rol del tercero (CLIENTE, PROVEEDOR, EMPLEADO, ACREEDOR, OTRO)
   */
  async updateThirdPartyType(id: string, thirdPartyType: ThirdPartyType): Promise<ThirdParty> {
    const { data: updated, error } = await supabaseClient
      .from('third_parties')
      .update({
        third_party_type: thirdPartyType,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()

    if (error || !updated) {
      console.error('Error actualizando rol de tercero:', error)
      throw new Error(`Error al actualizar rol del tercero: ${error?.message || 'Error desconocido'}`)
    }

    const mapped = this.mapThirdParty(updated)

    // Sincronización preventiva si fue cambiado a Cliente o Proveedor
    try {
      if (thirdPartyType === 'CLIENTE' && mapped.companyId) {
        const { data: existingCust } = await supabaseClient
          .from('customers')
          .select('id')
          .eq('document_number', mapped.documentNumber)
          .limit(1)
        if (!existingCust || existingCust.length === 0) {
          await supabaseClient.from('customers').insert({
            company_id: mapped.companyId,
            document_type: mapped.documentType || 'CC',
            document_number: mapped.documentNumber,
            verification_digit: mapped.verificationDigit || null,
            first_name: mapped.firstName || null,
            last_name: mapped.firstSurname || null,
            company_name: mapped.companyName,
            commercial_name: mapped.commercialName || mapped.companyName,
            person_type: mapped.legalNature === 'JURIDICA' ? 'COMPANY' : 'NATURAL',
            customer_type: mapped.legalNature === 'JURIDICA' ? 'COMPANY' : 'INDIVIDUAL',
            customer_category: 'RETAIL',
            phone: mapped.phone || null,
            email: mapped.email?.toLowerCase() || null,
            address: mapped.address || null,
            city: mapped.city || 'Medellín',
            department: mapped.department || 'Antioquia',
            is_active: true,
          })
        }
      } else if (thirdPartyType === 'PROVEEDOR' && mapped.companyId) {
        const { data: existingSupp } = await supabaseClient
          .from('suppliers')
          .select('id')
          .eq('tax_id', mapped.documentNumber)
          .limit(1)
        if (!existingSupp || existingSupp.length === 0) {
          await supabaseClient.from('suppliers').insert({
            company_id: mapped.companyId,
            tax_id: mapped.documentNumber,
            verification_digit: mapped.verificationDigit || null,
            legal_name: mapped.companyName,
            commercial_name: mapped.commercialName || mapped.companyName,
            name: mapped.commercialName || mapped.companyName,
            person_type: mapped.legalNature === 'JURIDICA' ? 'JURIDICA' : 'NATURAL',
            phone: mapped.phone || null,
            email: mapped.email?.toLowerCase() || null,
            address: mapped.address || null,
            city: mapped.city || 'Medellín',
            department: mapped.department || 'Antioquia',
            is_active: true,
          })
        }
      }
    } catch (syncErr) {
      console.warn('Sincronización opcional al actualizar tipo de tercero:', syncErr)
    }

    return mapped
  }

  /**
   * Actualiza la naturaleza contable (Débito o Crédito) de una cuenta PUC
   */
  async updateAccountNature(accountId: string, nature: AccountNature): Promise<AccountingAccount> {
    return this.updateAccount(accountId, { nature })
  }

  // --- REPORTES: SALDOS POR RANGO, EMPRESA Y USO DE CUENTAS (migración 065) ---

  /** Número de líneas contables (de cualquier comprobante de la empresa) registradas en la cuenta. */
  async countAccountEntryLines(accountId: string): Promise<number> {
    const { count, error } = await supabaseClient
      .from('accounting_entry_lines')
      .select('id', { count: 'exact', head: true })
      .eq('account_id', accountId)
    if (error) {
      throw new Error(`No se pudo verificar si la cuenta tiene movimientos: ${error.message}`)
    }
    return count || 0
  }

  /**
   * Débitos y créditos por cuenta (comprobantes POSTED/REVERSED de la empresa del usuario) con
   * filtros de fecha, sede y rango de cuentas aplicados en la base.
   * Si la RPC de rango (065) aún no existe, usa la de 061 y aplica el rango sobre el catálogo.
   */
  async getAccountBalanceTotals(query: AccountBalanceTotalsQuery = {}): Promise<AccountMovementTotalsMap> {
    const locationId = query.locationId && query.locationId !== 'ALL' ? query.locationId : null
    const range = normalizePucRange({ from: query.accountFrom, to: query.accountTo })
    const toMap = (rows: any[]): AccountMovementTotalsMap => {
      const map: AccountMovementTotalsMap = new Map()
      for (const row of rows) {
        map.set(row.account_id, {
          debit: Number(row.total_debit) || 0,
          credit: Number(row.total_credit) || 0,
        })
      }
      return map
    }

    const rangeRes = await supabaseClient.rpc('fn_accounting_account_balances_range', {
      p_date_from: query.dateFrom || null,
      p_date_to: query.dateTo || null,
      p_location_id: locationId,
      p_account_from: range.from || null,
      p_account_to: range.to || null,
    })
    if (!rangeRes.error && Array.isArray(rangeRes.data)) return toMap(rangeRes.data)

    const baseRes = await supabaseClient.rpc('fn_accounting_account_balances', {
      p_date_from: query.dateFrom || null,
      p_date_to: query.dateTo || null,
      p_location_id: locationId,
    })
    if (baseRes.error || !Array.isArray(baseRes.data)) {
      throw new Error(`No se pudieron consultar los saldos contables: ${(baseRes.error || rangeRes.error)?.message || 'respuesta vacía'}`)
    }
    const totals = toMap(baseRes.data)
    if (range.from || range.to) {
      const catalog = await this.getCatalogRows()
      const codeById = new Map(catalog.map((row: any) => [row.id as string, String(row.code || '')]))
      for (const accountId of Array.from(totals.keys())) {
        if (!isPucCodeInRange(codeById.get(accountId) || '', range)) totals.delete(accountId)
      }
    }
    return totals
  }

  /** Razón social, NIT y DV de la empresa del usuario (encabezados de reportes; nunca valores fijos). */
  async getCompanyHeader(): Promise<AccountingCompanyHeader> {
    const company: any = await getAuthenticatedCompany(supabaseClient)
    if (!company) {
      throw new Error('No se encontró la empresa del usuario para el encabezado del reporte.')
    }
    return {
      legalName: company.business_name || company.trade_name || '',
      tradeName: company.trade_name || company.business_name || '',
      taxId: String(company.tax_id || ''),
      verificationDigit: String(company.verification_digit ?? ''),
      taxRegime: company.tax_regime || '',
      legalRepresentative: company.legal_representative_name || '',
    }
  }
}

export const accountingRepository = new AccountingRepository()
