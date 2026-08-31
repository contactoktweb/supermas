'use client'

import React from 'react'
import { Icon as IconifyIcon, IconProps as IconifyProps } from '@iconify/react'

/**
 * Super Más Light Icon Dictionary using Solar Linear & Phosphor Light icon sets
 * Ultra-crisp, elegant 1.2px/1.5px light strokes tailored for administrative ERP/POS.
 */
export const LIGHT_ICON_MAP = {
  // Navigation & Core Modules
  dashboard: 'solar:widget-linear',
  warehouse: 'solar:warehouse-linear',
  products: 'solar:box-linear',
  inventory: 'solar:box-minimalistic-linear',
  kardex: 'solar:clipboard-list-linear',
  transfers: 'solar:delivery-linear',
  purchases: 'solar:cart-large-2-linear',
  suppliers: 'solar:buildings-2-linear',
  customers: 'solar:users-group-rounded-linear',
  sales: 'solar:dollar-minimalistic-linear',
  pos: 'solar:shop-2-linear',
  invoices: 'solar:bill-list-linear',
  remisiones: 'solar:document-text-linear',
  cashRegisters: 'solar:card-linear',
  accounting: 'solar:calculator-minimalistic-linear',
  taxes: 'solar:hand-money-linear',
  exogena: 'solar:chart-2-linear',
  webOrders: 'solar:bolt-circle-linear',
  ecommerceSM: 'solar:shop-linear',
  ecommerceDist: 'solar:shop-2-linear',
  reports: 'solar:presentation-graph-linear',
  alerts: 'solar:bell-linear',
  audit: 'solar:shield-check-linear',
  users: 'solar:user-rounded-linear',
  roles: 'solar:user-id-linear',
  settings: 'solar:settings-linear',

  // Actions & Controls
  search: 'solar:magnifier-linear',
  filter: 'solar:filter-linear',
  sliders: 'solar:tuning-square-2-linear',
  sort: 'solar:sort-vertical-linear',
  plus: 'solar:add-circle-linear',
  edit: 'solar:pen-linear',
  trash: 'solar:trash-bin-trash-linear',
  eye: 'solar:eye-linear',
  download: 'solar:download-minimalistic-linear',
  upload: 'solar:upload-minimalistic-linear',
  save: 'solar:diskette-linear',
  refresh: 'solar:restart-linear',
  logout: 'solar:logout-2-linear',
  menu: 'solar:hamburger-menu-linear',
  more: 'solar:menu-dots-linear',
  lock: 'solar:lock-password-linear',
  powerOff: 'solar:power-linear',

  // Status & Feedback
  check: 'solar:check-circle-linear',
  checkSimple: 'ph:check-light',
  close: 'solar:close-circle-linear',
  closeSimple: 'ph:x-light',
  warning: 'solar:danger-triangle-linear',
  info: 'solar:info-circle-linear',
  sparkles: 'solar:stars-minimalistic-linear',

  // Arrows & Direction
  chevronDown: 'solar:alt-arrow-down-linear',
  chevronRight: 'solar:alt-arrow-right-linear',
  chevronUp: 'solar:alt-arrow-up-linear',
  chevronLeft: 'solar:alt-arrow-left-linear',
  arrowUpRight: 'solar:arrow-right-up-linear',
  arrowDownRight: 'solar:arrow-right-down-linear',
  arrowDownLeft: 'solar:arrow-left-down-linear',
  arrowRight: 'solar:arrow-right-linear',
  arrowLeftRight: 'solar:transfer-horizontal-linear',

  // Media & Metadata & Finance
  phone: 'solar:phone-calling-linear',
  mail: 'solar:letter-linear',
  calendar: 'solar:calendar-linear',
  clock: 'solar:clock-circle-linear',
  laptop: 'solar:laptop-minimalistic-linear',
  globe: 'solar:global-linear',
  shield: 'solar:shield-linear',
  award: 'solar:cup-star-linear',
  pieChart: 'solar:pie-chart-2-linear',
  grid: 'solar:grid-linear',
  table: 'solar:list-minimalistic-linear',
  receipt: 'solar:bill-list-linear',
  dollar: 'solar:dollar-minimalistic-linear',
  creditCard: 'solar:card-linear',
  fileText: 'solar:document-text-linear',
} as const

export type LightIconName = keyof typeof LIGHT_ICON_MAP

export interface AppIconProps extends Omit<IconifyProps, 'icon'> {
  name?: LightIconName
  icon?: string
  size?: number | string
  className?: string
  color?: string
}

/**
 * Universal AppIcon component for Super Más ERP
 */
export function AppIcon({
  name,
  icon,
  size = 18,
  className = '',
  color,
  style,
  ...rest
}: AppIconProps) {
  const iconString = icon || (name ? LIGHT_ICON_MAP[name] : 'solar:widget-linear')

  return (
    <IconifyIcon
      icon={iconString}
      width={size}
      height={size}
      className={`app-light-icon ${className}`}
      style={{
        display: 'inline-block',
        verticalAlign: 'middle',
        color,
        flexShrink: 0,
        ...style,
      }}
      {...rest}
    />
  )
}

export default AppIcon
