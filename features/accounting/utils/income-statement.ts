/**
 * SUPER MÁS ERP/POS - Estructura del Estado de Resultados compartida por la pestaña, el PDF y
 * la exportación a Excel/CSV (mismas secciones y mismos renglones de utilidad en los tres).
 */

import type { FinancialStatementNode, IncomeStatementReport } from '../types'
import { isZeroAmount } from './account-tree'

export type IncomeStatementSectionKey = 'revenues' | 'costOfSales' | 'productionCosts' | 'expenses'

export interface IncomeStatementSection {
  key: IncomeStatementSectionKey
  title: string
  totalLabel: string
  node: FinancialStatementNode | null
  total: number
}

/** Árboles por clase en el orden del estado: ingresos, costos y gastos. */
export function incomeStatementSections(report: IncomeStatementReport): IncomeStatementSection[] {
  const productionCostsTotal = report.productionCosts?.balance ?? 0
  const sections: IncomeStatementSection[] = [
    {
      key: 'revenues',
      title: '4. Ingresos',
      totalLabel: 'Total ingresos',
      node: report.revenues,
      total: report.totalRevenues,
    },
    {
      key: 'costOfSales',
      title: '6. Costos de ventas',
      totalLabel: 'Total costos de ventas',
      node: report.costOfSales,
      total: report.costOfSales?.balance ?? 0,
    },
    {
      key: 'productionCosts',
      title: '7. Costos de producción o de operación',
      totalLabel: 'Total costos de producción',
      node: report.productionCosts,
      total: productionCostsTotal,
    },
    {
      key: 'expenses',
      title: '5. Gastos',
      totalLabel: 'Total gastos',
      node: report.expenses,
      total: report.totalExpenses,
    },
  ]
  // La clase 7 solo aparece si la empresa la usa (comercializadora: normalmente vacía).
  return sections.filter((section) => section.key !== 'productionCosts' || !isZeroAmount(productionCostsTotal))
}

export type IncomeStatementLineKind = 'line' | 'subtotal' | 'total'

export interface IncomeStatementLine {
  key: string
  label: string
  /** Importe con signo de presentación: los conceptos que restan van negativos. */
  amount: number
  kind: IncomeStatementLineKind
}

/** Cascada de utilidades: bruta, operacional, antes de impuestos y neta. */
export function incomeStatementLines(report: IncomeStatementReport): IncomeStatementLine[] {
  const lines: IncomeStatementLine[] = [
    { key: 'operatingRevenues', label: 'Ingresos operacionales (41)', amount: report.operatingRevenues, kind: 'line' },
    { key: 'totalCosts', label: 'Costos de ventas y de producción (6 y 7)', amount: -report.totalCosts, kind: 'line' },
    { key: 'grossProfit', label: 'Utilidad bruta', amount: report.grossProfit, kind: 'subtotal' },
    {
      key: 'administrativeExpenses',
      label: 'Gastos operacionales de administración (51)',
      amount: -report.administrativeExpenses,
      kind: 'line',
    },
    { key: 'sellingExpenses', label: 'Gastos operacionales de ventas (52)', amount: -report.sellingExpenses, kind: 'line' },
    { key: 'operatingProfit', label: 'Utilidad operacional', amount: report.operatingProfit, kind: 'subtotal' },
    {
      key: 'nonOperatingIncome',
      label: 'Ingresos no operacionales (clase 4 excepto 41)',
      amount: report.nonOperatingIncome,
      kind: 'line',
    },
    { key: 'nonOperatingExpenses', label: 'Gastos no operacionales (53)', amount: -report.nonOperatingExpenses, kind: 'line' },
    { key: 'profitBeforeTax', label: 'Utilidad antes de impuestos', amount: report.profitBeforeTax, kind: 'subtotal' },
    { key: 'incomeTax', label: 'Impuesto de renta y complementarios (54)', amount: -report.incomeTax, kind: 'line' },
  ]
  if (!isZeroAmount(report.otherExpenses)) {
    lines.push({ key: 'otherExpenses', label: 'Otros gastos de la clase 5', amount: -report.otherExpenses, kind: 'line' })
  }
  lines.push({
    key: 'netProfit',
    label: report.netProfit < 0 ? 'Pérdida neta del ejercicio' : 'Utilidad neta del ejercicio',
    amount: report.netProfit,
    kind: 'total',
  })
  return lines
}
