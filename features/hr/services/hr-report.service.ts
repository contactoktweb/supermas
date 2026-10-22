/**
 * Reportes de personal y exportación de datos para nómina. El ERP no liquida nómina:
 * se entregan los datos (salario, seguridad social, novedades y vacaciones del periodo)
 * listos para el proceso externo.
 */
import { hrEmployeeRepository } from '../repositories/hr-employee.repository'
import { hrAbsenceRepository } from '../repositories/hr-absence.repository'
import {
  BANK_ACCOUNT_TYPE_LABELS,
  CONTRACT_TYPE_LABELS,
  EMPLOYEE_STATUS_LABELS,
  EVENT_TYPE_LABELS,
  NOVELTY_TYPE_LABELS,
  SALARY_TYPE_LABELS,
  TERMINATION_CAUSE_LABELS,
  VACATION_ALERT_LABELS,
  WORK_SCHEDULE_LABELS,
} from '../constants'
import { addDaysIso, diffDaysIso, formatDate, formatSeniority, todayIso } from '../utils/hr-format'
import type { ExportTable } from '../utils/hr-export'
import type { Novelty, NoveltyType, VacationRequest } from '../types'

export type HrReportKind = 'PLANTA' | 'MOVIMIENTOS' | 'AUSENTISMO' | 'VACACIONES' | 'NOMINA'

export interface HrReportParams {
  from: string
  to: string
  includeSensitive: boolean
}

export interface HrReportResult {
  table: ExportTable
  summary: { label: string; value: string }[]
}

const overlapDays = (start: string, end: string, from: string, to: string): [string, string] | null => {
  const s = start > from ? start : from
  const e = end < to ? end : to
  return s <= e ? [s, e] : null
}

const businessDaysBetween = (start: string, end: string, holidays: Set<string>): number => {
  let count = 0
  for (let day = start; day <= end; day = addDaysIso(day, 1)) {
    const weekday = new Date(`${day}T12:00:00Z`).getUTCDay()
    if (weekday !== 0 && !holidays.has(day)) count += 1
  }
  return count
}

export class HrReportService {
  /** Registra la exportación en auditoría antes de entregar el archivo. */
  logExport(kind: HrReportKind, rows: number, includesSensitive: boolean): Promise<void> {
    return hrAbsenceRepository.logExport(kind, rows, includesSensitive)
  }

  async build(kind: HrReportKind, params: HrReportParams): Promise<HrReportResult> {
    switch (kind) {
      case 'PLANTA':
        return this.headcount()
      case 'MOVIMIENTOS':
        return this.movements(params)
      case 'AUSENTISMO':
        return this.absenteeism(params)
      case 'VACACIONES':
        return this.pendingVacations()
      case 'NOMINA':
        return this.payroll(params)
    }
  }

  private async headcount(): Promise<HrReportResult> {
    const employees = await hrEmployeeRepository.listDetailed(false)
    const today = todayIso()
    return {
      table: {
        title: 'Planta de personal',
        columns: ['Código', 'Tipo doc.', 'Documento', 'Nombre', 'Cargo', 'Área', 'Sede', 'Contrato', 'Jornada', 'Ingreso', 'Antigüedad', 'Estado'],
        rows: employees.map((e) => [
          e.employeeCode,
          e.documentType,
          e.documentNumber,
          e.fullName,
          e.positionName,
          e.areaName,
          e.locationName,
          CONTRACT_TYPE_LABELS[e.contractType],
          WORK_SCHEDULE_LABELS[e.workSchedule],
          formatDate(e.hireDate),
          formatSeniority(e.hireDate, today),
          EMPLOYEE_STATUS_LABELS[e.status],
        ]),
      },
      summary: [
        { label: 'Empleados vigentes', value: String(employees.length) },
        { label: 'En vacaciones', value: String(employees.filter((e) => e.status === 'EN_VACACIONES').length) },
        { label: 'Incapacitados', value: String(employees.filter((e) => e.status === 'INCAPACITADO').length) },
      ],
    }
  }

  private async movements({ from, to }: HrReportParams): Promise<HrReportResult> {
    const events = await hrEmployeeRepository.listEventsInRange(from, to)
    const hires = events.filter((e) => e.eventType !== 'RETIRO').length
    const exits = events.length - hires
    return {
      table: {
        title: 'Ingresos y retiros',
        columns: ['Fecha', 'Movimiento', 'Código', 'Empleado', 'Causa de retiro', 'Motivo', 'Registrado por'],
        rows: events.map((e) => [
          formatDate(e.effectiveDate),
          EVENT_TYPE_LABELS[e.eventType],
          e.employeeCode,
          e.employeeName,
          e.terminationCause ? TERMINATION_CAUSE_LABELS[e.terminationCause] : '',
          e.reason,
          e.createdByName,
        ]),
      },
      summary: [
        { label: 'Ingresos y reingresos', value: String(hires) },
        { label: 'Retiros', value: String(exits) },
        { label: 'Variación neta', value: String(hires - exits) },
      ],
    }
  }

  private async approvedNovelties(from: string, to: string): Promise<Novelty[]> {
    return hrAbsenceRepository.listNovelties({ query: '', status: 'APROBADA', noveltyType: 'ALL', from, to })
  }

  private async absenteeism({ from, to }: HrReportParams): Promise<HrReportResult> {
    const novelties = await this.approvedNovelties(from, to)
    const daysByType = new Map<NoveltyType, number>()
    const rows = novelties.map((n) => {
      const range = overlapDays(n.startDate, n.endDate, from, to)
      const daysInRange = n.hours !== null || !range ? 0 : diffDaysIso(range[0], range[1]) + 1
      daysByType.set(n.noveltyType, (daysByType.get(n.noveltyType) ?? 0) + daysInRange)
      return [
        n.employeeCode,
        n.employeeName,
        NOVELTY_TYPE_LABELS[n.noveltyType],
        formatDate(n.startDate),
        formatDate(n.endDate),
        n.calendarDays,
        daysInRange,
        n.hours,
        n.isPaid ? 'Sí' : 'No',
      ]
    })
    const totalDays = Array.from(daysByType.values()).reduce((sum, days) => sum + days, 0)
    const topType = Array.from(daysByType.entries()).sort((a, b) => b[1] - a[1])[0]
    return {
      table: {
        title: 'Ausentismo',
        columns: ['Código', 'Empleado', 'Novedad', 'Inicio', 'Fin', 'Días calendario', 'Días en el rango', 'Horas', 'Remunerada'],
        rows,
      },
      summary: [
        { label: 'Novedades aprobadas', value: String(novelties.length) },
        { label: 'Días de ausencia en el rango', value: String(totalDays) },
        { label: 'Principal causa', value: topType ? NOVELTY_TYPE_LABELS[topType[0]] : 'Sin ausencias' },
      ],
    }
  }

  private async pendingVacations(): Promise<HrReportResult> {
    const alerts = await hrAbsenceRepository.listVacationAlerts()
    const pending = alerts
      .filter((a) => a.alertLevel !== 'AL_DIA' || a.availableDays > 0)
      .sort((a, b) => b.pendingPeriods - a.pendingPeriods || b.availableDays - a.availableDays)
    return {
      table: {
        title: 'Vacaciones pendientes',
        columns: ['Código', 'Empleado', 'Periodos vencidos', 'Días de periodos vencidos', 'Saldo total (días hábiles)', 'Periodo vencido más antiguo', 'Próximo periodo completo', 'Alerta'],
        rows: pending.map((a) => [
          a.employeeCode,
          a.fullName,
          a.pendingPeriods,
          a.pendingDays,
          a.availableDays,
          formatDate(a.oldestPendingPeriodEnd),
          formatDate(a.currentPeriodEnd),
          VACATION_ALERT_LABELS[a.alertLevel],
        ]),
      },
      summary: [
        { label: 'Con periodo vencido', value: String(alerts.filter((a) => a.alertLevel !== 'AL_DIA').length) },
        { label: 'Críticas', value: String(alerts.filter((a) => a.alertLevel === 'CRITICA').length) },
        { label: 'Días pendientes totales', value: alerts.reduce((sum, a) => sum + a.availableDays, 0).toFixed(2).replace('.', ',') },
      ],
    }
  }

  private async payroll({ from, to, includeSensitive }: HrReportParams): Promise<HrReportResult> {
    const [employees, novelties, vacations, holidays, accounts] = await Promise.all([
      hrEmployeeRepository.listDetailed(true),
      this.approvedNovelties(from, to),
      hrAbsenceRepository.listVacationRequests({ from, to }),
      hrAbsenceRepository.listHolidays(from, to),
      includeSensitive ? hrEmployeeRepository.listBankAccounts() : Promise.resolve(new Map<string, string>()),
    ])

    // Empleados con vínculo en el periodo: ingresaron antes del fin y no se retiraron antes del inicio
    const inPeriod = employees.filter((e) => e.hireDate <= to && (!e.terminationDate || e.terminationDate >= from))

    const noveltyDays = (employeeId: string, predicate: (n: Novelty) => boolean) =>
      novelties
        .filter((n) => n.employeeId === employeeId && n.hours === null && predicate(n))
        .reduce((sum, n) => {
          const range = overlapDays(n.startDate, n.endDate, from, to)
          return sum + (range ? diffDaysIso(range[0], range[1]) + 1 : 0)
        }, 0)

    const noveltyHours = (employeeId: string) =>
      novelties.filter((n) => n.employeeId === employeeId && n.hours !== null).reduce((sum, n) => sum + (n.hours ?? 0), 0)

    const vacationDays = (employeeId: string, list: VacationRequest[]) =>
      list
        .filter((v) => v.employeeId === employeeId && (v.status === 'APROBADA' || v.status === 'DISFRUTADA'))
        .reduce((sum, v) => {
          const range = overlapDays(v.startDate, v.endDate, from, to)
          return sum + (range ? businessDaysBetween(range[0], range[1], holidays) : 0)
        }, 0)

    const isIncapacity = (n: Novelty) => n.noveltyType === 'INCAPACIDAD_GENERAL' || n.noveltyType === 'INCAPACIDAD_LABORAL'
    const isLicense = (n: Novelty) => n.noveltyType.startsWith('LICENCIA_') || n.noveltyType === 'CALAMIDAD_DOMESTICA'

    return {
      table: {
        title: 'Datos para nómina',
        columns: [
          'Código', 'Tipo doc.', 'Documento', 'Nombre', 'Cargo', 'Área', 'Sede', 'Contrato', 'Jornada',
          'Tipo de salario', 'Salario', 'Ingreso', 'Retiro', 'Causa de retiro', 'EPS', 'Fondo de pensiones', 'ARL',
          'Clase de riesgo', 'Caja de compensación', 'Fondo de cesantías', 'Banco', 'Tipo de cuenta', 'Cuenta',
          'Días incapacidad', 'Días licencia', 'Días no remunerados', 'Días permiso remunerado', 'Horas de permiso',
          'Días hábiles de vacaciones',
        ],
        rows: inPeriod.map((e) => [
          e.employeeCode,
          e.documentType,
          e.documentNumber,
          e.fullName,
          e.positionName,
          e.areaName,
          e.locationName,
          CONTRACT_TYPE_LABELS[e.contractType],
          WORK_SCHEDULE_LABELS[e.workSchedule],
          SALARY_TYPE_LABELS[e.salaryType],
          e.salary,
          formatDate(e.hireDate),
          e.terminationDate && e.terminationDate <= to ? formatDate(e.terminationDate) : '',
          e.terminationCause && e.terminationDate && e.terminationDate <= to ? TERMINATION_CAUSE_LABELS[e.terminationCause] : '',
          e.eps,
          e.afp,
          e.arl,
          e.arlRiskClass,
          e.ccf,
          e.severanceFund,
          e.bankName,
          e.bankAccountType ? BANK_ACCOUNT_TYPE_LABELS[e.bankAccountType] : '',
          includeSensitive ? (accounts.get(e.id) ?? '') : (e.bankAccountMasked ?? ''),
          noveltyDays(e.id, isIncapacity),
          noveltyDays(e.id, isLicense),
          noveltyDays(e.id, (n) => !n.isPaid),
          noveltyDays(e.id, (n) => n.noveltyType === 'PERMISO_REMUNERADO'),
          noveltyHours(e.id),
          vacationDays(e.id, vacations),
        ]),
      },
      summary: [
        { label: 'Empleados en el periodo', value: String(inPeriod.length) },
        { label: 'Novedades aprobadas', value: String(novelties.length) },
        { label: 'Periodo', value: `${formatDate(from)} a ${formatDate(to)}` },
      ],
    }
  }
}

export const hrReportService = new HrReportService()
