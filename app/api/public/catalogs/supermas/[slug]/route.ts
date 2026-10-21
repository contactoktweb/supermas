import { NextRequest } from 'next/server'
import { publicCatalogService } from '@/features/public-catalog/services/public-catalog.service'
import { handleCorsOptions, jsonResponse, errorResponse, internalErrorResponse } from '@/features/public-catalog/utils/cors'
import { readPublicCompanyId } from '@/features/public-catalog/utils/request'

type RouteContext = {
  params: Promise<{ slug: string }>
}

export async function OPTIONS(request: NextRequest) {
  return handleCorsOptions(request)
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { slug } = await context.params

    if (!slug) {
      return errorResponse('Slug o identificador de producto requerido', { status: 400, request })
    }

    const product = await publicCatalogService.getSuperMasProduct(slug, readPublicCompanyId(request, request.nextUrl.searchParams))

    if (!product) {
      return errorResponse('Producto no encontrado en el Catálogo Super Más', { status: 404, request })
    }

    return jsonResponse({ success: true, channel: 'supermas', data: product }, { request })
  } catch (error) {
    return internalErrorResponse('Detalle Catálogo Super Más', error, 'Error interno al consultar el producto', request)
  }
}
