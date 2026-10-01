'use client'

import React from 'react'
import { AppIcon } from '@/components/ui/Icon'
import { CategoryWithRelations } from '../types'
import { CategoryPermissions } from '../hooks/useCategoryPermissions'

interface CategoryTableProps {
  categories: CategoryWithRelations[]
  permissions: CategoryPermissions
  onEdit: (category: CategoryWithRelations) => void
  onToggleActive: (category: CategoryWithRelations) => void
  onDelete: (category: CategoryWithRelations) => void
  isLoading?: boolean
}

export function CategoryTable({
  categories,
  permissions,
  onEdit,
  onToggleActive,
  onDelete,
  isLoading,
}: CategoryTableProps) {
  if (isLoading) {
    return (
      <div className="table-responsive-container page-enter">
        <table className="styled-table">
          <thead>
            <tr>
              <th>Categoría / Jerarquía</th>
              <th>Código</th>
              <th>Slug</th>
              <th>Productos</th>
              <th>Subcategorías</th>
              <th>Estado</th>
              <th className="text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {[...Array(6)].map((_, i) => (
              <tr key={i}>
                <td colSpan={7}>
                  <div className="skeleton-line" style={{ height: 24, margin: '8px 0' }} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  if (categories.length === 0) {
    return (
      <div className="empty-state-box page-enter">
        <div className="empty-icon-wrapper">
          <AppIcon name="layers" size={32} />
        </div>
        <h3>No se encontraron categorías</h3>
        <p>No hay categorías registradas o que coincidan con los filtros aplicados.</p>
      </div>
    )
  }

  return (
    <div className="table-responsive-container page-enter">
      <table className="styled-table">
        <thead>
          <tr>
            <th>Categoría / Jerarquía</th>
            <th>Código</th>
            <th>Slug</th>
            <th className="text-center">Productos</th>
            <th className="text-center">Subcategorías</th>
            <th>Estado</th>
            <th className="text-right">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {categories.map((cat) => {
            const hasChildren = cat.childrenCount > 0
            const hasProducts = cat.productsCount > 0
            const isSubcategory = cat.level > 0

            return (
              <tr
                key={cat.id}
                className={`table-row-hover ${!cat.isActive ? 'row-inactive' : ''}`}
              >
                {/* Nombre y nivel jerárquico */}
                <td>
                  <div
                    className="category-title-cell"
                    style={{ paddingLeft: `${cat.level * 20}px` }}
                  >
                    {isSubcategory ? (
                      <span className="tree-branch-indicator" title={`Subcategoría de ${cat.parentName}`}>
                        ↳
                      </span>
                    ) : (
                      <span className="root-category-indicator" title="Categoría raíz">
                        📁
                      </span>
                    )}
                    <div>
                      <strong className="category-name">{cat.name}</strong>
                      {cat.parentName && (
                        <span className="parent-crumb">en {cat.parentName}</span>
                      )}
                      {cat.description && (
                        <p className="category-description-preview">{cat.description}</p>
                      )}
                    </div>
                  </div>
                </td>

                {/* Código */}
                <td>
                  {cat.code ? (
                    <span className="badge badge-subtle mono">{cat.code}</span>
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </td>

                {/* Slug */}
                <td>
                  <span className="mono text-muted text-sm">{cat.slug}</span>
                </td>

                {/* Productos asociados */}
                <td className="text-center">
                  <span
                    className={`badge ${hasProducts ? 'badge-info' : 'badge-muted'}`}
                    title={`${cat.productsCount} productos en esta categoría`}
                  >
                    {cat.productsCount} {cat.productsCount === 1 ? 'prod.' : 'prods.'}
                  </span>
                </td>

                {/* Subcategorías hijas */}
                <td className="text-center">
                  {hasChildren ? (
                    <span className="badge badge-accent">
                      {cat.childrenCount} subcat.
                    </span>
                  ) : (
                    <span className="text-muted text-sm">—</span>
                  )}
                </td>

                {/* Estado */}
                <td>
                  <span
                    className={`status-pill ${
                      cat.isActive ? 'status-pill-success' : 'status-pill-neutral'
                    }`}
                  >
                    <span className="status-dot" />
                    {cat.isActive ? 'Activa' : 'Inactiva'}
                  </span>
                </td>

                {/* Acciones */}
                <td className="text-right">
                  <div className="table-actions-group">
                    {permissions.canToggleActive && (
                      <button
                        type="button"
                        className="btn-action-icon"
                        onClick={() => onToggleActive(cat)}
                        title={cat.isActive ? 'Desactivar categoría' : 'Activar categoría'}
                        aria-label={cat.isActive ? 'Desactivar categoría' : 'Activar categoría'}
                      >
                        <AppIcon
                          name="powerOff"
                          size={15}
                          className={cat.isActive ? 'text-amber' : 'text-emerald'}
                        />
                      </button>
                    )}

                    {permissions.canEdit && (
                      <button
                        type="button"
                        className="btn-action-icon"
                        onClick={() => onEdit(cat)}
                        title="Editar categoría"
                        aria-label="Editar categoría"
                      >
                        <AppIcon name="edit" size={15} />
                      </button>
                    )}

                    {permissions.canDelete && (
                      <button
                        type="button"
                        className="btn-action-icon btn-action-danger"
                        onClick={() => onDelete(cat)}
                        title="Eliminar categoría"
                        aria-label="Eliminar categoría"
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
