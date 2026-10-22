/**
 * SUPER MÁS ERP/POS — Contraseña temporal aleatoria
 *
 * Se genera en el SERVIDOR cuando el administrador crea un usuario sin escribir una contraseña.
 * Usa Web Crypto (`crypto.getRandomValues`, disponible en Node 18+ y Edge) con muestreo por
 * rechazo para que cada carácter sea uniforme. Nunca se persiste ni se registra: se devuelve
 * una sola vez al administrador y la cuenta queda marcada para cambiarla en el primer ingreso.
 */
import { newPasswordSchema } from '@/features/auth/schemas/password-policy.schema'

export const TEMPORARY_PASSWORD_LENGTH = 16

// Sin caracteres ambiguos (0/O, 1/l/I) para que el administrador pueda dictarla sin errores.
const UPPERCASE = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
const LOWERCASE = 'abcdefghijkmnopqrstuvwxyz'
const DIGITS = '23456789'
const SYMBOLS = '!#$%*?@+-='
const ALL_CHARACTERS = UPPERCASE + LOWERCASE + DIGITS + SYMBOLS
const REQUIRED_GROUPS = [UPPERCASE, LOWERCASE, DIGITS, SYMBOLS] as const

const UINT32_RANGE = 0x1_0000_0000

function secureRandomIndex(maxExclusive: number): number {
  const limit = UINT32_RANGE - (UINT32_RANGE % maxExclusive)
  const buffer = new Uint32Array(1)
  let value: number
  do {
    globalThis.crypto.getRandomValues(buffer)
    value = buffer[0]
  } while (value >= limit)
  return value % maxExclusive
}

function pick(alphabet: string): string {
  return alphabet[secureRandomIndex(alphabet.length)]
}

/** Genera una contraseña temporal fuerte que cumple la política de `password-policy.schema`. */
export function generateTemporaryPassword(length: number = TEMPORARY_PASSWORD_LENGTH): string {
  if (length < REQUIRED_GROUPS.length) {
    throw new Error('La longitud de la contraseña temporal es insuficiente.')
  }

  const characters = REQUIRED_GROUPS.map(pick)
  while (characters.length < length) characters.push(pick(ALL_CHARACTERS))

  // Fisher-Yates para que los caracteres obligatorios no queden en posiciones fijas.
  for (let i = characters.length - 1; i > 0; i--) {
    const j = secureRandomIndex(i + 1)
    ;[characters[i], characters[j]] = [characters[j], characters[i]]
  }

  const password = characters.join('')
  if (!newPasswordSchema.safeParse(password).success) {
    throw new Error('No se pudo generar una contraseña temporal válida.')
  }
  return password
}
