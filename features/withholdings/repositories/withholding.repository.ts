/**
 * SUPER MÁS ERP/POS - Acceso a datos de Retenciones (migración 095).
 *
 * Conceptos y UVT: tablas con RLS (lectura para la empresa, escritura con settings.manage).
 * Cálculo: siempre en el servidor con fn_preview_withholdings / fn_compute_withholdings_internal.
 */

import { supabaseClient } from '@/lib/supabase/client'
import { resolveUserCompanyId } from '@/lib/supabase/tenant'
import { selectPostingAccounts, type PucAccountRow } from '@/features/accounting/utils/posting-accounts'
import type {
  CompanyWithholdingProfile,
  DocumentWithholding,
  PostingAccountChoice,
  UvtValue,
  WithholdingConcept,
  WithholdingConceptInput,
  WithholdingLine,
  WithholdingSide,
} from '../types'

interface ConceptRow {
  id: string
  code: string
  name: string
  withholding_type: WithholdingConcept['withholdingType']
  applies_to: WithholdingConcept['appliesTo']
  base_type: WithholdingConcept['baseType']
  rate_percent: number | string
  min_base_uvt: number | string
  payable_account_id: string | null
  receivable_account_id: string | null
  is_active: boolean
  notes: string | null
}

const CONCEPT_COLUMNS =
  'id, code, name, withholding_type, applies_to, base_type, rate_percent, min_base_uvt, payable_account_id, receivable_account_id, is_active, notes'

const toConcept = (row: ConceptRow): WithholdingConcept => ({
  id: row.id,
  code: row.code,
  name: row.name,
  withholdingType: row.withholding_type,
  appliesTo: row.applies_to,
  baseType: row.base_type,
  ratePercent: Number(row.rate_percent),
  minBaseUvt: Number(row.min_base_uvt),
  payableAccountId: row.payable_account_id,
  receivableAccountId: row.receivable_account_id,
  isActive: row.is_active,
  notes: row.notes || '',
})

const toRow = (input: WithholdingConceptInput) => ({
  code: input.code,
  name: input.name,
  withholding_type: input.withholdingType,
  applies_to: input.appliesTo,
  base_type: input.baseType,
  rate_percent: input.ratePercent,
  min_base_uvt: input.minBaseUvt,
  payable_account_id: input.appliesTo === 'SALES' ? null : input.payableAccountId,
  receivable_account_id: input.appliesTo === 'PURCHASES' ? null : input.receivableAccountId,
  is_active: input.isActive,
  notes: input.notes || null,
})

const toLine = (raw: Record<string, unknown>): WithholdingLine => ({
  conceptId: String(raw.concept_id),
  code: String(raw.code),
  name: String(raw.name),
  withholdingType: raw.withholding_type as WithholdingLine['withholdingType'],
  baseAmount: Number(raw.base_amount),
  minBaseAmount: Number(raw.min_base_amount),
  nominalRate: Number(raw.nominal_rate),
  zeseFactor: Number(raw.zese_factor),
  effectiveRate: Number(raw.effective_rate),
  amount: Number(raw.amount),
  applied: Boolean(raw.applied),
  reason: (raw.reason as string | null) ?? null,
})

function fail(error: { message: string } | null, fallback: string): void {
  if (error) throw new Error(error.message || fallback)
}

export const withholdingRepository = {
  async listConcepts(options: { side?: WithholdingSide; onlyActive?: boolean } = {}): Promise<WithholdingConcept[]> {
    let query = supabaseClient.from('withholding_concepts').select(CONCEPT_COLUMNS).order('withholding_type').order('code')
    if (options.onlyActive) query = query.eq('is_active', true)
    if (options.side) query = query.in('applies_to', [options.side, 'BOTH'])
    const { data, error } = await query
    fail(error, 'No se pudieron cargar las retenciones.')
    return ((data || []) as ConceptRow[]).map(toConcept)
  },

  async createConcept(input: WithholdingConceptInput, userId: string): Promise<WithholdingConcept> {
    const companyId = await resolveUserCompanyId()
    const { data, error } = await supabaseClient
      .from('withholding_concepts')
      .insert({ ...toRow(input), company_id: companyId, created_by_user_id: userId, updated_by_user_id: userId })
      .select(CONCEPT_COLUMNS)
      .single()
    if (error?.code === '23505') throw new Error(`Ya existe una retención con el código ${input.code}.`)
    fail(error, 'No se pudo crear la retención.')
    return toConcept(data as ConceptRow)
  },

  async updateConcept(id: string, input: WithholdingConceptInput, userId: string): Promise<WithholdingConcept> {
    const { data, error } = await supabaseClient
      .from('withholding_concepts')
      .update({ ...toRow(input), updated_by_user_id: userId })
      .eq('id', id)
      .select(CONCEPT_COLUMNS)
      .single()
    if (error?.code === '23505') throw new Error(`Ya existe una retención con el código ${input.code}.`)
    fail(error, 'No se pudo actualizar la retención.')
    return toConcept(data as ConceptRow)
  },

  async listUvtValues(): Promise<UvtValue[]> {
    const { data, error } = await supabaseClient.from('uvt_values').select('year, value').order('year', { ascending: false })
    fail(error, 'No se pudo cargar el valor de la UVT.')
    return (data || []).map((row) => ({ year: Number(row.year), value: Number(row.value) }))
  },

  async saveUvtValue(input: UvtValue, userId: string): Promise<void> {
    const companyId = await resolveUserCompanyId()
    const { error } = await supabaseClient
      .from('uvt_values')
      .upsert({ company_id: companyId, year: input.year, value: input.value, updated_by_user_id: userId, updated_at: new Date().toISOString() })
    fail(error, 'No se pudo guardar el valor de la UVT.')
  },

  async getCompanyProfile(): Promise<CompanyWithholdingProfile> {
    const companyId = await resolveUserCompanyId()
    const { data, error } = await supabaseClient
      .from('companies')
      .select('is_self_withholder, is_simple_regime, is_zese_beneficiary, zese_start_date')
      .eq('id', companyId)
      .single()
    fail(error, 'No se pudo cargar el perfil tributario de la empresa.')
    return {
      isSelfWithholder: Boolean(data?.is_self_withholder),
      isSimpleRegime: Boolean(data?.is_simple_regime),
      isZeseBeneficiary: Boolean(data?.is_zese_beneficiary),
      zeseStartDate: data?.zese_start_date ?? null,
    }
  },

  async saveCompanyProfile(profile: CompanyWithholdingProfile): Promise<void> {
    const companyId = await resolveUserCompanyId()
    const { data, error } = await supabaseClient
      .from('companies')
      .update({
        is_self_withholder: profile.isSelfWithholder,
        is_simple_regime: profile.isSimpleRegime,
        is_zese_beneficiary: profile.isZeseBeneficiary,
        zese_start_date: profile.isZeseBeneficiary ? profile.zeseStartDate : null,
      })
      .eq('id', companyId)
      .select('id')
    fail(error, 'No se pudo guardar el perfil tributario de la empresa.')
    if (!data || data.length === 0) throw new Error('No tiene permisos para modificar el perfil tributario de la empresa.')
  },

  /** Subcuentas auxiliares activas para cada lado: compras 2365/2367/2368, ventas 1355. */
  async listPostingAccounts(): Promise<{ payable: PostingAccountChoice[]; receivable: PostingAccountChoice[] }> {
    const { data, error } = await supabaseClient
      .from('accounting_accounts')
      .select('id, code, name, parent_id, is_active')
      .or('code.like.13%,code.like.23%')
    fail(error, 'No se pudieron cargar las cuentas contables.')
    const rows = (data || []) as PucAccountRow[]
    return {
      payable: selectPostingAccounts(rows, (code) => ['2365', '2367', '2368'].includes(code.slice(0, 4))),
      receivable: selectPostingAccounts(rows, (code) => code.startsWith('1355')),
    }
  },

  async preview(params: {
    side: WithholdingSide
    thirdPartyId: string
    base: number
    tax: number
    conceptIds: string[]
    date?: string
  }): Promise<WithholdingLine[]> {
    if (params.conceptIds.length === 0) return []
    const { data, error } = await supabaseClient.rpc('fn_preview_withholdings', {
      p_side: params.side,
      p_third_party_id: params.thirdPartyId,
      p_base: params.base,
      p_tax: params.tax,
      p_concept_ids: params.conceptIds,
      p_date: params.date ?? null,
    })
    fail(error, 'No se pudieron calcular las retenciones.')
    return ((data || []) as Record<string, unknown>[]).map(toLine)
  },

  async listDocumentWithholdings(documentType: 'PURCHASE' | 'SALE', documentId: string): Promise<DocumentWithholding[]> {
    const { data, error } = await supabaseClient
      .from('document_withholdings')
      .select('concept_id, concept_code, concept_name, withholding_type, base_amount, effective_rate, zese_factor, amount')
      .eq('document_type', documentType)
      .eq('document_id', documentId)
      .order('concept_code')
    fail(error, 'No se pudieron cargar las retenciones del documento.')
    return (data || []).map((row) => ({
      conceptId: row.concept_id,
      conceptCode: row.concept_code,
      conceptName: row.concept_name,
      withholdingType: row.withholding_type,
      baseAmount: Number(row.base_amount),
      effectiveRate: Number(row.effective_rate),
      zeseFactor: Number(row.zese_factor),
      amount: Number(row.amount),
    }))
  },
}
