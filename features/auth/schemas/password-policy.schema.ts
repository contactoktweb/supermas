import { z } from 'zod'

/**
 * SUPER MÁS ERP/POS — Política de contraseñas (compartida cliente/servidor)
 *
 * La misma definición alimenta la lista de requisitos y el medidor de fortaleza de la UI
 * y la validación Zod del Route Handler, para que nunca diverjan.
 */

export const PASSWORD_MIN_LENGTH = 10
/** bcrypt (Supabase Auth) solo considera los primeros 72 bytes. */
export const PASSWORD_MAX_LENGTH = 72

const UPPERCASE_PATTERN = /\p{Lu}/u
const LOWERCASE_PATTERN = /\p{Ll}/u
const DIGIT_PATTERN = /\p{N}/u
const SYMBOL_PATTERN = /[^\p{L}\p{N}\s]/u

export type PasswordRuleId = 'length' | 'uppercase' | 'lowercase' | 'digit' | 'symbol'

export interface PasswordRule {
  id: PasswordRuleId
  label: string
  isSatisfiedBy: (password: string) => boolean
}

export const PASSWORD_RULES: readonly PasswordRule[] = [
  {
    id: 'length',
    label: `Mínimo ${PASSWORD_MIN_LENGTH} caracteres`,
    isSatisfiedBy: (password) => password.length >= PASSWORD_MIN_LENGTH,
  },
  { id: 'uppercase', label: 'Una letra mayúscula', isSatisfiedBy: (password) => UPPERCASE_PATTERN.test(password) },
  { id: 'lowercase', label: 'Una letra minúscula', isSatisfiedBy: (password) => LOWERCASE_PATTERN.test(password) },
  { id: 'digit', label: 'Un número', isSatisfiedBy: (password) => DIGIT_PATTERN.test(password) },
  { id: 'symbol', label: 'Un símbolo (! # $ % * ?)', isSatisfiedBy: (password) => SYMBOL_PATTERN.test(password) },
]

export const newPasswordSchema = z
  .string({ error: 'Ingrese la nueva contraseña.' })
  .min(PASSWORD_MIN_LENGTH, `La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres.`)
  .max(PASSWORD_MAX_LENGTH, `La contraseña no puede superar ${PASSWORD_MAX_LENGTH} caracteres.`)
  .regex(UPPERCASE_PATTERN, 'La contraseña debe incluir al menos una letra mayúscula.')
  .regex(LOWERCASE_PATTERN, 'La contraseña debe incluir al menos una letra minúscula.')
  .regex(DIGIT_PATTERN, 'La contraseña debe incluir al menos un número.')
  .regex(SYMBOL_PATTERN, 'La contraseña debe incluir al menos un símbolo.')

export const changePasswordSchema = z
  .object({
    newPassword: newPasswordSchema,
    confirmPassword: z.string({ error: 'Confirme la nueva contraseña.' }),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Las contraseñas no coinciden.',
  })

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>

export type PasswordStrengthLevel = 0 | 1 | 2 | 3 | 4

export interface PasswordStrength {
  level: PasswordStrengthLevel
  label: string
  satisfiedRules: PasswordRuleId[]
  meetsPolicy: boolean
}

const STRENGTH_LABELS: Record<PasswordStrengthLevel, string> = {
  0: 'Muy débil',
  1: 'Débil',
  2: 'Aceptable',
  3: 'Fuerte',
  4: 'Muy fuerte',
}

/** Longitud a partir de la cual una contraseña que ya cumple la política se considera muy fuerte. */
const STRONG_LENGTH_BONUS = 14

export function evaluatePasswordStrength(password: string): PasswordStrength {
  const satisfiedRules = PASSWORD_RULES.filter((rule) => rule.isSatisfiedBy(password)).map((rule) => rule.id)
  const meetsPolicy = satisfiedRules.length === PASSWORD_RULES.length && password.length <= PASSWORD_MAX_LENGTH

  let level: PasswordStrengthLevel
  if (!password) level = 0
  else if (meetsPolicy) level = password.length >= STRONG_LENGTH_BONUS ? 4 : 3
  else if (satisfiedRules.length >= 4) level = 2
  else if (satisfiedRules.length >= 2) level = 1
  else level = 0

  return { level, label: STRENGTH_LABELS[level], satisfiedRules, meetsPolicy }
}
