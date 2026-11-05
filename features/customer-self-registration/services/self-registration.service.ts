import { supabaseAdmin } from '@/lib/supabase/admin'
import { publicCatalogService } from '@/features/public-catalog/services/public-catalog.service'
import type { SelfRegistrationInput } from '../schemas/self-registration.schema'

export class SelfRegistrationError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message)
  }
}

const SELF_REGISTRATION_NOTE = 'Datos de facturación registrados por el cliente con el código QR.'

/**
 * Registra los datos de facturación electrónica que el cliente diligencia desde el QR.
 * Un cliente nuevo se crea sin cupo de crédito. Si el documento ya existe, solo se completan los
 * campos vacíos: un formulario público nunca sobrescribe datos que la empresa ya tiene.
 */
export async function registerCustomerFromQr(input: SelfRegistrationInput): Promise<void> {
  const companyId = await publicCatalogService.resolveCompanyId()
  if (!companyId) {
    throw new SelfRegistrationError('El registro no está disponible en este momento.', 503)
  }

  const isCompany = input.personType === 'COMPANY'
  const fields = {
    document_type: input.documentType,
    verification_digit: input.documentType === 'NIT' ? input.verificationDigit || null : null,
    first_name: isCompany ? null : input.firstName || null,
    last_name: isCompany ? null : input.lastName || null,
    company_name: isCompany ? input.businessName || null : null,
    commercial_name: isCompany ? input.businessName || null : null,
    email: input.email,
    phone: input.phone,
    address: input.address,
    city: input.city,
    department: input.department,
  }

  const { data: existing, error: findError } = await supabaseAdmin
    .from('customers')
    .select('id, document_type, verification_digit, first_name, last_name, company_name, commercial_name, email, phone, address, city, department')
    .eq('company_id', companyId)
    .eq('document_number', input.documentNumber)
    .maybeSingle()
  if (findError) throw new SelfRegistrationError('No se pudieron guardar los datos. Intenta de nuevo.', 500)

  if (!existing) {
    const { error } = await supabaseAdmin.from('customers').insert({
      ...fields,
      company_id: companyId,
      document_number: input.documentNumber,
      person_type: isCompany ? 'COMPANY' : 'NATURAL',
      customer_type: isCompany ? 'COMPANY' : 'INDIVIDUAL',
      customer_category: 'RETAIL',
      notes: SELF_REGISTRATION_NOTE,
    })
    // 23505: otro envío creó el mismo documento al tiempo; el cliente ya quedó registrado.
    if (error && error.code !== '23505') {
      throw new SelfRegistrationError('No se pudieron guardar los datos. Intenta de nuevo.', 500)
    }
    return
  }

  const missing: Record<string, string> = {}
  for (const [column, value] of Object.entries(fields)) {
    const current = (existing as Record<string, unknown>)[column]
    if (value && (current === null || current === undefined || String(current).trim() === '')) {
      missing[column] = value
    }
  }
  if (Object.keys(missing).length === 0) return

  const { error } = await supabaseAdmin.from('customers').update(missing).eq('id', existing.id)
  if (error) throw new SelfRegistrationError('No se pudieron guardar los datos. Intenta de nuevo.', 500)
}
