import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * SUPER MÁS ERP/POS - Middleware de Seguridad y Protección de Rutas
 *
 * Valida la existencia de la sesión activa mediante la cookie fiduciaria `sb-access-token`.
 * Impide el acceso a usuarios no autenticados y restringe rutas por rol.
 */
export function middleware(request: NextRequest) {
  const token = request.cookies.get('sb-access-token')?.value
  const role = request.cookies.get('sb-user-role')?.value
  const { pathname } = request.nextUrl

  // Excluir archivos estáticos, imágenes, fuentes o API pública externa
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/api/public') ||
    pathname.includes('.')
  ) {
    return NextResponse.next()
  }

  const isPublicAuthPage = pathname === '/login' || pathname === '/recuperar-contrasena'

  // 1. Usuario NO autenticado intentando acceder a ruta protegida
  if (!token && !isPublicAuthPage) {
    const loginUrl = new URL('/login', request.url)
    if (pathname !== '/') {
      loginUrl.searchParams.set('redirectTo', pathname)
    }
    return NextResponse.redirect(loginUrl)
  }

  // 2. Usuario YA autenticado visitando /login
  if (token && pathname === '/login') {
    return NextResponse.redirect(new URL('/', request.url))
  }

  // 3. Protección de rutas restringidas según el rol fiduciario
  if (token && role) {
    const adminOnlyRoutes = ['/usuarios', '/roles', '/auditoria', '/configuracion']
    const accountingRoutes = ['/contabilidad', '/exogena', '/impuestos']

    // Cajeros y Asesores de Venta no pueden ingresar a configuración administrativa ni contabilidad
    if (role === 'CASHIER' || role === 'SELLER') {
      if (adminOnlyRoutes.some((route) => pathname.startsWith(route))) {
        return NextResponse.redirect(new URL('/?denied=admin', request.url))
      }
      if (accountingRoutes.some((route) => pathname.startsWith(route))) {
        return NextResponse.redirect(new URL('/?denied=accounting', request.url))
      }
    }

    // Contabilidad no puede modificar roles ni usuarios
    if (role === 'ACCOUNTANT') {
      if (['/usuarios', '/roles'].some((route) => pathname.startsWith(route))) {
        return NextResponse.redirect(new URL('/?denied=admin', request.url))
      }
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Aplica a todas las rutas excepto recursos estáticos del compilador o imágenes
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
