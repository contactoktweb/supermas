'use client'

import React, { Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { ReceiptsPage } from '@/features/purchases/components/ReceiptsPage'
import { AppShell } from '@/components/navigation/AppShell'

function ReceiptsContent() {
  const router = useRouter()

  const handleNavigate = (path: string) => {
    router.push(path)
  }

  return <ReceiptsPage onNavigate={handleNavigate} />
}

export default function RecepcionesRoutePage() {
  return (
    <AppShell>
      <Suspense fallback={<div style={{ padding: 32 }}>Cargando recepciones de mercancía...</div>}>
        <ReceiptsContent />
      </Suspense>
    </AppShell>
  )
}
