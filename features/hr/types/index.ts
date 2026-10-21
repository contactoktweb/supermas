/**
 * SUPER MÁS ERP/POS — Recursos Humanos (migración 070)
 * Tipos de dominio del módulo. Los valores literales coinciden con los CHECK de la base.
 */

export type DocumentIdType = 'CC' | 'CE' | 'TI' | 'PA' | 'PEP' | 'PPT'
export type ContractType = 'INDEFINIDO' | 'TERMINO_FIJO' | 'OBRA_LABOR' | 'APRENDIZAJE' | 'PRESTACION_SERVICIOS'
export type SalaryType = 'ORDINARIO' | 'INTEGRAL'
export type WorkSchedule = 'TIEMPO_COMPLETO' | 'MEDIO_TIEMPO' | 'POR_HORAS' | 'TURNOS'
export type BankAccountType = 'AHORROS' | 'CORRIENTE' | 'DEPOSITO'
export type EmployeeStatus = 'ACTIVO' | 'EN_VACACIONES' | 'INCAPACITADO' | 'RETIRADO'
export type TerminationCause =
  | 'RENUNCIA_VOLUNTARIA'
  | 'DESPIDO_JUSTA_CAUSA'
  | 'DESPIDO_SIN_JUSTA_CAUSA'
  | 'MUTUO_ACUERDO'
  | 'VENCIMIENTO_TERMINO_FIJO'
  | 'TERMINACION_OBRA_LABOR'
  | 'PERIODO_PRUEBA'
  | 'PENSION'
  | 'FALLECIMIENTO'
  | 'OTRA'
export type EmploymentEventType =
  | 'INGRESO'
  | 'CAMBIO_CARGO'
  | 'CAMBIO_SALARIO'
  | 'CAMBIO_SEDE'
  | 'CAMBIO_CONTRATO'
  | 'RETIRO'
  | 'REINGRESO'
export type HrDocumentType =
  | 'CONTRATO'
  | 'OTROSI'
  | 'HOJA_VIDA'
  | 'DOCUMENTO_IDENTIDAD'
  | 'CERTIFICADO_ESTUDIO'
  | 'CERTIFICADO_LABORAL'
  | 'AFILIACION_SEGURIDAD_SOCIAL'
  | 'EXAMEN_MEDICO'
  | 'AUTORIZACION_DATOS'
  | 'SOPORTE_NOVEDAD'
  | 'CARTA_RETIRO'
  | 'PAZ_Y_SALVO'
  | 'OTRO'
export type NoveltyType =
  | 'PERMISO_REMUNERADO'
  | 'PERMISO_NO_REMUNERADO'
  | 'LICENCIA_MATERNIDAD'
  | 'LICENCIA_PATERNIDAD'
  | 'LICENCIA_LUTO'
  | 'INCAPACIDAD_GENERAL'
  | 'INCAPACIDAD_LABORAL'
  | 'AUSENCIA_INJUSTIFICADA'
  | 'CALAMIDAD_DOMESTICA'
  | 'SUSPENSION_DISCIPLINARIA'
export type NoveltyStatus = 'PENDIENTE' | 'APROBADA' | 'RECHAZADA' | 'ANULADA'
export type VacationRequestStatus = 'PENDIENTE' | 'APROBADA' | 'RECHAZADA' | 'CANCELADA' | 'DISFRUTADA'
export type VacationPeriodStatus = 'EN_CAUSACION' | 'CAUSADO' | 'DISFRUTADO' | 'COMPENSADO'
export type VacationAlertLevel = 'AL_DIA' | 'PENDIENTE' | 'CRITICA'

export interface HrArea {
  id: string
  code: string | null
  name: string
  description: string | null
  isActive: boolean
  positionsCount: number
  employeesCount: number
}

export interface HrPosition {
  id: string
  areaId: string | null
  areaName: string | null
  code: string | null
  name: string
  description: string | null
  arlRiskClass: number | null
  isActive: boolean
  employeesCount: number
}

export interface HrOption {
  id: string
  name: string
}

export interface HrUserOption {
  id: string
  name: string
  email: string
}

/** Fila del listado (sin datos sensibles; cuenta enmascarada). */
export interface EmployeeListItem {
  id: string
  employeeCode: string
  documentType: DocumentIdType
  documentNumber: string
  fullName: string
  firstName: string
  lastName: string
  email: string | null
  phone: string | null
  positionId: string
  positionName: string | null
  areaId: string | null
  areaName: string | null
  locationId: string | null
  locationName: string | null
  contractType: ContractType
  hireDate: string
  terminationDate: string | null
  status: EmployeeStatus
  bankAccountMasked: string | null
}

export interface Employee extends EmployeeListItem {
  birthDate: string | null
  address: string | null
  city: string | null
  department: string | null
  emergencyContactName: string | null
  emergencyContactPhone: string | null
  emergencyContactRelationship: string | null
  eps: string | null
  afp: string | null
  arl: string | null
  arlRiskClass: number | null
  ccf: string | null
  severanceFund: string | null
  bankName: string | null
  bankAccountType: BankAccountType | null
  contractEndDate: string | null
  salary: number
  salaryType: SalaryType
  workSchedule: WorkSchedule
  weeklyHours: number | null
  managerEmployeeId: string | null
  managerName: string | null
  terminationCause: TerminationCause | null
  terminationReason: string | null
  userId: string | null
  userName: string | null
  dataConsentAt: string
  dataConsentVersion: string
  notes: string | null
  createdAt: string
  updatedAt: string
}

export interface EmployeeFilters {
  query: string
  status: EmployeeStatus | 'ALL' | 'VIGENTES'
  areaId: string
  positionId: string
  locationId: string
  contractType: ContractType | 'ALL'
}

export interface EmploymentEvent {
  id: string
  employeeId: string
  eventType: EmploymentEventType
  effectiveDate: string
  previousValues: Record<string, unknown>
  newValues: Record<string, unknown>
  terminationCause: TerminationCause | null
  reason: string | null
  createdByName: string
  createdAt: string
}

export interface HrDocument {
  id: string
  employeeId: string
  employeeName: string | null
  documentType: HrDocumentType
  name: string
  description: string | null
  issueDate: string | null
  expiresAt: string | null
  mimeType: string
  sizeBytes: number
  isArchived: boolean
  createdAt: string
}

export interface Novelty {
  id: string
  employeeId: string
  employeeName: string | null
  employeeCode: string | null
  noveltyType: NoveltyType
  startDate: string
  endDate: string
  hours: number | null
  calendarDays: number
  businessDays: number
  isPaid: boolean
  status: NoveltyStatus
  description: string | null
  supportDocumentId: string | null
  reviewNotes: string | null
  reviewedAt: string | null
  cancelReason: string | null
  createdAt: string
}

export interface NoveltyFilters {
  query: string
  status: NoveltyStatus | 'ALL'
  noveltyType: NoveltyType | 'ALL'
  from: string
  to: string
  employeeId?: string
}

export interface VacationPeriod {
  id: string
  employeeId: string
  periodNumber: number
  periodStart: string
  periodEnd: string
  daysAccrued: number
  daysTaken: number
  daysCompensated: number
  balance: number
  isComplete: boolean
  status: VacationPeriodStatus
  isCurrentEmployment: boolean
}

export interface VacationRequest {
  id: string
  employeeId: string
  employeeName: string | null
  employeeCode: string | null
  startDate: string
  endDate: string
  businessDays: number
  calendarDays: number
  returnDate: string | null
  status: VacationRequestStatus
  notes: string | null
  reviewNotes: string | null
  cancelReason: string | null
  createdAt: string
}

export interface VacationAlert {
  employeeId: string
  employeeCode: string
  fullName: string
  areaId: string | null
  locationId: string | null
  pendingPeriods: number
  pendingDays: number
  availableDays: number
  oldestPendingPeriodEnd: string | null
  currentPeriodEnd: string | null
  daysToNextPeriod: number | null
  alertLevel: VacationAlertLevel
}

export interface HrDistributionItem {
  id: string | null
  name: string
  count: number
}

export interface HrDashboardSummary {
  activeEmployees: number
  onVacation: number
  incapacitated: number
  hiresThisMonth: number
  terminationsThisMonth: number
  activeNovelties: number
  pendingNovelties: number
  pendingVacationRequests: number
  vacationOverdue: number
  vacationCritical: number
  documentsExpiring: number
  documentsExpired: number
  byArea: HrDistributionItem[]
  byLocation: HrDistributionItem[]
  asOf: string
}

export interface TerminationResult {
  vacationDaysCompensated: number
  hasErpUser: boolean
}

export type HrToastType = 'success' | 'error' | 'info'

export interface HrToastMessage {
  id: string
  type: HrToastType
  title: string
  description?: string
}
