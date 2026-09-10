import { db } from '@/lib/supabase'

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
   * Obtiene la lista de ubicaciones/bodegas activas desde la base de datos Supabase.
   */
  async list(): Promise<LocationOption[]> {
    const raw = db.locations as unknown as {
      id?: string
      code?: string
      name?: string
      type?: string
      city?: string
      status?: string
    }[]

    return raw.map((l, idx) => ({
      id: l.id || `loc-${idx + 1}`,
      code: l.code || `BOD-00${idx + 1}`,
      name: l.name || `Bodega ${idx + 1}`,
      type: l.type || 'WAREHOUSE',
      city: l.city || 'Medellín',
      status: l.status || 'ACTIVE',
    }))
  }

  /**
   * Obtiene una bodega específica por ID.
   */
  async getById(id: string): Promise<LocationOption | null> {
    const list = await this.list()
    return list.find((l) => l.id === id) || null
  }
}

export const locationService = new LocationService()
