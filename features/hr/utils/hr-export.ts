/**
 * Exportación tabular de Recursos Humanos: CSV (UTF-8 con BOM, separador ";" para Excel en
 * español) y hoja de cálculo XML 2003 (.xls) que Excel abre de forma nativa, sin librerías.
 */

export type ExportCell = string | number | null | undefined

export interface ExportTable {
  title: string
  columns: string[]
  rows: ExportCell[][]
}

export type ExportFormat = 'csv' | 'xls'

const CSV_SEPARATOR = ';'
const FORMULA_PREFIX = /^[=+\-@\t\r]/

/** Evita la inyección de fórmulas al abrir el archivo en una hoja de cálculo. */
function neutralizeFormula(value: string): string {
  return FORMULA_PREFIX.test(value) ? `'${value}` : value
}

function csvCell(cell: ExportCell): string {
  if (cell === null || cell === undefined) return ''
  if (typeof cell === 'number') return String(cell).replace('.', ',')
  const text = neutralizeFormula(cell)
  return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export function buildCsv(table: ExportTable): string {
  const lines = [table.columns.map(csvCell).join(CSV_SEPARATOR)]
  for (const row of table.rows) {
    lines.push(row.map(csvCell).join(CSV_SEPARATOR))
  }
  return `﻿${lines.join('\r\n')}`
}

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
}

function xmlCell(cell: ExportCell, styleId?: string): string {
  const style = styleId ? ` ss:StyleID="${styleId}"` : ''
  if (cell === null || cell === undefined || cell === '') return `<Cell${style}/>`
  if (typeof cell === 'number' && Number.isFinite(cell)) {
    return `<Cell${style}><Data ss:Type="Number">${cell}</Data></Cell>`
  }
  return `<Cell${style}><Data ss:Type="String">${xmlEscape(neutralizeFormula(String(cell)))}</Data></Cell>`
}

export function buildSpreadsheetXml(table: ExportTable): string {
  const sheetName = xmlEscape(table.title.replace(/[\\/?*[\]:]/g, ' ').slice(0, 31) || 'Hoja1')
  const header = `<Row>${table.columns.map((column) => xmlCell(column, 'header')).join('')}</Row>`
  const body = table.rows.map((row) => `<Row>${row.map((cell) => xmlCell(cell)).join('')}</Row>`).join('')

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<?mso-application progid="Excel.Sheet"?>',
    '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">',
    '<Styles><Style ss:ID="header"><Font ss:Bold="1"/><Interior ss:Color="#E9EEF8" ss:Pattern="Solid"/></Style></Styles>',
    `<Worksheet ss:Name="${sheetName}"><Table>${header}${body}</Table></Worksheet>`,
    '</Workbook>',
  ].join('')
}

/** Descarga el archivo en el navegador. */
export function downloadTable(table: ExportTable, fileBaseName: string, format: ExportFormat): void {
  const isCsv = format === 'csv'
  const content = isCsv ? buildCsv(table) : buildSpreadsheetXml(table)
  const blob = new Blob([content], {
    type: isCsv ? 'text/csv;charset=utf-8' : 'application/vnd.ms-excel;charset=utf-8',
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${fileBaseName}.${isCsv ? 'csv' : 'xls'}`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
