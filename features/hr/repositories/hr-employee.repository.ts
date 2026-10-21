/**
 * Recursos Humanos — empleados, historial laboral y movimientos (ingreso, cambios, retiro).
 * Los campos laborales solo cambian mediante las RPC de la migración 070.
 */
import { supabaseClient } from '@/lib/supabase/client'
import { resolveUserCompanyId } from '@/lib/supabase/tenant'
import { toHrError } from '../utils/hr-errors'
import { HR_LIST_PAGE_SIZE } from '../constants'
import {
  EMPLOYEE_DETAIL_SELECT,
  EMPLOYEE_LIST_SELECT,
  EmployeeRow,
  EventRow,
  mapEmployee,
  mapEmployeeListItem,
  mapEvent,
} from './hr-mappers'
import type { Employee, EmployeeFilters, EmployeeListItem, EmploymentEvent, TerminationResult } from '../types'
import type {
  EmployeeCreateData,
  EmployeePersonalData,
  EmploymentChangeData,
  RehireData,
  TerminationData,
} from '../schemas/hr.schema'

/** Quita caracteres con significado en los filtros de PostgREST. */
const sanitizeSearch = (value: string) => value.trim().replace(/[%_,()*\\]/g, ' ').replace(/\s+/g, ' ')

const personalPayload = (data: EmployeePersonalData) => ({
  document_type: data.documentType,
  document_number: data.documentNumber,
  first_name: data.firstName,
  last_name: data.lastName,
  birth_date: data.birthDate,
  email: data.email,
  phone: data.phone,
  address: data.address,
  city: data.city,
  department: data.department,
  emergency_contact_name: data.emergencyContactName,
  emergency_contact_phone: data.emergencyContactPhone,
  emergency_contact_relationship: data.emergencyContactRelationship,
  eps: data.eps,
  afp: data.afp,
  arl: data.arl,
  arl_risk_class: data.arlRiskClass,
  ccf: data.ccf,
  severance_fund: data.severanceFund,
  bank_name: data.bankName,
  bank_account_type: data.bankAccountType,
  user_id: data.userId,
  data_consent_at: data.dataConsentAt,
  data_consent_version: data.dataConsentVersion,
  notes: data.notes,
})

export class HrEmployeeRepository {
  async list(
    filters: EmployeeFilters,
    page: number,
    pageSize: number = HR_LIST_PAGE_SIZE
  ): Promise<{ data: EmployeeListItem[]; total: number }> {
    let query = supabaseClient.from('hr_employees').select(EMPLOYEE_LIST_SELECT, { count: 'exact' })

    if (filters.status === 'VIGENTES') query = query.neq('status', 'RETIRADO')
    else if (filters.status !== 'ALL') query = query.eq('status', filters.status)
    if (filters.areaId) query = query.eq('area_id', filters.areaId)
    if (filters.positionId) query = query.eq('position_id', filters.positionId)
    if (filters.locationId) query = query.eq('location_id', filters.locationId)
    if (filters.contractType !== 'ALL') query = query.eq('contract_type', filters.contractType)

    const search = sanitizeSearch(filters.query)
    if (search) {
      query = query.or(
        `first_name.ilike.%${search}%,last_name.ilike.%${search}%,document_number.ilike.%${search}%,employee_code.ilike.%${search}%`
      )
    }

    const from = (page - 1) * pageSize
    const { data, count, error } = await query
      .order('first_name')
      .order('last_name')
      .range(from, from + pageSize - 1)

    if (error) throw toHrError(error, 'No se pudieron cargar los empleados.')
    return {
      data: ((data ?? []) as unknown as EmployeeRow[]).map(mapEmployeeListItem),
      total: count ?? 0,
    }
  }

  /** Todos los empleados con detalle (reportes y exportación para nómina). */
  async listDetailed(includeRetired: boolean): Promise<Employee[]> {
    let query = supabaseClient.from('hr_employees').select(EMPLOYEE_DETAIL_SELECT)
    if (!includeRetired) query = query.neq('status', 'RETIRADO')
    const { data, error } = await query.order('first_name').order('last_name').limit(5000)
    if (error) throw toHrError(error, 'No se pudo consultar la planta de personal.')
    return ((data ?? []) as unknown as EmployeeRow[]).map(mapEmployee)
  }

  async getById(id: string): Promise<Employee | null> {
    const { data, error } = await supabaseClient
      .from('hr_employees')
      .select(EMPLOYEE_DETAIL_SELECT)
      .eq('id', id)
      .maybeSingle()
    if (error) throw toHrError(error, 'No se pudo cargar el empleado.')
    return data ? mapEmployee(data as unknown as EmployeeRow) : null
  }

  async create(data: EmployeeCreateData): Promise<string> {
    const companyId = await resolveUserCompanyId(supabaseClient)
    const { data: row, error } = await supabaseClient
      .from('hr_employees')
      .insert({
        company_id: companyId,
        ...personalPayload(data),
        position_id: data.positionId,
        area_id: data.areaId,
        location_id: data.locationId,
        manager_employee_id: data.managerEmployeeId,
        contract_type: data.contractType,
        contract_end_date: data.contractEndDate,
        hire_date: data.hireDate,
        salary: data.salary,
        salary_type: data.salaryType,
        work_schedule: data.workSchedule,
        weekly_hours: data.weeklyHours,
      })
      .select('id')
      .single()
    if (error) throw toHrError(error, 'No se pudo registrar el empleado.')
    return (row as { id: string }).id
  }

  async updatePersonal(id: string, data: EmployeePersonalData): Promise<void> {
    const { error } = await supabaseClient.from('hr_employees').update(personalPayload(data)).eq('id', id)
    if (error) throw toHrError(error, 'No se pudieron guardar los datos del empleado.')
  }

  async changeEmployment(id: string, data: EmploymentChangeData, current: Employee): Promise<number> {
    const proposed: Record<string, string | number | null> = {
      position_id: data.positionId,
      area_id: data.areaId,
      location_id: data.locationId,
      manager_employee_id: data.managerEmployeeId,
      salary: data.salary,
      salary_type: data.salaryType,
      contract_type: data.contractType,
      contract_end_date: data.contractEndDate,
      work_schedule: data.workSchedule,
      weekly_hours: data.weeklyHours,
    }
    const currentValues: Record<string, string | number | null> = {
      position_id: current.positionId,
      area_id: current.areaId,
      location_id: current.locationId,
      manager_employee_id: current.managerEmployeeId,
      salary: current.salary,
      salary_type: current.salaryType,
      contract_type: current.contractType,
      contract_end_date: current.contractEndDate,
      work_schedule: current.workSchedule,
      weekly_hours: current.weeklyHours,
    }
    const changes = Object.fromEntries(
      Object.entries(proposed).filter(([key, value]) => value !== currentValues[key])
    )
    if (Object.keys(changes).length === 0) {
      throw new Error('No hay cambios laborales para registrar.')
    }

    const { data: result, error } = await supabaseClient.rpc('fn_hr_change_employment', {
      p_employee_id: id,
      p_effective_date: data.effectiveDate,
      p_changes: changes,
      p_reason: data.reason,
    })
    if (error) throw toHrError(error, 'No se pudo registrar el cambio laboral.')
    return Number((result as { events?: number } | null)?.events ?? 0)
  }

  async terminate(id: string, data: TerminationData): Promise<TerminationResult> {
    const { data: result, error } = await supabaseClient.rpc('fn_hr_terminate_employee', {
      p_employee_id: id,
      p_termination_date: data.terminationDate,
      p_cause: data.cause,
      p_reason: data.reason,
      p_compensate_vacations: data.compensateVacations,
      p_compensation_reason: data.compensateVacations ? data.compensationReason : null,
    })
    if (error) throw toHrError(error, 'No se pudo registrar el retiro.')
    const payload = (result ?? {}) as { vacation_days_compensated?: number; has_erp_user?: boolean }
    return {
      vacationDaysCompensated: Number(payload.vacation_days_compensated ?? 0),
      hasErpUser: Boolean(payload.has_erp_user),
    }
  }

  async rehire(id: string, data: RehireData): Promise<void> {
    const { error } = await supabaseClient.rpc('fn_hr_rehire_employee', {
      p_employee_id: id,
      p_hire_date: data.hireDate,
      p_changes: {},
      p_reason: data.reason,
    })
    if (error) throw toHrError(error, 'No se pudo registrar el reingreso.')
  }

  async listEvents(employeeId: string): Promise<EmploymentEvent[]> {
    const { data, error } = await supabaseClient
      .from('hr_employment_events')
      .select('id, employee_id, event_type, effective_date, previous_values, new_values, termination_cause, reason, created_by_name, created_at')
      .eq('employee_id', employeeId)
      .order('effective_date', { ascending: false })
      .order('created_at', { ascending: false })
    if (error) throw toHrError(error, 'No se pudo cargar el historial laboral.')
    return ((data ?? []) as EventRow[]).map(mapEvent)
  }

  /** Eventos de la empresa en un rango (reporte de ingresos y retiros). */
  async listEventsInRange(from: string, to: string): Promise<(EmploymentEvent & { employeeName: string; employeeCode: string })[]> {
    const { data, error } = await supabaseClient
      .from('hr_employment_events')
      .select('id, employee_id, event_type, effective_date, previous_values, new_values, termination_cause, reason, created_by_name, created_at, employee:hr_employees(first_name, last_name, employee_code)')
      .in('event_type', ['INGRESO', 'REINGRESO', 'RETIRO'])
      .gte('effective_date', from)
      .lte('effective_date', to)
      .order('effective_date')
    if (error) throw toHrError(error, 'No se pudieron consultar los ingresos y retiros.')
    type Row = EventRow & { employee: { first_name: string; last_name: string; employee_code: string } | { first_name: string; last_name: string; employee_code: string }[] | null }
    return ((data ?? []) as unknown as Row[]).map((row) => {
      const employee = Array.isArray(row.employee) ? row.employee[0] : row.employee
      return {
        ...mapEvent(row),
        employeeName: employee ? `${employee.first_name} ${employee.last_name}` : '',
        employeeCode: employee?.employee_code ?? '',
      }
    })
  }

  /** Número de cuenta completo (solo con hr.sensitive; la RLS devuelve vacío en otro caso). */
  async getBankAccountNumber(employeeId: string): Promise<string | null> {
    const { data, error } = await supabaseClient
      .from('hr_employee_bank_accounts')
      .select('account_number')
      .eq('employee_id', employeeId)
      .maybeSingle()
    if (error) throw toHrError(error, 'No se pudo consultar la cuenta bancaria.')
    return (data as { account_number: string } | null)?.account_number ?? null
  }

  async listBankAccounts(): Promise<Map<string, string>> {
    const { data, error } = await supabaseClient.from('hr_employee_bank_accounts').select('employee_id, account_number')
    if (error) throw toHrError(error, 'No se pudieron consultar las cuentas bancarias.')
    return new Map(((data ?? []) as { employee_id: string; account_number: string }[]).map((row) => [row.employee_id, row.account_number]))
  }

  async saveBankAccountNumber(employeeId: string, accountNumber: string): Promise<void> {
    const companyId = await resolveUserCompanyId(supabaseClient)
    const { error } = await supabaseClient
      .from('hr_employee_bank_accounts')
      .upsert({ employee_id: employeeId, company_id: companyId, account_number: accountNumber }, { onConflict: 'employee_id' })
    if (error) throw toHrError(error, 'No se pudo guardar la cuenta bancaria.')
  }

  /** Causación de vacaciones y estado del empleado (o de toda la empresa) al día de hoy. */
  async refresh(employeeId?: string): Promise<void> {
    const { error } = await supabaseClient.rpc('fn_hr_refresh', { p_employee_id: employeeId ?? null })
    if (error) throw toHrError(error, 'No se pudo actualizar la información de vacaciones.')
  }
}

export const hrEmployeeRepository = new HrEmployeeRepository()
