/**
 * SUPER MÁS ERP/POS — Utilidad Universal de Análisis y Procesamiento CSV / Delimitado
 *
 * Soporta delimitadores estándar de hojas de cálculo (coma, punto y coma, tabulador),
 * escape de comillas dobles, saltos de línea dentro de campos y normalización
 * fiduciaria de formatos numéricos colombianos ($ 15.000,50).
 */

export interface CsvParseOptions {
  delimiter?: ',' | ';' | '\t'
  skipEmptyLines?: boolean
  trimValues?: boolean
}

/**
 * Detecta automáticamente si el archivo está delimitado por punto y coma (Excel ES),
 * coma (estándar internacional) o tabulador.
 */
export function detectDelimiter(firstLine: string): ',' | ';' | '\t' {
  const semicolons = (firstLine.match(/;/g) || []).length
  const tabs = (firstLine.match(/\t/g) || []).length
  const commas = (firstLine.match(/,/g) || []).length

  if (semicolons >= commas && semicolons >= tabs) return ';'
  if (tabs > commas) return '\t'
  return ','
}

/**
 * Parsea una línea CSV respetando comillas y caracteres escapados.
 */
export function parseCsvLine(line: string, delimiter: string = ','): string[] {
  const fields: string[] = []
  let currentField = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    const nextChar = line[i + 1]

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentField += '"'
        i++ // Saltar la comilla escapada
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === delimiter && !inQuotes) {
      fields.push(currentField)
      currentField = ''
    } else {
      currentField += char
    }
  }

  fields.push(currentField)
  return fields
}

/**
 * Parsea un contenido de texto CSV completo y retorna un array de objetos clave-valor.
 */
export function parseCsvContent<T = Record<string, string>>(
  csvText: string,
  options: CsvParseOptions = {}
): { headers: string[]; rows: T[] } {
  if (!csvText || !csvText.trim()) {
    return { headers: [], rows: [] }
  }

  // Eliminar BOM de UTF-8 si está presente
  const cleanText = csvText.charCodeAt(0) === 0xfeff ? csvText.slice(1) : csvText

  // Dividir líneas respetando posibles saltos dentro de comillas
  const lines: string[] = []
  let currentLine = ''
  let inQuotes = false

  for (let i = 0; i < cleanText.length; i++) {
    const char = cleanText[i]
    if (char === '"') {
      inQuotes = !inQuotes
      currentLine += char
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && cleanText[i + 1] === '\n') {
        i++ // consumir \r\n como un único salto
      }
      if (currentLine.trim() || !options.skipEmptyLines) {
        lines.push(currentLine)
      }
      currentLine = ''
    } else {
      currentLine += char
    }
  }

  if (currentLine.trim() || !options.skipEmptyLines) {
    lines.push(currentLine)
  }

  if (lines.length === 0) {
    return { headers: [], rows: [] }
  }

  const delimiter = options.delimiter || detectDelimiter(lines[0])
  const rawHeaders = parseCsvLine(lines[0], delimiter)
  const headers = rawHeaders.map((h) => (options.trimValues !== false ? h.trim() : h))

  const rows: T[] = []

  for (let idx = 1; idx < lines.length; idx++) {
    const line = lines[idx]
    if (!line.trim()) continue

    const values = parseCsvLine(line, delimiter)
    const rowObj: Record<string, any> = {}

    headers.forEach((header, colIdx) => {
      let val = values[colIdx] ?? ''
      if (options.trimValues !== false) {
        val = val.trim()
      }
      rowObj[header] = val
    })

    rows.push(rowObj as T)
  }

  return { headers, rows }
}

/**
 * Limpia y normaliza números en formatos colombianos o internacionales.
 * Ejemplos: "$ 15.000" -> 15000, "15,50" -> 15.5, "15.000,50" -> 15000.5
 */
export function parseCleanNumber(val: unknown, fallback: number = 0): number {
  if (val === null || val === undefined) return fallback
  if (typeof val === 'number') return isNaN(val) ? fallback : val

  let str = String(val).trim().replace(/[$COP\s]/gi, '')
  if (!str) return fallback

  // Caso: Formato colombiano con punto de miles y coma decimal (e.g. "15.000,50")
  if (str.includes('.') && str.includes(',')) {
    str = str.replace(/\./g, '').replace(',', '.')
  } else if (str.includes(',')) {
    // Caso: Solo coma decimal (e.g. "15,50") o coma de miles ("15,000")
    const parts = str.split(',')
    if (parts.length === 2 && parts[1].length <= 2) {
      str = parts[0] + '.' + parts[1]
    } else {
      str = str.replace(/,/g, '')
    }
  } else if (str.includes('.')) {
    // Caso: Solo puntos (e.g. "25.000" o "1.500.000" vs decimal "25.5")
    if (/^\d{1,3}(\.\d{3})+$/.test(str)) {
      str = str.replace(/\./g, '')
    }
  }

  const num = Number(str)
  return isNaN(num) ? fallback : num
}

/**
 * Limpia y normaliza booleanos en diversos formatos de hojas de cálculo.
 * Acepta: 'si', 'sí', 'true', '1', 'yes', 'activo'
 */
export function parseCleanBoolean(val: unknown, defaultValue: boolean = false): boolean {
  if (val === null || val === undefined) return defaultValue
  if (typeof val === 'boolean') return val

  const str = String(val).trim().toLowerCase()
  if (['si', 'sí', 'true', '1', 'yes', 'activo', 'habilitado'].includes(str)) return true
  if (['no', 'false', '0', 'inactivo', 'deshabilitado'].includes(str)) return false

  return defaultValue
}

export type ColombianNumberResult =
  | { ok: true; value: number; ambiguous: boolean }
  | { ok: false }

/**
 * Lee un número con el formato colombiano: coma decimal y punto de miles. No adivina: lo que no
 * encaje en el formato se rechaza en lugar de convertirse en 0 o en otra cifra.
 * Ejemplos: "3200,50" -> 3200.5, "1.500" -> 1500, "15.000,50" -> 15000.5, "25.5" -> 25.5.
 * ambiguous: una coma con tres decimales ("1,250") se lee como decimal, pero pudo escribirse como miles.
 */
export function parseColombianNumber(val: unknown): ColombianNumberResult {
  if (typeof val === 'number') return Number.isFinite(val) ? { ok: true, value: val, ambiguous: false } : { ok: false }
  const str = String(val ?? '').replace(/\$|\bCOP\b|\s/gi, '')

  if (/^-?\d+$/.test(str)) return { ok: true, value: Number(str), ambiguous: false }
  if (/^-?\d+,\d+$/.test(str)) {
    return { ok: true, value: Number(str.replace(',', '.')), ambiguous: /^-?\d{1,3},\d{3}$/.test(str) }
  }
  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(str)) {
    return { ok: true, value: Number(str.replace(/\./g, '').replace(',', '.')), ambiguous: false }
  }
  if (/^-?\d+\.\d+$/.test(str)) return { ok: true, value: Number(str), ambiguous: false }
  return { ok: false }
}

/** Decodifica un archivo CSV: UTF-8 si es válido; si no, Windows-1252 (el "CSV delimitado" de Excel en español). */
export function decodeCsvBytes(bytes: ArrayBuffer): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    return new TextDecoder('windows-1252').decode(bytes)
  }
}
