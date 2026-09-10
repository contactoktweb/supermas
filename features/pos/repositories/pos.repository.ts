import { db, supabaseMock } from '@/lib/supabase'
import {
  POSProduct,
  POSCustomer,
  POSDailySaleSummary,
  POSTicketReceipt,
} from '../types'

export class POSRepository {
  /**
   * Obtiene productos seguros para POS (sin costos ni proveedores) filtrados por bodega
   */
  async getProductsForLocation(
    locationId: string,
    query?: string,
    category?: string
  ): Promise<POSProduct[]> {
    const { data: rawProducts } = await supabaseMock.from('products').select()
    const allProducts = (rawProducts as unknown as Array<any>) || []

    const { data: rawStock } = await supabaseMock.from('stock_levels').select()
    const allStock = (rawStock as unknown as Array<{
      productId: string
      locationId: string
      availableUnits: number
      quantity: number
    }>) || []

    const q = query ? query.toLowerCase().trim() : ''

    const filtered = allProducts
      .filter((p) => {
        if (p.status !== 'ACTIVE') return false
        if (category && category !== 'ALL' && p.category !== category) return false

        if (q) {
          const matchName = p.name.toLowerCase().includes(q)
          const matchSku = p.sku.toLowerCase().includes(q)
          const matchBarcode = p.barcode ? p.barcode.toLowerCase().includes(q) : false
          if (!matchName && !matchSku && !matchBarcode) return false
        }
        return true
      })
      .map((p) => {
        const stockEntry = allStock.find(
          (s) => s.productId === p.id && s.locationId === locationId
        )
        const availableStock = stockEntry ? stockEntry.availableUnits : (p.availableUnits || 0)

        // Sanitize: No sensitive financial / administrative data exposed
        const sanitized: POSProduct = {
          id: p.id,
          name: p.name,
          sku: p.sku,
          barcode: p.barcode || '',
          category: p.category || 'General',
          unitOfMeasure: p.unitOfMeasure || 'UND',
          imageUrl: p.imageUrl || '',
          normalPrice: p.normalPrice || p.price || 0,
          wholesalePrice: p.wholesalePrice,
          distributorPrice: p.distributorPrice,
          availableStock,
          vatRatePercent: p.vatRatePercent !== undefined ? p.vatRatePercent : (p.isExempt ? 0 : 19),
          isExempt: Boolean(p.isExempt),
          status: p.status,
        }
        return sanitized
      })

    return filtered
  }

  /**
   * Búsqueda ultrarrápida por código de barras o SKU exacto (ideal para lectores ópticos)
   */
  async findByBarcodeOrSku(code: string, locationId: string): Promise<POSProduct | null> {
    const clean = code.trim().toLowerCase()
    if (!clean) return null

    const products = await this.getProductsForLocation(locationId)
    return (
      products.find(
        (p) => p.barcode.toLowerCase() === clean || p.sku.toLowerCase() === clean
      ) || null
    )
  }

  /**
   * Obtiene o busca clientes para el POS
   */
  async searchCustomers(query?: string): Promise<POSCustomer[]> {
    const { data: rawCustomers } = await supabaseMock.from('customers').select()
    const allCustomers = (rawCustomers as unknown as Array<any>) || []

    const q = query ? query.toLowerCase().trim() : ''

    return allCustomers
      .filter((c) => {
        if (c.status !== 'ACTIVE') return false
        if (q) {
          const matchName = c.displayName?.toLowerCase().includes(q)
          const matchDoc = c.documentNumber?.toLowerCase().includes(q)
          const matchPhone = c.phone?.toLowerCase().includes(q)
          return matchName || matchDoc || matchPhone
        }
        return true
      })
      .slice(0, 10)
      .map((c) => ({
        id: c.id,
        displayName: c.displayName,
        documentNumber: c.documentNumber,
        documentType: c.documentType || 'CC',
        phone: c.phone || '',
        email: c.email,
        address: c.address,
        priceList: c.priceList || 'DEFAULT',
        creditLimit: c.creditLimit || 0,
        currentBalance: c.currentBalance || 0,
      }))
  }

  /**
   * Obtiene el cliente genérico institucional "Consumidor Final"
   */
  async getGenericCustomer(): Promise<POSCustomer> {
    const customers = await this.searchCustomers('222222222222')
    if (customers.length > 0) return customers[0]

    // Fallback institucional estándar Colombia
    return {
      id: 'cust-006',
      displayName: 'Consumidor Final (Ventas Rápidas POS)',
      documentNumber: '222222222222',
      documentType: 'CC',
      phone: '+57 000 000 0000',
      priceList: 'DEFAULT',
      creditLimit: 0,
      currentBalance: 0,
    }
  }

  /**
   * Registra la transacción completa de venta POS en la base de datos
   */
  async executePOSSale(receipt: POSTicketReceipt, saleData: any): Promise<void> {
    const sales = (db.sales as unknown) as Array<Record<string, unknown>>
    const invoices = (db.invoices as unknown) as Array<Record<string, unknown>>
    const movements = (db.inventoryMovements as unknown) as Array<Record<string, unknown>>
    const stockLevels = (db.stockLevels as unknown) as Array<{
      productId: string
      locationId: string
      availableUnits: number
      quantity: number
    }>
    const auditLogs = (db.auditLogs as unknown) as Array<Record<string, unknown>>

    // 1. Guardar Venta
    sales.unshift(saleData)

    // 2. Guardar Factura POS
    invoices.unshift({
      id: `inv-${Date.now().toString().slice(-6)}`,
      invoiceNumber: receipt.invoiceNumber,
      customerId: receipt.customerDoc === '222222222222' ? 'cust-006' : saleData.customerId,
      customerName: receipt.customerName,
      customerDoc: receipt.customerDoc,
      locationId: receipt.locationId,
      locationName: receipt.locationName,
      date: receipt.date,
      dueDate: receipt.date,
      subtotal: receipt.subtotal,
      taxTotal: receipt.taxTotal,
      total: receipt.totalAmount,
      pendingBalance: 0,
      status: 'PAID',
      paymentMethod: receipt.paymentMethod,
      dianStatus: 'VALIDADA_DIAN',
      dianCufe: receipt.dianCufe,
      itemsCount: receipt.itemsCount,
      saleId: receipt.saleId,
    })

    // 3. Descontar Stock & Generar Movimientos SALE_OUT para Kardex
    for (const item of saleData.items) {
      const stockEntry = stockLevels.find(
        (s) => s.productId === item.productId && s.locationId === receipt.locationId
      )
      const previousStock = stockEntry ? stockEntry.availableUnits : 100
      const resultingStock = Math.max(0, previousStock - item.quantity)

      if (stockEntry) {
        stockEntry.quantity = Math.max(0, stockEntry.quantity - item.quantity)
        stockEntry.availableUnits = resultingStock
      }

      movements.unshift({
        id: `mov-pos-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        movementNumber: `MOV-POS-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`,
        createdAt: receipt.date,
        productId: item.productId,
        productName: item.productName,
        sku: item.sku,
        barcode: item.barcode,
        locationId: receipt.locationId,
        locationName: receipt.locationName,
        type: 'SALE_OUT',
        quantity: item.quantity,
        quantityIn: 0,
        quantityOut: item.quantity,
        quantityDelta: -item.quantity,
        previousStock,
        resultingStock,
        unitCost: item.unitCost || Math.round(item.unitPrice * 0.7),
        totalValue: item.total,
        sourceDocumentType: 'SALE_POS',
        sourceDocumentId: receipt.saleId,
        sourceDocumentNumber: receipt.saleNumber,
        userName: receipt.cashierName,
        notes: `Venta POS rápida ${receipt.saleNumber} (${receipt.invoiceNumber})`,
      })
    }

    // 4. Auditoría
    auditLogs.unshift({
      id: `aud-pos-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: receipt.date,
      user: receipt.cashierName,
      action: 'VENTA_POS_COMPLETADA',
      details: `Venta POS ${receipt.saleNumber} (${receipt.invoiceNumber}) por $${receipt.totalAmount.toLocaleString('es-CO')} pagada en ${receipt.paymentMethod}.`,
      entityId: receipt.saleId,
    })
  }

  /**
   * Obtiene el listado de ventas del día para el cajero
   */
  async getDailySalesForUser(
    cashierName: string,
    locationId: string
  ): Promise<POSDailySaleSummary[]> {
    const { data: rawSales } = await supabaseMock.from('sales').select()
    const allSales = (rawSales as unknown as Array<any>) || []

    const todayStr = new Date().toISOString().slice(0, 10)

    return allSales
      .filter((s) => {
        const saleDateStr = s.date?.slice(0, 10)
        const matchesCashier = (s.sellerName === cashierName || s.cashierName === cashierName)
        return (
          saleDateStr === todayStr &&
          s.locationId === locationId &&
          matchesCashier
        )
      })
      .map((s) => ({
        id: s.id,
        saleId: s.id,
        saleNumber: s.saleNumber,
        invoiceNumber: s.invoiceNumber,
        time: new Date(s.date).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }),
        customerName: s.customerName,
        cashierName: s.sellerName || s.cashierName || cashierName,
        itemsCount: s.itemsCount || s.items?.length || 0,
        totalAmount: s.totalAmount || 0,
        paymentMethod: s.paymentMethod || 'EFECTIVO',
        status: s.status,
      }))
  }
}

export const posRepository = new POSRepository()
