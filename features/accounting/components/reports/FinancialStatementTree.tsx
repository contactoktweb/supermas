'use client'

import React from 'react'
import { AppIcon } from '@/components/ui/Icon'
import { FinancialStatementNode } from '../../types'
import { ACCOUNT_LEVEL_LABEL } from '../../utils/account-tree'
import { formatCop } from '../../utils/report-format'

/** Sangría por nivel de profundidad (px). */
const INDENT_PER_DEPTH = 14

interface FinancialStatementTreeProps {
  nodes: FinancialStatementNode[]
  expandedIds: ReadonlySet<string>
  onToggle: (nodeId: string) => void
  /** Texto para lectores de pantalla (p. ej. "Activo"). */
  caption: string
}

interface TreeRowProps {
  node: FinancialStatementNode
  depth: number
  expandedIds: ReadonlySet<string>
  onToggle: (nodeId: string) => void
}

function TreeRow({ node, depth, expandedIds, onToggle }: TreeRowProps) {
  const hasChildren = node.children.length > 0
  const isExpanded = hasChildren && expandedIds.has(node.id)
  const isMajor = node.levelNumber <= 2
  const isNegative = node.balance < 0

  return (
    <>
      <tr
        className={`border-b border-slate-100 transition-colors hover:bg-blue-50/40 motion-safe:animate-[fade_.2s_ease] ${
          isMajor ? 'bg-slate-50/70' : ''
        }`}
      >
        <td className="py-1.5 pl-2 pr-1 align-middle">
          <div className="flex items-center gap-1 min-w-0" style={{ paddingLeft: depth * INDENT_PER_DEPTH }}>
            {hasChildren ? (
              <button
                type="button"
                className="w-6 h-6 shrink-0 grid place-items-center rounded text-slate-500 hover:text-blue-900 hover:bg-blue-100/70 active:scale-95 transition"
                onClick={() => onToggle(node.id)}
                aria-expanded={isExpanded}
                aria-label={`${isExpanded ? 'Contraer' : 'Expandir'} ${node.code} ${node.name}`}
              >
                <span
                  className={`inline-flex motion-safe:transition-transform motion-safe:duration-200 ${isExpanded ? 'rotate-90' : ''}`}
                >
                  <AppIcon name="chevronRight" size={13} />
                </span>
              </button>
            ) : (
              <span className="w-6 shrink-0" aria-hidden="true" />
            )}
            <span className={`font-mono text-[11px] shrink-0 ${isMajor ? 'font-bold text-blue-950' : 'text-blue-800'}`}>
              {node.code}
            </span>
            <span
              className={`truncate text-xs ${
                node.levelNumber === 1 ? 'font-bold uppercase text-slate-900' : isMajor ? 'font-semibold text-slate-900' : 'text-slate-700'
              }`}
              title={node.name}
            >
              {node.name}
            </span>
          </div>
        </td>
        <td className="py-1.5 px-1 text-[10px] text-slate-400 whitespace-nowrap hidden md:table-cell">
          {ACCOUNT_LEVEL_LABEL[node.level]}
        </td>
        <td
          className={`py-1.5 pr-2 pl-1 text-right font-mono text-xs whitespace-nowrap ${
            isMajor ? 'font-bold' : 'font-medium'
          } ${isNegative ? 'text-rose-700' : 'text-slate-900'}`}
        >
          {formatCop(node.balance)}
        </td>
      </tr>
      {isExpanded &&
        node.children.map((child) => (
          <TreeRow key={child.id} node={child} depth={depth + 1} expandedIds={expandedIds} onToggle={onToggle} />
        ))}
    </>
  )
}

/** Árbol PUC con saldo por nivel; cada fila con hijos se expande o contrae. */
export function FinancialStatementTree({ nodes, expandedIds, onToggle, caption }: FinancialStatementTreeProps) {
  if (nodes.length === 0) {
    return <p className="px-3 py-4 text-xs text-slate-500">Sin cuentas con saldo para los filtros seleccionados.</p>
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs table-fixed min-w-[320px]">
        <caption className="sr-only">{caption}</caption>
        <colgroup>
          <col />
          <col className="w-0 md:w-20" />
          <col className="w-36 sm:w-40" />
        </colgroup>
        <thead className="sr-only">
          <tr>
            <th scope="col">Cuenta</th>
            <th scope="col">Nivel</th>
            <th scope="col">Saldo</th>
          </tr>
        </thead>
        <tbody>
          {nodes.map((node) => (
            <TreeRow key={node.id} node={node} depth={0} expandedIds={expandedIds} onToggle={onToggle} />
          ))}
        </tbody>
      </table>
    </div>
  )
}
