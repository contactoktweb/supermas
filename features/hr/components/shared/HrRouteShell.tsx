'use client'

import React from 'react'
import { AppShell } from '@/components/navigation/AppShell'
import { HR_ROUTES } from '../../constants'

interface HrRouteShellProps {
  section: string
  parent?: { label: string; href: string }
  children: React.ReactNode
}

/** AppShell con la ruta de navegación del módulo de Recursos Humanos. */
export function HrRouteShell({ section, parent, children }: HrRouteShellProps) {
  const breadcrumbs = [
    { label: 'Inicio', href: '/' },
    { label: 'Recursos Humanos', href: HR_ROUTES.panel },
    ...(parent ? [parent] : []),
    { label: section },
  ]
  return <AppShell breadcrumbs={breadcrumbs}>{children}</AppShell>
}
