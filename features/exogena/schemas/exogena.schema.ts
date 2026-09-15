import { z } from 'zod'

export const exogenaConfigSchema = z.object({
  year: z.number().int().min(2020).max(2035),
  obligadoType: z.string().min(3, 'El tipo de obligado tributario es requerido'),
  responsibleName: z.string().min(3, 'El nombre del contador o revisor fiscal es obligatorio'),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha de vencimiento en formato AAAA-MM-DD'),
  enabledFormats: z
    .array(z.string())
    .min(1, 'Debes seleccionar al menos un formato para la obligación de Exógena'),
  grossRevenueThreshold: z.number().min(0, 'El tope de ingresos brutos no puede ser negativo'),
})

export type ExogenaConfigFormData = z.infer<typeof exogenaConfigSchema>

export const exogenaGenerationRequestSchema = z.object({
  year: z.number().int().min(2020).max(2035),
  formatNumbers: z
    .array(z.string())
    .min(1, 'Selecciona los formatos que deseas consolidar y generar'),
  fileFormat: z.enum(['XML', 'CSV']).default('XML'),
  notes: z.string().max(500).optional().or(z.literal('')),
})

export type ExogenaGenerationRequest = z.infer<typeof exogenaGenerationRequestSchema>
