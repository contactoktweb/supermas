import { hrAbsenceRepository } from '../repositories/hr-absence.repository'
import {
  cancelReasonSchema,
  noveltyFormSchema,
  reviewSchema,
  vacationRequestSchema,
} from '../schemas/hr.schema'
import type {
  HrDashboardSummary,
  Novelty,
  NoveltyFilters,
  NoveltyType,
  VacationAlert,
  VacationPeriod,
  VacationRequest,
  VacationRequestStatus,
} from '../types'

export interface NoveltyInput {
  employeeId: string
  noveltyType: NoveltyType
  startDate: string
  endDate: string
  byHours: boolean
  hours: string
  description: string
  supportDocumentId: string
}

export interface VacationRequestInput {
  employeeId: string
  startDate: string
  endDate: string
  notes: string
}

export class HrAbsenceService {
  listNovelties(filters: NoveltyFilters): Promise<Novelty[]> {
    return hrAbsenceRepository.listNovelties(filters)
  }

  createNovelty(input: NoveltyInput): Promise<void> {
    return hrAbsenceRepository.createNovelty(noveltyFormSchema.parse(input))
  }

  reviewNovelty(id: string, approve: boolean, notes: string): Promise<void> {
    const parsed = reviewSchema(approve).parse({ notes })
    return hrAbsenceRepository.reviewNovelty(id, approve, parsed.notes)
  }

  cancelNovelty(id: string, reason: string): Promise<void> {
    return hrAbsenceRepository.cancelNovelty(id, cancelReasonSchema.parse({ reason }).reason)
  }

  listPeriods(employeeId: string, currentHireDate: string): Promise<VacationPeriod[]> {
    return hrAbsenceRepository.listPeriods(employeeId, currentHireDate)
  }

  listVacationRequests(options: {
    employeeId?: string
    status?: VacationRequestStatus | 'ALL'
    from?: string
    to?: string
  }): Promise<VacationRequest[]> {
    return hrAbsenceRepository.listVacationRequests(options)
  }

  createVacationRequest(input: VacationRequestInput): Promise<void> {
    return hrAbsenceRepository.createVacationRequest(vacationRequestSchema.parse(input))
  }

  reviewVacationRequest(id: string, approve: boolean, notes: string): Promise<void> {
    const parsed = reviewSchema(approve).parse({ notes })
    return hrAbsenceRepository.reviewVacationRequest(id, approve, parsed.notes)
  }

  cancelVacationRequest(id: string, reason: string): Promise<void> {
    return hrAbsenceRepository.cancelVacationRequest(id, cancelReasonSchema.parse({ reason }).reason)
  }

  listVacationAlerts(): Promise<VacationAlert[]> {
    return hrAbsenceRepository.listVacationAlerts()
  }

  countBusinessDays(startDate: string, endDate: string): Promise<number> {
    return hrAbsenceRepository.countBusinessDays(startDate, endDate)
  }

  getDashboardSummary(): Promise<HrDashboardSummary> {
    return hrAbsenceRepository.getDashboardSummary()
  }
}

export const hrAbsenceService = new HrAbsenceService()
