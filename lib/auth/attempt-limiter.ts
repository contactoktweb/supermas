/**
 * SUPER MÁS ERP/POS — Limitador básico de intentos (memoria del proceso)
 *
 * Frena reintentos en ráfaga sobre operaciones sensibles de una misma cuenta. Es por instancia
 * del servidor (no compartido entre réplicas); Supabase Auth aplica además sus propios límites.
 */

export interface AttemptLimiterOptions {
  maxAttempts: number
  windowMs: number
}

export interface AttemptLimiter {
  /** Registra un intento. Devuelve los segundos de espera si se superó el límite, o 0 si se permite. */
  consume: (key: string) => number
  /** Libera la clave tras una operación exitosa. */
  reset: (key: string) => void
}

/** Por encima de este número de claves se purgan las ventanas vencidas para acotar memoria. */
const PRUNE_THRESHOLD = 500

export function createAttemptLimiter({ maxAttempts, windowMs }: AttemptLimiterOptions): AttemptLimiter {
  const attempts = new Map<string, number[]>()

  const prune = (now: number) => {
    for (const [key, timestamps] of attempts) {
      if (timestamps.every((t) => now - t >= windowMs)) attempts.delete(key)
    }
  }

  return {
    consume(key) {
      const now = Date.now()
      if (attempts.size > PRUNE_THRESHOLD) prune(now)
      const recent = (attempts.get(key) || []).filter((t) => now - t < windowMs)
      if (recent.length >= maxAttempts) {
        attempts.set(key, recent)
        return Math.max(1, Math.ceil((windowMs - (now - recent[0])) / 1000))
      }
      recent.push(now)
      attempts.set(key, recent)
      return 0
    },
    reset(key) {
      attempts.delete(key)
    },
  }
}
