'use client'

import React from 'react'
import { AppIcon } from '@/components/ui/Icon'
import {
  DamagedGoodsDestination,
  DispositionSupplierSuggestion,
  ReturnDispositionOptions,
  ReturnItemCondition,
} from '../types'
import {
  DAMAGED_DESTINATION_LABELS,
  MIN_PRODUCTION_NOTES_LENGTH,
  RETURN_ITEM_CONDITION_LABELS,
} from '../constants'

/** Línea editable del formulario de devolución de cliente (una venta puede partir un producto en varias). */
export interface CustomerReturnFormLine {
  key: string
  productId: string
  name: string
  sku: string
  /** Unidades vendidas del producto (tope compartido por todas sus líneas). */
  soldQuantity: number
  quantity: number
  condition: ReturnItemCondition
  destination?: DamagedGoodsDestination
  supplierId?: string
  productionLocationId?: string
  dispositionNotes?: string
}

interface CustomerReturnLineEditorProps {
  line: CustomerReturnFormLine
  /** Unidades que todavía puede tomar esta línea sin superar lo vendido del producto. */
  maxForLine: number
  options: ReturnDispositionOptions | null
  optionsLoading: boolean
  optionsError: string | null
  suggestion?: DispositionSupplierSuggestion
  isSplitLine: boolean
  onChange: (patch: Partial<CustomerReturnFormLine>) => void
  onSplit: () => void
  onRemove: () => void
}

const CONDITIONS: ReturnItemCondition[] = ['BUENO', 'MAL_ESTADO']
const DESTINATIONS: DamagedGoodsDestination[] = ['PROVEEDOR', 'PRODUCCION']

export function CustomerReturnLineEditor({
  line,
  maxForLine,
  options,
  optionsLoading,
  optionsError,
  suggestion,
  isSplitLine,
  onChange,
  onSplit,
  onRemove,
}: CustomerReturnLineEditorProps) {
  const isDamaged = line.condition === 'MAL_ESTADO'
  const fieldId = `return-line-${line.key}`

  const handleConditionChange = (condition: ReturnItemCondition) => {
    if (condition === 'BUENO') {
      onChange({ condition, destination: undefined, supplierId: undefined, productionLocationId: undefined, dispositionNotes: undefined })
    } else {
      onChange({ condition })
    }
  }

  const handleDestinationChange = (destination: DamagedGoodsDestination) => {
    if (destination === 'PROVEEDOR') {
      onChange({
        destination,
        productionLocationId: undefined,
        supplierId: line.supplierId || suggestion?.supplierId,
      })
    } else {
      onChange({ destination, supplierId: undefined })
    }
  }

  const notesLength = (line.dispositionNotes || '').trim().length
  const productionNeedsNotes = isDamaged && line.destination === 'PRODUCCION' && !line.productionLocationId

  return (
    <fieldset
      className={`rounded-lg border p-3 text-xs transition-colors duration-200 motion-reduce:transition-none ${
        isDamaged ? 'border-amber-300 bg-amber-50/60' : 'border-slate-200 bg-slate-50'
      }`}
    >
      <legend className="sr-only">Línea de devolución de {line.name}</legend>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="truncate font-medium text-slate-900">{line.name}</p>
          <p className="text-slate-500">
            {line.sku ? `${line.sku} · ` : ''}Vendidas: {line.soldQuantity} · Máximo para esta línea: {maxForLine}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor={`${fieldId}-qty`} className="text-slate-600">
            Cantidad
          </label>
          <input
            id={`${fieldId}-qty`}
            type="number"
            inputMode="decimal"
            min={0}
            max={maxForLine}
            step="any"
            value={line.quantity}
            onChange={(e) => onChange({ quantity: Math.max(0, Number(e.target.value) || 0) })}
            className="h-9 w-20 rounded-md border border-slate-300 bg-white px-2 text-center font-semibold text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          />
          {isSplitLine ? (
            <button
              type="button"
              onClick={onRemove}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-red-50 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40 motion-reduce:transition-none"
              aria-label={`Quitar línea adicional de ${line.name}`}
              title="Quitar línea"
            >
              <AppIcon name="trash" size={16} />
            </button>
          ) : (
            <button
              type="button"
              onClick={onSplit}
              className="inline-flex h-9 items-center gap-1 rounded-md border border-slate-300 bg-white px-2 text-slate-600 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 motion-reduce:transition-none"
              title="Separar unidades en buen y mal estado"
            >
              <AppIcon name="plus" size={14} />
              <span>Separar</span>
            </button>
          )}
        </div>
      </div>

      <div className="mt-3" role="radiogroup" aria-label={`Condición de ${line.name}`}>
        <span className="mb-1 block font-semibold uppercase tracking-wider text-slate-500">Condición</span>
        <div className="grid grid-cols-2 gap-2">
          {CONDITIONS.map((condition) => {
            const checked = line.condition === condition
            return (
              <label
                key={condition}
                className={`flex min-h-[40px] cursor-pointer items-center justify-center gap-2 rounded-md border px-2 py-2 font-medium transition-colors focus-within:ring-2 focus-within:ring-blue-500/40 motion-reduce:transition-none ${
                  checked
                    ? condition === 'BUENO'
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
                      : 'border-amber-500 bg-amber-100 text-amber-900'
                    : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-100'
                }`}
              >
                <input
                  type="radio"
                  name={`${fieldId}-condition`}
                  value={condition}
                  checked={checked}
                  onChange={() => handleConditionChange(condition)}
                  className="sr-only"
                />
                <AppIcon name={condition === 'BUENO' ? 'check' : 'warning'} size={15} />
                {RETURN_ITEM_CONDITION_LABELS[condition]}
              </label>
            )
          })}
        </div>
        <p className="mt-1 text-slate-500">
          {isDamaged
            ? 'No reingresa al inventario vendible: queda pendiente de enviar al destino elegido.'
            : 'Reingresa al inventario vendible de la sede de la venta.'}
        </p>
      </div>

      {isDamaged && (
        <div className="mt-3 space-y-3 border-t border-amber-200 pt-3 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-1">
          <div role="radiogroup" aria-label={`Destino de ${line.name}`}>
            <span className="mb-1 block font-semibold uppercase tracking-wider text-slate-500">Destino *</span>
            <div className="grid grid-cols-2 gap-2">
              {DESTINATIONS.map((destination) => {
                const checked = line.destination === destination
                return (
                  <label
                    key={destination}
                    className={`flex min-h-[40px] cursor-pointer items-center justify-center gap-2 rounded-md border px-2 py-2 font-medium transition-colors focus-within:ring-2 focus-within:ring-blue-500/40 motion-reduce:transition-none ${
                      checked ? 'border-blue-600 bg-blue-50 text-blue-800' : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <input
                      type="radio"
                      name={`${fieldId}-destination`}
                      value={destination}
                      checked={checked}
                      onChange={() => handleDestinationChange(destination)}
                      className="sr-only"
                    />
                    <AppIcon name={destination === 'PROVEEDOR' ? 'suppliers' : 'warehouse'} size={15} />
                    {DAMAGED_DESTINATION_LABELS[destination]}
                  </label>
                )
              })}
            </div>
          </div>

          {optionsLoading && (
            <p className="flex items-center gap-2 text-slate-500" role="status">
              <AppIcon name="refresh" size={14} className="motion-safe:animate-spin" />
              Cargando proveedores y sedes...
            </p>
          )}
          {optionsError && (
            <p className="flex items-center gap-2 text-red-700" role="alert">
              <AppIcon name="warning" size={14} />
              {optionsError}
            </p>
          )}

          {line.destination === 'PROVEEDOR' && options && (
            <div>
              <label htmlFor={`${fieldId}-supplier`} className="mb-1 block font-semibold uppercase tracking-wider text-slate-500">
                Proveedor *
              </label>
              <select
                id={`${fieldId}-supplier`}
                value={line.supplierId || ''}
                onChange={(e) => onChange({ supplierId: e.target.value || undefined })}
                className="h-10 w-full rounded-md border border-slate-300 bg-white px-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              >
                <option value="">Seleccione el proveedor...</option>
                {options.suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} {s.taxId ? `(NIT ${s.taxId})` : ''}
                  </option>
                ))}
              </select>
              {suggestion ? (
                <p className="mt-1 text-slate-500">
                  Sugerido: {suggestion.supplierName}, última compra recibida {suggestion.purchaseNumber}.
                </p>
              ) : (
                <p className="mt-1 text-slate-500">No hay compras recibidas de este producto para sugerir proveedor.</p>
              )}
              {options.suppliers.length === 0 && (
                <p className="mt-1 text-red-700">No hay proveedores activos registrados.</p>
              )}
            </div>
          )}

          {line.destination === 'PRODUCCION' && options && (
            <div className="space-y-2">
              <div>
                <label htmlFor={`${fieldId}-location`} className="mb-1 block font-semibold uppercase tracking-wider text-slate-500">
                  Sede o área de producción
                </label>
                <select
                  id={`${fieldId}-location`}
                  value={line.productionLocationId || ''}
                  onChange={(e) => onChange({ productionLocationId: e.target.value || undefined })}
                  className="h-10 w-full rounded-md border border-slate-300 bg-white px-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                >
                  <option value="">Sin sede (indicar en la nota)</option>
                  {options.locations.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name} ({l.code})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor={`${fieldId}-notes`} className="mb-1 block font-semibold uppercase tracking-wider text-slate-500">
                  Nota de producción {productionNeedsNotes ? '*' : '(opcional)'}
                </label>
                <input
                  id={`${fieldId}-notes`}
                  type="text"
                  value={line.dispositionNotes || ''}
                  onChange={(e) => onChange({ dispositionNotes: e.target.value })}
                  placeholder="Área o responsable que recibe la mercancía"
                  aria-invalid={productionNeedsNotes && notesLength < MIN_PRODUCTION_NOTES_LENGTH}
                  className="h-10 w-full rounded-md border border-slate-300 bg-white px-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                />
                {productionNeedsNotes && (
                  <p className="mt-1 text-slate-500">
                    Sin sede seleccionada la nota es obligatoria (mínimo {MIN_PRODUCTION_NOTES_LENGTH} caracteres).
                  </p>
                )}
              </div>
            </div>
          )}

          {line.destination === 'PROVEEDOR' && (
            <div>
              <label htmlFor={`${fieldId}-supplier-notes`} className="mb-1 block font-semibold uppercase tracking-wider text-slate-500">
                Nota (opcional)
              </label>
              <input
                id={`${fieldId}-supplier-notes`}
                type="text"
                value={line.dispositionNotes || ''}
                onChange={(e) => onChange({ dispositionNotes: e.target.value })}
                placeholder="Detalle del daño o acuerdo con el proveedor"
                className="h-10 w-full rounded-md border border-slate-300 bg-white px-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              />
            </div>
          )}
        </div>
      )}
    </fieldset>
  )
}
