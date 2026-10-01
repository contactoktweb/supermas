'use client'

import React, { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { AppIcon } from '@/components/ui/Icon'
import { DASHBOARD_ITEM, NAV_SECTIONS, NavSection, NavItem } from './modules'
import { UserMini } from './UserMini'
import { useAuth } from '@/features/auth'

export interface SidebarProps {
  open?: boolean
  onClose?: () => void
  currentPath?: string
  onLogout?: () => void
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`brand ${compact ? 'brand-compact' : ''}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/super-mas-logo.svg" alt="Super Más" />
      <span>ERP / POS</span>
    </div>
  )
}

export function Sidebar({ open = false, onClose, currentPath, onLogout }: SidebarProps) {
  const pathname = usePathname()
  const effectivePath = currentPath || pathname || '/'
  const { user, hasPermission, signOut } = useAuth()

  // Determinar qué sección contiene la ruta activa para auto-expandirla
  const activeSectionId = useMemo(() => {
    for (const section of NAV_SECTIONS) {
      const hasActiveItem = section.items.some((item) => {
        if (item.path === '/') return effectivePath === '/'
        return effectivePath === item.path || effectivePath.startsWith(item.path + '/')
      })
      if (hasActiveItem) return section.id
    }
    return null
  }, [effectivePath])

  // Estado de secciones expandidas / colapsadas (por defecto todas abiertas o al menos la activa abierta)
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {
      inventario: true,
      compras: true,
      ventas: true,
      canales: false,
      contabilidad: false,
      gestion: false,
      administracion: false,
    }
    if (activeSectionId) {
      initial[activeSectionId] = true
    }
    return initial
  })

  // Sincronizar auto-expansión al cambiar de ruta
  useEffect(() => {
    if (activeSectionId) {
      setExpandedSections((prev) => ({
        ...prev,
        [activeSectionId]: true,
      }))
    }
  }, [activeSectionId])

  const toggleSection = (sectionId: string, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setExpandedSections((prev) => ({
      ...prev,
      [sectionId]: !prev[sectionId],
    }))
  }

  // Filtrado fiduciario de permisos por rol/permisos de usuario
  const filterVisibleItems = (items: NavItem[]): NavItem[] => {
    if (!user) return items
    if (user.roleCode === 'SUPERADMIN' || user.roleCode === 'ADMIN') return items

    return items.filter((item) => {
      if (!item.permission) return true
      return hasPermission(item.permission)
    })
  }

  const isDashboardActive = effectivePath === '/'

  const handleLinkClick = () => {
    if (onClose) onClose()
  }

  return (
    <>
      {open && <div className="sidebar-backdrop" onClick={onClose} />}
      <aside className={`sidebar ${open ? 'sidebar-open' : ''}`}>
        <div className="sidebar-top">
          <Brand compact />
          <button
            className="mobile-close icon-button"
            onClick={onClose}
            aria-label="Cerrar menú"
            type="button"
          >
            <AppIcon name="close" size={18} />
          </button>
        </div>

        <nav>
          <p className="nav-caption">Menú principal</p>

          {/* Módulo independiente: Dashboard */}
          <Link
            href={DASHBOARD_ITEM.path}
            className={`nav-item ${isDashboardActive ? 'active' : ''}`}
            onClick={handleLinkClick}
          >
            <AppIcon name={DASHBOARD_ITEM.icon} size={18} />
            <span>{DASHBOARD_ITEM.label}</span>
          </Link>

          {/* Secciones desplegables organizadas */}
          <div className="sidebar-sections">
            {NAV_SECTIONS.map((section) => {
              const visibleItems = filterVisibleItems(section.items)
              // Ocultar sección si el usuario no tiene permisos para ninguno de sus módulos
              if (visibleItems.length === 0) return null

              const isOpen = Boolean(expandedSections[section.id])

              return (
                <div key={section.id} className="nav-section">
                  <button
                    type="button"
                    className={`nav-section-header ${isOpen ? 'is-open' : 'is-closed'}`}
                    onClick={(e) => toggleSection(section.id, e)}
                    aria-expanded={isOpen}
                    title={`${isOpen ? 'Contraer' : 'Expandir'} sección ${section.title}`}
                  >
                    <span className="section-title">{section.title}</span>
                    <span className="section-chevron">
                      <AppIcon name="chevronDown" size={14} />
                    </span>
                  </button>

                  <div
                    className={`nav-section-items ${isOpen ? 'is-open' : 'is-closed'}`}
                    style={{
                      maxHeight: isOpen ? `${visibleItems.length * 42}px` : '0px',
                    }}
                  >
                    {visibleItems.map((item) => {
                      const isActive =
                        item.path === '/'
                          ? effectivePath === '/'
                          : effectivePath === item.path ||
                            effectivePath.startsWith(item.path + '/')

                      return (
                        <Link
                          key={item.id}
                          href={item.path}
                          className={`nav-item sub-item ${isActive ? 'active' : ''}`}
                          onClick={handleLinkClick}
                        >
                          <AppIcon name={item.icon} size={16} />
                          <span>{item.label}</span>
                          {item.badge !== undefined && <b>{item.badge}</b>}
                        </Link>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </nav>

        <UserMini onLogout={onLogout || signOut} />
      </aside>
    </>
  )
}
