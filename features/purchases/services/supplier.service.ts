import { supabaseClient } from '@/lib/supabase/client'
import { SupplierOption } from '../types'

export class SupplierService {
  /**
   * Obtiene la lista completa de proveedores activos desde PostgreSQL bajo RLS.
   */
  async list(): Promise<SupplierOption[]> {
    const { data, error } = await supabaseClient
      .from('suppliers')
      .select('id, name, legal_name, tax_id, phone, email, is_active')
      .eq('is_active', true)
      .order('name', { ascending: true })

    if (error || !data) {
      console.error('Error consultando proveedores en SupplierService:', error)
      return []
    }

    return data.map((s) => ({
      id: s.id,
      name: s.name || s.legal_name || 'Proveedor sin nombre',
      nit: s.tax_id || '',
      phone: s.phone || '',
      email: s.email || '',
      currentBalance: 0,
    }))
  }

  /**
   * Obtiene un proveedor por su ID.
   */
  async getById(id: string): Promise<SupplierOption | null> {
    const { data, error } = await supabaseClient
      .from('suppliers')
      .select('id, name, legal_name, tax_id, phone, email')
      .eq('id', id)
      .single()

    if (error || !data) return null

    return {
      id: data.id,
      name: data.name || data.legal_name || 'Proveedor sin nombre',
      nit: data.tax_id || '',
      phone: data.phone || '',
      email: data.email || '',
      currentBalance: 0,
    }
  }

  /**
   * Busca proveedores por nombre o NIT.
   */
  async search(query: string): Promise<SupplierOption[]> {
    const q = query.toLowerCase().trim()
    if (!q) return this.list()

    const { data, error } = await supabaseClient
      .from('suppliers')
      .select('id, name, legal_name, tax_id, phone, email')
      .eq('is_active', true)
      .or(`name.ilike.%${q}%,legal_name.ilike.%${q}%,tax_id.ilike.%${q}%`)
      .order('name', { ascending: true })

    if (error || !data) return []

    return data.map((s) => ({
      id: s.id,
      name: s.name || s.legal_name || 'Proveedor sin nombre',
      nit: s.tax_id || '',
      phone: s.phone || '',
      email: s.email || '',
      currentBalance: 0,
    }))
  }
}

export const supplierService = new SupplierService()
