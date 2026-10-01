/**
 * SUPER MÁS ERP/POS — Repositorio de Categorías (CategoryRepository)
 *
 * Conectado directamente a public.categories y public.products en Supabase/PostgreSQL.
 * Respeta Row Level Security (RLS) y aislamiento multiempresa por company_id.
 * No inserta directamente en audit_logs (PostgreSQL lo audita automáticamente vía trigger).
 */

import { supabaseClient } from '@/lib/supabase/client'
import {
  Category,
  CategoryWithRelations,
  CategoryFilters,
  CategoryStats,
  CategoryDeleteCheck,
} from '../types'
import { CategoryFormData } from '../schemas/category.schema'

function mapDbToDomain(row: any): Category {
  return {
    id: row.id,
    companyId: row.company_id,
    parentId: row.parent_id || null,
    name: row.name,
    slug: row.slug,
    code: row.code || null,
    description: row.description || null,
    isActive: Boolean(row.is_active),
    sortOrder: Number(row.sort_order ?? 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export class CategoryRepository {
  /**
   * Resuelve el company_id del usuario autenticado actual o de la empresa activa
   */
  async resolveCompanyId(preferredCompanyId?: string): Promise<string> {
    if (preferredCompanyId) return preferredCompanyId

    const { data: authUser } = await supabaseClient.auth.getUser()
    if (authUser.user) {
      const { data: userRow } = await supabaseClient
        .from('users')
        .select('company_id')
        .eq('id', authUser.user.id)
        .maybeSingle()
      if (userRow?.company_id) return userRow.company_id
    }

    const { data: comp } = await supabaseClient
      .from('companies')
      .select('id')
      .limit(1)
      .single()

    if (comp?.id) return comp.id

    throw new Error('No se pudo determinar la empresa asociada (company_id) para la categoría.')
  }

  /**
   * Consulta las categorías bajo RLS, aplicando filtros, conteos de relaciones y jerarquía.
   */
  async findAll(filters?: CategoryFilters): Promise<{ data: CategoryWithRelations[]; total: number }> {
    let query = supabaseClient.from('categories').select('*', { count: 'exact' })

    if (filters?.status && filters.status !== 'ALL') {
      query = query.eq('is_active', filters.status === 'ACTIVE')
    }

    if (filters?.parentId) {
      if (filters.parentId === 'ROOT') {
        query = query.is('parent_id', null)
      } else if (filters.parentId !== 'ALL') {
        query = query.eq('parent_id', filters.parentId)
      }
    }

    if (filters?.query) {
      const q = filters.query.trim().replace(/[%_]/g, '')
      if (q) {
        query = query.or(`name.ilike.%${q}%,slug.ilike.%${q}%,code.ilike.%${q}%`)
      }
    }

    // Ordenamiento
    if (filters?.sortBy === 'NAME_DESC') {
      query = query.order('name', { ascending: false })
    } else if (filters?.sortBy === 'CODE_ASC') {
      query = query.order('code', { ascending: true, nullsFirst: false })
    } else if (filters?.sortBy === 'SORT_ORDER_ASC') {
      query = query.order('sort_order', { ascending: true }).order('name', { ascending: true })
    } else if (filters?.sortBy === 'CREATED_DESC') {
      query = query.order('created_at', { ascending: false })
    } else {
      // Default: NAME_ASC
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
      console.error('Error consultando categorías en Supabase:', error)
      throw new Error(`Error al cargar categorías: ${error.message}`)
    }

    const rawCategories = (rows || []).map(mapDbToDomain)

    // Consultamos todas las categorías de la empresa para resolver nombres de padre y niveles
    const { data: allCatRows } = await supabaseClient
      .from('categories')
      .select('id, name, parent_id')

    const categoryMap = new Map<string, { name: string; parentId: string | null }>()
    const childrenCountMap = new Map<string, number>()

    ;(allCatRows || []).forEach((c: any) => {
      categoryMap.set(c.id, { name: c.name, parentId: c.parent_id })
      if (c.parent_id) {
        childrenCountMap.set(c.parent_id, (childrenCountMap.get(c.parent_id) || 0) + 1)
      }
    })

    // Consultamos productos para calcular productsCount por categoría
    const { data: productRows } = await supabaseClient
      .from('products')
      .select('category_id')

    const productCountMap = new Map<string, number>()
    ;(productRows || []).forEach((p: any) => {
      if (p.category_id) {
        productCountMap.set(p.category_id, (productCountMap.get(p.category_id) || 0) + 1)
      }
    })

    // Construir jerarquía y paths
    const dataWithRelations: CategoryWithRelations[] = rawCategories.map((cat) => {
      const parentName = cat.parentId ? categoryMap.get(cat.parentId)?.name || null : null
      const childrenCount = childrenCountMap.get(cat.id) || 0
      const productsCount = productCountMap.get(cat.id) || 0

      // Calcular nivel jerárquico
      let level = 0
      let currentParentId = cat.parentId
      const visited = new Set<string>()
      while (currentParentId && categoryMap.has(currentParentId) && !visited.has(currentParentId)) {
        visited.add(currentParentId)
        level++
        currentParentId = categoryMap.get(currentParentId)?.parentId || null
      }

      return {
        ...cat,
        parentName,
        childrenCount,
        productsCount,
        level,
      }
    })

    return {
      data: dataWithRelations,
      total: count ?? dataWithRelations.length,
    }
  }

  /**
   * Obtiene estadísticas globales de categorías
   */
  async getStats(): Promise<CategoryStats> {
    const { data: rows, error } = await supabaseClient
      .from('categories')
      .select('id, is_active, parent_id')

    if (error) {
      console.error('Error obteniendo estadísticas de categorías:', error)
      return {
        totalCategories: 0,
        activeCategories: 0,
        inactiveCategories: 0,
        rootCategories: 0,
        subcategories: 0,
      }
    }

    const total = rows?.length || 0
    const active = rows?.filter((r: any) => r.is_active).length || 0
    const inactive = total - active
    const root = rows?.filter((r: any) => !r.parent_id).length || 0
    const sub = total - root

    return {
      totalCategories: total,
      activeCategories: active,
      inactiveCategories: inactive,
      rootCategories: root,
      subcategories: sub,
    }
  }

  /**
   * Busca categoría por ID
   */
  async findById(id: string): Promise<CategoryWithRelations | null> {
    const { data: row, error } = await supabaseClient
      .from('categories')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (error || !row) return null

    const cat = mapDbToDomain(row)

    let parentName: string | null = null
    if (cat.parentId) {
      const { data: parentRow } = await supabaseClient
        .from('categories')
        .select('name')
        .eq('id', cat.parentId)
        .maybeSingle()
      parentName = parentRow?.name || null
    }

    const { count: childCount } = await supabaseClient
      .from('categories')
      .select('id', { count: 'exact', head: true })
      .eq('parent_id', id)

    const { count: prodCount } = await supabaseClient
      .from('products')
      .select('id', { count: 'exact', head: true })
      .eq('category_id', id)

    return {
      ...cat,
      parentName,
      childrenCount: childCount || 0,
      productsCount: prodCount || 0,
      level: 0,
    }
  }

  /**
   * Busca si existe una categoría con un slug específico en la empresa
   */
  async findBySlug(slug: string, companyId?: string): Promise<Category | null> {
    const resolvedCompanyId = await this.resolveCompanyId(companyId)
    const { data } = await supabaseClient
      .from('categories')
      .select('*')
      .eq('company_id', resolvedCompanyId)
      .ilike('slug', slug.trim())
      .maybeSingle()

    return data ? mapDbToDomain(data) : null
  }

  /**
   * Busca si existe una categoría con un código específico en la empresa
   */
  async findByCode(code: string, companyId?: string): Promise<Category | null> {
    if (!code) return null
    const resolvedCompanyId = await this.resolveCompanyId(companyId)
    const { data } = await supabaseClient
      .from('categories')
      .select('*')
      .eq('company_id', resolvedCompanyId)
      .ilike('code', code.trim())
      .maybeSingle()

    return data ? mapDbToDomain(data) : null
  }

  /**
   * Inserta una nueva categoría en public.categories bajo RLS
   */
  async create(data: CategoryFormData, companyId?: string): Promise<Category> {
    const resolvedCompanyId = await this.resolveCompanyId(companyId)

    const insertPayload = {
      company_id: resolvedCompanyId,
      name: data.name.trim(),
      slug: data.slug.trim(),
      code: data.code?.trim() || null,
      description: data.description?.trim() || null,
      parent_id: data.parentId || null,
      is_active: data.isActive ?? true,
      sort_order: data.sortOrder ?? 0,
    }

    const { data: createdRow, error } = await supabaseClient
      .from('categories')
      .insert(insertPayload)
      .select()
      .single()

    if (error) {
      console.error('Error insertando categoría en Supabase:', error)
      throw new Error(this.translateDbError(error))
    }

    return mapDbToDomain(createdRow)
  }

  /**
   * Actualiza una categoría existente
   */
  async update(id: string, data: Partial<CategoryFormData>): Promise<Category> {
    const updatePayload: Record<string, any> = {
      updated_at: new Date().toISOString(),
    }

    if (data.name !== undefined) updatePayload.name = data.name.trim()
    if (data.slug !== undefined) updatePayload.slug = data.slug.trim()
    if (data.code !== undefined) updatePayload.code = data.code?.trim() || null
    if (data.description !== undefined) updatePayload.description = data.description?.trim() || null
    if (data.parentId !== undefined) updatePayload.parent_id = data.parentId || null
    if (data.isActive !== undefined) updatePayload.is_active = data.isActive
    if (data.sortOrder !== undefined) updatePayload.sort_order = data.sortOrder

    const { data: updatedRow, error } = await supabaseClient
      .from('categories')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error(`Error actualizando categoría ${id}:`, error)
      throw new Error(this.translateDbError(error))
    }

    return mapDbToDomain(updatedRow)
  }

  /**
   * Cambia el estado de activación de la categoría
   */
  async toggleActive(id: string, isActive: boolean): Promise<Category> {
    return this.update(id, { isActive })
  }

  /**
   * Valida si una categoría puede ser eliminada físicamente
   */
  async checkCanDelete(id: string): Promise<CategoryDeleteCheck> {
    // 1. Verificar productos asociados
    const { count: prodCount } = await supabaseClient
      .from('products')
      .select('id', { count: 'exact', head: true })
      .eq('category_id', id)

    if ((prodCount || 0) > 0) {
      return {
        canDelete: false,
        reason: `Existen ${prodCount} producto(s) asociados a esta categoría. Para preservar la integridad del catálogo, desactívala en lugar de eliminarla.`,
        associatedProductsCount: prodCount || 0,
        childCategoriesCount: 0,
      }
    }

    // 2. Verificar subcategorías hijas
    const { count: childCount } = await supabaseClient
      .from('categories')
      .select('id', { count: 'exact', head: true })
      .eq('parent_id', id)

    if ((childCount || 0) > 0) {
      return {
        canDelete: false,
        reason: `Esta categoría contiene ${childCount} subcategoría(s) dependiente(s). Reasigna o elimina las subcategorías primero.`,
        associatedProductsCount: 0,
        childCategoriesCount: childCount || 0,
      }
    }

    return {
      canDelete: true,
      associatedProductsCount: 0,
      childCategoriesCount: 0,
    }
  }

  /**
   * Elimina una categoría de public.categories bajo RLS
   */
  async delete(id: string): Promise<void> {
    const check = await this.checkCanDelete(id)
    if (!check.canDelete) {
      throw new Error(check.reason || 'No se puede eliminar la categoría debido a dependencias asociadas.')
    }

    const { error } = await supabaseClient.from('categories').delete().eq('id', id)

    if (error) {
      console.error(`Error eliminando categoría ${id}:`, error)
      throw new Error(this.translateDbError(error))
    }
  }

  /**
   * Traduce errores técnicos de PostgreSQL a mensajes claros para el usuario
   */
  private translateDbError(error: any): string {
    const msg = error?.message || ''
    if (msg.includes('categories_company_id_slug_key')) {
      return 'Ya existe una categoría con este slug en su empresa.'
    }
    if (msg.includes('categories_company_id_code_key')) {
      return 'Ya existe una categoría con este código en su empresa.'
    }
    if (msg.includes('Violación multiempresa')) {
      return 'No se puede asociar una categoría padre de otra empresa.'
    }
    if (msg.includes('no puede ser su propia categoría padre')) {
      return 'Una categoría no puede asignarse a sí misma como categoría padre.'
    }
    if (msg.includes('foreign key constraint') || msg.includes('violates foreign key')) {
      return 'No se puede realizar la operación porque la categoría tiene registros dependientes.'
    }
    if (msg.includes('row-level security') || msg.includes('permission denied')) {
      return 'No tienes permisos suficientes para realizar esta acción sobre la categoría.'
    }
    return msg || 'Ocurrió un error inesperado al procesar la categoría.'
  }
}

export const categoryRepository = new CategoryRepository()
