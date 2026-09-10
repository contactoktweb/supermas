import { remissionRepository, RemissionRepository } from '../repositories/remission.repository'
import {
  createRemissionSchema,
  createFromSaleSchema,
  dispatchRemissionSchema,
  deliverRemissionSchema,
  cancelRemissionSchema,
} from '../schemas/remission.schema'
import {
  Remission,
  RemissionFilters,
  RemissionStats,
  CreateRemissionPayload,
  CreateFromSalePayload,
  DispatchRemissionPayload,
  DeliverRemissionPayload,
  CancelRemissionPayload,
  RemissionUserContext,
  RemissionItem,
} from '../types'
import { db } from '@/lib/supabase'

const DEFAULT_ADMIN_USER: RemissionUserContext = {
  userId: 'usr-admin-01',
  userName: 'Admin Mauricio',
  userRole: 'Administrador',
  permissions: [
    'remission.read',
    'remission.create',
    'remission.update',
    'remission.dispatch',
    'remission.receive',
    'remission.cancel',
    'remission.export',
  ],
}

export class RemissionService {
  constructor(private repo: RemissionRepository = remissionRepository) {}

  /**
   * Helper para verificar permisos RBAC del usuario
   */
  private checkPermission(context: RemissionUserContext, permission: string): void {
    if (!context.permissions.includes(permission) && !context.permissions.includes('*')) {
      throw new Error(
        `Acceso denegado: El usuario "${context.userName}" no cuenta con el permiso requerido [${permission}].`
      )
    }
  }

  /**
   * Lista remisiones con filtros y paginación
   */
  async list(
    filters: RemissionFilters = {},
    user: RemissionUserContext = DEFAULT_ADMIN_USER
  ) {
    this.checkPermission(user, 'remission.read')
    return this.repo.findAll(filters)
  }

  /**
   * Obtiene detalle de remisión por ID o número
   */
  async getById(id: string, user: RemissionUserContext = DEFAULT_ADMIN_USER): Promise<Remission> {
    this.checkPermission(user, 'remission.read')
    const rem = await this.repo.findById(id)
    if (!rem) {
      throw new Error(`La remisión con ID o número "${id}" no existe.`)
    }
    return rem
  }

  /**
   * Obtiene estadísticas consolidadas del módulo de Remisiones
   */
  async getRemissionStats(user: RemissionUserContext = DEFAULT_ADMIN_USER): Promise<RemissionStats> {
    this.checkPermission(user, 'remission.read')
    return this.repo.getStats()
  }

  /**
   * Obtiene ventas pendientes de generar remisión de entrega
   */
  async getSalesPendingRemission(user: RemissionUserContext = DEFAULT_ADMIN_USER) {
    this.checkPermission(user, 'remission.read')
    return this.repo.getSalesPendingRemission()
  }

  /**
   * Crea una nueva remisión manual
   */
  async create(
    payload: CreateRemissionPayload,
    user: RemissionUserContext = DEFAULT_ADMIN_USER
  ): Promise<Remission> {
    this.checkPermission(user, 'remission.create')
    const validated = createRemissionSchema.parse(payload)

    // 1. Validar Cliente
    const customers = (db.customers as unknown as Array<any>) || []
    const customer = customers.find((c) => c.id === validated.customerId)
    const customerName = validated.customerName || customer?.name || 'Cliente Comercial'
    const customerDoc = validated.customerDoc || customer?.documentNumber || customer?.nit || '222222222222'

    // 2. Validar Bodega
    const locations = (db.locations as unknown as Array<any>) || []
    const location = locations.find((l) => l.id === validated.locationId)
    if (!location) {
      throw new Error(`La bodega seleccionada con ID "${validated.locationId}" no es válida.`)
    }

    // 3. Validar y Mapear Ítems
    const products = (db.products as unknown as Array<any>) || []
    let totalUnits = 0

    const mappedItems: RemissionItem[] = validated.items.map((item, idx) => {
      const prod = products.find((p) => p.id === item.productId || p.sku === item.productId)
      const qty = Number(item.quantityRequested)
      if (qty <= 0) {
        throw new Error(`La cantidad del producto ${item.productName || item.productId} debe ser mayor a 0.`)
      }
      totalUnits += qty

      return {
        id: `ritem-${Date.now()}-${idx}`,
        productId: item.productId,
        productName: item.productName || prod?.name || 'Producto General',
        sku: item.sku || prod?.sku || `SKU-${idx + 100}`,
        barcode: item.barcode || prod?.barcode || '',
        unitOfMeasure: item.unitOfMeasure || prod?.unitOfMeasure || 'UND',
        quantityRequested: qty,
        quantityDelivered: 0,
        unitCost: item.unitCost || prod?.costPrice || 0,
        unitPrice: item.unitPrice || prod?.salePrice || 0,
        notes: item.notes,
      }
    })

    const nextNum = Math.floor(100 + Math.random() * 900)
    const remissionNumber = `REM-${new Date().getFullYear()}-${nextNum}`
    const nowIso = new Date().toISOString()

    const newRemission: Remission = {
      id: `rem-${Date.now().toString().slice(-6)}`,
      remissionNumber,
      prefix: 'REM',
      saleId: validated.saleId || null,
      saleNumber: validated.saleNumber || null,
      invoiceId: null,
      invoiceNumber: null,
      customerId: validated.customerId,
      customerName,
      customerDoc,
      customerPhone: validated.customerPhone || customer?.phone,
      customerAddress: validated.customerAddress || customer?.address,
      customerCity: validated.customerCity || customer?.city || 'Bogotá, D.C.',
      locationId: validated.locationId,
      locationName: location.name,
      date: nowIso,
      createdAt: nowIso,
      updatedAt: nowIso,
      status: validated.status || 'CREATED',
      items: mappedItems,
      itemsCount: mappedItems.length,
      totalUnits,
      deliveryAddress: validated.deliveryAddress || validated.customerAddress || customer?.address,
      deliveryCity: validated.deliveryCity || customer?.city || 'Bogotá, D.C.',
      contactPerson: validated.contactPerson || customer?.contactPerson,
      contactPhone: validated.contactPhone || customer?.phone,
      notes: validated.notes || 'Remisión generada para entrega de mercancía.',
      createdBy: user.userName,
    }

    return this.repo.create(newRemission, user.userName)
  }

  /**
   * Genera una remisión de entrega a partir de una venta confirmada
   */
  async createFromSale(
    payload: CreateFromSalePayload,
    user: RemissionUserContext = DEFAULT_ADMIN_USER
  ): Promise<Remission> {
    this.checkPermission(user, 'remission.create')
    const validated = createFromSaleSchema.parse(payload)

    // 1. Obtener la venta
    const sales = (db.sales as unknown as Array<any>) || []
    const sale = sales.find((s) => s.id === validated.saleId || s.saleNumber === validated.saleId)
    if (!sale) {
      throw new Error(`No se encontró la venta con ID "${validated.saleId}".`)
    }

    if (sale.status === 'CANCELLED') {
      throw new Error('No se puede generar remisión de una venta anulada.')
    }

    // 2. Validar que no tenga remisión previa activa
    const existingRemission = await this.repo.findBySaleId(sale.id)
    if (existingRemission && existingRemission.status !== 'CANCELLED') {
      throw new Error(
        `La venta ${sale.saleNumber} ya cuenta con la remisión ${existingRemission.remissionNumber} generada.`
      )
    }

    // 3. Mapear productos de la venta
    const saleItems = sale.items || []
    if (saleItems.length === 0) {
      throw new Error('La venta no contiene productos para despachar.')
    }

    return this.create(
      {
        customerId: sale.customerId,
        customerName: sale.customerName,
        customerDoc: sale.customerDoc,
        customerPhone: sale.customerPhone,
        customerAddress: sale.customerAddress,
        customerCity: sale.customerCity,
        locationId: sale.locationId,
        locationName: sale.locationName,
        saleId: sale.id,
        saleNumber: sale.saleNumber,
        deliveryAddress: validated.deliveryAddress || sale.customerAddress,
        contactPerson: validated.contactPerson || sale.customerName,
        contactPhone: validated.contactPhone || sale.customerPhone,
        notes: validated.notes || `Despacho generado desde venta comercial ${sale.saleNumber}`,
        status: 'CREATED',
        items: saleItems.map((item: any) => ({
          productId: item.productId,
          productName: item.productName,
          sku: item.sku,
          barcode: item.barcode,
          unitOfMeasure: item.unitOfMeasure || 'UND',
          quantityRequested: item.quantity,
          unitCost: item.unitCost,
          unitPrice: item.unitPrice,
          notes: item.notes,
        })),
      },
      user
    )
  }

  /**
   * Despacha la remisión (genera salida de inventario Kardex REMISSION_OUT)
   */
  async dispatch(
    payload: DispatchRemissionPayload,
    user: RemissionUserContext = DEFAULT_ADMIN_USER
  ): Promise<Remission> {
    this.checkPermission(user, 'remission.dispatch')
    const validated = dispatchRemissionSchema.parse(payload)

    const remission = await this.repo.findById(validated.remissionId)
    if (!remission) {
      throw new Error(`La remisión "${validated.remissionId}" no existe.`)
    }

    // Validar disponibilidad de stock en la bodega
    const stockLevels = (db.stockLevels as unknown as Array<any>) || []
    for (const item of remission.items) {
      const stockEntry = stockLevels.find(
        (s) => s.productId === item.productId && s.locationId === remission.locationId
      )
      const available = stockEntry ? stockEntry.availableUnits : 100
      if (available < item.quantityRequested) {
        console.warn(
          `Advertencia de stock: El producto ${item.productName} tiene ${available} unidades disponibles en ${remission.locationName} y se solicitaron ${item.quantityRequested}.`
        )
      }
    }

    return this.repo.dispatch(validated.remissionId, validated, user.userName)
  }

  /**
   * Confirma la entrega física al cliente
   */
  async deliver(
    payload: DeliverRemissionPayload,
    user: RemissionUserContext = DEFAULT_ADMIN_USER
  ): Promise<Remission> {
    this.checkPermission(user, 'remission.receive')
    const validated = deliverRemissionSchema.parse(payload)

    return this.repo.deliver(validated.remissionId, validated, user.userName)
  }

  /**
   * Anula la remisión y revierte inventario si ya estaba despachada
   */
  async cancel(
    payload: CancelRemissionPayload,
    user: RemissionUserContext = DEFAULT_ADMIN_USER
  ): Promise<Remission> {
    this.checkPermission(user, 'remission.cancel')
    const validated = cancelRemissionSchema.parse(payload)

    return this.repo.cancel(validated.remissionId, validated.reason, user.userName)
  }

  /**
   * Vincula una factura emitida con la remisión
   */
  async linkInvoice(
    remissionId: string,
    invoiceId: string,
    invoiceNumber: string,
    user: RemissionUserContext = DEFAULT_ADMIN_USER
  ): Promise<Remission> {
    this.checkPermission(user, 'remission.update')
    return this.repo.linkInvoice(remissionId, invoiceId, invoiceNumber)
  }
}

export const remissionService = new RemissionService()
