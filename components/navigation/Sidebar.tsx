'use client'

import React, { useState, useEffect, useLayoutEffect, useMemo } from 'react'
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
      <img
        src="/logo-super-white.webp"
        alt="Super Más"
        style={{ height: '32px', width: 'auto', objectFit: 'contain' }}
      />
      <span>ERP / POS</span>
    </div>
  )
}

// Cada página monta su propio AppShell, así que el Sidebar se vuelve a montar en cada navegación.
// La posición del menú se restaura ANTES de pintar (useLayoutEffect) para que no se vea el salto al inicio.
const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect

let cachedSidebarScrollTop = 0
let cachedExpandedSections: Record<string, boolean> | null = null

const SIDEBAR_SCROLL_KEY = 'supermas_sidebar_scroll_top'
const SIDEBAR_EXPANDED_KEY = 'supermas_sidebar_expanded_sections'

export function Sidebar({ open = false, onClose, currentPath, onLogout }: SidebarProps) {
  const pathname = usePathname()
  const effectivePath = currentPath || pathname || '/'
  const { user, hasPermission, signOut } = useAuth()
  const navRef = React.useRef<HTMLElement>(null)

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

  // Estado de secciones expandidas / colapsadas persistido
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>(() => {
    if (cachedExpandedSections) {
      if (activeSectionId) cachedExpandedSections[activeSectionId] = true
      return { ...cachedExpandedSections }
    }

    if (typeof window !== 'undefined') {
      try {
        const stored = sessionStorage.getItem(SIDEBAR_EXPANDED_KEY)
        if (stored) {
          const parsed = JSON.parse(stored)
          if (activeSectionId) parsed[activeSectionId] = true
          cachedExpandedSections = parsed
          return parsed
        }
      } catch {
        // Fallback a defaults si falla sessionStorage
      }
    }

    const initial: Record<string, boolean> = {
      inventario: true,
      compras: true,
      'clientes-cartera': true,
      ventas: true,
      canales: false,
      contabilidad: false,
      gestion: false,
      administracion: false,
    }
    if (activeSectionId) {
      initial[activeSectionId] = true
    }
    cachedExpandedSections = initial
    return initial
  })

  // Sincronizar auto-expansión al cambiar de ruta
  useEffect(() => {
    if (activeSectionId) {
      setExpandedSections((prev) => {
        if (prev[activeSectionId]) return prev
        const updated = { ...prev, [activeSectionId]: true }
        cachedExpandedSections = updated
        try {
          sessionStorage.setItem(SIDEBAR_EXPANDED_KEY, JSON.stringify(updated))
        } catch {}
        return updated
      })
    }
  }, [activeSectionId])

  // Restaurar y mantener posición de scroll del Sidebar (antes del primer pintado)
  useIsomorphicLayoutEffect(() => {
    if (navRef.current) {
      let targetScroll = cachedSidebarScrollTop
      if (targetScroll === 0 && typeof window !== 'undefined') {
        const storedScroll = sessionStorage.getItem(SIDEBAR_SCROLL_KEY)
        if (storedScroll) {
          targetScroll = parseInt(storedScroll, 10) || 0
          cachedSidebarScrollTop = targetScroll
        }
      }
      if (targetScroll > 0) {
        navRef.current.scrollTop = targetScroll
      }
    }
  }, [effectivePath])

  const handleNavScroll = (e: React.UIEvent<HTMLElement>) => {
    const top = e.currentTarget.scrollTop
    cachedSidebarScrollTop = top
    try {
      sessionStorage.setItem(SIDEBAR_SCROLL_KEY, String(top))
    } catch {}
  }

  const toggleSection = (sectionId: string, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setExpandedSections((prev) => {
      const updated = {
        ...prev,
        [sectionId]: !prev[sectionId],
      }
      cachedExpandedSections = updated
      try {
        sessionStorage.setItem(SIDEBAR_EXPANDED_KEY, JSON.stringify(updated))
      } catch {}
      return updated
    })
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
    if (navRef.current) {
      const currentScroll = navRef.current.scrollTop
      cachedSidebarScrollTop = currentScroll
      try {
        sessionStorage.setItem(SIDEBAR_SCROLL_KEY, String(currentScroll))
      } catch {}
    }
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

        <nav ref={navRef} onScroll={handleNavScroll}>
          <p className="nav-caption">Menú principal</p>

          {/* Módulo independiente: Dashboard */}
          <Link
            href={DASHBOARD_ITEM.path}
            scroll={false}
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
                          scroll={false}
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
