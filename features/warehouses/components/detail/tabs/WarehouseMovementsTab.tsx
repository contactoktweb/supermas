'use client'

import React, { useState } from 'react'
import { AppIcon } from '@/components/ui/Icon'
import { WarehouseMovement } from '../../../types'
import { WarehouseEmptyState } from '../../WarehouseEmptyState'

interface WarehouseMovementsTabProps {
  movements: WarehouseMovement[]
  locationName: string
}

export function WarehouseMovementsTab({ movements, locationName }: WarehouseMovementsTabProps) {
  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState('ALL')

  const filtered = movements.filter((m) => {
    const matchQuery =
      m.productName.toLowerCase().includes(query.toLowerCase()) ||
      m.sku.toLowerCase().includes(query.toLowerCase()) ||
      m.documentRef.toLowerCase().includes(query.toLowerCase()) ||
      m.userName.toLowerCase().includes(query.toLowerCase())

    const matchType = typeFilter === 'ALL' || m.type === typeFilter

    return matchQuery && matchType
  })

  return (
    <div className="warehouse-movements-tab page-enter">
      <div className="toolbar">
        <div className="search-box wide">
          <AppIcon name="search" size={16} />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por producto, SKU, documento o usuario..."
            aria-label="Buscar movimientos en Kardex"
          />
        </div>

        <div className="filter-select-wrap">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="filter-select"
            aria-label="Filtrar por tipo de movimiento"
          >
            <option value="ALL">Tipo de movimiento: Todos</option>
            <option value="COMPRA">Compra</option>
            <option value="VENTA">Venta</option>
            <option value="ENTRADA">Entrada de almacén</option>
            <option value="SALIDA">Salida de almacén</option>
            <option value="TRANSFERENCIA_ENTRADA">Transferencia (Entrada)</option>
            <option value="TRANSFERENCIA_SALIDA">Transferencia (Salida)</option>
            <option value="AJUSTE_POSITIVO">Ajuste positivo</option>
            <option value="AJUSTE_NEGATIVO">Ajuste negativo</option>
          </select>
        </div>

        <button
          type="button"
          className="outline-button compact export"
          onClick={() => alert('Exportando Kardex de ' + locationName)}
        >
          <AppIcon name="download" size={14} />
          <span>Exportar Kardex</span>
        </button>
      </div>

      {filtered.length === 0 ? (
        <WarehouseEmptyState
          type="NO_MOVEMENTS"
          customTitle="No hay movimientos registrados"
          customDescription="No se encontraron registros de Kardex que coincidan con los filtros aplicados."
          onAction={() => {
            setQuery('')
            setTypeFilter('ALL')
          }}
          actionLabel="Limpiar filtros"
        />
      ) : (
        <div className="table-panel animated-table">
          <div className="table-scroll">
            <table aria-label="Trazabilidad de movimientos de Kardex">
              <thead>
                <tr>
                  <th>Fecha y hora</th>
                  <th>Producto</th>
                  <th>Tipo</th>
                  <th>Documento</th>
                  <th>Entrada</th>
                  <th>Salida</th>
                  <th>Saldo resultante</th>
                  <th>Usuario</th>
                  <th>Observaciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((m) => (
                  <tr key={m.id}>
                    <td>
                      <span className="time-muted">{m.createdAt}</span>
                    </td>
                    <td>
                      <strong>{m.productName}</strong>
                      <small className="mono">{m.sku}</small>
                    </td>
                    <td>
                      <span
                        className={`movement-badge ${m.type
                          .toLowerCase()
                          .replaceAll('_', '-')}`}
                      >
                        {m.type}
                      </span>
                    </td>
                    <td>
                      <strong className="mono">{m.documentRef}</strong>
                    </td>
                    <td className="positive-text">
                      {m.quantityIn > 0 ? `+${m.quantityIn}` : '—'}
                    </td>
                    <td className="negative-text">
                      {m.quantityOut > 0 ? `-${m.quantityOut}` : '—'}
                    </td>
                    <td>
                      <b>{m.newBalance} uds</b>
                    </td>
                    <td>{m.userName}</td>
                    <td>
                      <small style={{ maxWidth: 220, display: 'inline-block' }}>
                        {m.notes || '—'}
                      </small>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
