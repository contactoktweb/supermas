'use client'

import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { AppIcon } from '@/components/ui/Icon'
import { AccountingAccount, AccountClass, AccountType, AccountNature, AccountLevel } from '../../types'
import { AccountFormData } from '../../schemas/accounting.schema'

interface NewAccountDrawerProps {
  isOpen: boolean
  onClose: () => void
  accounts: AccountingAccount[]
  onSubmit: (data: AccountFormData) => Promise<void>
}

export function NewAccountDrawer({
  isOpen,
  onClose,
  accounts,
  onSubmit,
}: NewAccountDrawerProps) {
  const [mounted, setMounted] = useState(false)
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [accountClass, setAccountClass] = useState<AccountClass>(1)
  const [type, setType] = useState<AccountType>('ASSET')
  const [nature, setNature] = useState<AccountNature>('DEBIT')
  const [level, setLevel] = useState<AccountLevel>('SUBACCOUNT')
  const [parentId, setParentId] = useState<string>('')
  const [requiresThirdParty, setRequiresThirdParty] = useState(false)
  const [requiresCostCenter, setRequiresCostCenter] = useState(false)
  const [description, setDescription] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen || !mounted) return null

  const handleClassChange = (clsNum: AccountClass) => {
    setAccountClass(clsNum)
    switch (clsNum) {
      case 1:
        setType('ASSET')
        setNature('DEBIT')
        break
      case 2:
        setType('LIABILITY')
        setNature('CREDIT')
        break
      case 3:
        setType('EQUITY')
        setNature('CREDIT')
        break
      case 4:
        setType('REVENUE')
        setNature('CREDIT')
        break
      case 5:
        setType('EXPENSE')
        setNature('DEBIT')
        break
      case 6:
      case 7:
        setType('COST')
        setNature('DEBIT')
        break
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)

    if (!code.trim() || !name.trim()) {
      setFormError('El código y el nombre de la cuenta son campos obligatorios.')
      return
    }

    try {
      setIsSubmitting(true)
      await onSubmit({
        code: code.trim(),
        name: name.trim(),
        accountClass,
        type,
        nature,
        level,
        parentId: parentId || null,
        requiresThirdParty,
        requiresCostCenter,
        description: description.trim() || undefined,
      })
      onClose()
    } catch (err: any) {
      setFormError(err.message || 'Error al crear la cuenta contable.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return createPortal(
    <div className="drawer-backdrop" onClick={onClose} aria-modal="true" role="dialog">
      <div
        className="product-drawer page-enter"
        style={{
          width: 'min(100%, 540px)',
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          maxHeight: '100vh',
          background: '#ffffff',
          padding: '24px 28px',
          overflowY: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="drawer-header border-b pb-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-900 flex items-center justify-center font-bold">
              <AppIcon name="layers" size={18} />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900" style={{ margin: 0, fontSize: 18 }}>Nueva Cuenta PUC Colombia</h2>
              <p className="text-xs text-gray-500" style={{ margin: 0, marginTop: 2 }}>
                Parametriza una nueva cuenta en el catálogo contable oficial.
              </p>
            </div>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Cerrar modal">
            <AppIcon name="close" size={18} />
          </button>
        </div>

        {formError && (
          <div className="my-3 p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-lg flex items-center gap-2">
            <AppIcon name="warning" size={16} />
            <span>{formError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3 py-3 text-xs flex-1 flex flex-col justify-between">
          <div className="space-y-3">
            <div>
              <label className="block font-semibold text-gray-700 mb-1">Clase PUC:</label>
              <select
                className="filter-select w-full"
                value={accountClass}
                onChange={(e) => handleClassChange(Number(e.target.value) as AccountClass)}
              >
                <option value={1}>Clase 1: Activos</option>
                <option value={2}>Clase 2: Pasivos</option>
                <option value={3}>Clase 3: Patrimonio</option>
                <option value={4}>Clase 4: Ingresos</option>
                <option value={5}>Clase 5: Gastos</option>
                <option value={6}>Clase 6: Costos de Venta</option>
                <option value={7}>Clase 7: Costos de Producción</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-gray-700 mb-1">Código de Cuenta:</label>
                <input
                  type="text"
                  placeholder="Ej: 143505"
                  className="filter-select w-full font-mono font-semibold"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                  required
                />
              </div>
              <div>
                <label className="block font-semibold text-gray-700 mb-1">Nivel Jerárquico:</label>
                <select
                  className="filter-select w-full"
                  value={level}
                  onChange={(e) => setLevel(e.target.value as AccountLevel)}
                >
                  <option value="CLASS">Clase (1 dígito)</option>
                  <option value="GROUP">Grupo (2 dígitos)</option>
                  <option value="ACCOUNT">Cuenta (4 dígitos)</option>
                  <option value="SUBACCOUNT">Subcuenta (6 dígitos)</option>
                  <option value="AUXILIARY">Auxiliar (8 dígitos)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block font-semibold text-gray-700 mb-1">Nombre de la Cuenta:</label>
              <input
                type="text"
                placeholder="Ej: Inventario - Línea Cuidado Personal"
                className="filter-select w-full font-medium"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-gray-700 mb-1">Naturaleza Contable:</label>
                <select
                  className="filter-select w-full font-semibold"
                  value={nature}
                  onChange={(e) => setNature(e.target.value as AccountNature)}
                >
                  <option value="DEBIT">Débito (Aumenta al Debe)</option>
                  <option value="CREDIT">Crédito (Aumenta al Haber)</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold text-gray-700 mb-1">Cuenta Padre (Superior):</label>
                <select
                  className="filter-select w-full"
                  value={parentId}
                  onChange={(e) => setParentId(e.target.value)}
                >
                  <option value="">Ninguna (Nivel Superior)</option>
                  {accounts
                    .filter((a) => a.accountClass === accountClass)
                    .map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.code} - {a.name}
                      </option>
                    ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block font-semibold text-gray-700 mb-1">Descripción / Uso:</label>
              <textarea
                className="filter-select w-full h-16"
                placeholder="Describe el tipo de operaciones o mercancías que se registran en esta cuenta..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div className="pt-1 flex flex-col gap-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="rounded text-blue-600 focus:ring-blue-500"
                  checked={requiresThirdParty}
                  onChange={(e) => setRequiresThirdParty(e.target.checked)}
                />
                <span className="font-medium text-gray-700">Requiere Identificación de Tercero (NIT / CC)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="rounded text-blue-600 focus:ring-blue-500"
                  checked={requiresCostCenter}
                  onChange={(e) => setRequiresCostCenter(e.target.checked)}
                />
                <span className="font-medium text-gray-700">Requiere Centro de Costos / Bodega</span>
              </label>
            </div>
          </div>

          <div className="drawer-footer border-t pt-4 mt-6 flex items-center justify-end gap-2">
            <button
              type="button"
              className="outline-button text-xs py-1.5"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="primary-button text-xs py-1.5"
              disabled={isSubmitting || !code.trim() || !name.trim()}
            >
              {isSubmitting ? 'Guardando...' : 'Crear Cuenta PUC'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}
