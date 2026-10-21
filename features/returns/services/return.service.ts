/**
 * SUPER MÁS ERP/POS - Servicio de Negocio de Devoluciones (ReturnService)
 */

import { z } from 'zod'
import { returnRepository, ReturnRepository } from '../repositories/return.repository'
import { customerReturnSchema, supplierReturnSchema, dispatchDamagedItemSchema } from '../schemas/return.schema'
import {
  ReturnRecord,
  ReturnFilterParams,
  ReturnStats,
  ProcessCustomerReturnInput,
  ProcessSupplierReturnInput,
  ReturnDispositionOptions,
  DamagedReturnFilters,
  DamagedReturnListResult,
  DispatchDamagedItemInput,
  DispatchDamagedItemResult,
} from '../types'

/** Valida con Zod y devuelve un mensaje legible (el primero) en vez del detalle técnico del error. */
function parseOrThrow<S extends z.ZodType>(schema: S, value: unknown): z.infer<S> {
  const result = schema.safeParse(value)
  if (!result.success) {
    throw new Error(result.error.issues[0]?.message || 'Datos de la devolución inválidos.')
  }
  return result.data
}

export class ReturnService {
  constructor(private repo: ReturnRepository = returnRepository) {}

  async list(filters: ReturnFilterParams = {}) {
    return this.repo.findAll(filters)
  }

  async getById(id: string): Promise<ReturnRecord> {
    const record = await this.repo.findById(id)
    if (!record) {
      throw new Error(`La devolución con ID o código "${id}" no existe.`)
    }
    return record
  }

  async getStats(): Promise<ReturnStats> {
    return this.repo.getStats()
  }

  async processCustomerReturn(input: ProcessCustomerReturnInput): Promise<ReturnRecord> {
    const validated = parseOrThrow(customerReturnSchema, input)
    return this.repo.processCustomerReturn(validated)
  }

  async processSupplierReturn(input: ProcessSupplierReturnInput): Promise<ReturnRecord> {
    const validated = supplierReturnSchema.parse(input)
    return this.repo.processSupplierReturn(validated)
  }

  async getDispositionOptions(saleId: string): Promise<ReturnDispositionOptions> {
    return this.repo.getDispositionOptions(saleId)
  }

  async listDamagedItems(filters: DamagedReturnFilters = {}): Promise<DamagedReturnListResult> {
    return this.repo.listDamagedItems(filters)
  }

  async dispatchDamagedItem(input: DispatchDamagedItemInput): Promise<DispatchDamagedItemResult> {
    const validated = parseOrThrow(dispatchDamagedItemSchema, input)
    return this.repo.dispatchDamagedItem(validated)
  }

  async getReturnableSales(): Promise<any[]> {
    return this.repo.getReturnableSales()
  }

  async getReturnablePurchases(): Promise<any[]> {
    return this.repo.getReturnablePurchases()
  }
}

export const returnService = new ReturnService()
