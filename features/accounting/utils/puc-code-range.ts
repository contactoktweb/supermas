/**
 * SUPER MÁS ERP/POS - Orden y rangos de códigos PUC
 *
 * El PUC usa códigos jerárquicos por prefijo con un punto para los auxiliares:
 *   '1' (clase) → '11' (grupo) → '1105' (cuenta) → '110505' (subcuenta) → '110505.01' (auxiliar)
 *
 * Comparar los códigos como texto plano falla en dos casos:
 *   - '110505.9' quedaría después de '110505.10' (el segmento tras el punto es numérico).
 *   - Con colaciones de idioma (es_CO, en_US) PostgreSQL ignora el punto y mezcla niveles.
 *
 * Por eso se compara una CLAVE DE ORDEN normalizada (idéntica a public.fn_puc_code_sort_key,
 * migración 065):
 *   - El primer segmento (dígitos del PUC) se conserva tal cual: el prefijo más corto (padre)
 *     queda antes que sus hijos ('1105' < '110505' < '1110').
 *   - Cada segmento posterior al punto se rellena con ceros a la izquierda hasta 6 caracteres,
 *     así '110505.9' → '110505.000009' < '110505.000010'.
 *   - La comparación es por unidad de código (equivalente a COLLATE "C"), nunca localeCompare.
 *
 * Resultado: '1105' < '110505' < '110505.01' < '110505.02' < '110510' < '1110'.
 *
 * Rango [desde, hasta] (ambos opcionales, incluyentes):
 *   - clave(código) >= clave(desde)
 *   - clave(código) <= clave(hasta) + '~'  →  incluye 'hasta' y TODAS sus subcuentas y auxiliares
 *     ('~' es mayor que cualquier dígito o punto). Ej.: de 1105 a 1110 incluye 111005.01.
 */

/** Longitud a la que se normalizan los segmentos posteriores al punto. */
const AUXILIARY_SEGMENT_WIDTH = 6

/** Sufijo que hace que el límite superior incluya los descendientes de la cuenta final. */
const DESCENDANTS_UPPER_SUFFIX = '~'

/** Clave de orden de un código PUC (misma regla que public.fn_puc_code_sort_key). */
export function pucCodeSortKey(code: string | null | undefined): string {
  const clean = String(code ?? '').trim()
  if (!clean) return ''
  return clean
    .split('.')
    .map((segment, index) =>
      index === 0 || segment.length >= AUXILIARY_SEGMENT_WIDTH
        ? segment
        : segment.padStart(AUXILIARY_SEGMENT_WIDTH, '0')
    )
    .join('.')
}

/** Comparación por unidad de código (equivale a COLLATE "C"). */
function compareKeys(a: string, b: string): number {
  if (a === b) return 0
  return a < b ? -1 : 1
}

/** Ordena dos códigos PUC en el orden jerárquico del plan de cuentas. */
export function comparePucCodes(a: string, b: string): number {
  return compareKeys(pucCodeSortKey(a), pucCodeSortKey(b))
}

/** Límite superior (incluyente) del rango: la cuenta final y todos sus descendientes. */
export function pucRangeUpperKey(endCode: string): string {
  return `${pucCodeSortKey(endCode)}${DESCENDANTS_UPPER_SUFFIX}`
}

export interface PucCodeRange {
  from?: string | null
  to?: string | null
}

/** Normaliza un rango: vacío/'ALL' = sin límite; si viene invertido, se ordena. */
export function normalizePucRange(range?: PucCodeRange | null): { from: string; to: string } {
  const clean = (value?: string | null) => {
    const v = String(value ?? '').trim()
    return v && v.toUpperCase() !== 'ALL' ? v : ''
  }
  let from = clean(range?.from)
  let to = clean(range?.to)
  if (from && to && comparePucCodes(from, to) > 0 && !isPucDescendantOrSelf(from, to)) {
    ;[from, to] = [to, from]
  }
  return { from, to }
}

/** true si el rango no restringe nada. */
export function isPucRangeEmpty(range?: PucCodeRange | null): boolean {
  const { from, to } = normalizePucRange(range)
  return !from && !to
}

/** true si `code` es `ancestor` o una de sus subcuentas/auxiliares. */
export function isPucDescendantOrSelf(code: string, ancestor: string): boolean {
  const c = String(code ?? '').trim()
  const a = String(ancestor ?? '').trim()
  if (!c || !a) return false
  if (c === a) return true
  // '110505.1' no es padre de '110505.10': tras un punto solo cuenta el segmento completo.
  if (a.includes('.')) return c.startsWith(`${a}.`)
  return c.startsWith(a)
}

/** true si el código cae dentro del rango [from, to] (incluye los descendientes de `to`). */
export function isPucCodeInRange(code: string, range?: PucCodeRange | null): boolean {
  const { from, to } = normalizePucRange(range)
  if (!from && !to) return true
  const key = pucCodeSortKey(code)
  if (from && compareKeys(key, pucCodeSortKey(from)) < 0) return false
  if (to && compareKeys(key, pucRangeUpperKey(to)) > 0) return false
  return true
}

/** Texto del rango para encabezados de reportes: "Cuentas de 1105 a 1110". */
export function formatPucRangeLabel(range?: PucCodeRange | null): string {
  const { from, to } = normalizePucRange(range)
  if (!from && !to) return 'Todas las cuentas'
  if (from && to) return `Cuentas de ${from} a ${to}`
  if (from) return `Cuentas desde ${from}`
  return `Cuentas hasta ${to}`
}
