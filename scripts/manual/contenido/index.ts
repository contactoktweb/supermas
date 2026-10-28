import type { Capitulo } from '../tipos'
import { CANALES, CONTABILIDAD } from './canales-contabilidad'
import { CLIENTES } from './clientes'
import { COMPRAS } from './compras'
import { FLUJOS } from './flujos'
import { INVENTARIO } from './inventario'
import { PRIMEROS_PASOS } from './primeros-pasos'
import { ADMINISTRACION, GESTION, RRHH } from './rrhh-gestion-admin'
import { VENTAS } from './ventas'

/** Capítulos del manual en el orden del menú lateral, más los flujos completos al final. */
export const CAPITULOS: Capitulo[] = [
  PRIMEROS_PASOS,
  INVENTARIO,
  COMPRAS,
  CLIENTES,
  VENTAS,
  CANALES,
  CONTABILIDAD,
  RRHH,
  GESTION,
  ADMINISTRACION,
  FLUJOS,
]
