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
      <div className="table-responsive-container page-enter">
        <table className="styled-table">
          <thead>
            <tr>
              <th>Marca</th>
              <th>Slug</th>
              <th className="text-center">Productos Asociados</th>
              <th>Estado</th>
              <th className="text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {[...Array(6)].map((_, i) => (
              <tr key={i}>
                <td colSpan={5}>
                  <div className="skeleton-line" style={{ height: 24, margin: '8px 0' }} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  if (brands.length === 0) {
    return (
      <div className="empty-state-box page-enter">
        <div className="empty-icon-wrapper">
          <AppIcon name="award" size={32} />
        </div>
        <h3>No se encontraron marcas</h3>
        <p>No hay marcas registradas o que coincidan con los filtros aplicados.</p>
      </div>
    )
  }

  return (
    <div className="table-responsive-container page-enter">
      <table className="styled-table">
        <thead>
          <tr>
            <th>Marca</th>
            <th>Slug</th>
            <th className="text-center">Productos Asociados</th>
            <th>Estado</th>
            <th className="text-right">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {brands.map((brand) => {
            const hasProducts = brand.productsCount > 0

            return (
              <tr
                key={brand.id}
                className={`table-row-hover ${!brand.isActive ? 'row-inactive' : ''}`}
              >
                {/* Nombre y Logo / Avatar */}
                <td>
                  <div className="brand-identity-cell">
                    {brand.logoUrl ? (
                      <img
                        src={brand.logoUrl}
                        alt={brand.name}
                        className="brand-logo-thumb"
                        onError={(e) => {
                          // Fallback si la imagen no carga
                          e.currentTarget.style.display = 'none'
                        }}
                      />
                    ) : (
                      <div className="brand-initial-avatar">
                        {brand.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <strong className="brand-name">{brand.name}</strong>
                    </div>
                  </div>
                </td>

                {/* Slug */}
                <td>
                  <span className="mono text-muted text-sm">{brand.slug}</span>
                </td>

                {/* Productos asociados */}
                <td className="text-center">
                  <span
                    className={`badge ${hasProducts ? 'badge-info' : 'badge-muted'}`}
                    title={`${brand.productsCount} productos con esta marca`}
                  >
                    {brand.productsCount} {brand.productsCount === 1 ? 'producto' : 'productos'}
                  </span>
                </td>

                {/* Estado */}
                <td>
                  <span
                    className={`status-pill ${
                      brand.isActive ? 'status-pill-success' : 'status-pill-neutral'
                    }`}
                  >
                    <span className="status-dot" />
                    {brand.isActive ? 'Activa' : 'Inactiva'}
                  </span>
                </td>

                {/* Acciones */}
                <td className="text-right">
                  <div className="table-actions-group">
                    {permissions.canToggleActive && (
                      <button
                        type="button"
                        className="btn-action-icon"
                        onClick={() => onToggleActive(brand)}
                        title={brand.isActive ? 'Desactivar marca' : 'Activar marca'}
                        aria-label={brand.isActive ? 'Desactivar marca' : 'Activar marca'}
                      >
                        <AppIcon
                          name="powerOff"
                          size={15}
                          className={brand.isActive ? 'text-amber' : 'text-emerald'}
                        />
                      </button>
                    )}

                    {permissions.canEdit && (
                      <button
                        type="button"
                        className="btn-action-icon"
                        onClick={() => onEdit(brand)}
                        title="Editar marca"
                        aria-label="Editar marca"
                      >
                        <AppIcon name="edit" size={15} />
                      </button>
                    )}

                    {permissions.canDelete && (
                      <button
                        type="button"
                        className="btn-action-icon btn-action-danger"
                        onClick={() => onDelete(brand)}
                        title="Eliminar marca"
                        aria-label="Eliminar marca"
                      >
                        <AppIcon name="trash" size={15} />
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
  )
}
