import { NextRequest } from 'next/server'
import { publicCatalogService } from '@/features/public-catalog/services/public-catalog.service'
import { handleCorsOptions, jsonResponse, errorResponse, internalErrorResponse } from '@/features/public-catalog/utils/cors'
import { parsePublicCatalogFilters, parsePublicChannel, readPublicCompanyId } from '@/features/public-catalog/utils/request'

export async function OPTIONS(request: NextRequest) {
  return handleCorsOptions(request)
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl
    const channel = parsePublicChannel(searchParams)

    // Con slug o id se retorna el detalle de un producto individual
    const slugOrId = searchParams.get('slug') || searchParams.get('id')
    if (slugOrId) {
      const companyId = readPublicCompanyId(request, searchParams)
      const product =
        channel === 'supermas'
          ? await publicCatalogService.getSuperMasProduct(slugOrId, companyId)
          : await publicCatalogService.getDistributorProduct(slugOrId, companyId)

      if (!product) {
        const catalogName = channel === 'supermas' ? 'Catálogo Super Más' : 'Catálogo Distribuidora'
        return errorResponse(`Producto no encontrado en el ${catalogName}`, { status: 404, request })
      }
      return jsonResponse({ success: true, channel, data: product }, { request })
    }

    // Listado paginado con filtros
    const filters = parsePublicCatalogFilters(request, searchParams)
    const result =
      channel === 'supermas'
        ? await publicCatalogService.getSuperMasCatalog(filters)
        : await publicCatalogService.getDistributorCatalog(filters)
    return jsonResponse(result, { request })
  } catch (error) {
    return internalErrorResponse('/api/public/products', error, 'Error interno al consultar los productos', request)
  }
}
