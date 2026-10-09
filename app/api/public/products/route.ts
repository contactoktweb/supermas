import { NextRequest } from 'next/server'
import { publicCatalogService } from '@/features/public-catalog/services/public-catalog.service'
import { handleCorsOptions, jsonResponse, errorResponse } from '@/features/public-catalog/utils/cors'
import { StockAvailabilityLevel } from '@/features/public-catalog/types'

export async function OPTIONS() {
  return handleCorsOptions()
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const channelParam = searchParams.get('channel') || searchParams.get('catalogo') || 'supermas'
    const channel = channelParam === 'distributor' || channelParam === 'distribuidora' ? 'distributor' : 'supermas'

    const companyId =
      searchParams.get('companyId') ||
      request.headers.get('x-company-id') ||
      undefined

    // Si se especifica slug o id, retornar el detalle de ese producto individual
    const slugOrId = searchParams.get('slug') || searchParams.get('id')
    if (slugOrId) {
      if (channel === 'supermas') {
        const product = await publicCatalogService.getSuperMasProduct(slugOrId, companyId)
        if (!product) {
          return errorResponse(`Producto "${slugOrId}" no encontrado en el Catálogo Super Más`, 404)
        }
        return jsonResponse({
          success: true,
          channel: 'supermas',
          data: product,
        })
      } else {
        const product = await publicCatalogService.getDistributorProduct(slugOrId, companyId)
        if (!product) {
          return errorResponse(`Producto "${slugOrId}" no encontrado en el Catálogo Distribuidora`, 404)
        }
        return jsonResponse({
          success: true,
          channel: 'distributor',
          data: product,
        })
      }
    }

    // Listado paginado con filtros
    const search = searchParams.get('search') || searchParams.get('q') || undefined
    const category = searchParams.get('category') || undefined
    const brand = searchParams.get('brand') || undefined
    const availability = (searchParams.get('availability') as StockAvailabilityLevel) || undefined
    const minPrice = searchParams.has('minPrice') ? Number(searchParams.get('minPrice')) : undefined
    const maxPrice = searchParams.has('maxPrice') ? Number(searchParams.get('maxPrice')) : undefined
    const directPurchase = searchParams.get('directPurchase') === 'true'
    const sortBy = (searchParams.get('sortBy') as 'name' | 'price' | 'sku') || 'name'
    const sortOrder = (searchParams.get('sortOrder') as 'asc' | 'desc') || 'asc'
    const page = searchParams.has('page') ? parseInt(searchParams.get('page')!, 10) : 1
    const pageSize = searchParams.has('limit')
      ? parseInt(searchParams.get('limit')!, 10)
      : searchParams.has('pageSize')
      ? parseInt(searchParams.get('pageSize')!, 10)
      : 12

    if (channel === 'supermas') {
      const result = await publicCatalogService.getSuperMasCatalog({
        search,
        category,
        brand,
        availability,
        minPrice,
        maxPrice,
        directPurchase: searchParams.has('directPurchase') ? directPurchase : undefined,
        sortBy,
        sortOrder,
        page,
        pageSize,
        companyId,
      })
      return jsonResponse(result)
    } else {
      const result = await publicCatalogService.getDistributorCatalog({
        search,
        category,
        brand,
        availability,
        directPurchase: searchParams.has('directPurchase') ? directPurchase : undefined,
        sortBy,
        sortOrder,
        page,
        pageSize,
        companyId,
      })
      return jsonResponse(result)
    }
  } catch (error: any) {
    console.error('Error en API Pública /api/public/products:', error)
    return errorResponse(error.message || 'Error interno al consultar los productos', 500)
  }
}
