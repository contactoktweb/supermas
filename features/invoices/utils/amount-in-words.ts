/** Valor en letras para documentos comerciales: 3570.5 → "TRES MIL QUINIENTOS SETENTA PESOS CON 50/100 M/CTE". */

const UNITS = ['', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve', 'veinte', 'veintiuno', 'veintidós', 'veintitrés', 'veinticuatro', 'veinticinco', 'veintiséis', 'veintisiete', 'veintiocho', 'veintinueve']
const TENS = ['', '', '', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa']
const HUNDREDS = ['', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos', 'setecientos', 'ochocientos', 'novecientos']

function belowThousand(n: number): string {
  if (n === 0) return ''
  if (n === 100) return 'cien'
  const hundreds = Math.floor(n / 100)
  const rest = n % 100
  const parts = [HUNDREDS[hundreds]]
  if (rest < 30) parts.push(UNITS[rest])
  else parts.push(TENS[Math.floor(rest / 10)] + (rest % 10 ? ` y ${UNITS[rest % 10]}` : ''))
  return parts.filter(Boolean).join(' ')
}

/** "uno" pierde la -o delante de un sustantivo o de "mil"/"millones": veintiún mil, un millón. */
const apocope = (words: string) => words.replace(/veintiuno$/, 'veintiún').replace(/uno$/, 'un')

function integerInWords(n: number): string {
  if (n === 0) return 'cero'
  const millions = Math.floor(n / 1_000_000)
  const thousands = Math.floor((n % 1_000_000) / 1000)
  const rest = n % 1000
  const parts: string[] = []
  if (millions) parts.push(millions === 1 ? 'un millón' : `${apocope(integerInWords(millions))} millones`)
  if (thousands) parts.push(thousands === 1 ? 'mil' : `${apocope(belowThousand(thousands))} mil`)
  if (rest) parts.push(belowThousand(rest))
  return parts.join(' ')
}

export function amountInWords(amount: number): string {
  const cents = Math.round(Math.abs(amount) * 100)
  const pesos = Math.floor(cents / 100)
  const centavos = cents % 100
  let words = apocope(integerInWords(pesos))
  // "un millón de pesos", "dos millones de pesos"
  words += /(millón|millones)$/.test(words) ? ' de pesos' : pesos === 1 ? ' peso' : ' pesos'
  if (centavos) words += ` con ${String(centavos).padStart(2, '0')}/100`
  return `${words} M/CTE`.toUpperCase()
}
