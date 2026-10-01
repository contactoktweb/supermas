'use client'

import React, { useState, Suspense } from 'react'
import { RemissionsPage } from '@/features/remissions/components/RemissionsPage'
import { Footer } from '@/components/Footer'
import { AppIcon } from '@/components/ui/Icon'
import Link from 'next/link'
import { APP_MODULES } from '@/components/navigation/modules'
import { GlobalSearch } from '@/components/navigation/GlobalSearch'
import { NotificationButton } from '@/components/navigation/NotificationButton'
import { UserMini } from '@/components/navigation/UserMini'
import { TopAvatar } from '@/components/navigation/TopAvatar'

const modules = APP_MODULES

function RemissionsContent() {
  return (
    <RemissionsPage
      onNavigate={(targetView) => {
        if (targetView === 'Kardex') {
          window.location.href = '/kardex'
        } else if (targetView === 'Ventas') {
          window.location.href = '/ventas'
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

export default function RemissionsRoutePage() {
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
              className={`nav-item ${m === 'Remisiones' ? 'active' : ''}`}
            >
              <AppIcon name={icon} size={16} />
              <span>{m}</span>
            </Link>
          ))}
        </nav>
        <UserMini />
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

          <GlobalSearch />

          <div className="topbar-actions">
            <NotificationButton count={3} />
            <TopAvatar />
          </div>
        </header>

        {/* Dashboard Content */}
        <main className="dashboard-content">
          <Suspense fallback={<div className="loading-state">Cargando módulo de remisiones...</div>}>
            <RemissionsContent />
          </Suspense>
          <Footer />
        </main>
      </div>
    </div>
  )
}
