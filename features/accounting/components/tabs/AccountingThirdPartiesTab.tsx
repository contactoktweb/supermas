'use client'

import React, { useState, useMemo } from 'react'
import { AppIcon } from '@/components/ui/Icon'
import { ThirdParty, LegalNature, ThirdPartyType } from '../../types'

interface AccountingThirdPartiesTabProps {
  thirdParties: ThirdParty[]
  onOpenNewThirdParty: () => void
  onExport?: () => void
  canManageThirdParties?: boolean
  onUpdateThirdPartyType?: (id: string, newType: ThirdPartyType) => Promise<any>
}

export function AccountingThirdPartiesTab({
  thirdParties,
  onOpenNewThirdParty,
  onExport,
  canManageThirdParties = true,
  onUpdateThirdPartyType,
}: AccountingThirdPartiesTabProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedNature, setSelectedNature] = useState<'ALL' | LegalNature>('ALL')
  const [selectedType, setSelectedType] = useState<'ALL' | ThirdPartyType>('ALL')
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  const countClientes = useMemo(() => thirdParties.filter((t) => t.thirdPartyType === 'CLIENTE').length, [thirdParties])
  const countProveedores = useMemo(() => thirdParties.filter((t) => t.thirdPartyType === 'PROVEEDOR').length, [thirdParties])
  const countEmpleados = useMemo(() => thirdParties.filter((t) => t.thirdPartyType === 'EMPLEADO').length, [thirdParties])
  const countAcreedores = useMemo(() => thirdParties.filter((t) => t.thirdPartyType === 'ACREEDOR').length, [thirdParties])
  const countOtros = useMemo(() => thirdParties.filter((t) => t.thirdPartyType === 'OTRO').length, [thirdParties])
  const countJuridica = useMemo(() => thirdParties.filter((t) => t.legalNature === 'JURIDICA').length, [thirdParties])
  const countNatural = useMemo(() => thirdParties.filter((t) => t.legalNature === 'NATURAL').length, [thirdParties])

  const filteredThirdParties = useMemo(() => {
    return thirdParties.filter((tp) => {
      // Filtro de búsqueda
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        const matchName = tp.companyName.toLowerCase().includes(q)
        const matchDoc = tp.documentNumber.toLowerCase().includes(q)
        const matchCommercial = (tp.commercialName || '').toLowerCase().includes(q)
        const matchEmail = (tp.email || '').toLowerCase().includes(q)
        const matchPhone = (tp.phone || '').toLowerCase().includes(q)
        if (!matchName && !matchDoc && !matchCommercial && !matchEmail && !matchPhone) {
          return false
        }
      }

      // Filtro por Naturaleza Jurídica
      if (selectedNature !== 'ALL' && tp.legalNature !== selectedNature) {
        return false
      }

      // Filtro por Tipo de Tercero
      if (selectedType !== 'ALL' && tp.thirdPartyType !== selectedType) {
        return false
      }

      return true
    })
  }, [thirdParties, searchQuery, selectedNature, selectedType])

  const handleTypeChange = async (thirdPartyId: string, newType: ThirdPartyType) => {
    if (!onUpdateThirdPartyType) return
    try {
      setUpdatingId(thirdPartyId)
      await onUpdateThirdPartyType(thirdPartyId, newType)
    } catch (err) {
      console.error('Error al actualizar rol del tercero:', err)
    } finally {
      setUpdatingId(null)
    }
  }

  const getTypeBadgeStyle = (type: ThirdPartyType) => {
    switch (type) {
      case 'CLIENTE':
        return 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:border-emerald-500 hover:bg-emerald-100/70'
      case 'PROVEEDOR':
        return 'bg-blue-50 text-blue-900 border-blue-300 hover:border-blue-500 hover:bg-blue-100/70'
      case 'EMPLEADO':
        return 'bg-purple-50 text-purple-800 border-purple-300 hover:border-purple-500 hover:bg-purple-100/70'
      case 'ACREEDOR':
        return 'bg-amber-50 text-amber-800 border-amber-300 hover:border-amber-500 hover:bg-amber-100/70'
      default:
        return 'bg-slate-50 text-slate-700 border-slate-300 hover:border-slate-400 hover:bg-slate-100'
    }
  }

  return (
    <div className="space-y-4 page-enter">
      {/* Resumen de Métricas de Terceros */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Card Clientes */}
        <button
          type="button"
          onClick={() => setSelectedType(selectedType === 'CLIENTE' ? 'ALL' : 'CLIENTE')}
          className={`p-3 rounded-xl border text-left transition-all shadow-2xs flex items-center justify-between ${
            selectedType === 'CLIENTE'
              ? 'bg-emerald-50/80 border-emerald-500 ring-2 ring-emerald-500/20'
              : 'bg-white border-slate-200 hover:border-emerald-300'
          }`}
        >
          <div>
            <span className="text-[11px] font-semibold text-emerald-700 block">Clientes (Ventas)</span>
            <strong className="text-xl font-bold text-slate-900">{countClientes}</strong>
          </div>
          <div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-sm">
            <AppIcon name="purchases" size={18} className="text-emerald-700" />
          </div>
        </button>

        {/* Card Proveedores */}
        <button
          type="button"
          onClick={() => setSelectedType(selectedType === 'PROVEEDOR' ? 'ALL' : 'PROVEEDOR')}
          className={`p-3 rounded-xl border text-left transition-all shadow-2xs flex items-center justify-between ${
            selectedType === 'PROVEEDOR'
              ? 'bg-blue-50/80 border-blue-600 ring-2 ring-blue-500/20'
              : 'bg-white border-slate-200 hover:border-blue-300'
          }`}
        >
          <div>
            <span className="text-[11px] font-semibold text-blue-900 block">Proveedores (Compras)</span>
            <strong className="text-xl font-bold text-slate-900">{countProveedores}</strong>
          </div>
          <div className="w-9 h-9 rounded-lg bg-blue-100 text-blue-900 flex items-center justify-center font-bold text-sm">
            <AppIcon name="package" size={18} className="text-blue-700" />
          </div>
        </button>

        {/* Card Personas Jurídicas */}
        <button
          type="button"
          onClick={() => setSelectedNature(selectedNature === 'JURIDICA' ? 'ALL' : 'JURIDICA')}
          className={`p-3 rounded-xl border text-left transition-all shadow-2xs flex items-center justify-between ${
            selectedNature === 'JURIDICA'
              ? 'bg-indigo-50/80 border-indigo-600 ring-2 ring-indigo-500/20'
              : 'bg-white border-slate-200 hover:border-indigo-300'
          }`}
        >
          <div>
            <span className="text-[11px] font-semibold text-indigo-700 block">Personas Jurídicas (NIT)</span>
            <strong className="text-xl font-bold text-slate-900">{countJuridica}</strong>
          </div>
          <div className="w-9 h-9 rounded-lg bg-indigo-100 text-indigo-800 flex items-center justify-center font-bold text-sm">
            <AppIcon name="suppliers" size={18} className="text-indigo-700" />
          </div>
        </button>

        {/* Card Personas Naturales */}
        <button
          type="button"
          onClick={() => setSelectedNature(selectedNature === 'NATURAL' ? 'ALL' : 'NATURAL')}
          className={`p-3 rounded-xl border text-left transition-all shadow-2xs flex items-center justify-between ${
            selectedNature === 'NATURAL'
              ? 'bg-slate-100 border-slate-600 ring-2 ring-slate-500/20'
              : 'bg-white border-slate-200 hover:border-slate-400'
          }`}
        >
          <div>
            <span className="text-[11px] font-semibold text-slate-600 block">Personas Naturales (CC)</span>
            <strong className="text-xl font-bold text-slate-900">{countNatural}</strong>
          </div>
          <div className="w-9 h-9 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-sm">
            <AppIcon name="users" size={18} className="text-slate-700" />
          </div>
        </button>
      </div>

      {/* Pestañas Rápidas de Rol / Clasificación */}
      <div className="flex flex-wrap items-center gap-1.5 p-1.5 bg-slate-100/90 rounded-xl border border-slate-200 text-xs">
        <span className="text-[11px] font-bold text-slate-500 px-2 py-1 uppercase tracking-wider">
          Filtrar por Rol:
        </span>
        <button
          type="button"
          onClick={() => setSelectedType('ALL')}
          className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
            selectedType === 'ALL'
              ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
          }`}
        >
          Todos ({thirdParties.length})
        </button>
        <button
          type="button"
          onClick={() => setSelectedType('CLIENTE')}
          className={`px-3 py-1.5 rounded-lg font-semibold transition-all flex items-center gap-1.5 ${
            selectedType === 'CLIENTE'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-emerald-800 hover:bg-emerald-50'
          }`}
        >
          <AppIcon name="purchases" size={13} className={selectedType === 'CLIENTE' ? 'text-white' : 'text-emerald-700'} />
          <span>Clientes</span>
          <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
            selectedType === 'CLIENTE' ? 'bg-emerald-700 text-white' : 'bg-emerald-100 text-emerald-800'
          }`}>
            {countClientes}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setSelectedType('PROVEEDOR')}
          className={`px-3 py-1.5 rounded-lg font-semibold transition-all flex items-center gap-1.5 ${
            selectedType === 'PROVEEDOR'
              ? 'bg-blue-700 text-white shadow-xs'
              : 'text-blue-900 hover:bg-blue-50'
          }`}
        >
          <AppIcon name="package" size={13} className={selectedType === 'PROVEEDOR' ? 'text-white' : 'text-blue-700'} />
          <span>Proveedores</span>
          <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
            selectedType === 'PROVEEDOR' ? 'bg-blue-800 text-white' : 'bg-blue-100 text-blue-900'
          }`}>
            {countProveedores}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setSelectedType('EMPLEADO')}
          className={`px-3 py-1.5 rounded-lg font-semibold transition-all flex items-center gap-1.5 ${
            selectedType === 'EMPLEADO'
              ? 'bg-purple-700 text-white shadow-xs'
              : 'text-purple-800 hover:bg-purple-50'
          }`}
        >
          <AppIcon name="users" size={13} className={selectedType === 'EMPLEADO' ? 'text-white' : 'text-purple-700'} />
          <span>Empleados</span>
          <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
            selectedType === 'EMPLEADO' ? 'bg-purple-800 text-white' : 'bg-purple-100 text-purple-800'
          }`}>
            {countEmpleados}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setSelectedType('ACREEDOR')}
          className={`px-3 py-1.5 rounded-lg font-semibold transition-all flex items-center gap-1.5 ${
            selectedType === 'ACREEDOR'
              ? 'bg-amber-600 text-white shadow-xs'
              : 'text-amber-800 hover:bg-amber-50'
          }`}
        >
          <AppIcon name="warehouse" size={13} className={selectedType === 'ACREEDOR' ? 'text-white' : 'text-amber-700'} />
          <span>Acreedores</span>
          <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
            selectedType === 'ACREEDOR' ? 'bg-amber-700 text-white' : 'bg-amber-100 text-amber-800'
          }`}>
            {countAcreedores}
          </span>
        </button>
        {countOtros > 0 && (
          <button
            type="button"
            onClick={() => setSelectedType('OTRO')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-all flex items-center gap-1.5 ${
              selectedType === 'OTRO'
                ? 'bg-slate-700 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-200/60'
            }`}
          >
            <AppIcon name="layers" size={13} className={selectedType === 'OTRO' ? 'text-white' : 'text-slate-600'} />
            <span>Otros</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
              selectedType === 'OTRO' ? 'bg-slate-800 text-white' : 'bg-slate-200 text-slate-700'
            }`}>
              {countOtros}
            </span>
          </button>
        )}
      </div>

      {/* Barra de Filtros y Búsqueda */}
      <div className="filters-bar flex flex-wrap items-center justify-between gap-3">
        <div className="search-box flex-1 max-w-md">
          <AppIcon name="search" size={16} />
          <input
            placeholder="Buscar por NIT/Cédula, razón social, nombre o correo..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Filtro Naturaleza Jurídica */}
          <select
            className="filter-select text-xs"
            value={selectedNature}
            onChange={(e) => setSelectedNature(e.target.value as any)}
          >
            <option value="ALL">Todas las Naturalezas</option>
            <option value="JURIDICA">Personas Jurídicas (NIT)</option>
            <option value="NATURAL">Personas Naturales (CC / CE)</option>
          </select>

          {onExport && (
            <button
              type="button"
              className="outline-button text-xs py-1.5 px-3 flex items-center gap-1.5 shadow-2xs hover:border-slate-400 transition-all"
              onClick={onExport}
              title="Exportar directorio de terceros a Excel, CSV o JSON con filtros y fechas"
            >
              <AppIcon name="download" size={14} />
              <span>Exportar</span>
            </button>
          )}

          {canManageThirdParties && (
            <button
              type="button"
              className="primary-button text-xs py-1.5 px-3 flex items-center gap-1.5 shadow-sm"
              onClick={onOpenNewThirdParty}
            >
              <AppIcon name="plus" size={14} />
              <span>Registrar Tercero (Cliente / Proveedor)</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabla de Terceros */}
      <div className="table-panel animated-table">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th style={{ width: 140 }}>Documento / NIT</th>
                <th style={{ width: 130 }}>Naturaleza</th>
                <th>Razón Social / Nombre Completo</th>
                <th style={{ width: 160 }}>Rol / Clasificación</th>
                <th style={{ width: 160 }}>Contacto</th>
                <th style={{ width: 140 }}>Ubicación</th>
                <th style={{ width: 90, textAlign: 'center' }}>Estado</th>
              </tr>
            </thead>
            <tbody>
              {filteredThirdParties.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-500">
                    <div className="font-bold text-sm text-slate-700 mb-1">
                      No se encontraron terceros registrados con los filtros aplicados
                    </div>
                    <div className="text-xs text-slate-400 mb-3">
                      Puedes registrar clientes o proveedores para usarlos en asientos contables y facturación.
                    </div>
                    {canManageThirdParties && (
                      <button
                        type="button"
                        className="outline-button text-xs py-1.5 px-3 mx-auto"
                        onClick={onOpenNewThirdParty}
                      >
                        <AppIcon name="plus" size={13} />
                        <span>Crear Primer Tercero</span>
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                filteredThirdParties.map((tp) => (
                  <tr key={tp.id} className="hover:bg-slate-50/70 transition-colors">
                    <td>
                      <div className="flex items-center gap-1 font-mono text-xs font-bold text-slate-800">
                        <span className="text-[10px] text-slate-400 font-normal">{tp.documentType}</span>
                        <span>{tp.documentNumber}</span>
                        {tp.verificationDigit !== undefined && tp.verificationDigit !== null && (
                          <span className="text-blue-900 bg-blue-50 px-1 py-0.2 rounded border border-blue-200">
                            DV {tp.verificationDigit}
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      <span
                        className={`badge text-[11px] font-semibold ${
                          tp.legalNature === 'JURIDICA'
                            ? 'badge-blue'
                            : 'badge-teal'
                        }`}
                      >
                        {tp.legalNature === 'JURIDICA' ? 'Persona Jurídica' : 'Persona Natural'}
                      </span>
                    </td>
                    <td>
                      <div className="flex flex-col">
                        <strong className="text-xs text-slate-900">{tp.companyName}</strong>
                        {tp.commercialName && (
                          <span className="text-[11px] text-slate-500 font-normal">
                            Nombre comercial: {tp.commercialName}
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      {/* Selector interactivo de Rol / Tipo de Tercero */}
                      {canManageThirdParties && onUpdateThirdPartyType ? (
                        <div className="relative inline-flex items-center">
                          <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 flex items-center">
                            {tp.thirdPartyType === 'CLIENTE' && <AppIcon name="purchases" size={13} className="text-emerald-700" />}
                            {tp.thirdPartyType === 'PROVEEDOR' && <AppIcon name="package" size={13} className="text-blue-700" />}
                            {tp.thirdPartyType === 'EMPLEADO' && <AppIcon name="users" size={13} className="text-purple-700" />}
                            {tp.thirdPartyType === 'ACREEDOR' && <AppIcon name="warehouse" size={13} className="text-amber-700" />}
                            {tp.thirdPartyType === 'OTRO' && <AppIcon name="layers" size={13} className="text-slate-600" />}
                          </span>
                          <select
                            value={tp.thirdPartyType}
                            disabled={updatingId === tp.id}
                            onChange={(e) => handleTypeChange(tp.id, e.target.value as ThirdPartyType)}
                            className={`text-xs font-semibold pl-6 pr-6 py-1 rounded-lg border appearance-none cursor-pointer transition-all shadow-2xs ${getTypeBadgeStyle(
                              tp.thirdPartyType
                            )} ${updatingId === tp.id ? 'opacity-50 cursor-wait' : ''}`}
                            title="Cambiar clasificación (Cliente, Proveedor, Empleado o Acreedor)"
                          >
                            <option value="CLIENTE">Cliente</option>
                            <option value="PROVEEDOR">Proveedor</option>
                            <option value="EMPLEADO">Empleado</option>
                            <option value="ACREEDOR">Acreedor</option>
                            <option value="OTRO">Otro</option>
                          </select>
                          <span className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 flex items-center">
                            <AppIcon name="chevronDown" size={11} />
                          </span>
                        </div>
                      ) : (
                        <span className={`badge text-xs font-semibold inline-flex items-center gap-1.5 ${getTypeBadgeStyle(tp.thirdPartyType)}`}>
                          {tp.thirdPartyType === 'CLIENTE' && <><AppIcon name="purchases" size={12} className="text-emerald-700" /> Cliente</>}
                          {tp.thirdPartyType === 'PROVEEDOR' && <><AppIcon name="package" size={12} className="text-blue-700" /> Proveedor</>}
                          {tp.thirdPartyType === 'EMPLEADO' && <><AppIcon name="users" size={12} className="text-purple-700" /> Empleado</>}
                          {tp.thirdPartyType === 'ACREEDOR' && <><AppIcon name="warehouse" size={12} className="text-amber-700" /> Acreedor</>}
                          {tp.thirdPartyType === 'OTRO' && <><AppIcon name="layers" size={12} className="text-slate-600" /> Otro</>}
                        </span>
                      )}
                    </td>
                    <td>
                      <div className="flex flex-col text-[11px] text-slate-600 gap-0.5">
                        {tp.email && (
                          <span className="inline-flex items-center gap-1 truncate max-w-[170px]" title={tp.email}>
                            <AppIcon name="mail" size={11} className="text-slate-400 shrink-0" />
                            <span className="truncate">{tp.email}</span>
                          </span>
                        )}
                        {tp.phone && (
                          <span className="inline-flex items-center gap-1 font-mono text-slate-500">
                            <AppIcon name="phone" size={11} className="text-slate-400 shrink-0" />
                            <span>{tp.phone}</span>
                          </span>
                        )}
                        {!tp.email && !tp.phone && <span className="text-slate-400">—</span>}
                      </div>
                    </td>
                    <td>
                      <span className="text-xs text-slate-600">
                        {tp.city || 'Medellín'}{tp.department ? `, ${tp.department}` : ''}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span
                        className={`badge text-[10px] font-semibold ${
                          tp.isActive !== false ? 'badge-teal' : 'badge-gray'
                        }`}
                      >
                        {tp.isActive !== false ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
