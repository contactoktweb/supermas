'use client'

import React from 'react'
import { CategoryPage } from '@/features/categories/components/CategoryPage'
import { AppShell } from '@/components/navigation/AppShell'

export default function CategoriasRoutePage() {
  return (
    <AppShell>
      <CategoryPage />
    </AppShell>
  )
}
