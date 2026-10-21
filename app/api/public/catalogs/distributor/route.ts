import { NextRequest } from 'next/server'
import { publicCatalogService } from '@/features/public-catalog/services/public-catalog.service'
import { handleCorsOptions, jsonResponse, internalErrorResponse } from '@/features/public-catalog/utils/cors'
import { parsePublicCatalogFilters } from '@/features/public-catalog/utils/request'

export async function OPTIONS(request: NextRequest) {
  return handleCorsOptions(request)
}

export async function GET(request: NextRequest) {
  try {
    const filters = parsePublicCatalogFilters(request, request.nextUrl.searchParams)
    const result = await publicCatalogService.getDistributorCatalog(filters)
    return jsonResponse(result, { request })
  } catch (error) {
    return internalErrorResponse('Catálogo Distribuidora', error, 'Error interno al consultar el catálogo', request)
  }
}
