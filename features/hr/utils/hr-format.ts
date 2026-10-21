/**
 * Formatos de presentación del módulo de Recursos Humanos (zona horaria America/Bogota).
 */

const BOGOTA_TIME_ZONE = 'America/Bogota'

/** Fecha de hoy en Colombia como YYYY-MM-DD. */
export function todayIso(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: BOGOTA_TIME_ZONE }).format(new Date())
}

/** Suma días a una fecha ISO (YYYY-MM-DD) sin depender de la zona horaria del navegador. */
export function addDaysIso(iso: string, days: number): string {
  const [year, month, day] = iso.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day + days))
  return date.toISOString().slice(0, 10)
}

export function firstDayOfMonthIso(iso: string = todayIso()): string {
  return `${iso.slice(0, 7)}-01`
}

/** Días calendario entre dos fechas ISO (b - a). */
export function diffDaysIso(a: string, b: string): number {
  const toUtc = (iso: string) => {
    const [y, m, d] = iso.split('-').map(Number)
    return Date.UTC(y, m - 1, d)
  }
  return Math.round((toUtc(b) - toUtc(a)) / 86_400_000)
}

/** 2026-10-21 → 21/10/2026 */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const [year, month, day] = iso.slice(0, 10).split('-')
  if (!year || !month || !day) return '—'
  return `${day}/${month}/${year}`
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—'
  return new Date(value).toLocaleString('es-CO', {
    timeZone: BOGOTA_TIME_ZONE,
    dateStyle: 'short',
    timeStyle: 'short',
  })
}

export function formatCOP(value: number | null | undefined): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(Number(value ?? 0))
}

export function formatDays(value: number | null | undefined): string {
  const days = Number(value ?? 0)
  const text = Number.isInteger(days) ? String(days) : days.toFixed(2).replace('.', ',')
  return `${text} ${Math.abs(days) === 1 ? 'día' : 'días'}`
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`
}

/** Años y meses de antigüedad entre dos fechas ISO. */
export function formatSeniority(fromIso: string, toIso: string = todayIso()): string {
  const [fy, fm, fd] = fromIso.split('-').map(Number)
  const [ty, tm, td] = toIso.split('-').map(Number)
  let months = (ty - fy) * 12 + (tm - fm)
  if (td < fd) months -= 1
  if (months < 0) return 'Ingreso futuro'
  const years = Math.floor(months / 12)
  const rest = months % 12
  const parts: string[] = []
  if (years > 0) parts.push(`${years} ${years === 1 ? 'año' : 'años'}`)
  if (rest > 0 || years === 0) parts.push(`${rest} ${rest === 1 ? 'mes' : 'meses'}`)
  return parts.join(' y ')
}

export function initials(fullName: string): string {
  return fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}
