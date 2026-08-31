'use client'

import React, { useState } from 'react'
import { Search, Building2, Phone, Mail, FileText } from 'lucide-react'
import { SupplierLocationRelation } from '../../../types'
import { WarehouseEmptyState } from '../../WarehouseEmptyState'

interface WarehouseSuppliersTabProps {
  suppliers: SupplierLocationRelation[]
  canReadCost: boolean
}

export function WarehouseSuppliersTab({
  suppliers,
  canReadCost,
}: WarehouseSuppliersTabProps) {
  const [query, setQuery] = useState('')

  const filtered = suppliers.filter(
    (s) =>
      s.supplierName.toLowerCase().includes(query.toLowerCase()) ||
      s.nit.includes(query) ||
      s.contactName.toLowerCase().includes(query.toLowerCase()) ||
      s.email.toLowerCase().includes(query.toLowerCase())
  )

  return (
    <div className="warehouse-suppliers-tab page-enter">
      <div className="toolbar">
        <div className="search-box wide">
          <Search size={16} />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar proveedor o aliado por nombre, NIT o contacto..."
            aria-label="Buscar proveedores de esta ubicación"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <WarehouseEmptyState
          type="NO_ITEMS"
          customTitle="No hay proveedores asociados"
          customDescription="Los proveedores que despachan a esta bodega se registrarán al recibir compras."
          onAction={() => setQuery('')}
          actionLabel="Limpiar búsqueda"
        />
      ) : (
        <div className="table-panel animated-table">
          <div className="table-scroll">
            <table aria-label="Proveedores asociados a esta bodega (SupplierLocation)">
              <thead>
                <tr>
                  <th>Proveedor / Razón social</th>
                  <th>NIT</th>
                  <th>Contacto</th>
                  <th>Entregas</th>
                  <th>Última entrega</th>
                  <th>Facturas pendientes</th>
                  <th>Saldo por pagar</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <div className="product-cell">
                        <div className="product-thumb">
                          <Building2 size={16} />
                        </div>
                        <div>
                          <strong>{s.supplierName}</strong>
                          <small>{s.email}</small>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="mono">{s.nit}</span>
                    </td>
                    <td>
                      <div>
                        <strong>{s.contactName}</strong>
                        <small>{s.phone}</small>
                      </div>
                    </td>
                    <td>
                      <b>{s.deliveriesCount} despachos</b>
                    </td>
                    <td>
                      <span className="time-muted">{s.lastDeliveryDate}</span>
                    </td>
                    <td>
                      {s.pendingInvoicesCount > 0 ? (
                        <span className="alert-count">
                          {s.pendingInvoicesCount} por pagar
                        </span>
                      ) : (
                        <span className="positive-text">Al día</span>
                      )}
                    </td>
                    <td>
                      <strong>
                        {canReadCost
                          ? `$${s.currentBalance.toLocaleString('es-CO')}`
                          : '••••••••'}
                      </strong>
                    </td>
                    <td>
                      <span
                        className={`state ${
                          s.status === 'ACTIVE'
                            ? 'disponible'
                            : s.status === 'IN_REVIEW'
                            ? 'stock-bajo'
                            : 'agotado'
                        }`}
                      >
                        {s.status === 'ACTIVE'
                          ? 'Activo'
                          : s.status === 'IN_REVIEW'
                          ? 'En revisión'
                          : 'Inactivo'}
                      </span>
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
