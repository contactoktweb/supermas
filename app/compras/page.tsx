'use client'

import React, { useState, Suspense } from 'react'
import { PurchasesPage } from '@/features/purchases/components/PurchasesPage'
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

function PurchasesContent() {
  return (
    <PurchasesPage
      onNavigate={(targetView) => {
        if (targetView === 'Kardex') {
          window.location.href = '/kardex'
        } else if (targetView === 'Inventario') {
          window.location.href = '/inventario'
        } else if (targetView === 'Bodegas') {
          window.location.href = '/bodegas'
        } else if (targetView === 'Transferencias') {
          window.location.href = '/transferencias'
        } else {
          window.location.href = '/'
        }
      }}
    />
  )
}

export default function PurchasesRoutePage() {
  const [menu, setMenu] = useState(false)

  return (
    <div className="app-shell">
      {menu && <div className="sidebar-backdrop" onClick={() => setMenu(false)} />}

      {/* Sidebar */}
      <aside className={`sidebar ${menu ? 'sidebar-open' : ''}`}>
        <div className="sidebar-top">
          <div className="brand brand-compact">
            {/* eslint-disable-next-line @next/next/no-img-element */}
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
            <AppIcon name="purchases" size={18} />
          </div>
          <div>
            <strong>Super Más S.A.S.</strong>
            <span>Compras & Abastecimiento</span>
          </div>
        </div>

        <nav className="nav-list">
          {modules.map(([m, icon, href]) => (
            <Link
              key={m}
              href={href}
              className={`nav-item ${m === 'Compras' ? 'active' : ''}`}
            >
              <AppIcon name={icon} size={16} />
              <span>{m}</span>
            </Link>
          ))}
        </nav>
      </aside>

      {/* Main Area */}
      <div className="main-area">
        {/* Topbar */}
        <header className="topbar">
          <button
            className="menu-button icon-button"
            onClick={() => setMenu(true)}
            aria-label="Abrir menú"
          >
            <AppIcon name="menu" size={20} />
          </button>

          <div className="topbar-search">
            <AppIcon name="search" size={16} />
            <input
              placeholder="Buscar en compras, proveedores, facturas..."
              aria-label="Buscar en ERP"
            />
          </div>

          <div className="topbar-actions">
            <div className="active-tag">
              <span className="live-dot" />
              <span>Módulo Compras Activo</span>
            </div>

            <button
              className="icon-button notification-button"
              aria-label="Alertas del sistema"
            >
              <AppIcon name="alerts" size={18} />
              <span className="notif-badge">3</span>
            </button>

            <div className="avatar-chip">
              <div className="user-avatar-initials">MA</div>
              <div>
                <strong>Mauricio Arango</strong>
                <span>Compras</span>
              </div>
            </div>
          </div>
        </header>

        {/* Dynamic Content */}
        <main className="dashboard-content">
          <Suspense fallback={<div style={{ padding: 32 }}>Cargando módulo de compras...</div>}>
            <PurchasesContent />
          </Suspense>
        </main>

        {/* Footer with Mandatory Attribution */}
        <Footer />
      </div>
    </div>
  )
}
