'use client'

import React, { useState } from 'react'
import { AuditPage } from '@/features/audit/components/AuditPage'
import { Footer } from '@/components/Footer'
import { AppIcon } from '@/components/ui/Icon'
import Link from 'next/link'
import { APP_MODULES } from '@/components/navigation/modules'
import { GlobalSearch } from '@/components/navigation/GlobalSearch'
import { NotificationButton } from '@/components/navigation/NotificationButton'
import { UserMini } from '@/components/navigation/UserMini'
import { TopAvatar } from '@/components/navigation/TopAvatar'

const modules = APP_MODULES

export default function AuditoriaRoutePage() {
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
              className={`nav-item ${label === 'Auditoría' ? 'active' : ''}`}
              onClick={() => setMenu(false)}
            >
              <AppIcon name={iconName} size={18} />
              <span>{label}</span>
              {label === 'Alertas' && <b>3</b>}
            </Link>
          ))}
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
            <strong>Auditoría</strong>
          </div>
          <div className="top-actions">
            <GlobalSearch />
            <NotificationButton count={3} />
            <TopAvatar />
          </div>
        </header>

        <main className="dashboard-content">
          <AuditPage />
          <Footer isDark={false} />
        </main>
      </div>
    </div>
  )
}
