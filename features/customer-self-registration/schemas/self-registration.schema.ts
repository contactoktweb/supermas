import { z } from 'zod'

export const SELF_REGISTRATION_DOCUMENT_TYPES = [
  { value: 'CC', label: 'Cédula de ciudadanía' },
  { value: 'NIT', label: 'NIT' },
  { value: 'CE', label: 'Cédula de extranjería' },
  { value: 'PASSPORT', label: 'Pasaporte' },
] as const

const FINAL_CONSUMER_DOCUMENT = '222222222222'
/** Pesos oficiales de la DIAN para el dígito de verificación del NIT (de derecha a izquierda). */
const NIT_DV_WEIGHTS = [3, 7, 13, 17, 19, 23, 29, 37, 41, 43, 47, 53, 59, 67, 71]

export function nitVerificationDigit(nit: string): string {
  const digits = nit.replace(/\D/g, '').split('').reverse()
  const sum = digits.reduce((acc, d, i) => acc + Number(d) * NIT_DV_WEIGHTS[i], 0)
  const mod = sum % 11
  return String(mod > 1 ? 11 - mod : mod)
}

const text = (max: number) => z.string().trim().max(max)

export const selfRegistrationSchema = z
  .object({
    personType: z.enum(['NATURAL', 'COMPANY'], { error: 'Selecciona el tipo de persona.' }),
    documentType: z.enum(['CC', 'NIT', 'CE', 'PASSPORT'], { error: 'Selecciona el tipo de documento.' }),
    documentNumber: z
      .string()
      .trim()
      .regex(/^[A-Za-z0-9]{5,15}$/, 'El número de documento debe tener entre 5 y 15 letras o números, sin puntos ni guiones.'),
    verificationDigit: z.string().trim().max(1).optional().or(z.literal('')),
    firstName: text(80).optional().or(z.literal('')),
    lastName: text(80).optional().or(z.literal('')),
    businessName: text(150).optional().or(z.literal('')),
    email: z.string().trim().toLowerCase().email('Escribe un correo válido: ahí llegará tu factura electrónica.').max(120),
    phone: z.string().trim().regex(/^[0-9+\s-]{7,20}$/, 'Escribe un teléfono válido.'),
    address: text(160).min(4, 'Escribe tu dirección.'),
    city: text(80).min(2, 'Escribe tu ciudad.'),
    department: text(80).min(2, 'Escribe tu departamento.'),
    acceptsDataPolicy: z.literal(true, { error: 'Debes autorizar el tratamiento de tus datos.' }),
    /** Campo trampa: las personas no lo ven; si llega con contenido, el envío es automático. */
    website: z.string().max(0).optional().or(z.literal('')),
  })
  .superRefine((data, ctx) => {
    if (data.documentNumber === FINAL_CONSUMER_DOCUMENT) {
      ctx.addIssue({ code: 'custom', path: ['documentNumber'], message: 'Ese número no corresponde a un cliente.' })
    }
    if (data.documentType === 'NIT') {
      if (!/^\d+$/.test(data.documentNumber)) {
        ctx.addIssue({ code: 'custom', path: ['documentNumber'], message: 'El NIT solo lleva números.' })
      } else if (data.verificationDigit !== nitVerificationDigit(data.documentNumber)) {
        ctx.addIssue({ code: 'custom', path: ['verificationDigit'], message: 'El dígito de verificación no coincide con el NIT.' })
      }
    }
    if (data.personType === 'COMPANY') {
      if ((data.businessName || '').length < 3) {
        ctx.addIssue({ code: 'custom', path: ['businessName'], message: 'Escribe la razón social.' })
      }
    } else {
      if ((data.firstName || '').length < 2) {
        ctx.addIssue({ code: 'custom', path: ['firstName'], message: 'Escribe tus nombres.' })
      }
      if ((data.lastName || '').length < 2) {
        ctx.addIssue({ code: 'custom', path: ['lastName'], message: 'Escribe tus apellidos.' })
      }
    }
  })

export type SelfRegistrationInput = z.infer<typeof selfRegistrationSchema>
