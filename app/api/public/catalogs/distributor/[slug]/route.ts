import { NextRequest } from 'next/server'
import { publicCatalogService } from '@/features/public-catalog/services/public-catalog.service'
import { handleCorsOptions, jsonResponse, errorResponse } from '@/features/public-catalog/utils/cors'

type RouteContext = {
  params: Promise<{ slug: string }> | { slug: string }
}

export async function OPTIONS() {
  return handleCorsOptions()
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const resolvedParams = await Promise.resolve(context.params)
    const slug = resolvedParams.slug

    if (!slug) {
      return errorResponse('Slug o identificador de producto requerido', 400)
    }

    const { searchParams } = new URL(request.url)
    const companyId =
      searchParams.get('companyId') ||
      request.headers.get('x-company-id') ||
      undefined

    const product = await publicCatalogService.getDistributorProduct(slug, companyId)

    if (!product) {
      return errorResponse(`Producto "${slug}" no encontrado en el Catálogo Distribuidora`, 404)
    }

    return jsonResponse({
      success: true,
      channel: 'distributor',
      data: product,
    })
  } catch (error: any) {
    console.error('Error en API Pública Detalle Distribuidora:', error)
    return errorResponse(error.message || 'Error interno al consultar el producto', 500)
  }
}
