import { supabaseClient } from '@/lib/supabase/client'
import { SupabaseClient } from '@supabase/supabase-js'

export interface LocationOption {
  id: string
  code: string
  name: string
  type: string
  city?: string
  status?: string
  /** La bodega admite órdenes de compra (locations.allow_purchases). */
  allowPurchases: boolean
}

export class LocationService {
  private client: SupabaseClient

  constructor(client: SupabaseClient = supabaseClient) {
    this.client = client
  }

  withClient(client: SupabaseClient): LocationService {
    return new LocationService(client)
  }

  /**
   * Obtiene la lista de ubicaciones/bodegas activas desde PostgreSQL bajo RLS.
   */
  async list(): Promise<LocationOption[]> {
    const { data, error } = await this.client
      .from('locations')
      .select('id, code, name, type, city, status, allow_purchases')
      .eq('status', 'ACTIVE')
      .order('name', { ascending: true })

    if (error || !data) {
      console.error('Error cargando bodegas activas en LocationService:', error)
      return []
    }

    return data.map((l) => ({
      id: l.id,
      code: l.code,
      name: l.name,
      type: l.type,
      city: l.city || undefined,
      status: l.status,
      allowPurchases: l.allow_purchases !== false,
    }))
  }

  /**
   * Obtiene una bodega específica por ID.
   */
  async getById(id: string): Promise<LocationOption | null> {
    const { data, error } = await this.client
      .from('locations')
      .select('id, code, name, type, city, status, allow_purchases')
      .eq('id', id)
      .single()

    if (error || !data) return null

    return {
      id: data.id,
      code: data.code,
      name: data.name,
      type: data.type,
      city: data.city || undefined,
      status: data.status,
      allowPurchases: data.allow_purchases !== false,
    }
  }
}

export const locationService = new LocationService()
