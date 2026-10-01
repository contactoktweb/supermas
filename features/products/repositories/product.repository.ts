/**
 * SUPER MÁS ERP/POS — Repositorio de Productos (ProductRepository)
 *
 * Conectado directamente a public.products en Supabase/PostgreSQL.
 * Respeta Row Level Security (RLS) y aislamiento multiempresa por company_id.
 * No inserta directamente en audit_logs (PostgreSQL lo audita automáticamente vía trigger 029).
 */

import { supabaseClient } from '@/lib/supabase/client'
import {
  Product,
  ProductFilterParams,
  GlobalProductsStats,
  PaginatedProductsResponse,
  CreateProductInput,
  UpdateProductInput,
  TaxRateConfig,
  ProductMovementSummary,
  PriceTier,
  ProductPrice,
} from '../types'

function mapDbToDomain(row: any): Product {
  const categoryRel = row.categories || row.category || null
  const brandRel = row.brands || row.brand || null

  const costPrice = Number(row.cost_price ?? 0)
  const publicSalePrice = Number(row.public_sale_price ?? 0)
  const wholesalePrice = Number(row.wholesale_price ?? 0)
  const taxRatePercent = Number(row.tax_rate_percent ?? 19)
  const isTaxExempt = Boolean(row.is_tax_exempt)

  // Margen de utilidad sobre precio antes de impuestos
  const basePrice = taxRatePercent > 0 ? publicSalePrice / (1 + taxRatePercent / 100) : publicSalePrice
  const profitMarginAmount = basePrice - costPrice
  const profitMarginPercent = basePrice > 0 ? (profitMarginAmount / basePrice) * 100 : 0

  // Existencias calculadas si existen stock_levels unidos
  let totalStock = 0
  const warehouseStock: any[] = []
  if (Array.isArray(row.stock_levels)) {
    row.stock_levels.forEach((sl: any) => {
      const qty = Number(sl.quantity || 0)
      totalStock += qty
      warehouseStock.push({
        locationId: sl.location_id,
        quantity: qty,
        averageCost: costPrice,
      })
    })
  }

  const minStock = Number(row.min_stock_threshold ?? 10)
  const criticalStock = Number(row.critical_stock_threshold ?? 5)

  const stockHealth =
    totalStock <= 0
      ? 'OUT_OF_STOCK'
      : totalStock <= criticalStock
      ? 'CRITICAL'
      : totalStock <= minStock
      ? 'LOW_STOCK'
      : 'AVAILABLE'

  const webAvailability =
    totalStock <= 0 ? 'OUT_OF_STOCK' : totalStock <= 5 ? 'LOW_STOCK' : 'AVAILABLE'

  const description = row.full_description || row.short_description || ''

  const rawPrices = Array.isArray(row.product_prices) ? row.product_prices : []
    let mappedPrices: PriceTier[] = []

    if (rawPrices.length > 0) {
      mappedPrices = rawPrices.map((pp: any) => ({
        id: pp.id,
        name: pp.price_list_name,
        code: pp.price_list_code,
        price: Number(pp.price ?? 0),
        minQuantity: Number(pp.min_quantity ?? 1),
        isDefault: Boolean(pp.is_default),
        isActive: Boolean(pp.is_active),
        startDate: pp.start_date || null,
        endDate: pp.end_date || null,
      }))
    } else {
      mappedPrices = [
        {
          id: 'tier-normal',
          name: 'Precio Normal (Público)',
          code: 'NORMAL',
          price: publicSalePrice,
          minQuantity: 1,
          isDefault: true,
          isActive: true,
        },
        {
          id: 'tier-mayorista',
          name: 'Precio Mayorista',
          code: 'MAYORISTA',
          price: wholesalePrice,
          minQuantity: Number(row.min_wholesale_quantity ?? 6),
          isDefault: false,
          isActive: true,
        },
      ]
    }

    const defaultPriceItem = mappedPrices.find((p) => p.code === 'NORMAL' || p.isDefault)
    const mayoristaPriceItem = mappedPrices.find((p) => p.code === 'MAYORISTA')
    const distributorPriceItem = mappedPrices.find((p) => p.code === 'DISTRIBUIDOR')

    const resolvedNormalPrice = defaultPriceItem?.price ?? publicSalePrice
    const resolvedWholesalePrice = mayoristaPriceItem?.price ?? wholesalePrice
    const resolvedDistributorPrice = distributorPriceItem?.price ?? 0

    return {
      id: row.id,
      companyId: row.company_id,
      categoryId: row.category_id,
      brandId: row.brand_id,

      sku: row.sku,
      barcode: row.barcode || '',
      name: row.name,
      slug: row.slug,
      shortDescription: row.short_description || '',
      fullDescription: row.full_description || '',
      unitOfMeasure: row.unit_of_measure || 'UND',

      costPrice,
      publicSalePrice: resolvedNormalPrice,
      wholesalePrice: resolvedWholesalePrice,
      minWholesaleQuantity: Number(row.min_wholesale_quantity ?? 6),
      taxRatePercent,
      isTaxExempt,

      primaryImageUrl: row.primary_image_url || '',
      secondaryImages: Array.isArray(row.secondary_images) ? row.secondary_images : [],

      minStockThreshold: minStock,
      criticalStockThreshold: criticalStock,

      isActive: Boolean(row.is_active),
      isPublishedSupermas: Boolean(row.is_published_supermas),
      isPublishedDistributor: Boolean(row.is_published_distributor),
      inventoryType: row.inventory_type || 'MERCHANDISE',
      accountingCategoryId: row.accounting_category_id || null,

      createdAt: row.created_at,
      updatedAt: row.updated_at,

      category: categoryRel
        ? {
            id: categoryRel.id,
            name: categoryRel.name,
            code: categoryRel.code || undefined,
            slug: categoryRel.slug || undefined,
          }
        : null,
      brand: brandRel
        ? {
            id: brandRel.id,
            name: brandRel.name,
            slug: brandRel.slug || undefined,
          }
        : null,
      categoryName: categoryRel?.name || '—',
      brandName: brandRel?.name || '—',

      imageUrl:
        row.primary_image_url ||
        'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=400&auto=format&fit=crop&q=80',
      images: Array.isArray(row.secondary_images) ? row.secondary_images : [],
      description,
      status: row.is_active ? 'ACTIVE' : 'INACTIVE',
      taxProfile: isTaxExempt
        ? 'EXENTO'
        : taxRatePercent === 5
        ? 'IVA_5'
        : taxRatePercent === 0
        ? 'IVA_0'
        : 'IVA_19',
      vatRatePercent: taxRatePercent,
      isExempt: isTaxExempt,

      prices: mappedPrices,
      normalPrice: resolvedNormalPrice,
      distributorPrice: resolvedDistributorPrice,
      averageCost: costPrice,
      inventoryValueAtCost: totalStock * costPrice,
      profitMarginAmount,
      profitMarginPercent,
      totalStock,
      availableUnits: totalStock,
      stockHealth,
      webSuperMas: Boolean(row.is_published_supermas),
      webDistribuidora: Boolean(row.is_published_distributor),
      webAvailability,
      warehouseStock,
    }
}

export class ProductRepository {
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

    throw new Error('No se pudo determinar la empresa asociada (company_id) para el producto.')
  }

  /**
   * Consulta productos bajo RLS en Supabase, aplicando filtros, paginación y ordenamiento.
   */
  async findAll(params: ProductFilterParams = {}): Promise<PaginatedProductsResponse> {
    let query = supabaseClient.from('products').select(
      `
        *,
        categories ( id, name, slug, code ),
        brands ( id, name, slug ),
        stock_levels ( quantity, location_id ),
        product_prices ( * )
      `,
      { count: 'exact' }
    )

    // 1. Text Search (name, sku, barcode)
    if (params.query && params.query.trim()) {
      const q = params.query.trim().replace(/[%_]/g, '')
      if (q) {
        query = query.or(`name.ilike.%${q}%,sku.ilike.%${q}%,barcode.ilike.%${q}%`)
      }
    }

    // 2. Category Filter (UUID)
    if (params.categoryId && params.categoryId !== 'ALL') {
      query = query.eq('category_id', params.categoryId)
    }

    // 3. Brand Filter (UUID)
    if (params.brandId && params.brandId !== 'ALL') {
      query = query.eq('brand_id', params.brandId)
    }

    // 4. Status Filter
    if (params.status && params.status !== 'ALL') {
      query = query.eq('is_active', params.status === 'ACTIVE')
    }

    // 5. Web Channel Filter
    if (params.webChannel && params.webChannel !== 'ALL') {
      if (params.webChannel === 'SUPER_MAS') {
        query = query.eq('is_published_supermas', true)
      } else if (params.webChannel === 'DISTRIBUIDORA') {
        query = query.eq('is_published_distributor', true)
      } else if (params.webChannel === 'BOTH') {
        query = query.eq('is_published_supermas', true).eq('is_published_distributor', true)
      } else if (params.webChannel === 'NONE') {
        query = query.eq('is_published_supermas', false).eq('is_published_distributor', false)
      }
    }

    // 6. Sorting
    const sortDir = params.sortDirection || 'asc'
    const ascending = sortDir === 'asc'

    switch (params.sortField) {
      case 'sku':
        query = query.order('sku', { ascending })
        break
      case 'averageCost':
        query = query.order('cost_price', { ascending })
        break
      case 'normalPrice':
        query = query.order('public_sale_price', { ascending })
        break
      case 'wholesalePrice':
        query = query.order('wholesale_price', { ascending })
        break
      case 'name':
      default:
        query = query.order('name', { ascending })
        break
    }

    // 7. Pagination
    const page = Math.max(1, params.page || 1)
    const pageSize = Math.max(1, params.pageSize || 10)
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    query = query.range(from, to)

    const { data: rows, count, error } = await query

    if (error) {
      console.error('Error listando productos desde Supabase:', error)
      throw new Error(this.translateDbError(error))
    }

    const total = count ?? (rows?.length || 0)
    const totalPages = Math.max(1, Math.ceil(total / pageSize))
    const items = (rows || []).map(mapDbToDomain)

    return {
      items,
      total,
      page,
      pageSize,
      totalPages,
      isCostRedacted: false,
    }
  }

  /**
   * Obtiene un producto por ID con relaciones
   */
  async findById(id: string): Promise<Product | null> {
    const { data: row, error } = await supabaseClient
      .from('products')
      .select(`
        *,
        categories ( id, name, slug, code ),
        brands ( id, name, slug ),
        stock_levels ( quantity, location_id ),
        product_prices ( * )
      `)
      .eq('id', id)
      .maybeSingle()

    if (error || !row) return null
    return mapDbToDomain(row)
  }

  /**
   * Busca si existe un producto por SKU dentro de la empresa
   */
  async findBySku(sku: string, companyId?: string): Promise<Product | null> {
    const resolvedCompanyId = await this.resolveCompanyId(companyId)
    const { data: row, error } = await supabaseClient
      .from('products')
      .select(`
        *,
        categories ( id, name, slug, code ),
        brands ( id, name, slug ),
        stock_levels ( quantity, location_id ),
        product_prices ( * )
      `)
      .eq('company_id', resolvedCompanyId)
      .ilike('sku', sku.trim())
      .maybeSingle()

    if (error || !row) return null
    return mapDbToDomain(row)
  }

  /**
   * Busca si existe un producto por código de barras dentro de la empresa
   */
  async findByBarcode(barcode: string, companyId?: string): Promise<Product | null> {
    if (!barcode.trim()) return null
    const resolvedCompanyId = await this.resolveCompanyId(companyId)
    const { data: row, error } = await supabaseClient
      .from('products')
      .select(`
        *,
        categories ( id, name, slug, code ),
        brands ( id, name, slug ),
        stock_levels ( quantity, location_id ),
        product_prices ( * )
      `)
      .eq('company_id', resolvedCompanyId)
      .eq('barcode', barcode.trim())
      .maybeSingle()

    if (error || !row) return null
    return mapDbToDomain(row)
  }


  /**
   * Inserta un nuevo producto en public.products bajo RLS.
   * La auditoría es generada automáticamente por el trigger fn_audit_products() (029).
   */
  async create(
    data: CreateProductInput | (Partial<Product> & { name: string; sku: string; categoryId: string; brandId: string }),
    companyId?: string
  ): Promise<Product> {
    const resolvedCompanyId = await this.resolveCompanyId(companyId)

    const normalPrice =
      (data as any).publicSalePrice ??
      (data as any).normalPrice ??
      (data as any).prices?.find((p: any) => p.code === 'NORMAL')?.price ??
      0

    const wholesalePrice =
      (data as any).wholesalePrice ??
      (data as any).prices?.find((p: any) => p.code === 'MAYORISTA')?.price ??
      normalPrice

    const costPrice =
      (data as any).costPrice ??
      (data as any).averageCost ??
      (data as any).estimatedCost ??
      0

    const taxRatePercent =
      (data as any).taxRatePercent ?? (data as any).vatRatePercent ?? 19

    const isTaxExempt =
      (data as any).isTaxExempt ??
      ((data as any).taxProfile === 'EXENTO' || (data as any).taxProfile === 'EXCLUIDO') ??
      false

    const rawSlug = (data as any).slug ? (data as any).slug.trim() : this.slugify(data.name)

    const insertPayload = {
      company_id: resolvedCompanyId,
      category_id: data.categoryId,
      brand_id: data.brandId,
      sku: data.sku.trim().toUpperCase(),
      barcode: data.barcode?.trim() || null,
      name: data.name.trim(),
      slug: rawSlug,
      short_description:
        (data as any).shortDescription?.trim() || (data as any).description?.trim() || null,
      full_description:
        (data as any).fullDescription?.trim() || (data as any).description?.trim() || null,
      unit_of_measure: data.unitOfMeasure || 'UND',
      cost_price: costPrice,
      public_sale_price: normalPrice,
      wholesale_price: wholesalePrice,
      min_wholesale_quantity: (data as any).minWholesaleQuantity ?? 12,
      tax_rate_percent: taxRatePercent,
      is_tax_exempt: isTaxExempt,
      primary_image_url:
        (data as any).primaryImageUrl?.trim() || (data as any).imageUrl?.trim() || null,
      secondary_images: (data as any).secondaryImages || (data as any).images || [],
      min_stock_threshold: (data as any).minStockThreshold ?? 10,
      critical_stock_threshold: (data as any).criticalStockThreshold ?? 5,
      is_active:
        (data as any).isActive !== undefined
          ? (data as any).isActive
          : (data as any).status !== 'INACTIVE',
      is_published_supermas:
        (data as any).isPublishedSupermas ?? (data as any).webSuperMas ?? true,
      is_published_distributor:
        (data as any).isPublishedDistributor ?? (data as any).webDistribuidora ?? true,
      inventory_type: (data as any).inventoryType || 'MERCHANDISE',
      accounting_category_id: (data as any).accountingCategoryId || null,
    }

    const { data: createdRow, error } = await supabaseClient
      .from('products')
      .insert(insertPayload)
      .select()
      .single()

    if (error) {
      console.error('Error insertando producto en Supabase:', error)
      throw new Error(this.translateDbError(error))
    }

    // Persistir listas de precios reales en public.product_prices vinculadas por product_id
    const pricesToPersist: any[] = []
    if (Array.isArray(data.prices) && data.prices.length > 0) {
      data.prices.forEach((p) => {
        pricesToPersist.push({
          company_id: resolvedCompanyId,
          product_id: createdRow.id,
          price_list_code: p.code.trim().toUpperCase(),
          price_list_name: p.name.trim(),
          price: Number(p.price ?? 0),
          min_quantity: Number(p.minQuantity ?? 1),
          is_default: Boolean(p.isDefault ?? (p.code.toUpperCase() === 'NORMAL')),
          is_active: Boolean(p.isActive !== undefined ? p.isActive : (p.price > 0 || p.code.toUpperCase() === 'NORMAL')),
          start_date: p.startDate || null,
          end_date: p.endDate || null,
        })
      })
    } else {
      pricesToPersist.push(
        {
          company_id: resolvedCompanyId,
          product_id: createdRow.id,
          price_list_code: 'NORMAL',
          price_list_name: 'Precio Normal (Público)',
          price: normalPrice,
          min_quantity: 1,
          is_default: true,
          is_active: true,
        },
        {
          company_id: resolvedCompanyId,
          product_id: createdRow.id,
          price_list_code: 'MAYORISTA',
          price_list_name: 'Precio Mayorista',
          price: wholesalePrice,
          min_quantity: Number((data as any).minWholesaleQuantity ?? 6),
          is_default: false,
          is_active: true,
        }
      )
    }

    if (pricesToPersist.length > 0) {
      const { error: pricesErr } = await supabaseClient
        .from('product_prices')
        .upsert(pricesToPersist, { onConflict: 'product_id,price_list_code' })

      if (pricesErr) {
        console.error('Error insertando product_prices en Supabase:', pricesErr)
        throw new Error(this.translateDbError(pricesErr))
      }
    }

    // Registrar inventario inicial en public.inventory_movements (Kardex inmutable)
    if (Array.isArray((data as any).initialStock) && (data as any).initialStock.length > 0) {
      const { data: authUser } = await supabaseClient.auth.getUser()
      const currentUserId = authUser?.user?.id || null

      for (const stockItem of (data as any).initialStock) {
        const qty = Number(stockItem.quantity || 0)
        if (qty > 0 && stockItem.locationId) {
          const itemCost = Number(
            stockItem.unitCost !== undefined && stockItem.unitCost !== null && stockItem.unitCost > 0
              ? stockItem.unitCost
              : costPrice
          )
          const totalCost = qty * itemCost

          const movementPayload = {
            company_id: resolvedCompanyId,
            product_id: createdRow.id,
            location_id: stockItem.locationId,
            movement_type: 'POSITIVE_ADJUSTMENT',
            quantity_in: qty,
            quantity_out: 0,
            previous_stock: 0,
            new_stock: qty,
            unit_cost: itemCost,
            total_cost: totalCost,
            document_type: 'INVENTARIO_INICIAL',
            document_reference: `INV-INI-${createdRow.sku}`,
            reason: 'Inventario inicial al registrar el producto',
            user_id: currentUserId,
          }

          const { error: movErr } = await supabaseClient
            .from('inventory_movements')
            .insert(movementPayload)

          if (movErr) {
            console.error('Error al registrar inventario inicial en public.inventory_movements:', movErr)
          }
        }
      }
    }

    const createdProduct = await this.findById(createdRow.id)
    return createdProduct || mapDbToDomain({ ...createdRow, product_prices: pricesToPersist })
  }

  async resetMocks(): Promise<void> {
    // Compatibilidad no-op para repositorios reales
  }

  /**
   * Actualiza un producto en public.products bajo RLS.
   * La auditoría es generada automáticamente por el trigger fn_audit_products() (029).
   */
  async update(id: string, updates: Partial<Product> | UpdateProductInput): Promise<Product> {
    const u = updates as any
    const updatePayload: Record<string, any> = {
      updated_at: new Date().toISOString(),
    }

    if (u.name !== undefined) updatePayload.name = u.name.trim()
    if (u.sku !== undefined) updatePayload.sku = u.sku.trim().toUpperCase()
    if (u.barcode !== undefined) updatePayload.barcode = u.barcode?.trim() || null
    if (u.slug !== undefined) updatePayload.slug = u.slug.trim()
    if (u.categoryId !== undefined) updatePayload.category_id = u.categoryId
    if (u.brandId !== undefined) updatePayload.brand_id = u.brandId

    if (u.shortDescription !== undefined || u.description !== undefined) {
      updatePayload.short_description =
        u.shortDescription?.trim() || u.description?.trim() || null
    }
    if (u.fullDescription !== undefined || u.description !== undefined) {
      updatePayload.full_description =
        u.fullDescription?.trim() || u.description?.trim() || null
    }
    if (u.unitOfMeasure !== undefined) updatePayload.unit_of_measure = u.unitOfMeasure

    if (u.costPrice !== undefined) updatePayload.cost_price = u.costPrice
    else if (u.estimatedCost !== undefined) updatePayload.cost_price = u.estimatedCost
    else if (u.averageCost !== undefined) updatePayload.cost_price = u.averageCost

    if (u.publicSalePrice !== undefined) updatePayload.public_sale_price = u.publicSalePrice
    else if (u.normalPrice !== undefined) updatePayload.public_sale_price = u.normalPrice

    if (u.wholesalePrice !== undefined) updatePayload.wholesale_price = u.wholesalePrice
    if (u.minWholesaleQuantity !== undefined)
      updatePayload.min_wholesale_quantity = u.minWholesaleQuantity

    if (u.taxRatePercent !== undefined) updatePayload.tax_rate_percent = u.taxRatePercent
    else if (u.vatRatePercent !== undefined) updatePayload.tax_rate_percent = u.vatRatePercent

    if (u.isTaxExempt !== undefined) updatePayload.is_tax_exempt = u.isTaxExempt
    else if (u.taxProfile !== undefined) {
      updatePayload.is_tax_exempt =
        u.taxProfile === 'EXENTO' || u.taxProfile === 'EXCLUIDO'
    }

    if (u.primaryImageUrl !== undefined)
      updatePayload.primary_image_url = u.primaryImageUrl?.trim() || null
    else if (u.imageUrl !== undefined)
      updatePayload.primary_image_url = u.imageUrl?.trim() || null

    if (u.secondaryImages !== undefined)
      updatePayload.secondary_images = u.secondaryImages
    else if (u.images !== undefined) updatePayload.secondary_images = u.images

    if (u.minStockThreshold !== undefined)
      updatePayload.min_stock_threshold = u.minStockThreshold
    if (u.criticalStockThreshold !== undefined)
      updatePayload.critical_stock_threshold = u.criticalStockThreshold

    if (u.isActive !== undefined) updatePayload.is_active = u.isActive
    else if (u.status !== undefined) updatePayload.is_active = u.status === 'ACTIVE'

    if (u.isPublishedSupermas !== undefined)
      updatePayload.is_published_supermas = u.isPublishedSupermas
    else if (u.webSuperMas !== undefined)
      updatePayload.is_published_supermas = u.webSuperMas

    if (u.isPublishedDistributor !== undefined)
      updatePayload.is_published_distributor = u.isPublishedDistributor
    else if (u.webDistribuidora !== undefined)
      updatePayload.is_published_distributor = u.webDistribuidora

    const { data: updatedRow, error } = await supabaseClient
      .from('products')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error(`Error actualizando producto ${id} en Supabase:`, error)
      throw new Error(this.translateDbError(error))
    }

    // Sincronizar listas de precios en public.product_prices si se proveen
    if (Array.isArray(u.prices) && u.prices.length > 0) {
      const resolvedCompanyId = updatedRow.company_id || (await this.resolveCompanyId())
      const pricesToUpsert = u.prices.map((p: any) => ({
        company_id: resolvedCompanyId,
        product_id: id,
        price_list_code: p.code.trim().toUpperCase(),
        price_list_name: p.name.trim(),
        price: Number(p.price ?? 0),
        min_quantity: Number(p.minQuantity ?? 1),
        is_default: Boolean(p.isDefault ?? (p.code.toUpperCase() === 'NORMAL')),
        is_active: Boolean(p.isActive !== undefined ? p.isActive : (p.price > 0 || p.code.toUpperCase() === 'NORMAL')),
        start_date: p.startDate || null,
        end_date: p.endDate || null,
        updated_at: new Date().toISOString(),
      }))

      const { error: pricesErr } = await supabaseClient
        .from('product_prices')
        .upsert(pricesToUpsert, { onConflict: 'product_id,price_list_code' })

      if (pricesErr) {
        console.error('Error actualizando product_prices en Supabase:', pricesErr)
        throw new Error(this.translateDbError(pricesErr))
      }
    }

    const reloaded = await this.findById(id)
    return reloaded || mapDbToDomain(updatedRow)
  }

  /**
   * Desactivación segura (is_active = false)
   */
  async softDelete(id: string): Promise<Product> {
    return this.update(id, {
      isActive: false,
      status: 'INACTIVE',
      isPublishedSupermas: false,
      isPublishedDistributor: false,
    })
  }

  /**
   * Eliminación física (utilizada exclusivamente para limpieza Zero Pollution en pruebas)
   */
  async delete(id: string): Promise<void> {
    const { error } = await supabaseClient
      .from('products')
      .delete()
      .eq('id', id)

    if (error) {
      console.error(`Error eliminando producto ${id} en Supabase:`, error)
      throw new Error(this.translateDbError(error))
    }
  }

  /**
   * Obtiene estadísticas agregadas de catálogo desde public.products bajo RLS
   */
  async getGlobalStats(): Promise<GlobalProductsStats> {
    const { data: rows, error } = await supabaseClient
      .from('products')
      .select('id, is_active, is_published_supermas, is_published_distributor, cost_price, min_stock_threshold, critical_stock_threshold, stock_levels(quantity)')

    if (error) {
      console.error('Error obteniendo estadísticas de productos:', error)
      return {
        totalProducts: 0,
        activeProducts: 0,
        outOfStockProducts: 0,
        lowStockProducts: 0,
        totalInventoryValueAtCost: 0,
        webPublishedProducts: 0,
        isCostRedacted: false,
      }
    }

    const totalProducts = rows?.length || 0
    const activeProducts = rows?.filter((p: any) => p.is_active).length || 0
    let outOfStockProducts = 0
    let lowStockProducts = 0
    let totalInventoryValueAtCost = 0
    let webPublishedProducts = 0

    rows?.forEach((p: any) => {
      if (p.is_published_supermas || p.is_published_distributor) {
        webPublishedProducts++
      }
      let stock = 0
      if (Array.isArray(p.stock_levels)) {
        stock = p.stock_levels.reduce((acc: number, sl: any) => acc + Number(sl.quantity || 0), 0)
      }
      if (stock === 0) {
        outOfStockProducts++
      } else if (stock <= Number(p.min_stock_threshold || 10)) {
        lowStockProducts++
      }
      totalInventoryValueAtCost += stock * Number(p.cost_price || 0)
    })

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

  /**
   * Obtiene las listas de precios asociadas desde public.product_prices
   */
  async getPrices(productId: string): Promise<any[]> {
    const { data: rawPrices, error } = await supabaseClient
      .from('product_prices')
      .select('*')
      .eq('product_id', productId)
    if (error) {
      console.warn('Error consultando product_prices:', error.message)
      return []
    }
    return rawPrices || []
  }

  /**
   * Obtiene el desglose de existencias multibodega desde public.stock_levels
   */
  async getStockLevels(productId: string): Promise<any[]> {
    const { data: rawStock, error } = await supabaseClient
      .from('stock_levels')
      .select('*, locations(id, name, code, type)')
      .eq('product_id', productId)
    if (error) {
      console.warn('Error consultando stock_levels:', error.message)
      return []
    }
    return rawStock || []
  }

  /**
   * Consulta las tarifas impositivas activas directamente desde public.tax_rates en Supabase.
   */
  async getTaxRates(): Promise<TaxRateConfig[]> {
    const { data, error } = await supabaseClient
      .from('tax_rates')
      .select('*')
      .eq('is_active', true)
      .order('percentage', { ascending: false })

    if (error) {
      console.error('Error consultando public.tax_rates:', error)
      return []
    }

    return (data || []).map((t: any) => ({
      id: t.id,
      code: t.code,
      name: t.name,
      ratePercent: Number(t.percentage ?? 0),
      percentage: Number(t.percentage ?? 0),
      type: t.type,
      isActive: Boolean(t.is_active),
      isDefault: t.code === 'IVA_19',
    }))
  }

  /**
   * Consulta los movimientos de Kardex históricos del producto desde public.inventory_movements.
   */
  async getProductMovements(productId: string): Promise<ProductMovementSummary[]> {
    const { data, error } = await supabaseClient
      .from('inventory_movements')
      .select('id, created_at, movement_type, quantity, unit_cost, previous_balance, new_balance, document_number, locations(name), users(full_name)')
      .eq('product_id', productId)
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) {
      console.warn('Error consultando public.inventory_movements:', error.message)
      return []
    }

    return (data || []).map((m: any) => ({
      id: m.id,
      timestamp: m.created_at,
      type: m.movement_type,
      quantity: Number(m.quantity ?? 0),
      unitCost: Number(m.unit_cost ?? 0),
      previousBalance: Number(m.previous_balance ?? 0),
      newBalance: Number(m.new_balance ?? 0),
      documentRef: m.document_number || 'N/A',
      locationName: m.locations?.name || 'Bodega General',
      userName: m.users?.full_name || 'Sistema',
    }))
  }

  /**
   * Obtiene todas las listas de precios reales de un producto desde public.product_prices
   */
  async getProductPrices(productId: string): Promise<ProductPrice[]> {
    const { data, error } = await supabaseClient
      .from('product_prices')
      .select('*')
      .eq('product_id', productId)
      .order('is_default', { ascending: false })
      .order('price', { ascending: true })

    if (error) {
      console.error('Error consultando product_prices:', error)
      return []
    }

    return (data || []).map((pp: any) => ({
      id: pp.id,
      companyId: pp.company_id,
      productId: pp.product_id,
      priceListCode: pp.price_list_code,
      priceListName: pp.price_list_name,
      price: Number(pp.price ?? 0),
      minQuantity: Number(pp.min_quantity ?? 1),
      isDefault: Boolean(pp.is_default),
      isActive: Boolean(pp.is_active),
      startDate: pp.start_date || null,
      endDate: pp.end_date || null,
      createdAt: pp.created_at,
      updatedAt: pp.updated_at,
    }))
  }

  /**
   * Activa o desactiva una lista de precios específica
   */
  async togglePriceListActive(
    productId: string,
    priceListCode: string,
    isActive: boolean
  ): Promise<void> {
    const { error } = await supabaseClient
      .from('product_prices')
      .update({
        is_active: isActive,
        updated_at: new Date().toISOString(),
      })
      .eq('product_id', productId)
      .eq('price_list_code', priceListCode.trim().toUpperCase())

    if (error) {
      console.error('Error modificando estado de lista de precio:', error)
      throw new Error(this.translateDbError(error))
    }
  }

  private slugify(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
  }

  private translateDbError(error: any): string {
    const msg = error.message || ''
    const details = error.details || ''
    const code = error.code || ''

    if (code === '23505' || msg.includes('duplicate key') || details.includes('already exists')) {
      if (msg.includes('products_company_id_sku_key') || details.includes('sku') || msg.includes('sku')) {
        return 'Ya existe un producto con este SKU en su empresa.'
      }
      if (msg.includes('products_company_id_slug_key') || details.includes('slug') || msg.includes('slug')) {
        return 'Ya existe un producto con este slug o nombre en su empresa.'
      }
      if (msg.includes('products_barcode_key') || details.includes('barcode') || msg.includes('barcode')) {
        return 'El código de barras ya se encuentra registrado para otro producto.'
      }
      return 'Ya existe un producto con este identificador único en su empresa.'
    }

    if (code === '23503' || msg.includes('foreign key') || details.includes('violates foreign key constraint')) {
      if (msg.includes('category_id') || details.includes('categories')) {
        return 'La categoría seleccionada no existe o no es válida.'
      }
      if (msg.includes('brand_id') || details.includes('brands')) {
        return 'La marca seleccionada no existe o no es válida.'
      }
      if (msg.includes('company_id') || details.includes('companies')) {
        return 'La empresa asignada no es válida.'
      }
      return 'Referencia relacional inválida al guardar el producto.'
    }

    if (code === '42501' || msg.includes('row-level security') || msg.includes('permission denied')) {
      return 'No tiene permisos suficientes para realizar esta operación sobre los productos.'
    }

    return msg || 'Error desconocido al operar sobre el producto en base de datos.'
  }
}

export const productRepository = new ProductRepository()
