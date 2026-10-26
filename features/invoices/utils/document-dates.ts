/** Fechas de documentos electrónicos en formato legible (hora Colombia): "2026-10-26" → "26/10/2026". */
export function formatDocumentDate(isoDate: string | null | undefined): string {
  const [y, m, d] = String(isoDate || '').slice(0, 10).split('-')
  return y && m && d ? `${d}/${m}/${y}` : '—'
}

/** "2026-10-26" + "14:51:23-05:00" → "26/10/2026 2:51 p. m." */
export function formatDocumentDateTime(isoDate: string | null | undefined, time: string | null | undefined): string {
  const [h, min] = String(time || '').split(':').map(Number)
  if (Number.isNaN(h) || Number.isNaN(min)) return formatDocumentDate(isoDate)
  const hour12 = h % 12 === 0 ? 12 : h % 12
  return `${formatDocumentDate(isoDate)} ${hour12}:${String(min).padStart(2, '0')} ${h < 12 ? 'a. m.' : 'p. m.'}`
}
