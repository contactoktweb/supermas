'use client'

import React, { useState } from 'react'
import { AppIcon } from '@/components/ui/Icon'
import { Invoice } from '../types'
import { invoiceService } from '../services/invoice.service'

interface DIANXmlModalProps {
  isOpen: boolean
  invoice: Invoice | null
  onClose: () => void
}

export function DIANXmlModal({ isOpen, invoice, onClose }: DIANXmlModalProps) {
  const [copied, setCopied] = useState(false)

  if (!isOpen || !invoice) return null

  const xmlContent = invoiceService.getInvoiceXml(invoice)

  const handleCopy = () => {
    navigator.clipboard.writeText(xmlContent)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDownloadXml = () => {
    const blob = new Blob([xmlContent], { type: 'application/xml;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${invoice.invoiceNumber}_DIAN_UBL2.1.xml`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="drawer-backdrop modal-center" onClick={onClose}>
      <div
        className="modal-card animate-scale-up"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 720,
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          background: '#ffffff',
          borderRadius: 14,
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          className="modal-header"
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              className="modal-icon-badge"
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                background: 'rgba(0, 27, 92, 0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--navy)',
              }}
            >
              <AppIcon name="terminal" size={18} />
            </div>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 800, color: 'var(--navy)', margin: 0 }}>
                Estructura XML UBL 2.1 (DIAN)
              </h2>
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                Documento electrónico estándar · {invoice.invoiceNumber}
              </span>
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

        {/* Body with XML Viewer */}
        <div
          style={{
            padding: '20px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: 12,
              color: 'var(--muted)',
            }}
          >
            <span>Estándar: UBL 2.1 Colombia · Firma Digital SHA-384</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                className="outline-button"
                onClick={handleCopy}
                style={{ height: 30, fontSize: 11, padding: '0 10px' }}
              >
                <AppIcon name={copied ? 'check' : 'edit'} size={12} />
                {copied ? 'Copiado' : 'Copiar XML'}
              </button>

              <button
                type="button"
                className="outline-button"
                onClick={handleDownloadXml}
                style={{ height: 30, fontSize: 11, padding: '0 10px' }}
              >
                <AppIcon name="download" size={12} /> Descargar .xml
              </button>
            </div>
          </div>

          {/* XML Code block */}
          <pre
            style={{
              background: '#0f172a',
              color: '#38bdf8',
              padding: '16px',
              borderRadius: 8,
              fontSize: 11,
              fontFamily: 'monospace',
              lineHeight: 1.5,
              overflowX: 'auto',
              maxHeight: 420,
              margin: 0,
              border: '1px solid #1e293b',
            }}
          >
            <code>{xmlContent}</code>
          </pre>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '12px 20px',
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
          }}
        >
          <button type="button" className="primary-button compact" onClick={onClose}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}
