import { z } from 'zod'

export function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Eliminar acentos
    .replace(/[^a-z0-9\s-]/g, '') // Remover caracteres inválidos
    .replace(/[\s_]+/g, '-') // Espacios a guiones
    .replace(/^-+|-+$/g, '') // Remover guiones iniciales y finales
}

export const categoryFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'El nombre debe tener al menos 2 caracteres')
    .max(100, 'El nombre no puede exceder 100 caracteres'),
  code: z
    .string()
    .trim()
    .max(30, 'El código no puede exceder 30 caracteres')
    .optional()
    .or(z.literal(''))
    .transform((val) => (val ? val.toUpperCase().replace(/\s+/g, '-') : null)),
  slug: z
    .string()
    .trim()
    .min(2, 'El slug debe tener al menos 2 caracteres')
    .max(120, 'El slug no puede exceder 120 caracteres')
    .transform((val) => slugify(val)),
  description: z
    .string()
    .trim()
    .max(500, 'La descripción no puede exceder 500 caracteres')
    .optional()
    .or(z.literal(''))
    .transform((val) => val || null),
  parentId: z
    .string()
    .uuid('Identificador de categoría padre inválido')
    .nullable()
    .optional()
    .or(z.literal(''))
    .transform((val) => (val && val !== '' ? val : null)),
  isActive: z.boolean().default(true),
  sortOrder: z.coerce.number().int().min(0, 'El orden debe ser mayor o igual a 0').default(0),
})

export type CategoryFormData = z.infer<typeof categoryFormSchema>
