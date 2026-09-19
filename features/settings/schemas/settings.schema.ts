/**
 * SUPER MÁS ERP/POS - Esquemas de Validación Zod (Módulo Configuración)
 */

import { z } from 'zod'

export const companySettingsSchema = z.object({
  companyName: z.string().min(2, 'El nombre de la empresa debe tener al menos 2 caracteres'),
  legalName: z.string().min(2, 'La razón social es obligatoria'),
  nit: z.string().regex(/^\d{3}\.\d{3}\.\d{3}-\d$/, 'Formato de NIT inválido (ej. 900.842.109-4)'),
  dv: z.string().length(1, 'El dígito de verificación debe ser de 1 dígito'),
  fiscalRegime: z.string().min(2, 'El régimen fiscal es obligatorio'),
  economicActivityCode: z.string().min(4, 'Código de actividad económica CIIU requerido'),
  legalRepresentative: z.string().min(3, 'El representante legal es obligatorio'),
  legalRepresentativeDoc: z.string().min(4, 'Documento de representante legal requerido'),
  address: z.string().min(5, 'Dirección requerida'),
  city: z.string().min(2, 'Ciudad requerida'),
  department: z.string().min(2, 'Departamento requerido'),
  postalCode: z.string().optional().default('050001'),
  phone: z.string().min(7, 'Teléfono requerido'),
  mobile: z.string().min(10, 'Celular requerido'),
  email: z.string().email('Correo electrónico corporativo inválido'),
  billingEmail: z.string().email('Correo de facturación electrónica inválido'),
  website: z.string().url('URL del sitio web inválida').or(z.string().min(3)),
  logoUrl: z.string().min(1, 'URL o ruta del logotipo requerida'),
  currency: z.string().default('COP'),
  timezone: z.string().default('America/Bogota'),
  commercialDescription: z.string().max(500).optional().default(''),
})

export const inventorySettingsSchema = z.object({
  defaultMinStockThreshold: z.number().int().min(1, 'El stock mínimo debe ser al menos 1 unidad'),
  criticalLowStockThreshold: z.number().int().min(0, 'El umbral crítico no puede ser negativo'),
  valuationMethod: z.enum(['WEIGHTED_AVERAGE', 'PEPS_FIFO']),
  allowNegativeStock: z.boolean().default(false),
  requireReasonForManualAdjustments: z.boolean().default(true),
  autoGenerateKardexMovement: z.boolean().default(true),
  stockCheckFrequencyHours: z.number().int().positive().default(24),
  webAvailability: z.object({
    showAvailableBadge: z.boolean().default(true),
    showLowStockBadge: z.boolean().default(true),
    showOutOfStockBadge: z.boolean().default(true),
    lowStockWarningThreshold: z.number().int().positive().default(10),
    hideOutOfStockAfterDays: z.number().int().min(0).default(0),
  }),
  transferRules: z.object({
    requireDualApproval: z.boolean().default(false),
    autoBlockTransitAfterHours: z.number().int().positive().default(24),
    defaultOriginLocationId: z.string().min(1),
  }),
})

export const posSettingsSchema = z.object({
  defaultLocationId: z.string().min(1, 'La sede por defecto es requerida'),
  defaultLocationName: z.string().min(1),
  defaultCashRegisterId: z.string().min(1, 'Caja inicial requerida'),
  genericCustomerId: z.string().min(1),
  genericCustomerName: z.string().min(1),
  genericCustomerDoc: z.string().min(1),
  autoPrintReceipt: z.boolean().default(true),
  allowQuickSaleWithoutCustomer: z.boolean().default(true),
  defaultReceiptTemplate: z.string().default('TICKET_58MM'),
  enableSoundFeedback: z.boolean().default(true),
  enabledPaymentMethods: z.array(z.enum(['CASH', 'CARD', 'TRANSFER', 'CREDIT'])).min(1),
  cashRegisterRules: z.object({
    recommendedInitialFloat: z.number().min(0),
    maxAllowedInitialFloat: z.number().positive(),
    requireDailyClose: z.boolean().default(true),
    maxOpenHoursBeforeAlert: z.number().int().positive().default(14),
    maxDifferenceToleranceAmount: z.number().min(0).default(0),
    requireDualSignatureOnDiscrepancy: z.boolean().default(true),
  }),
  salesPriceList: z.string().default('PRICE_NORMAL'),
})

export const ecommerceSettingsSchema = z.object({
  dispatchWarehouseId: z.string().min(1, 'La bodega de despacho ecommerce es obligatoria'),
  dispatchWarehouseName: z.string().min(1),
  superCatalogEnabled: z.boolean().default(true),
  distributorCatalogEnabled: z.boolean().default(true),
  publicShowPrices: z.boolean().default(true),
  publicShowAvailability: z.boolean().default(true),
  defaultLowStockThreshold: z.number().int().positive().default(10),
  outOfStockBehavior: z.string().default('SHOW_AS_OUT_OF_STOCK_DISABLE_PURCHASE'),
  webPriceList: z.string().default('PRICE_WEB'),
  distributorPriceList: z.string().default('PRICE_WHOLESALE'),
  whatsapp: z.object({
    phoneNumber: z.string().min(10, 'Número de WhatsApp corporativo requerido'),
    displayPhoneNumber: z.string().min(10),
    defaultQuoteTemplate: z.string().min(5),
    defaultSupportTemplate: z.string().min(5),
    allowDirectWhatsAppPurchase: z.boolean().default(true),
  }),
  cartRules: z.object({
    minOrderAmount: z.number().min(0).default(50000),
    maxOrderAmount: z.number().positive().default(50000000),
    autoReserveStockMinutes: z.number().int().positive().default(120),
  }),
})

export const updateDynamicSettingSchema = z.object({
  key: z.string().min(1, 'La clave de configuración es obligatoria'),
  value: z.any(),
  notes: z.string().max(300).optional(),
})

export type CompanySettingsInput = z.infer<typeof companySettingsSchema>
export type InventorySettingsInput = z.infer<typeof inventorySettingsSchema>
export type POSSettingsInput = z.infer<typeof posSettingsSchema>
export type EcommerceSettingsInput = z.infer<typeof ecommerceSettingsSchema>
export type UpdateDynamicSettingInput = z.infer<typeof updateDynamicSettingSchema>
