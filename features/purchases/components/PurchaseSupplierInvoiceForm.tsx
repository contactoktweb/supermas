'use client'

import React, { useState } from 'react'
import { AppIcon } from '@/components/ui/Icon'
import { Purchase, UserPermissionContext } from '../types'
import { purchaseService } from '../services/purchase.service'
import { isSupplierInvoicePending } from '../utils/purchase-status'
import { SupplierInvoicePendingBadge } from './PurchaseTable'

const INVOICE_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png']
const INVOICE_MAX_BYTES = 10 * 1024 * 1024

interface PurchaseSupplierInvoiceFormProps {
  purchase: Purchase
  userContext?: UserPermissionContext
  onRegistered: (purchase: Purchase) => void
}

/** Registra la factura que el proveedor envía después de emitida la orden de compra. */
export function PurchaseSupplierInvoiceForm({ purchase, userContext, onRegistered }: PurchaseSupplierInvoiceFormProps) {
  const [invoiceNumber, setInvoiceNumber] = useState(purchase.supplierInvoiceNumber || '')
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const inputId = `supplier-invoice-${purchase.id}`

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0]
    e.target.value = ''
    if (!selected) return
    if (!INVOICE_MIME_TYPES.includes(selected.type)) {
      setError('La factura debe ser PDF, JPG o PNG.')
      return
    }
    if (selected.size > INVOICE_MAX_BYTES) {
      setError('La factura debe pesar como máximo 10 MB.')
      return
    }
    setError(null)
    setFile(selected)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (invoiceNumber.trim().length < 2) {
      setError('Escriba el número de la factura del proveedor.')
      return
    }
    setError(null)
    setIsSaving(true)
    try {
      const updated = await purchaseService.registerSupplierInvoice(
        { purchaseId: purchase.id, supplierInvoiceNumber: invoiceNumber.trim(), file: file ?? undefined },
        userContext
      )
      if (updated.attachmentWarning) setError(`Factura registrada, pero el archivo no se adjuntó: ${updated.attachmentWarning}`)
      onRegistered(updated)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo registrar la factura del proveedor.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <form className="supplier-invoice-form" onSubmit={handleSubmit} noValidate>
      <div className="supplier-invoice-form-head">
        {isSupplierInvoicePending(purchase) && <SupplierInvoicePendingBadge />}
        <p>
          {isSupplierInvoicePending(purchase)
            ? 'Cuando el proveedor envíe su factura electrónica, regístrela aquí.'
            : 'Adjunte el archivo de la factura del proveedor.'}
        </p>
      </div>

      <div className="supplier-invoice-form-grid">
        <div>
          <label htmlFor={inputId} className="supplier-invoice-label">
            N° de factura del proveedor <span aria-hidden="true">*</span>
          </label>
          <input
            id={inputId}
            type="text"
            className="filter-date-input"
            style={{ width: '100%' }}
            placeholder="Ej. FE-89214"
            maxLength={60}
            value={invoiceNumber}
            onChange={(e) => setInvoiceNumber(e.target.value)}
            disabled={isSaving}
            required
          />
        </div>

        <div>
          <span className="supplier-invoice-label">Archivo de la factura</span>
          <input
            type="file"
            id={`${inputId}-file`}
            accept={INVOICE_MIME_TYPES.join(',')}
            onChange={handleFileChange}
            className="visually-hidden"
            disabled={isSaving}
          />
          <label htmlFor={`${inputId}-file`} className="supplier-invoice-drop">
            <AppIcon name="upload" size={18} />
            <span>{file ? file.name : 'Cargar PDF, JPG o PNG (máx. 10 MB)'}</span>
          </label>
        </div>
      </div>

      {error && (
        <p className="field-error-text" role="alert">
          {error}
        </p>
      )}

      <div className="supplier-invoice-actions">
        {file && (
          <button type="button" className="outline-button compact" onClick={() => setFile(null)} disabled={isSaving}>
            Quitar archivo
          </button>
        )}
        <button type="submit" className="primary-button compact" disabled={isSaving}>
          <AppIcon name="check" size={14} />
          <span>{isSaving ? 'Registrando…' : 'Registrar factura'}</span>
        </button>
      </div>
    </form>
  )
}
