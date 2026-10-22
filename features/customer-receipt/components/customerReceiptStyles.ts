/**
 * Estilos de la hoja del cliente: 150 mm × 200 mm, blanco y negro, sin fondos de color.
 * En pantalla la hoja se muestra a tamaño real (escalada si no cabe); al imprimir solo sale la hoja.
 */
export const SHEET_WIDTH_MM = 150
export const SHEET_HEIGHT_MM = 200
export const SHEET_MARGIN_MM = 7

export const customerReceiptCss = `
  .cr-page { min-height: 100vh; background: #e5e7eb; padding: 16px; box-sizing: border-box; font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; }
  .cr-toolbar { max-width: ${SHEET_WIDTH_MM}mm; margin: 0 auto 12px; display: flex; gap: 8px; justify-content: flex-end; flex-wrap: wrap; }
  .cr-btn { display: inline-flex; align-items: center; gap: 6px; min-height: 40px; padding: 0 14px; border-radius: 8px; font-size: 13px; font-weight: 700; cursor: pointer; text-decoration: none; transition: transform 160ms ease, box-shadow 160ms ease, background-color 160ms ease; }
  .cr-btn:hover { transform: translateY(-1px); box-shadow: 0 6px 14px rgba(0, 27, 92, 0.18); }
  .cr-btn:active { transform: translateY(0); box-shadow: none; }
  .cr-btn:focus-visible { outline: 3px solid #93c5fd; outline-offset: 2px; }
  .cr-btn-primary { background: #001B5C; color: #fff; border: 1px solid #001B5C; }
  .cr-btn-outline { background: #fff; color: #001B5C; border: 1px solid #cbd5e1; }
  .cr-stage { display: flex; justify-content: center; }
  .cr-state { max-width: ${SHEET_WIDTH_MM}mm; margin: 40px auto; padding: 24px; background: #fff; border-radius: 12px; text-align: center; color: #0f172a; display: flex; flex-direction: column; align-items: center; gap: 10px; animation: cr-enter 220ms ease-out both; }
  .cr-state p { margin: 0; }
  .cr-state-title { font-size: 16px; font-weight: 800; }
  .cr-skeleton { width: ${SHEET_WIDTH_MM}mm; max-width: 100%; height: 320px; border-radius: 6px; background: linear-gradient(90deg, #f1f5f9 0%, #e2e8f0 50%, #f1f5f9 100%); background-size: 200% 100%; animation: cr-shimmer 1.2s linear infinite; }

  .cr-sheet { width: ${SHEET_WIDTH_MM}mm; min-height: ${SHEET_HEIGHT_MM}mm; padding: ${SHEET_MARGIN_MM}mm; box-sizing: border-box; background: #fff; color: #000; font-size: 10.5px; line-height: 1.35; box-shadow: 0 10px 30px rgba(15, 23, 42, 0.18); display: flex; flex-direction: column; gap: 8px; animation: cr-enter 260ms ease-out both; }
  .cr-sheet p { margin: 0; }
  .cr-head { display: grid; grid-template-columns: auto 1fr auto; gap: 8px; align-items: start; border-bottom: 1.5px solid #000; padding-bottom: 6px; }
  .cr-logo { width: 18mm; height: auto; max-height: 18mm; object-fit: contain; filter: grayscale(1); }
  .cr-issuer-name { font-size: 12.5px; font-weight: 800; }
  .cr-docbox { border: 1px solid #000; border-radius: 3px; padding: 4px 6px; text-align: right; min-width: 38mm; }
  .cr-doc-title { margin: 0; font-size: 10.5px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.02em; }
  .cr-doc-number { font-size: 13px; font-weight: 800; font-family: ui-monospace, Menlo, monospace; }
  .cr-notice { border: 1px dashed #000; padding: 3px 6px; font-size: 9.5px; }
  .cr-notice-strong { border-style: solid; font-weight: 800; text-transform: uppercase; }
  .cr-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 2px 10px; margin: 0; }
  .cr-grid dt { font-size: 8.5px; text-transform: uppercase; color: #333; }
  .cr-grid dd { margin: 0; font-weight: 600; overflow-wrap: anywhere; }
  .cr-customer { margin-top: 4px; padding-top: 4px; border-top: 1px solid #999; }
  .cr-span { grid-column: span 3; }
  .cr-table { width: 100%; border-collapse: collapse; }
  .cr-table th { font-size: 8.5px; text-transform: uppercase; text-align: left; border-bottom: 1px solid #000; padding: 3px 2px; }
  .cr-table td { border-bottom: 1px dotted #888; padding: 3px 2px; vertical-align: top; }
  .cr-table tr { break-inside: avoid; }
  .cr-num { text-align: right !important; white-space: nowrap; }
  .cr-line-note { display: block; font-size: 9px; color: #333; }
  .cr-empty { text-align: center; padding: 10px 2px; }
  .cr-footnote { font-size: 8.5px; color: #333; margin-top: 2px !important; }
  .cr-summary { display: grid; grid-template-columns: 1fr auto; gap: 10px; align-items: start; break-inside: avoid; }
  .cr-h2 { margin: 0 0 2px; font-size: 9px; text-transform: uppercase; }
  .cr-payments ul { list-style: none; margin: 0; padding: 0; }
  .cr-payments li { display: flex; justify-content: space-between; gap: 8px; padding: 1px 0; }
  .cr-strong { font-weight: 800; }
  .cr-totals { border-collapse: collapse; min-width: 52mm; }
  .cr-totals th { text-align: left; font-weight: 500; padding: 1px 8px 1px 0; }
  .cr-totals td { padding: 1px 0; }
  .cr-base { font-size: 8.5px; color: #333; }
  .cr-grand th, .cr-grand td { font-size: 13px; font-weight: 800; border-top: 1.5px solid #000; padding-top: 3px; }
  .cr-fiscal { display: grid; grid-template-columns: 1fr auto; gap: 8px; align-items: start; border-top: 1px solid #000; padding-top: 6px; font-size: 9px; break-inside: avoid; }
  .cr-fiscal-text { display: flex; flex-direction: column; gap: 3px; }
  .cr-mono { font-family: ui-monospace, Menlo, monospace; word-break: break-all; font-size: 8px; }
  .cr-qr { width: 26mm; height: 26mm; }
  .cr-qr svg { width: 100%; height: 100%; display: block; }
  .cr-foot { margin-top: auto; padding-top: 6px; border-top: 1px solid #000; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 2px; }
  .cr-thanks { font-size: 11.5px; font-weight: 800; }
  .cr-kyt { display: inline-flex; align-items: center; gap: 3px; font-size: 8.5px; font-weight: 700; color: #000; text-decoration: none; }
  .cr-kyt:hover, .cr-kyt:focus-visible { text-decoration: underline; }
  .cr-sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }

  @keyframes cr-enter { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
  @keyframes cr-shimmer { from { background-position: 200% 0; } to { background-position: -200% 0; } }
  @media (prefers-reduced-motion: reduce) {
    .cr-sheet, .cr-state, .cr-skeleton { animation: none; }
    .cr-btn { transition: none; }
    .cr-btn:hover { transform: none; }
  }

  @page { size: ${SHEET_WIDTH_MM}mm ${SHEET_HEIGHT_MM}mm; margin: ${SHEET_MARGIN_MM}mm; }
  @media print {
    html, body { background: #fff !important; }
    .cr-page { padding: 0; background: #fff; min-height: 0; }
    .cr-toolbar { display: none !important; }
    .cr-stage { display: block; }
    .cr-zoom { zoom: 1 !important; }
    .cr-sheet { width: auto; min-height: calc(${SHEET_HEIGHT_MM}mm - ${SHEET_MARGIN_MM * 2}mm); padding: 0; box-shadow: none; animation: none; }
    .cr-kyt { text-decoration: none; }
  }
`
