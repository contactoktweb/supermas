const isProduction = process.env.NODE_ENV === 'production'

/** Origen de Supabase (API REST, Auth, Storage y Realtime), tomado en tiempo de build. */
function getSupabaseOrigins() {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!rawUrl) return []
  try {
    const { protocol, host } = new URL(rawUrl)
    const realtimeProtocol = protocol === 'https:' ? 'wss:' : 'ws:'
    return [`${protocol}//${host}`, `${realtimeProtocol}//${host}`]
  } catch {
    return []
  }
}

/** API de iconos usada por @iconify/react (servidor principal y respaldos oficiales). */
const ICONIFY_API_ORIGINS = ['https://api.iconify.design', 'https://api.simplesvg.com', 'https://api.unisvg.com']

function buildContentSecurityPolicy() {
  const supabaseOrigins = getSupabaseOrigins()

  const directives = {
    'default-src': ["'self'"],
    // Next.js App Router inyecta scripts en línea (hidratación / RSC); en desarrollo HMR requiere eval.
    'script-src': ["'self'", "'unsafe-inline'", ...(isProduction ? [] : ["'unsafe-eval'"])],
    'style-src': ["'self'", "'unsafe-inline'"],
    // Imágenes: cargas en base64 (data:), vistas previas (blob:), Supabase Storage y logos de marca por URL https.
    'img-src': ["'self'", 'data:', 'blob:', 'https:'],
    'font-src': ["'self'", 'data:'],
    'connect-src': ["'self'", ...supabaseOrigins, ...ICONIFY_API_ORIGINS, ...(isProduction ? [] : ['ws:'])],
    'frame-src': ["'self'", 'blob:'],
    'worker-src': ["'self'", 'blob:'],
    'object-src': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    'frame-ancestors': ["'none'"],
  }

  return Object.entries(directives)
    .map(([directive, sources]) => `${directive} ${sources.join(' ')}`)
    .join('; ')
}

const HSTS_MAX_AGE_SECONDS = 63072000

function buildSecurityHeaders() {
  const headers = [
    { key: 'Content-Security-Policy', value: buildContentSecurityPolicy() },
    { key: 'X-Frame-Options', value: 'DENY' },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  ]
  if (isProduction) {
    headers.push({ key: 'Strict-Transport-Security', value: `max-age=${HSTS_MAX_AGE_SECONDS}; includeSubDomains` })
  }
  return headers
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  images: {
    unoptimized: true,
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: buildSecurityHeaders(),
      },
    ]
  },
}

export default nextConfig
