import React from 'react'
import type { SelectOption } from '@/components/ui/CustomSelect'
import type { AlertPriority } from '../types'

const PRIORITY_META: Record<AlertPriority, { label: string; dotClass: string }> = {
  CRITICA: { label: 'Crítica', dotClass: 'bg-rose-500' },
  ALTA: { label: 'Alta', dotClass: 'bg-orange-500' },
  MEDIA: { label: 'Media', dotClass: 'bg-amber-400' },
  BAJA: { label: 'Baja', dotClass: 'bg-emerald-500' },
}

const PRIORITY_ORDER: AlertPriority[] = ['CRITICA', 'ALTA', 'MEDIA', 'BAJA']

function PriorityDot({ className }: { className: string }) {
  return <span aria-hidden="true" className={`inline-block h-2.5 w-2.5 rounded-full ${className}`} />
}

/** Opciones de prioridad para selects, con un punto de color decorativo en lugar de emojis. */
export const ALERT_PRIORITY_SELECT_OPTIONS: SelectOption[] = PRIORITY_ORDER.map((priority) => ({
  value: priority,
  label: PRIORITY_META[priority].label,
  icon: <PriorityDot className={PRIORITY_META[priority].dotClass} />,
}))
