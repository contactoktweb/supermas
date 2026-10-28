/**
 * SUPER MÁS ERP/POS — GENERADOR DEL MANUAL DE USUARIO (PDF)
 *
 * Ejecutar en la raíz del proyecto:  pnpm manual:pdf
 *
 * Toma el contenido de scripts/manual/contenido y las capturas de docs/manual/img
 * (carpeta fuera de Git porque las imágenes muestran datos reales) y genera
 * docs/manual/MANUAL_USUARIO_SUPER_MAS_ERP.pdf con Google Chrome sin ventana.
 *
 * Se detiene con error si falta una captura, si una pregunta apunta a una sección
 * que no existe o si hay anclas repetidas. Hace dos pasadas: la segunda escribe
 * en los índices la página real de cada sección.
 */

import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { CAPITULOS } from './contenido'
import { GLOSARIO } from './contenido/glosario'
import { PROBLEMAS } from './contenido/problemas'
import { PREGUNTAS } from './contenido/preguntas'
import { construirDocumento, type DatosDocumento } from './plantilla/documento'
import { imprimirPdf, paginasDeAnclas } from './pdf'

const RAIZ = process.cwd()
const CARPETA = path.join(RAIZ, 'docs', 'manual')
const IMAGENES = path.join(CARPETA, 'img')
const SALIDA = path.join(CARPETA, 'MANUAL_USUARIO_SUPER_MAS_ERP.pdf')

function validar(): string[] {
  const errores: string[] = []
  const anclas = new Set<string>(['indice-preguntas', 'indice-general', 'como-usar', 'problemas', 'glosario'])
  const registrar = (id: string) => {
    if (!/^[a-z0-9-]+$/.test(id)) errores.push(`Ancla con caracteres no permitidos: "${id}".`)
    if (anclas.has(id)) errores.push(`Ancla repetida: "${id}".`)
    anclas.add(id)
  }
  const capturas: string[] = []

  for (const c of CAPITULOS) {
    registrar(c.id)
    for (const m of c.modulos) {
      registrar(m.id)
      if (m.nomenclatura?.length) anclas.add(`${m.id}-nomenclatura`)
      m.pantalla.forEach((v) => capturas.push(v.captura.archivo))
      for (const p of m.procedimientos) {
        registrar(p.id)
        if (!p.pasos.length) errores.push(`El procedimiento "${p.id}" no tiene pasos.`)
        p.pasos.forEach((s, i) => {
          anclas.add(`${p.id}-paso-${i + 1}`)
          if (s.captura) capturas.push(s.captura.archivo)
        })
      }
    }
  }
  PROBLEMAS.forEach((p) => registrar(p.id))

  for (const archivo of capturas) {
    if (!fs.existsSync(path.join(IMAGENES, archivo))) errores.push(`Falta la captura docs/manual/img/${archivo}.`)
  }
  for (const tema of PREGUNTAS) {
    for (const p of tema.preguntas) {
      if (!anclas.has(p.destino)) errores.push(`La pregunta "${p.pregunta}" apunta a "${p.destino}", que no existe.`)
    }
  }
  return errores
}

function main() {
  console.log('Super Más — Generación del manual de usuario\n')
  const errores = validar()
  if (errores.length) {
    console.error(`No se generó el manual. Corrija ${errores.length} problema(s):`)
    errores.forEach((e) => console.error(`  - ${e}`))
    process.exit(1)
  }

  fs.mkdirSync(CARPETA, { recursive: true })
  const temporal = fs.mkdtempSync(path.join(os.tmpdir(), 'manual-supermas-'))
  const html = path.join(temporal, 'manual.html')
  const datos: DatosDocumento = {
    capitulos: CAPITULOS,
    preguntas: PREGUNTAS,
    problemas: PROBLEMAS,
    glosario: GLOSARIO,
    rutaImagenes: `file://${IMAGENES}`,
    logoPortada: `file://${path.join(RAIZ, 'public', 'logo-distribuidora-blanco.png')}`,
    logoFinal: `file://${path.join(RAIZ, 'public', 'logo-distribuidora.png')}`,
    paginas: new Map(),
  }

  try {
    // Primera pasada: ubicar en qué página cae cada ancla.
    fs.writeFileSync(html, construirDocumento(datos).html, 'utf8')
    imprimirPdf(html, SALIDA)
    datos.paginas = paginasDeAnclas(SALIDA).paginas

    // Segunda pasada: índices con número de página.
    const final = construirDocumento(datos)
    fs.writeFileSync(html, final.html, 'utf8')
    imprimirPdf(html, SALIDA)
    const { paginas, totalPaginas } = paginasDeAnclas(SALIDA)

    const desplazadas = [...datos.paginas].filter(([id, p]) => paginas.get(id) !== p).map(([id]) => id)
    if (desplazadas.length) {
      console.warn(`Aviso: ${desplazadas.length} sección(es) cambiaron de página entre pasadas (${desplazadas.slice(0, 5).join(', ')}).`)
    }
    const sinPagina = PREGUNTAS.flatMap((t) => t.preguntas).filter((p) => !paginas.has(p.destino))
    if (sinPagina.length) {
      console.warn(`Aviso: ${sinPagina.length} pregunta(s) sin número de página en el PDF.`)
    }

    const tamanoMb = (fs.statSync(SALIDA).size / 1024 / 1024).toFixed(1)
    const totalPreguntas = PREGUNTAS.reduce((n, t) => n + t.preguntas.length, 0)
    console.log('Manual generado.')
    console.log(`  Archivo:    ${path.relative(RAIZ, SALIDA)}`)
    console.log(`  Páginas:    ${totalPaginas}`)
    console.log(`  Tamaño:     ${tamanoMb} MB`)
    console.log(`  Figuras:    ${final.figuras}`)
    console.log(`  Preguntas:  ${totalPreguntas}`)
  } finally {
    fs.rmSync(temporal, { recursive: true, force: true })
  }
}

main()
