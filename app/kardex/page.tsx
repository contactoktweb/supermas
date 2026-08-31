'use client'

import React, { useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { KardexPage } from '@/features/kardex/components/KardexPage'
import { Footer } from '@/components/Footer'
import { AppIcon, LightIconName } from '@/components/ui/Icon'
import Link from 'next/link'

const modules: [string, LightIconName, string][] = [
  ['Dashboard', 'dashboard', '/'],
  ['Bodegas', 'warehouse', '/bodegas'],
  ['Productos', 'products', '/'],
  ['Inventario', 'inventory', '/'],
  ['Kardex', 'kardex', '/kardex'],
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

function KardexContent() {
  const searchParams = useSearchParams()
  const productId = searchParams.get('productId') || undefined
  const locationId = searchParams.get('locationId') || undefined

  return (
    <KardexPage
      initialProductId={productId}
      initialLocationId={locationId}
    />
  )
}

export default function KardexRoutePage() {
  const [menu, setMenu] = useState(false)

  return (
    <div className="app-shell">
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
            <AppIcon name="suppliers" size={18} />
          </div>
          <div>
            <strong>Super Más S.A.S.</strong>
            <span>Principal</span>
          </div>
        </div>

        <nav className="nav-list">
          {modules.map(([m, icon, href]) => (
            <Link
              key={m}
              href={href}
              className={`nav-item ${m === 'Kardex' ? 'active' : ''}`}
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
              <h2>Kardex</h2>
              <span>Trazabilidad de inventario y auditoría de movimientos</span>
            </div>
          </div>
          <div className="header-right">
            <span className="live-pill">
              <i /> Sistema en línea
            </span>
          </div>
        </header>

        <main className="dashboard-content">
          <Suspense fallback={<div style={{ padding: 24 }}>Cargando Kardex...</div>}>
            <KardexContent />
          </Suspense>
          <Footer isDark={false} />
        </main>
      </div>
    </div>
  )
}
