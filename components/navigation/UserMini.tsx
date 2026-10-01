'use client'

import React from 'react'
import { useAuth } from '@/features/auth'
import { AppIcon } from '@/components/ui/Icon'

interface UserMiniProps {
  onLogout?: () => void
}

export function UserMini({ onLogout }: UserMiniProps) {
  const { user, signOut } = useAuth()

  const handleLogout = async () => {
    if (onLogout) {
      onLogout()
    } else {
      await signOut()
    }
  }

  if (!user) {
    return null
  }

  return (
    <button
      className="user-mini"
      onClick={handleLogout}
      title="Cerrar sesión fiduciaria"
      type="button"
      aria-label="Cerrar sesión"
    >
      <div className="avatar">{user.avatar}</div>
      <div>
        <strong>{user.fullName}</strong>
        <span>{user.roleName}</span>
      </div>
      <AppIcon name="logout" size={18} />
    </button>
  )
}
