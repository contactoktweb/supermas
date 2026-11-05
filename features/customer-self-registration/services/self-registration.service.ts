import { supabaseAdmin } from '@/lib/supabase/admin'
import { publicCatalogService } from '@/features/public-catalog/services/public-catalog.service'
import type { SelfRegistrationInput } from '../schemas/self-registration.schema'
import { SELF_REGISTERED_CUSTOMER_NOTE } from '../routes'

export class SelfRegistrationError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message)
  }
}

/**
 * Registra los datos de facturación electrónica que el cliente diligencia desde el QR.
 * Solo crea clientes nuevos, sin cupo y marcados como autorregistrados para que el cajero
 * verifique el documento. Un formulario público nunca modifica un cliente existente: quien
 * conozca un número de documento podría cambiar el correo al que llegan sus facturas.
 */
export async function registerCustomerFromQr(input: SelfRegistrationInput): Promise<void> {
  const companyId = await publicCatalogService.resolveCompanyId()
  if (!companyId) {
    throw new SelfRegistrationError('El registro no está disponible en este momento.', 503)
  }

  const isCompany = input.personType === 'COMPANY'
  const { error } = await supabaseAdmin.from('customers').insert({
    company_id: companyId,
    document_type: input.documentType,
    document_number: input.documentNumber,
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
    person_type: isCompany ? 'COMPANY' : 'NATURAL',
    customer_type: isCompany ? 'COMPANY' : 'INDIVIDUAL',
    customer_category: 'RETAIL',
    notes: SELF_REGISTERED_CUSTOMER_NOTE,
  })
  // 23505: el documento ya existe. Se responde igual que un registro nuevo y no se toca el cliente.
  if (error && error.code !== '23505') {
    throw new SelfRegistrationError('No se pudieron guardar los datos. Intenta de nuevo.', 500)
  }
}
