/**
 * SUPER MÁS ERP/POS - Tipos del módulo de Retenciones.
 *
 * Los conceptos se configuran en Configuración → Retenciones y se aplican en compras (la empresa
 * retiene al proveedor) y en ventas (el cliente agente retenedor le retiene a la empresa).
 * El cálculo lo hace siempre la base de datos (fn_compute_withholdings_internal).
 */

export type WithholdingType = 'RETEFUENTE' | 'RETEIVA' | 'RETEICA'
export type WithholdingAppliesTo = 'PURCHASES' | 'SALES' | 'BOTH'
export type WithholdingBaseType = 'SUBTOTAL' | 'TAX_AMOUNT'
export type WithholdingSide = 'PURCHASES' | 'SALES'

export interface WithholdingConcept {
  id: string
  code: string
  name: string
  withholdingType: WithholdingType
  appliesTo: WithholdingAppliesTo
  baseType: WithholdingBaseType
  ratePercent: number
  minBaseUvt: number
  payableAccountId: string | null
  receivableAccountId: string | null
  isActive: boolean
  notes: string
}

export type WithholdingConceptInput = Omit<WithholdingConcept, 'id'>

export interface UvtValue {
  year: number
  value: number
}

/** Perfil tributario de la empresa que afecta las retenciones que le practican sus clientes. */
export interface CompanyWithholdingProfile {
  isSelfWithholder: boolean
  isSimpleRegime: boolean
  isZeseBeneficiary: boolean
  zeseStartDate: string | null
}

/** Línea calculada por el servidor para un concepto seleccionado. */
export interface WithholdingLine {
  conceptId: string
  code: string
  name: string
  withholdingType: WithholdingType
  baseAmount: number
  minBaseAmount: number
  nominalRate: number
  zeseFactor: number
  effectiveRate: number
  amount: number
  applied: boolean
  reason: string | null
}

/** Retención guardada en un documento (compra o venta). */
export interface DocumentWithholding {
  conceptId: string
  conceptCode: string
  conceptName: string
  withholdingType: WithholdingType
  baseAmount: number
  effectiveRate: number
  zeseFactor: number
  amount: number
}

export interface PostingAccountChoice {
  id: string
  code: string
  name: string
  groupCode: string
  groupName: string
}

/** Perfil tributario de un tercero (proveedor o cliente) para las retenciones. */
export interface ThirdPartyWithholdingProfile {
  /** Proveedor: no se le practica retención en la fuente. */
  isSelfWithholder: boolean
  /** Proveedor del régimen simple: no se le practica retención en la fuente. */
  isSimpleRegime: boolean
  isZeseBeneficiary: boolean
  zeseStartDate: string | null
  /** Cliente que le practica retenciones a la empresa. */
  isWithholdingAgent: boolean
  /** Retenciones que se preseleccionan en sus documentos. */
  defaultWithholdingConceptIds: string[]
}

export const EMPTY_THIRD_PARTY_WITHHOLDING_PROFILE: ThirdPartyWithholdingProfile = {
  isSelfWithholder: false,
  isSimpleRegime: false,
  isZeseBeneficiary: false,
  zeseStartDate: null,
  isWithholdingAgent: false,
  defaultWithholdingConceptIds: [],
}
