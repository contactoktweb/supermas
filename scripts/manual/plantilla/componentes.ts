import type { Captura, Paso } from '../tipos'

export function escapar(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Aplica el formato mínimo de los textos del manual: **negrita** y [[Elemento de pantalla]]. */
export function formato(texto: string): string {
  return escapar(texto)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\[\[(.+?)\]\]/g, '<span class="ui">$1</span>')
}

const ICONOS = {
  info: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>',
  alerta: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/></svg>',
  consejo: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z"/></svg>',
  resultado: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="m8 12 3 3 5-6"/></svg>',
  volver: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 14 4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-1"/></svg>',
} as const

export type TipoAviso = 'info' | 'alerta' | 'consejo' | 'resultado'

const TITULO_AVISO: Record<TipoAviso, string> = {
  info: 'Nota',
  alerta: 'Importante',
  consejo: 'Consejo',
  resultado: 'Resultado',
}

export function aviso(tipo: TipoAviso, texto: string): string {
  return `<aside class="aviso aviso-${tipo}">${ICONOS[tipo]}<div><strong>${TITULO_AVISO[tipo]}.</strong> ${formato(texto)}</div></aside>`
}

/** Numerador de figuras compartido por todo el documento. */
export class Figuras {
  private total = 0
  constructor(private readonly rutaImagenes: string) {}

  html(captura: Captura): string {
    this.total += 1
    return `<figure class="captura">
  <img src="${this.rutaImagenes}/${escapar(captura.archivo)}" alt="${escapar(captura.leyenda)}">
  <figcaption><span>Figura ${this.total}.</span> ${formato(captura.leyenda)}</figcaption>
</figure>`
  }

  get cantidad(): number {
    return this.total
  }
}

export function paso(idProcedimiento: string, numero: number, datos: Paso, figuras: Figuras): string {
  return `<li class="paso" id="${idProcedimiento}-paso-${numero}">
  <div class="paso-numero">${numero}</div>
  <div class="paso-cuerpo">
    <p>${formato(datos.texto)}</p>
    ${datos.nota ? aviso('info', datos.nota) : ''}
    ${datos.advertencia ? aviso('alerta', datos.advertencia) : ''}
    ${datos.captura ? figuras.html(datos.captura) : ''}
  </div>
</li>`
}

export function volverAPreguntas(): string {
  return `<a class="volver" href="#indice-preguntas">${ICONOS.volver} Volver al índice de preguntas</a>`
}
