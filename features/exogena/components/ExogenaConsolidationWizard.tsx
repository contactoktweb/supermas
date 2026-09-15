'use client'

import React, { useState, useEffect } from 'react'
import { AppIcon } from '@/components/ui/Icon'
import { ExogenaFormatConfig, ExogenaGenerationRecord } from '../types'
import { exogenaService } from '../services/exogena.service'

interface ExogenaConsolidationWizardProps {
  isOpen: boolean
  onClose: () => void
  year: number
  formats: ExogenaFormatConfig[]
  onComplete: (batch: ExogenaGenerationRecord) => void
  onOpenErrors: () => void
  showToast: (title: string, message: string, type: 'success' | 'error' | 'warning' | 'info') => void
}

type WizardStep = 'CONFIG' | 'PREPARING' | 'VALIDATING' | 'CONCILING' | 'GENERATING' | 'BLOCKED' | 'FINISHED'

export function ExogenaConsolidationWizard({
  isOpen,
  onClose,
  year,
  formats,
  onComplete,
  onOpenErrors,
  showToast,
}: ExogenaConsolidationWizardProps) {
  const [selectedFormats, setSelectedFormats] = useState<string[]>([])
  const [fileFormat, setFileFormat] = useState<'XML' | 'CSV'>('XML')
  const [currentStep, setCurrentStep] = useState<WizardStep>('CONFIG')
  const [progressPercent, setProgressPercent] = useState<number>(0)
  const [stepMessage, setStepMessage] = useState<string>('')
  const [generatedResult, setGeneratedResult] = useState<{
    generation: ExogenaGenerationRecord
    files: Array<{ formatNumber: string; fileName: string; content: string; recordCount: number }>
  } | null>(null)
  const [criticalErrorsCount, setCriticalErrorsCount] = useState<number>(0)

  useEffect(() => {
    if (isOpen) {
      // Por defecto seleccionar los formatos habilitados
      setSelectedFormats(formats.filter((f) => f.isEnabled).map((f) => f.formatNumber))
      setCurrentStep('CONFIG')
      setProgressPercent(0)
      setStepMessage('')
      setGeneratedResult(null)
      setCriticalErrorsCount(0)
    }
  }, [isOpen, formats])

  if (!isOpen) return null

  const handleFormatToggle = (formatNumber: string) => {
    setSelectedFormats((prev) =>
      prev.includes(formatNumber) ? prev.filter((c) => c !== formatNumber) : [...prev, formatNumber]
    )
  }

  const handleStartProcess = async () => {
    if (selectedFormats.length === 0) {
      showToast('Atención', 'Debes seleccionar al menos un formato para generar.', 'warning')
      return
    }

    try {
      // Paso 1: Preparando datos
      setCurrentStep('PREPARING')
      setProgressPercent(20)
      setStepMessage('Consolidando compras, ventas, nómina, terceros y asientos contables...')
      await new Promise((r) => setTimeout(r, 600))

      // Paso 2: Validando reglas DIAN
      setCurrentStep('VALIDATING')
      setProgressPercent(45)
      setStepMessage('Verificando terceros, NITs, dígitos de verificación y conceptos normativos...')
      const valRes = await exogenaService.validateYearData(year)
      if (!valRes.canGenerate) {
        setCurrentStep('BLOCKED')
        setCriticalErrorsCount(valRes.totalErrors)
        showToast(
          'Generación Bloqueada',
          `Se detectaron ${valRes.totalErrors} errores críticos que impiden la generación oficial.`,
          'error'
        )
        return
      }

      // Paso 3: Conciliando
      setCurrentStep('CONCILING')
      setProgressPercent(70)
      setStepMessage('Comparando saldos contables del ERP contra bases de medios magnéticos...')
      await new Promise((r) => setTimeout(r, 600))

      // Paso 4: Generando archivos
      setCurrentStep('GENERATING')
      setProgressPercent(90)
      setStepMessage(`Estructurando paquetes ${fileFormat} oficiales...`)

      const result = await exogenaService.generatePackage(
        year,
        selectedFormats,
        fileFormat,
        'Generación oficial Super Más',
        { id: 'usr-admin', name: 'Admin Mauricio', role: 'Administrador General' }
      )

      // Paso 5: Finalizado
      setCurrentStep('FINISHED')
      setProgressPercent(100)
      setStepMessage('Paquete de información generado y auditado satisfactoriamente.')
      setGeneratedResult(result)
      onComplete(result.generation)
      showToast('Generación Exitosa', 'Los archivos de Medios Magnéticos están listos para descarga.', 'success')
    } catch (err: any) {
      setCurrentStep('CONFIG')
      showToast('Error', err.message || 'Error en el proceso de generación', 'error')
    }
  }

  const handleDownloadFile = (fileName: string, content: string, type: 'XML' | 'CSV') => {
    const mime = type === 'XML' ? 'application/xml' : 'text/csv'
    const blob = new Blob([content], { type: `${mime};charset=utf-8;` })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', fileName)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    showToast('Descargando Archivo', `Descargando ${fileName}`, 'info')
  }

  return (
    <div
      className="drawer-backdrop"
      onClick={currentStep === 'FINISHED' || currentStep === 'BLOCKED' || currentStep === 'CONFIG' ? onClose : undefined}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="product-drawer"
        style={{ width: 'min(100%, 680px)', padding: '28px' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <span style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 600 }}>
              Asistente de Medios Magnéticos · DIAN
            </span>
            <h2 style={{ margin: '2px 0 0', fontSize: 19, fontWeight: 700, color: 'var(--text)' }}>
              Generación de Archivos Exógena {year}
            </h2>
          </div>
          {(currentStep === 'CONFIG' || currentStep === 'FINISHED' || currentStep === 'BLOCKED') && (
            <button type="button" className="icon-button" onClick={onClose} aria-label="Cerrar modal">
              <AppIcon name="close" size={18} />
            </button>
          )}
        </div>

        {/* Paso 0: Selección de formatos y tipo de archivo */}
        {currentStep === 'CONFIG' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <p style={{ fontSize: 13, color: 'var(--muted)', margin: 0 }}>
                Selecciona los formatos y el formato de salida requerido:
              </p>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  type="button"
                  onClick={() => setFileFormat('XML')}
                  className={`compact ${fileFormat === 'XML' ? 'primary-button' : 'outline-button'}`}
                  style={{ fontSize: 12, padding: '4px 10px' }}
                >
                  Muisca XML
                </button>
                <button
                  type="button"
                  onClick={() => setFileFormat('CSV')}
                  className={`compact ${fileFormat === 'CSV' ? 'primary-button' : 'outline-button'}`}
                  style={{ fontSize: 12, padding: '4px 10px' }}
                >
                  Prevalidador CSV
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 300, overflowY: 'auto', marginBottom: 20 }}>
              {formats.map((fmt) => {
                const isChecked = selectedFormats.includes(fmt.formatNumber)
                return (
                  <label
                    key={fmt.formatNumber}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '10px 14px',
                      borderRadius: 6,
                      border: isChecked ? '1px solid #93c5fd' : '1px solid var(--line, #e2e8f0)',
                      background: isChecked ? '#eff6ff' : 'var(--surface, #ffffff)',
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => handleFormatToggle(fmt.formatNumber)}
                      style={{ width: 16, height: 16, accentColor: 'var(--primary, #00205B)' }}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)' }}>
                          Formato {fmt.formatNumber}
                        </span>
                        <span style={{ fontSize: 11, color: 'var(--muted)' }}>v{fmt.version}</span>
                        {!fmt.isEnabled && (
                          <span style={{ fontSize: 10, padding: '1px 5px', borderRadius: 4, background: '#fee2e2', color: '#991b1b' }}>
                            Deshabilitado en config
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--muted)' }}>{fmt.name}</div>
                    </div>
                  </label>
                )
              })}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 16, borderTop: '1px solid var(--line, #e2e8f0)' }}>
              <button type="button" className="outline-button compact" onClick={onClose}>
                Cancelar
              </button>
              <button
                type="button"
                className="primary-button"
                onClick={handleStartProcess}
                disabled={selectedFormats.length === 0}
                style={{ display: 'flex', alignItems: 'center', gap: 8 }}
              >
                <AppIcon name="check" size={16} />
                <span>Iniciar Consolidación y Generación</span>
              </button>
            </div>
          </div>
        )}

        {/* Pasos en proceso: Preparando -> Validando -> Conciliando -> Generando */}
        {(currentStep === 'PREPARING' ||
          currentStep === 'VALIDATING' ||
          currentStep === 'CONCILING' ||
          currentStep === 'GENERATING') && (
          <div style={{ padding: '24px 0', textAlign: 'center' }}>
            <div style={{ marginBottom: 20 }}>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 56,
                  height: 56,
                  borderRadius: '50%',
                  background: '#eff6ff',
                  color: 'var(--primary, #00205B)',
                  animation: 'spin 2s linear infinite',
                  marginBottom: 16,
                }}
              >
                <AppIcon name="refresh" size={28} />
              </div>
              <h3 style={{ fontSize: 17, fontWeight: 700, margin: '0 0 6px', color: 'var(--text)' }}>
                {stepMessage}
              </h3>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)' }}>
                Por favor espera mientras el sistema procesa los libros contables y terceros.
              </p>
            </div>

            {/* Barra de progreso animada */}
            <div
              style={{
                width: '100%',
                height: 10,
                background: '#e2e8f0',
                borderRadius: 5,
                overflow: 'hidden',
                margin: '0 auto 16px',
              }}
            >
              <div
                style={{
                  width: `${progressPercent}%`,
                  height: '100%',
                  background: 'linear-gradient(90deg, #00205B 0%, #2563eb 100%)',
                  transition: 'width 0.4s ease',
                }}
              />
            </div>

            {/* Indicadores de etapas */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: 8,
                fontSize: 11,
                color: 'var(--muted)',
                fontWeight: 600,
              }}
            >
              <div style={{ color: currentStep === 'PREPARING' ? 'var(--primary, #00205B)' : '#166534' }}>
                1. Preparación
              </div>
              <div
                style={{
                  color:
                    currentStep === 'VALIDATING'
                      ? 'var(--primary, #00205B)'
                      : progressPercent > 45
                      ? '#166534'
                      : 'var(--muted)',
                }}
              >
                2. Validación
              </div>
              <div
                style={{
                  color:
                    currentStep === 'CONCILING'
                      ? 'var(--primary, #00205B)'
                      : progressPercent > 70
                      ? '#166534'
                      : 'var(--muted)',
                }}
              >
                3. Conciliación
              </div>
              <div
                style={{
                  color:
                    currentStep === 'GENERATING'
                      ? 'var(--primary, #00205B)'
                      : progressPercent >= 90
                      ? '#166534'
                      : 'var(--muted)',
                }}
              >
                4. Generación
              </div>
            </div>
          </div>
        )}

        {/* Bloqueado por errores */}
        {currentStep === 'BLOCKED' && (
          <div style={{ padding: '16px 0' }}>
            <div
              style={{
                padding: 16,
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: 8,
                marginBottom: 20,
                display: 'flex',
                gap: 12,
                alignItems: 'flex-start',
              }}
            >
              <div style={{ color: '#dc2626', marginTop: 2 }}>
                <AppIcon name="alerts" size={24} />
              </div>
              <div>
                <h4 style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 700, color: '#991b1b' }}>
                  Generación Detenida por Errores Críticos
                </h4>
                <p style={{ margin: 0, fontSize: 12.5, color: '#7f1d1d', lineHeight: 1.5 }}>
                  El motor de validación detectó <strong>{criticalErrorsCount} inconsistencia(s) crítica(s)</strong> que
                  violan las especificaciones del prevalidador de la DIAN. La normativa prohíbe generar archivos oficiales con
                  dígitos de verificación erróneos, municipios DANE vacíos o documentos faltantes.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button type="button" className="outline-button compact" onClick={onClose}>
                Cerrar
              </button>
              <button
                type="button"
                className="primary-button"
                onClick={() => {
                  onClose()
                  onOpenErrors()
                }}
                style={{ background: '#b91c1c' }}
              >
                Ver Detalle de Errores
              </button>
            </div>
          </div>
        )}

        {/* Finalizado con éxito */}
        {currentStep === 'FINISHED' && generatedResult && (
          <div style={{ padding: '16px 0' }}>
            <div
              style={{
                padding: 16,
                background: '#f0fdf4',
                border: '1px solid #bbf7d0',
                borderRadius: 8,
                marginBottom: 20,
                display: 'flex',
                gap: 12,
                alignItems: 'center',
              }}
            >
              <div style={{ color: '#16a34a' }}>
                <AppIcon name="check" size={28} />
              </div>
              <div>
                <h4 style={{ margin: '0 0 2px', fontSize: 15, fontWeight: 700, color: '#166534' }}>
                  ¡Información Generada Exitosamente!
                </h4>
                <p style={{ margin: 0, fontSize: 12.5, color: '#15803d' }}>
                  Lote #{generatedResult.generation.batchCode} registrado para el año {generatedResult.generation.year}.
                  Se consolidaron {generatedResult.generation.totalRecords} registros en {generatedResult.files.length} archivo(s).
                </p>
              </div>
            </div>

            <h4 style={{ fontSize: 13, fontWeight: 700, margin: '0 0 10px', color: 'var(--text)' }}>
              Archivos Oficiales Listos para Descarga:
            </h4>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
              {generatedResult.files.map((f, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    borderRadius: 6,
                    border: '1px solid var(--line, #e2e8f0)',
                    background: 'var(--table-header-bg, #f8fafc)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span
                      style={{
                        fontSize: 11,
                        padding: '2px 6px',
                        borderRadius: 4,
                        background: fileFormat === 'XML' ? '#e0f2fe' : '#fef3c7',
                        color: fileFormat === 'XML' ? '#0369a1' : '#92400e',
                        fontWeight: 700,
                      }}
                    >
                      {fileFormat}
                    </span>
                    <div>
                      <span style={{ fontWeight: 600, fontSize: 12.5, color: 'var(--text)' }}>{f.fileName}</span>
                      <span style={{ fontSize: 11, color: 'var(--muted)', marginLeft: 8 }}>
                        Formato {f.formatNumber} · {f.recordCount} registros
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="outline-button compact"
                    onClick={() => handleDownloadFile(f.fileName, f.content, fileFormat)}
                    style={{ fontSize: 11, padding: '4px 10px' }}
                  >
                    <AppIcon name="download" size={13} />
                    <span>Descargar</span>
                  </button>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button type="button" className="primary-button" onClick={onClose}>
                Finalizar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
