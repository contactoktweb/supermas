/**
 * Tratamiento de errores de PostgreSQL / PostgREST antes de responder al cliente (solo servidor).
 *
 * - El detalle técnico (código y mensaje) se registra únicamente en los logs del servidor.
 *   No se registran `details` ni `hint`: pueden contener valores de filas.
 * - Al cliente solo llegan mensajes de negocio escritos por nuestras funciones SQL
 *   (RAISE EXCEPTION en español con SQLSTATE controlado); el resto se reemplaza por un mensaje genérico.
 */

export interface DatabaseErrorLike {
  code?: string | null
  message?: string | null
}

/** SQLSTATE que nuestras funciones SQL usan en RAISE EXCEPTION con mensajes para el usuario. */
const BUSINESS_SQLSTATES = new Set(['P0001', 'P0002', '42501', '28000', '22023', '22003', '23502', '23503', '23505', '55000'])

/** Marcadores de mensajes nativos de PostgreSQL que revelan esquema, restricciones o internos. */
const INTERNAL_DETAIL_PATTERN =
  /violates|duplicate key|null value in column|relation "|column "|table "|constraint|schema|function |syntax|out of range|overflow|permission denied for|could not|canceling statement|deadlock|does not exist|invalid input/i

export function logDatabaseError(context: string, error: DatabaseErrorLike | null | undefined): void {
  console.error(`[DB] ${context}:`, { code: error?.code ?? null, message: error?.message ?? null })
}

/**
 * Devuelve el mensaje de negocio de una función SQL propia, o `fallback` si el error es interno.
 * Siempre registra el detalle en el servidor.
 */
export function clientSafeDatabaseMessage(context: string, error: DatabaseErrorLike | null | undefined, fallback: string): string {
  logDatabaseError(context, error)
  const message = error?.message?.trim()
  if (!message || !error?.code || !BUSINESS_SQLSTATES.has(error.code)) return fallback
  if (INTERNAL_DETAIL_PATTERN.test(message)) return fallback
  return message
}
