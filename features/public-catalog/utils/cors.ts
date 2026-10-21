/**
 * SUPER MÁS ERP/POS - Utilidades CORS y Respuestas HTTP para API Pública
 *
 * Orígenes permitidos: PUBLIC_CATALOG_ALLOWED_ORIGINS (lista separada por comas, solo servidor).
 * - Configurada: solo esos orígenes reciben Access-Control-Allow-Origin (se refleja el origen y se añade Vary: Origin).
 * - Sin configurar: catálogo abierto ('*'). La API no usa cookies ni credenciales y solo expone datos publicados.
 */

const ALLOWED_METHODS = 'GET, OPTIONS'
const ALLOWED_HEADERS = 'Content-Type, x-company-id'
const PREFLIGHT_MAX_AGE_SECONDS = 86400
const DEFAULT_CACHE_SECONDS = 60

function getAllowedOrigins(): string[] {
  return (process.env.PUBLIC_CATALOG_ALLOWED_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim().replace(/\/+$/, ''))
    .filter(Boolean)
}

/**
 * Cabeceras CORS para la petición recibida.
 */
export function buildCorsHeaders(request?: Request): Record<string, string> {
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': ALLOWED_METHODS,
    'Access-Control-Allow-Headers': ALLOWED_HEADERS,
    'Access-Control-Max-Age': String(PREFLIGHT_MAX_AGE_SECONDS),
  }

  const allowedOrigins = getAllowedOrigins()
  if (allowedOrigins.length === 0) {
    headers['Access-Control-Allow-Origin'] = '*'
    return headers
  }

  headers['Vary'] = 'Origin'
  const origin = request?.headers.get('origin')
  if (origin && allowedOrigins.includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin
  }
  return headers
}

/**
 * Maneja peticiones preflight CORS (OPTIONS)
 */
export function handleCorsOptions(request?: Request): Response {
  return new Response(null, {
    status: 204,
    headers: buildCorsHeaders(request),
  })
}

interface JsonResponseOptions {
  status?: number
  cacheSeconds?: number
  request?: Request
}

/**
 * Retorna una respuesta JSON con cabeceras CORS y control de caché
 */
export function jsonResponse<T>(data: T, options: JsonResponseOptions = {}): Response {
  const { status = 200, cacheSeconds = DEFAULT_CACHE_SECONDS, request } = options
  return Response.json(data, {
    status,
    headers: {
      ...buildCorsHeaders(request),
      'Content-Type': 'application/json',
      'Cache-Control': `public, s-maxage=${cacheSeconds}, stale-while-revalidate=${cacheSeconds * 2}`,
    },
  })
}

interface ErrorResponseOptions {
  status?: number
  request?: Request
}

/**
 * Retorna una respuesta de error estandarizada (el mensaje debe ser apto para el cliente).
 */
export function errorResponse(message: string, options: ErrorResponseOptions = {}): Response {
  const { status = 400, request } = options
  return Response.json(
    { success: false, error: message },
    {
      status,
      headers: {
        ...buildCorsHeaders(request),
        'Content-Type': 'application/json',
      },
    }
  )
}

/**
 * Registra el detalle del error solo en el servidor y responde al cliente con un mensaje genérico.
 */
export function internalErrorResponse(context: string, error: unknown, clientMessage: string, request?: Request): Response {
  const detail = error instanceof Error ? error.message : String(error)
  console.error(`[API Pública] ${context}:`, detail)
  return errorResponse(clientMessage, { status: 500, request })
}
