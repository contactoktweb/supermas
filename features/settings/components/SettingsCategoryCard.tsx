'use client'

import React from 'react'
import { AppIcon, LightIconName } from '@/components/ui/Icon'
import { CategoryCardInfo, SettingsCategory } from '../types'

interface SettingsCategoryCardProps {
  card: CategoryCardInfo
  onSelect: (category: SettingsCategory) => void
}

const BADGE_TONES: Record<CategoryCardInfo['badgeTone'], { bg: string; text: string; border: string }> = {
  blue: { bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe' },
  teal: { bg: '#ecfdf5', text: '#047857', border: '#a7f3d0' },
  amber: { bg: '#fffbeb', text: '#b45309', border: '#fde68a' },
  purple: { bg: '#f5f3ff', text: '#6d28d9', border: '#ddd6fe' },
  red: { bg: '#fef2f2', text: '#b91c1c', border: '#fecaca' },
  slate: { bg: '#f1f5f9', text: '#475569', border: '#cbd5e1' },
}

export function SettingsCategoryCard({ card, onSelect }: SettingsCategoryCardProps) {
  const tone = BADGE_TONES[card.badgeTone]

  return (
    <button
      type="button"
      onClick={() => onSelect(card.id)}
      className="group relative w-full text-left rounded-xl bg-white border border-[#e2e8f0] p-5 hover:border-[#b9c8df] hover:shadow-lg focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#001b5c1a] focus-visible:border-[var(--navy)] transition-all duration-300 flex flex-col justify-between motion-reduce:transition-none"
      style={{ boxShadow: '0 4px 14px rgba(16, 33, 63, 0.04)' }}
    >
      <span className="block w-full">
        <span className="flex items-center justify-between gap-3 mb-3">
          <span className="w-10 h-10 rounded-xl bg-[#eef2fa] border border-[#e2e8f0] flex items-center justify-center text-[var(--navy)] group-hover:scale-105 group-hover:text-[var(--red)] group-hover:bg-[#fe110c12] transition-all duration-300 motion-reduce:transition-none">
            <AppIcon name={card.iconName as LightIconName} size={20} />
          </span>
          <span
            className="px-2.5 py-0.5 rounded-full text-[10px] font-bold border"
            style={{ backgroundColor: tone.bg, color: tone.text, borderColor: tone.border }}
          >
            {card.badgeText}
          </span>
        </span>

        <h3 className="text-sm font-bold text-[var(--navy)] group-hover:text-[var(--red)] transition-colors mb-1.5">
          {card.title}
        </h3>
        <span className="block text-xs text-[var(--muted)] leading-relaxed">{card.description}</span>
      </span>

      <span className="mt-4 pt-3 w-full border-t border-[#f1f5f9] flex items-center justify-between text-xs">
        <span className="font-bold text-[11px] uppercase tracking-wider text-[var(--muted)] group-hover:text-[var(--red)]">
          {card.isReadOnly ? 'Consultar' : 'Gestionar parámetros'}
        </span>
        <AppIcon
          name="chevronRight"
          size={14}
          className="group-hover:translate-x-1 transition-transform text-[var(--muted)] group-hover:text-[var(--navy)] motion-reduce:transition-none"
        />
      </span>
    </button>
  )
}
