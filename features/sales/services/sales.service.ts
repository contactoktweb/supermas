import { salesRepository, SalesRepository } from '../repositories/sales.repository'
import { salesCalculationService } from './sales-calculation.service'
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
  SaleItem,
} from '../types'
import { supabaseClient } from '@/lib/supabase/client'

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
   * Crea y procesa una nueva venta con validación de inventario, precios y Kardex
   */
  async create(
    dto: CreateSaleDTO,
    user: SalesUserContext = DEFAULT_USER
  ): Promise<Sale> {
    this.checkPermission(user, 'sales.create')

    // 0. Validar existencia de empresa configurada
    const { data: comp } = await supabaseClient
      .from('companies')
      .select('id, business_name, nit')
      .limit(1)
      .maybeSingle()

    if (!comp?.nit && !comp?.business_name) {
      throw new Error('Configure la empresa antes de operar.')
    }

    // 1. Validación de esquema con Zod
    const validated = createSaleSchema.parse(dto)

    // 2. Obtener cliente y validar existencia
    const { data: rawCustomer } = await supabaseClient
      .from('customers')
      .select('id, first_name, last_name, company_name, document_number, is_active, credit_limit, current_balance, credit_days')
      .eq('id', validated.customerId)
      .maybeSingle()

    if (!rawCustomer) {
      throw new Error(`El cliente seleccionado con ID "${validated.customerId}" no existe.`)
    }
    if (!rawCustomer.is_active) {
      const displayName = rawCustomer.company_name || `${rawCustomer.first_name || ''} ${rawCustomer.last_name || ''}`.trim()
      throw new Error(`El cliente "${displayName}" se encuentra inactivo. Active el cliente para registrar ventas.`)
    }

    const customer = {
      id: rawCustomer.id,
      displayName: rawCustomer.company_name || `${rawCustomer.first_name || ''} ${rawCustomer.last_name || ''}`.trim() || 'Cliente',
      documentNumber: rawCustomer.document_number,
      customerType: 'NATURAL' as const,
      category: 'GENERAL',
      priceList: 'DEFAULT' as const,
      creditLimit: Number(rawCustomer.credit_limit || 0),
      currentBalance: Number(rawCustomer.current_balance || 0),
      status: rawCustomer.is_active ? 'ACTIVE' : 'INACTIVE',
    }

    // 3. Obtener bodega y validar existencia
    const { data: rawLocation } = await supabaseClient
      .from('locations')
      .select('id, name, code, type, status')
      .eq('id', validated.locationId)
      .maybeSingle()

    if (!rawLocation) {
      throw new Error(`La bodega o punto de venta con ID "${validated.locationId}" no existe.`)
    }

    const location = {
      id: rawLocation.id,
      name: rawLocation.name,
      code: rawLocation.code,
      type: rawLocation.type,
      status: rawLocation.status,
    }

    // 4. Obtener productos y stock disponible
    const productIds = validated.items.map((i) => i.productId)
    const { data: rawProducts } = await supabaseClient
      .from('products')
      .select('id, name, sku, barcode, cost_price, public_sale_price, wholesale_price, tax_rate_percent, is_tax_exempt, is_active')
      .in('id', productIds)

    const allProducts = (rawProducts || []).map((p) => ({
      id: p.id,
      name: p.name,
      sku: p.sku,
      barcode: p.barcode,
      costPrice: Number(p.cost_price || 0),
      normalPrice: Number(p.public_sale_price || 0),
      wholesalePrice: p.wholesale_price ? Number(p.wholesale_price) : undefined,
      vatRatePercent: p.is_tax_exempt ? 0 : Number(p.tax_rate_percent || 19),
      isExempt: Boolean(p.is_tax_exempt),
      status: p.is_active ? 'ACTIVE' : 'INACTIVE',
    }))

    const { data: rawStock } = await supabaseClient
      .from('stock_levels')
      .select('product_id, location_id, quantity, reserved_quantity')
      .eq('location_id', validated.locationId)
      .in('product_id', productIds)

    const allStock = (rawStock || []).map((s) => ({
      productId: s.product_id,
      locationId: s.location_id,
      availableUnits: Math.max(0, Number(s.quantity || 0) - Number(s.reserved_quantity || 0)),
      quantity: Number(s.quantity || 0),
    }))

    const calculatedItems: SaleItem[] = []

    for (const rawItem of validated.items) {
      const product = allProducts.find((p) => p.id === rawItem.productId)
      if (!product) {
        throw new Error(`El producto con ID "${rawItem.productId}" no existe en el catálogo.`)
      }
      if (product.status !== 'ACTIVE') {
        throw new Error(`El producto "${product.name}" no está activo para venta.`)
      }

      // Validar stock disponible en la bodega
      const stockLevel = allStock.find(
        (s) => s.productId === rawItem.productId && s.locationId === validated.locationId
      )
      const availableUnits = stockLevel ? stockLevel.availableUnits : 0

      if (availableUnits < rawItem.quantity) {
        throw new Error(
          `Existencia insuficiente para el producto "${product.name}" en la bodega "${location.name}". Disponible: ${availableUnits} unidades, Solicitado: ${rawItem.quantity} unidades.`
        )
      }

      // Validar límites de descuento
      const requestedDiscount = rawItem.discountPercent || 0
      if (requestedDiscount > user.maxAllowedDiscountPercent) {
        if (!user.permissions.includes('sales.discount') && !user.permissions.includes('*')) {
          throw new Error(
            `El descuento del ${requestedDiscount}% aplicado a "${product.name}" excede su límite permitido (${user.maxAllowedDiscountPercent}%). Se requiere autorización de supervisor.`
          )
        }
      }

      // Calcular línea de venta en el servidor
      const calculatedLine = salesCalculationService.calculateLineItem(
        product,
        rawItem,
        customer.priceList
      )
      calculatedItems.push(calculatedLine)
    }

    // 5. Calcular totales consolidados
    const totals = salesCalculationService.calculateSaleTotals(calculatedItems)

    // 6. Validar cupo de crédito si el método de pago es CREDITO
    let saleDueDate = new Date().toISOString().split('T')[0]
    if (validated.paymentMethod === 'CREDITO') {
      const formatMoney = (n: number) =>
        new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n)

      if (customer.creditLimit <= 0) {
        throw new Error(
          `El cliente "${customer.displayName}" no tiene cupo de crédito aprobado (Cupo: $0). Configure el límite de crédito en la ficha del cliente.`
        )
      }

      const newTotalDebt = customer.currentBalance + totals.totalAmount
      if (newTotalDebt > customer.creditLimit) {
        const available = Math.max(0, customer.creditLimit - customer.currentBalance)
        throw new Error(
          `La venta excede el cupo de crédito aprobado para "${customer.displayName}". Cupo: ${formatMoney(customer.creditLimit)}, Saldo actual: ${formatMoney(customer.currentBalance)}, Crédito disponible: ${formatMoney(available)}, Total venta: ${formatMoney(totals.totalAmount)}.`
        )
      }

      const creditDays = Math.max(1, Number(rawCustomer.credit_days || 30))
      const due = new Date()
      due.setDate(due.getDate() + creditDays)
      saleDueDate = due.toISOString().split('T')[0]
    }

    // 7. Generar código y objeto de venta
    const saleCodeNumber = Math.floor(1000 + Math.random() * 9000)
    const saleNumber = `VTA-${new Date().getFullYear()}-${saleCodeNumber}`
    const saleId = `sale-${Date.now().toString().slice(-6)}`

    const newSale: Sale = {
      id: saleId,
      saleNumber,
      customerId: customer.id,
      customerName: customer.displayName,
      customerDoc: customer.documentNumber,
      customerType: customer.customerType,
      customerCategory: customer.category,
      priceList: customer.priceList,
      locationId: location.id,
      locationName: location.name,
      sellerId: user.userId,
      sellerName: user.userName,
      date: new Date().toISOString(),
      items: calculatedItems,
      ...totals,
      paymentMethod: validated.paymentMethod,
      paymentStatus: validated.paymentMethod === 'CREDITO' ? 'PENDING' : 'PAID',
      paidAmount: validated.paymentMethod === 'CREDITO' ? 0 : totals.totalAmount,
      dueDate: saleDueDate,
      paymentTerms: validated.paymentMethod === 'CREDITO' ? 'CREDITO' : 'CONTADO',
      status: validated.documentTypeToGenerate === 'FACTURA_POS' || validated.documentTypeToGenerate === 'FACTURA_ELECTRONICA'
        ? 'INVOICED'
        : 'CONFIRMED',
      documentType: validated.documentTypeToGenerate || 'FACTURA_POS',
      notes: validated.notes,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    // 8. Guardar venta en base de datos
    const createdSale = await this.repo.create(newSale)

    // 9. Registrar movimientos de salida de inventario (SALE_OUT) para Kardex
    await this.repo.createInventoryMovements(createdSale, {
      userId: user.userId,
      userName: user.userName,
    })

    // 10. Si solicitó factura electrónica o POS inmediata
    if (
      validated.documentTypeToGenerate === 'FACTURA_ELECTRONICA' ||
      validated.documentTypeToGenerate === 'FACTURA_POS'
    ) {
      const { invoiceId, invoiceNumber } = await this.repo.generateInvoice(
        createdSale,
        validated.documentTypeToGenerate,
        { userId: user.userId, userName: user.userName }
      )
      createdSale.invoiceId = invoiceId
      createdSale.invoiceNumber = invoiceNumber
    } else if (validated.documentTypeToGenerate === 'REMISION') {
      const { remissionId, remissionNumber } = await this.repo.generateRemission(
        createdSale,
        { notes: `Remisión directa de venta ${createdSale.saleNumber}` },
        { userId: user.userId, userName: user.userName }
      )
      createdSale.remissionId = remissionId
      createdSale.remissionNumber = remissionNumber
    }

    // 11. Auditoría
    const formattedTotal = new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0,
    }).format(createdSale.totalAmount)

    await this.repo.logAudit({
      user: user.userName,
      action: 'CREACIÓN_VENTA',
      details: `Venta ${createdSale.saleNumber} registrada exitosamente por ${formattedTotal} para el cliente "${createdSale.customerName}". Bodega: "${createdSale.locationName}". Documento: ${createdSale.documentType}.`,
      entityId: createdSale.id,
      newValues: { ...createdSale },
    })

    return createdSale
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

    // 2. Actualizar estado de la venta
    const updated = await this.repo.update(sale.id, {
      status: 'CANCELLED',
      cancellationReason: validated.reason,
      cancelledAt: new Date().toISOString(),
      cancelledBy: user.userName,
    })

    if (!updated) {
      throw new Error(`Error al anular la venta "${sale.saleNumber}".`)
    }

    // 3. Registrar en auditoría
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

      const { data: authUser } = await supabaseClient.auth.getUser()
      const { data: comp } = await supabaseClient
        .from('companies')
        .select('id')
        .limit(1)
        .maybeSingle()

      const { error: movErr } = await supabaseClient
        .from('inventory_movements')
        .insert({
          company_id: comp?.id,
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
          user_id: authUser?.user?.id || null,
        })

      if (movErr) {
        console.error('Error insertando movimiento de devolución:', movErr)
        throw new Error(`Error al registrar devolución en Kardex: ${movErr.message}`)
      }
    }

    const updated = await this.repo.update(sale.id, {
      status: 'RETURNED',
      notes: sale.notes
        ? `${sale.notes} | Devolución procesada: ${validated.reason}`
        : `Devolución procesada: ${validated.reason}`,
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
