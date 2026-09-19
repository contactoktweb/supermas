'use client'

import React, { useState, Suspense } from 'react'
import { SalesPage } from '@/features/sales/components/SalesPage'
import { Footer } from '@/components/Footer'
import { AppIcon } from '@/components/ui/Icon'
import Link from 'next/link'
import { APP_MODULES } from '@/components/navigation/modules'

const modules = APP_MODULES

function SalesContent() {
  return (
    <SalesPage
      onNavigate={(targetView) => {
        if (targetView === 'Kardex') {
          window.location.href = '/kardex'
        } else if (targetView === 'Facturación') {
          window.location.href = '/facturacion'
        } else if (targetView === 'Clientes') {
          window.location.href = '/clientes'
        } else if (targetView === 'Compras') {
          window.location.href = '/compras'
        } else if (targetView === 'Proveedores') {
          window.location.href = '/proveedores'
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

export default function SalesRoutePage() {
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


        <nav className="nav-list">
          {modules.map(([m, icon, href]) => (
            <Link
              key={m}
              href={href}
              className={`nav-item ${m === 'Ventas' ? 'active' : ''}`}
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
              type="text"
              placeholder="Buscar ventas, facturas o clientes..."
              aria-label="Búsqueda global"
            />
          </div>

          <div className="topbar-actions">
            <button
              className="icon-button"
              aria-label="Notificaciones"
              title="Notificaciones"
            >
              <AppIcon name="alerts" size={18} />
            </button>
            <div className="topbar-user">
              <div className="topbar-avatar">
                <span>AM</span>
              </div>
              <div className="topbar-user-info">
                <strong>Admin Mauricio</strong>
                <small>Administrador</small>
              </div>
            </div>
          </div>
        </header>

        {/* Dashboard Content */}
        <main className="dashboard-content">
          <Suspense fallback={<div className="loading-state">Cargando módulo de ventas...</div>}>
            <SalesContent />
          </Suspense>
          <Footer />
        </main>
      </div>
    </div>
  )
}
