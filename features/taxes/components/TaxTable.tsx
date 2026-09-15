'use client'

import React from 'react'
import { AppIcon } from '@/components/ui/Icon'
import { TaxConfig, TaxFilters } from '../types'
import { TaxPermissions } from '../hooks/useTaxPermissions'

interface TaxTableProps {
  taxes: TaxConfig[]
  permissions: TaxPermissions
  total: number
  filters: TaxFilters
  onPageChange: (page: number) => void
  onSortChange: (sortBy: any) => void
  onSelect: (id: string) => void
  onEdit: (tax: TaxConfig) => void
  onViewProducts: (tax: TaxConfig) => void
  onDeactivate: (tax: TaxConfig) => void
  onActivate: (tax: TaxConfig) => void
  onClearFilters: () => void
  onOpenCreate: () => void
}

export function TaxTable({
  taxes,
  permissions,
  total,
  filters,
  onPageChange,
  onSortChange,
  onSelect,
  onEdit,
  onViewProducts,
  onDeactivate,
  onActivate,
  onClearFilters,
  onOpenCreate,
}: TaxTableProps) {
  const { page, pageSize, sortBy } = filters
  const totalPages = Math.ceil(total / pageSize) || 1

  if (taxes.length === 0) {
    return (
      <div className="table-panel" style={{ padding: '60px 20px', textAlign: 'center' }}>
        <div style={{ display: 'inline-flex', padding: 16, borderRadius: '50%', background: '#eef2fa', color: 'var(--navy)', marginBottom: 16 }}>
          <AppIcon name="taxes" size={32} />
        </div>
        <h3 style={{ margin: '0 0 8px', fontSize: 16 }}>No se encontraron configuraciones de impuestos</h3>
        <p style={{ margin: '0 0 20px', color: 'var(--muted)', fontSize: 13, maxWidth: 460, marginInline: 'auto' }}>
          No existen registros que coincidan con los criterios de búsqueda o filtros seleccionados.
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <button type="button" className="outline-button" onClick={onClearFilters}>
            <AppIcon name="refresh" size={14} />
            <span>Limpiar filtros</span>
          </button>
          {permissions.canCreateTax && (
            <button type="button" className="primary-button compact" onClick={onOpenCreate}>
              <AppIcon name="plus" size={14} />
              <span>Nueva configuración</span>
            </button>
          )}
        </div>
      </div>
    )
  }

  const getVigenciaBadge = (tax: TaxConfig) => {
    const today = new Date().toISOString().split('T')[0]
    if (tax.validUntil && tax.validUntil < today) {
      return <span className="state critico" title="Vigencia finalizada">Vencida</span>
    }
    if (tax.validFrom > today) {
      return <span className="state pendiente" title="Vigencia futura programada">Futura</span>
    }
    return <span className="state disponible" title="Actualmente en vigencia">Vigente</span>
  }

  const getTypeBadgeClass = (type: string) => {
    switch (type) {
      case 'IVA':
        return 'state publicado'
      case 'EXCLUIDO':
        return 'state stock-bajo'
      case 'NO_GRAVADO':
        return 'state'
      case 'OTRO':
      default:
        return 'state pendiente'
    }
  }

  return (
    <div className="table-panel animated-table warehouse-table-panel">
      <div className="table-scroll">
        <table aria-label="Tabla de configuraciones tributarias">
          <thead>
            <tr>
              <th scope="col">
                <button
                  type="button"
                  className="table-sort-btn"
                  onClick={() =>
                    onSortChange(sortBy === 'CODE_ASC' ? 'RATE_DESC' : 'CODE_ASC')
                  }
                  style={{ background: 'none', border: 0, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4, font: 'inherit', color: 'inherit' }}
                >
                  <span>Código</span>
                  <AppIcon name="sort" size={11} />
                </button>
              </th>
              <th scope="col">
                <button
                  type="button"
                  className="table-sort-btn"
                  onClick={() =>
                    onSortChange(sortBy === 'NAME_ASC' ? 'NAME_DESC' : 'NAME_ASC')
                  }
                  style={{ background: 'none', border: 0, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4, font: 'inherit', color: 'inherit' }}
                >
                  <span>Nombre / Descripción</span>
                  <AppIcon name="sort" size={11} />
                </button>
              </th>
              <th scope="col">Tipo</th>
              <th scope="col">
                <button
                  type="button"
                  className="table-sort-btn"
                  onClick={() =>
                    onSortChange(sortBy === 'RATE_DESC' ? 'RATE_ASC' : 'RATE_DESC')
                  }
                  style={{ background: 'none', border: 0, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4, font: 'inherit', color: 'inherit' }}
                >
                  <span>Tarifa (%)</span>
                  <AppIcon name="sort" size={11} />
                </button>
              </th>
              <th scope="col">Vigencia</th>
              <th scope="col">Cuentas Contables</th>
              <th scope="col">
                <button
                  type="button"
                  className="table-sort-btn"
                  onClick={() => onSortChange('PRODUCTS_DESC')}
                  style={{ background: 'none', border: 0, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4, font: 'inherit', color: 'inherit' }}
                >
                  <span>Productos</span>
                  <AppIcon name="sort" size={11} />
                </button>
              </th>
              <th scope="col">Estado</th>
              <th scope="col" style={{ textAlign: 'right' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {taxes.map((tax) => {
              const isExpired = tax.validUntil && tax.validUntil < new Date().toISOString().split('T')[0]

              return (
                <tr
                  key={tax.id}
                  onClick={() => onSelect(tax.id)}
                  title={`Ver detalle de ${tax.name}`}
                  className={tax.status === 'INACTIVE' ? 'opacity-70' : ''}
                >
                  <td>
                    <span className="mono" style={{ fontWeight: 700, color: 'var(--navy)' }}>
                      {tax.code}
                    </span>
                    {tax.isDefault && (
                      <span
                        style={{
                          marginLeft: 6,
                          fontSize: 9,
                          padding: '2px 5px',
                          borderRadius: 4,
                          background: '#eef2fa',
                          color: 'var(--navy)',
                          fontWeight: 700,
                        }}
                      >
                        Predeterminada
                      </span>
                    )}
                  </td>

                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <strong style={{ color: 'var(--foreground)', fontSize: 13 }}>
                        {tax.name}
                      </strong>
                      {tax.description && (
                        <small style={{ color: 'var(--muted)', fontSize: 11, maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {tax.description}
                        </small>
                      )}
                    </div>
                  </td>

                  <td>
                    <span className={getTypeBadgeClass(tax.type)}>
                      <span>{tax.type}</span>
                    </span>
                  </td>

                  <td>
                    <span style={{ fontSize: 14, fontWeight: 800, color: tax.ratePercent > 0 ? 'var(--navy)' : 'var(--muted)' }}>
                      {tax.ratePercent}%
                    </span>
                  </td>

                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {getVigenciaBadge(tax)}
                        <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                          Desde {tax.validFrom}
                        </span>
                      </div>
                      {tax.validUntil && (
                        <small style={{ fontSize: 10, color: isExpired ? 'var(--red)' : 'var(--muted)' }}>
                          Hasta {tax.validUntil}
                        </small>
                      )}
                    </div>
                  </td>

                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: 10 }}>
                      <span title={tax.generatedTaxAccountName || 'Cuenta IVA Generado'}>
                        <b style={{ color: 'var(--navy)' }}>Vta:</b> {tax.generatedTaxAccountId || '240805'}
                      </span>
                      <span title={tax.deductibleTaxAccountName || 'Cuenta IVA Descontable'}>
                        <b style={{ color: 'var(--green)' }}>Cpr:</b> {tax.deductibleTaxAccountId || '240810'}
                      </span>
                    </div>
                  </td>

                  <td>
                    <button
                      type="button"
                      className="outline-button compact"
                      style={{ height: 26, padding: '0 8px', fontSize: 11, borderRadius: 12 }}
                      onClick={(e) => {
                        e.stopPropagation()
                        onViewProducts(tax)
                      }}
                      title="Consultar productos asociados a esta configuración"
                    >
                      <AppIcon name="products" size={12} />
                      <span>{tax.associatedProductsCount || 0} uds</span>
                    </button>
                  </td>

                  <td>
                    {tax.status === 'ACTIVE' ? (
                      <span className="state disponible">
                        <AppIcon name="check" size={12} />
                        <span>Activo</span>
                      </span>
                    ) : (
                      <span className="state" style={{ background: '#f1f5f9', color: '#64748b', borderColor: '#cbd5e1' }}>
                        <span>Inactivo</span>
                      </span>
                    )}
                  </td>

                  <td style={{ textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                    <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                      <button
                        type="button"
                        className="icon-button"
                        style={{ width: 30, height: 30 }}
                        onClick={() => onSelect(tax.id)}
                        title="Ver detalle y trazabilidad"
                        aria-label={`Ver detalle de ${tax.name}`}
                      >
                        <AppIcon name="eye" size={15} />
                      </button>

                      {permissions.canUpdateTax && (
                        <button
                          type="button"
                          className="icon-button"
                          style={{ width: 30, height: 30 }}
                          onClick={() => onEdit(tax)}
                          title="Editar configuración"
                          aria-label={`Editar ${tax.name}`}
                        >
                          <AppIcon name="edit" size={15} />
                        </button>
                      )}

                      {permissions.canDeactivateTax && (
                        tax.status === 'ACTIVE' ? (
                          <button
                            type="button"
                            className="icon-button"
                            style={{ width: 30, height: 30, color: 'var(--red)' }}
                            onClick={() => onDeactivate(tax)}
                            title="Desactivar configuración (protege históricos)"
                            aria-label={`Desactivar ${tax.name}`}
                          >
                            <AppIcon name="powerOff" size={15} />
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="icon-button"
                            style={{ width: 30, height: 30, color: 'var(--green)' }}
                            onClick={() => onActivate(tax)}
                            title="Reactivar configuración"
                            aria-label={`Reactivar ${tax.name}`}
                          >
                            <AppIcon name="check" size={15} />
                          </button>
                        )
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Paginación */}
      <footer
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '14px 20px',
          borderTop: '1px solid var(--line)',
          fontSize: 12,
          color: 'var(--muted)',
        }}
      >
        <div>
          Mostrando <strong>{taxes.length}</strong> de <strong>{total}</strong> configuraciones tributarias
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>Página {page} de {totalPages}</span>
          <button
            type="button"
            className="outline-button compact"
            style={{ height: 30, padding: '0 10px' }}
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            aria-label="Página anterior"
          >
            <AppIcon name="chevronLeft" size={14} />
          </button>
          <button
            type="button"
            className="outline-button compact"
            style={{ height: 30, padding: '0 10px' }}
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
            aria-label="Página siguiente"
          >
            <AppIcon name="chevronRight" size={14} />
          </button>
        </div>
      </footer>
    </div>
  )
}
