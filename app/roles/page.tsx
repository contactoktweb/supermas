'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { AppIcon } from '@/components/ui/Icon'
import { RolesView } from '@/features/roles/components/RolesView'
import { Footer } from '@/components/Footer'
import { APP_MODULES } from '@/components/navigation/modules'
import { GlobalSearch } from '@/components/navigation/GlobalSearch'
import { NotificationButton } from '@/components/navigation/NotificationButton'
import { UserMini } from '@/components/navigation/UserMini'
import { TopAvatar } from '@/components/navigation/TopAvatar'

export default function RolesRoutePage() {
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
          {APP_MODULES.map(([label, iconName, href]) => {
            const isActive = label === 'Roles'
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

        <UserMini />
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
            <span>Seguridad</span>
            <AppIcon name="chevronRight" size={14} />
            <strong>Roles y Permisos</strong>
          </div>

          <div className="top-actions">
            <GlobalSearch />
            <NotificationButton count={3} />
            <TopAvatar />
          </div>
        </header>

        <main className="dashboard-content">
          <RolesView />
          <Footer isDark={false} />
        </main>
      </div>
    </div>
  )
}
