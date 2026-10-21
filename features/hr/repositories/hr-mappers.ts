/**
 * Conversión de filas de PostgreSQL (snake_case) al dominio de Recursos Humanos.
 */
import type {
  Employee,
  EmployeeListItem,
  EmploymentEvent,
  HrDashboardSummary,
  HrDistributionItem,
  HrDocument,
  Novelty,
  VacationAlert,
  VacationPeriod,
  VacationRequest,
} from '../types'

type NamedRelation = { name: string | null } | { name: string | null }[] | null
type PersonRelation =
  | { first_name: string; last_name: string; employee_code?: string | null }
  | { first_name: string; last_name: string; employee_code?: string | null }[]
  | null
type UserRelation = { full_name: string | null } | { full_name: string | null }[] | null

const one = <T>(relation: T | T[] | null | undefined): T | null =>
  Array.isArray(relation) ? (relation[0] ?? null) : (relation ?? null)

const toNumber = (value: unknown): number => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

const toNullableNumber = (value: unknown): number | null =>
  value === null || value === undefined || value === '' ? null : toNumber(value)

const personName = (relation: PersonRelation): string | null => {
  const person = one(relation)
  return person ? `${person.first_name} ${person.last_name}` : null
}

export const EMPLOYEE_LIST_SELECT = `
  id, employee_code, document_type, document_number, first_name, last_name, email, phone,
  position_id, area_id, location_id, contract_type, hire_date, termination_date, status, bank_account_masked,
  position:hr_positions(name), area:hr_areas(name), location:locations(name)
`

export const EMPLOYEE_DETAIL_SELECT = `
  *,
  position:hr_positions(name), area:hr_areas(name), location:locations(name),
  manager:hr_employees!manager_employee_id(first_name, last_name),
  erp_user:users!user_id(full_name)
`

export interface EmployeeRow {
  id: string
  employee_code: string
  document_type: Employee['documentType']
  document_number: string
  first_name: string
  last_name: string
  email: string | null
  phone: string | null
  position_id: string
  area_id: string | null
  location_id: string | null
  contract_type: Employee['contractType']
  hire_date: string
  termination_date: string | null
  status: Employee['status']
  bank_account_masked: string | null
  position?: NamedRelation
  area?: NamedRelation
  location?: NamedRelation
  birth_date?: string | null
  address?: string | null
  city?: string | null
  department?: string | null
  emergency_contact_name?: string | null
  emergency_contact_phone?: string | null
  emergency_contact_relationship?: string | null
  eps?: string | null
  afp?: string | null
  arl?: string | null
  arl_risk_class?: number | null
  ccf?: string | null
  severance_fund?: string | null
  bank_name?: string | null
  bank_account_type?: Employee['bankAccountType']
  contract_end_date?: string | null
  salary?: number | string
  salary_type?: Employee['salaryType']
  work_schedule?: Employee['workSchedule']
  weekly_hours?: number | string | null
  manager_employee_id?: string | null
  manager?: PersonRelation
  termination_cause?: Employee['terminationCause']
  termination_reason?: string | null
  user_id?: string | null
  erp_user?: UserRelation
  data_consent_at?: string
  data_consent_version?: string
  notes?: string | null
  created_at?: string
  updated_at?: string
}

export function mapEmployeeListItem(row: EmployeeRow): EmployeeListItem {
  return {
    id: row.id,
    employeeCode: row.employee_code,
    documentType: row.document_type,
    documentNumber: row.document_number,
    firstName: row.first_name,
    lastName: row.last_name,
    fullName: `${row.first_name} ${row.last_name}`,
    email: row.email,
    phone: row.phone,
    positionId: row.position_id,
    positionName: one(row.position)?.name ?? null,
    areaId: row.area_id,
    areaName: one(row.area)?.name ?? null,
    locationId: row.location_id,
    locationName: one(row.location)?.name ?? null,
    contractType: row.contract_type,
    hireDate: row.hire_date,
    terminationDate: row.termination_date,
    status: row.status,
    bankAccountMasked: row.bank_account_masked,
  }
}

export function mapEmployee(row: EmployeeRow): Employee {
  return {
    ...mapEmployeeListItem(row),
    birthDate: row.birth_date ?? null,
    address: row.address ?? null,
    city: row.city ?? null,
    department: row.department ?? null,
    emergencyContactName: row.emergency_contact_name ?? null,
    emergencyContactPhone: row.emergency_contact_phone ?? null,
    emergencyContactRelationship: row.emergency_contact_relationship ?? null,
    eps: row.eps ?? null,
    afp: row.afp ?? null,
    arl: row.arl ?? null,
    arlRiskClass: toNullableNumber(row.arl_risk_class),
    ccf: row.ccf ?? null,
    severanceFund: row.severance_fund ?? null,
    bankName: row.bank_name ?? null,
    bankAccountType: row.bank_account_type ?? null,
    contractEndDate: row.contract_end_date ?? null,
    salary: toNumber(row.salary),
    salaryType: row.salary_type ?? 'ORDINARIO',
    workSchedule: row.work_schedule ?? 'TIEMPO_COMPLETO',
    weeklyHours: toNullableNumber(row.weekly_hours),
    managerEmployeeId: row.manager_employee_id ?? null,
    managerName: personName(row.manager ?? null),
    terminationCause: row.termination_cause ?? null,
    terminationReason: row.termination_reason ?? null,
    userId: row.user_id ?? null,
    userName: one(row.erp_user ?? null)?.full_name ?? null,
    dataConsentAt: row.data_consent_at ?? '',
    dataConsentVersion: row.data_consent_version ?? '',
    notes: row.notes ?? null,
    createdAt: row.created_at ?? '',
    updatedAt: row.updated_at ?? '',
  }
}

export interface EventRow {
  id: string
  employee_id: string
  event_type: EmploymentEvent['eventType']
  effective_date: string
  previous_values: Record<string, unknown> | null
  new_values: Record<string, unknown> | null
  termination_cause: EmploymentEvent['terminationCause']
  reason: string | null
  created_by_name: string
  created_at: string
}

export function mapEvent(row: EventRow): EmploymentEvent {
  return {
    id: row.id,
    employeeId: row.employee_id,
    eventType: row.event_type,
    effectiveDate: row.effective_date,
    previousValues: row.previous_values ?? {},
    newValues: row.new_values ?? {},
    terminationCause: row.termination_cause,
    reason: row.reason,
    createdByName: row.created_by_name,
    createdAt: row.created_at,
  }
}

export interface DocumentRow {
  id: string
  employee_id: string
  document_type: HrDocument['documentType']
  name: string
  description: string | null
  issue_date: string | null
  expires_at: string | null
  mime_type: string
  size_bytes: number
  is_archived: boolean
  created_at: string
  employee?: PersonRelation
}

export function mapDocument(row: DocumentRow): HrDocument {
  return {
    id: row.id,
    employeeId: row.employee_id,
    employeeName: personName(row.employee ?? null),
    documentType: row.document_type,
    name: row.name,
    description: row.description,
    issueDate: row.issue_date,
    expiresAt: row.expires_at,
    mimeType: row.mime_type,
    sizeBytes: toNumber(row.size_bytes),
    isArchived: row.is_archived,
    createdAt: row.created_at,
  }
}

export interface NoveltyRow {
  id: string
  employee_id: string
  novelty_type: Novelty['noveltyType']
  start_date: string
  end_date: string
  hours: number | string | null
  calendar_days: number
  business_days: number
  is_paid: boolean
  status: Novelty['status']
  description: string | null
  support_document_id: string | null
  review_notes: string | null
  reviewed_at: string | null
  cancel_reason: string | null
  created_at: string
  employee?: PersonRelation
}

export function mapNovelty(row: NoveltyRow): Novelty {
  const employee = one(row.employee ?? null)
  return {
    id: row.id,
    employeeId: row.employee_id,
    employeeName: personName(row.employee ?? null),
    employeeCode: employee?.employee_code ?? null,
    noveltyType: row.novelty_type,
    startDate: row.start_date,
    endDate: row.end_date,
    hours: toNullableNumber(row.hours),
    calendarDays: toNumber(row.calendar_days),
    businessDays: toNumber(row.business_days),
    isPaid: row.is_paid,
    status: row.status,
    description: row.description,
    supportDocumentId: row.support_document_id,
    reviewNotes: row.review_notes,
    reviewedAt: row.reviewed_at,
    cancelReason: row.cancel_reason,
    createdAt: row.created_at,
  }
}

export interface PeriodRow {
  id: string
  employee_id: string
  employment_start: string
  period_number: number
  period_start: string
  period_end: string
  days_accrued: number | string
  days_taken: number | string
  days_compensated: number | string
  is_complete: boolean
  status: VacationPeriod['status']
}

export function mapPeriod(row: PeriodRow, currentHireDate: string): VacationPeriod {
  const accrued = toNumber(row.days_accrued)
  const taken = toNumber(row.days_taken)
  const compensated = toNumber(row.days_compensated)
  return {
    id: row.id,
    employeeId: row.employee_id,
    periodNumber: row.period_number,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    daysAccrued: accrued,
    daysTaken: taken,
    daysCompensated: compensated,
    balance: Math.round((accrued - taken - compensated) * 100) / 100,
    isComplete: row.is_complete,
    status: row.status,
    isCurrentEmployment: row.employment_start === currentHireDate,
  }
}

export interface VacationRequestRow {
  id: string
  employee_id: string
  start_date: string
  end_date: string
  business_days: number
  calendar_days: number
  return_date: string | null
  status: VacationRequest['status']
  notes: string | null
  review_notes: string | null
  cancel_reason: string | null
  created_at: string
  employee?: PersonRelation
}

export function mapVacationRequest(row: VacationRequestRow): VacationRequest {
  const employee = one(row.employee ?? null)
  return {
    id: row.id,
    employeeId: row.employee_id,
    employeeName: personName(row.employee ?? null),
    employeeCode: employee?.employee_code ?? null,
    startDate: row.start_date,
    endDate: row.end_date,
    businessDays: toNumber(row.business_days),
    calendarDays: toNumber(row.calendar_days),
    returnDate: row.return_date,
    status: row.status,
    notes: row.notes,
    reviewNotes: row.review_notes,
    cancelReason: row.cancel_reason,
    createdAt: row.created_at,
  }
}

export interface VacationAlertRow {
  employee_id: string
  employee_code: string
  full_name: string
  area_id: string | null
  location_id: string | null
  pending_periods: number
  pending_days: number | string
  available_days: number | string
  oldest_pending_period_end: string | null
  current_period_end: string | null
  days_to_next_period: number | null
  alert_level: VacationAlert['alertLevel']
}

export function mapVacationAlert(row: VacationAlertRow): VacationAlert {
  return {
    employeeId: row.employee_id,
    employeeCode: row.employee_code,
    fullName: row.full_name,
    areaId: row.area_id,
    locationId: row.location_id,
    pendingPeriods: toNumber(row.pending_periods),
    pendingDays: toNumber(row.pending_days),
    availableDays: toNumber(row.available_days),
    oldestPendingPeriodEnd: row.oldest_pending_period_end,
    currentPeriodEnd: row.current_period_end,
    daysToNextPeriod: row.days_to_next_period,
    alertLevel: row.alert_level,
  }
}

interface DistributionRow {
  id: string | null
  name: string
  count: number | string
}

const mapDistribution = (rows: unknown): HrDistributionItem[] =>
  Array.isArray(rows)
    ? (rows as DistributionRow[]).map((item) => ({ id: item.id, name: item.name, count: toNumber(item.count) }))
    : []

export function mapDashboardSummary(raw: Record<string, unknown>): HrDashboardSummary {
  return {
    activeEmployees: toNumber(raw.active_employees),
    onVacation: toNumber(raw.on_vacation),
    incapacitated: toNumber(raw.incapacitated),
    hiresThisMonth: toNumber(raw.hires_this_month),
    terminationsThisMonth: toNumber(raw.terminations_this_month),
    activeNovelties: toNumber(raw.active_novelties),
    pendingNovelties: toNumber(raw.pending_novelties),
    pendingVacationRequests: toNumber(raw.pending_vacation_requests),
    vacationOverdue: toNumber(raw.vacation_overdue),
    vacationCritical: toNumber(raw.vacation_critical),
    documentsExpiring: toNumber(raw.documents_expiring),
    documentsExpired: toNumber(raw.documents_expired),
    byArea: mapDistribution(raw.by_area),
    byLocation: mapDistribution(raw.by_location),
    asOf: String(raw.as_of ?? ''),
  }
}
