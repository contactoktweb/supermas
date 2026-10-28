import { execFileSync } from 'child_process'
import * as fs from 'fs'
import * as zlib from 'zlib'

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

/** Imprime un HTML local a PDF con Chrome sin ventana. */
export function imprimirPdf(rutaHtml: string, rutaPdf: string): void {
  if (!fs.existsSync(CHROME)) throw new Error(`No se encontró Google Chrome en ${CHROME}.`)
  fs.rmSync(rutaPdf, { force: true })
  execFileSync(
    CHROME,
    ['--headless', '--disable-gpu', '--no-pdf-header-footer', '--run-all-compositor-stages-before-draw', `--print-to-pdf=${rutaPdf}`, `file://${rutaHtml}`],
    { stdio: 'pipe' }
  )
  if (!fs.existsSync(rutaPdf)) throw new Error('Chrome no generó el PDF.')
}

/** Objetos "n 0 obj ... endobj" del PDF, descomprimiendo los flujos de objetos (/ObjStm) si existen. */
function objetosPdf(pdf: Buffer): Map<number, string> {
  const texto = pdf.toString('latin1')
  const objetos = new Map<number, string>()
  const re = /(\d+) 0 obj([\s\S]*?)endobj/g
  let m: RegExpExecArray | null
  while ((m = re.exec(texto))) objetos.set(Number(m[1]), m[2])

  for (const [, cuerpo] of [...objetos]) {
    if (!/\/Type\s*\/ObjStm/.test(cuerpo)) continue
    const n = Number(/\/N (\d+)/.exec(cuerpo)?.[1] ?? 0)
    const primero = Number(/\/First (\d+)/.exec(cuerpo)?.[1] ?? 0)
    const inicio = cuerpo.indexOf('stream') + 'stream'.length
    const fin = cuerpo.lastIndexOf('endstream')
    const crudo = Buffer.from(cuerpo.slice(inicio, fin).replace(/^\r?\n/, ''), 'latin1')
    let datos: string
    try {
      datos = zlib.inflateSync(crudo).toString('latin1')
    } catch {
      continue
    }
    const cabecera = datos.slice(0, primero).trim().split(/\s+/).map(Number)
    for (let i = 0; i < n; i++) {
      const num = cabecera[i * 2]
      const desde = primero + cabecera[i * 2 + 1]
      const hasta = i + 1 < n ? primero + cabecera[(i + 1) * 2 + 1] : datos.length
      objetos.set(num, datos.slice(desde, hasta))
    }
  }
  return objetos
}

/** Orden de las páginas recorriendo el árbol /Pages desde la raíz. */
function ordenPaginas(objetos: Map<number, string>): number[] {
  const raiz = [...objetos].find(([, c]) => /\/Type\s*\/Pages/.test(c) && !/\/Parent/.test(c))
  if (!raiz) return []
  const orden: number[] = []
  const visitar = (num: number) => {
    const cuerpo = objetos.get(num) ?? ''
    if (/\/Type\s*\/Page\b(?!s)/.test(cuerpo)) {
      orden.push(num)
      return
    }
    const kids = /\/Kids\s*\[([^\]]*)\]/.exec(cuerpo)?.[1] ?? ''
    for (const k of kids.matchAll(/(\d+) 0 R/g)) visitar(Number(k[1]))
  }
  visitar(raiz[0])
  return orden
}

function decodificarNombre(nombre: string): string {
  return nombre.replace(/#([0-9a-fA-F]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
}

/**
 * Página (desde 1) de cada ancla del documento.
 * Chrome guarda los destinos con nombre en el diccionario /Dests del catálogo: /ancla [pagina 0 R /XYZ x y z].
 */
export function paginasDeAnclas(rutaPdf: string): { paginas: Map<string, number>; totalPaginas: number } {
  const objetos = objetosPdf(fs.readFileSync(rutaPdf))
  const orden = ordenPaginas(objetos)
  const indicePorObjeto = new Map(orden.map((num, i) => [num, i + 1]))
  const paginas = new Map<string, number>()
  for (const [, cuerpo] of objetos) {
    if (!/\/XYZ/.test(cuerpo)) continue
    for (const d of cuerpo.matchAll(/\/([^\s/\[\]()<>]+)\s*\[\s*(\d+) 0 R\s*\/XYZ/g)) {
      const pagina = indicePorObjeto.get(Number(d[2]))
      if (pagina) paginas.set(decodificarNombre(d[1]), pagina)
    }
  }
  return { paginas, totalPaginas: orden.length }
}
