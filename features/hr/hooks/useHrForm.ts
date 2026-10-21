'use client'

import { useCallback, useState } from 'react'
import type { z } from 'zod'
import { extractErrorMessage } from '@/lib/utils'
import { zodFieldErrors } from '../schemas/hr.schema'

/**
 * Estado de formulario con validación Zod en el cliente y error general de servidor.
 * `submit` devuelve true cuando la acción terminó correctamente.
 */
export function useHrForm<T extends object>(initial: T) {
  const [values, setValues] = useState<T>(initial)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  const setField = useCallback(<K extends keyof T>(key: K, value: T[K]) => {
    setValues((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => {
      if (!prev[key as string] && !prev.form) return prev
      const next = { ...prev }
      delete next[key as string]
      delete next.form
      return next
    })
  }, [])

  const reset = useCallback((next: T) => {
    setValues(next)
    setErrors({})
  }, [])

  const submit = useCallback(
    async (schema: z.ZodType, action: (values: T) => Promise<void>): Promise<boolean> => {
      const parsed = schema.safeParse(values)
      if (!parsed.success) {
        setErrors(zodFieldErrors(parsed.error))
        return false
      }
      setIsSubmitting(true)
      setErrors({})
      try {
        await action(values)
        return true
      } catch (err) {
        setErrors({ form: extractErrorMessage(err, 'No se pudo completar la operación.') })
        return false
      } finally {
        setIsSubmitting(false)
      }
    },
    [values]
  )

  return { values, setField, errors, setErrors, isSubmitting, submit, reset }
}
