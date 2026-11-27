import { AppIcon } from '@/components/ui/Icon'

const FORMAT_RULES = [
  <>
    <strong>Decimales con coma:</strong> escriba <code>3200,50</code>. El punto solo separa miles: <code>1.500</code> se lee
    como mil quinientos.
  </>,
  <>
    <strong>Costo Unitario con IVA:</strong> escriba el costo como viene en la factura del proveedor, con el IVA incluido.
  </>,
  <>
    <strong>Tipo de IVA:</strong> GRAVADO (tarifa 5 o 19), EXENTO o EXCLUIDO (tarifa 0).
  </>,
  <>
    <strong>Si el SKU ya existe,</strong> el producto se actualiza. Las celdas vacías no cambian nada y el stock solo se carga en
    productos nuevos.
  </>,
  <>
    <strong>Código Bodega:</strong> si lo deja vacío, el stock inicial entra a la bodega principal.
  </>,
  <>Borre las dos filas de ejemplo y guarde el archivo como CSV.</>,
]

/** Reglas de llenado de la plantilla; tras descargarla se anuncia como aviso. */
export function ProductImportFormatGuide({ justDownloaded }: { justDownloaded: boolean }) {
  return (
    <div
      className="info-banner-compact page-enter"
      role={justDownloaded ? 'status' : 'note'}
      style={{ marginBottom: 14, fontSize: 12, ...(justDownloaded ? { outline: '2px solid #1e3a8a' } : null) }}
    >
      <AppIcon name="warning" size={16} />
      <div>
        <strong>{justDownloaded ? 'Plantilla descargada. Llénela así:' : 'Cómo llenar la plantilla'}</strong>
        <ul style={{ margin: '6px 0 0', paddingLeft: 18, lineHeight: 1.5 }}>
          {FORMAT_RULES.map((rule, i) => (
            <li key={i}>{rule}</li>
          ))}
        </ul>
      </div>
    </div>
  )
}
