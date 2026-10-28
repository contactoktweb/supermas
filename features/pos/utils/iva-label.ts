/**
 * Etiqueta del IVA según las tarifas reales de las líneas:
 * "IVA 19%", "IVA 5% y 19%" o "IVA (productos exentos)" si ninguna línea lo causa.
 */
export function ivaLabel(lines: { taxRatePercent: number }[]): string {
  const rates = [...new Set(lines.map((l) => Number(l.taxRatePercent) || 0).filter((r) => r > 0))].sort((a, b) => a - b)
  if (rates.length === 0) return lines.length ? 'IVA (productos exentos)' : 'IVA'
  const text = rates.map((r) => `${r}%`)
  return `IVA ${text.length > 1 ? `${text.slice(0, -1).join(', ')} y ${text.at(-1)}` : text[0]}`
}
