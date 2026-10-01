import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Extrae de forma segura un mensaje de error limpio y legible para humanos,
 * eliminando estructuras JSON crudas como `[ { "code": "custom", "path": [...], "message": "..." } ]`.
 */
export function extractErrorMessage(
  err: unknown,
  defaultMessage = 'Ha ocurrido un error inesperado'
): string {
  if (!err) return defaultMessage

  // 1. Si es un string, verificar si contiene JSON serializado o prefijos como "Error:"
  if (typeof err === 'string') {
    let trimmed = err.trim()
    if (trimmed.startsWith('Error:')) {
      trimmed = trimmed.replace(/^Error:\s*/, '').trim()
    }

    if (
      (trimmed.startsWith('[') && trimmed.endsWith(']')) ||
      (trimmed.startsWith('{') && trimmed.endsWith('}'))
    ) {
      try {
        const parsed = JSON.parse(trimmed)
        return extractErrorMessage(parsed, defaultMessage)
      } catch {
        return trimmed
      }
    }

    // Intentar extraer bloque JSON si viene envuelto
    const jsonArrayMatch = trimmed.match(/(\[\s*\{[\s\S]*\}\s*\])/)
    if (jsonArrayMatch) {
      try {
        const parsed = JSON.parse(jsonArrayMatch[1])
        return extractErrorMessage(parsed, defaultMessage)
      } catch {
        // Seguir con el string limpio
      }
    }

    return trimmed
  }

  // 2. Si es un arreglo (ej. Zod issues o JSON parseado de issues)
  if (Array.isArray(err)) {
    if (err.length === 0) return defaultMessage
    const messages = err
      .map((item) => {
        if (typeof item === 'string') return extractErrorMessage(item, '')
        if (item && typeof item === 'object') {
          if ('message' in item && typeof (item as any).message === 'string') {
            return (item as any).message
          }
          if ('error' in item && typeof (item as any).error === 'string') {
            return (item as any).error
          }
        }
        return null
      })
      .filter(Boolean) as string[]

    if (messages.length > 0) {
      const unique = Array.from(new Set(messages))
      return unique
        .map((m) => (m.endsWith('.') ? m : `${m}.`))
        .join(' ')
    }
  }

  // 3. Si es un objeto (Error, ZodError, PostgrestError, etc.)
  if (typeof err === 'object' && err !== null) {
    const anyErr = err as any

    // Zod issues o errors (Zod 3 y 4)
    const issues = anyErr.issues || anyErr.errors
    if (Array.isArray(issues) && issues.length > 0) {
      const messages = issues
        .map((issue: any) => issue?.message)
        .filter(Boolean) as string[]
      if (messages.length > 0) {
        const unique = Array.from(new Set(messages))
        return unique
          .map((m) => (m.endsWith('.') ? m : `${m}.`))
          .join(' ')
      }
    }

    // Standard Error con message
    if (typeof anyErr.message === 'string') {
      const msg = anyErr.message.trim()
      return extractErrorMessage(msg, defaultMessage)
    }

    if (typeof anyErr.error === 'string') return extractErrorMessage(anyErr.error, defaultMessage)
    if (typeof anyErr.error_description === 'string') return anyErr.error_description
    if (typeof anyErr.details === 'string') return anyErr.details
  }

  return String(err)
}
