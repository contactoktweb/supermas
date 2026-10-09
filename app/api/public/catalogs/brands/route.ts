import { NextRequest } from 'next/server'
import { publicCatalogService } from '@/features/public-catalog/services/public-catalog.service'
import { handleCorsOptions, jsonResponse, errorResponse } from '@/features/public-catalog/utils/cors'

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

    const brands = await publicCatalogService.getBrands(channel, companyId)

    return jsonResponse({
      success: true,
      channel,
      data: brands,
    })
  } catch (error: any) {
    console.error('Error en API Pública Marcas:', error)
    return errorResponse(error.message || 'Error interno al consultar marcas', 500)
  }
}
