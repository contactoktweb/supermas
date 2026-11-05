'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { AppIcon } from '@/components/ui/Icon'
import { cashSessionService } from '../../services/cash-session.service'
import type { CashOpeningKey } from '../../types'
import { REDUCED_MOTION_CLASS, getErrorMessage } from './cashUi'

/** Tiempo que se muestra la confirmación de "Copiada" (ms). */
const COPY_FEEDBACK_MS = 2000
/** Margen tras la medianoche antes de pedir la clave nueva (ms). */
const RENEWAL_MARGIN_MS = 1000
const MASKED_KEY = '••••••'

/** "2026-11-05" → "jueves, 5 de noviembre de 2026" sin desfase de zona horaria. */
function formatBusinessDate(value: string): string {
  const [year, month, day] = value.split('-').map(Number)
  if (!year || !month || !day) return value
  return new Date(year, month - 1, day).toLocaleDateString('es-CO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

type CopyState = 'idle' | 'copied' | 'failed'

/** Clave diaria de apertura de caja para administradores y encargados de abrir cajas. */
export function CashOpeningKeyCard() {
  const [openingKey, setOpeningKey] = useState<CashOpeningKey | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [revealed, setRevealed] = useState(false)
  const [copyState, setCopyState] = useState<CopyState>('idle')

  const loadKey = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      setOpeningKey(await cashSessionService.getOpeningKey())
      setRevealed(false)
    } catch (err) {
      setError(getErrorMessage(err, 'No fue posible consultar la clave de apertura.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadKey()
  }, [loadKey])

  // Al llegar la medianoche (hora de Bogotá) se pide la clave del nuevo día.
  useEffect(() => {
    if (!openingKey) return
    const msUntilRenewal = new Date(openingKey.validUntil).getTime() - Date.now() + RENEWAL_MARGIN_MS
    if (!Number.isFinite(msUntilRenewal)) return
    const timer = setTimeout(loadKey, Math.max(msUntilRenewal, RENEWAL_MARGIN_MS))
    return () => clearTimeout(timer)
  }, [openingKey, loadKey])

  useEffect(() => {
    if (copyState === 'idle') return
    const timer = setTimeout(() => setCopyState('idle'), COPY_FEEDBACK_MS)
    return () => clearTimeout(timer)
  }, [copyState])

  const handleCopy = async () => {
    if (!openingKey) return
    try {
      await navigator.clipboard.writeText(openingKey.key)
      setCopyState('copied')
    } catch {
      setCopyState('failed')
    }
  }

  return (
    <section
      aria-labelledby="cash-opening-key-title"
      className={`page-enter bg-white rounded-xl border border-gray-200 shadow-xs p-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between ${REDUCED_MOTION_CLASS}`}
    >
      <div className="flex items-start gap-3 min-w-0">
        <span
          className="w-10 h-10 shrink-0 rounded-lg flex items-center justify-center bg-amber-50 text-amber-700"
          aria-hidden="true"
        >
          <AppIcon name="key" size={20} />
        </span>
        <div className="min-w-0">
          <h2 id="cash-opening-key-title" className="text-sm font-bold text-gray-900">
            Clave de apertura del día
          </h2>
          <p className="text-xs text-gray-500">
            {openingKey ? (
              <>
                <span className="capitalize">{formatBusinessDate(openingKey.businessDate)}</span>
                {' · '}Se renueva a medianoche.
              </>
            ) : (
              'Entréguela solo a quien vaya a abrir una caja hoy. Se renueva a medianoche.'
            )}
          </p>
        </div>
      </div>

      {loading && !openingKey ? (
        <div className="h-11 w-56 rounded-lg bg-gray-100 animate-pulse motion-reduce:animate-none" aria-hidden="true" />
      ) : error ? (
        <div role="alert" className="flex flex-wrap items-center gap-3 text-xs text-red-700">
          <span className="flex items-center gap-1.5">
            <AppIcon name="warning" size={14} />
            {error}
          </span>
          <button type="button" className={`outline-button compact ${REDUCED_MOTION_CLASS}`} onClick={loadKey}>
            <AppIcon name="refresh" size={14} />
            <span>Reintentar</span>
          </button>
        </div>
      ) : openingKey ? (
        <div className="flex flex-wrap items-center gap-2">
          <output
            aria-label={revealed ? `Clave: ${openingKey.key.split('').join(' ')}` : 'Clave oculta'}
            className="min-w-[8.5rem] text-center px-4 py-2 rounded-lg bg-slate-50 border border-slate-200 font-mono text-xl font-bold tracking-[0.3em] text-gray-900 select-all"
          >
            {revealed ? openingKey.key : MASKED_KEY}
          </output>
          <button
            type="button"
            className={`outline-button compact ${REDUCED_MOTION_CLASS}`}
            onClick={() => setRevealed((value) => !value)}
            aria-pressed={revealed}
          >
            <AppIcon name={revealed ? 'eyeOff' : 'eye'} size={14} />
            <span>{revealed ? 'Ocultar' : 'Mostrar'}</span>
          </button>
          <button type="button" className={`outline-button compact ${REDUCED_MOTION_CLASS}`} onClick={handleCopy}>
            <AppIcon name={copyState === 'copied' ? 'check' : 'copy'} size={14} />
            <span>{copyState === 'copied' ? 'Copiada' : 'Copiar'}</span>
          </button>
          <span className="sr-only" aria-live="polite">
            {copyState === 'copied'
              ? 'Clave copiada al portapapeles.'
              : copyState === 'failed'
                ? 'No fue posible copiar la clave.'
                : ''}
          </span>
          {copyState === 'failed' && (
            <span className="text-xs text-red-700" aria-hidden="true">
              No fue posible copiar.
            </span>
          )}
        </div>
      ) : null}
    </section>
  )
}
