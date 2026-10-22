'use client'

import React from 'react'
import type { HrBadgeTone } from '../../constants'

const TONE_CLASSES: Record<HrBadgeTone, string> = {
  success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  warning: 'bg-amber-50 text-amber-700 border-amber-200',
  danger: 'bg-red-50 text-red-700 border-red-200',
  info: 'bg-blue-50 text-blue-800 border-blue-200',
  neutral: 'bg-slate-100 text-slate-600 border-slate-200',
}

interface HrBadgeProps {
  tone: HrBadgeTone
  children: React.ReactNode
}

export function HrBadge({ tone, children }: HrBadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-md border px-2 py-1 text-[11px] font-bold leading-none ${TONE_CLASSES[tone]}`}
    >
      {children}
    </span>
  )
}
