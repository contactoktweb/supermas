'use client'

import React, { useState, useEffect } from 'react'
import { POSCustomer } from '../types'
import { AppIcon } from '@/components/ui/Icon'

interface POSCustomerModalProps {
  isOpen: boolean
  onClose: () => void
  currentCustomer: POSCustomer | null
  onSelectCustomer: (customer: POSCustomer) => void
  onSearch: (query: string) => void
  searchResults: POSCustomer[]
}

export const POSCustomerModal: React.FC<POSCustomerModalProps> = ({
  isOpen,
  onClose,
  currentCustomer,
  onSelectCustomer,
  onSearch,
  searchResults,
}) => {
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    if (isOpen) {
      setSearchTerm('')
      onSearch('')
    }
  }, [isOpen, onSearch])

  if (!isOpen) return null

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setSearchTerm(val)
    onSearch(val)
  }

  const handleSelect = (customer: POSCustomer) => {
    onSelectCustomer(customer)
    onClose()
  }

  return (
    <div className="drawer-backdrop modal-center" onClick={onClose}>
      <div
        className="modal-card animate-scale-up"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="customer-modal-title"
        style={{
          width: 'min(100%, 580px)',
          background: '#ffffff',
          borderRadius: 16,
          boxShadow: '0 24px 50px rgba(0, 27, 92, 0.22)',
          padding: 24,
          maxHeight: '88vh',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          border: '1px solid var(--line)',
        }}
      >
        {/* Modal Header */}
        <div className="modal-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div className="modal-header-title" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              className="modal-icon-badge"
              style={{
                width: 42,
                height: 42,
                borderRadius: 10,
                background: '#edf2fa',
                display: 'grid',
                placeItems: 'center',
                flexShrink: 0,
              }}
            >
              <AppIcon name="users" size={20} color="var(--navy)" />
            </div>
            <div>
              <h3 id="customer-modal-title" style={{ margin: 0, fontSize: 17, fontWeight: 800, color: 'var(--navy)' }}>
                Seleccionar Cliente
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: '#64748b' }}>
                Busca por nombre, cédula/NIT o teléfono
              </p>
            </div>
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label="Cerrar modal"
            style={{ width: 32, height: 32 }}
          >
            <AppIcon name="close" size={16} />
          </button>
        </div>

        {/* Search Input Bar */}
        <div
          className="search-box wide"
          style={{
            height: 44,
            borderRadius: 10,
            border: '2px solid #cbd5e1',
            background: '#f8fafc',
            display: 'flex',
            alignItems: 'center',
            padding: '0 12px',
            gap: 8,
          }}
        >
          <AppIcon name="search" size={18} color="var(--navy)" />
          <input
            type="text"
            autoFocus
            value={searchTerm}
            onChange={handleSearchChange}
            placeholder="Buscar cliente por documento, nombre o teléfono..."
            style={{
              flex: 1,
              border: 'none',
              background: 'transparent',
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--navy)',
              outline: 'none',
            }}
          />
        </div>

        {/* Customer List */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            maxHeight: 320,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            paddingRight: 4,
          }}
        >
          {searchResults.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 16px', color: '#64748b' }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: '#f1f5f9', display: 'grid', placeItems: 'center', margin: '0 auto 8px' }}>
                <AppIcon name="users" size={22} color="#94a3b8" />
              </div>
              <strong style={{ fontSize: 13, color: 'var(--navy)', display: 'block' }}>
                {!searchTerm ? 'No existen clientes registrados' : 'No se encontraron clientes'}
              </strong>
              <span style={{ fontSize: 12 }}>
                {!searchTerm
                  ? 'Registra un cliente nuevo con el botón inferior o continúa con consumidor final.'
                  : 'Prueba con otro número de documento o nombre'}
              </span>
            </div>
          ) : (
            searchResults.map((customer) => {
              const isSelected = currentCustomer?.id === customer.id
              const isWholesale = customer.priceList === 'WHOLESALE' || customer.isWholesale
              const displayName = customer.displayName || customer.name || 'Cliente'

              return (
                <button
                  key={customer.id}
                  type="button"
                  onClick={() => handleSelect(customer)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 12px',
                    borderRadius: 10,
                    border: isSelected ? '2px solid var(--navy)' : '1.5px solid #e2e8f0',
                    background: isSelected ? '#edf2fa' : '#ffffff',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    textAlign: 'left',
                    gap: 10,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                    <div
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: 8,
                        background: isSelected ? 'var(--navy)' : '#f1f5f9',
                        color: isSelected ? '#ffffff' : 'var(--navy)',
                        fontWeight: 800,
                        fontSize: 12,
                        display: 'grid',
                        placeItems: 'center',
                        flexShrink: 0,
                      }}
                    >
                      {displayName.substring(0, 2).toUpperCase()}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <strong style={{ fontSize: 13, color: 'var(--navy)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {displayName}
                        </strong>
                        {isWholesale && (
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 800,
                              padding: '2px 6px',
                              borderRadius: 4,
                              background: '#fef3c7',
                              color: '#b45309',
                            }}
                          >
                            Mayorista
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: '#64748b', marginTop: 2, display: 'flex', gap: 8 }}>
                        <span>{customer.documentType}: {customer.documentNumber}</span>
                        {customer.phone && <span>· {customer.phone}</span>}
                      </div>
                    </div>
                  </div>

                  <div style={{ flexShrink: 0 }}>
                    {isSelected ? (
                      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--navy)', background: '#dbeafe', padding: '3px 8px', borderRadius: 6 }}>
                        Seleccionado
                      </span>
                    ) : (
                      <span style={{ fontSize: 11, fontWeight: 600, color: '#64748b' }}>
                        Elegir →
                      </span>
                    )}
                  </div>
                </button>
              )
            })
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            paddingTop: 12,
            borderTop: '1px solid var(--line)',
          }}
        >
          <button
            type="button"
            onClick={() => {
              const generic = searchResults.find((c) => c.documentNumber === '222222222222') || searchResults[0]
              if (generic) handleSelect(generic)
            }}
            className="outline-button compact"
            style={{
              height: 32,
              fontSize: 11,
              fontWeight: 700,
              gap: 6,
              background: '#ffffff',
              color: 'var(--navy)',
              borderColor: '#cbd5e1',
            }}
          >
            <AppIcon name="users" size={14} color="var(--navy)" />
            <span>Consumidor Final (Predeterminado)</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="outline-button"
            style={{
              height: 32,
              padding: '0 14px',
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}
