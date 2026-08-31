'use client'

import React from 'react'
import {
  Calendar,
  Clock,
  RefreshCw,
  Sparkles,
  UserCheck,
  Building2,
  Shield,
  Layers,
} from 'lucide-react'
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
            <Sparkles size={18} color="var(--red)" />
          </div>
          <div>
            <h1 className="hero-title">
              {greeting}, <span className="highlight-name">{user.name}</span>
            </h1>
            <div className="hero-meta-row">
              <span className="hero-badge role-badge">
                <Shield size={12} />
                <b>Rol:</b> {user.roleName}
              </span>
              <span className="hero-badge location-badge">
                <Building2 size={12} />
                {user.locationName}
              </span>
              <span className="hero-badge login-badge">
                <Clock size={12} />
                <b>Último acceso:</b> {lastLoginFormatted}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="hero-right-section">
        {/* Role Simulator Switcher for instant testing */}
        <div className="role-simulator-wrap">
          <span className="simulator-label">
            <UserCheck size={12} /> Probar vista como:
          </span>
          <div style={{ width: 230 }}>
            <CustomSelect
              size="sm"
              value={user.id}
              onChange={onUserChange}
              options={availableProfiles.map((p) => ({
                value: p.id,
                label: p.name,
                description: `${p.roleName} · ${p.locationName}`,
                badge: p.role,
              }))}
            />
          </div>
        </div>

        {/* Period Selector Tabs */}
        <div className="hero-period-controls">
          <div className="segmented period-segmented-tabs" role="tablist">
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

          <button
            type="button"
            className="icon-button refresh-btn"
            onClick={onRefresh}
            title="Actualizar datos del centro de control"
            aria-label="Actualizar datos"
            disabled={isRefreshing}
          >
            <RefreshCw
              size={15}
              className={isRefreshing ? 'spin-animation' : ''}
            />
          </button>
        </div>
      </div>
    </header>
  )
}
