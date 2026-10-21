import { salesRepository, SalesRepository, SalePaymentInput } from '../repositories/sales.repository'
import {
  createSaleSchema,
  cancelSaleSchema,
  createInvoiceFromSaleSchema,
  createRemissionFromSaleSchema,
  saleReturnSchema,
  saleFilterSchema,
} from '../schemas/sales.schema'
import {
  Sale,
  SaleDetail,
  SaleFilterParams,
  SaleStats,
  CreateSaleDTO,
  CancelSaleDTO,
  CreateInvoiceFromSaleDTO,
  CreateRemissionFromSaleDTO,
  SaleReturnDTO,
  SalesUserContext,
  CreateSaleResult,
} from '../types'
import { getAuthenticatedCompany } from '@/lib/supabase/tenant'

const DEFAULT_USER: SalesUserContext = {
  userId: '',
  userName: 'Admin Mauricio',
  userRole: 'Administrador Maestro',
  maxAllowedDiscountPercent: 25,
  permissions: [
    'sales.read',
    'sales.create',
    'sales.update',
    'sales.cancel',
    'sales.discount',
    'sales.return',
    'sales.export',
  ],
}

export class SalesService {
  constructor(private repo: SalesRepository = salesRepository) {}

  /**
   * Helper para verificar permisos RBAC
   */
  private checkPermission(context: SalesUserContext, permission: string): void {
    if (!context.permissions.includes(permission) && !context.permissions.includes('*')) {
      throw new Error(
        `Acceso denegado: El usuario "${context.userName}" no cuenta con el permiso requerido [${permission}].`
      )
    }
  }

  /**
   * Lista ventas con filtros, ordenamiento y paginación
   */
  async list(
    params: SaleFilterParams = {},
    user: SalesUserContext = DEFAULT_USER
  ): Promise<{
    items: Sale[]
    total: number
    page: number
    pageSize: number
    totalPages: number
  }> {
    this.checkPermission(user, 'sales.read')
    const validated = saleFilterSchema.parse(params)
    return this.repo.findFiltered(validated as SaleFilterParams)
  }

  /**
   * Obtiene todas las ventas
   */
  async getAll(user: SalesUserContext = DEFAULT_USER): Promise<Sale[]> {
    this.checkPermission(user, 'sales.read')
    return this.repo.findAll()
  }

  /**
   * Obtiene el detalle relacional completo de una venta
   */
  async getById(id: string, user: SalesUserContext = DEFAULT_USER): Promise<SaleDetail> {
    this.checkPermission(user, 'sales.read')
    const detail = await this.repo.getDetail(id)
    if (!detail) {
      throw new Error(`La venta con ID "${id}" no existe en el sistema.`)
    }
    return detail
  }

  /**
   * Obtiene estadísticas agregadas del módulo Ventas
   */
  async getSalesStats(user: SalesUserContext = DEFAULT_USER): Promise<SaleStats> {
    this.checkPermission(user, 'sales.read')
    return this.repo.getStats()
  }

  /**
   * Registra una venta del módulo Ventas. Todo ocurre en una transacción del servidor
   * (fn_create_sale_with_payments): número, precios, IVA, costo, stock y kardex, pagos, efectivo a la
   * caja del usuario, banco, cartera y asiento contable. Reintentar con la misma idempotencyKey no
   * duplica la venta.
   */
  async create(
    dto: CreateSaleDTO,
    user: SalesUserContext = DEFAULT_USER
  ): Promise<CreateSaleResult> {
    this.checkPermission(user, 'sales.create')

    const comp = await getAuthenticatedCompany()
    if (!comp?.tax_id && !comp?.business_name) {
      throw new Error('Configure la empresa antes de operar.')
    }

    const validated = createSaleSchema.parse(dto)

    // Límite de descuento del usuario (el servidor aplica además el tope general por línea)
    const canOverrideDiscount = user.permissions.includes('sales.discount') || user.permissions.includes('*')
    const overLimit = validated.items.find((it) => (it.discountPercent || 0) > user.maxAllowedDiscountPercent)
    if (overLimit && !canOverrideDiscount) {
      throw new Error(
        `El descuento del ${overLimit.discountPercent}% excede su límite permitido (${user.maxAllowedDiscountPercent}%). Se requiere autorización de supervisor.`
      )
    }

    const result = await this.repo.createWithPayments({
      locationId: validated.locationId,
      customerId: validated.customerId,
      idempotencyKey: validated.idempotencyKey,
      items: validated.items.map((it) => ({
        productId: it.productId,
        quantity: it.quantity,
        discountPercent: it.discountPercent || 0,
      })),
      payments: buildSalePayments(validated),
      notes: validated.notes,
    })

    const sale = await this.repo.findById(result.sale_id)
    if (!sale) {
      throw new Error(`La venta ${result.sale_number} quedó registrada, pero no se pudo cargar. Actualice el listado.`)
    }

    const created: CreateSaleResult = {
      sale,
      idempotentReplay: result.idempotent_replay,
      accountingEntryNumber: result.accounting_entry_number,
      voucherTypeCode: result.voucher_type_code,
    }

    // Documento solicitado (solo en el primer registro: un reintento no emite documentos duplicados)
    const docType = validated.documentTypeToGenerate
    if (!result.idempotent_replay && docType !== 'NINGUNO') {
      try {
        if (docType === 'FACTURA_ELECTRONICA' || docType === 'FACTURA_POS') {
          const { invoiceId, invoiceNumber } = await this.repo.generateInvoice(sale, docType, {
            userId: user.userId,
            userName: user.userName,
          })
          sale.invoiceId = invoiceId
          sale.invoiceNumber = invoiceNumber
        } else if (docType === 'REMISION') {
          const { remissionId, remissionNumber } = await this.repo.generateRemission(
            sale,
            { notes: `Remisión directa de venta ${sale.saleNumber}` },
            { userId: user.userId, userName: user.userName }
          )
          sale.remissionId = remissionId
          sale.remissionNumber = remissionNumber
        }
      } catch (e: unknown) {
        const reason = e instanceof Error ? e.message : String(e)
        created.documentWarning = `No se pudo emitir el documento: ${reason}. Puede emitirlo desde el detalle de la venta.`
      }
    }

    return created
  }

  /**
   * Anula una venta en una sola transacción del servidor (fn_cancel_sale): revierte stock, caja,
   * banco, cartera y asiento, y deja la auditoría. Reintentar sobre una venta ya anulada no repite nada.
   */
  async cancelSale(
    dto: CancelSaleDTO,
    user: SalesUserContext = DEFAULT_USER
  ): Promise<Sale> {
    this.checkPermission(user, 'sales.cancel')
    const validated = cancelSaleSchema.parse(dto)

    const result = await this.repo.cancelSale(validated.saleId, validated.reason.trim())

    const updated = await this.repo.findById(result.sale_id)
    if (!updated) {
      throw new Error(`La venta ${result.sale_number} quedó anulada, pero no se pudo cargar. Actualice el listado.`)
    }
    return updated
  }

  /**
   * Genera factura POS o Electrónica para una venta existente
   */
  async generateInvoiceForSale(
    dto: CreateInvoiceFromSaleDTO,
    user: SalesUserContext = DEFAULT_USER
  ): Promise<Sale> {
    this.checkPermission(user, 'sales.update')
    const validated = createInvoiceFromSaleSchema.parse(dto)

    const sale = await this.repo.findById(validated.saleId)
    if (!sale) {
      throw new Error(`La venta con ID "${validated.saleId}" no existe.`)
    }

    if (sale.invoiceId) {
      throw new Error(`La venta ${sale.saleNumber} ya posee una factura emitida (${sale.invoiceNumber}).`)
    }

    const { invoiceId, invoiceNumber } = await this.repo.generateInvoice(
      sale,
      validated.type,
      { userId: user.userId, userName: user.userName }
    )

    const updated = await this.repo.findById(sale.id)

    await this.repo.logAudit({
      user: user.userName,
      action: 'FACTURACIÓN_VENTA',
      details: `Factura ${invoiceNumber} (${validated.type}) generada para la venta ${sale.saleNumber}.`,
      entityId: sale.id,
      newValues: { invoiceId, invoiceNumber, documentType: validated.type },
    })

    return updated || sale
  }

  /**
   * Genera guía de remisión para una venta existente
   */
  async generateRemissionForSale(
    dto: CreateRemissionFromSaleDTO,
    user: SalesUserContext = DEFAULT_USER
  ): Promise<Sale> {
    this.checkPermission(user, 'sales.update')
    const validated = createRemissionFromSaleSchema.parse(dto)

    const sale = await this.repo.findById(validated.saleId)
    if (!sale) {
      throw new Error(`La venta con ID "${validated.saleId}" no existe.`)
    }

    const { remissionId, remissionNumber } = await this.repo.generateRemission(
      sale,
      validated,
      { userId: user.userId, userName: user.userName }
    )

    const updated = await this.repo.findById(sale.id)

    await this.repo.logAudit({
      user: user.userName,
      action: 'REMISIÓN_VENTA',
      details: `Remisión de despacho ${remissionNumber} generada para la venta ${sale.saleNumber}.`,
      entityId: sale.id,
      newValues: { remissionId, remissionNumber },
    })

    return updated || sale
  }

  /**
   * Procesa devoluciones parciales o totales de mercancía en buen estado con la RPC atómica de
   * Devoluciones (kardex y documento de devolución en una transacción).
   */
  async processReturn(
    dto: SaleReturnDTO,
    user: SalesUserContext = DEFAULT_USER
  ): Promise<Sale> {
    this.checkPermission(user, 'sales.return')
    const validated = saleReturnSchema.parse(dto)

    await this.repo.processCustomerReturn({
      saleId: validated.saleId,
      reason: validated.reason,
      items: validated.items.map((it) => ({
        productId: it.productId,
        quantity: it.quantity,
        reason: it.reason,
      })),
    })

    const updated = await this.repo.findById(validated.saleId)
    if (!updated) {
      throw new Error('La devolución quedó registrada, pero la venta no se pudo cargar. Actualice el listado.')
    }
    return updated
  }
}

export const salesService = new SalesService()

/**
 * Pagos de la venta para el servidor. amount = null → el servidor asigna el saldo exacto del total que
 * calcula (sin diferencias de centavos).
 */
export function buildSalePayments(v: {
  paymentMethod: string
  bankAccountId?: string
  mixedCashAmount?: number
  mixedRestMethod?: 'TARJETA' | 'TRANSFERENCIA'
}): SalePaymentInput[] {
  const bankMethod = (m: 'TARJETA' | 'TRANSFERENCIA'): SalePaymentInput['method'] =>
    m === 'TARJETA' ? 'CREDIT_CARD' : 'BANK_TRANSFER'
  switch (v.paymentMethod) {
    case 'EFECTIVO':
      return [{ method: 'CASH', amount: null }]
    case 'CREDITO':
      return [{ method: 'CREDIT', amount: null }]
    case 'TARJETA':
    case 'TRANSFERENCIA':
      if (!v.bankAccountId) throw new Error('Seleccione la cuenta bancaria que recibe el pago.')
      return [{ method: bankMethod(v.paymentMethod), amount: null, bank_account_id: v.bankAccountId }]
    case 'MIXTO': {
      const cash = Math.round(Number(v.mixedCashAmount || 0) * 100) / 100
      if (cash <= 0) throw new Error('En pago mixto, indique la parte en efectivo (mayor a cero y menor que el total).')
      if (!v.bankAccountId) throw new Error('Seleccione la cuenta bancaria que recibe la parte no pagada en efectivo.')
      return [
        { method: 'CASH', amount: cash },
        { method: bankMethod(v.mixedRestMethod || 'TRANSFERENCIA'), amount: null, bank_account_id: v.bankAccountId },
      ]
    }
    default:
      throw new Error('Medio de pago no soportado.')
  }
}
