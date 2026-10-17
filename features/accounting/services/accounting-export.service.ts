/**
 * SUPER MÁS ERP/POS - Servicio Especializado de Exportación Contable
 *
 * Soporta exportación completa con filtros opcionales de fechas, roles y clasificaciones para:
 * 1. Terceros (DIAN) - Directorio de clientes, proveedores, empleados y acreedores
 * 2. Asientos Contables - Comprobantes con partida doble y estados fiduciarios
 * 3. Libro Auxiliar de Movimientos - Detalle de cuentas, débitos, créditos y saldos
 * 4. Plan Único de Cuentas (PUC) - Catálogo maestro de cuentas contables
 * 5. Libro Diario - Transacciones cronológicas
 * 6. Balance General - Sumas y saldos
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
  AccountingExportType,
  AccountingExportFormat,
  AccountingExportFilterOptions,
  TrialBalanceReportData,
  TrialBalanceRow,
  TrialBalanceThirdPartyDetail,
  TrialBalanceLevelFilter,
} from '../types'

interface ColumnDef {
  key: string
  header: string
  type?: 'string' | 'number' | 'date'
}

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
   * Filtra asientos contables según fechas, estados y búsqueda
   */
  filterEntries(
    entries: AccountingEntry[],
    options?: AccountingExportFilterOptions
  ): AccountingEntry[] {
    if (!options) return entries

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

  /**
   * Filtra movimientos del libro auxiliar según fechas y búsqueda
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

      if (options.startAccountCode && m.accountCode < options.startAccountCode) {
        return false
      }

      if (options.endAccountCode && m.accountCode > options.endAccountCode + '\uffff') {
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
   * Filtra cuentas del PUC según búsqueda y fechas opcionales
   */
  filterAccounts(
    accounts: AccountingAccount[],
    options?: AccountingExportFilterOptions
  ): AccountingAccount[] {
    if (!options) return accounts

    return accounts.filter((a) => {
      if (options.startDate || options.endDate) {
        if (!this.isDateInRange(a.createdAt, options.startDate, options.endDate)) {
          return false
        }
      }

      if (options.searchQuery?.trim()) {
        const q = options.searchQuery.toLowerCase().trim()
        const matchCode = (a.code || '').toLowerCase().includes(q)
        const matchName = (a.name || '').toLowerCase().includes(q)
        if (!matchCode && !matchName) return false
      }

      return true
    })
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
    const BOM = '\uFEFF'
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
      `"SISTEMA: SUPER MÁS ERP/POS"`,
      `"REPORTE: ${title}"`,
      `"FECHA DE GENERACIÓN: ${new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' })}"`,
      ...metadataItems.map((item) => `"${item.replace(/"/g, '""')}"`),
      `"TOTAL REGISTROS EXPORTADOS: ${rows.length}"`,
      '',
    ].join('\r\n')

    return `${BOM}${metaBlock}\r\n${headerLine}\r\n${dataLines.join('\r\n')}`
  }

  /**
   * Genera el archivo XML para apertura nativa y formateada en Excel
   */
  private generateExcelXML(
    title: string,
    columns: ColumnDef[],
    rows: Array<Record<string, any>>
  ): string {
    const headerCells = columns
      .map(
        (c) =>
          `<Cell ss:StyleID="Header"><Data ss:Type="String">${this.escapeXml(c.header)}</Data></Cell>`
      )
      .join('')

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
 <Worksheet ss:Name="${this.escapeXml(title.slice(0, 30))}">
  <Table>
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
    const dateStr = new Date().toISOString().slice(0, 10)
    const filenameBase = `terceros_dian_supermas_${dateStr}`

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
      tipoDocumento: tp.documentType || 'CC',
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
      ciudad: tp.city || 'Medellín',
      departamento: tp.department || 'Antioquia',
      estado: tp.isActive ? 'Activo' : 'Inactivo',
      fechaRegistro: tp.createdAt ? tp.createdAt.slice(0, 10) : '',
    }))

    const meta: string[] = []
    if (options?.startDate || options?.endDate) {
      meta.push(`RANGO DE FECHAS: ${options.startDate || 'Inicio'} hasta ${options.endDate || 'Hoy'}`)
    }
    if (options?.thirdPartyType && options.thirdPartyType !== 'ALL') {
      meta.push(`ROL FILTRADO: ${options.thirdPartyType}`)
    }
    if (options?.legalNature && options.legalNature !== 'ALL') {
      meta.push(`NATURALEZA FILTRADA: ${options.legalNature}`)
    }

    if (format === 'CSV') {
      const csv = this.generateCSV('DIRECTORIO DE TERCEROS (DIAN)', columns, rows, meta)
      this.triggerDownload(csv, `${filenameBase}.csv`, 'text/csv;charset=utf-8;')
    } else if (format === 'EXCEL') {
      const xml = this.generateExcelXML('Terceros DIAN', columns, rows)
      this.triggerDownload(xml, `${filenameBase}.xls`, 'application/vnd.ms-excel;charset=utf-8;')
    } else {
      const json = JSON.stringify(
        {
          sistema: 'SUPER MÁS ERP/POS',
          modulo: 'Contabilidad - Terceros DIAN',
          fechaGeneracion: new Date().toISOString(),
          filtros: options || null,
          total: filtered.length,
          terceros: filtered,
        },
        null,
        2
      )
      this.triggerDownload(json, `${filenameBase}.json`, 'application/json;charset=utf-8;')
    }

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
    const dateStr = new Date().toISOString().slice(0, 10)
    const filenameBase = `asientos_contables_supermas_${dateStr}`

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

    const meta: string[] = []
    if (options?.startDate || options?.endDate) {
      meta.push(`RANGO DE FECHAS: ${options.startDate || 'Inicio'} hasta ${options.endDate || 'Hoy'}`)
    }
    if (options?.entryStatus && options.entryStatus !== 'ALL') {
      meta.push(`ESTADO FILTRADO: ${options.entryStatus}`)
    }

    if (format === 'CSV') {
      const csv = this.generateCSV('COMPROBANTES Y ASIENTOS CONTABLES', columns, rows, meta)
      this.triggerDownload(csv, `${filenameBase}.csv`, 'text/csv;charset=utf-8;')
    } else if (format === 'EXCEL') {
      const xml = this.generateExcelXML('Asientos Contables', columns, rows)
      this.triggerDownload(xml, `${filenameBase}.xls`, 'application/vnd.ms-excel;charset=utf-8;')
    } else {
      const json = JSON.stringify(
        {
          sistema: 'SUPER MÁS ERP/POS',
          modulo: 'Contabilidad - Asientos Contables',
          fechaGeneracion: new Date().toISOString(),
          filtros: options || null,
          total: filtered.length,
          asientos: filtered,
        },
        null,
        2
      )
      this.triggerDownload(json, `${filenameBase}.json`, 'application/json;charset=utf-8;')
    }

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
    const filtered = this.filterMovements(movements, options)
    const dateStr = new Date().toISOString().slice(0, 10)
    const filenameBase = `libro_auxiliar_supermas_${dateStr}`

    const columns: ColumnDef[] = [
      { key: 'fecha', header: 'Fecha' },
      { key: 'comprobante', header: 'Comprobante' },
      { key: 'cuenta', header: 'Código Cuenta PUC' },
      { key: 'nombreCuenta', header: 'Nombre Cuenta' },
      { key: 'descripcion', header: 'Concepto Detalle' },
      { key: 'tercero', header: 'Tercero' },
      { key: 'bodega', header: 'Centro de Costo / Bodega' },
      { key: 'debito', header: 'Débito (COP)', type: 'number' },
      { key: 'credito', header: 'Crédito (COP)', type: 'number' },
      { key: 'saldo', header: 'Saldo Acumulado', type: 'number' },
    ]

    const rows = filtered.map((m: any) => ({
      fecha: m.date.slice(0, 10),
      comprobante: m.sourceDocumentNumber || m.entryNumber,
      cuenta: m.accountCode,
      nombreCuenta: m.accountName,
      descripcion: m.description,
      tercero: m.thirdPartyName || '',
      bodega: m.costCenterName || m.locationName || '',
      debito: m.debit,
      credito: m.credit,
      saldo: m.runningBalance ?? m.balanceAfter ?? 0,
    }))

    const meta: string[] = []
    if (options?.startDate || options?.endDate) {
      meta.push(`RANGO DE FECHAS: ${options.startDate || 'Inicio'} hasta ${options.endDate || 'Hoy'}`)
    }

    if (format === 'CSV') {
      const csv = this.generateCSV('LIBRO AUXILIAR CONTABLE', columns, rows, meta)
      this.triggerDownload(csv, `${filenameBase}.csv`, 'text/csv;charset=utf-8;')
    } else if (format === 'EXCEL') {
      const xml = this.generateExcelXML('Libro Auxiliar', columns, rows)
      this.triggerDownload(xml, `${filenameBase}.xls`, 'application/vnd.ms-excel;charset=utf-8;')
    } else {
      const json = JSON.stringify(
        {
          sistema: 'SUPER MÁS ERP/POS',
          modulo: 'Contabilidad - Libro Auxiliar',
          fechaGeneracion: new Date().toISOString(),
          filtros: options || null,
          total: filtered.length,
          movimientos: filtered,
        },
        null,
        2
      )
      this.triggerDownload(json, `${filenameBase}.json`, 'application/json;charset=utf-8;')
    }

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
    const dateStr = new Date().toISOString().slice(0, 10)
    const filenameBase = `plan_cuentas_puc_${dateStr}`

    const columns: ColumnDef[] = [
      { key: 'codigo', header: 'Código Cuenta PUC' },
      { key: 'nombre', header: 'Nombre Cuenta' },
      { key: 'clase', header: 'Clase PUC' },
      { key: 'tipo', header: 'Tipo Contable' },
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
      tipo: a.type,
      naturaleza: a.nature === 'DEBIT' ? 'Débito' : 'Crédito',
      nivel: a.level,
      saldo: a.balance,
      exigeTercero: a.requiresThirdParty ? 'Sí' : 'No',
      exigeCentroCosto: a.requiresCostCenter ? 'Sí' : 'No',
      estado: a.status === 'ACTIVE' ? 'Activo' : 'Inactivo',
    }))

    if (format === 'CSV') {
      const csv = this.generateCSV('PLAN ÚNICO DE CUENTAS (PUC COLOMBIA)', columns, rows)
      this.triggerDownload(csv, `${filenameBase}.csv`, 'text/csv;charset=utf-8;')
    } else if (format === 'EXCEL') {
      const xml = this.generateExcelXML('PUC Colombia', columns, rows)
      this.triggerDownload(xml, `${filenameBase}.xls`, 'application/vnd.ms-excel;charset=utf-8;')
    } else {
      const json = JSON.stringify(
        {
          sistema: 'SUPER MÁS ERP/POS',
          modulo: 'Contabilidad - Plan Único de Cuentas',
          fechaGeneracion: new Date().toISOString(),
          total: filtered.length,
          cuentas: filtered,
        },
        null,
        2
      )
      this.triggerDownload(json, `${filenameBase}.json`, 'application/json;charset=utf-8;')
    }

    return { count: filtered.length, filename: filenameBase }
  }

  /**
   * 5. Exportar Libro Diario
   */
  exportJournal(
    entries: AccountingEntry[],
    format: AccountingExportFormat = 'CSV',
    options?: AccountingExportFilterOptions
  ): { count: number; filename: string } {
    return this.exportEntries(entries, format, options)
  }

  /**
   * 6. Exportar Balance General
   */
  exportBalance(
    accounts: AccountingAccount[],
    format: AccountingExportFormat = 'CSV',
    options?: AccountingExportFilterOptions
  ): { count: number; filename: string } {
    const filtered = this.filterAccounts(accounts, options)
    const dateStr = new Date().toISOString().slice(0, 10)
    const filenameBase = `balance_general_supermas_${dateStr}`

    const columns: ColumnDef[] = [
      { key: 'codigo', header: 'Código Cuenta' },
      { key: 'nombre', header: 'Nombre Cuenta' },
      { key: 'clase', header: 'Clase' },
      { key: 'naturaleza', header: 'Naturaleza' },
      { key: 'saldo', header: 'Saldo (COP)', type: 'number' },
    ]

    const rows = filtered.map((a) => ({
      codigo: a.code,
      nombre: a.name,
      clase: `Clase ${a.accountClass}`,
      naturaleza: a.nature === 'DEBIT' ? 'Débito' : 'Crédito',
      saldo: a.balance,
    }))

    if (format === 'CSV') {
      const csv = this.generateCSV('BALANCE GENERAL Y SALDOS CONTABLES', columns, rows)
      this.triggerDownload(csv, `${filenameBase}.csv`, 'text/csv;charset=utf-8;')
    } else if (format === 'EXCEL') {
      const xml = this.generateExcelXML('Balance General', columns, rows)
      this.triggerDownload(xml, `${filenameBase}.xls`, 'application/vnd.ms-excel;charset=utf-8;')
    } else {
      const json = JSON.stringify(
        {
          sistema: 'SUPER MÁS ERP/POS',
          modulo: 'Contabilidad - Balance General',
          fechaGeneracion: new Date().toISOString(),
          total: filtered.length,
          cuentas: filtered,
        },
        null,
        2
      )
      this.triggerDownload(json, `${filenameBase}.json`, 'application/json;charset=utf-8;')
    }

    return { count: filtered.length, filename: filenameBase }
  }

  // =========================================================================
  // 7. BALANCE DE COMPROBACIÓN (SUMAS Y SALDOS) - CONFIGURABLE CON TERCEROS
  // =========================================================================

  /**
   * Construye la estructura de datos del Balance de Comprobación filtrado
   * por cuenta principal, nivel jerárquico hasta subcuenta, fechas y terceros.
   */
  buildTrialBalanceData(params: {
    accounts: AccountingAccount[]
    movements: AccountingMovement[]
    thirdParties: ThirdParty[]
    options?: AccountingExportFilterOptions
  }): TrialBalanceReportData {
    const { accounts, movements, options } = params

    const now = new Date()
    const currentYear = now.getFullYear()
    const currentMonth = String(now.getMonth() + 1).padStart(2, '0')
    const startDate = options?.startDate || `${currentYear}-01-01`
    const endDate =
      options?.endDate || `${currentYear}-${currentMonth}-${String(now.getDate()).padStart(2, '0')}`

    const mainAccountCode =
      options?.mainAccountCode && options.mainAccountCode !== 'ALL'
        ? options.mainAccountCode.trim()
        : 'ALL'

    const maxLevel: TrialBalanceLevelFilter = options?.maxLevel || 'SUBACCOUNT'
    const includeThirdParties = options?.includeThirdParties ?? true
    const hideZeroBalances = options?.hideZeroBalances ?? true

    // Longitud máxima de código según nivel jerárquico solicitado
    let maxDigits = 6 // Subcuenta por defecto
    if (maxLevel === 'CLASS') maxDigits = 1
    else if (maxLevel === 'GROUP') maxDigits = 2
    else if (maxLevel === 'ACCOUNT') maxDigits = 4
    else if (maxLevel === 'SUBACCOUNT') maxDigits = 6
    else if (maxLevel === 'AUXILIARY' || maxLevel === 'ALL') maxDigits = 12

    const startAccountCode = options?.startAccountCode?.trim() || ''
    const endAccountCode = options?.endAccountCode?.trim() || ''

    // 1. Filtrar cuentas por cuenta principal, rango y nivel jerárquico
    const targetAccounts = accounts.filter((acc) => {
      if (mainAccountCode !== 'ALL' && !acc.code.startsWith(mainAccountCode)) {
        return false
      }
      if (startAccountCode && acc.code < startAccountCode) {
        return false
      }
      if (endAccountCode && acc.code > endAccountCode + '\uffff') {
        return false
      }
      if (acc.code.length > maxDigits) {
        return false
      }
      return true
    })

    // Ordenar de menor a mayor código PUC
    targetAccounts.sort((a, b) => a.code.localeCompare(b.code))

    // 2. Calcular saldos para cada cuenta agregando sus movimientos hijos
    const rows: TrialBalanceRow[] = []

    for (const acc of targetAccounts) {
      // Movimientos que pertenecen a esta cuenta o subcuentas dependientes
      const matchingMovements = movements.filter((m) => m.accountCode.startsWith(acc.code))

      // Saldo anterior a startDate
      const priorMovements = matchingMovements.filter((m) => m.date.slice(0, 10) < startDate)
      const priorDebits = priorMovements.reduce((sum, m) => sum + (Number(m.debit) || 0), 0)
      const priorCredits = priorMovements.reduce((sum, m) => sum + (Number(m.credit) || 0), 0)

      const initialBalance =
        acc.nature === 'DEBIT'
          ? priorDebits - priorCredits
          : priorCredits - priorDebits

      // Movimientos dentro del periodo [startDate, endDate]
      const periodMovements = matchingMovements.filter(
        (m) => m.date.slice(0, 10) >= startDate && m.date.slice(0, 10) <= endDate
      )
      const periodDebit = periodMovements.reduce((sum, m) => sum + (Number(m.debit) || 0), 0)
      const periodCredit = periodMovements.reduce((sum, m) => sum + (Number(m.credit) || 0), 0)

      const finalBalance =
        acc.nature === 'DEBIT'
          ? initialBalance + periodDebit - periodCredit
          : initialBalance + periodCredit - periodDebit

      const hasActivity =
        Math.abs(initialBalance) > 0.001 ||
        periodDebit > 0.001 ||
        periodCredit > 0.001 ||
        Math.abs(finalBalance) > 0.001

      // 3. Desglose detallado por Terceros si está activado
      let thirdPartyDetails: TrialBalanceThirdPartyDetail[] | undefined = undefined

      if (includeThirdParties && matchingMovements.length > 0) {
        const tpMap = new Map<
          string,
          {
            docNumber: string
            docType: string
            name: string
            priorDebits: number
            priorCredits: number
            periodDebit: number
            periodCredit: number
          }
        >()

        for (const m of matchingMovements) {
          const docKey =
            (m as any).thirdPartyDoc ||
            (m as any).thirdPartyId ||
            (m as any).thirdPartyName ||
            'SIN_TERCERO'
          const existing = tpMap.get(docKey) || {
            docNumber: (m as any).thirdPartyDoc || '',
            docType: 'NIT',
            name: (m as any).thirdPartyName || 'Sin Tercero Especificado',
            priorDebits: 0,
            priorCredits: 0,
            periodDebit: 0,
            periodCredit: 0,
          }

          const mDate = m.date.slice(0, 10)
          if (mDate < startDate) {
            existing.priorDebits += Number(m.debit) || 0
            existing.priorCredits += Number(m.credit) || 0
          } else if (mDate <= endDate) {
            existing.periodDebit += Number(m.debit) || 0
            existing.periodCredit += Number(m.credit) || 0
          }

          tpMap.set(docKey, existing)
        }

        const tpList: TrialBalanceThirdPartyDetail[] = []
        for (const [, val] of tpMap.entries()) {
          const tpInit =
            acc.nature === 'DEBIT'
              ? val.priorDebits - val.priorCredits
              : val.priorCredits - val.priorDebits
          const tpFinal =
            acc.nature === 'DEBIT'
              ? tpInit + val.periodDebit - val.periodCredit
              : tpInit + val.periodCredit - val.periodDebit

          if (
            Math.abs(tpInit) > 0.001 ||
            val.periodDebit > 0.001 ||
            val.periodCredit > 0.001 ||
            Math.abs(tpFinal) > 0.001
          ) {
            tpList.push({
              docType: val.docType,
              docNumber: val.docNumber,
              name: val.name,
              initialBalance: Math.round(tpInit * 100) / 100,
              debit: Math.round(val.periodDebit * 100) / 100,
              credit: Math.round(val.periodCredit * 100) / 100,
              finalBalance: Math.round(tpFinal * 100) / 100,
            })
          }
        }

        tpList.sort((a, b) => a.name.localeCompare(b.name))
        if (tpList.length > 0) {
          thirdPartyDetails = tpList
        }
      }

      if (!hideZeroBalances || hasActivity) {
        rows.push({
          code: acc.code,
          name: acc.name,
          accountClass: acc.accountClass,
          level: acc.level,
          nature: acc.nature,
          initialBalance: Math.round(initialBalance * 100) / 100,
          debit: Math.round(periodDebit * 100) / 100,
          credit: Math.round(periodCredit * 100) / 100,
          finalBalance: Math.round(finalBalance * 100) / 100,
          hasMovements: hasActivity,
          thirdParties: thirdPartyDetails,
        })
      }
    }

    // 4. Totales de movimientos y saldos del periodo
    const scopeMovements = movements.filter((m) => {
      if (mainAccountCode !== 'ALL' && !m.accountCode.startsWith(mainAccountCode)) {
        return false
      }
      const mDate = m.date.slice(0, 10)
      return mDate >= startDate && mDate <= endDate
    })

    const totalDebit = scopeMovements.reduce((sum, m) => sum + (Number(m.debit) || 0), 0)
    const totalCredit = scopeMovements.reduce((sum, m) => sum + (Number(m.credit) || 0), 0)

    // Totales de saldos de las cuentas de mayor jerarquía en el reporte para evitar duplicidad
    const minLength = rows.length > 0 ? Math.min(...rows.map((r) => r.code.length)) : 1
    const topRows = rows.filter((r) => r.code.length === minLength)

    let totalInitialDebit = 0
    let totalInitialCredit = 0
    let totalFinalDebit = 0
    let totalFinalCredit = 0

    for (const tr of topRows) {
      if (tr.nature === 'DEBIT') {
        if (tr.initialBalance >= 0) totalInitialDebit += tr.initialBalance
        else totalInitialCredit += Math.abs(tr.initialBalance)

        if (tr.finalBalance >= 0) totalFinalDebit += tr.finalBalance
        else totalFinalCredit += Math.abs(tr.finalBalance)
      } else {
        if (tr.initialBalance >= 0) totalInitialCredit += tr.initialBalance
        else totalInitialDebit += Math.abs(tr.initialBalance)

        if (tr.finalBalance >= 0) totalFinalCredit += tr.finalBalance
        else totalFinalDebit += Math.abs(tr.finalBalance)
      }
    }

    const mainAccountObj = accounts.find((a) => a.code === mainAccountCode)
    const mainAccountName = mainAccountObj
      ? `${mainAccountObj.code} - ${mainAccountObj.name}`
      : mainAccountCode === 'ALL'
      ? 'Todas las Clases (1 a 7)'
      : mainAccountCode

    const branch = options?.branch || '01 - SUPER MÁS PRINCIPAL'
    const costCenter = options?.costCenter || 'TODOS'
    const administrativeArea = options?.administrativeArea || 'TODAS'
    const voucherType = options?.voucherType || 'TODOS'
    const selectedThirdPartyName =
      options?.selectedThirdPartyId && options.selectedThirdPartyId !== 'ALL'
        ? params.thirdParties.find(
            (tp) => tp.id === options.selectedThirdPartyId || tp.documentNumber === options.selectedThirdPartyId
          )?.companyName || options.selectedThirdPartyId
        : undefined

    return {
      companyName: 'DISTRIBUIDORA SUPER MÁS S.A.S.',
      companyNit: '901.823.456-1',
      startDate,
      endDate,
      branch,
      costCenter,
      administrativeArea,
      startAccountCode: startAccountCode || undefined,
      endAccountCode: endAccountCode || undefined,
      voucherType: voucherType !== 'TODOS' ? voucherType : undefined,
      selectedThirdPartyName,
      mainAccountCode,
      mainAccountName,
      maxLevel,
      includeThirdParties,
      rows,
      totalInitialDebit: Math.round(totalInitialDebit * 100) / 100,
      totalInitialCredit: Math.round(totalInitialCredit * 100) / 100,
      totalDebit: Math.round(totalDebit * 100) / 100,
      totalCredit: Math.round(totalCredit * 100) / 100,
      totalFinalDebit: Math.round(totalFinalDebit * 100) / 100,
      totalFinalCredit: Math.round(totalFinalCredit * 100) / 100,
      isBalanced: Math.abs(totalDebit - totalCredit) < 0.01,
      generatedAt: new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' }),
    }
  }

  /**
   * Exporta el Balance de Comprobación a CSV con formato y soporte de terceros
   */
  exportTrialBalanceCSV(report: TrialBalanceReportData): { filename: string; count: number } {
    const BOM = '\uFEFF'
    const headers = [
      'Código PUC',
      'Cuenta / Subcuenta / Tercero',
      'Nivel Jerárquico',
      'Naturaleza',
      'Saldo Anterior (COP)',
      'Débito Periodo (COP)',
      'Crédito Periodo (COP)',
      'Saldo Final (COP)',
    ]

    const dataLines: string[] = []

    for (const row of report.rows) {
      dataLines.push(
        [
          `"${row.code}"`,
          `"${row.name.replace(/"/g, '""')}"`,
          `"${row.level}"`,
          `"${row.nature}"`,
          row.initialBalance,
          row.debit,
          row.credit,
          row.finalBalance,
        ].join(';')
      )

      if (report.includeThirdParties && row.thirdParties && row.thirdParties.length > 0) {
        for (const tp of row.thirdParties) {
          dataLines.push(
            [
              `"${row.code}-${tp.docNumber || 'SD'}"`,
              `"  ↳ ${tp.name.replace(/"/g, '""')} (${tp.docType} ${tp.docNumber})"`,
              `"TERCERO"`,
              `"${row.nature}"`,
              tp.initialBalance,
              tp.debit,
              tp.credit,
              tp.finalBalance,
            ].join(';')
          )
        }
      }
    }

    // Fila de Sumas Iguales
    dataLines.push(
      [
        `"TOTALES"`,
        `"SUMAS IGUALES DEL BALANCE DE COMPROBACIÓN"`,
        `"-"`,
        `"-"`,
        report.totalInitialDebit,
        report.totalDebit,
        report.totalCredit,
        report.totalFinalDebit,
      ].join(';')
    )

    const metaBlock = [
      `"EMPRESA: ${report.companyName}"`,
      `"NIT: ${report.companyNit}"`,
      `"REPORTE: BALANCE DE COMPROBACIÓN (SUMAS Y SALDOS)"`,
      `"PERIODO: ${report.startDate} al ${report.endDate}"`,
      `"CUENTA PRINCIPAL: ${report.mainAccountName}"`,
      `"NIVEL JERÁRQUICO: ${report.maxLevel}"`,
      `"INCLUYE INFORMACIÓN DE TERCEROS: ${report.includeThirdParties ? 'SÍ' : 'NO'}"`,
      `"ESTADO PARTIDA DOBLE: ${report.isBalanced ? 'CUADRADO (DÉBITO == CRÉDITO)' : 'DESCUADRADO'}"`,
      `"FECHA GENERACIÓN: ${report.generatedAt}"`,
      '',
    ].join('\r\n')

    const csvContent = `${BOM}${metaBlock}\r\n${headers.map((h) => `"${h}"`).join(';')}\r\n${dataLines.join('\r\n')}`
    const filename = `balance_comprobacion_supermas_${report.startDate}_${report.endDate}.csv`
    this.triggerDownload(csvContent, filename, 'text/csv;charset=utf-8;')

    return { filename, count: report.rows.length }
  }

  /**
   * Exporta el Balance de Comprobación a formato Excel XML (.xls)
   */
  exportTrialBalanceExcel(report: TrialBalanceReportData): { filename: string; count: number } {
    const columns: ColumnDef[] = [
      { key: 'codigo', header: 'Código PUC' },
      { key: 'concepto', header: 'Cuenta / Subcuenta / Tercero' },
      { key: 'nivel', header: 'Nivel Jerárquico' },
      { key: 'naturaleza', header: 'Naturaleza' },
      { key: 'saldoInicial', header: 'Saldo Anterior (COP)', type: 'number' },
      { key: 'debito', header: 'Débito Periodo (COP)', type: 'number' },
      { key: 'credito', header: 'Crédito Periodo (COP)', type: 'number' },
      { key: 'saldoFinal', header: 'Saldo Final (COP)', type: 'number' },
    ]

    const flatRows: Array<Record<string, any>> = []

    for (const row of report.rows) {
      flatRows.push({
        codigo: row.code,
        concepto: row.name,
        nivel: row.level,
        naturaleza: row.nature === 'DEBIT' ? 'Débito' : 'Crédito',
        saldoInicial: row.initialBalance,
        debito: row.debit,
        credito: row.credit,
        saldoFinal: row.finalBalance,
      })

      if (report.includeThirdParties && row.thirdParties && row.thirdParties.length > 0) {
        for (const tp of row.thirdParties) {
          flatRows.push({
            codigo: `${row.code}-${tp.docNumber}`,
            concepto: `  ↳ ${tp.name} (${tp.docType} ${tp.docNumber})`,
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

    // Totales
    flatRows.push({
      codigo: 'TOTALES',
      concepto: 'SUMAS IGUALES DEL BALANCE',
      nivel: 'Balance Cuadrado',
      naturaleza: '-',
      saldoInicial: report.totalInitialDebit,
      debito: report.totalDebit,
      credito: report.totalCredit,
      saldoFinal: report.totalFinalDebit,
    })

    const xml = this.generateExcelXML('Balance Comprobación', columns, flatRows)
    const filename = `balance_comprobacion_supermas_${report.startDate}_${report.endDate}.xls`
    this.triggerDownload(xml, filename, 'application/vnd.ms-excel;charset=utf-8;')

    return { filename, count: report.rows.length }
  }
}

export const accountingExportService = new AccountingExportService()
