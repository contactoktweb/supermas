import { invoiceRepository, InvoiceRepository } from '../repositories/invoice.repository'
import { invoiceCalculationService, InvoiceCalculationService } from './invoice-calculation.service'
import {
  generateInvoiceSchema,
  creditNoteSchema,
  cancelInvoiceSchema,
} from '../schemas/invoice.schema'
import {
  Invoice,
  InvoiceFilters,
  InvoiceStats,
  GenerateInvoicePayload,
  CreditNotePayload,
  CancelInvoicePayload,
  InvoiceUserContext,
  DIANStatus,
  DIANTransmissionLog,
} from '../types'
import { db } from '@/lib/supabase'

const DEFAULT_ADMIN_USER: InvoiceUserContext = {
  userId: 'usr-admin-01',
  userName: 'Admin Mauricio',
  userRole: 'Administrador',
  permissions: [
    'invoice.read',
    'invoice.create',
    'invoice.send_dian',
    'invoice.download',
    'invoice.cancel',
    'invoice.credit_note',
    'invoice.export',
  ],
}

export class InvoiceService {
  constructor(
    private repo: InvoiceRepository = invoiceRepository,
    private calc: InvoiceCalculationService = invoiceCalculationService
  ) {}

  /**
   * Helper para verificar permisos RBAC del usuario
   */
  private checkPermission(context: InvoiceUserContext, permission: string): void {
    if (!context.permissions.includes(permission) && !context.permissions.includes('*')) {
      throw new Error(
        `Acceso denegado: El usuario "${context.userName}" no cuenta con el permiso requerido [${permission}].`
      )
    }
  }

  /**
   * Lista facturas con filtros y paginación
   */
  async list(
    filters: InvoiceFilters = {},
    user: InvoiceUserContext = DEFAULT_ADMIN_USER
  ) {
    this.checkPermission(user, 'invoice.read')
    return this.repo.findAll(filters)
  }

  /**
   * Obtiene detalle de factura por ID
   */
  async getById(id: string, user: InvoiceUserContext = DEFAULT_ADMIN_USER): Promise<Invoice> {
    this.checkPermission(user, 'invoice.read')
    const invoice = await this.repo.findById(id)
    if (!invoice) {
      throw new Error(`La factura con ID o número "${id}" no existe.`)
    }
    return invoice
  }

  /**
   * Obtiene estadísticas consolidadas de facturación
   */
  async getInvoiceStats(user: InvoiceUserContext = DEFAULT_ADMIN_USER): Promise<InvoiceStats> {
    this.checkPermission(user, 'invoice.read')
    return this.repo.getStats()
  }

  /**
   * Obtiene ventas pendientes de facturar
   */
  async getSalesPendingInvoicing(user: InvoiceUserContext = DEFAULT_ADMIN_USER) {
    this.checkPermission(user, 'invoice.read')
    return this.repo.getSalesPendingInvoicing()
  }

  /**
   * Genera una factura formal a partir de una venta comercial existente
   */
  async generateFromSale(
    payload: GenerateInvoicePayload,
    user: InvoiceUserContext = DEFAULT_ADMIN_USER
  ): Promise<Invoice> {
    this.checkPermission(user, 'invoice.create')
    const validated = generateInvoiceSchema.parse(payload)

    // 1. Obtener la venta
    const sales = (db.sales as unknown as Array<any>) || []
    const sale = sales.find((s) => s.id === validated.saleId || s.saleNumber === validated.saleId)
    if (!sale) {
      throw new Error(`No se encontró la venta con ID "${validated.saleId}".`)
    }

    // 2. Validar que no tenga factura previa
    const existingInvoice = await this.repo.findBySaleId(sale.id)
    if (existingInvoice && existingInvoice.status !== 'CANCELLED') {
      throw new Error(
        `La venta ${sale.saleNumber} ya cuenta con la factura ${existingInvoice.invoiceNumber} emitida.`
      )
    }

    // 3. Validar datos mínimos del cliente
    if (!sale.customerName || !sale.customerDoc) {
      throw new Error('La venta no tiene información fiscal válida del cliente.')
    }

    // 4. Calcular impuestos y totales
    const rawItems = (sale.items || []).map((item: any) => ({
      unitPrice: item.unitPrice,
      quantity: item.quantity,
      discountPercent: item.discountPercent || 0,
      discountAmount: item.discountAmount || 0,
      taxRatePercent: item.taxRatePercent !== undefined ? item.taxRatePercent : 19,
      taxCode: item.taxRatePercent === 0 ? 'EXENTO' : 'IVA_19',
    }))

    const totals = this.calc.calculateInvoiceTotals(rawItems)

    // 1. Numeración Interna ERP (Identificación administrativa interna)
    const allInvoices = (await this.repo.findAll({ pageSize: 1000 })).data
    const internalSeq = allInvoices.length + 1
    const internalNumber = `FAC-${String(internalSeq).padStart(5, '0')}`

    // 2. Configuración y Rango Autorizado Oficial DIAN
    const dianResolutions = (db.dianResolutions as any[]) || []
    const matchingRes = dianResolutions.find(
      (r) => r.documentType === validated.type && r.isActive
    ) || {
      dianPrefix: validated.type === 'POS' ? 'POS' : 'FE',
      resolutionNumber: '18764000001',
      resolutionDate: '2026-01-15',
      validFrom: '2026-01-15',
      validTo: '2027-01-15',
      initialRange: 1000,
      finalRange: 50000,
      currentNumber: 1250 + internalSeq,
    }

    const dianPrefix = matchingRes.dianPrefix
    const dianNumber = matchingRes.currentNumber ? matchingRes.currentNumber + 1 : 1250 + internalSeq
    matchingRes.currentNumber = dianNumber
    const dianResolution = matchingRes.resolutionNumber
    const dianRange = `${matchingRes.initialRange} - ${matchingRes.finalRange}`
    const invoiceNumber = `${dianPrefix}-${dianNumber}`
    const dateIso = new Date().toISOString()
    const cufe = this.calc.generateCUFE(invoiceNumber, totals.total, dateIso, sale.customerDoc)

    const mappedItems = (sale.items || []).map((item: any, idx: number) => {
      const taxRate = item.taxRatePercent !== undefined ? item.taxRatePercent : 19
      const gross = item.quantity * item.unitPrice
      const disc = item.discountAmount || 0
      const net = gross - disc
      const taxAmount = Math.round(net * (taxRate / 100))
      return {
        id: `inv-item-${Date.now()}-${idx}`,
        productId: item.productId,
        productName: item.productName,
        sku: item.sku,
        barcode: item.barcode,
        unitOfMeasure: item.unitOfMeasure || 'UND',
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        unitCost: item.unitCost,
        discountPercent: item.discountPercent || 0,
        discountAmount: disc,
        taxCode: taxRate === 0 ? 'EXENTO' : 'IVA_19',
        taxRatePercent: taxRate,
        taxAmount,
        subtotal: net,
        total: net + taxAmount,
        notes: item.notes,
      }
    })

    const initialDianStatus: DIANStatus =
      validated.type === 'ELECTRONICA'
        ? validated.sendToDianImmediately
          ? 'ACEPTADA'
          : 'PENDIENTE'
        : 'NO_APLICA'

    const initialLog: DIANTransmissionLog = {
      id: `log-${Date.now()}`,
      timestamp: dateIso,
      user: user.userName,
      action: 'ENVIO_INICIAL',
      status: initialDianStatus === 'ACEPTADA' ? 'EXITOSO' : 'EXITOSO',
      dianStatus: initialDianStatus,
      message:
        initialDianStatus === 'ACEPTADA'
          ? 'Factura electrónica transmitida y validada por la DIAN (Regla DIAN-V2.1).'
          : 'Factura creada en cola de transmisión electrónica.',
      cufe,
    }

    const newInvoice: Invoice = {
      id: `inv-${Date.now().toString().slice(-6)}`,
      internalNumber,
      dianPrefix,
      dianNumber,
      dianResolution,
      dianResolutionDate: matchingRes.resolutionDate,
      dianRange,
      invoiceNumber,
      prefix: dianPrefix,
      resolutionNumber: dianResolution,
      resolutionDate: matchingRes.resolutionDate,
      type: validated.type,
      status: sale.status === 'COMPLETED' ? 'PAID' : 'PAYMENT_PENDING',
      dianStatus: initialDianStatus,
      dianCufe: cufe,
      dianQrCode: `https://catalogo-vpfe.dian.gov.co/document/searchqr?documentkey=${cufe}`,
      dianXmlUrl: `/api/invoices/${invoiceNumber}/xml`,
      dianPdfUrl: `/api/invoices/${invoiceNumber}/pdf`,

      saleId: sale.id,
      saleNumber: sale.saleNumber,

      customerId: sale.customerId,
      customerName: sale.customerName,
      customerDoc: sale.customerDoc,
      customerDocType: sale.customerDocType || 'NIT',
      customerEmail: sale.customerEmail || 'facturacion@supermas.com.co',
      customerPhone: sale.customerPhone || '+57 300 123 4567',
      customerAddress: sale.customerAddress || 'Cra 15 # 45-20',
      customerCity: sale.customerCity || 'Bogotá, D.C.',

      locationId: sale.locationId,
      locationName: sale.locationName,

      sellerId: sale.sellerId || user.userId,
      sellerName: sale.sellerName || user.userName,

      date: dateIso,
      dueDate: validated.dueDate || sale.dueDate || dateIso,
      issuedAtBogota: new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }),

      items: mappedItems,
      itemsCount: mappedItems.length,
      totalUnits: totals.totalUnits,

      subtotal: totals.subtotal,
      discountTotal: totals.discountTotal,
      taxTotal: totals.taxTotal,
      taxesBreakdown: totals.taxesBreakdown,
      total: totals.total,
      pendingBalance: sale.pendingBalance !== undefined ? sale.pendingBalance : 0,

      paymentMethod: validated.paymentMethod || sale.paymentMethod || 'EFECTIVO',
      paymentTerms: validated.paymentTerms || (sale.paymentMethod === 'CREDITO' ? 'Crédito 30 días' : 'Contado'),
      notes: validated.notes || `Factura generada desde venta ${sale.saleNumber}`,

      transmissionHistory: [initialLog],
      createdAt: dateIso,
      updatedAt: dateIso,
    }

    return this.repo.create(newInvoice, user.userName)
  }

  /**
   * Transmite o reintenta el envío de la factura ante la DIAN
   */
  async sendToDIAN(
    invoiceId: string,
    user: InvoiceUserContext = DEFAULT_ADMIN_USER
  ): Promise<{ invoice: Invoice; success: boolean; message: string }> {
    this.checkPermission(user, 'invoice.send_dian')
    const invoice = await this.repo.findById(invoiceId)
    if (!invoice) {
      throw new Error(`La factura con ID "${invoiceId}" no existe.`)
    }

    if (invoice.status === 'CANCELLED') {
      throw new Error('No se puede transmitir una factura anulada a la DIAN.')
    }

    // Simulación de validación DIAN
    const dateIso = new Date().toISOString()
    const cufe = invoice.dianCufe || this.calc.generateCUFE(invoice.invoiceNumber, invoice.total, dateIso, invoice.customerDoc)

    const log: DIANTransmissionLog = {
      id: `log-${Date.now()}`,
      timestamp: dateIso,
      user: user.userName,
      action: invoice.transmissionHistory.length > 0 ? 'REINTENTO' : 'ENVIO_INICIAL',
      status: 'EXITOSO',
      dianStatus: 'ACEPTADA',
      statusCode: '200',
      message: 'Documento electrónico procesado y aceptado por la DIAN con firma digital verificada.',
      cufe,
      responseTimeMs: Math.floor(180 + Math.random() * 220),
    }

    const updated = await this.repo.recordDIANAttempt(invoice.id, log, 'ACEPTADA', cufe)

    return {
      invoice: updated,
      success: true,
      message: 'Factura validada y aceptada exitosamente por la DIAN.',
    }
  }

  /**
   * Crea una Nota Crédito (parcial o total) para una factura emitida
   */
  async createCreditNote(
    payload: CreditNotePayload,
    user: InvoiceUserContext = DEFAULT_ADMIN_USER
  ): Promise<Invoice> {
    this.checkPermission(user, 'invoice.credit_note')
    const validated = creditNoteSchema.parse(payload)

    const originalInvoice = await this.repo.findById(validated.invoiceId)
    if (!originalInvoice) {
      throw new Error(`La factura original con ID "${validated.invoiceId}" no fue encontrada.`)
    }

    if (originalInvoice.status === 'CANCELLED') {
      throw new Error('No se puede emitir una Nota Crédito sobre una factura anulada.')
    }

    // Calcular montos de la nota crédito
    const rawItems = validated.items.map((i) => ({
      unitPrice: i.unitPrice,
      quantity: i.quantity,
      discountPercent: 0,
      discountAmount: 0,
      taxRatePercent: i.taxRatePercent || 19,
      taxCode: i.taxRatePercent === 0 ? 'EXENTO' : 'IVA_19',
    }))

    const totals = this.calc.calculateInvoiceTotals(rawItems)
    const dateIso = new Date().toISOString()
    const nextNum = Math.floor(100 + Math.random() * 900)
    const ncNumber = `NC-${new Date().getFullYear()}-${nextNum}`
    const cufe = this.calc.generateCUFE(ncNumber, totals.total, dateIso, originalInvoice.customerDoc)

    const mappedItems = validated.items.map((item, idx) => {
      const origItem = originalInvoice.items.find((oi) => oi.productId === item.productId)
      const taxRate = item.taxRatePercent || 19
      const gross = item.quantity * item.unitPrice
      const taxAmount = Math.round(gross * (taxRate / 100))
      return {
        id: `nc-item-${Date.now()}-${idx}`,
        productId: item.productId,
        productName: origItem?.productName || 'Producto Devuelto / Ajustado',
        sku: origItem?.sku || 'SKU-NC',
        barcode: origItem?.barcode || '',
        unitOfMeasure: origItem?.unitOfMeasure || 'UND',
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        unitCost: origItem?.unitCost,
        discountPercent: 0,
        discountAmount: 0,
        taxCode: taxRate === 0 ? 'EXENTO' : 'IVA_19',
        taxRatePercent: taxRate,
        taxAmount,
        subtotal: gross,
        total: gross + taxAmount,
        notes: validated.notes,
      }
    })

    const creditNote: Invoice = {
      id: `nc-${Date.now().toString().slice(-6)}`,
      invoiceNumber: ncNumber,
      internalNumber: `NC-${nextNum.toString().padStart(6, '0')}`,
      dianPrefix: 'NC',
      dianNumber: nextNum,
      dianResolution: '18764000003',
      dianRange: '1 - 5000',
      prefix: 'NC',
      resolutionNumber: '18764000003',
      resolutionDate: '2026-01-01',
      type: 'NOTA_CREDITO',
      status: 'ISSUED',
      dianStatus: validated.sendToDianImmediately ? 'ACEPTADA' : 'PENDIENTE',
      dianCufe: cufe,
      dianQrCode: `https://catalogo-vpfe.dian.gov.co/document/searchqr?documentkey=${cufe}`,
      dianXmlUrl: `/api/invoices/${ncNumber}/xml`,
      dianPdfUrl: `/api/invoices/${ncNumber}/pdf`,

      saleId: originalInvoice.saleId,
      saleNumber: originalInvoice.saleNumber,
      originalInvoiceId: originalInvoice.id,
      originalInvoiceNumber: originalInvoice.invoiceNumber,

      customerId: originalInvoice.customerId,
      customerName: originalInvoice.customerName,
      customerDoc: originalInvoice.customerDoc,
      customerDocType: originalInvoice.customerDocType,
      customerEmail: originalInvoice.customerEmail,
      customerPhone: originalInvoice.customerPhone,
      customerAddress: originalInvoice.customerAddress,
      customerCity: originalInvoice.customerCity,

      locationId: originalInvoice.locationId,
      locationName: originalInvoice.locationName,

      sellerId: user.userId,
      sellerName: user.userName,

      date: dateIso,
      dueDate: dateIso,
      issuedAtBogota: new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }),

      items: mappedItems,
      itemsCount: mappedItems.length,
      totalUnits: totals.totalUnits,

      subtotal: totals.subtotal,
      discountTotal: 0,
      taxTotal: totals.taxTotal,
      taxesBreakdown: totals.taxesBreakdown,
      total: totals.total,
      pendingBalance: 0,

      paymentMethod: originalInvoice.paymentMethod,
      notes: `Nota Crédito por motivo: ${validated.reason}. Detalle: ${validated.notes}`,

      transmissionHistory: [
        {
          id: `log-nc-${Date.now()}`,
          timestamp: dateIso,
          user: user.userName,
          action: 'ENVIO_INICIAL',
          status: 'EXITOSO',
          dianStatus: validated.sendToDianImmediately ? 'ACEPTADA' : 'PENDIENTE',
          message: 'Nota Crédito electrónica transmitida y validada por la DIAN.',
          cufe,
        },
      ],
      createdAt: dateIso,
      updatedAt: dateIso,
    }

    return this.repo.createCreditNote(
      creditNote,
      originalInvoice.id,
      validated.adjustInventory,
      user.userName
    )
  }

  /**
   * Anula una factura con registro de auditoría
   */
  async cancelInvoice(
    payload: CancelInvoicePayload,
    user: InvoiceUserContext = DEFAULT_ADMIN_USER
  ): Promise<Invoice> {
    this.checkPermission(user, 'invoice.cancel')
    const validated = cancelInvoiceSchema.parse(payload)

    return this.repo.cancelInvoice(validated.invoiceId, validated.reason, user.userName)
  }

  /**
   * Genera el XML UBL 2.1 estándar de la factura
   */
  getInvoiceXml(invoice: Invoice): string {
    return this.calc.generateDIANXml(
      invoice.invoiceNumber,
      invoice.customerName,
      invoice.customerDoc,
      invoice.total,
      invoice.dianCufe || 'CUFE-PENDIENTE'
    )
  }
}

export const invoiceService = new InvoiceService()
