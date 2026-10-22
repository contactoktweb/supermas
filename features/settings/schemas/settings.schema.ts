/**
 * SUPER MÁS ERP/POS - Validación del módulo Configuración General.
 */

import { z } from 'zod'

const digits = (label: string, length: number) =>
  z.string().trim().regex(new RegExp(`^\\d{${length}}$`), `${label}: ${length} dígitos`)

export const companySettingsSchema = z.object({
  id: z.string().uuid().optional(),
  companyName: z.string().trim().min(2, 'El nombre comercial debe tener al menos 2 caracteres'),
  legalName: z.string().trim().min(2, 'La razón social es obligatoria'),
  nit: z.string().trim().regex(/^\d{5,15}$/, 'El NIT debe tener entre 5 y 15 dígitos, sin puntos ni dígito de verificación'),
  dv: z.string().trim().regex(/^\d$/, 'El dígito de verificación es un número de 0 a 9'),
  fiscalRegime: z.string().min(2, 'El régimen tributario es obligatorio'),
  economicActivityCode: z.string().trim().regex(/^\d{4}$/, 'El código CIIU tiene 4 dígitos'),
  legalRepresentative: z.string().trim().max(150).default(''),
  legalRepresentativeDoc: z.string().trim().max(30).default(''),
  address: z.string().trim().min(3, 'La dirección es obligatoria'),
  city: z.string().trim().min(2, 'La ciudad es obligatoria'),
  department: z.string().trim().min(2, 'El departamento es obligatorio'),
  country: z.string().trim().min(2).default('Colombia'),
  postalCode: z.string().trim().regex(/^(\d{6})?$/, 'El código postal tiene 6 dígitos').default(''),
  phone: z.string().trim().min(7, 'El teléfono es obligatorio'),
  email: z.string().trim().email('Correo electrónico inválido'),
  billingEmail: z.string().trim().email('Correo de facturación inválido').or(z.literal('')).default(''),
  currency: z.string().default('COP'),
  status: z.enum(['ACTIVE', 'INACTIVE']).default('ACTIVE'),
  dianDepartmentCode: digits('Código DIAN del departamento', 2),
  dianMunicipalityCode: digits('Código DIAN del municipio', 5),
  dianOrganizationType: z.enum(['1', '2']),
  rutResponsibilities: z
    .string()
    .trim()
    .regex(/^[A-Z0-9-]{1,10}(;[A-Z0-9-]{1,10})*$/, 'Responsabilidades del RUT separadas por punto y coma (ej. 05;07;48)'),
  dianTaxLevelCodes: z.string().trim().min(2, 'El código de responsabilidad fiscal es obligatorio (ej. R-99-PN)'),
  dianTaxSchemeCode: z.string().trim().regex(/^(01|04|ZA|ZZ)$/, 'Esquema tributario DIAN: 01, 04, ZA o ZZ'),
  updatedAt: z.string().optional(),
})

export const inventorySettingsSchema = z
  .object({
    defaultMinStockThreshold: z.number().int().min(1, 'El stock mínimo debe ser al menos 1 unidad'),
    criticalLowStockThreshold: z.number().int().min(0, 'El umbral crítico no puede ser negativo'),
  })
  .refine((v) => v.criticalLowStockThreshold <= v.defaultMinStockThreshold, {
    message: 'El umbral crítico no puede superar el stock mínimo',
    path: ['criticalLowStockThreshold'],
  })

export const posSettingsSchema = z.object({
  defaultLocationId: z.string(),
  autoPrintReceipt: z.boolean(),
})

export const cashSettingsSchema = z
  .object({
    recommendedInitialFloat: z.number().min(0, 'La base sugerida no puede ser negativa'),
    maxAllowedInitialFloat: z.number().min(0, 'El máximo no puede ser negativo'),
    maxDifferenceToleranceAmount: z.number().min(0, 'La tolerancia no puede ser negativa'),
  })
  .refine((v) => v.maxAllowedInitialFloat === 0 || v.recommendedInitialFloat <= v.maxAllowedInitialFloat, {
    message: 'La base sugerida no puede superar el máximo permitido',
    path: ['recommendedInitialFloat'],
  })

export const ecommerceSettingsSchema = z.object({
  dispatchLocationId: z.string(),
  superCatalogEnabled: z.boolean(),
  distributorCatalogEnabled: z.boolean(),
  whatsappPhone: z
    .string()
    .trim()
    .transform((v) => v.replace(/[^\d]/g, ''))
    .refine((v) => v === '' || /^\d{10,15}$/.test(v), 'El WhatsApp debe incluir el indicativo del país (ej. 573001234567)'),
  whatsappQuoteTemplate: z.string().trim().min(10, 'La plantilla debe tener al menos 10 caracteres').max(500),
})

export const generalSettingsSchema = z.object({
  exogenaDefaultYear: z.number().int().min(2019, 'Año gravable no válido').max(new Date().getFullYear(), 'Año gravable no válido'),
  sessionTimeoutMinutes: z.number().int().min(5, 'Mínimo 5 minutos').max(720, 'Máximo 12 horas'),
})
