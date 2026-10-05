/**
 * SUPER MÁS ERP/POS - Servicio de Negocio de Cotizaciones y Presupuestos (QuoteService)
 *
 * Fachada comercial encargada de:
 * 1. Validación de reglas de negocio y vigencia de ofertas.
 * 2. Emisión y actualización de cotizaciones.
 * 3. Conversión atómica a venta oficial con trazabilidad de inventario y Kardex.
 * 4. Generación de enlaces y plantillas para compartir vía WhatsApp.
 * 5. Registro inmutable en auditService.
 */

import { quoteRepository } from '../repositories/quote.repository'
import { auditService } from '@/features/audit/services/audit.service'
import {
  Quote,
  QuoteStatus,
  CreateQuoteInput,
  QuoteFilterParams,
  QuoteStats,
} from '../types'

export class QuoteService {
  /**
   * Crea una nueva cotización comercial
   */
  async createQuote(
    input: CreateQuoteInput,
    user: { id: string; name: string; role: string; companyId?: string }
  ): Promise<Quote> {
    if (!input.items || input.items.length === 0) {
      throw new Error('La cotización debe incluir al menos un producto.')
    }

    if (!input.customerName || !input.customerName.trim()) {
      throw new Error('El nombre del cliente o empresa es obligatorio.')
    }

    if (!input.validUntil) {
      throw new Error('La fecha límite de vigencia (validUntil) es obligatoria.')
    }

    const payload: CreateQuoteInput = {
      ...input,
      sellerUserId: input.sellerUserId || user.id,
    }

    const created = await quoteRepository.create(payload, user.companyId)

    await auditService.log({
      companyId: user.companyId,
      action: 'OTHER',
      module: 'SALES',
      entityType: 'QUOTE',
      entityId: created.id,
      entityReference: created.quoteNumber,
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      locationId: created.locationId,
      locationName: created.locationName,
      level: 'INFO',
      details: `Cotización comercial ${created.quoteNumber} generada para ${created.customerName} por valor de $${created.totalAmount.toLocaleString('es-CO')} COP.`,
    })

    return created
  }

  /**
   * Consulta cotizaciones con filtros y paginación
   */
  async getQuotes(
    filters: QuoteFilterParams = {},
    user: { id: string; name: string; role: string; companyId?: string }
  ): Promise<{ data: Quote[]; total: number }> {
    return quoteRepository.findFiltered(filters, user.companyId)
  }

  /**
   * Obtiene el detalle de una cotización
   */
  async getQuoteById(
    id: string,
    user: { id: string; name: string; role: string; companyId?: string }
  ): Promise<Quote | null> {
    return quoteRepository.findById(id, user.companyId)
  }

  /**
   * Actualiza el estado de una cotización
   */
  async updateStatus(
    id: string,
    status: QuoteStatus,
    reason?: string,
    user?: { id: string; name: string; role: string; companyId?: string }
  ): Promise<Quote> {
    const updated = await quoteRepository.updateStatus(id, status, reason, user?.companyId)

    if (user) {
      await auditService.log({
        companyId: user.companyId,
        action: 'OTHER',
        module: 'SALES',
        entityType: 'QUOTE',
        entityId: updated.id,
        entityReference: updated.quoteNumber,
        userId: user.id,
        userName: user.name,
        userRole: user.role,
        level: 'INFO',
        details: `Estado de cotización ${updated.quoteNumber} actualizado a ${status}${reason ? `: ${reason}` : ''}.`,
      })
    }

    return updated
  }

  /**
   * Conversión comercial de cotización a venta oficial
   */
  async convertToSale(
    quoteId: string,
    options: {
      locationId?: string
      paymentMethod?: string
      notes?: string
    } = {},
    user: { id: string; name: string; role: string; companyId?: string }
  ): Promise<{ saleId: string; saleNumber: string; quote: Quote }> {
    const result = await quoteRepository.convertToSale(
      quoteId,
      {
        ...options,
        sellerUserId: user.id,
      },
      user.companyId
    )

    await auditService.log({
      companyId: user.companyId,
      action: 'SALE_CREATED',
      module: 'SALES',
      entityType: 'SALE',
      entityId: result.saleId,
      entityReference: result.saleNumber,
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      locationId: options.locationId,
      level: 'INFO',
      details: `Venta oficial ${result.saleNumber} generada a partir de cotización ${result.quote.quoteNumber} por $${result.quote.totalAmount.toLocaleString('es-CO')} COP.`,
    })

    return result
  }

  /**
   * Genera el enlace de WhatsApp con formato proforma para compartir con el cliente
   */
  generateWhatsAppShareUrl(
    quote: Quote,
    companyName: string = 'Super Más S.A.S.'
  ): string {
    const lines = [
      `*COTIZACIÓN COMERCIAL - ${companyName}*`,
      `📄 *Nº:* ${quote.quoteNumber}`,
      `👤 *Cliente:* ${quote.customerName}`,
      `📅 *Fecha de Emisión:* ${quote.issueDate}`,
      `⏳ *Válida Hasta:* ${quote.validUntil}`,
      ``,
      `*DETALLE DE PRODUCTOS:*`,
    ]

    quote.items.forEach((item, index) => {
      lines.push(
        `${index + 1}. *${item.productName}* (${item.quantity} unds x $${item.unitPrice.toLocaleString('es-CO')}) = *$${item.total.toLocaleString('es-CO')}*`
      )
    })

    lines.push(``)
    if (quote.discountAmount > 0) {
      lines.push(`💰 *Descuento:* -$${quote.discountAmount.toLocaleString('es-CO')} COP`)
    }
    if (quote.taxAmount > 0) {
      lines.push(`🏛️ *IVA:* $${quote.taxAmount.toLocaleString('es-CO')} COP`)
    }
    lines.push(`💵 *TOTAL GENERAL:* *$${quote.totalAmount.toLocaleString('es-CO')} COP*`)
    lines.push(``)
    lines.push(`ℹ️ _${quote.termsConditions || 'Precios sujetos a disponibilidad y vigencia de la oferta.'}_`)

    const encodedText = encodeURIComponent(lines.join('\n'))
    const phoneClean = quote.customerPhone ? quote.customerPhone.replace(/\D/g, '') : ''

    if (phoneClean) {
      const fullPhone = phoneClean.startsWith('57') ? phoneClean : `57${phoneClean}`
      return `https://wa.me/${fullPhone}?text=${encodedText}`
    }

    return `https://wa.me/?text=${encodedText}`
  }

  /**
   * Consulta métricas y estadísticas agregadas
   */
  async getStats(
    user: { id: string; name: string; role: string; companyId?: string }
  ): Promise<QuoteStats> {
    return quoteRepository.getStats(user.companyId)
  }
}

export const quoteService = new QuoteService()
