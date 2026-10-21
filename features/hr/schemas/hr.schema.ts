import { z } from 'zod'
import {
  BANK_ACCOUNT_TYPE_LABELS,
  CONTRACT_TYPE_LABELS,
  DOCUMENT_ID_TYPE_LABELS,
  DOCUMENT_TYPE_LABELS,
  HR_DOCUMENT_MAX_BYTES,
  HR_DOCUMENT_MIME_TYPES,
  NOVELTY_TYPE_LABELS,
  SALARY_TYPE_LABELS,
  TERMINATION_CAUSE_LABELS,
  WORK_SCHEDULE_LABELS,
} from '../constants'

/* ----------------------------------------------------------------------------
 * Utilidades de validación (los formularios trabajan con strings)
 * ------------------------------------------------------------------------- */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

const keysOf = <T extends string>(labels: Record<T, string>) => Object.keys(labels) as [T, ...T[]]

const optionalText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label}: máximo ${max} caracteres`)
    .transform((value) => (value === '' ? null : value))

const requiredText = (min: number, max: number, label: string) =>
  z
    .string()
    .trim()
    .min(min, `${label}: mínimo ${min} caracteres`)
    .max(max, `${label}: máximo ${max} caracteres`)

const requiredDate = (label: string) =>
  z.string().regex(ISO_DATE, `${label}: seleccione una fecha válida`)

const optionalDate = (label: string) =>
  z
    .string()
    .refine((value) => value === '' || ISO_DATE.test(value), `${label}: fecha no válida`)
    .transform((value) => (value === '' ? null : value))

const optionalUuid = z
  .string()
  .transform((value) => (value === '' ? null : value))
  .refine((value) => value === null || z.uuid().safeParse(value).success, 'Selección no válida')

const optionalEnum = <T extends string>(values: [T, ...T[]]) =>
  z
    .union([z.enum(values), z.literal('')])
    .transform((value) => (value === '' ? null : (value as T)))

const optionalNumber = (label: string, min: number, max: number) =>
  z
    .string()
    .trim()
    .transform((value) => (value === '' ? null : Number(value.replace(',', '.'))))
    .refine((value) => value === null || (Number.isFinite(value) && value >= min && value <= max), `${label}: valor entre ${min} y ${max}`)

const moneyString = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `${label}: requerido`)
    .transform((value) => Number(value.replace(/[^\d]/g, '')))
    .refine((value) => Number.isFinite(value) && value >= 0 && value <= 9_999_999_999, `${label}: valor no válido`)

const todayIso = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date())

/* ----------------------------------------------------------------------------
 * Áreas y cargos
 * ------------------------------------------------------------------------- */

export const areaFormSchema = z.object({
  name: requiredText(2, 120, 'Nombre'),
  code: optionalText(20, 'Código').transform((value) => (value ? value.toUpperCase() : null)),
  description: optionalText(500, 'Descripción'),
  isActive: z.boolean(),
})
export type AreaFormInput = z.input<typeof areaFormSchema>
export type AreaFormData = z.output<typeof areaFormSchema>

export const positionFormSchema = z.object({
  name: requiredText(2, 120, 'Nombre'),
  code: optionalText(20, 'Código').transform((value) => (value ? value.toUpperCase() : null)),
  areaId: optionalUuid,
  description: optionalText(500, 'Descripción'),
  arlRiskClass: optionalNumber('Clase de riesgo ARL', 1, 5),
  isActive: z.boolean(),
})
export type PositionFormInput = z.input<typeof positionFormSchema>
export type PositionFormData = z.output<typeof positionFormSchema>

/* ----------------------------------------------------------------------------
 * Empleado: datos personales (editables) y condiciones de ingreso
 * ------------------------------------------------------------------------- */

const personalShape = {
  documentType: z.enum(keysOf(DOCUMENT_ID_TYPE_LABELS)),
  documentNumber: z
    .string()
    .trim()
    .transform((value) => value.replace(/[\s.]/g, '').toUpperCase())
    .refine((value) => /^[A-Z0-9-]{3,20}$/.test(value), 'Número de documento: 3 a 20 letras o números'),
  firstName: requiredText(2, 80, 'Nombres'),
  lastName: requiredText(2, 80, 'Apellidos'),
  birthDate: optionalDate('Fecha de nacimiento'),
  email: optionalText(150, 'Correo').refine(
    (value) => value === null || z.email().safeParse(value).success,
    'Correo electrónico no válido'
  ),
  phone: optionalText(30, 'Teléfono'),
  address: optionalText(200, 'Dirección'),
  city: optionalText(80, 'Ciudad'),
  department: optionalText(80, 'Departamento'),
  emergencyContactName: optionalText(120, 'Contacto de emergencia'),
  emergencyContactPhone: optionalText(30, 'Teléfono de emergencia'),
  emergencyContactRelationship: optionalText(50, 'Parentesco'),
  eps: optionalText(100, 'EPS'),
  afp: optionalText(100, 'Fondo de pensiones'),
  arl: optionalText(100, 'ARL'),
  arlRiskClass: optionalNumber('Clase de riesgo ARL', 1, 5),
  ccf: optionalText(100, 'Caja de compensación'),
  severanceFund: optionalText(100, 'Fondo de cesantías'),
  bankName: optionalText(80, 'Banco'),
  bankAccountType: optionalEnum(keysOf(BANK_ACCOUNT_TYPE_LABELS)),
  userId: optionalUuid,
  dataConsentAt: requiredDate('Fecha de autorización').refine(
    (value) => value <= todayIso(),
    'La autorización no puede tener fecha futura'
  ),
  dataConsentVersion: requiredText(1, 40, 'Versión de la política'),
  notes: optionalText(1000, 'Observaciones'),
}

export const employeePersonalSchema = z.object(personalShape)
export type EmployeePersonalInput = z.input<typeof employeePersonalSchema>
export type EmployeePersonalData = z.output<typeof employeePersonalSchema>

const laborShape = {
  positionId: z.uuid('Seleccione el cargo'),
  areaId: optionalUuid,
  locationId: optionalUuid,
  managerEmployeeId: optionalUuid,
  contractType: z.enum(keysOf(CONTRACT_TYPE_LABELS)),
  contractEndDate: optionalDate('Fin del contrato'),
  salary: moneyString('Salario'),
  salaryType: z.enum(keysOf(SALARY_TYPE_LABELS)),
  workSchedule: z.enum(keysOf(WORK_SCHEDULE_LABELS)),
  weeklyHours: optionalNumber('Horas semanales', 1, 60),
}

export const employeeCreateSchema = z
  .object({
    ...personalShape,
    ...laborShape,
    hireDate: requiredDate('Fecha de ingreso'),
    dataConsentAccepted: z.boolean().refine((value) => value, 'Debe constar la autorización de tratamiento de datos'),
  })
  .superRefine((data, ctx) => {
    if (data.contractType === 'TERMINO_FIJO' && !data.contractEndDate) {
      ctx.addIssue({ code: 'custom', path: ['contractEndDate'], message: 'El contrato a término fijo requiere fecha de terminación' })
    }
    if (data.contractEndDate && data.contractEndDate < data.hireDate) {
      ctx.addIssue({ code: 'custom', path: ['contractEndDate'], message: 'La terminación no puede ser anterior al ingreso' })
    }
  })
export type EmployeeCreateInput = z.input<typeof employeeCreateSchema>
export type EmployeeCreateData = z.output<typeof employeeCreateSchema>

/* ----------------------------------------------------------------------------
 * Movimientos laborales
 * ------------------------------------------------------------------------- */

export const employmentChangeSchema = z
  .object({
    ...laborShape,
    effectiveDate: requiredDate('Fecha efectiva'),
    reason: requiredText(5, 1000, 'Motivo'),
  })
  .superRefine((data, ctx) => {
    if (data.contractType === 'TERMINO_FIJO' && !data.contractEndDate) {
      ctx.addIssue({ code: 'custom', path: ['contractEndDate'], message: 'El contrato a término fijo requiere fecha de terminación' })
    }
  })
export type EmploymentChangeInput = z.input<typeof employmentChangeSchema>
export type EmploymentChangeData = z.output<typeof employmentChangeSchema>

export const terminationSchema = z
  .object({
    terminationDate: requiredDate('Fecha de retiro').refine((value) => value <= todayIso(), 'El retiro no puede tener fecha futura'),
    cause: z.enum(keysOf(TERMINATION_CAUSE_LABELS)),
    reason: requiredText(10, 1000, 'Motivo del retiro'),
    compensateVacations: z.boolean(),
    compensationReason: z.string().trim().max(500, 'Motivo de compensación: máximo 500 caracteres'),
  })
  .superRefine((data, ctx) => {
    if (data.compensateVacations && data.compensationReason.length < 10) {
      ctx.addIssue({ code: 'custom', path: ['compensationReason'], message: 'Indique el motivo de la compensación (mínimo 10 caracteres)' })
    }
  })
export type TerminationInput = z.input<typeof terminationSchema>
export type TerminationData = z.output<typeof terminationSchema>

export const rehireSchema = z.object({
  hireDate: requiredDate('Fecha de reingreso'),
  reason: requiredText(5, 1000, 'Motivo'),
})
export type RehireInput = z.input<typeof rehireSchema>
export type RehireData = z.output<typeof rehireSchema>

export const bankAccountSchema = z.object({
  accountNumber: z
    .string()
    .trim()
    .transform((value) => value.replace(/[\s-]/g, ''))
    .refine((value) => /^\d{4,30}$/.test(value), 'Número de cuenta: entre 4 y 30 dígitos'),
})
export type BankAccountData = z.output<typeof bankAccountSchema>

/* ----------------------------------------------------------------------------
 * Documentos, novedades y vacaciones
 * ------------------------------------------------------------------------- */

export const documentUploadSchema = z
  .object({
    documentType: z.enum(keysOf(DOCUMENT_TYPE_LABELS)),
    name: requiredText(2, 150, 'Nombre del documento'),
    description: optionalText(500, 'Descripción'),
    issueDate: optionalDate('Fecha de expedición'),
    expiresAt: optionalDate('Fecha de vencimiento'),
    file: z
      .instanceof(File, { message: 'Seleccione un archivo' })
      .refine((file) => file.size > 0 && file.size <= HR_DOCUMENT_MAX_BYTES, 'El archivo debe pesar como máximo 5 MB')
      .refine(
        (file) => (HR_DOCUMENT_MIME_TYPES as readonly string[]).includes(file.type),
        'Formato no permitido: use PDF, JPG o PNG'
      ),
  })
  .superRefine((data, ctx) => {
    if (data.issueDate && data.expiresAt && data.expiresAt < data.issueDate) {
      ctx.addIssue({ code: 'custom', path: ['expiresAt'], message: 'El vencimiento no puede ser anterior a la expedición' })
    }
  })
export type DocumentUploadData = z.output<typeof documentUploadSchema>

export const noveltyFormSchema = z
  .object({
    employeeId: z.uuid('Seleccione el empleado'),
    noveltyType: z.enum(keysOf(NOVELTY_TYPE_LABELS)),
    startDate: requiredDate('Fecha inicial'),
    endDate: requiredDate('Fecha final'),
    byHours: z.boolean(),
    hours: optionalNumber('Horas', 0.5, 12),
    description: optionalText(500, 'Descripción'),
    supportDocumentId: optionalUuid,
  })
  .superRefine((data, ctx) => {
    if (data.endDate < data.startDate) {
      ctx.addIssue({ code: 'custom', path: ['endDate'], message: 'La fecha final no puede ser anterior a la inicial' })
    }
    if (data.byHours) {
      if (data.hours === null) {
        ctx.addIssue({ code: 'custom', path: ['hours'], message: 'Indique las horas del permiso' })
      }
      if (data.startDate !== data.endDate) {
        ctx.addIssue({ code: 'custom', path: ['endDate'], message: 'Un permiso por horas inicia y termina el mismo día' })
      }
    }
  })
export type NoveltyFormData = z.output<typeof noveltyFormSchema>

export const vacationRequestSchema = z
  .object({
    employeeId: z.uuid('Seleccione el empleado'),
    startDate: requiredDate('Fecha de inicio'),
    endDate: requiredDate('Fecha de fin'),
    notes: optionalText(500, 'Observaciones'),
  })
  .superRefine((data, ctx) => {
    if (data.endDate < data.startDate) {
      ctx.addIssue({ code: 'custom', path: ['endDate'], message: 'La fecha final no puede ser anterior a la inicial' })
    }
  })
export type VacationRequestData = z.output<typeof vacationRequestSchema>

export const reviewSchema = (approve: boolean) =>
  z.object({
    notes: approve
      ? optionalText(500, 'Observaciones')
      : requiredText(5, 500, 'Motivo del rechazo'),
  })

export const cancelReasonSchema = z.object({
  reason: requiredText(5, 500, 'Motivo'),
})

/** Convierte errores de Zod en un mapa campo → mensaje para los formularios. */
export function zodFieldErrors(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {}
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? 'form')
    if (!result[key]) result[key] = issue.message
  }
  return result
}
