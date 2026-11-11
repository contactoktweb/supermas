import type { ProductImportIvaTreatment } from '../types/import.types'

const NUMBER_FORMAT = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 4 })

/** Número con coma decimal, igual a como se escribe en la plantilla. */
export const formatImportNumber = (value: number) => NUMBER_FORMAT.format(value)

export function formatImportIva(treatment: ProductImportIvaTreatment | null | undefined, ratePercent: number): string {
  if (treatment === 'EXENTO') return 'Exento'
  if (treatment === 'EXCLUIDO') return 'Excluido'
  if (treatment === 'GRAVADO') return `Gravado ${formatImportNumber(ratePercent)} %`
  return 'Sin clasificar'
}
