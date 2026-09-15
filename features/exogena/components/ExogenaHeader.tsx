'use client'

import React from 'react'
import { AppIcon } from '@/components/ui/Icon'

interface ExogenaHeaderProps {
  onOpenWizard: () => void
  onValidate: () => void
  onOpenConciliation: () => void
  onOpenHistory: () => void
  onOpenConfig: () => void
  onRefresh: () => void
  isValidating: boolean
  canGenerate: boolean
  canValidate: boolean
  canConfigure: boolean
}

export function ExogenaHeader({
  onOpenWizard,
  onValidate,
  onOpenConciliation,
  onOpenHistory,
  onOpenConfig,
  onRefresh,
  isValidating,
  canGenerate,
  canValidate,
  canConfigure,
}: ExogenaHeaderProps) {
  return (
    <header className="page-heading page-enter">
      <div>
        <p className="eyebrow">Medios Magnéticos & Cumplimiento Fiscal DIAN</p>
        <h1>Exógena Tributaria</h1>
        <p className="welcome-subtitle">
          Prepara, valida y genera la información tributaria requerida para la DIAN.
        </p>
      </div>

      <div className="heading-actions">
        <button
          type="button"
          className="outline-button"
          onClick={onRefresh}
          title="Actualizar datos y registros"
          aria-label="Refrescar datos"
        >
          <AppIcon name="refresh" size={16} />
        </button>

        {canConfigure && (
          <button
            type="button"
            className="outline-button"
            onClick={onOpenConfig}
            title="Configurar formatos aplicables y datos del obligado"
          >
            <AppIcon name="settings" size={16} />
            <span>Configuración</span>
          </button>
        )}

        <button
          type="button"
          className="outline-button"
          onClick={onOpenConciliation}
          title="Verificar conciliación entre contabilidad y Exógena"
        >
          <AppIcon name="accounting" size={16} />
          <span>Conciliación</span>
        </button>

        <button
          type="button"
          className="outline-button"
          onClick={onOpenHistory}
          title="Consultar historial de paquetes y descargas DIAN"
        >
          <AppIcon name="kardex" size={16} />
          <span>Historial</span>
        </button>

        {canValidate && (
          <button
            type="button"
            className="outline-button"
            onClick={onValidate}
            disabled={isValidating}
            title="Ejecutar motor de validación DIAN sobre terceros y valores"
          >
            <AppIcon
              name={isValidating ? 'refresh' : 'check'}
              size={16}
              className={isValidating ? 'animate-spin' : ''}
            />
            <span>{isValidating ? 'Validando...' : 'Validar información'}</span>
          </button>
        )}

        {canGenerate && (
          <button
            type="button"
            className="primary-button compact"
            onClick={onOpenWizard}
            title="Generar paquete oficial de archivos XML para la DIAN"
          >
            <AppIcon name="sparkles" size={16} />
            <span>Generar archivos</span>
          </button>
        )}
      </div>
    </header>
  )
}
