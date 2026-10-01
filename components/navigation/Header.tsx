'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { AppIcon } from '@/components/ui/Icon'
import { GlobalSearch } from './GlobalSearch'
import { NotificationButton } from './NotificationButton'

export interface BreadcrumbItem {
  label: string
  href?: string
}

interface HeaderProps {
  onOpenMenu?: () => void
  breadcrumbs?: BreadcrumbItem[]
}

const ROUTE_BREADCRUMBS: Record<string, BreadcrumbItem[]> = {
  '/': [{ label: 'Inicio' }],
  '/productos': [
    { label: 'Inicio', href: '/' },
    { label: 'Inventario' },
    { label: 'Productos' },
  ],
  '/categorias': [
    { label: 'Inicio', href: '/' },
    { label: 'Inventario' },
    { label: 'Categorías' },
  ],
  '/marcas': [
    { label: 'Inicio', href: '/' },
    { label: 'Inventario' },
    { label: 'Marcas' },
  ],
  '/bodegas': [
    { label: 'Inicio', href: '/' },
    { label: 'Inventario' },
    { label: 'Bodegas' },
  ],
  '/inventario': [
    { label: 'Inicio', href: '/' },
    { label: 'Inventario' },
    { label: 'Inventario' },
  ],
  '/kardex': [
    { label: 'Inicio', href: '/' },
    { label: 'Inventario' },
    { label: 'Kardex' },
  ],
  '/transferencias': [
    { label: 'Inicio', href: '/' },
    { label: 'Inventario' },
    { label: 'Transferencias' },
  ],
  '/compras': [
    { label: 'Inicio', href: '/' },
    { label: 'Compras' },
    { label: 'Historial de Compras' },
  ],
  '/proveedores': [
    { label: 'Inicio', href: '/' },
    { label: 'Compras' },
    { label: 'Proveedores' },
  ],
  '/cuentas-por-pagar': [
    { label: 'Inicio', href: '/' },
    { label: 'Compras' },
    { label: 'Cuentas por Pagar (CxP)' },
  ],
  '/clientes': [
    { label: 'Inicio', href: '/' },
    { label: 'Ventas' },
    { label: 'Clientes' },
  ],
  '/ventas': [
    { label: 'Inicio', href: '/' },
    { label: 'Ventas' },
    { label: 'Historial de Ventas' },
  ],
  '/facturacion': [
    { label: 'Inicio', href: '/' },
    { label: 'Ventas' },
    { label: 'Facturación' },
  ],
  '/remisiones': [
    { label: 'Inicio', href: '/' },
    { label: 'Ventas' },
    { label: 'Remisiones' },
  ],
  '/cajas': [
    { label: 'Inicio', href: '/' },
    { label: 'Ventas' },
    { label: 'Cajas y Arqueos' },
  ],
  '/tesoreria': [
    { label: 'Inicio', href: '/' },
    { label: 'Ventas' },
    { label: 'Tesorería' },
  ],
  '/pedidos-web': [
    { label: 'Inicio', href: '/' },
    { label: 'Canales y Catálogos' },
    { label: 'Pedidos Web' },
  ],
  '/catalogo-supermas': [
    { label: 'Inicio', href: '/' },
    { label: 'Canales y Catálogos' },
    { label: 'Catálogo Super Más' },
  ],
  '/catalogo-distribuidora': [
    { label: 'Inicio', href: '/' },
    { label: 'Canales y Catálogos' },
    { label: 'Catálogo Distribuidora' },
  ],
  '/contabilidad': [
    { label: 'Inicio', href: '/' },
    { label: 'Contabilidad' },
    { label: 'Libro Mayor y Cuentas' },
  ],
  '/impuestos': [
    { label: 'Inicio', href: '/' },
    { label: 'Contabilidad' },
    { label: 'Impuestos y Retenciones' },
  ],
  '/exogena': [
    { label: 'Inicio', href: '/' },
    { label: 'Contabilidad' },
    { label: 'Información Exógena' },
  ],
  '/reportes': [
    { label: 'Inicio', href: '/' },
    { label: 'Gestión y Control' },
    { label: 'Reportes' },
  ],
  '/alertas': [
    { label: 'Inicio', href: '/' },
    { label: 'Gestión y Control' },
    { label: 'Alertas y Notificaciones' },
  ],
  '/auditoria': [
    { label: 'Inicio', href: '/' },
    { label: 'Gestión y Control' },
    { label: 'Pista de Auditoría' },
  ],
  '/usuarios': [
    { label: 'Inicio', href: '/' },
    { label: 'Administración' },
    { label: 'Usuarios y Accesos' },
  ],
  '/roles': [
    { label: 'Inicio', href: '/' },
    { label: 'Administración' },
    { label: 'Roles y Permisos' },
  ],
  '/configuracion': [
    { label: 'Inicio', href: '/' },
    { label: 'Administración' },
    { label: 'Configuración General' },
  ],
}

function resolveBreadcrumbs(pathname: string, custom?: BreadcrumbItem[]): BreadcrumbItem[] {
  if (custom && custom.length > 0) {
    return custom
  }

  // Exact route match
  if (ROUTE_BREADCRUMBS[pathname]) {
    return ROUTE_BREADCRUMBS[pathname]
  }

  // Subpath matching (e.g. /bodegas/xyz)
  if (pathname.startsWith('/bodegas/')) {
    return [
      { label: 'Inicio', href: '/' },
      { label: 'Inventario' },
      { label: 'Bodegas', href: '/bodegas' },
      { label: 'Detalle de Sede' },
    ]
  }

  // Fallback: derive from pathname segments
  const segments = pathname.split('/').filter(Boolean)
  if (segments.length === 0) {
    return [{ label: 'Inicio' }]
  }

  const items: BreadcrumbItem[] = [{ label: 'Inicio', href: '/' }]
  let currentPath = ''
  segments.forEach((seg, idx) => {
    currentPath += `/${seg}`
    const isLast = idx === segments.length - 1
    const capitalized = seg.charAt(0).toUpperCase() + seg.slice(1).replace(/-/g, ' ')
    items.push({
      label: capitalized,
      href: isLast ? undefined : currentPath,
    })
  })
  return items
}

export function Header({ onOpenMenu, breadcrumbs }: HeaderProps) {
  const pathname = usePathname() || '/'
  const items = resolveBreadcrumbs(pathname, breadcrumbs)

  return (
    <header className="topbar">
      {onOpenMenu && (
        <button
          type="button"
          className="menu-trigger icon-button"
          onClick={onOpenMenu}
          aria-label="Abrir menú"
        >
          <AppIcon name="menu" size={20} />
        </button>
      )}

      <nav className="breadcrumbs" aria-label="Ruta de navegación">
        {items.map((item, index) => {
          const isLast = index === items.length - 1
          return (
            <React.Fragment key={`${item.label}-${index}`}>
              {index > 0 && <AppIcon name="chevronRight" size={14} />}
              {isLast ? (
                <strong>{item.label}</strong>
              ) : item.href ? (
                <Link href={item.href} style={{ color: 'inherit', textDecoration: 'none' }}>
                  {item.label}
                </Link>
              ) : (
                <span>{item.label}</span>
              )}
            </React.Fragment>
          )
        })}
      </nav>

      <div className="top-actions">
        <GlobalSearch />
        <NotificationButton count={3} />
      </div>
    </header>
  )
}
