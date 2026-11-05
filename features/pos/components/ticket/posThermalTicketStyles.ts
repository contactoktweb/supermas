/**
 * Estilos de la tirilla térmica del POS (papel de 80 mm, ~72 mm imprimibles).
 * Se usan igual en la vista previa del modal y en el documento aislado que se imprime,
 * por eso no dependen de variables CSS de la aplicación.
 */
export const THERMAL_TICKET_WIDTH_MM = 72
export const THERMAL_PAPER_WIDTH_MM = 80

export const posThermalTicketStyles = `
  .tk { width: ${THERMAL_TICKET_WIDTH_MM}mm; max-width: 100%; margin: 0 auto; background: #fff; color: #000;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 11px; line-height: 1.35; }
  .tk * { box-sizing: border-box; }
  .tk p { margin: 0; }
  .tk-center { text-align: center; }
  .tk-logo { display: block; width: 46mm; max-width: 80%; height: auto; margin: 0 auto 4px; }
  .tk-issuer-name { font-size: 12.5px; font-weight: 800; }
  .tk-sep { border: 0; border-top: 1px dashed #000; margin: 6px 0; }
  .tk-doc-title { margin: 0; font-size: 12px; font-weight: 800; letter-spacing: .3px; text-transform: uppercase; }
  .tk-row { display: flex; justify-content: space-between; gap: 8px; }
  .tk-row > :last-child { text-align: right; }
  .tk-strong { font-weight: 800; }
  .tk-items { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px; }
  .tk-item-name { font-weight: 700; word-break: break-word; }
  .tk-muted { color: #222; font-size: 10px; }
  .tk-total { font-size: 14px; font-weight: 900; }
  .tk-fiscal { font-size: 9.5px; word-break: break-word; display: flex; flex-direction: column; gap: 3px; }
  .tk-cufe { font-size: 8.5px; word-break: break-all; }
  .tk-qr { width: 34mm; height: 34mm; margin: 4px auto 0; }
  .tk-qr svg { width: 100%; height: 100%; display: block; }
  .tk-thanks { font-weight: 800; font-size: 11.5px; }
`

export const THERMAL_PAGE_MARGIN_MM = { vertical: 2, horizontal: 4 }

/** Tamaño de hoja para el rollo: ancho fijo y alto del contenido (los navegadores no aceptan alto "auto"). */
export function thermalTicketPageRule(contentHeightMm: number): string {
  const height = Math.ceil(contentHeightMm + THERMAL_PAGE_MARGIN_MM.vertical * 2)
  return `@page { size: ${THERMAL_PAPER_WIDTH_MM}mm ${height}mm; margin: ${THERMAL_PAGE_MARGIN_MM.vertical}mm ${THERMAL_PAGE_MARGIN_MM.horizontal}mm; }`
}

/** Hoja que se manda a la impresora: solo la tirilla y sin márgenes del navegador. */
export const thermalTicketPrintPageStyles = `
  html, body { margin: 0; padding: 0; background: #fff; }
  .tk-logo { filter: grayscale(1) contrast(1.4); }
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
`
