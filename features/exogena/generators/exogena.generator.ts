/**
 * SUPER MÁS ERP/POS - Generador de Archivos DIAN (Exógena Tributaria)
 *
 * Genera archivos XML oficiales compatibles con la plataforma DIAN Muisca
 * y archivos CSV estructurados para el Prevalidador Tributario.
 */

import { ExogenaRecord } from '../types'

export class ExogenaGenerator {
  /**
   * Mapea el tipo de documento del ERP al código oficial DIAN.
   * 13: Cédula de Ciudadanía
   * 31: NIT
   * 22: Cédula de Extranjería
   * 41: Pasaporte
   * 42: Tipo de documento extranjero
   */
  mapDianDocType(type: string): string {
    switch (type) {
      case 'NIT':
        return '31'
      case 'CC':
        return '13'
      case 'CE':
        return '22'
      case 'PASAPORTE':
        return '41'
      case 'EXTRANJERO':
      default:
        return '42'
    }
  }

  /**
   * Limpia y sanea texto para atributos XML válidos en UTF-8/ISO.
   */
  cleanXmlText(text?: string): string {
    if (!text) return ''
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;')
      .trim()
  }

  /**
   * Genera el archivo XML oficial formato Muisca DIAN para un formato específico.
   */
  generateXML(
    formatNumber: string,
    version: number,
    year: number,
    records: ExogenaRecord[],
    companyNit: string = '900852147'
  ): { fileName: string; content: string; totalRecords: number; totalAmount: number } {
    const formatRecords = records.filter((r) => r.formatNumber === formatNumber)
    const cleanCompanyNit = companyNit.replace(/\D/g, '')

    const totalAmount = formatRecords.reduce((acc, r) => acc + (r.baseAmount || 0), 0)
    const totalRecords = formatRecords.length

    const now = new Date()
    const sendTimestamp = now.toISOString().replace(/\.\d{3}Z$/, '')
    const fileId = `0101${formatNumber.padStart(4, '0')}${version.toString().padStart(2, '0')}${year}00000001`
    const fileName = `Dmuisca_${fileId}.xml`

    let linesXml = ''
    for (const rec of formatRecords) {
      const cleanDoc = rec.documentNumber.replace(/\D/g, '')
      const dianDocType = this.mapDianDocType(rec.thirdPartyType)
      const raz = this.cleanXmlText(rec.businessName)
      const dir = this.cleanXmlText(rec.address)
      const dpto = (rec.departmentCode || '76').padStart(2, '0')
      const mun = (rec.cityCode || '001').padStart(3, '0')
      const pais = rec.countryCode || '169'

      const baseVal = Math.round(rec.baseAmount || 0)
      const vatVal = Math.round(rec.vatAmount || 0)
      const whVal = Math.round(rec.withholdingAmount || 0)

      linesXml += `    <f${formatNumber} cpt="${rec.conceptCode}" tdoc="${dianDocType}" nid="${cleanDoc}" dv="${rec.verificationDigit || '0'}" apl1="" apl2="" nom1="" nom2="" raz="${raz}" dir="${dir}" dpto="${dpto}" mun="${mun}" pais="${pais}" pagon="${baseVal}" pagoc="0" iva="${vatVal}" retf="${whVal}" retiva="0" />\n`
    }

    const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<mas xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <Cabecera>
    <Ano>${year}</Ano>
    <CodFormato>${formatNumber}</CodFormato>
    <Version>${version}</Version>
    <NumEnvio>1</NumEnvio>
    <FecEnvio>${sendTimestamp}</FecEnvio>
    <FecInicial>${year}-01-01</FecInicial>
    <FecFinal>${year}-12-31</FecFinal>
    <ValorTotal>${Math.round(totalAmount)}</ValorTotal>
    <CantReg>${totalRecords}</CantReg>
    <NitEmisor>${cleanCompanyNit}</NitEmisor>
  </Cabecera>
  <formato${formatNumber}>
${linesXml}  </formato${formatNumber}>
</mas>`

    return {
      fileName,
      content: xmlContent,
      totalRecords,
      totalAmount,
    }
  }

  /**
   * Genera el archivo plano CSV estructurado para el Prevalidador Tributario DIAN.
   */
  generateCSV(
    formatNumber: string,
    version: number,
    year: number,
    records: ExogenaRecord[]
  ): { fileName: string; content: string } {
    const formatRecords = records.filter((r) => r.formatNumber === formatNumber)
    const fileName = `Prevalidador_DIAN_F${formatNumber}_v${version}_${year}.csv`

    const headers = [
      'Concepto',
      'Tipo_Documento_DIAN',
      'Numero_Identificacion',
      'DV',
      'Primer_Apellido',
      'Segundo_Apellido',
      'Primer_Nombre',
      'Otros_Nombres',
      'Razon_Social',
      'Direccion',
      'Cod_Dpto',
      'Cod_Municipio',
      'Pais',
      'Pago_Abono_Deducible',
      'Pago_Abono_No_Deducible',
      'IVA_Descontable_O_Generado',
      'Retencion_Practicada',
      'Retencion_IVA',
      'Documento_Origen',
    ]

    const rows = formatRecords.map((r) => {
      const cleanDoc = r.documentNumber.replace(/\D/g, '')
      const dianDocType = this.mapDianDocType(r.thirdPartyType)
      return [
        r.conceptCode,
        dianDocType,
        `"${cleanDoc}"`,
        r.verificationDigit || '0',
        `""`,
        `""`,
        `""`,
        `""`,
        `"${r.businessName.replace(/"/g, '""')}"`,
        `"${r.address.replace(/"/g, '""')}"`,
        `"${(r.departmentCode || '76').padStart(2, '0')}"`,
        `"${(r.cityCode || '001').padStart(3, '0')}"`,
        `"${r.countryCode || '169'}"`,
        Math.round(r.baseAmount || 0),
        Math.round(r.nonDeductibleAmount || 0),
        Math.round(r.vatAmount || 0),
        Math.round(r.withholdingAmount || 0),
        Math.round(r.vatWithholdingAmount || 0),
        `"${r.documentReference}"`,
      ].join(';')
    })

    const csvContent = [headers.join(';'), ...rows].join('\n')

    return {
      fileName,
      content: csvContent,
    }
  }
}

export const exogenaGenerator = new ExogenaGenerator()
