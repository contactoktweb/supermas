/**
 * SUPER MÁS ERP/POS — Árbol XML mínimo con serialización y canonicalización (C14N)
 *
 * Por qué existe: la firma XAdES (factura) y WS-Security (SOAP) exigen calcular digests
 * sobre la forma canónica exacta del XML. Construimos el XML como árbol y lo serializamos
 * nosotros mismos para que el texto enviado y el texto canonicalizado sean consistentes.
 *
 * Soporta:
 *  - Serialización normal (compacta, sin espacios entre elementos).
 *  - C14N 1.0 inclusiva  (http://www.w3.org/TR/2001/REC-xml-c14n-20010315)
 *  - C14N exclusiva      (http://www.w3.org/2001/10/xml-exc-c14n#) con InclusiveNamespaces.
 *
 * Alcance: XML generado por el ERP (sin comentarios, PIs, DTD ni entidades).
 */

export interface XmlText {
  kind: 'text'
  value: string
}

export interface XmlElement {
  kind: 'element'
  /** Nombre calificado: 'cbc:ID' o 'Invoice' */
  name: string
  /** Atributos y declaraciones de namespace ('xmlns', 'xmlns:cbc') en orden de inserción */
  attrs: Array<[string, string]>
  children: XmlNode[]
  parent?: XmlElement
}

export type XmlNode = XmlElement | XmlText

type Child = XmlNode | string | number | null | undefined | false | Child[]

/** Crea un elemento. Los hijos null/undefined/false se omiten (elementos opcionales). */
export function el(name: string, attrs?: Record<string, string | number | undefined | null> | null, ...children: Child[]): XmlElement {
  const node: XmlElement = { kind: 'element', name, attrs: [], children: [] }
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v === undefined || v === null) continue
      node.attrs.push([k, String(v)])
    }
  }
  appendChildren(node, children)
  return node
}

export function appendChildren(parent: XmlElement, children: Child[]): void {
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue
    if (Array.isArray(c)) {
      appendChildren(parent, c)
      continue
    }
    const n: XmlNode = typeof c === 'string' || typeof c === 'number' ? { kind: 'text', value: String(c) } : c
    if (n.kind === 'element') n.parent = parent
    parent.children.push(n)
  }
}

/** Fija los punteros parent de todo el subárbol (útil tras construir con el). */
export function linkParents(node: XmlElement): XmlElement {
  for (const c of node.children) {
    if (c.kind === 'element') {
      c.parent = node
      linkParents(c)
    }
  }
  return node
}

export function findFirst(root: XmlElement, predicate: (e: XmlElement) => boolean): XmlElement | undefined {
  if (predicate(root)) return root
  for (const c of root.children) {
    if (c.kind === 'element') {
      const f = findFirst(c, predicate)
      if (f) return f
    }
  }
  return undefined
}

export function findById(root: XmlElement, id: string, attrName = 'Id'): XmlElement | undefined {
  return findFirst(root, (e) => e.attrs.some(([k, v]) => (k === attrName || k.endsWith(':' + attrName)) && v === id))
}

// ------------------------------------------------------------------------------
// Escapado
// ------------------------------------------------------------------------------

function escapeText(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\r/g, '&#xD;')
}

function escapeAttr(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/"/g, '&quot;')
    .replace(/\t/g, '&#x9;')
    .replace(/\n/g, '&#xA;')
    .replace(/\r/g, '&#xD;')
}

const isNsDecl = (k: string) => k === 'xmlns' || k.startsWith('xmlns:')
const nsPrefixOf = (decl: string) => (decl === 'xmlns' ? '' : decl.slice(6))
const prefixOf = (qname: string) => (qname.includes(':') ? qname.split(':')[0] : '')
const localOf = (qname: string) => (qname.includes(':') ? qname.split(':')[1] : qname)

// ------------------------------------------------------------------------------
// Serialización normal
// ------------------------------------------------------------------------------

export function serialize(node: XmlNode, withDeclaration = false): string {
  const body = serializeNode(node)
  return withDeclaration ? `<?xml version="1.0" encoding="UTF-8" standalone="no"?>${body}` : body
}

function serializeNode(node: XmlNode): string {
  if (node.kind === 'text') return escapeText(node.value)
  const attrs = node.attrs.map(([k, v]) => ` ${k}="${escapeAttr(v)}"`).join('')
  if (node.children.length === 0) return `<${node.name}${attrs}/>`
  return `<${node.name}${attrs}>${node.children.map(serializeNode).join('')}</${node.name}>`
}

// ------------------------------------------------------------------------------
// Namespaces en alcance
// ------------------------------------------------------------------------------

/** Namespaces declarados en el elemento y sus ancestros (el más cercano gana). */
export function inScopeNamespaces(node: XmlElement): Map<string, string> {
  const chain: XmlElement[] = []
  let cur: XmlElement | undefined = node
  while (cur) {
    chain.unshift(cur)
    cur = cur.parent
  }
  const map = new Map<string, string>()
  for (const e of chain) {
    for (const [k, v] of e.attrs) {
      if (isNsDecl(k)) map.set(nsPrefixOf(k), v)
    }
  }
  return map
}

function resolveUri(prefix: string, scope: Map<string, string>): string {
  return scope.get(prefix) || ''
}

function sortedAttributes(node: XmlElement, scope: Map<string, string>): Array<[string, string]> {
  const attrs = node.attrs.filter(([k]) => !isNsDecl(k))
  // C14N: atributos ordenados por (URI de namespace, nombre local). Sin prefijo → URI vacía.
  return attrs
    .map(([k, v]) => ({ k, v, uri: prefixOf(k) ? resolveUri(prefixOf(k), scope) : '', local: localOf(k) }))
    .sort((a, b) => (a.uri === b.uri ? (a.local < b.local ? -1 : a.local > b.local ? 1 : 0) : a.uri < b.uri ? -1 : 1))
    .map(({ k, v }) => [k, v])
}

// ------------------------------------------------------------------------------
// C14N inclusiva
// ------------------------------------------------------------------------------

/**
 * Canonicaliza (C14N 1.0 inclusiva, sin comentarios) el subárbol con raíz en `node`,
 * considerando los namespaces heredados de sus ancestros.
 * @param exclude elementos a omitir (transformación enveloped-signature)
 */
export function canonicalize(node: XmlElement, exclude?: Set<XmlElement>): string {
  const rendered = new Map<string, string>() // namespaces ya emitidos en el ancestro de salida
  return c14nInclusive(node, rendered, exclude)
}

function c14nInclusive(node: XmlElement, renderedParent: Map<string, string>, exclude?: Set<XmlElement>): string {
  const scope = inScopeNamespaces(node)
  const nsOut: Array<[string, string]> = []
  for (const [prefix, uri] of scope) {
    if (prefix === '' && uri === '' && !renderedParent.has('')) continue
    if (renderedParent.get(prefix) !== uri) nsOut.push([prefix, uri])
  }
  nsOut.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
  const rendered = new Map(renderedParent)
  for (const [p, u] of nsOut) rendered.set(p, u)

  const nsStr = nsOut.map(([p, u]) => (p ? ` xmlns:${p}="${escapeAttr(u)}"` : ` xmlns="${escapeAttr(u)}"`)).join('')
  const attrStr = sortedAttributes(node, scope).map(([k, v]) => ` ${k}="${escapeAttr(v)}"`).join('')
  const inner = node.children
    .map((c) => (c.kind === 'text' ? escapeText(c.value) : exclude?.has(c) ? '' : c14nInclusive(c, rendered, exclude)))
    .join('')
  return `<${node.name}${nsStr}${attrStr}>${inner}</${node.name}>`
}

// ------------------------------------------------------------------------------
// C14N exclusiva
// ------------------------------------------------------------------------------

export function canonicalizeExclusive(node: XmlElement, inclusivePrefixes: string[] = []): string {
  return c14nExclusive(node, new Map(), new Set(inclusivePrefixes))
}

function c14nExclusive(node: XmlElement, renderedParent: Map<string, string>, inclusive: Set<string>): string {
  const scope = inScopeNamespaces(node)
  const utilized = new Set<string>([prefixOf(node.name)])
  for (const [k] of node.attrs) {
    if (!isNsDecl(k) && prefixOf(k)) utilized.add(prefixOf(k))
  }
  for (const p of inclusive) if (scope.has(p)) utilized.add(p)

  const nsOut: Array<[string, string]> = []
  for (const prefix of utilized) {
    const uri = scope.get(prefix)
    if (uri === undefined) continue
    if (prefix === '' && uri === '' && !renderedParent.has('')) continue
    if (renderedParent.get(prefix) !== uri) nsOut.push([prefix, uri])
  }
  nsOut.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
  const rendered = new Map(renderedParent)
  for (const [p, u] of nsOut) rendered.set(p, u)

  const nsStr = nsOut.map(([p, u]) => (p ? ` xmlns:${p}="${escapeAttr(u)}"` : ` xmlns="${escapeAttr(u)}"`)).join('')
  const attrStr = sortedAttributes(node, scope).map(([k, v]) => ` ${k}="${escapeAttr(v)}"`).join('')
  const inner = node.children
    .map((c) => (c.kind === 'text' ? escapeText(c.value) : c14nExclusive(c, rendered, inclusive)))
    .join('')
  return `<${node.name}${nsStr}${attrStr}>${inner}</${node.name}>`
}
