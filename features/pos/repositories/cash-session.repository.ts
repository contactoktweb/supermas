import { supabaseClient } from '@/lib/supabase/client'
import { resolveUserCompanyId } from '@/lib/supabase/tenant'
import {
  CashRegister,
  CashSession,
  CashMovement,
  CashSessionSummary,
  OpenSessionPayload,
  RecordCashMovementPayload,
  CloseSessionPayload,
} from '../types'

export class CashSessionRepository {
  private async resolveCompanyId(): Promise<string> {
    return resolveUserCompanyId(supabaseClient)
  }

  /**
   * Obtiene el listado de cajas registradoras de la empresa
   */
  async getCashRegisters(locationId?: string): Promise<CashRegister[]> {
    let query = supabaseClient
      .from('cash_registers')
      .select(`
        id,
        company_id,
        location_id,
        code,
        name,
        current_status,
        created_at,
        locations ( name ),
        cash_sessions ( id, status )
      `)
      .order('code', { ascending: true })

    if (locationId && locationId !== 'ALL') {
      query = query.eq('location_id', locationId)
    }

    const { data, error } = await query
    if (error || !data) {
      console.error('Error al consultar cajas registradoras:', error)
      return []
    }

    return data.map((row: any) => {
      const activeSession = (row.cash_sessions || []).find((s: any) => s.status === 'OPEN')
      return {
        id: row.id,
        companyId: row.company_id,
        locationId: row.location_id,
        locationName: row.locations?.name || 'Sede Principal',
        code: row.code,
        name: row.name,
        currentStatus: row.current_status,
        createdAt: row.created_at,
        activeSessionId: activeSession?.id || null,
      }
    })
  }

  /**
   * Crea una nueva caja registradora en la bodega
   */
  async createCashRegister(data: {
    locationId: string
    code: string
    name: string
  }): Promise<CashRegister> {
    const companyId = await this.resolveCompanyId()

    const { data: created, error } = await supabaseClient
      .from('cash_registers')
      .insert({
        company_id: companyId,
        location_id: data.locationId,
        code: data.code.toUpperCase().trim(),
        name: data.name.trim(),
        current_status: 'CLOSED',
      })
      .select(`
        id,
        company_id,
        location_id,
        code,
        name,
        current_status,
        created_at,
        locations ( name )
      `)
      .single()

    if (error || !created) {
      console.error('Error al crear caja registradora:', error)
      throw new Error(`Error al crear caja registradora: ${error?.message || 'Error desconocido'}`)
    }

    return {
      id: created.id,
      companyId: created.company_id,
      locationId: created.location_id,
      locationName: (created as any).locations?.name || 'Sede Principal',
      code: created.code,
      name: created.name,
      currentStatus: created.current_status,
      createdAt: created.created_at,
    }
  }

  /**
   * Obtiene la sesión activa (OPEN) para una caja o una bodega
   */
  async getActiveSession(registerId?: string, locationId?: string): Promise<CashSession | null> {
    let query = supabaseClient
      .from('cash_sessions')
      .select(`
        id,
        company_id,
        location_id,
        cash_register_id,
        user_id,
        opening_time,
        closing_time,
        opening_float,
        expected_cash_amount,
        counted_cash_amount,
        difference_amount,
        status,
        supervisor_notes,
        created_at,
        cash_registers ( code, name ),
        users ( full_name ),
        locations ( name )
      `)
      .eq('status', 'OPEN')

    if (registerId) {
      query = query.eq('cash_register_id', registerId)
    }
    if (locationId && locationId !== 'ALL') {
      query = query.eq('location_id', locationId)
    }

    const { data, error } = await query.maybeSingle()
    if (error || !data) return null

    return {
      id: data.id,
      companyId: data.company_id,
      locationId: data.location_id,
      locationName: (data as any).locations?.name || 'Sede Principal',
      cashRegisterId: data.cash_register_id,
      cashRegisterCode: (data as any).cash_registers?.code || '',
      cashRegisterName: (data as any).cash_registers?.name || '',
      userId: data.user_id,
      cashierName: (data as any).users?.full_name || 'Cajero',
      openingTime: data.opening_time,
      closingTime: data.closing_time,
      openingFloat: Number(data.opening_float || 0),
      expectedCashAmount: data.expected_cash_amount ? Number(data.expected_cash_amount) : null,
      countedCashAmount: data.counted_cash_amount ? Number(data.counted_cash_amount) : null,
      differenceAmount: data.difference_amount ? Number(data.difference_amount) : null,
      status: data.status,
      supervisorNotes: data.supervisor_notes,
      createdAt: data.created_at,
    }
  }

  /**
   * Abre un turno de caja atómicamente en PostgreSQL
   */
  async openSession(payload: OpenSessionPayload): Promise<any> {
    const { data, error } = await supabaseClient.rpc('fn_open_cash_session', {
      p_cash_register_id: payload.cashRegisterId,
      p_opening_float: payload.openingFloat,
      p_notes: payload.notes || null,
    })

    if (error) {
      console.error('Error al abrir sesión de caja:', error)
      throw new Error(`Error al abrir sesión: ${error.message}`)
    }

    return data
  }

  /**
   * Registra un ingreso o retiro manual de efectivo en la sesión
   */
  async recordMovement(payload: RecordCashMovementPayload): Promise<any> {
    const { data, error } = await supabaseClient.rpc('fn_record_cash_movement', {
      p_session_id: payload.sessionId,
      p_type: payload.type,
      p_amount: payload.amount,
      p_reason: payload.reason,
    })

    if (error) {
      console.error('Error al registrar movimiento de efectivo:', error)
      throw new Error(`Error al registrar movimiento: ${error.message}`)
    }

    return data
  }

  /**
   * Obtiene el resumen consolidado de arqueo y ventas de la sesión
   */
  async getSessionSummary(sessionId: string): Promise<CashSessionSummary> {
    const { data, error } = await supabaseClient.rpc('fn_get_cash_session_summary', {
      p_session_id: sessionId,
    })

    if (error || !data) {
      console.error('Error al consultar resumen de arqueo:', error)
      throw new Error(`Error al consultar resumen: ${error?.message || 'Error desconocido'}`)
    }

    return {
      sessionId: data.session_id,
      status: data.status,
      cashRegisterId: data.cash_register_id,
      cashRegisterCode: data.cash_register_code,
      cashRegisterName: data.cash_register_name,
      cashierName: data.cashier_name,
      locationName: data.location_name,
      openingTime: data.opening_time,
      closingTime: data.closing_time,
      openingFloat: Number(data.opening_float || 0),
      salesCash: Number(data.sales_cash || 0),
      cashIn: Number(data.cash_in || 0),
      cashOut: Number(data.cash_out || 0),
      expectedCashAmount: Number(data.expected_cash_amount || 0),
      countedCashAmount: data.counted_cash_amount !== null ? Number(data.counted_cash_amount) : null,
      differenceAmount: data.difference_amount !== null ? Number(data.difference_amount) : null,
      salesCard: Number(data.sales_card || 0),
      salesTransfer: Number(data.sales_transfer || 0),
      salesCredit: Number(data.sales_credit || 0),
      salesMixed: Number(data.sales_mixed || 0),
      totalSales: Number(data.total_sales || 0),
      transactionsCount: Number(data.transactions_count || 0),
      movementsCount: Number(data.movements_count || 0),
      supervisorNotes: data.supervisor_notes,
    }
  }

  /**
   * Cierra el turno de caja y registra el arqueo con diferencias
   */
  async closeSession(payload: CloseSessionPayload): Promise<any> {
    const { data, error } = await supabaseClient.rpc('fn_close_cash_session', {
      p_session_id: payload.sessionId,
      p_counted_cash_amount: payload.countedCashAmount,
      p_supervisor_notes: payload.supervisorNotes || null,
    })

    if (error) {
      console.error('Error al cerrar turno de caja:', error)
      throw new Error(`Error al cerrar caja: ${error.message}`)
    }

    return data
  }

  /**
   * Obtiene los movimientos de efectivo registrados en una sesión
   */
  async getMovements(sessionId: string): Promise<CashMovement[]> {
    const { data, error } = await supabaseClient
      .from('cash_movements')
      .select(`
        id,
        session_id,
        type,
        amount,
        reason,
        authorized_by_user_id,
        created_at,
        users ( full_name )
      `)
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false })

    if (error || !data) return []

    return data.map((m: any) => ({
      id: m.id,
      sessionId: m.session_id,
      type: m.type,
      amount: Number(m.amount || 0),
      reason: m.reason,
      authorizedByUserId: m.authorized_by_user_id,
      authorizerName: m.users?.full_name || 'Cajero',
      createdAt: m.created_at,
    }))
  }

  /**
   * Obtiene el historial de sesiones de caja con filtros
   */
  async getSessions(filters?: {
    locationId?: string
    status?: string
    startDate?: string
    endDate?: string
  }): Promise<CashSession[]> {
    let query = supabaseClient
      .from('cash_sessions')
      .select(`
        id,
        company_id,
        location_id,
        cash_register_id,
        user_id,
        opening_time,
        closing_time,
        opening_float,
        expected_cash_amount,
        counted_cash_amount,
        difference_amount,
        status,
        supervisor_notes,
        created_at,
        cash_registers ( code, name ),
        users ( full_name ),
        locations ( name )
      `)
      .order('opening_time', { ascending: false })

    if (filters?.locationId && filters.locationId !== 'ALL') {
      query = query.eq('location_id', filters.locationId)
    }
    if (filters?.status && filters.status !== 'ALL') {
      query = query.eq('status', filters.status)
    }
    if (filters?.startDate) {
      query = query.gte('opening_time', filters.startDate)
    }
    if (filters?.endDate) {
      query = query.lte('opening_time', filters.endDate)
    }

    const { data, error } = await query
    if (error || !data) return []

    return data.map((s: any) => ({
      id: s.id,
      companyId: s.company_id,
      locationId: s.location_id,
      locationName: s.locations?.name || 'Sede Principal',
      cashRegisterId: s.cash_register_id,
      cashRegisterCode: s.cash_registers?.code || '',
      cashRegisterName: s.cash_registers?.name || '',
      userId: s.user_id,
      cashierName: s.users?.full_name || 'Cajero',
      openingTime: s.opening_time,
      closingTime: s.closing_time,
      openingFloat: Number(s.opening_float || 0),
      expectedCashAmount: s.expected_cash_amount !== null ? Number(s.expected_cash_amount) : null,
      countedCashAmount: s.counted_cash_amount !== null ? Number(s.counted_cash_amount) : null,
      differenceAmount: s.difference_amount !== null ? Number(s.difference_amount) : null,
      status: s.status,
      supervisorNotes: s.supervisor_notes,
      createdAt: s.created_at,
    }))
  }
}

export const cashSessionRepository = new CashSessionRepository()
