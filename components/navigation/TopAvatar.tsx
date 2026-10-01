'use client'

import React from 'react'
import { useAuth } from '@/features/auth'

export function TopAvatar() {
  const { user } = useAuth()

  return (
    <div
      className="top-avatar"
      title={user ? `${user.fullName} (${user.roleName})` : 'Sesión'}
      aria-label="Perfil de usuario"
    >
      {user?.avatar || 'SM'}
    </div>
  )
}
