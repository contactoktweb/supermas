import { db } from '@/lib/supabase'
import { InvoiceItem, InvoiceTaxSummary } from '../types'

export class InvoiceCalculationService {
  /**
   * Obtiene la tabla de configuración de impuestos de la DIAN desde db.taxConfigs
   */
  getTaxConfigs() {
    return db.taxConfigs || [
      { id: 'tax-19', name: 'IVA General 19%', code: 'IVA_19', ratePercent: 19, isDefault: true },
      { id: 'tax-5', name: 'IVA Reducido 5%', code: 'IVA_5', ratePercent: 5 },
      { id: 'tax-0', name: 'IVA 0% (Tarifa Cero)', code: 'IVA_0', ratePercent: 0 },
      { id: 'tax-exento', name: 'Exento de IVA', code: 'EXENTO', ratePercent: 0 },
      { id: 'tax-excluido', name: 'Excluido de IVA', code: 'EXCLUIDO', ratePercent: 0 },
    ]
  }

  /**
   * Resuelve el porcentaje de IVA según el código o producto
   */
  resolveTaxRate(taxCodeOrPercent: string | number, isExempt: boolean = false): { code: string; ratePercent: number; name: string } {
    if (isExempt) {
      return { code: 'EXENTO', ratePercent: 0, name: 'Exento de IVA' }
    }

    const configs = this.getTaxConfigs()
    if (typeof taxCodeOrPercent === 'number') {
      const match = configs.find((t) => t.ratePercent === taxCodeOrPercent)
      if (match) {
        return { code: match.code, ratePercent: match.ratePercent, name: match.name }
      }
      return { code: `IVA_${taxCodeOrPercent}`, ratePercent: taxCodeOrPercent, name: `IVA ${taxCodeOrPercent}%` }
    }

    const matchCode = configs.find((t) => t.code.toUpperCase() === String(taxCodeOrPercent).toUpperCase())
    if (matchCode) {
      return { code: matchCode.code, ratePercent: matchCode.ratePercent, name: matchCode.name }
    }

    return { code: 'IVA_19', ratePercent: 19, name: 'IVA General 19%' }
  }

  /**
   * Calcula la liquidación completa de ítems, descuentos e impuestos discriminados
   */
  calculateInvoiceTotals(items: Array<{
    unitPrice: number
    quantity: number
    discountPercent?: number
    discountAmount?: number
    taxRatePercent?: number
    taxCode?: string
    isExempt?: boolean
  }>): {
    subtotal: number
    discountTotal: number
    taxTotal: number
    total: number
    totalUnits: number
    itemsCount: number
    taxesBreakdown: InvoiceTaxSummary[]
  } {
    let subtotal = 0
    let discountTotal = 0
    let taxTotal = 0
    let totalUnits = 0

    const taxBasesMap: Record<string, { name: string; ratePercent: number; base: number; taxAmount: number }> = {}

    for (const item of items) {
      const qty = Number(item.quantity) || 0
      const price = Number(item.unitPrice) || 0
      const gross = qty * price

      const discPercent = Math.min(100, Math.max(0, item.discountPercent || 0))
      const calculatedDisc = item.discountAmount !== undefined ? item.discountAmount : Math.round(gross * (discPercent / 100))
      const netBase = Math.max(0, gross - calculatedDisc)

      const taxInfo = this.resolveTaxRate(item.taxCode || item.taxRatePercent || 19, item.isExempt)
      const taxAmount = Math.round(netBase * (taxInfo.ratePercent / 100))

      subtotal += netBase
      discountTotal += calculatedDisc
      taxTotal += taxAmount
      totalUnits += qty

      if (!taxBasesMap[taxInfo.code]) {
        taxBasesMap[taxInfo.code] = {
          name: taxInfo.name,
          ratePercent: taxInfo.ratePercent,
          base: 0,
          taxAmount: 0,
        }
      }
      taxBasesMap[taxInfo.code].base += netBase
      taxBasesMap[taxInfo.code].taxAmount += taxAmount
    }

    const taxesBreakdown: InvoiceTaxSummary[] = Object.entries(taxBasesMap).map(([code, data]) => ({
      taxCode: code,
      taxName: data.name,
      ratePercent: data.ratePercent,
      taxableBase: data.base,
      taxAmount: data.taxAmount,
    }))

    const total = subtotal + taxTotal

    return {
      subtotal,
      discountTotal,
      taxTotal,
      total,
      totalUnits,
      itemsCount: items.length,
      taxesBreakdown,
    }
  }

  /**
   * Genera el CUFE (Código Único de Factura Electrónica) simulado estándar DIAN
   */
  generateCUFE(invoiceNumber: string, total: number, dateIso: string, nit: string): string {
    const raw = `${invoiceNumber}${dateIso}${total}01${nit}9014587892${Date.now()}`
    let hash1 = 0
    let hash2 = 0
    for (let i = 0; i < raw.length; i++) {
      hash1 = (hash1 << 5) - hash1 + raw.charCodeAt(i)
      hash1 |= 0
      hash2 = (hash2 << 7) - hash2 + raw.charCodeAt(i)
      hash2 |= 0
    }
    const hex1 = Math.abs(hash1).toString(16).padStart(8, '0')
    const hex2 = Math.abs(hash2).toString(16).padStart(8, '0')
    const rand = Math.random().toString(16).substring(2, 10) + Math.random().toString(16).substring(2, 10)
    const filler = `${hex1}${hex2}${rand}supermasdiancolombia${dateIso}`.replace(/[^a-f0-9]/gi, 'a').toLowerCase()
    return filler.padEnd(64, '0').slice(0, 64)
  }

  /**
   * Genera representación XML UBL 2.1 estándar DIAN
   */
  generateDIANXml(invoiceNumber: string, customerName: string, customerDoc: string, total: number, cufe: string): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
  xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
  xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:UBLVersionID>UBL 2.1</cbc:UBLVersionID>
  <cbc:CustomizationID>DIAN 2.1: Factura Electrónica de Venta</cbc:CustomizationID>
  <cbc:ProfileID>DIAN 2.1</cbc:ProfileID>
  <cbc:ID>${invoiceNumber}</cbc:ID>
  <cbc:UUID schemeName="CUFE-SHA384">${cufe}</cbc:UUID>
  <cbc:IssueDate>${new Date().toISOString().slice(0, 10)}</cbc:IssueDate>
  <cbc:IssueTime>${new Date().toISOString().slice(11, 19)}-05:00</cbc:IssueTime>
  <cbc:InvoiceTypeCode>01</cbc:InvoiceTypeCode>
  <cac:AccountingSupplierParty>
    <cac:Party>
      <cac:PartyName><cbc:Name>DISTRIBUIDORA SUPER MÁS S.A.S.</cbc:Name></cac:PartyName>
      <cac:PartyTaxScheme>
        <cbc:CompanyID schemeAgencyID="195" schemeID="2" schemeName="31">901458789</cbc:CompanyID>
      </cac:PartyTaxScheme>
    </cac:Party>
  </cac:AccountingSupplierParty>
  <cac:AccountingCustomerParty>
    <cac:Party>
      <cac:PartyName><cbc:Name>${customerName}</cbc:Name></cac:PartyName>
      <cac:PartyTaxScheme>
        <cbc:CompanyID>${customerDoc}</cbc:CompanyID>
      </cac:PartyTaxScheme>
    </cac:Party>
  </cac:AccountingCustomerParty>
  <cac:LegalMonetaryTotal>
    <cbc:PayableAmount currencyID="COP">${total}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
</Invoice>`
  }
}

export const invoiceCalculationService = new InvoiceCalculationService()
