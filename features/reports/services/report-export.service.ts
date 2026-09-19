/**
 * SUPER MÁS ERP/POS - Servicio de Exportación de Reportes (ReportExportService)
 *
 * Genera archivos estructurados para Excel (.xlsx / .xml / .csv), CSV estándar UTF-8 con BOM
 * y vistas optimizadas de Impresión / PDF.
 * La exportación se procesa fuera de los componentes React.
 */

import { ExportFormat } from '../types'

export interface ExportColumnDefinition {
  key: string
  header: string
  format?: 'currency' | 'number' | 'date' | 'text' | 'percent'
}

export class ReportExportService {
  /**
   * Formatea un valor para exportación según su tipo
   */
  private formatValue(value: unknown, format?: string): string {
    if (value === null || value === undefined) return ''

    if (typeof value === 'number') {
      if (format === 'currency') {
        return new Intl.NumberFormat('es-CO', {
          style: 'currency',
          currency: 'COP',
          maximumFractionDigits: 0,
        }).format(value)
      }
      if (format === 'percent') {
        return `${value.toFixed(1)}%`
      }
      return value.toLocaleString('es-CO')
    }

    if (format === 'date' && typeof value === 'string') {
      try {
        const d = new Date(value)
        return d.toLocaleDateString('es-CO', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
        })
      } catch {
        return String(value)
      }
    }

    return String(value).replace(/"/g, '""')
  }

  /**
   * Genera contenido CSV con codificación UTF-8 BOM para apertura perfecta en Excel
   */
  generateCSV(
    title: string,
    columns: ExportColumnDefinition[],
    rows: Array<Record<string, unknown>>
  ): string {
    const BOM = '\uFEFF'
    const headers = columns.map((c) => `"${c.header}"`).join(';')

    const dataLines = rows.map((row) =>
      columns
        .map((col) => {
          const raw = row[col.key]
          const formatted = this.formatValue(raw, col.format)
          return `"${formatted}"`
        })
        .join(';')
    )

    const metadata = [
      `"REPORTE: ${title}"`,
      `"FECHA GENERACIÓN: ${new Date().toLocaleString('es-CO')}"`,
      `"SISTEMA: SUPER MÁS ERP/POS"`,
      `"TOTAL REGISTROS: ${rows.length}"`,
      '',
    ].join('\r\n')

    return `${BOM}${metadata}\r\n${headers}\r\n${dataLines.join('\r\n')}`
  }

  /**
   * Genera archivo Spreadsheet XML para Excel nativo con tipado formal de celdas
   */
  generateExcelXML(
    title: string,
    columns: ExportColumnDefinition[],
    rows: Array<Record<string, unknown>>
  ): string {
    const headerCells = columns
      .map(
        (c) =>
          `<Cell ss:StyleID="Header"><Data ss:Type="String">${c.header}</Data></Cell>`
      )
      .join('')

    const rowCells = rows
      .map((row) => {
        const cells = columns
          .map((c) => {
            const raw = row[c.key]
            if (raw === null || raw === undefined) {
              return `<Cell><Data ss:Type="String"></Data></Cell>`
            }
            if (typeof raw === 'number') {
              return `<Cell ss:StyleID="${
                c.format === 'currency' ? 'Currency' : 'Number'
              }"><Data ss:Type="Number">${raw}</Data></Cell>`
            }
            return `<Cell><Data ss:Type="String">${String(raw)
              .replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')}</Data></Cell>`
          })
          .join('')
        return `<Row>${cells}</Row>`
      })
      .join('')

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
   <Borders/>
   <Font ss:FontName="Segoe UI" x:Family="Swiss" ss:Size="10" ss:Color="#1e293b"/>
  </Style>
  <Style ss:ID="Header">
   <Font ss:FontName="Segoe UI" ss:Size="10" ss:Color="#FFFFFF" ss:Bold="1"/>
   <Interior ss:Color="#0A2540" ss:Pattern="Solid"/>
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
  </Style>
  <Style ss:ID="Currency">
   <NumberFormat ss:Format="$#,##0"/>
  </Style>
  <Style ss:ID="Number">
   <NumberFormat ss:Format="#,##0"/>
  </Style>
 </Styles>
 <Worksheet ss:Name="${title.slice(0, 30)}">
  <Table>
   <Row ss:Height="24">${headerCells}</Row>
   ${rowCells}
  </Table>
 </Worksheet>
</Workbook>`
  }

  /**
   * Ejecuta la descarga en el navegador del cliente
   */
  downloadFile(content: string, filename: string, mimeType: string): void {
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

  /**
   * Exporta datos al formato seleccionado
   */
  exportReport(params: {
    format: ExportFormat
    title: string
    filenameBase: string
    columns: ExportColumnDefinition[]
    rows: Array<Record<string, unknown>>
  }): void {
    const { format, title, filenameBase, columns, rows } = params
    const timestamp = new Date().toISOString().slice(0, 10)

    if (format === 'CSV') {
      const csv = this.generateCSV(title, columns, rows)
      this.downloadFile(csv, `${filenameBase}_${timestamp}.csv`, 'text/csv;charset=utf-8;')
    } else if (format === 'EXCEL') {
      const xml = this.generateExcelXML(title, columns, rows)
      this.downloadFile(
        xml,
        `${filenameBase}_${timestamp}.xls`,
        'application/vnd.ms-excel;charset=utf-8;'
      )
    } else if (format === 'PDF') {
      if (typeof window !== 'undefined') {
        window.print()
      }
    }
  }
}

export const reportExportService = new ReportExportService()
