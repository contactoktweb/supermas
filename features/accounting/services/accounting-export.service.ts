/**
 * SUPER MÁS ERP/POS - Servicio Especializado de Exportación Contable
 *
 * Soporta exportación completa con filtros opcionales de fechas, rango de cuentas PUC, sede,
 * roles y clasificaciones para:
 * 1. Terceros (DIAN) - Directorio de clientes, proveedores, empleados y acreedores
 * 2. Asientos Contables - Comprobantes con partida doble y estados fiduciarios
 * 3. Libro Auxiliar de Movimientos - Detalle de cuentas, débitos, créditos y saldos
 * 4. Plan Único de Cuentas (PUC) - Catálogo maestro de cuentas contables
 * 5. Libro Diario - Líneas contables en orden cronológico
 * 6. Balance General - Estado de situación financiera desglosado por niveles del PUC
 * 7. Balance de Comprobación - Sumas y saldos por nivel, con terceros
 * 8. Estado de Resultados - Ingresos, costos y gastos del periodo con cascada de utilidades
 *
 * El rango de cuentas usa el orden del PUC (utils/puc-code-range): la cuenta final incluye sus
 * subcuentas y auxiliares. Cada archivo lleva en el encabezado empresa, filtros y "Cuentas de X a Y".
 *
 * Formatos admitidos:
 * - CSV (Compatible con Excel en español, UTF-8 con BOM y delimitador ;)
 * - Excel Nativo (.xls XML con tipado formal de celdas)
 * - JSON (Datos estructurados)
 */

import {
  ThirdParty,
  AccountingEntry,
  AccountingMovement,
  AccountingAccount,
  AccountingExportFormat,
  AccountingExportFilterOptions,
  AccountingCompanyHeader,
  AccountMovementTotalsMap,
  BalanceSheetReport,
  IncomeStatementReport,
  FinancialStatementNode,
  TrialBalanceReportData,
  TrialBalanceRow,
  TrialBalanceThirdPartyDetail,
  TrialBalanceLevelFilter,
  TrialBalanceTotals,
} from '../types'
import {
  ACCOUNT_LEVEL_LABEL,
  ACCOUNT_LEVEL_NUMBER,
  buildAccountTree,
  flattenAccountTree,
  isZeroAmount,
  nodeHasActivity,
  pruneZeroNodes,
  roundCurrency,
} from '../utils/account-tree'
import {
  comparePucCodes,
  formatPucRangeLabel,
  isPucCodeInRange,
  isPucDescendantOrSelf,
  normalizePucRange,
} from '../utils/puc-code-range'
import { formatCompanyNit, formatIsoDateEs, formatNowBogota, todayBogotaIsoDate } from '../utils/report-format'
import { incomeStatementLines, incomeStatementSections } from '../utils/income-statement'

interface ColumnDef {
  key: string
  header: string
  type?: 'string' | 'number' | 'date'
}

/** Nivel máximo del Balance de Comprobación → número de nivel del PUC (1 = clase … 5 = auxiliar). */
const TRIAL_BALANCE_LEVEL_NUMBER: Record<TrialBalanceLevelFilter, number> = {
  CLASS: 1,
  GROUP: 2,
  ACCOUNT: 3,
  SUBACCOUNT: 4,
  AUXILIARY: 5,
  ALL: 5,
}

const SYSTEM_NAME = 'SUPER MÁS ERP/POS'

export class AccountingExportService {
  /**
   * Verifica si una fecha se encuentra dentro del rango opcional [startDate, endDate]
   */
  isDateInRange(dateStr?: string, startDate?: string, endDate?: string): boolean {
    if (!startDate && !endDate) return true
    if (!dateStr) return true

    // Extraer solo la parte YYYY-MM-DD
    const itemDate = dateStr.slice(0, 10)

    if (startDate && endDate) {
      return itemDate >= startDate && itemDate <= endDate
    }
    if (startDate) {
      return itemDate >= startDate
    }
    if (endDate) {
      return itemDate <= endDate
    }
    return true
  }

  /** Rango de cuentas normalizado a partir de las opciones de exportación. */
  private accountRangeOf(options?: AccountingExportFilterOptions) {
    return normalizePucRange({ from: options?.startAccountCode, to: options?.endAccountCode })
  }

  /** true si la cuenta cumple el rango y la clase principal elegidos. */
  private matchesAccountScope(code: string, options?: AccountingExportFilterOptions): boolean {
    if (!isPucCodeInRange(code, this.accountRangeOf(options))) return false
    const main = options?.mainAccountCode?.trim()
    if (main && main !== 'ALL' && !isPucDescendantOrSelf(code, main)) return false
    return true
  }

  /** Líneas de encabezado comunes: empresa, NIT, sede y rango de cuentas. */
  private headerMetadata(options?: AccountingExportFilterOptions, includeAccountRange = true): string[] {
    const meta: string[] = []
    const company = options?.companyHeader
    if (company?.legalName) meta.push(`EMPRESA: ${company.legalName}`)
    const nit = formatCompanyNit(company?.taxId, company?.verificationDigit)
    if (nit) meta.push(`NIT: ${nit}`)
    if (options?.locationId && options.locationId !== 'ALL') {
      meta.push(`SEDE: ${options.locationName || options.locationId}`)
    }
    if (includeAccountRange) {
      meta.push(`RANGO DE CUENTAS: ${formatPucRangeLabel(this.accountRangeOf(options))}`)
      if (options?.mainAccountCode && options.mainAccountCode !== 'ALL') {
        meta.push(`CLASE PRINCIPAL: ${options.mainAccountCode}`)
      }
    }
    if (options?.startDate || options?.endDate) {
      meta.push(
        `RANGO DE FECHAS: ${options.startDate ? formatIsoDateEs(options.startDate) : 'Inicio'} hasta ${
          options.endDate ? formatIsoDateEs(options.endDate) : 'Hoy'
        }`
      )
    }
    return meta
  }

  /**
   * Filtra terceros según opciones de fechas, roles y búsqueda
   */
  filterThirdParties(
    thirdParties: ThirdParty[],
    options?: AccountingExportFilterOptions
  ): ThirdParty[] {
    if (!options) return thirdParties

    return thirdParties.filter((tp) => {
      // Filtro por rol / clasificación
      if (options.thirdPartyType && options.thirdPartyType !== 'ALL') {
        if (tp.thirdPartyType !== options.thirdPartyType) return false
      }

      // Filtro por naturaleza jurídica
      if (options.legalNature && options.legalNature !== 'ALL') {
        if (tp.legalNature !== options.legalNature) return false
      }

      // Filtro por rango de fechas opcional (según createdAt)
      if (options.startDate || options.endDate) {
        if (!this.isDateInRange(tp.createdAt, options.startDate, options.endDate)) {
          return false
        }
      }

      // Filtro por término de búsqueda
      if (options.searchQuery?.trim()) {
        const q = options.searchQuery.toLowerCase().trim()
        const matchName = (tp.companyName || '').toLowerCase().includes(q)
        const matchDoc = (tp.documentNumber || '').toLowerCase().includes(q)
        const matchEmail = (tp.email || '').toLowerCase().includes(q)
        const matchPhone = (tp.phone || '').toLowerCase().includes(q)
        if (!matchName && !matchDoc && !matchEmail && !matchPhone) return false
      }

      return true
    })
  }

  /**
   * Filtra asientos contables según fechas, estados, sede, rango de cuentas y búsqueda.
   * Con rango de cuentas se conservan los comprobantes con al menos una línea dentro del rango.
   */
  filterEntries(
    entries: AccountingEntry[],
    options?: AccountingExportFilterOptions
  ): AccountingEntry[] {
    if (!options) return entries
    const range = this.accountRangeOf(options)
    const hasAccountScope = Boolean(range.from || range.to || (options.mainAccountCode && options.mainAccountCode !== 'ALL'))

    return entries.filter((e) => {
      // Filtro por estado
      if (options.entryStatus && options.entryStatus !== 'ALL') {
        if (e.status !== options.entryStatus) return false
      }

      // Filtro por rango de fechas
      if (options.startDate || options.endDate) {
        if (!this.isDateInRange(e.date, options.startDate, options.endDate)) {
          return false
        }
      }

      if (options.locationId && options.locationId !== 'ALL' && e.locationId !== options.locationId) {
        return false
      }

      if (hasAccountScope && !e.lines.some((line) => this.matchesAccountScope(line.accountCode, options))) {
        return false
      }

      // Filtro por término de búsqueda
      if (options.searchQuery?.trim()) {
        const q = options.searchQuery.toLowerCase().trim()
        const matchNum = (e.entryNumber || '').toLowerCase().includes(q)
        const matchDesc = (e.description || '').toLowerCase().includes(q)
        const matchDoc = (e.documentNumber || '').toLowerCase().includes(q)
        const matchThird = (e.thirdPartyName || '').toLowerCase().includes(q)
        if (!matchNum && !matchDesc && !matchDoc && !matchThird) return false
      }

      return true
    })
  }

  /** Líneas del Libro Diario (una fila por línea contable) dentro de fechas, sede y rango de cuentas. */
  journalLines(entries: AccountingEntry[], options?: AccountingExportFilterOptions) {
    const rows: Array<{
      date: string
      voucherNumber: string
      voucherType: string
      accountCode: string
      accountName: string
      thirdPartyName: string
      description: string
      debit: number
      credit: number
    }> = []

    for (const e of this.filterEntries(entries, options)) {
      for (const line of e.lines) {
        if (!this.matchesAccountScope(line.accountCode, options)) continue
        rows.push({
          date: (e.date || '').slice(0, 10),
          voucherNumber: e.entryNumber,
          voucherType: e.sourceType || '',
          accountCode: line.accountCode,
          accountName: line.accountName,
          thirdPartyName: e.thirdPartyName || '',
          description: line.description || e.description,
          debit: line.debit,
          credit: line.credit,
        })
      }
    }

    return rows.sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        a.voucherNumber.localeCompare(b.voucherNumber) ||
        comparePucCodes(a.accountCode, b.accountCode)
    )
  }

  /**
   * Filtra movimientos del libro auxiliar según fechas, sede, rango de cuentas y búsqueda
   */
  filterMovements(
    movements: AccountingMovement[],
    options?: AccountingExportFilterOptions
  ): AccountingMovement[] {
    if (!options) return movements

    return movements.filter((m) => {
      if (options.startDate || options.endDate) {
        if (!this.isDateInRange(m.date, options.startDate, options.endDate)) {
          return false
        }
      }

      if (!this.matchesAccountScope(m.accountCode, options)) {
        return false
      }

      if (options.locationId && options.locationId !== 'ALL' && m.locationId !== options.locationId) {
        return false
      }

      if (options.selectedThirdPartyId && options.selectedThirdPartyId !== 'ALL') {
        const tpId = (m as any).thirdPartyId || ''
        const tpDoc = (m as any).thirdPartyDoc || ''
        if (tpId !== options.selectedThirdPartyId && tpDoc !== options.selectedThirdPartyId) {
          return false
        }
      }

      if (options.searchQuery?.trim()) {
        const q = options.searchQuery.toLowerCase().trim()
        const matchCode = (m.accountCode || '').toLowerCase().includes(q)
        const matchName = (m.accountName || '').toLowerCase().includes(q)
        const matchDesc = (m.description || '').toLowerCase().includes(q)
        const matchThird = (m.thirdPartyName || '').toLowerCase().includes(q)
        if (!matchCode && !matchName && !matchDesc && !matchThird) return false
      }

      return true
    })
  }

  /**
   * Filtra cuentas del PUC según rango de cuentas, clase principal, nivel máximo y búsqueda.
   * (El catálogo no se filtra por fecha de creación: el PUC vigente no depende del periodo.)
   */
  filterAccounts(
    accounts: AccountingAccount[],
    options?: AccountingExportFilterOptions
  ): AccountingAccount[] {
    if (!options) return accounts
    const maxLevelNumber = TRIAL_BALANCE_LEVEL_NUMBER[options.maxLevel || 'ALL'] || 5

    return accounts
      .filter((a) => {
        if (!this.matchesAccountScope(a.code, options)) return false
        if ((ACCOUNT_LEVEL_NUMBER[a.level] || 5) > maxLevelNumber) return false

        if (options.searchQuery?.trim()) {
          const q = options.searchQuery.toLowerCase().trim()
          const matchCode = (a.code || '').toLowerCase().includes(q)
          const matchName = (a.name || '').toLowerCase().includes(q)
          if (!matchCode && !matchName) return false
        }

        return true
      })
      .sort((a, b) => comparePucCodes(a.code, b.code))
  }

  /**
   * Genera el archivo CSV con delimitador ';' y codificación UTF-8 con BOM
   */
  private generateCSV(
    title: string,
    columns: ColumnDef[],
    rows: Array<Record<string, any>>,
    metadataItems: string[] = []
  ): string {
    const BOM = '﻿'
    const headerLine = columns.map((c) => `"${c.header.replace(/"/g, '""')}"`).join(';')

    const dataLines = rows.map((row) =>
      columns
        .map((col) => {
          const val = row[col.key]
          if (val === null || val === undefined) return '""'
          if (typeof val === 'number') return `${val}`
          const clean = String(val).replace(/"/g, '""')
          return `"${clean}"`
        })
        .join(';')
    )

    const metaBlock = [
      `"SISTEMA: ${SYSTEM_NAME}"`,
      `"REPORTE: ${title}"`,
      ...metadataItems.map((item) => `"${item.replace(/"/g, '""')}"`),
      `"FECHA DE GENERACIÓN: ${formatNowBogota()}"`,
      `"TOTAL REGISTROS EXPORTADOS: ${rows.length}"`,
      '',
    ].join('\r\n')

    return `${BOM}${metaBlock}\r\n${headerLine}\r\n${dataLines.join('\r\n')}`
  }

  /**
   * Genera el archivo XML para apertura nativa y formateada en Excel.
   * Las líneas de metadatos (empresa, filtros, rango de cuentas) van encima de los encabezados.
   */
  private generateExcelXML(
    sheetName: string,
    title: string,
    columns: ColumnDef[],
    rows: Array<Record<string, any>>,
    metadataItems: string[] = []
  ): string {
    const headerCells = columns
      .map(
        (c) =>
          `<Cell ss:StyleID="Header"><Data ss:Type="String">${this.escapeXml(c.header)}</Data></Cell>`
      )
      .join('')

    const metaRows = [
      `<Row><Cell ss:StyleID="Title"><Data ss:Type="String">${this.escapeXml(title)}</Data></Cell></Row>`,
      ...metadataItems.map(
        (item) => `<Row><Cell ss:StyleID="Meta"><Data ss:Type="String">${this.escapeXml(item)}</Data></Cell></Row>`
      ),
      `<Row><Cell ss:StyleID="Meta"><Data ss:Type="String">${this.escapeXml(
        `Fecha de generación: ${formatNowBogota()}`
      )}</Data></Cell></Row>`,
      '<Row></Row>',
    ].join('\n')

    const dataRows = rows
      .map((row) => {
        const cells = columns
          .map((col) => {
            const val = row[col.key]
            if (val === null || val === undefined) {
              return '<Cell><Data ss:Type="String"></Data></Cell>'
            }
            if (typeof val === 'number') {
              return `<Cell ss:StyleID="Number"><Data ss:Type="Number">${val}</Data></Cell>`
            }
            return `<Cell><Data ss:Type="String">${this.escapeXml(String(val))}</Data></Cell>`
          })
          .join('')
        return `<Row>${cells}</Row>`
      })
      .join('\n')

    return `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Center"/>
   <Font ss:FontName="Calibri" ss:Size="11" ss:Color="#1e293b"/>
  </Style>
  <Style ss:ID="Title">
   <Font ss:FontName="Calibri" ss:Size="13" ss:Bold="1" ss:Color="#001B5C"/>
  </Style>
  <Style ss:ID="Meta">
   <Font ss:FontName="Calibri" ss:Size="10" ss:Color="#334155"/>
  </Style>
  <Style ss:ID="Header">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#001B5C"/>
   </Borders>
   <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#FFFFFF"/>
   <Interior ss:Color="#001B5C" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="Number">
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <NumberFormat ss:Format="#,##0.00"/>
  </Style>
 </Styles>
 <Worksheet ss:Name="${this.escapeXml(sheetName.slice(0, 30))}">
  <Table>
   ${metaRows}
   <Row ss:Height="24">${headerCells}</Row>
   ${dataRows}
  </Table>
 </Worksheet>
</Workbook>`
  }

  private escapeXml(unsafe: string): string {
    return unsafe
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;')
  }

  /**
   * Descarga el archivo en el navegador
   */
  private triggerDownload(content: string, filename: string, mimeType: string): void {
    if (typeof window === 'undefined') return

    const blob = new Blob([content], { type: mimeType })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  /** Escribe el archivo en el formato pedido (CSV, Excel o JSON). */
  private writeFile(params: {
    format: AccountingExportFormat
    title: string
    sheetName: string
    filenameBase: string
    columns: ColumnDef[]
    rows: Array<Record<string, any>>
    meta: string[]
    json: () => Record<string, unknown>
  }): void {
    const { format, title, sheetName, filenameBase, columns, rows, meta } = params
    if (format === 'CSV') {
      const csv = this.generateCSV(title, columns, rows, meta)
      this.triggerDownload(csv, `${filenameBase}.csv`, 'text/csv;charset=utf-8;')
    } else if (format === 'EXCEL') {
      const xml = this.generateExcelXML(sheetName, title, columns, rows, meta)
      this.triggerDownload(xml, `${filenameBase}.xls`, 'application/vnd.ms-excel;charset=utf-8;')
    } else {
      const json = JSON.stringify(
        { sistema: SYSTEM_NAME, fechaGeneracion: new Date().toISOString(), encabezado: meta, ...params.json() },
        null,
        2
      )
      this.triggerDownload(json, `${filenameBase}.json`, 'application/json;charset=utf-8;')
    }
  }

  // =========================================================================
  // EXPORTACIONES ESPECÍFICAS
  // =========================================================================

  /**
   * 1. Exportar Terceros (DIAN)
   */
  exportThirdParties(
    thirdParties: ThirdParty[],
    format: AccountingExportFormat = 'CSV',
    options?: AccountingExportFilterOptions
  ): { count: number; filename: string } {
    const filtered = this.filterThirdParties(thirdParties, options)
    const filenameBase = `terceros_dian_${todayBogotaIsoDate()}`

    const columns: ColumnDef[] = [
      { key: 'tipoDocumento', header: 'Tipo Documento' },
      { key: 'documento', header: 'Número Documento / NIT' },
      { key: 'dv', header: 'DV' },
      { key: 'naturaleza', header: 'Naturaleza Jurídica' },
      { key: 'razonSocial', header: 'Razón Social / Nombre Completo' },
      { key: 'nombreComercial', header: 'Nombre Comercial' },
      { key: 'rol', header: 'Rol / Clasificación' },
      { key: 'telefono', header: 'Teléfono / Contacto' },
      { key: 'email', header: 'Correo Electrónico' },
      { key: 'direccion', header: 'Dirección Fiscal' },
      { key: 'ciudad', header: 'Ciudad' },
      { key: 'departamento', header: 'Departamento' },
      { key: 'estado', header: 'Estado' },
      { key: 'fechaRegistro', header: 'Fecha de Registro' },
    ]

    const rows = filtered.map((tp) => ({
      tipoDocumento: tp.documentType || '',
      documento: tp.documentNumber,
      dv: tp.verificationDigit || '',
      naturaleza: tp.legalNature === 'JURIDICA' ? 'Persona Jurídica' : 'Persona Natural',
      razonSocial: tp.companyName || tp.documentNumber,
      nombreComercial: tp.commercialName || '',
      rol:
        tp.thirdPartyType === 'CLIENTE'
          ? 'Cliente (Ventas)'
          : tp.thirdPartyType === 'PROVEEDOR'
          ? 'Proveedor (Compras)'
          : tp.thirdPartyType === 'EMPLEADO'
          ? 'Empleado'
          : tp.thirdPartyType === 'ACREEDOR'
          ? 'Acreedor'
          : 'Otro',
      telefono: tp.phone || '',
      email: tp.email || '',
      direccion: tp.address || '',
      ciudad: tp.city || '',
      departamento: tp.department || '',
      estado: tp.isActive ? 'Activo' : 'Inactivo',
      fechaRegistro: tp.createdAt ? tp.createdAt.slice(0, 10) : '',
    }))

    const meta = this.headerMetadata(options, false)
    if (options?.thirdPartyType && options.thirdPartyType !== 'ALL') {
      meta.push(`ROL FILTRADO: ${options.thirdPartyType}`)
    }
    if (options?.legalNature && options.legalNature !== 'ALL') {
      meta.push(`NATURALEZA FILTRADA: ${options.legalNature}`)
    }

    this.writeFile({
      format,
      title: 'DIRECTORIO DE TERCEROS (DIAN)',
      sheetName: 'Terceros DIAN',
      filenameBase,
      columns,
      rows,
      meta,
      json: () => ({ modulo: 'Contabilidad - Terceros DIAN', total: filtered.length, terceros: filtered }),
    })

    return { count: filtered.length, filename: filenameBase }
  }

  /**
   * 2. Exportar Asientos Contables
   */
  exportEntries(
    entries: AccountingEntry[],
    format: AccountingExportFormat = 'CSV',
    options?: AccountingExportFilterOptions
  ): { count: number; filename: string } {
    const filtered = this.filterEntries(entries, options)
    const filenameBase = `asientos_contables_${todayBogotaIsoDate()}`

    const columns: ColumnDef[] = [
      { key: 'numero', header: 'Número Comprobante' },
      { key: 'fecha', header: 'Fecha Contable' },
      { key: 'periodo', header: 'Periodo (YYYY-MM)' },
      { key: 'tipo', header: 'Tipo Operación' },
      { key: 'documento', header: 'Doc. Soporte' },
      { key: 'descripcion', header: 'Concepto / Descripción' },
      { key: 'tercero', header: 'Tercero Contable' },
      { key: 'debito', header: 'Total Débito (COP)', type: 'number' },
      { key: 'credito', header: 'Total Crédito (COP)', type: 'number' },
      { key: 'estado', header: 'Estado' },
    ]

    const rows = filtered.map((e) => ({
      numero: e.entryNumber,
      fecha: e.date,
      periodo: e.period,
      tipo: e.sourceType,
      documento: e.documentNumber || '',
      descripcion: e.description,
      tercero: e.thirdPartyName || '',
      debito: e.totalDebit,
      credito: e.totalCredit,
      estado: e.status,
    }))

    const meta = this.headerMetadata(options)
    if (options?.entryStatus && options.entryStatus !== 'ALL') {
      meta.push(`ESTADO FILTRADO: ${options.entryStatus}`)
    }

    this.writeFile({
      format,
      title: 'COMPROBANTES Y ASIENTOS CONTABLES',
      sheetName: 'Asientos Contables',
      filenameBase,
      columns,
      rows,
      meta,
      json: () => ({ modulo: 'Contabilidad - Asientos Contables', total: filtered.length, asientos: filtered }),
    })

    return { count: filtered.length, filename: filenameBase }
  }

  /**
   * 3. Exportar Libro Auxiliar
   */
  exportAuxiliary(
    movements: AccountingMovement[],
    format: AccountingExportFormat = 'CSV',
    options?: AccountingExportFilterOptions
  ): { count: number; filename: string } {
    const filtered = this.filterMovements(movements, options).sort(
      (a, b) => comparePucCodes(a.accountCode, b.accountCode) || (a.date || '').localeCompare(b.date || '')
    )
    const filenameBase = `libro_auxiliar_${todayBogotaIsoDate()}`

    const columns: ColumnDef[] = [
      { key: 'fecha', header: 'Fecha' },
      { key: 'comprobante', header: 'Comprobante' },
      { key: 'cuenta', header: 'Código Cuenta PUC' },
      { key: 'nombreCuenta', header: 'Nombre Cuenta' },
      { key: 'descripcion', header: 'Concepto Detalle' },
      { key: 'tercero', header: 'Tercero' },
      { key: 'bodega', header: 'Sede / Bodega' },
      { key: 'debito', header: 'Débito (COP)', type: 'number' },
      { key: 'credito', header: 'Crédito (COP)', type: 'number' },
    ]

    const rows = filtered.map((m: any) => ({
      fecha: (m.date || '').slice(0, 10),
      comprobante: m.sourceDocumentNumber || m.entryNumber,
      cuenta: m.accountCode,
      nombreCuenta: m.accountName,
      descripcion: m.description,
      tercero: m.thirdPartyName || '',
      bodega: m.costCenterName || m.locationName || '',
      debito: m.debit,
      credito: m.credit,
    }))

    this.writeFile({
      format,
      title: 'LIBRO AUXILIAR CONTABLE',
      sheetName: 'Libro Auxiliar',
      filenameBase,
      columns,
      rows,
      meta: this.headerMetadata(options),
      json: () => ({ modulo: 'Contabilidad - Libro Auxiliar', total: filtered.length, movimientos: filtered }),
    })

    return { count: filtered.length, filename: filenameBase }
  }

  /**
   * 4. Exportar Plan Único de Cuentas (PUC)
   */
  exportAccounts(
    accounts: AccountingAccount[],
    format: AccountingExportFormat = 'CSV',
    options?: AccountingExportFilterOptions
  ): { count: number; filename: string } {
    const filtered = this.filterAccounts(accounts, options)
    const filenameBase = `plan_cuentas_puc_${todayBogotaIsoDate()}`

    const columns: ColumnDef[] = [
      { key: 'codigo', header: 'Código Cuenta PUC' },
      { key: 'nombre', header: 'Nombre Cuenta' },
      { key: 'clase', header: 'Clase PUC' },
      { key: 'naturaleza', header: 'Naturaleza' },
      { key: 'nivel', header: 'Nivel' },
      { key: 'saldo', header: 'Saldo Actual (COP)', type: 'number' },
      { key: 'exigeTercero', header: 'Exige Tercero' },
      { key: 'exigeCentroCosto', header: 'Exige Centro Costo' },
      { key: 'estado', header: 'Estado' },
    ]

    const rows = filtered.map((a) => ({
      codigo: a.code,
      nombre: a.name,
      clase: `Clase ${a.accountClass}`,
      naturaleza: a.nature === 'DEBIT' ? 'Débito' : 'Crédito',
      nivel: ACCOUNT_LEVEL_LABEL[a.level] || a.level,
      saldo: a.balance,
      exigeTercero: a.requiresThirdParty ? 'Sí' : 'No',
      exigeCentroCosto: a.requiresCostCenter ? 'Sí' : 'No',
      estado: a.status === 'ACTIVE' ? 'Activo' : 'Inactivo',
    }))

    const meta = this.headerMetadata({ ...options, startDate: undefined, endDate: undefined })

    this.writeFile({
      format,
      title: 'PLAN ÚNICO DE CUENTAS (PUC COLOMBIA)',
      sheetName: 'PUC Colombia',
      filenameBase,
      columns,
      rows,
      meta,
      json: () => ({ modulo: 'Contabilidad - Plan Único de Cuentas', total: filtered.length, cuentas: filtered }),
    })

    return { count: filtered.length, filename: filenameBase }
  }

  /**
   * 5. Exportar Libro Diario (una fila por línea contable)
   */
  exportJournal(
    entries: AccountingEntry[],
    format: AccountingExportFormat = 'CSV',
    options?: AccountingExportFilterOptions
  ): { count: number; filename: string } {
    const lines = this.journalLines(entries, options)
    const filenameBase = `libro_diario_${todayBogotaIsoDate()}`

    const columns: ColumnDef[] = [
      { key: 'fecha', header: 'Fecha' },
      { key: 'comprobante', header: 'Comprobante' },
      { key: 'tipo', header: 'Tipo' },
      { key: 'cuenta', header: 'Código Cuenta PUC' },
      { key: 'nombreCuenta', header: 'Nombre Cuenta' },
      { key: 'tercero', header: 'Tercero' },
      { key: 'detalle', header: 'Detalle' },
      { key: 'debito', header: 'Débito (COP)', type: 'number' },
      { key: 'credito', header: 'Crédito (COP)', type: 'number' },
    ]

    const rows = lines.map((l) => ({
      fecha: l.date,
      comprobante: l.voucherNumber,
      tipo: l.voucherType,
      cuenta: l.accountCode,
      nombreCuenta: l.accountName,
      tercero: l.thirdPartyName,
      detalle: l.description,
      debito: l.debit,
      credito: l.credit,
    }))

    const totalDebit = roundCurrency(lines.reduce((s, l) => s + l.debit, 0))
    const totalCredit = roundCurrency(lines.reduce((s, l) => s + l.credit, 0))
    if (rows.length > 0) {
      rows.push({
        fecha: '',
        comprobante: 'TOTALES',
        tipo: '',
        cuenta: '',
        nombreCuenta: '',
        tercero: '',
        detalle: '',
        debito: totalDebit,
        credito: totalCredit,
      })
    }

    this.writeFile({
      format,
      title: 'LIBRO DIARIO',
      sheetName: 'Libro Diario',
      filenameBase,
      columns,
      rows,
      meta: this.headerMetadata(options),
      json: () => ({ modulo: 'Contabilidad - Libro Diario', total: lines.length, totalDebit, totalCredit, lineas: lines }),
    })

    return { count: lines.length, filename: filenameBase }
  }

  /**
   * 6. Exportar Balance General desglosado (árbol PUC con sangría, totales y ecuación).
   */
  exportBalanceSheet(
    report: BalanceSheetReport,
    format: AccountingExportFormat = 'CSV',
    options?: { hideZeroBalances?: boolean; maxLevel?: TrialBalanceLevelFilter; companyHeader?: AccountingCompanyHeader | null }
  ): { count: number; filename: string } {
    const maxLevelNumber = TRIAL_BALANCE_LEVEL_NUMBER[options?.maxLevel || 'ALL'] || 5
    const prepare = (node: FinancialStatementNode | null) =>
      node ? (options?.hideZeroBalances ? pruneZeroNodes([node]) : [node]) : []
    const sectionRows = (nodes: FinancialStatementNode[]) =>
      flattenAccountTree(nodes, maxLevelNumber).map(({ node, depth }) => ({
        codigo: node.code,
        cuenta: `${'    '.repeat(depth)}${node.name}`,
        nivel: ACCOUNT_LEVEL_LABEL[node.level],
        naturaleza: node.nature === 'DEBIT' ? 'Débito' : 'Crédito',
        saldo: node.balance,
      }))
    const totalRow = (label: string, value: number) => ({ codigo: '', cuenta: label, nivel: '', naturaleza: '', saldo: value })

    const rows: Array<Record<string, any>> = [
      ...sectionRows(prepare(report.assets)),
      totalRow('TOTAL ACTIVO', report.totalAssets),
      ...sectionRows(prepare(report.liabilities)),
      totalRow('TOTAL PASIVO', report.totalLiabilities),
      ...sectionRows(prepare(report.equity)),
      totalRow('Resultado del ejercicio (4 − 5 − 6 − 7, sin cierre)', report.currentYearResult),
      totalRow('TOTAL PATRIMONIO', report.totalEquity),
      totalRow('TOTAL PASIVO + PATRIMONIO', report.totalLiabilitiesAndEquity),
      totalRow('DIFERENCIA (ACTIVO − PASIVO − PATRIMONIO)', report.difference),
    ]

    const columns: ColumnDef[] = [
      { key: 'codigo', header: 'Código PUC' },
      { key: 'cuenta', header: 'Cuenta' },
      { key: 'nivel', header: 'Nivel' },
      { key: 'naturaleza', header: 'Naturaleza' },
      { key: 'saldo', header: 'Saldo (COP)', type: 'number' },
    ]

    const meta = this.headerMetadata({
      companyHeader: options?.companyHeader,
      locationId: report.locationId,
      locationName: report.locationName,
      startAccountCode: report.accountFrom,
      endAccountCode: report.accountTo,
    })
    meta.push(`FECHA DE CORTE: ${formatIsoDateEs(report.cutoffDate)}`)
    if (!report.locationId) meta.push('SEDE: Consolidado de todas las sedes')
    meta.push(
      `ECUACIÓN PATRIMONIAL: ${report.isBalanced ? 'CUADRADA (Activo = Pasivo + Patrimonio)' : `DESCUADRE DE ${report.difference}`}`
    )

    const filenameBase = `balance_general_${report.cutoffDate}`
    this.writeFile({
      format,
      title: 'ESTADO DE SITUACIÓN FINANCIERA (BALANCE GENERAL)',
      sheetName: 'Balance General',
      filenameBase,
      columns,
      rows,
      meta,
      json: () => ({ modulo: 'Contabilidad - Balance General', balance: report }),
    })

    return { count: rows.length, filename: filenameBase }
  }

  /**
   * 6b. Exportar Estado de Resultados (árboles de las clases 4, 6, 7 y 5 y cascada de utilidades).
   */
  exportIncomeStatement(
    report: IncomeStatementReport,
    format: AccountingExportFormat = 'CSV',
    options?: { hideZeroBalances?: boolean; maxLevel?: TrialBalanceLevelFilter; companyHeader?: AccountingCompanyHeader | null }
  ): { count: number; filename: string } {
    const maxLevelNumber = TRIAL_BALANCE_LEVEL_NUMBER[options?.maxLevel || 'ALL'] || 5
    const prepare = (node: FinancialStatementNode | null) =>
      node ? (options?.hideZeroBalances ? pruneZeroNodes([node]) : [node]) : []
    const emptyColumns = { codigo: '', nivel: '', naturaleza: '' }

    const rows: Array<Record<string, any>> = []
    for (const section of incomeStatementSections(report)) {
      rows.push(
        ...flattenAccountTree(prepare(section.node), maxLevelNumber).map(({ node, depth }) => ({
          codigo: node.code,
          cuenta: `${'    '.repeat(depth)}${node.name}`,
          nivel: ACCOUNT_LEVEL_LABEL[node.level],
          naturaleza: node.nature === 'DEBIT' ? 'Débito' : 'Crédito',
          saldo: node.balance,
        })),
        { ...emptyColumns, cuenta: section.totalLabel.toUpperCase(), saldo: section.total }
      )
    }
    rows.push(
      { ...emptyColumns, cuenta: '', saldo: null },
      ...incomeStatementLines(report).map((line) => ({
        ...emptyColumns,
        cuenta: line.kind === 'line' ? line.label : line.label.toUpperCase(),
        saldo: line.amount,
      }))
    )

    const columns: ColumnDef[] = [
      { key: 'codigo', header: 'Código PUC' },
      { key: 'cuenta', header: 'Cuenta' },
      { key: 'nivel', header: 'Nivel' },
      { key: 'naturaleza', header: 'Naturaleza' },
      { key: 'saldo', header: 'Valor (COP)', type: 'number' },
    ]

    const meta = this.headerMetadata(
      {
        companyHeader: options?.companyHeader,
        locationId: report.locationId,
        locationName: report.locationName,
        startDate: report.dateFrom,
        endDate: report.dateTo,
      },
      false
    )
    if (!report.locationId) meta.push('SEDE: Consolidado de todas las sedes')
    meta.push(`MARGEN BRUTO: ${report.grossMarginPercent} % | MARGEN NETO: ${report.netMarginPercent} %`)

    const filenameBase = `estado_resultados_${report.dateFrom}_${report.dateTo}`
    this.writeFile({
      format,
      title: 'ESTADO DE RESULTADOS INTEGRAL',
      sheetName: 'Estado de Resultados',
      filenameBase,
      columns,
      rows,
      meta,
      json: () => ({ modulo: 'Contabilidad - Estado de Resultados', estadoResultados: report }),
    })

    return { count: rows.length, filename: filenameBase }
  }

  // =========================================================================
  // 7. BALANCE DE COMPROBACIÓN (SUMAS Y SALDOS) - CONFIGURABLE CON TERCEROS
  // =========================================================================

  /** Débitos/créditos por cuenta calculados en memoria (respaldo cuando no hay totales de la base). */
  private totalsFromMovements(
    movements: AccountingMovement[],
    startDate: string,
    endDate: string,
    locationId?: string
  ): TrialBalanceTotals {
    const opening: AccountMovementTotalsMap = new Map()
    const period: AccountMovementTotalsMap = new Map()
    for (const m of movements) {
      if (locationId && locationId !== 'ALL' && m.locationId !== locationId) continue
      const date = (m.date || '').slice(0, 10)
      if (date > endDate) continue
      const target = date < startDate ? opening : period
      const current = target.get(m.accountId) || { debit: 0, credit: 0 }
      current.debit += Number(m.debit) || 0
      current.credit += Number(m.credit) || 0
      target.set(m.accountId, current)
    }
    return { opening, period }
  }

  /** Desglose por tercero de los movimientos de una cuenta y su subárbol. */
  private thirdPartyBreakdown(
    node: FinancialStatementNode,
    movements: AccountingMovement[],
    startDate: string,
    endDate: string
  ): TrialBalanceThirdPartyDetail[] | undefined {
    const tpMap = new Map<
      string,
      { docNumber: string; name: string; priorDebits: number; priorCredits: number; periodDebit: number; periodCredit: number }
    >()

    for (const m of movements) {
      if (!isPucDescendantOrSelf(m.accountCode, node.code)) continue
      const mDate = (m.date || '').slice(0, 10)
      if (mDate > endDate) continue
      const docKey = m.thirdPartyDoc || m.thirdPartyId || m.thirdPartyName || 'SIN_TERCERO'
      const existing = tpMap.get(docKey) || {
        docNumber: m.thirdPartyDoc || '',
        name: m.thirdPartyName || 'Sin tercero',
        priorDebits: 0,
        priorCredits: 0,
        periodDebit: 0,
        periodCredit: 0,
      }
      if (mDate < startDate) {
        existing.priorDebits += Number(m.debit) || 0
        existing.priorCredits += Number(m.credit) || 0
      } else {
        existing.periodDebit += Number(m.debit) || 0
        existing.periodCredit += Number(m.credit) || 0
      }
      tpMap.set(docKey, existing)
    }

    const list: TrialBalanceThirdPartyDetail[] = []
    for (const val of tpMap.values()) {
      const init = node.nature === 'DEBIT' ? val.priorDebits - val.priorCredits : val.priorCredits - val.priorDebits
      const final =
        node.nature === 'DEBIT' ? init + val.periodDebit - val.periodCredit : init + val.periodCredit - val.periodDebit
      if (isZeroAmount(init) && isZeroAmount(val.periodDebit) && isZeroAmount(val.periodCredit) && isZeroAmount(final)) {
        continue
      }
      list.push({
        docType: '',
        docNumber: val.docNumber,
        name: val.name,
        initialBalance: roundCurrency(init),
        debit: roundCurrency(val.periodDebit),
        credit: roundCurrency(val.periodCredit),
        finalBalance: roundCurrency(final),
      })
    }
    list.sort((a, b) => a.name.localeCompare(b.name))
    return list.length > 0 ? list : undefined
  }

  /**
   * Construye el Balance de Comprobación por niveles del PUC.
   * - Importes: `totals` (base de datos, fn_accounting_account_balances_range) si se entregan; si no,
   *   se calculan con los movimientos cargados en memoria.
   * - Cada nivel suma su subárbol (account-tree); el rango de cuentas se aplica a los importes.
   * - Desglose por tercero (en memoria) solo en las filas cuyos hijos no se muestran.
   */
  buildTrialBalanceData(params: {
    accounts: AccountingAccount[]
    movements: AccountingMovement[]
    thirdParties: ThirdParty[]
    options?: AccountingExportFilterOptions
    totals?: TrialBalanceTotals | null
  }): TrialBalanceReportData {
    const { accounts, movements, options } = params

    const today = todayBogotaIsoDate()
    const startDate = options?.startDate || `${today.slice(0, 4)}-01-01`
    const endDate = options?.endDate || today

    const mainAccountCode =
      options?.mainAccountCode && options.mainAccountCode !== 'ALL' ? options.mainAccountCode.trim() : 'ALL'
    const maxLevel: TrialBalanceLevelFilter = options?.maxLevel || 'SUBACCOUNT'
    const maxLevelNumber = TRIAL_BALANCE_LEVEL_NUMBER[maxLevel] || 4
    const includeThirdParties = options?.includeThirdParties ?? true
    const hideZeroBalances = options?.hideZeroBalances ?? true
    const range = this.accountRangeOf(options)

    const totals = params.totals || this.totalsFromMovements(movements, startDate, endDate, options?.locationId)
    const classes = /^\d$/.test(mainAccountCode) ? [Number(mainAccountCode)] : undefined

    let tree = buildAccountTree(accounts, totals.period, { classes, range, openingTotals: totals.opening })
    if (hideZeroBalances) tree = pruneZeroNodes(tree)

    const scopedMovements =
      includeThirdParties
        ? this.filterMovements(movements, {
            startAccountCode: range.from || undefined,
            endAccountCode: range.to || undefined,
            locationId: options?.locationId,
          })
        : []

    const rows: TrialBalanceRow[] = flattenAccountTree(tree, maxLevelNumber)
      .filter(({ node }) => mainAccountCode === 'ALL' || classes || isPucDescendantOrSelf(node.code, mainAccountCode))
      .map(({ node }) => {
        const childrenHidden = node.children.length === 0 || node.levelNumber >= maxLevelNumber
        return {
          code: node.code,
          name: node.name,
          accountClass: node.accountClass,
          level: node.level,
          nature: node.nature,
          initialBalance: node.openingBalance,
          debit: node.debit,
          credit: node.credit,
          finalBalance: node.balance,
          hasMovements: nodeHasActivity(node),
          thirdParties:
            includeThirdParties && childrenHidden
              ? this.thirdPartyBreakdown(node, scopedMovements, startDate, endDate)
              : undefined,
        }
      })

    // Sumas iguales: débitos y créditos del periodo de las raíces (cada una incluye su subárbol).
    const roots = tree.filter((root) => mainAccountCode === 'ALL' || classes || isPucDescendantOrSelf(root.code, mainAccountCode))
    let totalDebit = 0
    let totalCredit = 0
    let totalInitialDebit = 0
    let totalInitialCredit = 0
    let totalFinalDebit = 0
    let totalFinalCredit = 0
    const addBySide = (value: number, nature: 'DEBIT' | 'CREDIT', side: 'initial' | 'final') => {
      const isDebitSide = (nature === 'DEBIT') === value >= 0
      if (side === 'initial') {
        if (isDebitSide) totalInitialDebit += Math.abs(value)
        else totalInitialCredit += Math.abs(value)
      } else if (isDebitSide) totalFinalDebit += Math.abs(value)
      else totalFinalCredit += Math.abs(value)
    }
    for (const root of roots) {
      totalDebit += root.debit
      totalCredit += root.credit
      addBySide(root.openingBalance, root.nature, 'initial')
      addBySide(root.balance, root.nature, 'final')
    }

    const mainAccountObj = accounts.find((a) => a.code === mainAccountCode)
    const mainAccountName = mainAccountObj
      ? `${mainAccountObj.code} - ${mainAccountObj.name}`
      : mainAccountCode === 'ALL'
      ? 'Todas las clases'
      : mainAccountCode

    const voucherType = options?.voucherType || 'TODOS'
    const selectedThirdPartyName =
      options?.selectedThirdPartyId && options.selectedThirdPartyId !== 'ALL'
        ? params.thirdParties.find(
            (tp) => tp.id === options.selectedThirdPartyId || tp.documentNumber === options.selectedThirdPartyId
          )?.companyName || options.selectedThirdPartyId
        : undefined

    const company = options?.companyHeader
    const locationName =
      options?.locationId && options.locationId !== 'ALL' ? options.locationName || options.locationId : undefined

    return {
      companyName: company?.legalName || '',
      companyNit: formatCompanyNit(company?.taxId, company?.verificationDigit),
      startDate,
      endDate,
      branch: locationName || 'Todas las sedes',
      locationName,
      startAccountCode: range.from || undefined,
      endAccountCode: range.to || undefined,
      accountRangeLabel: formatPucRangeLabel(range),
      voucherType: voucherType !== 'TODOS' ? voucherType : undefined,
      selectedThirdPartyName,
      mainAccountCode,
      mainAccountName,
      maxLevel,
      includeThirdParties,
      rows,
      totalInitialDebit: roundCurrency(totalInitialDebit),
      totalInitialCredit: roundCurrency(totalInitialCredit),
      totalDebit: roundCurrency(totalDebit),
      totalCredit: roundCurrency(totalCredit),
      totalFinalDebit: roundCurrency(totalFinalDebit),
      totalFinalCredit: roundCurrency(totalFinalCredit),
      isBalanced: isZeroAmount(totalDebit - totalCredit),
      generatedAt: formatNowBogota(),
    }
  }

  /** Metadatos del Balance de Comprobación (CSV y Excel). */
  private trialBalanceMetadata(report: TrialBalanceReportData): string[] {
    return [
      ...(report.companyName ? [`EMPRESA: ${report.companyName}`] : []),
      ...(report.companyNit ? [`NIT: ${report.companyNit}`] : []),
      `PERIODO: ${formatIsoDateEs(report.startDate)} al ${formatIsoDateEs(report.endDate)}`,
      `SEDE: ${report.branch || 'Todas las sedes'}`,
      `RANGO DE CUENTAS: ${report.accountRangeLabel}`,
      `CLASE PRINCIPAL: ${report.mainAccountName}`,
      `NIVEL MÁXIMO: ${ACCOUNT_LEVEL_LABEL[report.maxLevel as keyof typeof ACCOUNT_LEVEL_LABEL] || 'Auxiliar'}`,
      `INCLUYE TERCEROS: ${report.includeThirdParties ? 'SÍ' : 'NO'}`,
      `SUMAS IGUALES: ${report.isBalanced ? 'SÍ (DÉBITOS = CRÉDITOS)' : 'NO (DESCUADRADO)'}`,
      `FECHA DE GENERACIÓN: ${report.generatedAt}`,
    ]
  }

  /** Filas planas (cuentas + terceros + totales) del Balance de Comprobación. */
  private trialBalanceFlatRows(report: TrialBalanceReportData): Array<Record<string, any>> {
    const flatRows: Array<Record<string, any>> = []
    for (const row of report.rows) {
      flatRows.push({
        codigo: row.code,
        concepto: row.name,
        nivel: ACCOUNT_LEVEL_LABEL[row.level] || row.level,
        naturaleza: row.nature === 'DEBIT' ? 'Débito' : 'Crédito',
        saldoInicial: row.initialBalance,
        debito: row.debit,
        credito: row.credit,
        saldoFinal: row.finalBalance,
      })
      if (report.includeThirdParties && row.thirdParties) {
        for (const tp of row.thirdParties) {
          flatRows.push({
            codigo: row.code,
            concepto: `    Tercero: ${tp.docNumber ? `${tp.docNumber} - ` : ''}${tp.name}`,
            nivel: 'Tercero',
            naturaleza: row.nature === 'DEBIT' ? 'Débito' : 'Crédito',
            saldoInicial: tp.initialBalance,
            debito: tp.debit,
            credito: tp.credit,
            saldoFinal: tp.finalBalance,
          })
        }
      }
    }
    flatRows.push({
      codigo: 'TOTALES',
      concepto: 'SUMAS DEL PERIODO',
      nivel: '',
      naturaleza: '',
      saldoInicial: roundCurrency(report.totalInitialDebit - report.totalInitialCredit),
      debito: report.totalDebit,
      credito: report.totalCredit,
      saldoFinal: roundCurrency(report.totalFinalDebit - report.totalFinalCredit),
    })
    return flatRows
  }

  private readonly trialBalanceColumns: ColumnDef[] = [
    { key: 'codigo', header: 'Código PUC' },
    { key: 'concepto', header: 'Cuenta / Tercero' },
    { key: 'nivel', header: 'Nivel' },
    { key: 'naturaleza', header: 'Naturaleza' },
    { key: 'saldoInicial', header: 'Saldo Anterior (COP)', type: 'number' },
    { key: 'debito', header: 'Débito Periodo (COP)', type: 'number' },
    { key: 'credito', header: 'Crédito Periodo (COP)', type: 'number' },
    { key: 'saldoFinal', header: 'Saldo Final (COP)', type: 'number' },
  ]

  /**
   * Exporta el Balance de Comprobación a CSV con formato y soporte de terceros
   */
  exportTrialBalanceCSV(report: TrialBalanceReportData): { filename: string; count: number } {
    const csv = this.generateCSV(
      'BALANCE DE COMPROBACIÓN (SUMAS Y SALDOS)',
      this.trialBalanceColumns,
      this.trialBalanceFlatRows(report),
      this.trialBalanceMetadata(report)
    )
    const filename = `balance_comprobacion_${report.startDate}_${report.endDate}.csv`
    this.triggerDownload(csv, filename, 'text/csv;charset=utf-8;')
    return { filename, count: report.rows.length }
  }

  /**
   * Exporta el Balance de Comprobación a formato Excel XML (.xls)
   */
  exportTrialBalanceExcel(report: TrialBalanceReportData): { filename: string; count: number } {
    const xml = this.generateExcelXML(
      'Balance Comprobación',
      'BALANCE DE COMPROBACIÓN (SUMAS Y SALDOS)',
      this.trialBalanceColumns,
      this.trialBalanceFlatRows(report),
      this.trialBalanceMetadata(report)
    )
    const filename = `balance_comprobacion_${report.startDate}_${report.endDate}.xls`
    this.triggerDownload(xml, filename, 'application/vnd.ms-excel;charset=utf-8;')
    return { filename, count: report.rows.length }
  }
}

export const accountingExportService = new AccountingExportService()
