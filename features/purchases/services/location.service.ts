import { supabaseClient } from '@/lib/supabase/client'

export interface LocationOption {
  id: string
  code: string
  name: string
  type: string
  city?: string
  status?: string
}

export class LocationService {
  /**
   * Obtiene la lista de ubicaciones/bodegas activas desde PostgreSQL bajo RLS.
   */
  async list(): Promise<LocationOption[]> {
    const { data, error } = await supabaseClient
      .from('locations')
      .select('id, code, name, type, city, status')
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
      city: l.city || 'Medellín',
      status: l.status,
    }))
  }

  /**
   * Obtiene una bodega específica por ID.
   */
  async getById(id: string): Promise<LocationOption | null> {
    const { data, error } = await supabaseClient
      .from('locations')
      .select('id, code, name, type, city, status')
      .eq('id', id)
      .single()

    if (error || !data) return null

    return {
      id: data.id,
      code: data.code,
      name: data.name,
      type: data.type,
      city: data.city || 'Medellín',
      status: data.status,
    }
  }
}

export const locationService = new LocationService()
