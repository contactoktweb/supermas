import { z } from 'zod'
import { slugify } from '@/features/categories/schemas/category.schema'

export { slugify }

export const brandFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'El nombre debe tener al menos 2 caracteres')
    .max(100, 'El nombre no puede exceder 100 caracteres'),
  slug: z
    .string()
    .trim()
    .min(2, 'El slug debe tener al menos 2 caracteres')
    .max(120, 'El slug no puede exceder 120 caracteres')
    .transform((val) => slugify(val)),
  logoUrl: z
    .string()
    .trim()
    .url('Debe ser una URL válida')
    .optional()
    .or(z.literal(''))
    .transform((val) => val || null),
  isActive: z.boolean().default(true),
})

export type BrandFormData = z.infer<typeof brandFormSchema>
