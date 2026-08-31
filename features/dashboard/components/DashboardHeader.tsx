'use client'

import React from 'react'
import { AppIcon } from '@/components/ui/Icon'
import { UserProfile, PeriodType } from '../types'
import { dashboardService } from '../services/dashboard.service'
import { CustomSelect } from '@/components/ui/CustomSelect'

interface DashboardHeaderProps {
  user: UserProfile
  period: PeriodType
  onPeriodChange: (period: PeriodType) => void
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
  onRefresh,
  isRefreshing,
  availableProfiles,
  onUserChange,
}: DashboardHeaderProps) {
  const greeting = dashboardService.getDynamicGreeting()
  const lastLoginFormatted = dashboardService.formatDateTime(user.lastLoginAt)

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

        {/* Period Selector Tabs */}
        <div className="hero-period-controls">
          <div className="period-segmented-tabs" role="tablist">
            {periodLabels.map((p) => (
              <button
                key={p.id}
                role="tab"
                aria-selected={period === p.id}
                className={`period-tab-btn ${period === p.id ? 'selected' : ''}`}
                onClick={() => onPeriodChange(p.id)}
              >
                {p.label}
              </button>
            ))}
          </div>

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
