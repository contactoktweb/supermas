/**
 * Recursos Humanos — novedades (permisos, licencias, incapacidades, ausencias) y vacaciones.
 * La aprobación, anulación, causación y saldos se resuelven en la base (migración 070).
 */
import { supabaseClient } from '@/lib/supabase/client'
import { resolveUserCompanyId } from '@/lib/supabase/tenant'
import { toHrError } from '../utils/hr-errors'
import {
  mapDashboardSummary,
  mapNovelty,
  mapPeriod,
  mapVacationAlert,
  mapVacationRequest,
  NoveltyRow,
  PeriodRow,
  VacationAlertRow,
  VacationRequestRow,
} from './hr-mappers'
import type {
  HrDashboardSummary,
  Novelty,
  NoveltyFilters,
  VacationAlert,
  VacationPeriod,
  VacationRequest,
  VacationRequestStatus,
} from '../types'
import type { NoveltyFormData, VacationRequestData } from '../schemas/hr.schema'

const NOVELTY_SELECT =
  'id, employee_id, novelty_type, start_date, end_date, hours, calendar_days, business_days, is_paid, status, description, support_document_id, review_notes, reviewed_at, cancel_reason, created_at, employee:hr_employees(first_name, last_name, employee_code)'

const VACATION_REQUEST_SELECT =
  'id, employee_id, start_date, end_date, business_days, calendar_days, return_date, status, notes, review_notes, cancel_reason, created_at, employee:hr_employees(first_name, last_name, employee_code)'

const MAX_ROWS = 500

export class HrAbsenceRepository {
  /* ------------------------------ Novedades ------------------------------ */

  async listNovelties(filters: NoveltyFilters): Promise<Novelty[]> {
    let query = supabaseClient.from('hr_novelties').select(NOVELTY_SELECT)
    if (filters.employeeId) query = query.eq('employee_id', filters.employeeId)
    if (filters.status !== 'ALL') query = query.eq('status', filters.status)
    if (filters.noveltyType !== 'ALL') query = query.eq('novelty_type', filters.noveltyType)
    // Novedades que se cruzan con el rango
    if (filters.from) query = query.gte('end_date', filters.from)
    if (filters.to) query = query.lte('start_date', filters.to)

    const { data, error } = await query.order('start_date', { ascending: false }).limit(MAX_ROWS)
    if (error) throw toHrError(error, 'No se pudieron cargar las novedades.')

    const rows = ((data ?? []) as unknown as NoveltyRow[]).map(mapNovelty)
    const search = filters.query.trim().toLowerCase()
    return search
      ? rows.filter((row) =>
          `${row.employeeName ?? ''} ${row.employeeCode ?? ''} ${row.description ?? ''}`.toLowerCase().includes(search)
        )
      : rows
  }

  async createNovelty(data: NoveltyFormData): Promise<void> {
    const companyId = await resolveUserCompanyId(supabaseClient)
    const { error } = await supabaseClient.from('hr_novelties').insert({
      company_id: companyId,
      employee_id: data.employeeId,
      novelty_type: data.noveltyType,
      start_date: data.startDate,
      end_date: data.endDate,
      hours: data.byHours ? data.hours : null,
      description: data.description,
      support_document_id: data.supportDocumentId,
    })
    if (error) throw toHrError(error, 'No se pudo registrar la novedad.')
  }

  async reviewNovelty(id: string, approve: boolean, notes: string | null): Promise<void> {
    const { error } = await supabaseClient.rpc('fn_hr_review_novelty', {
      p_novelty_id: id,
      p_approve: approve,
      p_notes: notes,
    })
    if (error) throw toHrError(error, 'No se pudo revisar la novedad.')
  }

  async cancelNovelty(id: string, reason: string): Promise<void> {
    const { error } = await supabaseClient.rpc('fn_hr_cancel_novelty', { p_novelty_id: id, p_reason: reason })
    if (error) throw toHrError(error, 'No se pudo anular la novedad.')
  }

  /* ------------------------------ Vacaciones ----------------------------- */

  async listPeriods(employeeId: string, currentHireDate: string): Promise<VacationPeriod[]> {
    const { data, error } = await supabaseClient
      .from('hr_vacation_periods')
      .select('id, employee_id, employment_start, period_number, period_start, period_end, days_accrued, days_taken, days_compensated, is_complete, status')
      .eq('employee_id', employeeId)
      .order('employment_start', { ascending: false })
      .order('period_number', { ascending: false })
    if (error) throw toHrError(error, 'No se pudieron cargar los periodos de vacaciones.')
    return ((data ?? []) as PeriodRow[]).map((row) => mapPeriod(row, currentHireDate))
  }

  async listVacationRequests(options: {
    employeeId?: string
    status?: VacationRequestStatus | 'ALL'
    from?: string
    to?: string
  }): Promise<VacationRequest[]> {
    let query = supabaseClient.from('hr_vacation_requests').select(VACATION_REQUEST_SELECT)
    if (options.employeeId) query = query.eq('employee_id', options.employeeId)
    if (options.status && options.status !== 'ALL') query = query.eq('status', options.status)
    if (options.from) query = query.gte('end_date', options.from)
    if (options.to) query = query.lte('start_date', options.to)
    const { data, error } = await query.order('start_date', { ascending: false }).limit(MAX_ROWS)
    if (error) throw toHrError(error, 'No se pudieron cargar las solicitudes de vacaciones.')
    return ((data ?? []) as unknown as VacationRequestRow[]).map(mapVacationRequest)
  }

  async createVacationRequest(data: VacationRequestData): Promise<void> {
    const companyId = await resolveUserCompanyId(supabaseClient)
    const { error } = await supabaseClient.from('hr_vacation_requests').insert({
      company_id: companyId,
      employee_id: data.employeeId,
      start_date: data.startDate,
      end_date: data.endDate,
      notes: data.notes,
    })
    if (error) throw toHrError(error, 'No se pudo registrar la solicitud de vacaciones.')
  }

  async reviewVacationRequest(id: string, approve: boolean, notes: string | null): Promise<void> {
    const { error } = await supabaseClient.rpc('fn_hr_review_vacation_request', {
      p_request_id: id,
      p_approve: approve,
      p_notes: notes,
    })
    if (error) throw toHrError(error, 'No se pudo revisar la solicitud de vacaciones.')
  }

  async cancelVacationRequest(id: string, reason: string): Promise<void> {
    const { error } = await supabaseClient.rpc('fn_hr_cancel_vacation_request', { p_request_id: id, p_reason: reason })
    if (error) throw toHrError(error, 'No se pudo cancelar la solicitud de vacaciones.')
  }

  async listVacationAlerts(): Promise<VacationAlert[]> {
    const { data, error } = await supabaseClient.rpc('fn_hr_vacation_alerts')
    if (error) throw toHrError(error, 'No se pudieron consultar las alertas de vacaciones.')
    return ((data ?? []) as VacationAlertRow[]).map(mapVacationAlert)
  }

  /** Días hábiles del rango (excluye domingos y festivos de Colombia). */
  async countBusinessDays(startDate: string, endDate: string): Promise<number> {
    const { data, error } = await supabaseClient.rpc('fn_hr_business_days', { p_start: startDate, p_end: endDate })
    if (error) throw toHrError(error, 'No se pudieron calcular los días hábiles.')
    return Number(data ?? 0)
  }

  /** Festivos registrados en el rango (YYYY-MM-DD). */
  async listHolidays(from: string, to: string): Promise<Set<string>> {
    const { data, error } = await supabaseClient
      .from('hr_holidays')
      .select('holiday_date')
      .gte('holiday_date', from)
      .lte('holiday_date', to)
    if (error) throw toHrError(error, 'No se pudieron consultar los festivos.')
    return new Set(((data ?? []) as { holiday_date: string }[]).map((row) => row.holiday_date))
  }

  /** Deja constancia en auditoría de una exportación (sin su contenido). */
  async logExport(report: string, rows: number, includesSensitive: boolean): Promise<void> {
    const { error } = await supabaseClient.rpc('fn_hr_log_export', {
      p_report: report,
      p_rows: rows,
      p_includes_sensitive: includesSensitive,
    })
    if (error) throw toHrError(error, 'No se pudo registrar la exportación.')
  }

  /* ------------------------------- Tablero ------------------------------- */

  async getDashboardSummary(): Promise<HrDashboardSummary> {
    const { data, error } = await supabaseClient.rpc('fn_hr_dashboard_summary')
    if (error) throw toHrError(error, 'No se pudo cargar el resumen de Recursos Humanos.')
    return mapDashboardSummary((data ?? {}) as Record<string, unknown>)
  }
}

export const hrAbsenceRepository = new HrAbsenceRepository()
