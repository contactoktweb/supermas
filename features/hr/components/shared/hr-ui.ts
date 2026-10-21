/**
 * Utilidades visuales compartidas del módulo de Recursos Humanos.
 * Las animaciones globales (page-enter, hover de tarjetas, drawers) no contemplan
 * prefers-reduced-motion; esta clase las anula en todo el subárbol para quien lo solicite.
 */
export const HR_REDUCED_MOTION =
  'motion-reduce:**:animate-none! motion-reduce:**:transition-none! motion-reduce:animate-none! motion-reduce:transition-none!'

export const HR_PAGE_CLASS = `page-enter flex flex-col gap-5 ${HR_REDUCED_MOTION}`
