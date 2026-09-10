import { z } from 'zod'

export const customerDocumentTypeSchema = z.enum([
  'CC',
  'NIT',
  'CE',
  'PASSPORT',
  'OTHER',
])

export const customerTypeSchema = z.enum(['NATURAL', 'COMPANY'])

export const customerCategorySchema = z.enum([
  'FINAL_CONSUMER',
  'FREQUENT',
  'WHOLESALE',
  'COMPANY',
])

export const customerPriceListSchema = z.enum(['DEFAULT', 'WHOLESALE', 'VIP'])

export const customerStatusSchema = z.enum(['ACTIVE', 'INACTIVE'])

export const createCustomerSchema = z
  .object({
    customerType: customerTypeSchema,
    documentType: customerDocumentTypeSchema,
    documentNumber: z
      .string()
      .min(3, 'El número de documento debe tener al menos 3 caracteres')
      .max(30, 'El número de documento no puede exceder 30 caracteres')
      .transform((val) => val.trim()),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    businessName: z.string().optional(),
    commercialName: z.string().optional(),
    contactPerson: z.string().optional(),
    phone: z
      .string()
      .min(7, 'El teléfono debe tener al menos 7 dígitos')
      .max(25, 'El teléfono no puede superar los 25 caracteres')
      .transform((val) => val.trim()),
    mobile: z.string().optional(),
    email: z
      .string()
      .email('El correo electrónico no tiene un formato válido')
      .transform((val) => val.trim().toLowerCase()),
    address: z
      .string()
      .min(4, 'La dirección comercial o de residencia es requerida')
      .transform((val) => val.trim()),
    city: z
      .string()
      .min(2, 'La ciudad es requerida')
      .transform((val) => val.trim()),
    department: z
      .string()
      .min(2, 'El departamento es requerido')
      .transform((val) => val.trim()),
    country: z.string().default('Colombia'),
    category: customerCategorySchema.default('FREQUENT'),
    priceList: customerPriceListSchema.default('DEFAULT'),
    creditLimit: z.number().min(0, 'El cupo de crédito no puede ser negativo').default(0),
    creditDays: z.number().min(0, 'Los días de crédito no pueden ser negativos').max(180, 'El plazo máximo de crédito es 180 días').default(0),
    preferredLocationId: z.string().optional(),
    notes: z.string().optional(),
  })
  .refine(
    (data) => {
      if (data.customerType === 'COMPANY') {
        return Boolean(data.businessName && data.businessName.trim().length >= 3)
      }
      return Boolean(data.firstName && data.firstName.trim().length >= 2)
    },
    {
      message: 'Debe ingresar la Razón Social para empresas o el Nombre para personas naturales',
      path: ['businessName'],
    }
  )

export const updateCustomerSchema = z.object({
  customerType: customerTypeSchema.optional(),
  documentType: customerDocumentTypeSchema.optional(),
  documentNumber: z.string().min(3).max(30).optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  businessName: z.string().optional(),
  commercialName: z.string().optional(),
  contactPerson: z.string().optional(),
  phone: z.string().min(7).max(25).optional(),
  mobile: z.string().optional(),
  email: z.string().email('Formato de correo no válido').optional(),
  address: z.string().min(4).optional(),
  city: z.string().min(2).optional(),
  department: z.string().min(2).optional(),
  country: z.string().optional(),
  category: customerCategorySchema.optional(),
  priceList: customerPriceListSchema.optional(),
  creditLimit: z.number().min(0).optional(),
  creditDays: z.number().min(0).max(180).optional(),
  preferredLocationId: z.string().optional(),
  status: customerStatusSchema.optional(),
  notes: z.string().optional(),
})

export const customerPaymentSchema = z.object({
  customerId: z.string().min(1, 'El ID del cliente es requerido'),
  invoiceId: z.string().optional(),
  amount: z.number().positive('El valor del pago debe ser mayor a cero'),
  paymentMethod: z.enum(['TRANSFERENCIA', 'EFECTIVO', 'TARJETA', 'CHEQUE', 'OTRO']),
  reference: z.string().min(3, 'La referencia o comprobante bancario es requerido'),
  notes: z.string().optional(),
})

export const customerDocumentSchema = z.object({
  customerId: z.string().min(1, 'El ID del cliente es requerido'),
  fileName: z.string().min(3, 'El nombre del archivo es requerido'),
  fileSize: z.string().default('1.0 MB'),
  fileType: z.string().default('application/pdf'),
  category: z.enum(['RUT', 'CAMARA_COMERCIO', 'CEDULA', 'ACUERDO_COMERCIAL', 'OTRO']),
  notes: z.string().optional(),
})

export const customerFilterSchema = z.object({
  query: z.string().optional(),
  documentNumber: z.string().optional(),
  customerType: z.union([customerTypeSchema, z.literal('ALL')]).optional(),
  category: z.union([customerCategorySchema, z.literal('ALL')]).optional(),
  city: z.string().optional(),
  status: z.union([customerStatusSchema, z.literal('ALL')]).optional(),
  priceList: z.union([customerPriceListSchema, z.literal('ALL')]).optional(),
  hasPurchases: z.boolean().optional(),
  hasBalance: z.boolean().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().positive().default(10),
  sortBy: z.enum(['displayName', 'totalPurchased', 'lastPurchaseDate', 'createdAt', 'currentBalance']).default('displayName'),
  sortDirection: z.enum(['asc', 'desc']).default('asc'),
})
