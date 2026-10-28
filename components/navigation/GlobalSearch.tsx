'use client'

import React, { useState, useEffect, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { AppIcon, LightIconName } from '@/components/ui/Icon'
import { APP_MODULES } from './modules'
import { searchRecords, type SearchResultItem } from './global-search-sources'

// Mock database sources

interface GlobalSearchProps {
  onNavigate?: (view: string) => void
  className?: string
  placeholder?: string
}


const MODULE_KEYWORDS: Record<string, string> = {
  'Dashboard': 'inicio resumen métricas indicadores ventas compras',
  'Bodegas': 'almacén cedi sucursal ubicaciones estantes sedes stock',
  'Productos': 'artículos mercancía catálogo precios items sku código',
  'Categorías': 'clasificación subcategorías catálogo familias jerarquía grupos',
  'Marcas': 'fabricantes marcas comerciales sellos etiquetas marcas',
  'Inventario': 'existencias stock conteo físico auditoría valorizado',
  'Kardex': 'movimientos entradas salidas trazabilidad transacciones kardex',
  'Transferencias': 'traslados despachos entre bodegas reubicación envíos internos',
  'Compras': 'órdenes de compra proveedores recepciones facturas gasto insumos',
  'Órdenes de compra': 'órdenes de compra pedidos proveedores suministros compras orden',
  'Proveedores': 'distribuidores fabricantes contactos nit compras',
  'Clientes': 'compradores cartera mayoristas nit cc crédito pagos',
  'Ventas': 'pedidos cotizaciones órdenes facturas pos caja mostrador',
  'POS': 'punto de venta caja rápida cajero ticket scanner mostrador',
  'Facturación': 'factura electrónica dian cufe resolución notas crédito débito fe',
  'Remisiones': 'despacho remitos entregas transportes guías de remisión',
  'Cajas': 'arqueo cierre de caja turnos sesiones dinero efectivo base',
  'Tesorería': 'bancos cuentas cheques transferencias egresos ingresos flujo',
  'Contabilidad': 'asientos contables puc plan de cuentas balance libro mayor',
  'Impuestos': 'iva retefuente retenciones ica dian declaraciones',
  'Exógena': 'medios magnéticos dian formato 1001 1003 información',
  'Pedidos Web': 'ecommerce tienda virtual online carrito pedidos',
  'Catálogo Super Más': 'tienda pública retail catálogo digital',
  'Catálogo Distribuidora': 'mayorista b2b distribución catálogo',
  'Reportes': 'informes analítica estadísticas gráficos excel pdf',
  'Alertas': 'notificaciones avisos stock bajo vencimientos urgentes cartera',
  'Auditoría': 'logs historial de cambios usuarios eventos seguridad',
  'Usuarios': 'personal cajeros operadores roles credenciales accesos',
  'Roles': 'perfiles permisos niveles privilegios accesos funciones roles',
  'Devoluciones': 'anulaciones notas crédito retorno mercancía devolución garantías',
  'Recepciones': 'entradas de compras ingreso mercancía recepción remisión proveedor',
  'Cuentas por cobrar': 'cartera saldos pendientes clientes cartera vencida abonos',
  'Cuentas por Pagar': 'deuda proveedores pagos pendientes vencimientos cxp',
  'Pagos recibidos': 'recaudos recibos de caja abonos cobros consignaciones',
  'Estado de cuenta': 'extracto cliente balance historial cartera movimientos',
  'Configuración': 'ajustes empresa datos generales consecutivo parámetros',
}

const SEARCH_DEBOUNCE_MS = 250

function normalize(text: string): string {
  return (text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

export function GlobalSearch({
  onNavigate,
  className = '',
  placeholder = 'Buscar en el sistema... (Ctrl+K)',
}: GlobalSearchProps) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Listen for Ctrl+K / Cmd+K global shortcut
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
        setIsOpen(true)
      } else if (e.key === 'Escape' && isOpen) {
        setIsOpen(false)
        inputRef.current?.blur()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen])

  // Handle clicking outside to dismiss
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Módulos del menú (búsqueda local, inmediata)
  const moduleResults = useMemo(() => {
    const q = normalize(query)
    if (!q) return []

    const list: SearchResultItem[] = []

    // Módulos cuyo nombre o palabras clave coinciden
    APP_MODULES.forEach(([name, icon, route]) => {
      const keywords = MODULE_KEYWORDS[name] || ''
      const matchScore =
        normalize(name).includes(q) ? 2 : normalize(keywords).includes(q) ? 1 : 0

      if (matchScore > 0) {
        list.push({
          id: `mod-${name}`,
          category: 'modules',
          categoryLabel: 'Módulos del Sistema',
          title: name,
          subtitle: `Acceder a la sección de ${name}`,
          iconName: icon,
          destinationView: name,
          destinationRoute: route,
          badge: 'Módulo',
          badgeTone: 'blue',
        })
      }
    })

    return list
  }, [query])

  // Registros de la base (productos, clientes, proveedores, facturas, remisiones y bodegas)
  const [recordResults, setRecordResults] = useState<SearchResultItem[]>([])
  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) {
      setRecordResults([])
      return
    }
    let active = true
    const timer = setTimeout(() => {
      searchRecords(q)
        .then((found) => {
          if (active) setRecordResults(found)
        })
        .catch(() => {
          if (active) setRecordResults([])
        })
    }, SEARCH_DEBOUNCE_MS)
    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [query])

  const results = useMemo(() => [...moduleResults, ...recordResults], [moduleResults, recordResults])

  // Quick shortcuts when query is empty
  const quickModules = useMemo(() => {
    return [
      { name: 'Ventas', icon: 'sales', route: '/ventas', desc: 'Facturación y pedidos de venta' },
      { name: 'Facturación', icon: 'invoices', route: '/facturacion', desc: 'Factura electrónica DIAN' },
      { name: 'Inventario', icon: 'inventory', route: '/inventario', desc: 'Stock y existencias físicas' },
      { name: 'Kardex', icon: 'kardex', route: '/kardex', desc: 'Trazabilidad y movimientos' },
      { name: 'Clientes', icon: 'customers', route: '/clientes', desc: 'Directorio y cartera de clientes' },
      { name: 'Compras', icon: 'purchases', route: '/compras', desc: 'Proveedores y recepciones' },
      { name: 'Bodegas', icon: 'warehouse', route: '/bodegas', desc: 'Gestión y control de sedes' },
      { name: 'Alertas', icon: 'alerts', route: '/alertas', desc: 'Avisos y notificaciones críticas' },
    ] as const
  }, [])

  const handleSelect = (item: SearchResultItem | { name: string; route: string }) => {
    setIsOpen(false)
    setQuery('')
    inputRef.current?.blur()

    const viewName = 'destinationView' in item ? item.destinationView : item.name
    const targetRoute = 'destinationRoute' in item ? item.destinationRoute : item.route

    if (onNavigate) {
      onNavigate(viewName)
    } else {
      router.push(targetRoute)
    }
  }

  // Keyboard navigation inside dropdown
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown') {
        setIsOpen(true)
      }
      return
    }

    const totalItems = query ? results.length : quickModules.length
    if (totalItems === 0) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((prev) => (prev + 1) % totalItems)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((prev) => (prev - 1 + totalItems) % totalItems)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (query && results[selectedIndex]) {
        handleSelect(results[selectedIndex])
      } else if (!query && quickModules[selectedIndex]) {
        handleSelect(quickModules[selectedIndex])
      }
    }
  }

  return (
    <div
      ref={containerRef}
      className={`global-search-container ${className}`}
      style={{ position: 'relative', width: '100%', maxWidth: '380px' }}
    >
      <div
        className="search-box global-search-input-box"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '9px',
          padding: '9px 12px',
          border: '1px solid var(--line, #e2e8f0)',
          borderRadius: '10px',
          background: '#fff',
          boxShadow: isOpen ? '0 0 0 3px rgba(0, 27, 92, 0.08)' : 'none',
          transition: 'all 0.2s ease',
          width: '100%',
        }}
      >
        <AppIcon name="search" size={16} />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setIsOpen(true)
            setSelectedIndex(0)
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          aria-label="Buscar en el sistema"
          style={{
            flex: 1,
            border: 'none',
            outline: 'none',
            fontSize: '12px',
            color: 'var(--foreground, #1e293b)',
            background: 'transparent',
            minWidth: 0,
          }}
        />
        {query ? (
          <button
            type="button"
            onClick={() => {
              setQuery('')
              inputRef.current?.focus()
            }}
            aria-label="Limpiar búsqueda"
            style={{
              border: 'none',
              background: 'transparent',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: '2px',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <AppIcon name="close" size={14} />
          </button>
        ) : (
          <kbd
            style={{
              padding: '2px 5px',
              fontSize: '10px',
              fontWeight: 700,
              color: '#94a3b8',
              backgroundColor: '#f1f5f9',
              border: '1px solid #e2e8f0',
              borderRadius: '5px',
              pointerEvents: 'none',
              lineHeight: 1,
            }}
          >
            ⌘K
          </kbd>
        )}
      </div>

      {/* Dropdown Results */}
      {isOpen && (
        <div
          className="global-search-dropdown"
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            // Alineado a la derecha del buscador para que no se salga de la pantalla en 1280 px.
            right: 0,
            width: 'min(92vw, 480px)',
            maxHeight: '440px',
            overflowY: 'auto',
            background: '#ffffff',
            borderRadius: '14px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 20px 40px -10px rgba(0, 27, 92, 0.22), 0 0 1px rgba(0,0,0,0.1)',
            zIndex: 99999,
            padding: '8px',
            animation: 'fadeInScale 0.15s ease-out',
          }}
        >
          {query.trim() === '' ? (
            /* Quick Access View */
            <div>
              <div
                style={{
                  padding: '6px 10px 8px',
                  fontSize: '11px',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.8px',
                  color: '#64748b',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <span>Accesos Rápidos</span>
                <span style={{ fontSize: '10px', fontWeight: 500, color: '#94a3b8' }}>
                  Escribe para buscar cualquier cosa
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                {quickModules.map((m, index) => {
                  const isSelected = selectedIndex === index
                  return (
                    <button
                      key={m.name}
                      type="button"
                      onClick={() => handleSelect(m)}
                      onMouseEnter={() => setSelectedIndex(index)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        padding: '9px 12px',
                        borderRadius: '9px',
                        border: 'none',
                        background: isSelected ? '#f1f5f9' : 'transparent',
                        textAlign: 'left',
                        cursor: 'pointer',
                        transition: 'background 0.15s ease',
                        width: '100%',
                      }}
                    >
                      <div
                        style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '8px',
                          background: isSelected ? 'var(--navy, #001b5c)' : '#e9eef8',
                          color: isSelected ? '#ffffff' : 'var(--navy, #001b5c)',
                          display: 'grid',
                          placeItems: 'center',
                          flexShrink: 0,
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <AppIcon name={m.icon as LightIconName} size={16} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <strong
                          style={{
                            display: 'block',
                            fontSize: '12px',
                            color: '#0f172a',
                            fontWeight: 700,
                          }}
                        >
                          {m.name}
                        </strong>
                        <span
                          style={{
                            display: 'block',
                            fontSize: '11px',
                            color: '#64748b',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {m.desc}
                        </span>
                      </div>
                      <AppIcon name="chevronRight" size={14} className="text-slate-400" />
                    </button>
                  )
                })}
              </div>
            </div>
          ) : results.length === 0 ? (
            /* No Results Found View */
            <div style={{ padding: '32px 16px', textAlign: 'center' }}>
              <div
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '12px',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  color: '#94a3b8',
                  display: 'grid',
                  placeItems: 'center',
                  margin: '0 auto 12px',
                }}
              >
                <AppIcon name="search" size={20} />
              </div>
              <p style={{ margin: '0 0 4px', fontSize: '13px', fontWeight: 700, color: '#1e293b' }}>
                Sin resultados para &ldquo;{query}&rdquo;
              </p>
              <p style={{ margin: 0, fontSize: '11px', color: '#64748b' }}>
                Prueba buscando por nombre de módulo, producto, SKU, NIT, cliente o bodega.
              </p>
            </div>
          ) : (
            /* Categorized Search Results View */
            <div>
              <div
                style={{
                  padding: '6px 10px 8px',
                  fontSize: '11px',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.8px',
                  color: '#64748b',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderBottom: '1px solid #f1f5f9',
                  marginBottom: '6px',
                }}
              >
                <span>Resultados ({results.length})</span>
                <span style={{ fontSize: '10px', fontWeight: 500, color: '#94a3b8' }}>
                  ↑↓ para navegar • Enter para ir
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                {results.map((item, index) => {
                  const isSelected = selectedIndex === index
                  const badgeBg =
                    item.badgeTone === 'green'
                      ? '#ecfdf5'
                      : item.badgeTone === 'amber'
                      ? '#fffbeb'
                      : item.badgeTone === 'red'
                      ? '#fef2f2'
                      : item.badgeTone === 'gray'
                      ? '#f1f5f9'
                      : '#eff6ff'
                  const badgeColor =
                    item.badgeTone === 'green'
                      ? '#059669'
                      : item.badgeTone === 'amber'
                      ? '#d97706'
                      : item.badgeTone === 'red'
                      ? '#dc2626'
                      : item.badgeTone === 'gray'
                      ? '#475569'
                      : '#2563eb'

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleSelect(item)}
                      onMouseEnter={() => setSelectedIndex(index)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        padding: '8px 12px',
                        borderRadius: '9px',
                        border: 'none',
                        background: isSelected ? '#f1f5f9' : 'transparent',
                        textAlign: 'left',
                        cursor: 'pointer',
                        transition: 'background 0.12s ease',
                        width: '100%',
                      }}
                    >
                      <div
                        style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '8px',
                          background: isSelected ? 'var(--navy, #001b5c)' : '#eef2f9',
                          color: isSelected ? '#ffffff' : 'var(--navy, #001b5c)',
                          display: 'grid',
                          placeItems: 'center',
                          flexShrink: 0,
                          transition: 'all 0.12s ease',
                        }}
                      >
                        <AppIcon name={item.iconName} size={16} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <strong
                            style={{
                              fontSize: '12px',
                              color: '#0f172a',
                              fontWeight: 700,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {item.title}
                          </strong>
                          {item.badge && (
                            <span
                              style={{
                                padding: '2px 6px',
                                borderRadius: '4px',
                                fontSize: '10px',
                                fontWeight: 700,
                                backgroundColor: badgeBg,
                                color: badgeColor,
                                whiteSpace: 'nowrap',
                                flexShrink: 0,
                              }}
                            >
                              {item.badge}
                            </span>
                          )}
                        </div>
                        <span
                          style={{
                            display: 'block',
                            fontSize: '11px',
                            color: '#64748b',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            marginTop: '2px',
                          }}
                        >
                          {item.subtitle}
                        </span>
                      </div>
                      <span
                        style={{
                          fontSize: '10px',
                          fontWeight: 600,
                          color: '#94a3b8',
                          flexShrink: 0,
                          padding: '2px 6px',
                          borderRadius: '4px',
                          backgroundColor: '#f8fafc',
                        }}
                      >
                        {item.categoryLabel}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
