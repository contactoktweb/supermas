import { NextRequest } from 'next/server'
import { publicCatalogService } from '@/features/public-catalog/services/public-catalog.service'
import { handleCorsOptions, jsonResponse, internalErrorResponse } from '@/features/public-catalog/utils/cors'
import { parsePublicChannel, readPublicCompanyId } from '@/features/public-catalog/utils/request'

export async function OPTIONS(request: NextRequest) {
  return handleCorsOptions(request)
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl
    const channel = parsePublicChannel(searchParams)
    const data = await publicCatalogService.getBrands(channel, readPublicCompanyId(request, searchParams))

    return jsonResponse({ success: true, channel, data }, { request })
  } catch (error) {
    return internalErrorResponse('Marcas', error, 'Error interno al consultar marcas', request)
  }
}
