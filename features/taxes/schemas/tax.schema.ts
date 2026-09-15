import { z } from 'zod'

export const taxTypeSchema = z.enum(['IVA', 'EXCLUIDO', 'NO_GRAVADO', 'OTRO'], {
  message: 'Selecciona un tipo de impuesto válido',
})

export const taxStatusSchema = z.enum(['ACTIVE', 'INACTIVE'], {
  message: 'Selecciona un estado válido',
})

const dateRegex = /^\d{4}-\d{2}-\d{2}$/

export const taxConfigFormSchema = z
  .object({
    name: z
      .string({
        error: 'El nombre es obligatorio',
      })
      .trim()
      .min(3, 'El nombre debe tener al menos 3 caracteres')
      .max(100, 'El nombre no puede exceder 100 caracteres'),

    code: z
      .string({
        error: 'El código es obligatorio',
      })
      .trim()
      .min(2, 'El código debe tener al menos 2 caracteres')
      .max(30, 'El código no puede exceder 30 caracteres')
      .transform((val) => val.toUpperCase().replace(/\s+/g, '_'))
      .refine((val) => /^[A-Z0-9_-]+$/.test(val), {
        message: 'El código solo puede contener letras mayúsculas, números, guiones y guiones bajos',
      }),

    type: taxTypeSchema,

    ratePercent: z.coerce
      .number({
        error: 'El porcentaje es obligatorio',
      })
      .min(0, 'La tarifa no puede ser negativa')
      .max(100, 'La tarifa no puede superar el 100%'),

    status: taxStatusSchema.default('ACTIVE'),

    validFrom: z
      .string({
        error: 'La fecha de inicio de vigencia es obligatoria',
      })
      .refine((val) => dateRegex.test(val), {
        message: 'La fecha de inicio debe tener el formato AAAA-MM-DD',
      }),

    validUntil: z
      .string()
      .optional()
      .nullable()
      .refine((val) => !val || dateRegex.test(val), {
        message: 'La fecha fin de vigencia debe tener el formato AAAA-MM-DD',
      }),

    description: z
      .string()
      .trim()
      .max(500, 'La descripción no puede exceder 500 caracteres')
      .optional()
      .or(z.literal('')),

    isDefault: z.boolean().optional().default(false),

    generatedTaxAccountId: z.string().trim().optional().or(z.literal('')),
    generatedTaxAccountName: z.string().trim().optional().or(z.literal('')),
    deductibleTaxAccountId: z.string().trim().optional().or(z.literal('')),
    deductibleTaxAccountName: z.string().trim().optional().or(z.literal('')),
  })
  .refine(
    (data) => {
      if (data.validUntil && data.validFrom) {
        return new Date(data.validUntil) >= new Date(data.validFrom)
      }
      return true
    },
    {
      message: 'La fecha fin de vigencia no puede ser anterior a la fecha de inicio',
      path: ['validUntil'],
    }
  )

export type TaxConfigFormData = z.infer<typeof taxConfigFormSchema>

export const taxFilterSchema = z.object({
  query: z.string().optional(),
  type: z.enum(['ALL', 'IVA', 'EXCLUIDO', 'NO_GRAVADO', 'OTRO']).default('ALL'),
  status: z.enum(['ALL', 'ACTIVE', 'INACTIVE']).default('ALL'),
  vigencia: z.enum(['ALL', 'ACTIVE', 'EXPIRED', 'FUTURE']).default('ALL'),
  sortBy: z
    .enum(['NAME_ASC', 'NAME_DESC', 'RATE_ASC', 'RATE_DESC', 'CODE_ASC', 'PRODUCTS_DESC'])
    .default('RATE_DESC'),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(10),
})
