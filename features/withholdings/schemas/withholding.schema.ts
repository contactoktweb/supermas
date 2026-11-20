import { z } from 'zod'

const optionalAccount = z.string().uuid().nullable()

export const withholdingConceptSchema = z
  .object({
    code: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9_.-]{1,30}$/, 'El código admite letras, números, punto, guion y guion bajo (máximo 30).'),
    name: z.string().trim().min(3, 'Escriba un nombre de al menos 3 caracteres.').max(150),
    withholdingType: z.enum(['RETEFUENTE', 'RETEIVA', 'RETEICA']),
    appliesTo: z.enum(['PURCHASES', 'SALES', 'BOTH']),
    baseType: z.enum(['SUBTOTAL', 'TAX_AMOUNT']),
    ratePercent: z
      .number({ message: 'Escriba la tarifa.' })
      .gt(0, 'La tarifa debe ser mayor a 0.')
      .max(100, 'La tarifa no puede superar el 100 %.'),
    minBaseUvt: z.number({ message: 'Escriba la base mínima.' }).min(0, 'La base mínima no puede ser negativa.'),
    payableAccountId: optionalAccount,
    receivableAccountId: optionalAccount,
    isActive: z.boolean(),
    notes: z.string().trim().max(500),
  })
  .superRefine((value, ctx) => {
    if (value.appliesTo !== 'SALES' && !value.payableAccountId) {
      ctx.addIssue({ code: 'custom', path: ['payableAccountId'], message: 'Seleccione la cuenta para compras (2365, 2367 o 2368).' })
    }
    if (value.appliesTo !== 'PURCHASES' && !value.receivableAccountId) {
      ctx.addIssue({ code: 'custom', path: ['receivableAccountId'], message: 'Seleccione la cuenta para ventas (1355).' })
    }
    if (value.baseType === 'TAX_AMOUNT' && value.withholdingType !== 'RETEIVA') {
      ctx.addIssue({ code: 'custom', path: ['baseType'], message: 'Solo el ReteIVA se calcula sobre el IVA.' })
    }
  })

export const uvtValueSchema = z.object({
  year: z.number().int().min(2000).max(2100),
  value: z.number({ message: 'Escriba el valor de la UVT.' }).gt(0, 'El valor de la UVT debe ser mayor a 0.'),
})

export const companyWithholdingProfileSchema = z
  .object({
    isSelfWithholder: z.boolean(),
    isSimpleRegime: z.boolean(),
    isZeseBeneficiary: z.boolean(),
    zeseStartDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  })
  .refine((value) => !value.isZeseBeneficiary || !!value.zeseStartDate, {
    path: ['zeseStartDate'],
    message: 'Indique la fecha de inicio del beneficio ZESE.',
  })
