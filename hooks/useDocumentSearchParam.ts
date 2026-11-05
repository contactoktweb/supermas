'use client'

import { useEffect } from 'react'

/** Parámetro con el que otros módulos abren una página ya filtrada por un documento (ej. desde el Kardex). */
export const DOCUMENT_SEARCH_PARAM = 'buscar'

/** Al cargar la página, aplica una sola vez la búsqueda que llega en `?buscar=`. */
export function useDocumentSearchParam(applySearch: (query: string) => void): void {
  useEffect(() => {
    const query = new URLSearchParams(window.location.search).get(DOCUMENT_SEARCH_PARAM)?.trim()
    if (query) applySearch(query)
    // Solo al montar: la búsqueda del enlace es el punto de partida, luego manda el usuario.
  }, [])
}

/** Enlace a una página filtrada por un documento. */
export const documentSearchHref = (path: string, documentNumber: string) =>
  `${path}?${DOCUMENT_SEARCH_PARAM}=${encodeURIComponent(documentNumber)}`
