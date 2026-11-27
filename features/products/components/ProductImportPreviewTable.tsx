import { ProductImportAction, ProductImportRowValidation } from '../types/import.types'
import { formatImportIva, formatImportNumber } from '../utils/import-format'

const ACTION_BADGE: Record<ProductImportAction, { label: string; className: string }> = {
  ERROR: { label: 'Con error', className: 'type-badge-red' },
  CREATE: { label: 'Nuevo', className: 'type-badge-green' },
  UPDATE: { label: 'Actualizar', className: 'type-badge-blue' },
  UNCHANGED: { label: 'Sin cambios', className: 'type-badge-amber' },
}
const ACTION_ORDER: ProductImportAction[] = ['ERROR', 'CREATE', 'UPDATE', 'UNCHANGED']

const CELL: React.CSSProperties = { padding: '7px 10px', verticalAlign: 'top', whiteSpace: 'nowrap' }
const NUMBER_CELL: React.CSSProperties = { ...CELL, textAlign: 'right' }
const HEAD: React.CSSProperties = { ...CELL, position: 'sticky', top: 0, background: '#f8fafc', color: '#64748b', textAlign: 'left' }

/** En una actualización solo se muestran las cifras que trae el archivo. */
function PreviewNumber({ show, value }: { show: boolean; value?: number }) {
  return <td style={NUMBER_CELL}>{show && value !== undefined ? formatImportNumber(value) : '-'}</td>
}

export function ProductImportPreviewTable({ rows }: { rows: ProductImportRowValidation[] }) {
  const sorted = [...rows].sort((a, b) => ACTION_ORDER.indexOf(a.action) - ACTION_ORDER.indexOf(b.action) || a.rowNumber - b.rowNumber)

  return (
    <div style={{ border: '1px solid var(--line)', borderRadius: 10, overflow: 'auto', maxHeight: 340 }} tabIndex={0} aria-label="Vista previa de los productos del archivo">
      <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: 12 }}>
        <thead>
          <tr>
            <th scope="col" style={HEAD}>Fila</th>
            <th scope="col" style={HEAD}>Acción</th>
            <th scope="col" style={HEAD}>SKU</th>
            <th scope="col" style={HEAD}>Producto</th>
            <th scope="col" style={{ ...HEAD, textAlign: 'right' }}>Costo con IVA</th>
            <th scope="col" style={{ ...HEAD, textAlign: 'right' }}>Precio</th>
            <th scope="col" style={{ ...HEAD, textAlign: 'right' }}>Mayorista</th>
            <th scope="col" style={HEAD}>IVA</th>
            <th scope="col" style={{ ...HEAD, textAlign: 'right' }}>Stock</th>
            <th scope="col" style={HEAD}>Detalle</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => {
            const p = r.parsed
            const isNew = !p.existingProductId
            const badge = ACTION_BADGE[r.action]
            return (
              <tr key={r.rowNumber} style={{ boxShadow: 'inset 0 1px 0 var(--line)' }}>
                <td style={CELL}>{r.rowNumber}</td>
                <td style={CELL}><span className={`kardex-type-badge ${badge.className}`}>{badge.label}</span></td>
                <td style={CELL}>{p.sku || '-'}</td>
                <td style={{ ...CELL, whiteSpace: 'normal', minWidth: 180 }}>{p.name || '-'}</td>
                <PreviewNumber show={isNew || Boolean(p.provided?.costPrice)} value={p.costPrice} />
                <PreviewNumber show={isNew || Boolean(p.provided?.publicSalePrice)} value={p.publicSalePrice} />
                <PreviewNumber show={isNew || Boolean(p.provided?.wholesalePrice)} value={p.wholesalePrice} />
                <td style={CELL}>{isNew || p.provided?.ivaTreatment ? formatImportIva(p.ivaTreatment, Number(p.taxRatePercent)) : '-'}</td>
                <td style={NUMBER_CELL}>
                  {isNew && (p.initialStock ?? 0) > 0 ? `${formatImportNumber(p.initialStock ?? 0)}${r.locationName ? ` en ${r.locationName}` : ''}` : '-'}
                </td>
                <td style={{ ...CELL, whiteSpace: 'normal', minWidth: 260 }}>
                  {r.errors.map((m, i) => <div key={`e${i}`} style={{ color: '#dc2626' }}>{m}</div>)}
                  {r.changes.map((m, i) => <div key={`c${i}`}>{m}</div>)}
                  {r.warnings.map((m, i) => <div key={`w${i}`} style={{ color: '#b45309' }}>{m}</div>)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
