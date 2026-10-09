/**
 * SUPER MÁS ERP/POS - Servicio de Catálogo Público para Integraciones Externas
 *
 * Expone productos sanitizados para Catálogo Super Más (B2C) y Catálogo Distribuidora (B2B).
 *
 * REGLAS DE SEGURIDAD CRÍTICAS:
 * - Sanitiza y elimina costos, márgenes, compras, proveedores y existencias numéricas.
 * - Solo devuelve availability: AVAILABLE | LOW_STOCK | OUT_OF_STOCK.
 * - Resuelve el company_id activo sin requerir sesión administrativa del ERP.
 */

import { supabaseAdmin } from '@/lib/supabase/admin'
import { superCatalogRepository } from '@/features/super-catalog/repositories/super-catalog.repository'
import { distributorCatalogRepository } from '@/features/distributor-catalog/repositories/distributor-catalog.repository'
import { SuperCatalogProduct } from '@/features/super-catalog/types'
import { DistributorCatalogProduct } from '@/features/distributor-catalog/types'
import {
  PublicSuperCatalogProduct,
  PublicDistributorCatalogProduct,
  PublicCatalogListResponse,
  PublicProductDetailResponse,
  PublicCatalogFilters,
  PublicCatalogPagination,
} from '../types'

export class PublicCatalogService {
  /**
   * Resuelve el company_id activo para consumo público.
   * Si no se especifica en la petición, selecciona la primera empresa activa en PostgreSQL.
   */
  async resolveCompanyId(preferredCompanyId?: string): Promise<string | null> {
    if (preferredCompanyId && preferredCompanyId.trim().length > 0) {
      return preferredCompanyId.trim()
    }

    try {
      const { data, error } = await supabaseAdmin
        .from('companies')
        .select('id')
        .eq('status', 'ACTIVE')
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle()

      if (error || !data?.id) {
        return null
      }
      return data.id
    } catch {
      return null
    }
  }

  /**
   * Sanitiza un producto de Catálogo Super Más eliminando métricas internas y desglose de bodegas.
   */
  private sanitizeSuperCatalogProduct(prod: SuperCatalogProduct): PublicSuperCatalogProduct {
    return {
      id: prod.id,
      sku: prod.sku,
      barcode: prod.barcode || '',
      name: prod.name,
      slug: prod.slug,
      description: prod.description || '',
      category: prod.category,
      brand: prod.brand,
      unitOfMeasure: prod.unitOfMeasure,
      imageUrl: prod.imageUrl,
      images: prod.images || [],
      price: prod.price,
      showPrice: prod.showPrice,
      vatRatePercent: prod.vatRatePercent,
      isExempt: prod.isExempt,
      availability: prod.availability,
      availabilityLabel: prod.availabilityLabel,
      canBuyDirectly: prod.canBuyDirectly,
      updatedAt: prod.updatedAt,
    }
  }

  /**
   * Sanitiza un producto de Catálogo Distribuidora eliminando cualquier metadato sensible interno.
   */
  private sanitizeDistributorCatalogProduct(prod: DistributorCatalogProduct): PublicDistributorCatalogProduct {
    return {
      id: prod.id,
      sku: prod.sku,
      barcode: prod.barcode || '',
      name: prod.name,
      slug: prod.slug,
      description: prod.description || '',
      category: prod.category,
      brand: prod.brand,
      unitOfMeasure: prod.unitOfMeasure,
      imageUrl: prod.imageUrl,
      images: prod.images || [],
      distributorPrice: prod.distributorPrice,
      normalPrice: prod.normalPrice,
      availability: prod.availability,
      availabilityLabel: prod.availabilityLabel,
      canBuyDirectly: prod.canBuyDirectly,
      canContactWhatsApp: prod.canContactWhatsApp,
      whatsappUrl: prod.whatsappUrl,
      updatedAt: prod.updatedAt,
    }
  }

  /**
   * Consulta paginada y filtrada del Catálogo Super Más (B2C)
   */
  async getSuperMasCatalog(
    filters: PublicCatalogFilters = {}
  ): Promise<PublicCatalogListResponse<PublicSuperCatalogProduct>> {
    const companyId = await this.resolveCompanyId(filters.companyId)

    if (!companyId) {
      return {
        success: true,
        channel: 'supermas',
        data: [],
        pagination: {
          total: 0,
          page: filters.page || 1,
          pageSize: filters.pageSize || 12,
          totalPages: 0,
          hasNextPage: false,
          hasPrevPage: false,
        },
      }
    }

    const pageSize = filters.pageSize && filters.pageSize > 0 ? filters.pageSize : 12
    const page = filters.page && filters.page > 0 ? filters.page : 1

    const result = await superCatalogRepository.findAll(
      {
        search: filters.search,
        category: filters.category,
        brand: filters.brand,
        availability: filters.availability,
        catalogStatus: 'PUBLISHED',
        purchaseStatus: filters.directPurchase === true ? 'ENABLED' : 'ALL',
        priceMin: filters.minPrice,
        priceMax: filters.maxPrice,
        sortBy: filters.sortBy || 'name',
        sortOrder: filters.sortOrder || 'asc',
        page,
        pageSize,
      },
      companyId
    )

    const totalPages = Math.max(1, Math.ceil(result.total / pageSize))
    const sanitizedData = result.products.map((p) => this.sanitizeSuperCatalogProduct(p))

    return {
      success: true,
      channel: 'supermas',
      data: sanitizedData,
      pagination: {
        total: result.total,
        page,
        pageSize,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    }
  }

  /**
   * Consulta el detalle de un producto por slug o id en Catálogo Super Más
   */
  async getSuperMasProduct(
    identifier: string,
    preferredCompanyId?: string
  ): Promise<PublicSuperCatalogProduct | null> {
    const companyId = await this.resolveCompanyId(preferredCompanyId)
    if (!companyId || !identifier) return null

    // 1. Intentar por slug
    let product = await superCatalogRepository.findBySlug(identifier, companyId)

    // 2. Si no se encuentra por slug, intentar por ID
    if (!product) {
      const byId = await superCatalogRepository.findById(identifier, companyId)
      if (byId && byId.webSuperMas) {
        product = byId
      }
    }

    if (!product || !product.webSuperMas) return null
    return this.sanitizeSuperCatalogProduct(product)
  }

  /**
   * Consulta paginada y filtrada del Catálogo Distribuidora (B2B)
   */
  async getDistributorCatalog(
    filters: PublicCatalogFilters = {}
  ): Promise<PublicCatalogListResponse<PublicDistributorCatalogProduct>> {
    const companyId = await this.resolveCompanyId(filters.companyId)

    if (!companyId) {
      return {
        success: true,
        channel: 'distributor',
        data: [],
        pagination: {
          total: 0,
          page: filters.page || 1,
          pageSize: filters.pageSize || 12,
          totalPages: 0,
          hasNextPage: false,
          hasPrevPage: false,
        },
      }
    }

    const pageSize = filters.pageSize && filters.pageSize > 0 ? filters.pageSize : 12
    const page = filters.page && filters.page > 0 ? filters.page : 1

    const result = await distributorCatalogRepository.findAll(
      {
        search: filters.search,
        category: filters.category,
        brand: filters.brand,
        availability: filters.availability,
        distributorStatus: 'PUBLISHED',
        directPurchase: filters.directPurchase === true ? 'ENABLED' : 'ALL',
        sortBy: filters.sortBy || 'name',
        sortOrder: filters.sortOrder || 'asc',
        page,
        pageSize,
      },
      companyId
    )

    const totalPages = Math.max(1, Math.ceil(result.total / pageSize))
    const sanitizedData = result.products.map((p) => this.sanitizeDistributorCatalogProduct(p))

    return {
      success: true,
      channel: 'distributor',
      data: sanitizedData,
      pagination: {
        total: result.total,
        page,
        pageSize,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    }
  }

  /**
   * Consulta el detalle de un producto por slug o id en Catálogo Distribuidora
   */
  async getDistributorProduct(
    identifier: string,
    preferredCompanyId?: string
  ): Promise<PublicDistributorCatalogProduct | null> {
    const companyId = await this.resolveCompanyId(preferredCompanyId)
    if (!companyId || !identifier) return null

    // 1. Intentar por slug
    let product = await distributorCatalogRepository.findBySlug(identifier, companyId)

    // 2. Si no se encuentra por slug, intentar por ID
    if (!product) {
      const byId = await distributorCatalogRepository.findById(identifier, companyId)
      if (byId && byId.webDistribuidora) {
        product = byId
      }
    }

    if (!product || !product.webDistribuidora) return null
    return this.sanitizeDistributorCatalogProduct(product)
  }

  /**
   * Retorna las categorías disponibles para el canal solicitado
   */
  async getCategories(channel: 'supermas' | 'distributor' = 'supermas', preferredCompanyId?: string): Promise<string[]> {
    const companyId = await this.resolveCompanyId(preferredCompanyId)
    if (!companyId) return []

    if (channel === 'supermas') {
      return superCatalogRepository.getCategories(companyId)
    }
    return distributorCatalogRepository.getCategories(companyId)
  }

  /**
   * Retorna las marcas disponibles para el canal solicitado
   */
  async getBrands(channel: 'supermas' | 'distributor' = 'supermas', preferredCompanyId?: string): Promise<string[]> {
    const companyId = await this.resolveCompanyId(preferredCompanyId)
    if (!companyId) return []

    if (channel === 'supermas') {
      return superCatalogRepository.getBrands(companyId)
    }
    return distributorCatalogRepository.getBrands(companyId)
  }
}

export const publicCatalogService = new PublicCatalogService()
