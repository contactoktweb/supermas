/**
 * SUPER MÁS ERP/POS - Árbol del PUC con saldos por nivel
 *
 * Arma Clase → Grupo → Cuenta → Subcuenta → Auxiliar a partir del catálogo (parent_id; si falta,
 * el ancestro más cercano por prefijo de código) y de los débitos/créditos por cuenta que entrega
 * la base (fn_accounting_account_balances / fn_accounting_account_balances_range).
 *
 * Saldo de cada nodo = débitos y créditos de TODO su subárbol expresados según la naturaleza del
 * propio nodo (DEBIT = débitos − créditos; CREDIT = créditos − débitos). Así una cuenta correctora
 * (p. ej. 1592 depreciación acumulada, naturaleza crédito) resta dentro de la clase 1.
 */

import type {
  AccountingAccount,
  AccountLevel,
  AccountMovementTotalsMap,
  AccountNature,
  FinancialStatementNode,
} from '../types'
import {
  comparePucCodes,
  isPucCodeInRange,
  isPucDescendantOrSelf,
  isPucRangeEmpty,
  PucCodeRange,
} from './puc-code-range'

export const ACCOUNT_LEVEL_NUMBER: Record<AccountLevel, number> = {
  CLASS: 1,
  GROUP: 2,
  ACCOUNT: 3,
  SUBACCOUNT: 4,
  AUXILIARY: 5,
}

/** Clases del PUC comercial (Decreto 2650 de 1993) con su naturaleza. */
export const PUC_CLASSES: Record<number, { name: string; nature: AccountNature }> = {
  1: { name: 'Activo', nature: 'DEBIT' },
  2: { name: 'Pasivo', nature: 'CREDIT' },
  3: { name: 'Patrimonio', nature: 'CREDIT' },
  4: { name: 'Ingresos', nature: 'CREDIT' },
  5: { name: 'Gastos', nature: 'DEBIT' },
  6: { name: 'Costos de ventas', nature: 'DEBIT' },
  7: { name: 'Costos de producción o de operación', nature: 'DEBIT' },
}

/** Diferencia por debajo de la cual un importe en pesos se considera cero (redondeo a centavos). */
export const CURRENCY_EPSILON = 0.005

export function roundCurrency(value: number): number {
  return Math.round((Number(value) || 0) * 100) / 100
}

export function balanceByNature(nature: AccountNature, debit: number, credit: number): number {
  return nature === 'DEBIT' ? debit - credit : credit - debit
}

export function isZeroAmount(value: number): boolean {
  return Math.abs(value) < CURRENCY_EPSILON
}

/** Clase de una cuenta (columna account_class o, si falta, el primer dígito del código). */
export function accountClassOf(account: Pick<AccountingAccount, 'accountClass' | 'code'>): number {
  const fromColumn = Number(account.accountClass)
  if (fromColumn >= 1 && fromColumn <= 9) return fromColumn
  return Number(String(account.code).charAt(0)) || 0
}

export interface BuildAccountTreeOptions {
  /** Clases a incluir (por defecto 1 a 7). */
  classes?: number[]
  /** Rango de códigos: los importes fuera del rango no se suman; los ancestros se conservan como agrupadores. */
  range?: PucCodeRange
  /** Totales previos al periodo (saldo anterior). Opcional. */
  openingTotals?: AccountMovementTotalsMap
}

interface MutableNode extends FinancialStatementNode {
  ownDebit: number
  ownCredit: number
  ownOpeningDebit: number
  ownOpeningCredit: number
  openingDebit: number
  openingCredit: number
  inRange: boolean
}

function createNode(
  account: Pick<AccountingAccount, 'id' | 'code' | 'name' | 'level' | 'nature'>,
  accountClass: number,
  isSynthetic: boolean
): MutableNode {
  return {
    id: account.id,
    code: account.code,
    name: account.name,
    level: account.level,
    levelNumber: ACCOUNT_LEVEL_NUMBER[account.level] || 5,
    accountClass,
    nature: account.nature,
    openingBalance: 0,
    debit: 0,
    credit: 0,
    balance: 0,
    isSynthetic,
    children: [],
    ownDebit: 0,
    ownCredit: 0,
    ownOpeningDebit: 0,
    ownOpeningCredit: 0,
    openingDebit: 0,
    openingCredit: 0,
    inRange: true,
  }
}

/** Ancestro más cercano por código cuando parent_id no existe o apunta fuera del catálogo. */
function findAncestorByCode(code: string, nodesByCode: Map<string, MutableNode>): MutableNode | null {
  const dotIndex = code.lastIndexOf('.')
  if (dotIndex > 0) {
    const base = code.slice(0, dotIndex)
    return nodesByCode.get(base) || findAncestorByCode(base, nodesByCode)
  }
  for (let length = code.length - 1; length >= 1; length--) {
    const candidate = nodesByCode.get(code.slice(0, length))
    if (candidate) return candidate
  }
  return null
}

/** Suma el subárbol (post-orden), descarta ramas fuera de rango y fija el saldo según naturaleza. */
function aggregate(node: MutableNode, rangeActive: boolean): MutableNode | null {
  const keptChildren: MutableNode[] = []
  for (const child of node.children as MutableNode[]) {
    const kept = aggregate(child, rangeActive)
    if (kept) keptChildren.push(kept)
  }
  keptChildren.sort((a, b) => comparePucCodes(a.code, b.code))

  if (rangeActive && !node.inRange && keptChildren.length === 0) return null

  const countOwn = !rangeActive || node.inRange
  node.debit = (countOwn ? node.ownDebit : 0) + keptChildren.reduce((sum, c) => sum + c.debit, 0)
  node.credit = (countOwn ? node.ownCredit : 0) + keptChildren.reduce((sum, c) => sum + c.credit, 0)
  node.openingDebit = (countOwn ? node.ownOpeningDebit : 0) + keptChildren.reduce((sum, c) => sum + c.openingDebit, 0)
  node.openingCredit =
    (countOwn ? node.ownOpeningCredit : 0) + keptChildren.reduce((sum, c) => sum + c.openingCredit, 0)

  node.openingBalance = roundCurrency(balanceByNature(node.nature, node.openingDebit, node.openingCredit))
  node.balance = roundCurrency(
    balanceByNature(node.nature, node.openingDebit + node.debit, node.openingCredit + node.credit)
  )
  node.children = keptChildren
  return node
}

/** Copia limpia (sin campos internos) para entregar a la UI y a los reportes. */
function toPublicNode(node: MutableNode): FinancialStatementNode {
  return {
    id: node.id,
    code: node.code,
    name: node.name,
    level: node.level,
    levelNumber: node.levelNumber,
    accountClass: node.accountClass,
    nature: node.nature,
    openingBalance: node.openingBalance,
    debit: roundCurrency(node.debit),
    credit: roundCurrency(node.credit),
    balance: node.balance,
    isSynthetic: node.isSynthetic,
    children: (node.children as MutableNode[]).map(toPublicNode),
  }
}

/**
 * Árbol de saldos por clase (una raíz por clase incluida, ordenadas por código).
 * `totals` son los movimientos del periodo por id de cuenta; `openingTotals` (opcional) el saldo anterior.
 */
export function buildAccountTree(
  accounts: AccountingAccount[],
  totals: AccountMovementTotalsMap,
  options: BuildAccountTreeOptions = {}
): FinancialStatementNode[] {
  const classes = new Set(options.classes ?? [1, 2, 3, 4, 5, 6, 7])
  const rangeActive = !isPucRangeEmpty(options.range)

  const scoped = accounts
    .filter((account) => classes.has(accountClassOf(account)) && String(account.code || '').trim())
    .sort((a, b) => comparePucCodes(a.code, b.code))

  const nodesById = new Map<string, MutableNode>()
  const nodesByCode = new Map<string, MutableNode>()
  for (const account of scoped) {
    const node = createNode(account, accountClassOf(account), false)
    const own = totals.get(account.id)
    const opening = options.openingTotals?.get(account.id)
    node.ownDebit = Number(own?.debit) || 0
    node.ownCredit = Number(own?.credit) || 0
    node.ownOpeningDebit = Number(opening?.debit) || 0
    node.ownOpeningCredit = Number(opening?.credit) || 0
    node.inRange = isPucCodeInRange(account.code, options.range)
    nodesById.set(account.id, node)
    nodesByCode.set(account.code, node)
  }

  // Raíces por clase: la cuenta de nivel 1 del catálogo o, si no existe, un agrupador sintético.
  const roots = new Map<number, MutableNode>()
  const rootFor = (accountClass: number): MutableNode => {
    const existing = roots.get(accountClass)
    if (existing) return existing
    const classInfo = PUC_CLASSES[accountClass] || { name: `Clase ${accountClass}`, nature: 'DEBIT' as AccountNature }
    const synthetic = createNode(
      {
        id: `class-${accountClass}`,
        code: String(accountClass),
        name: classInfo.name,
        level: 'CLASS',
        nature: classInfo.nature,
      },
      accountClass,
      true
    )
    synthetic.inRange = isPucCodeInRange(synthetic.code, options.range)
    roots.set(accountClass, synthetic)
    return synthetic
  }

  for (const node of nodesById.values()) {
    if (node.code.length === 1) {
      if (!roots.has(node.accountClass)) roots.set(node.accountClass, node)
    }
  }

  for (const account of scoped) {
    const node = nodesById.get(account.id)!
    if (roots.get(node.accountClass) === node) continue
    // parent_id solo se acepta si es un ancestro real por código (evita ciclos o padres mal cargados).
    const byParentId = account.parentId ? nodesById.get(account.parentId) : undefined
    const validParent =
      byParentId && byParentId !== node && byParentId.code !== node.code && isPucDescendantOrSelf(node.code, byParentId.code)
        ? byParentId
        : null
    const parent = validParent || findAncestorByCode(account.code, nodesByCode) || rootFor(node.accountClass)
    parent.children.push(node)
  }

  return Array.from(roots.values())
    .sort((a, b) => comparePucCodes(a.code, b.code))
    .map((root) => aggregate(root, rangeActive))
    .filter((root): root is MutableNode => Boolean(root))
    .map(toPublicNode)
}

/** true si el nodo o algún descendiente tiene saldo anterior, movimientos o saldo final distinto de cero. */
export function nodeHasActivity(node: FinancialStatementNode): boolean {
  return (
    !isZeroAmount(node.balance) ||
    !isZeroAmount(node.openingBalance) ||
    !isZeroAmount(node.debit) ||
    !isZeroAmount(node.credit) ||
    node.children.some(nodeHasActivity)
  )
}

/** Quita del árbol los nodos sin saldo ni movimiento (opción "ocultar cuentas en cero"). */
export function pruneZeroNodes(nodes: FinancialStatementNode[]): FinancialStatementNode[] {
  return nodes
    .filter(nodeHasActivity)
    .map((node) => ({ ...node, children: pruneZeroNodes(node.children) }))
}

export interface FlatAccountRow {
  node: FinancialStatementNode
  /** Profundidad en el árbol (0 = clase); se usa para la sangría. */
  depth: number
}

/** Recorre el árbol en orden PUC hasta `maxLevelNumber` (1 = solo clases … 5 = auxiliares). */
export function flattenAccountTree(nodes: FinancialStatementNode[], maxLevelNumber = 5, depth = 0): FlatAccountRow[] {
  const rows: FlatAccountRow[] = []
  for (const node of nodes) {
    if (node.levelNumber > maxLevelNumber) continue
    rows.push({ node, depth })
    rows.push(...flattenAccountTree(node.children, maxLevelNumber, depth + 1))
  }
  return rows
}

/** Nombre del nivel para encabezados y columnas. */
export const ACCOUNT_LEVEL_LABEL: Record<AccountLevel, string> = {
  CLASS: 'Clase',
  GROUP: 'Grupo',
  ACCOUNT: 'Cuenta',
  SUBACCOUNT: 'Subcuenta',
  AUXILIARY: 'Auxiliar',
}
