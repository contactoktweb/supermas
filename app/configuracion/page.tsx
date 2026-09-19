'use client'

import React, { useState } from 'react'
import { SettingsPage } from '@/features/settings/components/SettingsPage'
import { NotificationBell } from '@/features/alerts/components/NotificationBell'
import { Footer } from '@/components/Footer'
import { AppIcon, LightIconName } from '@/components/ui/Icon'
import Link from 'next/link'

const modules: [string, LightIconName, string][] = [
  ['Dashboard', 'dashboard', '/'],
  ['Bodegas', 'warehouse', '/bodegas'],
  ['Productos', 'products', '/'],
  ['Inventario', 'inventory', '/inventario'],
  ['Kardex', 'kardex', '/kardex'],
  ['Transferencias', 'transfers', '/transferencias'],
  ['Compras', 'purchases', '/compras'],
  ['Proveedores', 'suppliers', '/proveedores'],
  ['Clientes', 'customers', '/clientes'],
  ['Ventas', 'sales', '/ventas'],
  ['POS', 'pos', '/pos'],
  ['Facturación', 'invoices', '/facturacion'],
  ['Remisiones', 'remisiones', '/remisiones'],
  ['Cajas', 'cashRegisters', '/'],
  ['Contabilidad', 'accounting', '/contabilidad'],
  ['Impuestos', 'taxes', '/impuestos'],
  ['Exógena', 'exogena', '/exogena'],
  ['Pedidos Web', 'webOrders', '/pedidos-web'],
  ['Catálogo Super Más', 'ecommerceSM', '/catalogo-supermas'],
  ['Catálogo Distribuidora', 'ecommerceDist', '/catalogo-distribuidora'],
  ['Reportes', 'reports', '/reportes'],
  ['Alertas', 'alerts', '/alertas'],
  ['Auditoría', 'audit', '/auditoria'],
  ['Usuarios', 'users', '/usuarios'],
  ['Configuración', 'settings', '/configuracion'],
]

export default function ConfiguracionRoutePage() {
  const [menu, setMenu] = useState(false)

  return (
    <div className="app-shell">
      {menu && <div className="sidebar-backdrop" onClick={() => setMenu(false)} />}
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

        <nav>
          <p className="nav-caption">Menú principal</p>
          {modules.map(([label, iconName, path]) => (
            <Link
              key={label}
              href={path}
              className={`nav-item ${label === 'Configuración' ? 'active' : ''}`}
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
            <strong>Configuración</strong>
          </div>
          <div className="top-actions">
            <div className="search-box">
              <AppIcon name="search" size={16} />
              <input placeholder="Buscar en el sistema..." />
            </div>
            <NotificationBell />
            <div className="top-avatar">AM</div>
          </div>
        </header>

        <main className="dashboard-content">
          <SettingsPage />
          <Footer isDark={false} />
        </main>
      </div>
    </div>
  )
}
