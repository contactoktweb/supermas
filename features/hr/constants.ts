import type { LightIconName } from '@/components/ui/Icon'
import type {
  BankAccountType,
  ContractType,
  DocumentIdType,
  EmployeeStatus,
  EmploymentEventType,
  HrDocumentType,
  NoveltyStatus,
  NoveltyType,
  SalaryType,
  TerminationCause,
  VacationAlertLevel,
  VacationPeriodStatus,
  VacationRequestStatus,
  WorkSchedule,
} from './types'

export const HR_BASE_PATH = '/recursos-humanos'
export const HR_ROUTES = {
  panel: `${HR_BASE_PATH}/panel`,
  employees: `${HR_BASE_PATH}/empleados`,
  structure: `${HR_BASE_PATH}/estructura`,
  novelties: `${HR_BASE_PATH}/novedades`,
  vacations: `${HR_BASE_PATH}/vacaciones`,
  reports: `${HR_BASE_PATH}/reportes`,
} as const

export const employeeProfilePath = (id: string, tab?: string) =>
  `${HR_ROUTES.employees}/${id}${tab ? `?tab=${tab}` : ''}`

export const HR_DOCUMENTS_BUCKET = 'hr-documents'
export const HR_DOCUMENT_MAX_BYTES = 5 * 1024 * 1024
export const HR_DOCUMENT_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png'] as const
export const HR_SIGNED_URL_SECONDS = 60
export const HR_DOCUMENT_EXPIRY_WARNING_DAYS = 30
export const HR_VACATION_DAYS_PER_YEAR = 15
export const HR_LIST_PAGE_SIZE = 25

export const DOCUMENT_ID_TYPE_LABELS: Record<DocumentIdType, string> = {
  CC: 'Cédula de ciudadanía',
  CE: 'Cédula de extranjería',
  TI: 'Tarjeta de identidad',
  PA: 'Pasaporte',
  PEP: 'Permiso especial de permanencia',
  PPT: 'Permiso por protección temporal',
}

export const CONTRACT_TYPE_LABELS: Record<ContractType, string> = {
  INDEFINIDO: 'Término indefinido',
  TERMINO_FIJO: 'Término fijo',
  OBRA_LABOR: 'Obra o labor',
  APRENDIZAJE: 'Aprendizaje',
  PRESTACION_SERVICIOS: 'Prestación de servicios',
}

/** Contratos que no causan vacaciones en el ERP. */
export const CONTRACTS_WITHOUT_VACATIONS: ContractType[] = ['APRENDIZAJE', 'PRESTACION_SERVICIOS']

export const SALARY_TYPE_LABELS: Record<SalaryType, string> = {
  ORDINARIO: 'Ordinario',
  INTEGRAL: 'Integral',
}

export const WORK_SCHEDULE_LABELS: Record<WorkSchedule, string> = {
  TIEMPO_COMPLETO: 'Tiempo completo',
  MEDIO_TIEMPO: 'Medio tiempo',
  POR_HORAS: 'Por horas',
  TURNOS: 'Por turnos',
}

export const BANK_ACCOUNT_TYPE_LABELS: Record<BankAccountType, string> = {
  AHORROS: 'Ahorros',
  CORRIENTE: 'Corriente',
  DEPOSITO: 'Depósito electrónico',
}

export const EMPLOYEE_STATUS_LABELS: Record<EmployeeStatus, string> = {
  ACTIVO: 'Activo',
  EN_VACACIONES: 'En vacaciones',
  INCAPACITADO: 'Incapacitado',
  RETIRADO: 'Retirado',
}

export const TERMINATION_CAUSE_LABELS: Record<TerminationCause, string> = {
  RENUNCIA_VOLUNTARIA: 'Renuncia voluntaria',
  DESPIDO_JUSTA_CAUSA: 'Despido con justa causa',
  DESPIDO_SIN_JUSTA_CAUSA: 'Despido sin justa causa',
  MUTUO_ACUERDO: 'Mutuo acuerdo',
  VENCIMIENTO_TERMINO_FIJO: 'Vencimiento del término fijo',
  TERMINACION_OBRA_LABOR: 'Terminación de la obra o labor',
  PERIODO_PRUEBA: 'Terminación en periodo de prueba',
  PENSION: 'Reconocimiento de pensión',
  FALLECIMIENTO: 'Fallecimiento',
  OTRA: 'Otra causa',
}

export const EVENT_TYPE_LABELS: Record<EmploymentEventType, string> = {
  INGRESO: 'Ingreso',
  CAMBIO_CARGO: 'Cambio de cargo',
  CAMBIO_SALARIO: 'Cambio de salario',
  CAMBIO_SEDE: 'Cambio de sede',
  CAMBIO_CONTRATO: 'Cambio de contrato',
  RETIRO: 'Retiro',
  REINGRESO: 'Reingreso',
}

export const EVENT_TYPE_ICONS: Record<EmploymentEventType, LightIconName> = {
  INGRESO: 'userPlus',
  CAMBIO_CARGO: 'briefcase',
  CAMBIO_SALARIO: 'dollar',
  CAMBIO_SEDE: 'warehouse',
  CAMBIO_CONTRATO: 'fileText',
  RETIRO: 'userMinus',
  REINGRESO: 'refresh',
}

export const DOCUMENT_TYPE_LABELS: Record<HrDocumentType, string> = {
  CONTRATO: 'Contrato laboral',
  OTROSI: 'Otrosí',
  HOJA_VIDA: 'Hoja de vida',
  DOCUMENTO_IDENTIDAD: 'Documento de identidad',
  CERTIFICADO_ESTUDIO: 'Certificado de estudio',
  CERTIFICADO_LABORAL: 'Certificado laboral',
  AFILIACION_SEGURIDAD_SOCIAL: 'Afiliación a seguridad social',
  EXAMEN_MEDICO: 'Examen médico ocupacional',
  AUTORIZACION_DATOS: 'Autorización de tratamiento de datos',
  SOPORTE_NOVEDAD: 'Soporte de novedad',
  CARTA_RETIRO: 'Carta de retiro',
  PAZ_Y_SALVO: 'Paz y salvo',
  OTRO: 'Otro',
}

export const NOVELTY_TYPE_LABELS: Record<NoveltyType, string> = {
  PERMISO_REMUNERADO: 'Permiso remunerado',
  PERMISO_NO_REMUNERADO: 'Permiso no remunerado',
  LICENCIA_MATERNIDAD: 'Licencia de maternidad',
  LICENCIA_PATERNIDAD: 'Licencia de paternidad',
  LICENCIA_LUTO: 'Licencia de luto',
  INCAPACIDAD_GENERAL: 'Incapacidad de origen común',
  INCAPACIDAD_LABORAL: 'Incapacidad de origen laboral',
  AUSENCIA_INJUSTIFICADA: 'Ausencia injustificada',
  CALAMIDAD_DOMESTICA: 'Calamidad doméstica',
  SUSPENSION_DISCIPLINARIA: 'Suspensión disciplinaria',
}

export const UNPAID_NOVELTY_TYPES: NoveltyType[] = [
  'PERMISO_NO_REMUNERADO',
  'AUSENCIA_INJUSTIFICADA',
  'SUSPENSION_DISCIPLINARIA',
]

/** Novedades que pueden registrarse por horas dentro de un mismo día. */
export const HOURLY_NOVELTY_TYPES: NoveltyType[] = [
  'PERMISO_REMUNERADO',
  'PERMISO_NO_REMUNERADO',
  'AUSENCIA_INJUSTIFICADA',
]

export const NOVELTY_STATUS_LABELS: Record<NoveltyStatus, string> = {
  PENDIENTE: 'Pendiente',
  APROBADA: 'Aprobada',
  RECHAZADA: 'Rechazada',
  ANULADA: 'Anulada',
}

export const VACATION_REQUEST_STATUS_LABELS: Record<VacationRequestStatus, string> = {
  PENDIENTE: 'Pendiente',
  APROBADA: 'Aprobada',
  RECHAZADA: 'Rechazada',
  CANCELADA: 'Cancelada',
  DISFRUTADA: 'Disfrutada',
}

export const VACATION_PERIOD_STATUS_LABELS: Record<VacationPeriodStatus, string> = {
  EN_CAUSACION: 'En causación',
  CAUSADO: 'Causado sin disfrutar',
  DISFRUTADO: 'Disfrutado',
  COMPENSADO: 'Compensado en dinero',
}

export const VACATION_ALERT_LABELS: Record<VacationAlertLevel, string> = {
  AL_DIA: 'Al día',
  PENDIENTE: 'Periodo vencido',
  CRITICA: 'Crítica',
}

export type HrBadgeTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral'

export const EMPLOYEE_STATUS_TONES: Record<EmployeeStatus, HrBadgeTone> = {
  ACTIVO: 'success',
  EN_VACACIONES: 'info',
  INCAPACITADO: 'warning',
  RETIRADO: 'neutral',
}

export const REQUEST_STATUS_TONES: Record<NoveltyStatus | VacationRequestStatus, HrBadgeTone> = {
  PENDIENTE: 'warning',
  APROBADA: 'success',
  RECHAZADA: 'danger',
  ANULADA: 'neutral',
  CANCELADA: 'neutral',
  DISFRUTADA: 'info',
}

export const VACATION_PERIOD_TONES: Record<VacationPeriodStatus, HrBadgeTone> = {
  EN_CAUSACION: 'info',
  CAUSADO: 'warning',
  DISFRUTADO: 'success',
  COMPENSADO: 'neutral',
}

export const VACATION_ALERT_TONES: Record<VacationAlertLevel, HrBadgeTone> = {
  AL_DIA: 'success',
  PENDIENTE: 'warning',
  CRITICA: 'danger',
}

export const ARL_RISK_CLASSES = [1, 2, 3, 4, 5] as const

/** Convierte un diccionario de etiquetas en opciones para CustomSelect. */
export function toSelectOptions<T extends string>(labels: Record<T, string>) {
  return (Object.keys(labels) as T[]).map((value) => ({ value, label: labels[value] }))
}
