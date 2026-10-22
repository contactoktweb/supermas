import { extractErrorMessage } from '@/lib/utils'

interface PostgrestLikeError {
  code?: string
  message?: string
}

/**
 * Traduce errores de Supabase/PostgreSQL a mensajes para el usuario. Los mensajes de las
 * reglas de la base ya vienen en español; los genéricos de RLS o restricciones se reemplazan.
 */
export function toHrError(error: unknown, fallback: string): Error {
  const pgError = (error ?? {}) as PostgrestLikeError
  const message = pgError.message ?? ''

  if (pgError.code === '42501' && /row-level security|permission denied/i.test(message)) {
    return new Error('No tiene permisos para realizar esta operación de Recursos Humanos.')
  }
  if (pgError.code === '23505') {
    if (/document/i.test(message)) return new Error('Ya existe un empleado con ese tipo y número de documento.')
    if (/user/i.test(message)) return new Error('Ese usuario del ERP ya está vinculado a otro empleado.')
    if (/name|code/i.test(message)) return new Error('Ya existe un registro con ese nombre o código.')
    return new Error('El registro ya existe.')
  }
  if (pgError.code === '23503' && /violates foreign key/i.test(message)) {
    return new Error('El registro está relacionado con información que no existe o no se puede modificar.')
  }
  if (pgError.code === '23514') {
    return new Error('Los datos no cumplen las reglas de validación del módulo.')
  }

  return new Error(extractErrorMessage(error, fallback))
}
