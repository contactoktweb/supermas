import { db } from '@/lib/supabase'
import { SupplierOption } from '../types'

export class SupplierService {
  /**
   * Obtiene la lista completa de proveedores registrados en la base de datos de Supabase.
   */
  async list(): Promise<SupplierOption[]> {
    const rawSuppliers = db.suppliers as unknown as {
      id?: string
      supplierId?: string
      supplierName?: string
      name?: string
      nit?: string
      phone?: string
      email?: string
      currentBalance?: number
      status?: string
    }[]

    return rawSuppliers.map((s) => ({
      id: s.supplierId || s.id || `sup-${Math.random()}`,
      name: s.supplierName || s.name || 'Proveedor sin nombre',
      nit: s.nit || '',
      phone: s.phone || '',
      email: s.email || '',
      currentBalance: s.currentBalance || 0,
    }))
  }

  /**
   * Obtiene un proveedor por su ID.
   */
  async getById(id: string): Promise<SupplierOption | null> {
    const suppliers = await this.list()
    return suppliers.find((s) => s.id === id) || null
  }

  /**
   * Busca proveedores por nombre o NIT.
   */
  async search(query: string): Promise<SupplierOption[]> {
    const q = query.toLowerCase().trim()
    const suppliers = await this.list()
    if (!q) return suppliers

    return suppliers.filter(
      (s) => s.name.toLowerCase().includes(q) || s.nit.includes(q)
    )
  }
}

export const supplierService = new SupplierService()
