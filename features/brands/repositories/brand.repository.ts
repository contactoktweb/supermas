/**
 * SUPER MÁS ERP/POS — Repositorio de Marcas (BrandRepository)
 *
 * Conectado directamente a public.brands y public.products en Supabase/PostgreSQL.
 * Respeta Row Level Security (RLS) y aislamiento multiempresa por company_id.
 * No inserta directamente en audit_logs (PostgreSQL lo audita automáticamente vía trigger).
 */

import { supabaseClient } from '@/lib/supabase/client'
import { resolveUserCompanyId } from '@/lib/supabase/tenant'
import {
  Brand,
  BrandWithRelations,
  BrandFilters,
  BrandStats,
  BrandDeleteCheck,
} from '../types'
import { BrandFormData } from '../schemas/brand.schema'

function mapDbToDomain(row: any): Brand {
  return {
    id: row.id,
    companyId: row.company_id,
    name: row.name,
    slug: row.slug,
    logoUrl: row.logo_url || null,
    isActive: Boolean(row.is_active),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class BrandRepository {
  /**
   * Resuelve el company_id del usuario autenticado actual de forma estricta
   */
  async resolveCompanyId(preferredCompanyId?: string): Promise<string> {
    return resolveUserCompanyId(supabaseClient, preferredCompanyId)
  }

  /**
   * Consulta las marcas bajo RLS, aplicando filtros, conteo de productos y ordenamiento.
   */
  async findAll(filters?: BrandFilters): Promise<{ data: BrandWithRelations[]; total: number }> {
    let query = supabaseClient.from('brands').select('*', { count: 'exact' })

    if (filters?.status && filters.status !== 'ALL') {
      query = query.eq('is_active', filters.status === 'ACTIVE')
    }

    if (filters?.query) {
      const q = filters.query.trim().replace(/[%_]/g, '')
      if (q) {
        query = query.or(`name.ilike.%${q}%,slug.ilike.%${q}%`)
      }
    }

    // Ordenamiento
    if (filters?.sortBy === 'NAME_DESC') {
      query = query.order('name', { ascending: false })
    } else if (filters?.sortBy === 'CREATED_DESC') {
      query = query.order('created_at', { ascending: false })
    } else {
      query = query.order('name', { ascending: true })
    }

    // Paginación si se especifica
    if (filters?.page && filters?.pageSize) {
      const from = (filters.page - 1) * filters.pageSize
      const to = from + filters.pageSize - 1
      query = query.range(from, to)
    }

    const { data: rows, count, error } = await query

    if (error) {
      console.error('Error consultando marcas en Supabase:', error)
      throw new Error(`Error al cargar marcas: ${error.message}`)
    }

    const rawBrands = (rows || []).map(mapDbToDomain)

    // Consultamos productos para calcular productsCount por marca
    const { data: productRows } = await supabaseClient
      .from('products')
      .select('brand_id')

    const productCountMap = new Map<string, number>()
    ;(productRows || []).forEach((p: any) => {
      if (p.brand_id) {
        productCountMap.set(p.brand_id, (productCountMap.get(p.brand_id) || 0) + 1)
      }
    })

    let dataWithRelations: BrandWithRelations[] = rawBrands.map((brand) => ({
      ...brand,
      productsCount: productCountMap.get(brand.id) || 0,
    }))

    // Ordenamiento por número de productos si se solicitó
    if (filters?.sortBy === 'PRODUCTS_DESC') {
      dataWithRelations = dataWithRelations.sort((a, b) => b.productsCount - a.productsCount)
    }

    return {
      data: dataWithRelations,
      total: count ?? dataWithRelations.length,
    }
  }

  /**
   * Obtiene estadísticas de marcas
   */
  async getStats(): Promise<BrandStats> {
    const { data: rows, error } = await supabaseClient
      .from('brands')
      .select('id, is_active')

    if (error) {
      console.error('Error obteniendo estadísticas de marcas:', error)
      return {
        totalBrands: 0,
        activeBrands: 0,
        inactiveBrands: 0,
        brandsWithProducts: 0,
      }
    }

    const total = rows?.length || 0
    const active = rows?.filter((r: any) => r.is_active).length || 0
    const inactive = total - active

    const { data: prods } = await supabaseClient
      .from('products')
      .select('brand_id')

    const uniqueBrandsWithProds = new Set<string>()
    prods?.forEach((p: any) => {
      if (p.brand_id) uniqueBrandsWithProds.add(p.brand_id)
    })

    return {
      totalBrands: total,
      activeBrands: active,
      inactiveBrands: inactive,
      brandsWithProducts: uniqueBrandsWithProds.size,
    }
  }

  /**
   * Busca marca por ID
   */
  async findById(id: string): Promise<BrandWithRelations | null> {
    const { data: row, error } = await supabaseClient
      .from('brands')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (error || !row) return null

    const brand = mapDbToDomain(row)

    const { count: prodCount } = await supabaseClient
      .from('products')
      .select('id', { count: 'exact', head: true })
      .eq('brand_id', id)

    return {
      ...brand,
      productsCount: prodCount || 0,
    }
  }

  /**
   * Busca si existe una marca con un nombre específico en la empresa
   */
  async findByName(name: string, companyId?: string): Promise<Brand | null> {
    const resolvedCompanyId = await this.resolveCompanyId(companyId)
    const { data } = await supabaseClient
      .from('brands')
      .select('*')
      .eq('company_id', resolvedCompanyId)
      .ilike('name', name.trim())
      .maybeSingle()

    return data ? mapDbToDomain(data) : null
  }

  /**
   * Busca si existe una marca con un slug específico en la empresa
   */
  async findBySlug(slug: string, companyId?: string): Promise<Brand | null> {
    const resolvedCompanyId = await this.resolveCompanyId(companyId)
    const { data } = await supabaseClient
      .from('brands')
      .select('*')
      .eq('company_id', resolvedCompanyId)
      .ilike('slug', slug.trim())
      .maybeSingle()

    return data ? mapDbToDomain(data) : null
  }

  /**
   * Inserta una nueva marca en public.brands bajo RLS
   */
  async create(data: BrandFormData, companyId?: string): Promise<Brand> {
    const resolvedCompanyId = await this.resolveCompanyId(companyId)

    const insertPayload = {
      company_id: resolvedCompanyId,
      name: data.name.trim(),
      slug: data.slug.trim(),
      logo_url: data.logoUrl?.trim() || null,
      is_active: data.isActive ?? true,
    }

    const { data: createdRow, error } = await supabaseClient
      .from('brands')
      .insert(insertPayload)
      .select()
      .single()

    if (error) {
      console.error('Error insertando marca en Supabase:', error)
      throw new Error(this.translateDbError(error))
    }

    return mapDbToDomain(createdRow)
  }

  /**
   * Actualiza una marca existente
   */
  async update(id: string, data: Partial<BrandFormData>): Promise<Brand> {
    const updatePayload: Record<string, any> = {
      updated_at: new Date().toISOString(),
    }

    if (data.name !== undefined) updatePayload.name = data.name.trim()
    if (data.slug !== undefined) updatePayload.slug = data.slug.trim()
    if (data.logoUrl !== undefined) updatePayload.logo_url = data.logoUrl?.trim() || null
    if (data.isActive !== undefined) updatePayload.is_active = data.isActive

    const { data: updatedRow, error } = await supabaseClient
      .from('brands')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error(`Error actualizando marca ${id}:`, error)
      throw new Error(this.translateDbError(error))
    }

    return mapDbToDomain(updatedRow)
  }

  /**
   * Cambia el estado de activación de la marca
   */
  async toggleActive(id: string, isActive: boolean): Promise<Brand> {
    return this.update(id, { isActive })
  }

  /**
   * Valida si una marca puede ser eliminada físicamente
   */
  async checkCanDelete(id: string): Promise<BrandDeleteCheck> {
    const { count: prodCount } = await supabaseClient
      .from('products')
      .select('id', { count: 'exact', head: true })
      .eq('brand_id', id)

    if ((prodCount || 0) > 0) {
      return {
        canDelete: false,
        reason: `Existen ${prodCount} producto(s) asociados a esta marca. Para preservar la integridad del catálogo, desactívala en lugar de eliminarla.`,
        associatedProductsCount: prodCount || 0,
      }
    }

    return {
      canDelete: true,
      associatedProductsCount: 0,
    }
  }

  /**
   * Elimina una marca de public.brands bajo RLS
   */
  async delete(id: string): Promise<void> {
    const check = await this.checkCanDelete(id)
    if (!check.canDelete) {
      throw new Error(check.reason || 'No se puede eliminar la marca debido a productos asociados.')
    }

    const { error } = await supabaseClient.from('brands').delete().eq('id', id)

    if (error) {
      console.error(`Error eliminando marca ${id}:`, error)
      throw new Error(this.translateDbError(error))
    }
  }

  /**
   * Traduce errores técnicos de PostgreSQL a mensajes comprensibles
   */
  private translateDbError(error: any): string {
    const msg = error?.message || ''
    if (msg.includes('brands_company_id_name_key')) {
      return 'Ya existe una marca con este nombre en su empresa.'
    }
    if (msg.includes('brands_company_id_slug_key')) {
      return 'Ya existe una marca con este slug en su empresa.'
    }
    if (msg.includes('foreign key constraint') || msg.includes('violates foreign key')) {
      return 'No se puede realizar la operación porque la marca tiene productos vinculados.'
    }
    if (msg.includes('row-level security') || msg.includes('permission denied')) {
      return 'No tienes permisos suficientes para realizar esta acción sobre la marca.'
    }
    return msg || 'Ocurrió un error inesperado al procesar la marca.'
  }
}

export const brandRepository = new BrandRepository()
