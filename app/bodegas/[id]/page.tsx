'use client'

import React, { useState, use } from 'react'
import { WarehouseDetailPage } from '@/features/warehouses/components/detail/WarehouseDetailPage'
import { Footer } from '@/components/Footer'
import {
  LayoutDashboard,
  Warehouse,
  Package,
  Boxes,
  ClipboardList,
  Truck,
  ShoppingCart,
  Building2,
  Users,
  CircleDollarSign,
  Store,
  FileText,
  FileBarChart,
  CreditCard,
  Zap,
  Bell,
  UserRound,
  Settings,
  X,
  Building,
  ChevronDown,
  LogOut,
  Menu,
  ChevronRight,
  Search,
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

const modules = [
  ['Dashboard', LayoutDashboard, '/'],
  ['Bodegas', Warehouse, '/bodegas'],
  ['Productos', Package, '/'],
  ['Inventario', Boxes, '/'],
  ['Kardex', ClipboardList, '/'],
  ['Transferencias', Truck, '/'],
  ['Compras', ShoppingCart, '/'],
  ['Proveedores', Building2, '/'],
  ['Clientes', Users, '/'],
  ['Ventas', CircleDollarSign, '/'],
  ['POS', Store, '/'],
  ['Facturación', FileText, '/'],
  ['Remisiones', FileText, '/'],
  ['Cajas', CreditCard, '/'],
  ['Contabilidad', CircleDollarSign, '/'],
  ['Impuestos', ClipboardList, '/'],
  ['Exógena', FileBarChart, '/'],
  ['Pedidos Web', Zap, '/'],
  ['Catálogo Super Más', Store, '/'],
  ['Catálogo Distribuidora', Store, '/'],
  ['Reportes', FileBarChart, '/'],
  ['Alertas', Bell, '/'],
  ['Auditoría', ClipboardList, '/'],
  ['Usuarios', UserRound, '/'],
  ['Roles', Users, '/'],
  ['Configuración', Settings, '/'],
] as const

interface BodegaDetailRouteProps {
  params: Promise<{ id: string }>
}

export default function BodegaDetailRoute({ params }: BodegaDetailRouteProps) {
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
            <X />
          </button>
        </div>

        <div className="workspace">
          <div className="workspace-icon">
            <Building />
          </div>
          <div>
            <strong>Super Más S.A.S.</strong>
            <span>Principal</span>
          </div>
          <ChevronDown size={14} />
        </div>

        <nav>
          <p className="nav-caption">Menú principal</p>
          {modules.map(([label, Icon, path]) => (
            <Link
              key={label}
              href={path}
              className={`nav-item ${label === 'Bodegas' ? 'active' : ''}`}
              onClick={() => setMenu(false)}
            >
              <Icon size={16} />
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
          <LogOut size={16} />
        </div>
      </aside>

      <div className="main-area">
        <header className="topbar">
          <button
            className="menu-trigger icon-button"
            onClick={() => setMenu(true)}
            aria-label="Abrir menú"
          >
            <Menu />
          </button>
          <div className="breadcrumbs">
            <span>Inicio</span>
            <ChevronRight size={14} />
            <Link href="/bodegas" style={{ color: 'inherit' }}>
              Bodegas
            </Link>
            <ChevronRight size={14} />
            <strong>Detalle</strong>
          </div>
          <div className="top-actions">
            <div className="search-box">
              <Search size={15} />
              <input placeholder="Buscar en el sistema..." />
            </div>
            <button className="notification icon-button" aria-label="Notificaciones">
              <Bell size={16} />
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
