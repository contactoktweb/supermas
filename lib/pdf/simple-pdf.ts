/**
 * Generador de PDF mínimo (sin dependencias) para documentos del servidor: texto con Helvetica / Helvetica-Bold
 * (codificación WinAnsi, admite tildes y ñ), líneas, rectángulos, imágenes JPEG y varias páginas.
 * Las coordenadas se expresan en puntos desde la esquina SUPERIOR izquierda.
 */

export type PdfFont = 'regular' | 'bold'
export type PdfColor = [number, number, number]

export interface PdfTextOptions {
  size?: number
  font?: PdfFont
  color?: PdfColor
  align?: 'left' | 'right' | 'center'
}

/** Anchos AFM (1/1000 em) de los caracteres ASCII 32–126. */
const HELVETICA_WIDTHS = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556,
  556, 556, 556, 278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833,
  722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556,
  556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334,
  260, 334, 584,
]
const HELVETICA_BOLD_WIDTHS = [
  278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556,
  556, 556, 556, 333, 333, 584, 584, 584, 611, 975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833,
  722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556, 333, 556, 611, 556, 611,
  556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611, 611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389,
  280, 389, 584,
]

/** Caracteres fuera de Latin-1 que sí existen en WinAnsi. */
const WIN_ANSI_EXTRA: Record<string, number> = { '€': 0x80, '•': 0x95, '–': 0x96, '—': 0x97, '‘': 0x91, '’': 0x92, '“': 0x93, '”': 0x94 }

function toWinAnsi(text: string): number[] {
  const bytes: number[] = []
  for (const ch of text) {
    const code = ch.codePointAt(0) || 63
    if (code >= 32 && code <= 126) bytes.push(code)
    else if (code >= 0xa0 && code <= 0xff) bytes.push(code)
    else if (WIN_ANSI_EXTRA[ch]) bytes.push(WIN_ANSI_EXTRA[ch])
    else if (code === 10 || code === 13 || code === 9) bytes.push(32)
    else bytes.push(63) // '?'
  }
  return bytes
}

function charWidth(byte: number, font: PdfFont): number {
  const table = font === 'bold' ? HELVETICA_BOLD_WIDTHS : HELVETICA_WIDTHS
  if (byte >= 32 && byte <= 126) return table[byte - 32]
  // Letras acentuadas: ancho de su letra base
  const base = String.fromCharCode(byte).normalize('NFD').charCodeAt(0)
  if (base >= 32 && base <= 126) return table[base - 32]
  return 556
}

export function measureText(text: string, size: number, font: PdfFont = 'regular'): number {
  return (toWinAnsi(text).reduce((sum, b) => sum + charWidth(b, font), 0) * size) / 1000
}

/** Parte un texto en líneas que caben en `maxWidth` (corta palabras más largas que la línea). */
export function wrapText(text: string, maxWidth: number, size: number, font: PdfFont = 'regular'): string[] {
  const lines: string[] = []
  for (const paragraph of String(text || '').split(/\r?\n/)) {
    let line = ''
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const candidate = line ? `${line} ${word}` : word
      if (measureText(candidate, size, font) <= maxWidth) {
        line = candidate
        continue
      }
      if (line) lines.push(line)
      line = word
      while (measureText(line, size, font) > maxWidth && line.length > 1) {
        let cut = line.length - 1
        while (cut > 1 && measureText(line.slice(0, cut), size, font) > maxWidth) cut--
        lines.push(line.slice(0, cut))
        line = line.slice(cut)
      }
    }
    lines.push(line)
  }
  return lines
}

function pdfString(text: string): string {
  return (
    '(' +
    toWinAnsi(text)
      .map((b) => {
        if (b === 0x28 || b === 0x29 || b === 0x5c) return '\\' + String.fromCharCode(b)
        if (b < 32 || b > 126) return '\\' + b.toString(8).padStart(3, '0')
        return String.fromCharCode(b)
      })
      .join('') +
    ')'
  )
}

const n = (v: number) => (Math.round(v * 100) / 100).toString()
const rgb = (c: PdfColor) => c.map((v) => n(v / 255)).join(' ')

interface PdfImage {
  name: string
  data: Buffer
  width: number
  height: number
}

/** Dimensiones de un JPEG (marcador SOF). */
function jpegSize(data: Buffer): { width: number; height: number } {
  let i = 2
  while (i < data.length) {
    if (data[i] !== 0xff) throw new Error('JPEG inválido.')
    const marker = data[i + 1]
    const length = data.readUInt16BE(i + 2)
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      return { height: data.readUInt16BE(i + 5), width: data.readUInt16BE(i + 7) }
    }
    i += 2 + length
  }
  throw new Error('JPEG sin dimensiones.')
}

export class SimplePdf {
  readonly width: number
  readonly height: number
  private pages: string[][] = []
  private images: PdfImage[] = []

  constructor(width = 595.28, height = 841.89) {
    this.width = width
    this.height = height
    this.addPage()
  }

  get pageCount(): number {
    return this.pages.length
  }

  addPage(): void {
    this.pages.push([])
    this.current = this.pages.length - 1
  }

  /** Página activa; permite volver a una anterior (p. ej. para numerar "Página x de y" al final). */
  private current = 0

  goToPage(index: number): void {
    if (index < 0 || index >= this.pages.length) throw new Error('Página inexistente.')
    this.current = index
  }

  private get ops(): string[] {
    return this.pages[this.current]
  }

  /** `y` es la línea base del texto, medida desde arriba. */
  text(x: number, y: number, value: string, opts: PdfTextOptions = {}): void {
    const size = opts.size ?? 9
    const font = opts.font ?? 'regular'
    let left = x
    if (opts.align === 'right') left = x - measureText(value, size, font)
    else if (opts.align === 'center') left = x - measureText(value, size, font) / 2
    this.ops.push(
      `BT /${font === 'bold' ? 'F2' : 'F1'} ${n(size)} Tf ${rgb(opts.color ?? [17, 24, 39])} rg ${n(left)} ${n(this.height - y)} Td ${pdfString(value)} Tj ET`
    )
  }

  rect(x: number, y: number, w: number, h: number, opts: { fill?: PdfColor; stroke?: PdfColor; lineWidth?: number } = {}): void {
    const parts = [`${n(opts.lineWidth ?? 0.6)} w`]
    if (opts.fill) parts.push(`${rgb(opts.fill)} rg`)
    if (opts.stroke) parts.push(`${rgb(opts.stroke)} RG`)
    parts.push(`${n(x)} ${n(this.height - y - h)} ${n(w)} ${n(h)} re`)
    parts.push(opts.fill && opts.stroke ? 'B' : opts.fill ? 'f' : 'S')
    this.ops.push(parts.join(' '))
  }

  line(x1: number, y1: number, x2: number, y2: number, color: PdfColor = [203, 213, 225], lineWidth = 0.6): void {
    this.ops.push(`${n(lineWidth)} w ${rgb(color)} RG ${n(x1)} ${n(this.height - y1)} m ${n(x2)} ${n(this.height - y2)} l S`)
  }

  /** Dibuja un JPEG con el ancho indicado; devuelve la altura resultante. */
  jpeg(data: Buffer, x: number, y: number, width: number): number {
    const size = jpegSize(data)
    let image = this.images.find((img) => img.data === data)
    if (!image) {
      image = { name: `Im${this.images.length + 1}`, data, ...size }
      this.images.push(image)
    }
    const height = (width * size.height) / size.width
    this.ops.push(`q ${n(width)} 0 0 ${n(height)} ${n(x)} ${n(this.height - y - height)} cm /${image.name} Do Q`)
    return height
  }

  toBuffer(meta: { title?: string; author?: string } = {}): Buffer {
    const objects: Buffer[] = []
    const add = (content: string | Buffer) => {
      objects.push(Buffer.isBuffer(content) ? content : Buffer.from(content, 'latin1'))
      return objects.length
    }

    const catalogId = add('') // se rellena al final
    const pagesId = add('')
    const fontRegular = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>')
    const fontBold = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>')
    const imageIds = this.images.map((img) =>
      add(
        Buffer.concat([
          Buffer.from(
            `<< /Type /XObject /Subtype /Image /Width ${img.width} /Height ${img.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${img.data.length} >>\nstream\n`,
            'latin1'
          ),
          img.data,
          Buffer.from('\nendstream', 'latin1'),
        ])
      )
    )
    const xObjects = this.images.map((img, i) => `/${img.name} ${imageIds[i]} 0 R`).join(' ')
    const resources = `<< /Font << /F1 ${fontRegular} 0 R /F2 ${fontBold} 0 R >>${xObjects ? ` /XObject << ${xObjects} >>` : ''} >>`

    const pageIds = this.pages.map((ops) => {
      const stream = ops.join('\n')
      const contentId = add(`<< /Length ${Buffer.byteLength(stream, 'latin1')} >>\nstream\n${stream}\nendstream`)
      return add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${n(this.width)} ${n(this.height)}] /Resources ${resources} /Contents ${contentId} 0 R >>`)
    })

    objects[catalogId - 1] = Buffer.from(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`, 'latin1')
    objects[pagesId - 1] = Buffer.from(`<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`, 'latin1')
    const infoId = add(
      `<< /Producer (Super Mas ERP) ${meta.title ? `/Title ${pdfString(meta.title)}` : ''} ${meta.author ? `/Author ${pdfString(meta.author)}` : ''} >>`
    )

    const chunks: Buffer[] = [Buffer.from('%PDF-1.4\n%\xe2\xe3\xcf\xd3\n', 'latin1')]
    let offset = chunks[0].length
    const offsets: number[] = []
    objects.forEach((obj, i) => {
      offsets.push(offset)
      const chunk = Buffer.concat([Buffer.from(`${i + 1} 0 obj\n`, 'latin1'), obj, Buffer.from('\nendobj\n', 'latin1')])
      chunks.push(chunk)
      offset += chunk.length
    })
    const xref =
      `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n` +
      offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('') +
      `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R /Info ${infoId} 0 R >>\nstartxref\n${offset}\n%%EOF\n`
    chunks.push(Buffer.from(xref, 'latin1'))
    return Buffer.concat(chunks)
  }
}
