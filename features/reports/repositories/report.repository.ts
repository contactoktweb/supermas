/**
 * SUPER MÁS ERP/POS - Repositorio de Datos Analíticos (ReportRepository)
 *
 * Capa de lectura desacoplada que consulta los datasets centralizados en lib/supabase/db.ts.
 * Cuando se conecte Supabase PostgreSQL / Prisma, únicamente se adaptará esta capa.
 *
 * IMPORTANTE: OPERACIONES 100% DE LECTURA (READ-ONLY).
 */

import { db } from '@/lib/supabase/db'
import { ReportFilterCriteria } from '../types'

export class ReportRepository {
  /**
   * Obtiene todas las ventas
   */
  async getSales(criteria?: ReportFilterCriteria) {
    let list = [...db.sales]

    if (criteria?.locationId && criteria.locationId !== 'ALL') {
      list = list.filter((s) => s.locationId === criteria.locationId)
    }

    if (criteria?.customerId && criteria.customerId !== 'ALL') {
      list = list.filter((s) => s.customerId === criteria.customerId)
    }

    if (criteria?.userId && criteria.userId !== 'ALL') {
      list = list.filter((s) => s.sellerId === criteria.userId)
    }

    if (criteria?.paymentMethod && criteria.paymentMethod !== 'ALL') {
      list = list.filter(
        (s: any) =>
          s.paymentMethod?.toLowerCase() === criteria.paymentMethod?.toLowerCase() ||
          s.paymentType?.toLowerCase() === criteria.paymentMethod?.toLowerCase()
      )
    }

    if (criteria?.startDate) {
      const start = new Date(criteria.startDate).getTime()
      list = list.filter((s) => new Date(s.date).getTime() >= start)
    }

    if (criteria?.endDate) {
      const end = new Date(criteria.endDate).getTime()
      list = list.filter((s) => new Date(s.date).getTime() <= end)
    }

    if (criteria?.searchQuery) {
      const q = criteria.searchQuery.toLowerCase().trim()
      list = list.filter(
        (s) =>
          s.saleNumber?.toLowerCase().includes(q) ||
          s.customerName?.toLowerCase().includes(q) ||
          s.customerDoc?.toLowerCase().includes(q) ||
          s.items?.some((i: any) => i.productName?.toLowerCase().includes(q) || i.sku?.toLowerCase().includes(q))
      )
    }

    return list
  }

  /**
   * Obtiene todas las compras
   */
  async getPurchases(criteria?: ReportFilterCriteria) {
    let list = [...db.purchases]

    if (criteria?.locationId && criteria.locationId !== 'ALL') {
      list = list.filter(
        (p) => p.destinationLocationId === criteria.locationId || p.locationId === criteria.locationId
      )
    }

    if (criteria?.supplierId && criteria.supplierId !== 'ALL') {
      list = list.filter((p) => p.supplierId === criteria.supplierId)
    }

    if (criteria?.startDate) {
      const start = new Date(criteria.startDate).getTime()
      list = list.filter((p) => new Date(p.date).getTime() >= start)
    }

    if (criteria?.endDate) {
      const end = new Date(criteria.endDate).getTime()
      list = list.filter((p) => new Date(p.date).getTime() <= end)
    }

    if (criteria?.searchQuery) {
      const q = criteria.searchQuery.toLowerCase().trim()
      list = list.filter(
        (p) =>
          p.purchaseNumber?.toLowerCase().includes(q) ||
          p.supplierInvoiceNumber?.toLowerCase().includes(q) ||
          p.supplierName?.toLowerCase().includes(q) ||
          p.supplierNit?.toLowerCase().includes(q)
      )
    }

    return list
  }

  /**
   * Obtiene productos maestros con información de precios y catálogo
   */
  async getProducts() {
    return [...db.products]
  }

  /**
   * Obtiene niveles de stock por producto y bodega
   */
  async getStockLevels(locationId?: string) {
    let list = [...db.stockLevels]
    if (locationId && locationId !== 'ALL') {
      list = list.filter((s) => s.locationId === locationId)
    }
    return list
  }

  /**
   * Obtiene el historial de movimientos de inventario (Kardex)
   */
  async getInventoryMovements(criteria?: ReportFilterCriteria) {
    let list = [...db.inventoryMovements]

    if (criteria?.locationId && criteria.locationId !== 'ALL') {
      list = list.filter(
        (m: any) => m.locationId === criteria.locationId || m.sourceLocationId === criteria.locationId || m.targetLocationId === criteria.locationId
      )
    }

    if (criteria?.productId && criteria.productId !== 'ALL') {
      list = list.filter((m: any) => m.productId === criteria.productId)
    }

    if (criteria?.movementType && criteria.movementType !== 'ALL') {
      list = list.filter((m: any) => m.type === criteria.movementType || m.movementType === criteria.movementType)
    }

    if (criteria?.startDate) {
      const start = new Date(criteria.startDate).getTime()
      list = list.filter((m: any) => new Date(m.createdAt || m.timestamp || m.date).getTime() >= start)
    }

    if (criteria?.endDate) {
      const end = new Date(criteria.endDate).getTime()
      list = list.filter((m: any) => new Date(m.createdAt || m.timestamp || m.date).getTime() <= end)
    }

    return list
  }

  /**
   * Obtiene clientes
   */
  async getCustomers() {
    return [...db.customers]
  }

  /**
   * Obtiene proveedores
   */
  async getSuppliers() {
    return [...db.suppliers]
  }

  /**
   * Obtiene facturas electrónicas
   */
  async getInvoices(criteria?: ReportFilterCriteria) {
    let list = [...db.invoices]

    if (criteria?.locationId && criteria.locationId !== 'ALL') {
      list = list.filter((inv) => inv.locationId === criteria.locationId)
    }

    if (criteria?.customerId && criteria.customerId !== 'ALL') {
      list = list.filter((inv) => inv.customerId === criteria.customerId)
    }

    if (criteria?.startDate) {
      const start = new Date(criteria.startDate).getTime()
      list = list.filter((inv) => new Date(inv.date).getTime() >= start)
    }

    if (criteria?.endDate) {
      const end = new Date(criteria.endDate).getTime()
      list = list.filter((inv) => new Date(inv.date).getTime() <= end)
    }

    return list
  }

  /**
   * Obtiene pedidos web
   */
  async getWebOrders(criteria?: ReportFilterCriteria) {
    let list = [...db.webOrders]

    if (criteria?.startDate) {
      const start = new Date(criteria.startDate).getTime()
      list = list.filter((o) => new Date(o.createdAt).getTime() >= start)
    }

    if (criteria?.endDate) {
      const end = new Date(criteria.endDate).getTime()
      list = list.filter((o) => new Date(o.createdAt).getTime() <= end)
    }

    return list
  }

  /**
   * Obtiene cajas registradoras y sus movimientos
   */
  async getCashRegisters(locationId?: string) {
    let list = [...db.cashRegisters]
    if (locationId && locationId !== 'ALL') {
      list = list.filter((r) => r.locationId === locationId)
    }
    return list
  }

  async getCashMovements(registerId?: string, locationId?: string) {
    let list = [...db.cashMovements]
    if (registerId && registerId !== 'ALL') {
      list = list.filter((m) => m.cashRegisterId === registerId)
    }
    if (locationId && locationId !== 'ALL') {
      list = list.filter((m) => m.locationId === locationId)
    }
    return list
  }

  /**
   * Obtiene bodegas activas
   */
  async getLocations() {
    return [...db.locations]
  }

  /**
   * Obtiene usuarios
   */
  async getUsers() {
    return [...db.users]
  }

  /**
   * Obtiene categorías y marcas
   */
  async getCategories() {
    return [...db.categories]
  }

  async getBrands() {
    return [...db.brands]
  }
}

export const reportRepository = new ReportRepository()
