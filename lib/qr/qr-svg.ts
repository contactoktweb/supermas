/**
 * Genera un código QR como SVG (sin dependencias externas) para la representación gráfica DIAN.
 * Usa el generador de Nayuki (MIT) incluido en lib/vendor/qrcodegen.ts.
 */
import { qrcodegen } from '@/lib/vendor/qrcodegen'

export interface QrMatrix {
  size: number
  modules: boolean[][]
}

export function qrMatrix(text: string, ecc: 'L' | 'M' | 'Q' | 'H' = 'M'): QrMatrix {
  const level = { L: qrcodegen.QrCode.Ecc.LOW, M: qrcodegen.QrCode.Ecc.MEDIUM, Q: qrcodegen.QrCode.Ecc.QUARTILE, H: qrcodegen.QrCode.Ecc.HIGH }[ecc]
  const qr = qrcodegen.QrCode.encodeText(text, level)
  const modules: boolean[][] = []
  for (let y = 0; y < qr.size; y++) {
    const row: boolean[] = []
    for (let x = 0; x < qr.size; x++) row.push(qr.getModule(x, y))
    modules.push(row)
  }
  return { size: qr.size, modules }
}

/** SVG con margen de 4 módulos (zona silenciosa recomendada). */
export function qrSvg(text: string, opts: { ecc?: 'L' | 'M' | 'Q' | 'H'; border?: number; dark?: string; light?: string } = {}): string {
  const { size, modules } = qrMatrix(text, opts.ecc || 'M')
  const border = opts.border ?? 4
  const parts: string[] = []
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (modules[y][x]) parts.push(`M${x + border},${y + border}h1v1h-1z`)
    }
  }
  const dim = size + border * 2
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${dim} ${dim}" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="${opts.light || '#FFFFFF'}"/><path d="${parts.join('')}" fill="${opts.dark || '#000000'}"/></svg>`
}
