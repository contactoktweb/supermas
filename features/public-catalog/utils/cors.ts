/**
 * SUPER MÁS ERP/POS - Utilidades CORS y Respuestas HTTP para API Pública
 *
 * Facilita el consumo seguro desde otros sitios web o clientes externos.
 */

export const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-company-id, x-api-key',
  'Access-Control-Max-Age': '86400',
}

/**
 * Maneja peticiones preflight CORS (OPTIONS)
 */
export function handleCorsOptions(): Response {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  })
}

/**
 * Retorna una respuesta JSON con cabeceras CORS y control de caché
 */
export function jsonResponse<T>(data: T, status = 200, cacheSeconds = 60): Response {
  return Response.json(data, {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
      'Cache-Control': `public, s-maxage=${cacheSeconds}, stale-while-revalidate=${cacheSeconds * 2}`,
    },
  })
}

/**
 * Retorna una respuesta de error estandarizada
 */
export function errorResponse(message: string, status = 400, details?: any): Response {
  return Response.json(
    {
      success: false,
      error: message,
      ...(details ? { details } : {}),
    },
    {
      status,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    }
  )
}
