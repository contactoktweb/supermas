import { z } from 'zod'
import {
  cashSessionRepository,
  CashSessionRepository,
} from '../repositories/cash-session.repository'
import {
  CashRegister,
  CashSession,
  CashMovement,
  CashSessionSummary,
  OpenSessionPayload,
  RecordCashMovementPayload,
  CloseSessionPayload,
} from '../types'

export const OpenSessionSchema = z.object({
  cashRegisterId: z.string().uuid('ID de caja registradora inválido'),
  openingFloat: z.number().min(0, 'La base inicial debe ser mayor o igual a 0'),
  notes: z.string().optional(),
})

export const RecordCashMovementSchema = z.object({
  sessionId: z.string().uuid('ID de sesión de caja inválido'),
  type: z.enum(['CASH_IN', 'CASH_OUT']),
  amount: z.number().gt(0, 'El monto debe ser estrictamente mayor a 0'),
  reason: z.string().min(3, 'El motivo debe tener al menos 3 caracteres'),
})

export const CloseSessionSchema = z.object({
  sessionId: z.string().uuid('ID de sesión de caja inválido'),
  countedCashAmount: z.number().min(0, 'El monto contado no puede ser negativo'),
  supervisorNotes: z.string().optional(),
})

export const CreateCashRegisterSchema = z.object({
  locationId: z.string().uuid('ID de bodega inválido'),
  code: z.string().min(2, 'El código debe tener al menos 2 caracteres'),
  name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
})

export class CashSessionService {
  constructor(private repository: CashSessionRepository = cashSessionRepository) {}

  async getCashRegisters(locationId?: string): Promise<CashRegister[]> {
    return this.repository.getCashRegisters(locationId)
  }

  async createCashRegister(input: z.infer<typeof CreateCashRegisterSchema>): Promise<CashRegister> {
    const validated = CreateCashRegisterSchema.parse(input)
    return this.repository.createCashRegister(validated)
  }

  async getActiveSession(registerId?: string, locationId?: string): Promise<CashSession | null> {
    return this.repository.getActiveSession(registerId, locationId)
  }

  async openSession(input: OpenSessionPayload): Promise<any> {
    const validated = OpenSessionSchema.parse(input)
    return this.repository.openSession(validated)
  }

  async recordMovement(input: RecordCashMovementPayload): Promise<any> {
    const validated = RecordCashMovementSchema.parse(input)
    return this.repository.recordMovement(validated)
  }

  async getSessionSummary(sessionId: string): Promise<CashSessionSummary> {
    if (!sessionId || sessionId.length !== 36) {
      throw new Error('ID de sesión de caja inválido.')
    }
    return this.repository.getSessionSummary(sessionId)
  }

  async closeSession(input: CloseSessionPayload): Promise<any> {
    const validated = CloseSessionSchema.parse(input)
    return this.repository.closeSession(validated)
  }

  async getMovements(sessionId: string): Promise<CashMovement[]> {
    if (!sessionId || sessionId.length !== 36) {
      throw new Error('ID de sesión de caja inválido.')
    }
    return this.repository.getMovements(sessionId)
  }

  async getSessions(filters?: {
    locationId?: string
    status?: string
    startDate?: string
    endDate?: string
  }): Promise<CashSession[]> {
    return this.repository.getSessions(filters)
  }
}

export const cashSessionService = new CashSessionService()
