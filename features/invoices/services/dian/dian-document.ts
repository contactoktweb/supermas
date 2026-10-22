/**
 * SUPER MÁS ERP/POS — Modelo fiscal de Factura, Nota Crédito y Nota Débito electrónicas (fuente única de valores)
 *
 * El XML UBL, el CUFE, el QR y la representación gráfica salen TODOS de este objeto.
 * Así se garantiza que el CUFE corresponde exactamente a lo transmitido.
 *
 * Los montos se manejan en centavos (enteros) para evitar errores de punto flotante.
 */

// ------------------------------------------------------------------------------
// Tipos de entrada (datos tal como vienen de la base de datos)
// ------------------------------------------------------------------------------

export interface DianIssuerInput {
  nit: string
  dv: string
  legalName: string
  tradeName?: string | null
  address: string
  cityName: string
  departmentName: string
  municipalityCode: string // DANE 5 dígitos
  departmentCode: string // DANE 2 dígitos
  countryCode: string // 'CO'
  postalCode?: string | null
  email?: string | null
  phone?: string | null
  organizationType: '1' | '2'
  taxLevelCodes: string // 'R-99-PN' o 'O-13;O-15'
  taxSchemeCode: '01' | 'ZZ'
}

export interface DianCustomerInput {
  documentType: string // CC, NIT, CE, PASAPORTE, TI, ...
  documentNumber: string
  dv?: string | null
  name: string
  firstName?: string | null
  lastName?: string | null
  isCompany: boolean
  email?: string | null
  phone?: string | null
  address?: string | null
  cityName?: string | null
  departmentName?: string | null
  municipalityCode?: string | null
  taxLevelCodes?: string | null
  taxSchemeCode?: string | null
}

/** Tratamiento de IVA de la línea. EXENTO se reporta con tarifa 0 y base; EXCLUIDO no lleva IVA. */
export type DianIvaTreatment = 'GRAVADO' | 'EXENTO' | 'EXCLUIDO'

export interface DianLineInput {
  productId: string
  sku: string
  description: string
  quantity: number
  unitPrice: number
  discountPercent: number
  taxRatePercent: number
  /** Valor neto de la línea (después de descuento, antes de IVA) tal como lo guardó la venta */
  netAmount: number
  taxAmount: number
  /** null/undefined en una línea al 0 % = producto sin clasificar (bloquea el documento) */
  ivaTreatment?: DianIvaTreatment | null
}

export interface DianResolutionInput {
  resolutionNumber: string
  prefix: string
  rangeFrom: number
  rangeTo: number
  validFrom: string // YYYY-MM-DD
  validTo: string // YYYY-MM-DD
  resolutionDate?: string | null
}

export interface DianPaymentInput {
  /** '1' contado, '2' crédito */
  form: '1' | '2'
  /** Código DIAN del medio de pago (10 efectivo, 42 consignación, 47 transferencia débito, 48 crédito, 49 débito, ZZZ otro) */
  meansCode: string
  dueDate?: string | null
}

export type DianDocumentKind = 'INVOICE' | 'CREDIT_NOTE' | 'DEBIT_NOTE'

/** Factura a la que hace referencia una nota (BillingReference) */
export interface DianBillingReference {
  id: string // prefijo + número (ej. SETP990000001)
  uuid: string // CUFE de la factura
  issueDate: string // YYYY-MM-DD
}

export interface DianInvoiceInput {
  /** Tipo de documento (por defecto factura de venta) */
  kind?: DianDocumentKind
  prefix: string
  number: number
  issueDate: string // YYYY-MM-DD (hora Colombia)
  issueTime: string // HH:MM:SS-05:00
  environmentCode: '1' | '2'
  softwareId: string
  issuer: DianIssuerInput
  customer: DianCustomerInput
  /** Solo facturas: resolución de numeración (las notas no la llevan) */
  resolution?: DianResolutionInput | null
  lines: DianLineInput[]
  payment?: DianPaymentInput | null
  /** Solo notas: factura referenciada y concepto de corrección */
  billingReference?: DianBillingReference | null
  discrepancy?: { code: string; description: string } | null
  notes?: string[]
  orderReference?: string | null
}

// ------------------------------------------------------------------------------
// Modelo calculado
// ------------------------------------------------------------------------------

export interface DianTaxSubtotal {
  taxCode: '01' // IVA (único tributo que maneja hoy el ERP en ventas)
  taxName: 'IVA'
  ratePercent: number
  taxableCents: number
  taxCents: number
}

export interface DianLine {
  lineNumber: number
  input: DianLineInput
  quantity: number
  unitPriceCents: number
  grossCents: number
  discountCents: number
  netCents: number
  treatment: DianIvaTreatment
  /** null para bienes EXCLUIDOS (la línea no lleva TaxTotal) */
  tax: DianTaxSubtotal | null
}

export interface DianTotals {
  lineExtensionCents: number // Σ neto de líneas
  taxExclusiveCents: number // Σ bases gravables reportadas
  taxInclusiveCents: number // neto + impuestos
  allowanceCents: number // descuentos a nivel documento (0: los descuentos van por línea)
  chargeCents: number
  payableCents: number
  ivaCents: number
  incCents: number // INC (04)
  icaCents: number // ICA (03)
  taxSubtotals: DianTaxSubtotal[]
}

export interface DianInvoiceDocument {
  kind: DianDocumentKind
  input: DianInvoiceInput
  /** Número completo del documento: prefijo + consecutivo sin separador (ej. SETP990000001) */
  documentId: string
  lines: DianLine[]
  totals: DianTotals
}

// ------------------------------------------------------------------------------
// Utilidades numéricas
// ------------------------------------------------------------------------------

export const toCents = (v: number) => Math.round(Number(v || 0) * 100)
/** Formato DIAN de montos: punto decimal y 2 decimales, sin separador de miles. */
export const formatCents = (cents: number) => {
  const sign = cents < 0 ? '-' : ''
  const abs = Math.abs(cents)
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`
}
export const formatQuantity = (q: number) => Number(q).toFixed(6)
export const formatPercent = (p: number) => Number(p).toFixed(2)

// ------------------------------------------------------------------------------
// Construcción y validación
// ------------------------------------------------------------------------------

export class DianDocumentError extends Error {
  constructor(public readonly problems: string[]) {
    super(`Datos fiscales incompletos o inconsistentes:\n- ${problems.join('\n- ')}`)
    this.name = 'DianDocumentError'
  }
}

export function buildInvoiceDocument(input: DianInvoiceInput): DianInvoiceDocument {
  const problems: string[] = []
  const kind: DianDocumentKind = input.kind || 'INVOICE'
  const isNote = kind !== 'INVOICE'

  // Emisor
  const iss = input.issuer
  if (!/^[0-9]{6,15}$/.test(iss.nit || '')) problems.push('NIT del emisor inválido.')
  if (!/^[0-9]$/.test(iss.dv || '')) problems.push('DV del emisor inválido.')
  if (!iss.legalName?.trim()) problems.push('Razón social del emisor vacía.')
  if (!iss.address?.trim()) problems.push('Dirección del emisor vacía.')
  if (!/^[0-9]{5}$/.test(iss.municipalityCode || '')) problems.push('Código DANE de municipio del emisor (5 dígitos) faltante.')
  if (!/^[0-9]{2}$/.test(iss.departmentCode || '')) problems.push('Código DANE de departamento del emisor (2 dígitos) faltante.')
  if (!iss.taxLevelCodes?.trim()) problems.push('Responsabilidades fiscales DIAN del emisor (TaxLevelCode) faltantes.')

  // Software
  if (!input.softwareId?.trim()) problems.push('Software ID DIAN no configurado (dian_software_config).')

  if (!isNote) {
    // Resolución (solo factura)
    const res = input.resolution
    if (!res) {
      problems.push('La factura no tiene resolución de numeración.')
    } else {
      if (!res.resolutionNumber?.trim()) problems.push('Número de resolución vacío.')
      if (input.prefix !== res.prefix) problems.push('El prefijo de la factura no coincide con el de la resolución.')
      if (input.number < res.rangeFrom || input.number > res.rangeTo) {
        problems.push(`El consecutivo ${input.number} está fuera del rango autorizado ${res.rangeFrom}–${res.rangeTo}.`)
      }
      if (input.issueDate < res.validFrom || input.issueDate > res.validTo) {
        problems.push(`La fecha ${input.issueDate} está fuera de la vigencia ${res.validFrom} a ${res.validTo}.`)
      }
    }
    if (!input.payment) problems.push('La factura no tiene forma/medio de pago.')
  } else {
    // Nota: referencia a la factura y concepto de corrección
    const ref = input.billingReference
    if (!ref?.id || !ref.uuid || !/^\d{4}-\d{2}-\d{2}$/.test(ref.issueDate || '')) {
      problems.push('La nota debe referenciar la factura (número, CUFE y fecha).')
    }
    const maxCode = kind === 'CREDIT_NOTE' ? 6 : 4
    const code = Number(input.discrepancy?.code)
    if (!input.discrepancy || !Number.isInteger(code) || code < 1 || code > maxCode) problems.push('Concepto de corrección de la nota inválido.')
    if (!input.discrepancy?.description?.trim()) problems.push('Falta la descripción del concepto de la nota.')
  }

  // Fecha y hora
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.issueDate)) problems.push('Fecha de emisión con formato inválido.')
  if (!/^\d{2}:\d{2}:\d{2}-05:00$/.test(input.issueTime)) problems.push('Hora de emisión debe tener formato HH:MM:SS-05:00.')

  // Adquiriente
  const cus = input.customer
  if (!cus.documentNumber?.replace(/[^0-9A-Za-z]/g, '')) problems.push('Documento del adquiriente vacío.')
  if (!cus.name?.trim()) problems.push('Nombre del adquiriente vacío.')

  // Líneas
  if (!input.lines.length) problems.push(isNote ? 'La nota no tiene líneas.' : 'La factura no tiene líneas.')

  const lines: DianLine[] = input.lines.map((l, idx) => {
    const unitPriceCents = toCents(l.unitPrice)
    const grossCents = Math.round(l.quantity * unitPriceCents)
    const netCents = toCents(l.netAmount)
    const discountCents = grossCents - netCents
    const taxCents = toCents(l.taxAmount)
    const rate = Number(l.taxRatePercent || 0)

    let treatment: DianIvaTreatment
    if (rate > 0) {
      treatment = 'GRAVADO'
      if (l.ivaTreatment === 'EXENTO' || l.ivaTreatment === 'EXCLUIDO') {
        problems.push(`Línea ${idx + 1} (${l.sku}): está marcada ${l.ivaTreatment} pero tiene IVA ${rate}%.`)
      }
    } else if (l.ivaTreatment === 'EXENTO' || l.ivaTreatment === 'EXCLUIDO') {
      treatment = l.ivaTreatment
    } else {
      treatment = 'EXCLUIDO'
      problems.push(`Línea ${idx + 1} (${l.sku} ${l.description}): IVA 0 % sin clasificar como exento o excluido. Clasifique el producto en Productos → Tributación.`)
    }

    const expectedTax = Math.round((netCents * rate) / 100)
    if (Math.abs(expectedTax - taxCents) > 1) {
      problems.push(`Línea ${idx + 1} (${l.sku}): IVA ${formatCents(taxCents)} no corresponde al ${rate}% de ${formatCents(netCents)}.`)
    }
    if (discountCents < 0) problems.push(`Línea ${idx + 1} (${l.sku}): el neto supera el valor bruto.`)
    if (l.quantity <= 0) problems.push(`Línea ${idx + 1} (${l.sku}): cantidad inválida.`)
    if (netCents <= 0) problems.push(`Línea ${idx + 1} (${l.sku}): valor neto inválido.`)
    return {
      lineNumber: idx + 1,
      input: l,
      quantity: l.quantity,
      unitPriceCents,
      grossCents,
      discountCents: Math.max(0, discountCents),
      netCents,
      treatment,
      tax: treatment === 'EXCLUIDO' ? null : { taxCode: '01', taxName: 'IVA', ratePercent: rate, taxableCents: netCents, taxCents },
    }
  })

  if (problems.length) throw new DianDocumentError(problems)

  // Totales por tarifa (los bienes excluidos no forman base gravable ni llevan IVA)
  const byRate = new Map<number, DianTaxSubtotal>()
  for (const l of lines) {
    if (!l.tax) continue
    const cur = byRate.get(l.tax.ratePercent) || { taxCode: '01' as const, taxName: 'IVA' as const, ratePercent: l.tax.ratePercent, taxableCents: 0, taxCents: 0 }
    cur.taxableCents += l.tax.taxableCents
    cur.taxCents += l.tax.taxCents
    byRate.set(l.tax.ratePercent, cur)
  }
  const taxSubtotals = [...byRate.values()].sort((a, b) => b.ratePercent - a.ratePercent)
  const lineExtensionCents = lines.reduce((s, l) => s + l.netCents, 0)
  const ivaCents = taxSubtotals.reduce((s, t) => s + t.taxCents, 0)
  const taxExclusiveCents = taxSubtotals.reduce((s, t) => s + t.taxableCents, 0)
  const taxInclusiveCents = lineExtensionCents + ivaCents

  return {
    kind,
    input,
    documentId: `${input.prefix}${input.number}`,
    lines,
    totals: {
      lineExtensionCents,
      taxExclusiveCents,
      taxInclusiveCents,
      allowanceCents: 0,
      chargeCents: 0,
      payableCents: taxInclusiveCents,
      ivaCents,
      incCents: 0,
      icaCents: 0,
      taxSubtotals,
    },
  }
}

export { CREDIT_NOTE_CONCEPTS, DEBIT_NOTE_CONCEPTS } from './dian-concepts'

// ------------------------------------------------------------------------------
// Catálogos DIAN
// ------------------------------------------------------------------------------

/** Tabla 13.2.1 Anexo 1.9 — Tipos de documento de identificación */
export function dianIdTypeCode(documentType: string): string {
  const t = (documentType || '').toUpperCase().replace(/[^A-Z]/g, '')
  const map: Record<string, string> = {
    RC: '11', REGISTROCIVIL: '11',
    TI: '12', TARJETAIDENTIDAD: '12',
    CC: '13', CEDULA: '13', CEDULACIUDADANIA: '13',
    TE: '21', TARJETAEXTRANJERIA: '21',
    CE: '22', CEDULAEXTRANJERIA: '22',
    NIT: '31',
    PASAPORTE: '41', PA: '41', PP: '41',
    DIE: '42', DOCUMENTOEXTRANJERO: '42',
    PEP: '47',
    PPT: '48',
    NITEXTRANJERO: '50',
    NUIP: '91',
  }
  return map[t] || '13'
}

/** Medio de pago del ERP → código DIAN (tabla 13.3.4.2) */
export function dianPaymentMeansCode(method: string): string {
  switch ((method || '').toUpperCase()) {
    case 'CASH':
    case 'EFECTIVO':
      return '10'
    case 'BANK_TRANSFER':
    case 'TRANSFERENCIA':
      return '47' // Transferencia débito bancaria
    case 'CREDIT_CARD':
    case 'TARJETA_CREDITO':
      return '48'
    case 'DEBIT_CARD':
    case 'TARJETA_DEBITO':
    case 'TARJETA':
      return '49'
    case 'CREDIT':
    case 'CREDITO':
      return 'ZZZ' // Acuerdo mutuo
    default:
      return 'ZZZ'
  }
}

/** Consumidor final según la DIAN */
export const DIAN_FINAL_CONSUMER_DOC = '222222222222'
