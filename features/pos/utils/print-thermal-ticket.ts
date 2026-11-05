import {
  posThermalTicketStyles,
  THERMAL_PAPER_WIDTH_MM,
  thermalTicketPageRule,
  thermalTicketPrintPageStyles,
} from '../components/ticket/posThermalTicketStyles'

const IMAGE_LOAD_TIMEOUT_MS = 3000
const IFRAME_CLEANUP_DELAY_MS = 1000
const MM_PER_CSS_PX = 25.4 / 96

/**
 * Imprime solo la tirilla en un documento aislado (iframe oculto) con el tamaño del rollo térmico.
 * Imprimir la página completa sale en blanco o en hoja carta: las reglas de impresión globales
 * ocultan todo lo que no sea `.print-area` y el navegador usa el papel por defecto.
 */
export async function printThermalTicket(ticket: HTMLElement): Promise<void> {
  const iframe = document.createElement('iframe')
  iframe.setAttribute('aria-hidden', 'true')
  iframe.tabIndex = -1
  // El iframe tiene el ancho del rollo para que el alto medido sea el real al imprimir.
  iframe.style.cssText = `position:fixed;left:-10000px;top:0;width:${THERMAL_PAPER_WIDTH_MM}mm;height:10px;border:0;`
  document.body.appendChild(iframe)

  const doc = iframe.contentDocument
  const win = iframe.contentWindow
  if (!doc || !win) {
    iframe.remove()
    return
  }

  const ticketHtml = ticket.outerHTML
  const writeDocument = (pageRule: string) => {
    doc.open()
    doc.write(
      `<!doctype html><html lang="es"><head><meta charset="utf-8"><base href="${window.location.origin}/">` +
        `<title>Tirilla</title><style>${pageRule}${posThermalTicketStyles}${thermalTicketPrintPageStyles}</style></head>` +
        `<body>${ticketHtml}</body></html>`
    )
    doc.close()
    return waitForImages(doc)
  }

  // Primero se mide el alto real de la tirilla y luego se reescribe con ese tamaño de hoja:
  // los navegadores ignoran un @page agregado después de cargar el documento.
  await writeDocument('')
  const ticketHeightPx = doc.body.firstElementChild?.getBoundingClientRect().height ?? doc.body.scrollHeight
  await writeDocument(thermalTicketPageRule(ticketHeightPx * MM_PER_CSS_PX))

  const cleanup = () => setTimeout(() => iframe.remove(), IFRAME_CLEANUP_DELAY_MS)
  win.addEventListener('afterprint', cleanup, { once: true })
  win.focus()
  win.print()
  // Safari no siempre emite afterprint en iframes: print() es bloqueante, así que se limpia igual.
  cleanup()
}

function waitForImages(doc: Document): Promise<void> {
  return Promise.all(
    Array.from(doc.images).map((img) =>
      img.complete
        ? Promise.resolve()
        : new Promise<void>((resolve) => {
            img.addEventListener('load', () => resolve(), { once: true })
            img.addEventListener('error', () => resolve(), { once: true })
            setTimeout(resolve, IMAGE_LOAD_TIMEOUT_MS)
          })
    )
  ).then(() => undefined)
}
