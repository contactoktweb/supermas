/** Estilos de impresión del manual (tamaño carta). Colores de la marca: azul marino #001b5c y rojo #fe110c. */
export const ESTILOS = `
@page {
  size: letter;
  margin: 20mm 17mm 18mm 17mm;
  @top-left { content: "Manual de usuario"; font: 600 7.5pt Inter, Helvetica, Arial, sans-serif; color: #64748b; }
  @top-right { content: "Distribuidora Super Más S.A.S."; font: 600 7.5pt Inter, Helvetica, Arial, sans-serif; color: #64748b; }
  @bottom-left { content: "Super Más ERP / POS"; font: 600 7.5pt Inter, Helvetica, Arial, sans-serif; color: #001b5c; }
  @bottom-right { content: "Página " counter(page); font: 600 7.5pt Inter, Helvetica, Arial, sans-serif; color: #64748b; }
}
@page portada { margin: 0; @top-left { content: none } @top-right { content: none } @bottom-left { content: none } @bottom-right { content: none } }

* { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
html { font-family: Inter, -apple-system, "Segoe UI", Helvetica, Arial, sans-serif; font-size: 10pt; line-height: 1.55; color: #1e293b; }
body { margin: 0; }
a { color: #001b5c; text-decoration: none; }
strong { color: #0f172a; }
.ui { display: inline-block; padding: 0 5px; border: 1px solid #cbd5e1; border-radius: 4px; background: #f1f5f9; font-weight: 600; font-size: 0.92em; color: #001b5c; white-space: nowrap; }

/* Portada */
.portada { page: portada; height: 279.4mm; width: 215.9mm; background: #001b5c; color: #fff; position: relative; overflow: hidden; break-after: page; }
.portada::before { content: ""; position: absolute; inset: 0; background-image: linear-gradient(rgba(255,255,255,.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.05) 1px, transparent 1px); background-size: 14mm 14mm; }
.portada .circulo { position: absolute; border: 1px solid rgba(255,255,255,.12); border-radius: 50%; }
.portada .contenido { position: absolute; left: 22mm; right: 22mm; top: 34mm; bottom: 26mm; display: flex; flex-direction: column; }
.portada img { width: 62mm; }
.portada .etiqueta { margin-top: 38mm; color: #ff6b66; font-size: 9pt; font-weight: 700; letter-spacing: .28em; text-transform: uppercase; }
.portada h1 { color: #fff; font-size: 40pt; line-height: 1.05; margin: 6mm 0 0; font-weight: 700; letter-spacing: -.02em; }
.portada h1 em { color: #ff4d47; font-style: normal; }
.portada .bajada { margin-top: 8mm; font-size: 12pt; color: #cbd5e1; max-width: 140mm; }
.portada .pie { margin-top: auto; display: flex; justify-content: space-between; font-size: 9pt; color: #94a3b8; border-top: 1px solid rgba(255,255,255,.15); padding-top: 5mm; }

/* Títulos */
h1, h2, h3, h4 { color: #001b5c; line-height: 1.2; break-after: avoid; }
.capitulo-portada { break-before: page; }
.capitulo-portada { background: #001b5c; color: #fff; border-radius: 6px; padding: 18mm 14mm 14mm; margin-bottom: 8mm; position: relative; overflow: hidden; }
.capitulo-portada .numero { font-size: 9pt; letter-spacing: .25em; text-transform: uppercase; color: #ff6b66; font-weight: 700; }
.capitulo-portada h1 { color: #fff; font-size: 26pt; margin: 3mm 0 4mm; }
.capitulo-portada p { color: #cbd5e1; margin: 0; font-size: 10.5pt; }
.capitulo-portada .modulos { margin-top: 6mm; display: flex; flex-wrap: wrap; gap: 2mm; }
.capitulo-portada .modulos a { color: #fff; border: 1px solid rgba(255,255,255,.3); border-radius: 99px; padding: 1mm 3.5mm; font-size: 8.5pt; }

.modulo { break-before: page; }
.capitulo-portada + .modulo { break-before: auto; }
.modulo > header { border-left: 4px solid #fe110c; padding-left: 4mm; margin-bottom: 5mm; }
.modulo > header .menu { font-size: 8pt; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; color: #fe110c; }
.modulo > header h2 { font-size: 19pt; margin: 1mm 0 0; }
.ficha { display: grid; grid-template-columns: 1fr 1fr; gap: 4mm; margin-bottom: 5mm; }
.ficha div { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 3mm 4mm; }
.ficha h4 { margin: 0 0 1mm; font-size: 8pt; letter-spacing: .1em; text-transform: uppercase; color: #64748b; }
.ficha p { margin: 0; }

h3.seccion { font-size: 12.5pt; margin: 7mm 0 3mm; padding-bottom: 1.5mm; border-bottom: 1px solid #e2e8f0; }
.elementos { margin: 2mm 0 4mm; padding-left: 5mm; }
.elementos li { margin-bottom: 1mm; }

/* Procedimientos */
.procedimiento { margin-top: 7mm; break-inside: auto; }
.procedimiento > h3 { font-size: 13pt; margin: 0 0 1mm; display: flex; gap: 3mm; align-items: baseline; }
.procedimiento > h3 .codigo { flex: none; background: #001b5c; color: #fff; font-size: 8pt; padding: .6mm 2.5mm; border-radius: 99px; }
.procedimiento > .objetivo { color: #475569; margin: 0 0 4mm; }
ol.pasos { list-style: none; margin: 0; padding: 0; }
.paso { display: flex; gap: 4mm; margin-bottom: 4mm; }
.paso-numero { flex: none; width: 7mm; height: 7mm; border-radius: 50%; background: #fe110c; color: #fff; font-weight: 700; font-size: 9pt; display: flex; align-items: center; justify-content: center; margin-top: .3mm; }
.paso-cuerpo { flex: 1; min-width: 0; }
.paso-cuerpo > p { margin: 0 0 2mm; }

figure.captura { margin: 2mm auto 1mm; max-width: 148mm; break-inside: avoid; }
figure.captura img { display: block; width: 100%; border: 1px solid #94a3b8; border-radius: 4px; }
figure.captura figcaption { font-size: 8.3pt; color: #64748b; margin-top: 1.8mm; }
figure.captura figcaption span { font-weight: 700; color: #001b5c; }

.aviso { display: flex; gap: 2.5mm; border-radius: 5px; padding: 2.5mm 3.5mm; margin: 2mm 0 3mm; font-size: 9pt; break-inside: avoid; }
.aviso svg { flex: none; width: 4.5mm; height: 4.5mm; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; margin-top: .4mm; }
.aviso-info { background: #eff6ff; color: #1e3a8a; border: 1px solid #bfdbfe; }
.aviso-alerta { background: #fff7ed; color: #9a3412; border: 1px solid #fed7aa; }
.aviso-consejo { background: #f0fdf4; color: #166534; border: 1px solid #bbf7d0; }
.aviso-resultado { background: #f8fafc; color: #0f172a; border: 1px solid #cbd5e1; }
.aviso strong { color: inherit; }

a.volver { break-before: avoid; display: flex; width: max-content; align-items: center; gap: 1.5mm; font-size: 8.5pt; font-weight: 600; color: #64748b; margin-top: 1mm; }
a.volver svg { width: 3.8mm; height: 3.8mm; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }

/* Índices */
.indice { break-before: page; }
.indice h1 { font-size: 22pt; margin: 0 0 2mm; }
.indice .ayuda { color: #64748b; margin: 0 0 6mm; }
.indice-capitulo { margin-bottom: 4mm; break-inside: avoid; }
.indice-capitulo > a { display: flex; align-items: baseline; gap: 2mm; font-weight: 700; color: #001b5c; font-size: 11pt; border-bottom: 1px solid #e2e8f0; padding: 1.5mm 0; }
.indice ul { list-style: none; margin: 0; padding: 0; }
.indice li a { display: flex; align-items: baseline; gap: 2mm; padding: .7mm 0; color: #1e293b; }
.indice a .relleno { flex: 1; border-bottom: 1px dotted #cbd5e1; transform: translateY(-1mm); }
.indice a .pagina { color: #64748b; font-variant-numeric: tabular-nums; min-width: 8mm; text-align: right; }
.indice li.modulo-indice > a { font-weight: 600; padding-left: 3mm; }
.indice li.proc-indice > a { padding-left: 8mm; font-size: 9.2pt; }
.preguntas-tema { margin-bottom: 5mm; break-inside: avoid; }
.preguntas-tema h2 { font-size: 11pt; margin: 0 0 1.5mm; padding: 1.5mm 3mm; background: #001b5c; color: #fff; border-radius: 4px; }
.preguntas-tema li a { padding-left: 2mm; }
.preguntas-tema li a::before { content: "?"; flex: none; width: 4.5mm; height: 4.5mm; border-radius: 50%; background: #fee2e2; color: #fe110c; font-weight: 700; font-size: 7.5pt; display: inline-flex; align-items: center; justify-content: center; }

/* Tablas, glosario y problemas */
table { width: 100%; border-collapse: collapse; margin: 3mm 0; font-size: 9pt; }
th { background: #001b5c; color: #fff; text-align: left; padding: 2mm 3mm; }
td { border-bottom: 1px solid #e2e8f0; padding: 2mm 3mm; vertical-align: top; }
tr { break-inside: avoid; }
/* Columnas, abreviaturas y estados de cada módulo */
h4.nomenclatura-grupo { font-size: 9.5pt; color: #001b5c; margin: 4mm 0 1.5mm; break-after: avoid; }
table.nomenclatura { margin: 0 0 3mm; font-size: 8.8pt; border: 1px solid #e2e8f0; border-radius: 4px; }
table.nomenclatura td { padding: 1.6mm 3mm; }
table.nomenclatura td:first-child { width: 30%; font-weight: 700; color: #10213f; background: #f6f8fc; }
.problema { border: 1px solid #e2e8f0; border-radius: 6px; padding: 3.5mm 4mm; margin-bottom: 4mm; break-inside: avoid; }
.problema h3 { margin: 0 0 2mm; font-size: 11pt; }
.problema p { margin: 1mm 0; }
.problema .etiqueta { font-weight: 700; color: #64748b; font-size: 8pt; text-transform: uppercase; letter-spacing: .08em; }

.texto { margin: 0 0 3mm; }
.final { break-before: page; text-align: center; padding-top: 70mm; color: #475569; }
.final img { width: 50mm; }
.final .marca { margin-top: 12mm; font-weight: 700; color: #001b5c; }
.final .marca a { color: #001b5c; display: inline-flex; align-items: center; gap: 1.5mm; }
.final .marca svg { width: 4mm; height: 4mm; fill: #0f172a; }
`
