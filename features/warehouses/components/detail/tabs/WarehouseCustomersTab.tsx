'use client'

import React, { useState } from 'react'
import { Search, Users, Phone, Mail, FileText } from 'lucide-react'
import { CustomerLocationRelation } from '../../../types'
import { WarehouseEmptyState } from '../../WarehouseEmptyState'

interface WarehouseCustomersTabProps {
  customers: CustomerLocationRelation[]
}

export function WarehouseCustomersTab({ customers }: WarehouseCustomersTabProps) {
  const [query, setQuery] = useState('')

  const filtered = customers.filter(
    (c) =>
      c.customerName.toLowerCase().includes(query.toLowerCase()) ||
      c.documentNumber.includes(query) ||
      c.email.toLowerCase().includes(query.toLowerCase()) ||
      c.phone.includes(query)
  )

  return (
    <div className="warehouse-customers-tab page-enter">
      <div className="toolbar">
        <div className="search-box wide">
          <Search size={16} />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar cliente frecuente por nombre, NIT/CC o teléfono..."
            aria-label="Buscar clientes de esta ubicación"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <WarehouseEmptyState
          type="NO_ITEMS"
          customTitle="No hay clientes frecuentes registrados"
          customDescription="Los clientes asociados a esta ubicación aparecerán cuando registren compras directas."
          onAction={() => setQuery('')}
          actionLabel="Limpiar búsqueda"
        />
      ) : (
        <div className="table-panel animated-table">
          <div className="table-scroll">
            <table aria-label="Clientes frecuentes de esta ubicación (CustomerLocationRelation)">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Documento</th>
                  <th>Contacto</th>
                  <th>Compras registradas</th>
                  <th>Última compra</th>
                  <th>Total comprado</th>
                  <th>Saldo / Cartera</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <div className="product-cell">
                        <div className="product-thumb">
                          <Users size={16} />
                        </div>
                        <div>
                          <strong>{c.customerName}</strong>
                          <small>{c.email}</small>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="mono">
                        {c.documentType} {c.documentNumber}
                      </span>
                    </td>
                    <td>
                      <span>{c.phone}</span>
                    </td>
                    <td>
                      <b>{c.purchasesCount} facturas</b>
                    </td>
                    <td>
                      <span className="time-muted">{c.lastPurchaseDate}</span>
                    </td>
                    <td>
                      <strong>${c.totalPurchased.toLocaleString('es-CO')}</strong>
                    </td>
                    <td>
                      <span className={c.currentBalance > 0 ? 'warning-text' : 'positive-text'}>
                        ${c.currentBalance.toLocaleString('es-CO')}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`state ${
                          c.status === 'ACTIVE'
                            ? 'disponible'
                            : c.status === 'CREDIT_HOLD'
                            ? 'stock-bajo'
                            : 'agotado'
                        }`}
                      >
                        {c.status === 'ACTIVE'
                          ? 'Al día'
                          : c.status === 'CREDIT_HOLD'
                          ? 'Cartera pendiente'
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
