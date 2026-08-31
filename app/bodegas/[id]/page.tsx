'use client'

import React, { useState, use } from 'react'
import { WarehouseDetailPage } from '@/features/warehouses/components/detail/WarehouseDetailPage'
import { Footer } from '@/components/Footer'
import { AppIcon, LightIconName } from '@/components/ui/Icon'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

const modules: [string, LightIconName, string][] = [
  ['Dashboard', 'dashboard', '/'],
  ['Bodegas', 'warehouse', '/bodegas'],
  ['Productos', 'products', '/'],
  ['Inventario', 'inventory', '/'],
  ['Kardex', 'kardex', '/'],
  ['Transferencias', 'transfers', '/'],
  ['Compras', 'purchases', '/'],
  ['Proveedores', 'suppliers', '/'],
  ['Clientes', 'customers', '/'],
  ['Ventas', 'sales', '/'],
  ['POS', 'pos', '/'],
  ['Facturación', 'invoices', '/'],
  ['Remisiones', 'remisiones', '/'],
  ['Cajas', 'cashRegisters', '/'],
  ['Contabilidad', 'accounting', '/'],
  ['Impuestos', 'taxes', '/'],
  ['Exógena', 'exogena', '/'],
  ['Pedidos Web', 'webOrders', '/'],
  ['Catálogo Super Más', 'ecommerceSM', '/'],
  ['Catálogo Distribuidora', 'ecommerceDist', '/'],
  ['Reportes', 'reports', '/'],
  ['Alertas', 'alerts', '/'],
  ['Auditoría', 'audit', '/'],
  ['Usuarios', 'users', '/'],
  ['Roles', 'roles', '/'],
  ['Configuración', 'settings', '/'],
]

interface PageProps {
  params: Promise<{ id: string }>
}

export default function WarehouseDetailRoutePage({ params }: PageProps) {
  const resolvedParams = use(params)
  const [menu, setMenu] = useState(false)
  const router = useRouter()

  return (
    <div className="app-shell">
      <aside className={`sidebar ${menu ? 'sidebar-open' : ''}`}>
        <div className="sidebar-top">
          <div className="brand brand-compact">
            <img src="/super-mas-logo.svg" alt="Super Más" />
            <span>ERP / POS</span>
          </div>
          <button
            className="mobile-close icon-button"
            onClick={() => setMenu(false)}
            aria-label="Cerrar menú"
          >
            <AppIcon name="close" size={18} />
          </button>
        </div>

        <div className="workspace">
          <div className="workspace-icon">
            <AppIcon name="suppliers" size={18} />
          </div>
          <div>
            <strong>Super Más S.A.S.</strong>
            <span>Principal</span>
          </div>
          <AppIcon name="chevronDown" size={14} />
        </div>

        <nav>
          <p className="nav-caption">Menú principal</p>
          {modules.map(([label, iconName, path]) => (
            <Link
              key={label}
              href={path}
              className={`nav-item ${label === 'Bodegas' ? 'active' : ''}`}
              onClick={() => setMenu(false)}
            >
              <AppIcon name={iconName} size={18} />
              <span>{label}</span>
              {label === 'Alertas' && <b>3</b>}
            </Link>
          ))}
        </nav>

        <div className="user-mini">
          <div className="avatar">AM</div>
          <div>
            <strong>Admin Mauricio</strong>
            <span>Administrador</span>
          </div>
          <AppIcon name="logout" size={18} />
        </div>
      </aside>

      <div className="main-area">
        <header className="topbar">
          <button
            className="menu-trigger icon-button"
            onClick={() => setMenu(true)}
            aria-label="Abrir menú"
          >
            <AppIcon name="menu" size={20} />
          </button>
          <div className="breadcrumbs">
            <span>Inicio</span>
            <AppIcon name="chevronRight" size={14} />
            <Link href="/bodegas" style={{ color: 'inherit', textDecoration: 'none' }}>
              Bodegas
            </Link>
            <AppIcon name="chevronRight" size={14} />
            <strong>Detalle de Sede</strong>
          </div>
          <div className="top-actions">
            <div className="search-box">
              <AppIcon name="search" size={16} />
              <input placeholder="Buscar en el sistema..." />
            </div>
            <button className="notification icon-button" aria-label="Notificaciones">
              <AppIcon name="alerts" size={18} />
              <i>3</i>
            </button>
            <div className="top-avatar">AM</div>
          </div>
        </header>

        <main className="dashboard-content">
          <WarehouseDetailPage
            warehouseId={resolvedParams.id}
            onBack={() => router.push('/bodegas')}
          />
          <Footer isDark={false} />
        </main>
      </div>
    </div>
  )
}
