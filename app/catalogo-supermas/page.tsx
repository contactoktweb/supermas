'use client'

import { useState } from 'react'
import Link from 'next/link'
import { AppIcon } from '@/components/ui/Icon'
import { SuperCatalogPage } from '@/features/super-catalog/components/SuperCatalogPage'
import { Footer } from '@/components/Footer'
import { APP_MODULES } from '@/components/navigation/modules'

const modules = APP_MODULES

export default function CatalogoSuperMasRoutePage() {
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
          {modules.map(([label, iconName, href]) => {
            const isActive = label === 'Catálogo Super Más'
            return (
              <Link
                key={label}
                href={href}
                className={`nav-item ${isActive ? 'active' : ''}`}
                onClick={() => setMenu(false)}
              >
                <AppIcon name={iconName} size={18} />
                <span>{label}</span>
                {label === 'Alertas' && <b>3</b>}
              </Link>
            )
          })}
        </nav>

        <button className="user-mini" onClick={() => (window.location.href = '/')}>
          <div className="avatar">AM</div>
          <div>
            <strong>Admin Mauricio</strong>
            <span>Administrador</span>
          </div>
          <AppIcon name="logout" size={18} />
        </button>
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
            <strong>Catálogo Super Más</strong>
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
          <SuperCatalogPage />
          <Footer isDark={false} />
        </main>
      </div>
    </div>
  )
}
