/**
 * Cuentas auxiliares del PUC (último nivel, sin subcuentas) usadas por las líneas de inventario.
 *
 * Mismas reglas que valida la base (migración 062): el producto y el mapa de cuentas por línea de
 * inventario solo admiten auxiliares activas. Funciona con códigos con punto ('143501.01').
 */

export interface PucAccountRow {
  id: string
  code: string
  name: string
  parent_id: string | null
  is_active: boolean
}

export interface PostingAccountOption {
  id: string
  code: string
  name: string
  /** Cuenta PUC de 4 dígitos a la que pertenece (p. ej. '1435'). */
  groupCode: string
  groupName: string
}

/** Inventarios de producción: su costo puede ir a las clases 71/72/73 (regla PUC multiclase del proyecto). */
const PRODUCTION_INVENTORY_GROUPS = ['1405', '1410', '1430']
const PRODUCTION_COST_CLASSES = ['71', '72', '73']

export function isInventoryAccountCode(code: string): boolean {
  return code.startsWith('14')
}

/** Ingreso operacional por ventas (41), excluida la cuenta de devoluciones 4175 (naturaleza débito). */
export function isSalesIncomeAccountCode(code: string): boolean {
  return code.startsWith('41') && !code.startsWith('4175')
}

/** Costo de ventas (61); 71/72/73 solo para inventarios de producción. */
export function isCostAccountCodeFor(inventoryCode: string, costCode: string): boolean {
  if (costCode.startsWith('61')) return true
  return (
    PRODUCTION_COST_CLASSES.includes(costCode.slice(0, 2)) &&
    PRODUCTION_INVENTORY_GROUPS.includes(inventoryCode.slice(0, 4))
  )
}

export function isAnyCostAccountCode(code: string): boolean {
  return code.startsWith('61') || PRODUCTION_COST_CLASSES.includes(code.slice(0, 2))
}

/**
 * Auxiliares activas que cumplen el filtro, ordenadas por código (quedan agrupadas por cuenta).
 * `rows` debe incluir también las cuentas inactivas: una cuenta con subcuentas inactivas sigue
 * siendo de grupo y la base la rechaza.
 */
export function selectPostingAccounts(
  rows: PucAccountRow[],
  matches: (code: string) => boolean
): PostingAccountOption[] {
  const parentIds = new Set(rows.map((row) => row.parent_id).filter(Boolean) as string[])
  const namesByCode = new Map(rows.map((row) => [row.code, row.name]))

  return rows
    .filter((row) => row.is_active && typeof row.code === 'string' && matches(row.code) && !parentIds.has(row.id))
    .sort((a, b) => a.code.localeCompare(b.code))
    .map((row) => {
      const groupCode = row.code.slice(0, 4)
      return {
        id: row.id,
        code: row.code,
        name: row.name,
        groupCode,
        groupName: namesByCode.get(groupCode) || '',
      }
    })
}
