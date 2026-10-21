import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import {
  CHANGE_PASSWORD_PATH,
  PASSWORD_CHANGE_REQUIRED_CODE,
  PASSWORD_CHANGE_REQUIRED_MESSAGE,
  tokenRequiresPasswordChange,
} from '@/lib/auth/password-change-flag'

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

  // Contraseña inicial pendiente (bandera de app_metadata dentro del JWT). Aquí solo se decide la
  // navegación; requireServerUser vuelve a comprobarlo contra Supabase Auth en cada API.
  const mustChangePassword = token ? tokenRequiresPasswordChange(token) : false

  // Manejo de llamadas API sin autenticación (retornar JSON en lugar de redirección HTML)
  if (pathname.startsWith('/api/')) {
    if (!token) {
      return NextResponse.json({ success: false, error: 'No autorizado: sesión requerida' }, { status: 401 })
    }
    if (mustChangePassword) {
      return NextResponse.json(
        { success: false, error: PASSWORD_CHANGE_REQUIRED_MESSAGE, code: PASSWORD_CHANGE_REQUIRED_CODE },
        { status: 403 }
      )
    }
    return NextResponse.next()
  }

  // 1. Usuario NO autenticado intentando acceder a ruta protegida
  if (!token && !isPublicAuthPage) {
    const loginUrl = new URL('/login', request.url)
    if (pathname !== '/') {
      loginUrl.searchParams.set('redirectTo', pathname)
    }
    return NextResponse.redirect(loginUrl)
  }

  // 1.1 Contraseña inicial pendiente: la única pantalla disponible es la de cambio de contraseña
  if (token && mustChangePassword) {
    if (pathname === CHANGE_PASSWORD_PATH || pathname === '/recuperar-contrasena') {
      return NextResponse.next()
    }
    return NextResponse.redirect(new URL(CHANGE_PASSWORD_PATH, request.url))
  }

  // 1.2 Sin cambio pendiente, la pantalla de cambio obligatorio no aplica
  if (token && pathname === CHANGE_PASSWORD_PATH) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  // 2. Usuario YA autenticado visitando /login
  if (token && pathname === '/login') {
    return NextResponse.redirect(new URL('/', request.url))
  }

  // 3. Protección de rutas restringidas según el rol fiduciario
  if (token && role) {
    const isGlobalAdmin = role === 'ADMIN' || role === 'SUPERADMIN'

    if (!isGlobalAdmin) {
      const adminOnlyRoutes = ['/roles', '/configuracion']
      const accountingRoutes = ['/contabilidad', '/exogena', '/impuestos']
      const commercialRoutes = ['/ventas', '/pos', '/facturacion', '/cajas', '/pedidos-web']
      const inventoryRoutes = ['/inventario', '/kardex', '/transferencias', '/bodegas', '/recepciones']
      const purchaseRoutes = ['/compras', '/proveedores', '/cuentas-por-pagar']

      // 1. Roles nunca pueden entrar a roles o configuración del sistema (solo ADMIN)
      if (adminOnlyRoutes.some((route) => pathname.startsWith(route))) {
        return NextResponse.redirect(new URL('/?denied=admin', request.url))
      }

      // 2. RECURSOS HUMANOS: solo gestiona usuarios/colaboradores y auditoría
      if (role === 'RECURSOS_HUMANOS') {
        const hrBlockedRoutes = [
          ...accountingRoutes,
          ...commercialRoutes,
          ...inventoryRoutes,
          ...purchaseRoutes,
          '/productos',
          '/categorias',
          '/marcas',
          '/remisiones',
          '/devoluciones',
          '/tesoreria',
          '/catalogo-supermas',
          '/catalogo-distribuidora',
        ]
        if (hrBlockedRoutes.some((route) => pathname.startsWith(route))) {
          return NextResponse.redirect(new URL('/?denied=unauthorized_hr', request.url))
        }
      }

      // 3. JEFE DE BODEGA: no entra a comercial, contabilidad, ni usuarios
      if (role === 'JEFE_BODEGA' || role === 'WAREHOUSE_ADMIN') {
        const whBlocked = [...accountingRoutes, ...commercialRoutes, '/usuarios', '/auditoria']
        if (whBlocked.some((route) => pathname.startsWith(route))) {
          return NextResponse.redirect(new URL('/?denied=unauthorized_warehouse', request.url))
        }
      }

      // 4. FACTURACIÓN POS y ENCARGADA DE VENTA: no entran a compras, contabilidad, ni usuarios
      if (role === 'FACTURACION_POS' || role === 'ENCARGADA_VENTA' || role === 'CASHIER') {
        const posBlocked = [...accountingRoutes, ...purchaseRoutes, '/usuarios', '/auditoria']
        if (posBlocked.some((route) => pathname.startsWith(route))) {
          return NextResponse.redirect(new URL('/?denied=unauthorized_pos', request.url))
        }
      }

      // 5. VENDEDORES: no entran a compras, pos/cajas (cobro es de encargada), contabilidad, ni usuarios
      if (role === 'VENDEDORES' || role === 'SELLER') {
        const sellerBlocked = [
          ...accountingRoutes,
          ...purchaseRoutes,
          ...inventoryRoutes,
          '/pos',
          '/cajas',
          '/usuarios',
          '/auditoria',
        ]
        if (sellerBlocked.some((route) => pathname.startsWith(route))) {
          return NextResponse.redirect(new URL('/?denied=unauthorized_seller', request.url))
        }
      }

      // 6. JEFE DE INGRESOS Y SALIDAS OPERATIVA: no entra a contabilidad ni usuarios
      if (role === 'JEFE_INGRESOS_SALIDAS') {
        const jefeBlocked = [...accountingRoutes, '/usuarios']
        if (jefeBlocked.some((route) => pathname.startsWith(route))) {
          return NextResponse.redirect(new URL('/?denied=unauthorized_ops', request.url))
        }
      }

      // 7. ACCOUNTANT legacy: no modifica usuarios
      if (role === 'ACCOUNTANT' && pathname.startsWith('/usuarios')) {
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
