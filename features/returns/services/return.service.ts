/**
 * SUPER MÁS ERP/POS - Servicio de Negocio de Devoluciones (ReturnService)
 */

import { returnRepository, ReturnRepository } from '../repositories/return.repository'
import { customerReturnSchema, supplierReturnSchema } from '../schemas/return.schema'
import {
  ReturnRecord,
  ReturnFilterParams,
  ReturnStats,
  ProcessCustomerReturnInput,
  ProcessSupplierReturnInput,
} from '../types'

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
    const validated = customerReturnSchema.parse(input)
    return this.repo.processCustomerReturn(validated)
  }

  async processSupplierReturn(input: ProcessSupplierReturnInput): Promise<ReturnRecord> {
    const validated = supplierReturnSchema.parse(input)
    return this.repo.processSupplierReturn(validated)
  }

  async getReturnableSales(): Promise<any[]> {
    return this.repo.getReturnableSales()
  }

  async getReturnablePurchases(): Promise<any[]> {
    return this.repo.getReturnablePurchases()
  }
}

export const returnService = new ReturnService()
