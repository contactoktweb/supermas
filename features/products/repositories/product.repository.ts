import {
  Product,
  ProductFilterParams,
  GlobalProductsStats,
} from '../types'
import { INITIAL_PRODUCTS_MOCK } from '../mocks/product.mock'

export class ProductRepository {
  private products: Product[] = [...INITIAL_PRODUCTS_MOCK]

  async findAll(params: ProductFilterParams): Promise<{
    items: Product[]
    total: number
    page: number
    pageSize: number
    totalPages: number
  }> {
    let filtered = [...this.products]

    // 1. Text Search (name, sku, barcode)
    if (params.query && params.query.trim()) {
      const q = params.query.trim().toLowerCase()
      filtered = filtered.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          p.barcode.toLowerCase().includes(q)
      )
    }

    // 2. Category Filter
    if (params.category && params.category !== 'ALL') {
      filtered = filtered.filter((p) => p.category === params.category)
    }

    // 3. Brand Filter
    if (params.brand && params.brand !== 'ALL') {
      filtered = filtered.filter((p) => p.brand === params.brand)
    }

    // 4. Status Filter
    if (params.status && params.status !== 'ALL') {
      filtered = filtered.filter((p) => p.status === params.status)
    }

    // 5. Stock Health Filter
    if (params.stockHealth && params.stockHealth !== 'ALL') {
      filtered = filtered.filter((p) => p.stockHealth === params.stockHealth)
    }

    // 6. Location Filter
    if (params.locationId && params.locationId !== 'ALL') {
      filtered = filtered.filter((p) =>
        p.warehouseStock.some((w) => w.locationId === params.locationId && w.quantity > 0)
      )
    }

    // 7. Web Channel Filter
    if (params.webChannel && params.webChannel !== 'ALL') {
      if (params.webChannel === 'SUPER_MAS') {
        filtered = filtered.filter((p) => p.webSuperMas)
      } else if (params.webChannel === 'DISTRIBUIDORA') {
        filtered = filtered.filter((p) => p.webDistribuidora)
      } else if (params.webChannel === 'BOTH') {
        filtered = filtered.filter((p) => p.webSuperMas && p.webDistribuidora)
      } else if (params.webChannel === 'NONE') {
        filtered = filtered.filter((p) => !p.webSuperMas && !p.webDistribuidora)
      }
    }

    // 8. Sorting
    const sortField = params.sortField || 'name'
    const sortDir = params.sortDirection || 'asc'
    filtered.sort((a, b) => {
      let valA: any = a[sortField as keyof Product]
      let valB: any = b[sortField as keyof Product]

      if (sortField === 'stock') {
        valA = a.totalStock
        valB = b.totalStock
      } else if (sortField === 'margin') {
        valA = a.profitMarginPercent
        valB = b.profitMarginPercent
      }

      if (typeof valA === 'string') {
        return sortDir === 'asc'
          ? valA.localeCompare(valB)
          : valB.localeCompare(valA)
      }

      return sortDir === 'asc' ? valA - valB : valB - valA
    })

    const total = filtered.length
    const page = Math.max(1, params.page || 1)
    const pageSize = Math.max(1, params.pageSize || 10)
    const totalPages = Math.max(1, Math.ceil(total / pageSize))
    const start = (page - 1) * pageSize
    const paginatedItems = filtered.slice(start, start + pageSize)

    return {
      items: paginatedItems,
      total,
      page,
      pageSize,
      totalPages,
    }
  }

  async findById(id: string): Promise<Product | null> {
    const product = this.products.find((p) => p.id === id)
    return product ? JSON.parse(JSON.stringify(product)) : null
  }

  async findBySku(sku: string): Promise<Product | null> {
    const normalized = sku.trim().toUpperCase()
    const product = this.products.find((p) => p.sku.toUpperCase() === normalized)
    return product ? JSON.parse(JSON.stringify(product)) : null
  }

  async findByBarcode(barcode: string): Promise<Product | null> {
    if (!barcode.trim()) return null
    const product = this.products.find((p) => p.barcode === barcode.trim())
    return product ? JSON.parse(JSON.stringify(product)) : null
  }

  async create(product: Product): Promise<Product> {
    this.products.unshift(product)
    return JSON.parse(JSON.stringify(product))
  }

  async update(id: string, updates: Partial<Product>): Promise<Product> {
    const index = this.products.findIndex((p) => p.id === id)
    if (index === -1) {
      throw new Error(`Producto con ID ${id} no encontrado`)
    }

    this.products[index] = {
      ...this.products[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    }

    return JSON.parse(JSON.stringify(this.products[index]))
  }

  async softDelete(id: string): Promise<Product> {
    return this.update(id, { status: 'INACTIVE' })
  }

  async getGlobalStats(): Promise<GlobalProductsStats> {
    const totalProducts = this.products.length
    const activeProducts = this.products.filter((p) => p.status === 'ACTIVE').length
    const outOfStockProducts = this.products.filter(
      (p) => p.stockHealth === 'OUT_OF_STOCK' || p.totalStock === 0
    ).length
    const lowStockProducts = this.products.filter(
      (p) => p.stockHealth === 'LOW_STOCK' || p.stockHealth === 'CRITICAL'
    ).length
    const totalInventoryValueAtCost = this.products.reduce(
      (acc, p) => acc + (p.inventoryValueAtCost || 0),
      0
    )
    const webPublishedProducts = this.products.filter(
      (p) => p.webSuperMas || p.webDistribuidora
    ).length

    return {
      totalProducts,
      activeProducts,
      outOfStockProducts,
      lowStockProducts,
      totalInventoryValueAtCost,
      webPublishedProducts,
      isCostRedacted: false,
    }
  }

  async resetMocks(): Promise<void> {
    this.products = [...INITIAL_PRODUCTS_MOCK]
  }
}

export const productRepository = new ProductRepository()
