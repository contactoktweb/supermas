/**
 * Modelo de contenido del manual de usuario.
 *
 * Los textos admiten un formato mínimo:
 *   **texto**  → negrita
 *   [[Botón]]  → nombre de un botón, pestaña o campo tal como aparece en pantalla
 */

/** Imagen tomada del sistema; el archivo vive en docs/manual/img (fuera de Git). */
export interface Captura {
  archivo: string
  leyenda: string
}

export interface Paso {
  texto: string
  captura?: Captura
  nota?: string
  advertencia?: string
}

export interface Procedimiento {
  id: string
  titulo: string
  objetivo: string
  pasos: Paso[]
  resultado?: string
}

export interface Modulo {
  id: string
  titulo: string
  /** Ruta en el menú lateral, por ejemplo "Inventario > Productos". */
  menu: string
  proposito: string
  quienLoUsa: string
  /** Recorrido por la pantalla principal antes de los procedimientos. */
  pantalla: { texto: string; captura: Captura; elementos?: string[] }[]
  procedimientos: Procedimiento[]
  consejos?: string[]
  /** Significado de columnas, abreviaturas y estados que se ven en las tablas del módulo. */
  nomenclatura?: GrupoNomenclatura[]
}

export interface GrupoNomenclatura {
  /** Título del grupo, por ejemplo "Columnas de la tabla" o "Estados del stock". */
  titulo: string
  terminos: { termino: string; significado: string }[]
}

export interface Capitulo {
  id: string
  numero: number
  titulo: string
  introduccion: string
  modulos: Modulo[]
}

/** Pregunta del índice; `destino` es el id de un procedimiento, de un módulo o de un paso (`<procedimiento>-paso-<n>`). */
export interface Pregunta {
  pregunta: string
  destino: string
}

export interface TemaPreguntas {
  tema: string
  preguntas: Pregunta[]
}

export interface EntradaGlosario {
  termino: string
  definicion: string
}

export interface ProblemaComun {
  id: string
  problema: string
  causa: string
  solucion: string
}
