'use client'

import React, { useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { InventoryPage } from '@/features/inventory/components/InventoryPage'
import { Footer } from '@/components/Footer'
import { AppIcon } from '@/components/ui/Icon'
import Link from 'next/link'
import { APP_MODULES } from '@/components/navigation/modules'

const modules = APP_MODULES

function InventoryRouteContent() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const locationId = searchParams.get('locationId') || undefined
  const status = searchParams.get('status') || undefined

  const handleNavigate = (view: string, params?: Record<string, string>) => {
    if (view === 'Kardex') {
      const qs = params ? new URLSearchParams(params).toString() : ''
      router.push(`/kardex${qs ? `?${qs}` : ''}`)
    } else if (view === 'Bodegas') {
      router.push('/bodegas')
    } else if (view === 'Productos') {
      router.push('/')
    } else {
      router.push('/')
    }
  }

  return (
    <InventoryPage
      initialLocationId={locationId}
      initialStatus={status}
      onNavigate={handleNavigate}
    />
  )
}

export default function InventoryRoutePage() {
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
              className={`nav-item ${m === 'Inventario' ? 'active' : ''}`}
            >
              <AppIcon name={icon} size={16} />
              <span>{m}</span>
            </Link>
          ))}
        </nav>
      </aside>

      {/* Main Area */}
      <div className="main-area">
        <header className="header">
          <div className="header-left">
            <button
              className="menu-button icon-button"
              onClick={() => setMenu(true)}
              aria-label="Abrir menú"
            >
              <AppIcon name="menu" size={20} />
            </button>
            <div className="header-title">
              <h2>Inventario</h2>
              <span>Control operativo detallado de existencias y disponibilidad</span>
            </div>
          </div>
          <div className="header-right">
            <span className="live-pill">
              <i /> Sistema en línea
            </span>
          </div>
        </header>

        <main className="dashboard-content">
          <Suspense fallback={<div style={{ padding: 24 }}>Cargando inventario...</div>}>
            <InventoryRouteContent />
          </Suspense>
          <Footer isDark={false} />
        </main>
      </div>
    </div>
  )
}
