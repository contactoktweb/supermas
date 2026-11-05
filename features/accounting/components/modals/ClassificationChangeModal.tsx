'use client'

import React, { useEffect, useRef, useState } from 'react'
import { AppIcon, LightIconName } from '@/components/ui/Icon'
import { ModalPortal } from '@/components/ui/ModalPortal'

export interface ClassificationOption<T extends string> {
  value: T
  label: string
  description?: string
  iconName?: LightIconName
}

interface ClassificationChangeModalProps<T extends string> {
  isOpen: boolean
  title: string
  subtitle?: string
  legend: string
  options: ClassificationOption<T>[]
  currentValue: T
  onCancel: () => void
  onConfirm: (value: T) => Promise<void>
}

/** Cambia una clasificación de un registro (naturaleza, rol) eligiendo entre opciones visibles. */
export function ClassificationChangeModal<T extends string>({
  isOpen,
  title,
  subtitle,
  legend,
  options,
  currentValue,
  onCancel,
  onConfirm,
}: ClassificationChangeModalProps<T>) {
  const [selected, setSelected] = useState<T>(currentValue)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!isOpen) return
    setSelected(currentValue)
    setIsSaving(false)
    setError(null)
    cancelRef.current?.focus()
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [isOpen, currentValue, onCancel])

  if (!isOpen) return null

  const handleConfirm = async () => {
    setIsSaving(true)
    setError(null)
    try {
      await onConfirm(selected)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el cambio.')
      setIsSaving(false)
    }
  }

  return (
    <ModalPortal>
      <div
        className="drawer-backdrop modal-center p-3 z-50"
        role="dialog"
        aria-modal="true"
        aria-labelledby="classification-change-title"
        onClick={onCancel}
      >
        <div
          className="modal-card modal-card-flush animate-scale-up w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-5 space-y-4">
            <div className="min-w-0">
              <h2 id="classification-change-title" className="text-sm font-bold text-slate-900 m-0">
                {title}
              </h2>
              {subtitle && <p className="text-xs text-slate-500 m-0 truncate">{subtitle}</p>}
            </div>

            <fieldset className="classification-option-list">
              <legend className="text-xs font-semibold text-slate-700 mb-2">{legend}</legend>
              {options.map((option) => (
                <label
                  key={option.value}
                  className={`classification-option ${selected === option.value ? 'is-selected' : ''}`}
                >
                  <input
                    type="radio"
                    name="classification-option"
                    value={option.value}
                    checked={selected === option.value}
                    onChange={() => setSelected(option.value)}
                    disabled={isSaving}
                  />
                  {option.iconName && <AppIcon name={option.iconName} size={16} />}
                  <span className="classification-option-text">
                    <strong>{option.label}</strong>
                    {option.description && <small>{option.description}</small>}
                  </span>
                  {option.value === currentValue && <span className="classification-option-current">Actual</span>}
                </label>
              ))}
            </fieldset>

            {error && (
              <p className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs m-0" role="alert">
                {error}
              </p>
            )}
          </div>
          <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex flex-wrap justify-end gap-2">
            <button ref={cancelRef} type="button" className="outline-button compact text-xs" onClick={onCancel} disabled={isSaving}>
              Cancelar
            </button>
            <button
              type="button"
              className="primary-button compact text-xs font-bold flex items-center gap-1.5"
              style={{ background: 'var(--navy, #001B5C)' }}
              onClick={handleConfirm}
              disabled={isSaving || selected === currentValue}
            >
              <AppIcon name="check" size={13} />
              <span>{isSaving ? 'Guardando...' : 'Guardar cambio'}</span>
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  )
}
