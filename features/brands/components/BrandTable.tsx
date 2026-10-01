'use client'

import React from 'react'
import { AppIcon } from '@/components/ui/Icon'
import { BrandWithRelations } from '../types'
import { BrandPermissions } from '../hooks/useBrandPermissions'

interface BrandTableProps {
  brands: BrandWithRelations[]
  permissions: BrandPermissions
  onEdit: (brand: BrandWithRelations) => void
  onToggleActive: (brand: BrandWithRelations) => void
  onDelete: (brand: BrandWithRelations) => void
  isLoading?: boolean
}

export function BrandTable({
  brands,
  permissions,
  onEdit,
  onToggleActive,
  onDelete,
  isLoading,
}: BrandTableProps) {
  if (isLoading) {
    return (
      <div className="table-panel animated-table page-enter">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Marca</th>
                <th>Slug</th>
                <th style={{ textAlign: 'center' }}>Productos Asociados</th>
                <th>Estado</th>
                <th style={{ textAlign: 'right' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {[...Array(6)].map((_, i) => (
                <tr key={i}>
                  <td colSpan={5}>
                    <div
                      style={{
                        height: 24,
                        margin: '8px 0',
                        background: '#f1f5f9',
                        borderRadius: '6px',
                        animation: 'pulse 1.5s infinite',
                      }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  if (brands.length === 0) {
    return (
      <div
        className="table-panel page-enter"
        style={{ padding: '48px 24px', textAlign: 'center' }}
      >
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: '12px',
            background: '#e9eef8',
            color: 'var(--navy)',
            display: 'grid',
            placeItems: 'center',
            margin: '0 auto 14px',
          }}
        >
          <AppIcon name="award" size={24} />
        </div>
        <h3 style={{ margin: '0 0 6px', fontSize: '15px', color: 'var(--foreground)' }}>
          No se encontraron marcas
        </h3>
        <p style={{ margin: 0, color: 'var(--muted)', fontSize: '12px' }}>
          No hay marcas registradas o que coincidan con los filtros aplicados.
        </p>
      </div>
    )
  }

  return (
    <div className="table-panel animated-table page-enter">
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Marca</th>
              <th>Slug</th>
              <th style={{ textAlign: 'center' }}>Productos Asociados</th>
              <th>Estado</th>
              <th style={{ textAlign: 'right' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {brands.map((brand) => {
              const hasProducts = brand.productsCount > 0

              return (
                <tr
                  key={brand.id}
                  style={{
                    opacity: brand.isActive ? 1 : 0.65,
                    transition: 'background 0.15s ease',
                  }}
                >
                  {/* Nombre y Logo / Avatar */}
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      {brand.logoUrl ? (
                        <img
                          src={brand.logoUrl}
                          alt={brand.name}
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: '8px',
                            objectFit: 'contain',
                            border: '1px solid #e2e8f0',
                            background: '#fff',
                          }}
                          onError={(e) => {
                            e.currentTarget.style.display = 'none'
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: '8px',
                            background: '#e9eef8',
                            color: 'var(--navy)',
                            display: 'grid',
                            placeItems: 'center',
                            fontWeight: 700,
                            fontSize: '12px',
                            flexShrink: 0,
                          }}
                        >
                          {brand.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <strong
                          style={{
                            display: 'block',
                            color: 'var(--foreground)',
                            fontSize: '13px',
                          }}
                        >
                          {brand.name}
                        </strong>
                      </div>
                    </div>
                  </td>

                  {/* Slug */}
                  <td>
                    <span className="mono" style={{ color: 'var(--muted)', fontSize: '11px' }}>
                      {brand.slug}
                    </span>
                  </td>

                  {/* Productos asociados */}
                  <td style={{ textAlign: 'center' }}>
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '3px 8px',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: 600,
                        background: hasProducts ? '#e9eef8' : '#f1f5f9',
                        color: hasProducts ? 'var(--navy)' : '#64748b',
                      }}
                      title={`${brand.productsCount} productos con esta marca`}
                    >
                      {brand.productsCount} {brand.productsCount === 1 ? 'producto' : 'productos'}
                    </span>
                  </td>

                  {/* Estado */}
                  <td>
                    <span
                      className={`state ${brand.isActive ? 'disponible' : 'agotado'}`}
                      style={{ textTransform: 'capitalize' }}
                    >
                      <AppIcon name={brand.isActive ? 'check' : 'close'} size={12} />
                      <span>{brand.isActive ? 'Activa' : 'Inactiva'}</span>
                    </span>
                  </td>

                  {/* Acciones */}
                  <td style={{ textAlign: 'right' }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'flex-end',
                        gap: '6px',
                      }}
                    >
                      {permissions.canToggleActive && (
                        <button
                          type="button"
                          className="outline-button compact"
                          style={{
                            height: 30,
                            padding: '0 8px',
                            color: brand.isActive ? '#d97706' : '#059669',
                            borderColor: brand.isActive ? '#fde68a' : '#a7f3d0',
                            background: brand.isActive ? '#fffbeb' : '#ecfdf5',
                          }}
                          onClick={() => onToggleActive(brand)}
                          title={brand.isActive ? 'Desactivar marca' : 'Activar marca'}
                          aria-label={brand.isActive ? 'Desactivar marca' : 'Activar marca'}
                        >
                          <AppIcon name="powerOff" size={13} />
                          <span style={{ fontSize: '11px' }}>
                            {brand.isActive ? 'Desactivar' : 'Activar'}
                          </span>
                        </button>
                      )}

                      {permissions.canEdit && (
                        <button
                          type="button"
                          className="outline-button compact"
                          style={{ height: 30, padding: '0 8px' }}
                          onClick={() => onEdit(brand)}
                          title="Editar marca"
                          aria-label="Editar marca"
                        >
                          <AppIcon name="edit" size={13} />
                          <span style={{ fontSize: '11px' }}>Editar</span>
                        </button>
                      )}

                      {permissions.canDelete && (
                        <button
                          type="button"
                          className="outline-button compact"
                          style={{
                            height: 30,
                            padding: '0 8px',
                            color: 'var(--red)',
                            borderColor: '#fca5a5',
                            background: '#fef2f2',
                          }}
                          onClick={() => onDelete(brand)}
                          title="Eliminar marca"
                          aria-label="Eliminar marca"
                        >
                          <AppIcon name="trash" size={13} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
