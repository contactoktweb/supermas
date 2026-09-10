'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import { POSView } from '@/features/pos'

export function POSPageClient() {
  const router = useRouter()

  const handleReturnToAdmin = () => {
    router.push('/')
  }

  return <POSView onExit={handleReturnToAdmin} />
}
