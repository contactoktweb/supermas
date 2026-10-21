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
import { supabaseClient } from '@/lib/supabase/client'
import { getAuthenticatedCompany, resolveUserCompanyId } from '@/lib/supabase/tenant'

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
   * Anula una venta existente y revierte los movimientos de inventario en Kardex
   */
  async cancelSale(
    dto: CancelSaleDTO,
    user: SalesUserContext = DEFAULT_USER
  ): Promise<Sale> {
    this.checkPermission(user, 'sales.cancel')
    const validated = cancelSaleSchema.parse(dto)

    const sale = await this.repo.findById(validated.saleId)
    if (!sale) {
      throw new Error(`La venta con ID "${validated.saleId}" no existe.`)
    }

    if (sale.status === 'CANCELLED') {
      throw new Error(`La venta ${sale.saleNumber} ya se encuentra anulada.`)
    }

    // 1. Revertir inventario en Kardex
    await this.repo.reverseInventoryMovements(sale, validated.reason, {
      userId: user.userId,
      userName: user.userName,
    })

    // 2. Revertir saldo deudor del cliente si la venta fue a crédito
    if (sale.paymentMethod === 'CREDITO' && sale.customerId) {
      const { data: custRow } = await supabaseClient
        .from('customers')
        .select('current_balance')
        .eq('id', sale.customerId)
        .maybeSingle()
      if (custRow) {
        const newBal = Math.max(0, Number(custRow.current_balance || 0) - sale.totalAmount)
        await supabaseClient
          .from('customers')
          .update({ current_balance: newBal, updated_at: new Date().toISOString() })
          .eq('id', sale.customerId)
      }
    }

    // 3. Actualizar estado de la venta
    const updated = await this.repo.update(sale.id, {
      status: 'CANCELLED',
      cancellationReason: validated.reason,
      cancelledAt: new Date().toISOString(),
      cancelledBy: user.userName,
    })

    if (!updated) {
      throw new Error(`Error al anular la venta "${sale.saleNumber}".`)
    }

    // 4. Registrar en auditoría
    await this.repo.logAudit({
      user: user.userName,
      action: 'ANULACIÓN_VENTA',
      details: `Venta ${sale.saleNumber} anulada. Motivo: ${validated.reason}. Stock de ${sale.totalUnits} unidades revertido en Kardex.`,
      entityId: sale.id,
      oldValues: { status: sale.status },
      newValues: { status: 'CANCELLED', reason: validated.reason, cancelledBy: user.userName },
    })

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
   * Procesa devoluciones parciales o totales de mercancía
   */
  async processReturn(
    dto: SaleReturnDTO,
    user: SalesUserContext = DEFAULT_USER
  ): Promise<Sale> {
    this.checkPermission(user, 'sales.return')
    const validated = saleReturnSchema.parse(dto)

    const sale = await this.repo.findById(validated.saleId)
    if (!sale) {
      throw new Error(`La venta con ID "${validated.saleId}" no existe.`)
    }

    for (const returnItem of validated.items) {
      const saleLine = sale.items.find((i) => i.productId === returnItem.productId)
      if (!saleLine) {
        throw new Error(`El producto no pertenece a la venta original ${sale.saleNumber}.`)
      }
      if (returnItem.quantity > saleLine.quantity) {
        throw new Error(`La cantidad a devolver (${returnItem.quantity}) no puede superar la cantidad vendida (${saleLine.quantity}).`)
      }

      // Revertir inventario registrando movimiento CUSTOMER_RETURN en public.inventory_movements
      // El trigger process_inventory_movement() de PostgreSQL actualiza automáticamente public.stock_levels
      const { data: stockRow } = await supabaseClient
        .from('stock_levels')
        .select('quantity, average_cost')
        .eq('product_id', returnItem.productId)
        .eq('location_id', sale.locationId)
        .maybeSingle()

      const previousStock = stockRow ? Number(stockRow.quantity || 0) : 0
      const resultingStock = previousStock + returnItem.quantity
      const unitCost = stockRow ? Number(stockRow.average_cost || 0) : Number(saleLine.unitCost || 0)

      const companyId = await resolveUserCompanyId(supabaseClient)

      const { error: movErr } = await supabaseClient
        .from('inventory_movements')
        .insert({
          company_id: companyId,
          product_id: returnItem.productId,
          location_id: sale.locationId,
          movement_type: 'CUSTOMER_RETURN',
          quantity_in: returnItem.quantity,
          quantity_out: 0,
          previous_stock: previousStock,
          new_stock: resultingStock,
          unit_cost: unitCost,
          total_cost: returnItem.quantity * unitCost,
          document_type: 'SALE_RETURN',
          document_reference: sale.saleNumber,
          reason: `Devolución de venta ${sale.saleNumber}: ${returnItem.reason || validated.reason}`,
          user_id: user.userId || null,
        })

      if (movErr) {
        console.error('Error insertando movimiento de devolución:', movErr)
        throw new Error(`Error al registrar devolución en Kardex: ${movErr.message}`)
      }
    }

    // 2. Si fue venta a crédito, deducir el importe de los ítems devueltos del saldo del cliente
    let totalReturnedMoney = 0
    for (const returnItem of validated.items) {
      const saleLine = sale.items.find((i) => i.productId === returnItem.productId)
      if (saleLine) {
        const itemUnitPrice = saleLine.quantity > 0 ? (saleLine.total / saleLine.quantity) : saleLine.unitPrice
        totalReturnedMoney += Math.round(itemUnitPrice * returnItem.quantity)
      }
    }

    if (sale.paymentMethod === 'CREDITO' && sale.customerId && totalReturnedMoney > 0) {
      const { data: custRow } = await supabaseClient
        .from('customers')
        .select('current_balance')
        .eq('id', sale.customerId)
        .maybeSingle()
      if (custRow) {
        const newBal = Math.max(0, Number(custRow.current_balance || 0) - totalReturnedMoney)
        await supabaseClient
          .from('customers')
          .update({ current_balance: newBal, updated_at: new Date().toISOString() })
          .eq('id', sale.customerId)
      }
    }

    // 3. Determinar si es devolución total o parcial
    const totalOriginalQty = sale.items.reduce((acc, it) => acc + it.quantity, 0)
    const totalReturnedQty = validated.items.reduce((acc, it) => acc + it.quantity, 0)
    const isFullReturn = totalReturnedQty >= totalOriginalQty

    const newStatus = isFullReturn ? 'RETURNED' : sale.status

    const updated = await this.repo.update(sale.id, {
      status: newStatus,
      notes: sale.notes
        ? `${sale.notes} | Devolución procesada (${totalReturnedQty} uds): ${validated.reason}`
        : `Devolución procesada (${totalReturnedQty} uds): ${validated.reason}`,
    })

    await this.repo.logAudit({
      user: user.userName,
      action: 'DEVOLUCIÓN_VENTA',
      details: `Devolución de productos procesada para la venta ${sale.saleNumber}. Motivo: ${validated.reason}.`,
      entityId: sale.id,
      newValues: { status: 'RETURNED', returnDetails: validated },
    })

    return updated || sale
  }
}

export const salesService = new SalesService()

/**
 * Pagos de la venta para el servidor. amount = null → el servidor asigna el saldo exacto del total que
 * calcula (sin diferencias de centavos).
 */
function buildSalePayments(v: {
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
