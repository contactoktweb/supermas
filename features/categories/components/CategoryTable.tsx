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
      <div className="table-panel animated-table page-enter">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Categoría / Jerarquía</th>
                <th>Código</th>
                <th>Slug</th>
                <th>Productos</th>
                <th>Subcategorías</th>
                <th>Estado</th>
                <th style={{ textAlign: 'right' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {[...Array(6)].map((_, i) => (
                <tr key={i}>
                  <td colSpan={7}>
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

  if (categories.length === 0) {
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
          <AppIcon name="layers" size={24} />
        </div>
        <h3 style={{ margin: '0 0 6px', fontSize: '15px', color: 'var(--foreground)' }}>
          No se encontraron categorías
        </h3>
        <p style={{ margin: 0, color: 'var(--muted)', fontSize: '12px' }}>
          No hay categorías registradas o que coincidan con los filtros aplicados.
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
              <th>Categoría / Jerarquía</th>
              <th>Código</th>
              <th>Slug</th>
              <th style={{ textAlign: 'center' }}>Productos</th>
              <th style={{ textAlign: 'center' }}>Subcategorías</th>
              <th>Estado</th>
              <th style={{ textAlign: 'right' }}>Acciones</th>
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
                  style={{
                    opacity: cat.isActive ? 1 : 0.65,
                    transition: 'background 0.15s ease',
                  }}
                >
                  {/* Nombre y nivel jerárquico */}
                  <td>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        paddingLeft: `${cat.level * 22}px`,
                      }}
                    >
                      <div
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: '8px',
                          background: isSubcategory ? '#f8fafc' : '#e9eef8',
                          color: isSubcategory ? '#64748b' : 'var(--navy)',
                          display: 'grid',
                          placeItems: 'center',
                          flexShrink: 0,
                          fontSize: '14px',
                        }}
                      >
                        {isSubcategory ? '↳' : <AppIcon name="layers" size={16} />}
                      </div>
                      <div>
                        <strong
                          style={{
                            display: 'block',
                            color: 'var(--foreground)',
                            fontSize: '13px',
                          }}
                        >
                          {cat.name}
                        </strong>
                        {cat.parentName && (
                          <span
                            style={{
                              fontSize: '10px',
                              color: 'var(--muted)',
                              display: 'block',
                            }}
                          >
                            en {cat.parentName}
                          </span>
                        )}
                        {cat.description && (
                          <p
                            style={{
                              margin: '2px 0 0',
                              fontSize: '11px',
                              color: 'var(--muted)',
                              maxWidth: 320,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {cat.description}
                          </p>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Código */}
                  <td>
                    {cat.code ? (
                      <span
                        className="mono"
                        style={{
                          padding: '3px 7px',
                          borderRadius: '5px',
                          background: '#f1f5f9',
                          color: 'var(--navy)',
                          fontWeight: 700,
                          fontSize: '11px',
                        }}
                      >
                        {cat.code}
                      </span>
                    ) : (
                      <span style={{ color: 'var(--muted)' }}>—</span>
                    )}
                  </td>

                  {/* Slug */}
                  <td>
                    <span className="mono" style={{ color: 'var(--muted)', fontSize: '11px' }}>
                      {cat.slug}
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
                      title={`${cat.productsCount} productos vinculados`}
                    >
                      {cat.productsCount} {cat.productsCount === 1 ? 'prod.' : 'prods.'}
                    </span>
                  </td>

                  {/* Subcategorías hijas */}
                  <td style={{ textAlign: 'center' }}>
                    {hasChildren ? (
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          fontSize: '11px',
                          fontWeight: 600,
                          background: '#ecfdf5',
                          color: '#059669',
                          border: '1px solid #a7f3d0',
                        }}
                      >
                        {cat.childrenCount} subcat.
                      </span>
                    ) : (
                      <span style={{ color: 'var(--muted)', fontSize: '11px' }}>—</span>
                    )}
                  </td>

                  {/* Estado */}
                  <td>
                    <span
                      className={`state ${cat.isActive ? 'disponible' : 'agotado'}`}
                      style={{ textTransform: 'capitalize' }}
                    >
                      <AppIcon name={cat.isActive ? 'check' : 'close'} size={12} />
                      <span>{cat.isActive ? 'Activa' : 'Inactiva'}</span>
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
                            color: cat.isActive ? '#d97706' : '#059669',
                            borderColor: cat.isActive ? '#fde68a' : '#a7f3d0',
                            background: cat.isActive ? '#fffbeb' : '#ecfdf5',
                          }}
                          onClick={() => onToggleActive(cat)}
                          title={cat.isActive ? 'Desactivar categoría' : 'Activar categoría'}
                          aria-label={cat.isActive ? 'Desactivar categoría' : 'Activar categoría'}
                        >
                          <AppIcon name="powerOff" size={13} />
                          <span style={{ fontSize: '11px' }}>
                            {cat.isActive ? 'Desactivar' : 'Activar'}
                          </span>
                        </button>
                      )}

                      {permissions.canEdit && (
                        <button
                          type="button"
                          className="outline-button compact"
                          style={{ height: 30, padding: '0 8px' }}
                          onClick={() => onEdit(cat)}
                          title="Editar categoría"
                          aria-label="Editar categoría"
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
                          onClick={() => onDelete(cat)}
                          title="Eliminar categoría"
                          aria-label="Eliminar categoría"
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
