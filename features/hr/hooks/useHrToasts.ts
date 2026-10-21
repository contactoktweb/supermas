'use client'

import { useCallback, useState } from 'react'
import type { HrToastMessage, HrToastType } from '../types'

export function useHrToasts() {
  const [toasts, setToasts] = useState<HrToastMessage[]>([])

  const notify = useCallback((type: HrToastType, title: string, description?: string) => {
    setToasts((prev) => [...prev, { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, type, title, description }])
  }, [])

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id))
  }, [])

  return { toasts, notify, dismiss }
}

export type HrNotify = ReturnType<typeof useHrToasts>['notify']
