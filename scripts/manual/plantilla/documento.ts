import type { Capitulo, EntradaGlosario, GrupoNomenclatura, Modulo, ProblemaComun, Procedimiento, TemaPreguntas } from '../tipos'
import { ESTILOS } from './estilos'
import { Figuras, aviso, escapar, formato, paso, volverAPreguntas } from './componentes'

export interface DatosDocumento {
  capitulos: Capitulo[]
  preguntas: TemaPreguntas[]
  problemas: ProblemaComun[]
  glosario: EntradaGlosario[]
  rutaImagenes: string
  logoPortada: string
  logoFinal: string
  /** Página de cada ancla (segunda pasada); vacío en la primera. */
  paginas: Map<string, number>
}

const CORAZON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7.5-4.6-10-9.3C.4 8.4 2.3 4 6.3 4c2.3 0 3.9 1.3 5.7 3.4C13.8 5.3 15.4 4 17.7 4c4 0 5.9 4.4 4.3 7.7C19.5 16.4 12 21 12 21z"/></svg>'

export function codigoProcedimiento(capitulo: Capitulo, indiceModulo: number, indiceProcedimiento: number): string {
  return `${capitulo.numero}.${indiceModulo + 1}.${indiceProcedimiento + 1}`
}

function enlaceIndice(destino: string, texto: string, paginas: Map<string, number>): string {
  const pagina = paginas.get(destino)
  return `<a href="#${destino}"><span>${texto}</span><span class="relleno"></span><span class="pagina">${pagina ?? ''}</span></a>`
}

function portada(d: DatosDocumento): string {
  const anio = new Date().getFullYear()
  return `<section class="portada">
  <div class="circulo" style="width:150mm;height:150mm;right:-55mm;top:40mm"></div>
  <div class="circulo" style="width:95mm;height:95mm;right:-28mm;top:68mm"></div>
  <div class="contenido">
    <img src="${d.logoPortada}" alt="Logo Distribuidora Super Más">
    <div class="etiqueta">Manual de usuario</div>
    <h1>Super Más<br><em>ERP / POS</em></h1>
    <p class="bajada">Guía paso a paso de todos los módulos del sistema: inventario, compras, ventas, punto de venta, facturación electrónica, cartera, contabilidad, recursos humanos y administración.</p>
    <div class="pie"><span>Distribuidora Super Más S.A.S.</span><span>Edición ${anio}</span></div>
  </div>
</section>`
}

function comoUsar(): string {
  return `<section class="indice" id="como-usar">
  <h1>Cómo usar este manual</h1>
  <p class="texto">Este manual explica, con imágenes tomadas del sistema, cómo se hace cada tarea en Super Más ERP/POS. Está organizado igual que el menú lateral del sistema: cada capítulo corresponde a un grupo del menú y cada módulo a una opción.</p>
  <p class="texto">Hay dos formas de encontrar lo que necesita:</p>
  <ul class="elementos">
    <li><strong>Índice general:</strong> lista los capítulos, módulos y procedimientos en el orden del menú.</li>
    <li><strong>Índice de preguntas:</strong> preguntas sencillas como "¿Cómo subo un producto nuevo?". Al hacer clic en una pregunta, el documento lo lleva directamente a la respuesta. Desde cada respuesta puede volver al índice de preguntas.</li>
  </ul>
  <h3 class="seccion">Convenciones</h3>
  <ul class="elementos">
    <li>Los nombres de botones, pestañas y campos se muestran así: <span class="ui">Guardar</span>.</li>
    <li>Cada procedimiento tiene un código (por ejemplo <strong>2.1.1</strong>) y pasos numerados en rojo.</li>
  </ul>
  ${aviso('info', 'Lo que cada persona ve en el menú depende de su **rol**. Si no encuentra una opción descrita aquí, su usuario no tiene ese permiso; pídalo al administrador del sistema.')}
  ${aviso('alerta', 'Las imágenes se tomaron del sistema en uso. Los nombres, valores y documentos que aparecen en ellas son solo de referencia.')}
</section>`
}

function indiceGeneral(d: DatosDocumento): string {
  const capitulos = d.capitulos
    .map((c) => {
      const modulos = c.modulos
        .map((m, im) => {
          const procs = m.procedimientos
            .map((p, ip) => `<li class="proc-indice">${enlaceIndice(p.id, `${codigoProcedimiento(c, im, ip)} ${escapar(p.titulo)}`, d.paginas)}</li>`)
            .join('')
          return `<li class="modulo-indice">${enlaceIndice(m.id, `${c.numero}.${im + 1} ${escapar(m.titulo)}`, d.paginas)}</li>${procs}`
        })
        .join('')
      return `<div class="indice-capitulo">${enlaceIndice(c.id, `${c.numero}. ${escapar(c.titulo)}`, d.paginas)}<ul>${modulos}</ul></div>`
    })
    .join('')
  const extras = [
    ['problemas', 'Solución de problemas comunes'],
    ['glosario', 'Glosario'],
  ]
    .map(([id, t]) => `<div class="indice-capitulo">${enlaceIndice(id, t, d.paginas)}</div>`)
    .join('')
  return `<section class="indice" id="indice-general">
  <h1>Índice general</h1>
  <p class="ayuda">Haga clic en cualquier título para ir a esa sección. Las preguntas frecuentes están en el <a href="#indice-preguntas"><strong>índice de preguntas</strong></a>.</p>
  <div class="indice-capitulo">${enlaceIndice('indice-preguntas', 'Índice de preguntas', d.paginas)}</div>
  ${capitulos}${extras}
</section>`
}

function indicePreguntas(d: DatosDocumento): string {
  const temas = d.preguntas
    .map(
      (t) => `<div class="preguntas-tema"><h2>${escapar(t.tema)}</h2><ul>${t.preguntas
        .map((p) => `<li>${enlaceIndice(p.destino, escapar(p.pregunta), d.paginas)}</li>`)
        .join('')}</ul></div>`
    )
    .join('')
  return `<section class="indice" id="indice-preguntas">
  <h1>Índice de preguntas</h1>
  <p class="ayuda">Busque su pregunta y haga clic en ella: el documento lo lleva a la respuesta paso a paso.</p>
  ${temas}
</section>`
}

function procedimiento(p: Procedimiento, codigo: string, figuras: Figuras): string {
  return `<article class="procedimiento" id="${p.id}">
  <h3><span class="codigo">${codigo}</span><span>${escapar(p.titulo)}</span></h3>
  <p class="objetivo">${formato(p.objetivo)}</p>
  <ol class="pasos">${p.pasos.map((s, i) => paso(p.id, i + 1, s, figuras)).join('')}</ol>
  ${p.resultado ? aviso('resultado', p.resultado) : ''}
  ${volverAPreguntas()}
</article>`
}

function nomenclatura(moduloId: string, grupos: GrupoNomenclatura[]): string {
  const tablas = grupos
    .map(
      (g) => `<h4 class="nomenclatura-grupo">${escapar(g.titulo)}</h4>
  <table class="nomenclatura"><tbody>${g.terminos
    .map((t) => `<tr><td>${formato(t.termino)}</td><td>${formato(t.significado)}</td></tr>`)
    .join('')}</tbody></table>`
    )
    .join('')
  return `<div class="nomenclatura-bloque" id="${moduloId}-nomenclatura"><h3 class="seccion">Columnas, abreviaturas y estados</h3>${tablas}</div>`
}

function modulo(c: Capitulo, m: Modulo, im: number, figuras: Figuras): string {
  const pantalla = m.pantalla.length
    ? `<h3 class="seccion">La pantalla</h3>${m.pantalla
        .map(
          (v) => `<p class="texto">${formato(v.texto)}</p>${
            v.elementos?.length ? `<ul class="elementos">${v.elementos.map((e) => `<li>${formato(e)}</li>`).join('')}</ul>` : ''
          }${figuras.html(v.captura)}`
        )
        .join('')}`
    : ''
  const procs = m.procedimientos.length
    ? `<h3 class="seccion">Procedimientos</h3>${m.procedimientos.map((p, ip) => procedimiento(p, codigoProcedimiento(c, im, ip), figuras)).join('')}`
    : ''
  const consejos = m.consejos?.map((t) => aviso('consejo', t)).join('') ?? ''
  const glosarioModulo = m.nomenclatura?.length ? nomenclatura(m.id, m.nomenclatura) : ''
  return `<section class="modulo" id="${m.id}">
  <header><div class="menu">${escapar(m.menu)}</div><h2>${c.numero}.${im + 1} ${escapar(m.titulo)}</h2></header>
  <div class="ficha">
    <div><h4>Para qué sirve</h4><p>${formato(m.proposito)}</p></div>
    <div><h4>Quién lo usa</h4><p>${formato(m.quienLoUsa)}</p></div>
  </div>
  ${pantalla}${glosarioModulo}${procs}${consejos}
</section>`
}

function capitulo(c: Capitulo, figuras: Figuras): string {
  const chips = c.modulos.map((m) => `<a href="#${m.id}">${escapar(m.titulo)}</a>`).join('')
  return `<section class="capitulo-portada" id="${c.id}">
  <div class="numero">Capítulo ${c.numero}</div>
  <h1>${escapar(c.titulo)}</h1>
  <p>${formato(c.introduccion)}</p>
  <div class="modulos">${chips}</div>
</section>
${c.modulos.map((m, im) => modulo(c, m, im, figuras)).join('')}`
}

function problemas(d: DatosDocumento): string {
  return `<section class="indice" id="problemas">
  <h1>Solución de problemas comunes</h1>
  <p class="ayuda">Mensajes o situaciones frecuentes, por qué ocurren y qué hacer.</p>
  ${d.problemas
    .map(
      (p) => `<div class="problema" id="${p.id}">
    <h3>${escapar(p.problema)}</h3>
    <p><span class="etiqueta">Por qué pasa</span><br>${formato(p.causa)}</p>
    <p><span class="etiqueta">Qué hacer</span><br>${formato(p.solucion)}</p>
    ${volverAPreguntas()}
  </div>`
    )
    .join('')}
</section>`
}

function glosario(d: DatosDocumento): string {
  return `<section class="indice" id="glosario">
  <h1>Glosario</h1>
  <table><thead><tr><th style="width:28%">Término</th><th>Significado</th></tr></thead><tbody>
  ${d.glosario.map((g) => `<tr><td><strong>${escapar(g.termino)}</strong></td><td>${formato(g.definicion)}</td></tr>`).join('')}
  </tbody></table>
</section>`
}

function paginaFinal(d: DatosDocumento): string {
  const anio = new Date().getFullYear()
  return `<section class="final">
  <img src="${d.logoFinal}" alt="Logo Super Más">
  <p>Manual de usuario de Super Más ERP/POS.<br>© ${anio} Distribuidora Super Más S.A.S. Todos los derechos reservados.</p>
  <p class="marca"><a href="https://www.kytcode.lat">Desarrollado por K&amp;T ${CORAZON}</a></p>
</section>`
}

/** Documento HTML completo. Devuelve también la cantidad de figuras para el informe. */
export function construirDocumento(d: DatosDocumento): { html: string; figuras: number } {
  const figuras = new Figuras(d.rutaImagenes)
  const cuerpo = [
    portada(d),
    comoUsar(),
    indiceGeneral(d),
    indicePreguntas(d),
    ...d.capitulos.map((c) => capitulo(c, figuras)),
    problemas(d),
    glosario(d),
    paginaFinal(d),
  ].join('\n')
  const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>Manual de usuario | Super Más ERP/POS</title>
<style>${ESTILOS}</style>
</head>
<body>
${cuerpo}
</body>
</html>`
  return { html, figuras: figuras.cantidad }
}
