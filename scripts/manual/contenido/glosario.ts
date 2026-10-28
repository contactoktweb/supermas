import type { EntradaGlosario } from '../tipos'

export const GLOSARIO: EntradaGlosario[] = [
  { termino: 'Ajuste de inventario', definicion: 'Movimiento que suma (entrada) o resta (salida) unidades de una bodega para corregir diferencias, mermas o daños. Siempre lleva motivo y queda en el Kardex.' },
  { termino: 'Arqueo', definicion: 'Conteo del efectivo de la caja al cierre del turno para compararlo con lo que el sistema espera.' },
  { termino: 'Bodega', definicion: 'Ubicación física donde se guarda mercancía o se vende (bodega, punto de venta o CEDI).' },
  { termino: 'Consumidor Final', definicion: 'Cliente genérico (CC 222222222222) para ventas de mostrador sin datos del comprador.' },
  { termino: 'Costo promedio', definicion: 'Costo de cada unidad calculado como el promedio ponderado de las entradas. Se recalcula con cada compra recibida.' },
  { termino: 'CUFE / CUDE', definicion: 'Código único que identifica ante la DIAN una factura electrónica (CUFE) o una nota crédito o débito (CUDE).' },
  { termino: 'Cuentas por cobrar (CxC)', definicion: 'Lo que los clientes le deben a la empresa por ventas a crédito.' },
  { termino: 'Cuentas por pagar (CxP)', definicion: 'Lo que la empresa le debe a los proveedores por compras a crédito.' },
  { termino: 'Exento / Excluido', definicion: 'Productos sin IVA (0 %). Exento: tarifa 0 % (Art. 477 E.T.). Excluido: no causa IVA (Art. 424 E.T.). La DIAN los trata distinto.' },
  { termino: 'Habilitación', definicion: 'Ambiente de pruebas de la DIAN. Los documentos de habilitación (prefijo SETP) no tienen validez fiscal.' },
  { termino: 'Kardex', definicion: 'Historial inalterable de todas las entradas y salidas de cada producto en cada bodega, con saldos y costos.' },
  { termino: 'Nota crédito', definicion: 'Documento electrónico que disminuye o anula el valor de una factura ya aceptada por la DIAN.' },
  { termino: 'Nota débito', definicion: 'Documento electrónico que aumenta el valor de una factura ya aceptada (intereses, gastos, ajustes).' },
  { termino: 'PUC', definicion: 'Plan Único de Cuentas: listado de cuentas contables de la empresa (Caja, Bancos, Inventarios, Ingresos…).' },
  { termino: 'Remisión', definicion: 'Documento que acompaña el despacho y la entrega de mercancía a un cliente.' },
  { termino: 'Rol', definicion: 'Conjunto de permisos que define qué módulos y acciones puede usar una persona y en qué sedes.' },
  { termino: 'SKU', definicion: 'Código interno único de cada producto (por ejemplo SM0007).' },
  { termino: 'Stock mínimo / crítico', definicion: 'Cantidades por debajo de las cuales el producto aparece con alerta de stock bajo (mínimo) o de nivel crítico.' },
  { termino: 'Transferencia', definicion: 'Traslado de mercancía de una bodega a otra, con salida, tránsito y recepción.' },
]
