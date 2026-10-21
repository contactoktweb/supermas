/**
 * SUPER MÁS ERP/POS - Formatos comunes de los reportes contables
 * (fechas en America/Bogota, pesos colombianos y datos de la empresa).
 */

const BOGOTA_TIME_ZONE = 'America/Bogota'

const COP_FORMATTER = new Intl.NumberFormat('es-CO', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/** Fecha de hoy (YYYY-MM-DD) en America/Bogota. */
export function todayBogotaIsoDate(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: BOGOTA_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

/** 'YYYY-MM-DD' → 'DD/MM/YYYY' (sin conversión de zona: es una fecha contable). */
export function formatIsoDateEs(isoDate?: string | null): string {
  const value = String(isoDate || '').slice(0, 10)
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value
}

/** Fecha y hora actual en America/Bogota, p. ej. "21/10/2026, 3:45:12 p. m.". */
export function formatNowBogota(): string {
  return new Date().toLocaleString('es-CO', { timeZone: BOGOTA_TIME_ZONE })
}

/** Importe en pesos colombianos: $ 1.234.567,89 (negativos entre paréntesis, como en los estados financieros). */
export function formatCop(value: number): string {
  const amount = Number(value) || 0
  const formatted = COP_FORMATTER.format(Math.abs(amount))
  return amount < 0 && Math.abs(amount) >= 0.005 ? `($ ${formatted})` : `$ ${formatted}`
}

/** Número con separadores colombianos sin símbolo: 1.234.567,89. */
export function formatAmount(value: number): string {
  const amount = Number(value) || 0
  return Math.abs(amount) < 0.005 ? '0,00' : COP_FORMATTER.format(amount)
}

/** NIT con dígito de verificación: 901234567-1 (vacío si la empresa no lo tiene registrado). */
export function formatCompanyNit(taxId?: string | null, verificationDigit?: string | null): string {
  const nit = String(taxId || '').trim()
  if (!nit) return ''
  const dv = String(verificationDigit ?? '').trim()
  return dv ? `${nit}-${dv}` : nit
}

const TAX_REGIME_LABELS: Record<string, string> = {
  RESPONSABLE_DE_IVA: 'Responsable de IVA',
  NO_RESPONSABLE_DE_IVA: 'No responsable de IVA',
  REGIMEN_SIMPLE: 'Régimen Simple de Tributación',
  REGIMEN_ORDINARIO: 'Régimen ordinario',
  GRAN_CONTRIBUYENTE: 'Gran contribuyente',
}

/** Etiqueta legible del régimen tributario guardado en companies.tax_regime. */
export function taxRegimeLabel(regime?: string | null): string {
  const value = String(regime || '').trim()
  if (!value) return ''
  return TAX_REGIME_LABELS[value] || value.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase())
}
