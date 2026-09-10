import { z } from 'zod'

export const remissionItemSchema = z.object({
  productId: z.string().min(1, 'El ID del producto es obligatorio'),
  productName: z.string().optional(),
  sku: z.string().optional(),
  barcode: z.string().optional(),
  unitOfMeasure: z.string().default('UND'),
  quantityRequested: z.number().positive('La cantidad debe ser mayor a cero'),
  unitCost: z.number().nonnegative().optional(),
  unitPrice: z.number().nonnegative().optional(),
  notes: z.string().optional(),
})

export const createRemissionSchema = z.object({
  customerId: z.string().min(1, 'Debe seleccionar un cliente'),
  customerName: z.string().optional(),
  customerDoc: z.string().optional(),
  customerPhone: z.string().optional(),
  customerAddress: z.string().optional(),
  customerCity: z.string().optional(),
  locationId: z.string().min(1, 'Debe seleccionar una bodega origen'),
  locationName: z.string().optional(),
  saleId: z.string().nullable().optional(),
  saleNumber: z.string().nullable().optional(),
  deliveryAddress: z.string().optional(),
  deliveryCity: z.string().optional(),
  contactPerson: z.string().optional(),
  contactPhone: z.string().optional(),
  notes: z.string().optional(),
  status: z.enum(['DRAFT', 'CREATED']).default('CREATED'),
  items: z.array(remissionItemSchema).min(1, 'La remisión debe contener al menos un producto'),
})

export const createFromSaleSchema = z.object({
  saleId: z.string().min(1, 'El ID de la venta es obligatorio'),
  deliveryAddress: z.string().optional(),
  contactPerson: z.string().optional(),
  contactPhone: z.string().optional(),
  notes: z.string().optional(),
})

export const dispatchRemissionSchema = z.object({
  remissionId: z.string().min(1, 'El ID de la remisión es obligatorio'),
  carrierName: z.string().min(1, 'El nombre de la empresa transportadora o despacho es obligatorio'),
  vehiclePlate: z.string().optional(),
  driverName: z.string().min(1, 'El nombre del conductor o responsable de despacho es obligatorio'),
  driverDoc: z.string().optional(),
  notes: z.string().optional(),
})

export const deliverRemissionSchema = z.object({
  remissionId: z.string().min(1, 'El ID de la remisión es obligatorio'),
  deliveredAt: z.string().optional(),
  deliveredBy: z.string().optional(),
  receivedBy: z.string().min(1, 'El nombre de quien recibe la mercancía es obligatorio'),
  receivedDoc: z.string().optional(),
  deliveryEvidenceNotes: z.string().optional(),
  signatureNote: z.string().optional(),
})

export const cancelRemissionSchema = z.object({
  remissionId: z.string().min(1, 'El ID de la remisión es obligatorio'),
  reason: z.string().min(5, 'El motivo de anulación debe tener al menos 5 caracteres'),
})
