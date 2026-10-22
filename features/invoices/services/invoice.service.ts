import { invoiceRepository, InvoiceRepository } from '../repositories/invoice.repository'
import { invoiceCalculationService, InvoiceCalculationService } from './invoice-calculation.service'
import {
  generateInvoiceSchema,
  cancelInvoiceSchema,
} from '../schemas/invoice.schema'
import {
  Invoice,
  InvoiceFilters,
  InvoiceStats,
  GenerateInvoicePayload,
  CancelInvoicePayload,
  InvoiceUserContext,
  DIANStatus,
  DIANTransmissionLog,
} from '../types'
import { dianApiClient, DianNoteRequest } from './dian-api.client'

const DEFAULT_ADMIN_USER: InvoiceUserContext = {
  userId: '',
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
   * Emite la Factura Electrónica de Venta de una venta existente.
   * Todo el proceso fiscal (consecutivo, XML, CUFE, QR, firma, transmisión) ocurre en el servidor.
   */
  async generateFromSale(
    payload: GenerateInvoicePayload,
    user: InvoiceUserContext = DEFAULT_ADMIN_USER
  ): Promise<Invoice> {
    this.checkPermission(user, 'invoice.create')
    const validated = generateInvoiceSchema.parse(payload)
    if (validated.type !== 'ELECTRONICA') {
      throw new Error('Desde Facturación solo se emite Factura Electrónica de Venta. Los tickets POS se generan en el módulo POS.')
    }
    const result = await dianApiClient.emitFromSale(validated.saleId)
    const invoice = await this.repo.findById(result.invoiceId)
    if (!invoice) throw new Error('La factura fue emitida pero no se pudo consultar. Recargue la lista.')
    return invoice
  }

  /**
   * Genera / firma / transmite (o reintenta) la factura en el servidor y devuelve el estado REAL.
   */
  async sendToDIAN(
    invoiceId: string,
    user: InvoiceUserContext = DEFAULT_ADMIN_USER
  ): Promise<{ invoice: Invoice; success: boolean; message: string; errors: string[] }> {
    this.checkPermission(user, 'invoice.send_dian')
    const res = await dianApiClient.send(invoiceId)
    const invoice = await this.repo.findById(invoiceId)
    if (!invoice) throw new Error(`La factura con ID "${invoiceId}" no existe.`)
    return { invoice, success: res.transmissionState === 'ACCEPTED' || res.transmissionState === 'SENT', message: res.message, errors: res.dianErrors }
  }

  /** Consulta en la DIAN el resultado de un envío asíncrono (TrackId). */
  async checkDianStatus(
    invoiceId: string,
    user: InvoiceUserContext = DEFAULT_ADMIN_USER
  ): Promise<{ invoice: Invoice; message: string; errors: string[] }> {
    this.checkPermission(user, 'invoice.read')
    const res = await dianApiClient.checkStatus(invoiceId)
    const invoice = await this.repo.findById(invoiceId)
    if (!invoice) throw new Error(`La factura con ID "${invoiceId}" no existe.`)
    return { invoice, message: res.message, errors: res.dianErrors }
  }

  /**
   * Emite una Nota Crédito o Débito electrónica (servidor: numeración, validación contra la factura,
   * contabilidad, CUDE, firma y envío a la DIAN).
   */
  async createNote(
    note: DianNoteRequest,
    idempotencyKey: string,
    user: InvoiceUserContext = DEFAULT_ADMIN_USER
  ): Promise<{ invoice: Invoice | null; message: string; documentNumber: string; errors: string[] }> {
    this.checkPermission(user, 'invoice.credit_note')
    const res = await dianApiClient.emitNote(note, idempotencyKey)
    const invoice = await this.repo.findById(res.invoiceId)
    return { invoice, message: res.message, documentNumber: res.documentNumber, errors: res.dianErrors }
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

  /** XML real guardado en el servidor (firmado si ya se firmó). */
  async getInvoiceXml(invoice: Invoice, kind: 'signed' | 'unsigned' | 'response' = 'signed'): Promise<{ xml: string; fileName: string }> {
    return dianApiClient.fetchXml(invoice.id, kind)
  }
}

export const invoiceService = new InvoiceService()
