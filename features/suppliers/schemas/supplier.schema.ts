import { z } from 'zod'

export const documentTypeSchema = z.enum(['NIT', 'CC', 'CE', 'RUT', 'PASAPORTE'], {
  message: 'Tipo de documento no válido',
})

export const supplierStatusSchema = z.enum(['ACTIVE', 'INACTIVE'], {
  message: 'Estado del proveedor no válido',
})

export const createSupplierSchema = z.object({
  documentType: documentTypeSchema,
  documentNumber: z
    .string({ message: 'El número de documento es obligatorio' })
    .min(3, { message: 'El documento debe contener al menos 3 caracteres' })
    .trim(),
  businessName: z
    .string({ message: 'La razón social es obligatoria' })
    .min(3, { message: 'La razón social debe contener al menos 3 caracteres' })
    .trim(),
  commercialName: z.string().trim().optional(),
  contactName: z
    .string({ message: 'El nombre de contacto principal es obligatorio' })
    .min(2, { message: 'El contacto debe tener al menos 2 caracteres' })
    .trim(),
  phone: z
    .string({ message: 'El teléfono es obligatorio' })
    .min(7, { message: 'Ingrese un teléfono de contacto válido' })
    .trim(),
  email: z
    .string({ message: 'El correo electrónico es obligatorio' })
    .email({ message: 'Formato de correo electrónico inválido' })
    .trim(),
  address: z
    .string({ message: 'La dirección es obligatoria' })
    .min(4, { message: 'La dirección debe tener al menos 4 caracteres' })
    .trim(),
  city: z
    .string({ message: 'La ciudad es obligatoria' })
    .min(2, { message: 'Ingrese una ciudad válida' })
    .trim(),
  department: z
    .string({ message: 'El departamento es obligatorio' })
    .min(2, { message: 'Ingrese un departamento válido' })
    .trim(),
  country: z.string().default('Colombia'),
  status: supplierStatusSchema.default('ACTIVE'),
  creditDays: z
    .number()
    .int({ message: 'Los días de crédito deben ser un número entero' })
    .min(0, { message: 'Los días de crédito no pueden ser negativos' })
    .default(0),
  creditLimit: z
    .number()
    .min(0, { message: 'El cupo de crédito no puede ser negativo' })
    .default(0),
  notes: z.string().optional(),
})

export const updateSupplierSchema = createSupplierSchema.partial().extend({
  id: z.string().min(1, { message: 'ID de proveedor obligatorio' }),
})

export const registerSupplierPaymentSchema = z.object({
  supplierId: z.string().min(1, { message: 'ID de proveedor requerido' }),
  purchaseId: z.string().min(1, { message: 'ID de compra requerida' }),
  amount: z.number().positive({ message: 'El valor a pagar debe ser mayor a 0' }),
  paymentMethod: z.string().min(1, { message: 'El método de pago es requerido' }),
  reference: z.string().min(1, { message: 'La referencia o comprobante es obligatoria' }),
  notes: z.string().optional(),
})

export const supplierFilterSchema = z.object({
  query: z.string().optional(),
  documentNumber: z.string().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'ALL']).optional(),
  locationId: z.string().optional(),
  hasPendingBalance: z.boolean().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(10),
  sortField: z
    .enum([
      'businessName',
      'documentNumber',
      'totalPurchased',
      'currentBalance',
      'lastPurchaseDate',
      'createdAt',
    ])
    .optional(),
  sortDirection: z.enum(['asc', 'desc']).optional(),
})
