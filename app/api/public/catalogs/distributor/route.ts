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
    const companyId =
      searchParams.get('companyId') ||
      request.headers.get('x-company-id') ||
      undefined

    const search = searchParams.get('search') || searchParams.get('q') || undefined
    const category = searchParams.get('category') || undefined
    const brand = searchParams.get('brand') || undefined
    const availability = (searchParams.get('availability') as StockAvailabilityLevel) || undefined
    const directPurchase = searchParams.get('directPurchase') === 'true'
    const sortBy = (searchParams.get('sortBy') as 'name' | 'price' | 'sku') || 'name'
    const sortOrder = (searchParams.get('sortOrder') as 'asc' | 'desc') || 'asc'
    const page = searchParams.has('page') ? parseInt(searchParams.get('page')!, 10) : 1
    const pageSize = searchParams.has('limit')
      ? parseInt(searchParams.get('limit')!, 10)
      : searchParams.has('pageSize')
      ? parseInt(searchParams.get('pageSize')!, 10)
      : 12

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
  } catch (error: any) {
    console.error('Error en API Pública Catálogo Distribuidora:', error)
    return errorResponse(error.message || 'Error interno al consultar el catálogo', 500)
  }
}
