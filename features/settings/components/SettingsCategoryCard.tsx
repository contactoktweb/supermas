'use client'

import React from 'react'
import { AppIcon, LightIconName } from '@/components/ui/Icon'
import { CategoryCardInfo, SettingsCategory } from '../types'

interface SettingsCategoryCardProps {
  card: CategoryCardInfo
  onSelect: (category: SettingsCategory) => void
}

export function SettingsCategoryCard({ card, onSelect }: SettingsCategoryCardProps) {
  const badgeClasses: Record<string, { bg: string; text: string; border: string }> = {
    blue: { bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe' },
    teal: { bg: '#ecfdf5', text: '#047857', border: '#a7f3d0' },
    amber: { bg: '#fffbeb', text: '#b45309', border: '#fde68a' },
    purple: { bg: '#f5f3ff', text: '#6d28d9', border: '#ddd6fe' },
    red: { bg: '#fef2f2', text: '#b91c1c', border: '#fecaca' },
    slate: { bg: '#f1f5f9', text: '#475569', border: '#cbd5e1' },
  }

  const tone = badgeClasses[card.badgeTone] || badgeClasses.slate

  return (
    <article
      onClick={() => onSelect(card.id)}
      className="group relative rounded-xl bg-white border border-[#e2e8f0] p-5 hover:border-[#b9c8df] hover:shadow-lg transition-all duration-300 cursor-pointer flex flex-col justify-between"
      style={{
        boxShadow: '0 4px 14px rgba(16, 33, 63, 0.04)',
      }}
    >
      <div>
        {/* Card Header: Icon + Badge */}
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-[#eef2fa] border border-[#e2e8f0] flex items-center justify-center text-[var(--navy)] group-hover:scale-105 group-hover:text-[var(--red)] group-hover:bg-[#fe110c12] transition-all duration-300">
            <AppIcon name={card.iconName as LightIconName} size={20} />
          </div>

          <span
            className="px-2.5 py-0.5 rounded-full text-[10px] font-bold border"
            style={{
              backgroundColor: tone.bg,
              color: tone.text,
              borderColor: tone.border,
            }}
          >
            {card.badgeText}
          </span>
        </div>

        {/* Title & Description */}
        <h3 className="text-sm font-bold text-[var(--navy)] group-hover:text-[var(--red)] transition-colors mb-1.5 flex items-center gap-1.5">
          <span>{card.title}</span>
          {card.isCritical && (
            <span
              className="w-1.5 h-1.5 rounded-full bg-[var(--red)] animate-pulse"
              title="Contiene parámetros críticos"
            />
          )}
        </h3>

        <p className="text-xs text-[var(--muted)] leading-relaxed line-clamp-2">
          {card.description}
        </p>
      </div>

      {/* Footer Link / Action */}
      <div className="mt-4 pt-3 border-t border-[#f1f5f9] flex items-center justify-between text-xs text-[var(--muted)] group-hover:text-[var(--navy)] transition-colors">
        <span className="font-bold text-[11px] uppercase tracking-wider text-[var(--muted)] group-hover:text-[var(--red)]">
          {card.isReadOnly ? 'Consultar Matriz' : 'Gestionar Parámetros'}
        </span>
        <AppIcon
          name="chevronRight"
          size={14}
          className="group-hover:translate-x-1 transition-transform text-[var(--muted)] group-hover:text-[var(--navy)]"
        />
      </div>
    </article>
  )
}
