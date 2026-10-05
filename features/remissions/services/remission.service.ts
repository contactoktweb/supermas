/**
 * SUPER MÁS ERP/POS - Servicio de Negocio de Remisiones (RemissionService)
 * 
 * Validación de reglas de negocio, esquemas Zod y delegación a RemissionRepository
 * con persistencia 100% real en PostgreSQL / Supabase y control multiempresa.
 */

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
} from '../types'

export class RemissionService {
  constructor(private repo: RemissionRepository = remissionRepository) {}

  /**
   * Helper para verificar permisos RBAC del usuario (si se proporciona contexto)
   */
  private checkPermission(context?: RemissionUserContext, permission?: string): void {
    if (!context || !permission) return
    if (!context.permissions.includes(permission) && !context.permissions.includes('*')) {
      throw new Error(
        `Acceso denegado: El usuario "${context.userName}" no cuenta con el permiso requerido [${permission}].`
      )
    }
  }

  /**
   * Lista remisiones con filtros y paginación
   */
  async list(filters: RemissionFilters = {}, user?: RemissionUserContext) {
    this.checkPermission(user, 'remission.read')
    return this.repo.findAll(filters)
  }

  /**
   * Obtiene detalle de remisión por ID o número
   */
  async getById(id: string, user?: RemissionUserContext): Promise<Remission> {
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
  async getRemissionStats(user?: RemissionUserContext): Promise<RemissionStats> {
    this.checkPermission(user, 'remission.read')
    return this.repo.getStats()
  }

  /**
   * Obtiene ventas pendientes de generar remisión de entrega
   */
  async getSalesPendingRemission(user?: RemissionUserContext) {
    this.checkPermission(user, 'remission.read')
    return this.repo.getSalesPendingRemission()
  }

  /**
   * Crea una nueva remisión manual o borrador
   */
  async create(
    payload: CreateRemissionPayload,
    user?: RemissionUserContext
  ): Promise<Remission> {
    this.checkPermission(user, 'remission.create')
    const validated = createRemissionSchema.parse(payload)

    return this.repo.create(validated as CreateRemissionPayload)
  }

  /**
   * Edita una remisión en borrador (DRAFT)
   */
  async updateDraft(
    payload: {
      remissionId: string
      customerId: string
      locationId: string
      items: { productId: string; quantityRequested: number; unitPrice?: number; notes?: string }[]
      deliveryAddress?: string
      deliveryCity?: string
      contactPerson?: string
      contactPhone?: string
      notes?: string
    },
    user?: RemissionUserContext
  ): Promise<Remission> {
    this.checkPermission(user, 'remission.update')
    return this.repo.updateDraft(payload)
  }

  /**
   * Genera una remisión de entrega a partir de una venta confirmada
   */
  async createFromSale(
    payload: CreateFromSalePayload,
    user?: RemissionUserContext
  ): Promise<Remission> {
    this.checkPermission(user, 'remission.create')
    const validated = createFromSaleSchema.parse(payload)

    // 1. Validar que no tenga remisión previa activa
    const existingRemission = await this.repo.findBySaleId(validated.saleId)
    if (existingRemission && existingRemission.status !== 'CANCELLED') {
      throw new Error(
        `La venta ya cuenta con la remisión ${existingRemission.remissionNumber} generada.`
      )
    }

    // 2. Consultar venta en PostgreSQL
    const pendingSales = await this.repo.getSalesPendingRemission()
    const sale = pendingSales.find((s) => s.id === validated.saleId)
    if (!sale) {
      throw new Error(`No se encontró la venta con ID "${validated.saleId}" disponible para remisión.`)
    }

    // 3. Crear remisión asociada a la venta
    return this.create(
      {
        customerId: sale.customerId,
        locationId: sale.locationId,
        saleId: sale.id,
        deliveryAddress: validated.deliveryAddress || sale.customerAddress,
        contactPerson: validated.contactPerson || sale.customerName,
        contactPhone: validated.contactPhone || sale.customerPhone,
        notes: validated.notes || `Despacho generado desde venta comercial ${sale.saleNumber}`,
        status: 'CREATED',
        items: [], // En caso de que se agreguen ítems específicos
      },
      user
    )
  }

  /**
   * Despacha la remisión (genera salida de inventario Kardex SALE_OUT)
   */
  async dispatch(
    payload: DispatchRemissionPayload,
    user?: RemissionUserContext
  ): Promise<Remission> {
    this.checkPermission(user, 'remission.dispatch')
    const validated = dispatchRemissionSchema.parse(payload)
    return this.repo.dispatch(validated.remissionId, validated)
  }

  /**
   * Confirma la entrega física al cliente
   */
  async deliver(
    payload: DeliverRemissionPayload,
    user?: RemissionUserContext
  ): Promise<Remission> {
    this.checkPermission(user, 'remission.receive')
    const validated = deliverRemissionSchema.parse(payload)
    return this.repo.deliver(validated.remissionId, validated)
  }

  /**
   * Anula una remisión (reversión física a inventario si estaba despachada)
   */
  async cancel(
    payload: CancelRemissionPayload,
    user?: RemissionUserContext
  ): Promise<Remission> {
    this.checkPermission(user, 'remission.cancel')
    const validated = cancelRemissionSchema.parse(payload)
    return this.repo.cancel(validated.remissionId, validated.reason)
  }
}

export const remissionService = new RemissionService()
