'use client'

import React, { useState } from 'react'
import { AppIcon } from '@/components/ui/Icon'
import { UserProfile, PeriodType, DateRange } from '../types'
import { dashboardService } from '../services/dashboard.service'
import { CustomSelect } from '@/components/ui/CustomSelect'
import { DateRangePicker, DateRangeValue } from '@/components/ui/DateRangePicker'

interface DashboardHeaderProps {
  user: UserProfile
  period: PeriodType
  onPeriodChange: (period: PeriodType) => void
  customRange?: DateRange
  onCustomRangeChange?: (range: DateRange) => void
  onRefresh: () => void
  isRefreshing: boolean
  availableProfiles: UserProfile[]
  onUserChange: (userId: string) => void
}

const periodLabels: { id: PeriodType; label: string }[] = [
  { id: 'TODAY', label: 'Hoy' },
  { id: '7_DAYS', label: '7 días' },
  { id: '30_DAYS', label: '30 días' },
  { id: 'THIS_MONTH', label: 'Este mes' },
  { id: 'YEAR', label: 'Año' },
  { id: 'CUSTOM', label: 'Personalizado' },
]

export function DashboardHeader({
  user,
  period,
  onPeriodChange,
  customRange = { startDate: '2026-08-01', endDate: '2026-08-31' },
  onCustomRangeChange,
  onRefresh,
  isRefreshing,
  availableProfiles,
  onUserChange,
}: DashboardHeaderProps) {
  const [isPickerOpen, setIsPickerOpen] = useState(false)
  const greeting = dashboardService.getDynamicGreeting()
  const lastLoginFormatted = dashboardService.formatDateTime(user.lastLoginAt)

  const handlePeriodClick = (pId: PeriodType) => {
    if (pId === 'CUSTOM') {
      onPeriodChange('CUSTOM')
      setIsPickerOpen((prev) => (period === 'CUSTOM' ? !prev : true))
    } else {
      setIsPickerOpen(false)
      onPeriodChange(pId)
    }
  }

  const handleRangeApply = (range: DateRangeValue) => {
    if (onCustomRangeChange) {
      onCustomRangeChange(range)
    }
    onPeriodChange('CUSTOM')
  }

  const customRangeFormatted = dashboardService.formatDateRange(customRange)

  return (
    <header className="dashboard-hero-header page-enter">
      <div className="hero-left-section">
        <div className="hero-salutation">
          <div className="hero-salutation-icon">
            <AppIcon name="sparkles" size={20} color="var(--red)" />
          </div>
          <div>
            <h1 className="hero-title">
              {greeting}, <span className="highlight-name">{user.name}</span>
            </h1>
            <div className="hero-meta-row">
              <span className="hero-badge role-badge">
                <AppIcon name="shield" size={13} /> {user.roleName}
              </span>
              <span className="hero-badge location-badge">
                <AppIcon name="suppliers" size={13} /> {user.locationName}
              </span>
              <span className="hero-badge login-badge">
                <AppIcon name="clock" size={13} /> Último ingreso: <b>{lastLoginFormatted}</b>
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="hero-right-section">
        {/* Role Simulator Dropdown */}
        <div className="role-simulator-wrap">
          <span className="simulator-label">
            <AppIcon name="users" size={13} /> Vista de rol:
          </span>
          <CustomSelect
            value={user.id}
            onChange={onUserChange}
            size="sm"
            className="role-switcher-select"
            options={availableProfiles.map((p) => ({
              value: p.id,
              label: `${p.name} (${p.roleName})`,
              description: p.locationName,
              badge: p.role,
            }))}
          />
        </div>

        {/* Period Selector Tabs & Custom Date Picker */}
        <div className="hero-period-controls">
          <div className="period-segmented-tabs" role="tablist">
            {periodLabels.map((p) => {
              const isCustom = p.id === 'CUSTOM'
              const isSelected = period === p.id

              return (
                <button
                  key={p.id}
                  role="tab"
                  aria-selected={isSelected}
                  className={`period-tab-btn ${isSelected ? 'selected' : ''} ${
                    isCustom ? 'custom-period-btn' : ''
                  }`}
                  onClick={() => handlePeriodClick(p.id)}
                  title={
                    isCustom && isSelected
                      ? `Rango activo: ${customRangeFormatted}. Clic para cambiar fechas.`
                      : undefined
                  }
                >
                  {isCustom && isSelected ? (
                    <span className="custom-tab-content">
                      <AppIcon name="calendar" size={12} />
                      <span>{p.label}</span>
                      <small className="custom-dates-pill">
                        {customRange.startDate.substring(5).replace('-', '/')} -{' '}
                        {customRange.endDate.substring(5).replace('-', '/')}
                      </small>
                    </span>
                  ) : (
                    p.label
                  )}
                </button>
              )
            })}
          </div>

          {/* Floating Date Range Picker Dropdown */}
          <DateRangePicker
            isOpen={isPickerOpen}
            value={customRange}
            onChange={handleRangeApply}
            onClose={() => setIsPickerOpen(false)}
            align="right"
          />

          {/* Refresh Action */}
          <button
            type="button"
            className="refresh-btn icon-button"
            onClick={onRefresh}
            disabled={isRefreshing}
            aria-label="Actualizar datos del Dashboard"
            title="Actualizar datos"
          >
            <AppIcon
              name="refresh"
              size={15}
              className={isRefreshing ? 'spin-animation' : ''}
            />
          </button>
        </div>
      </div>
    </header>
  )
}
