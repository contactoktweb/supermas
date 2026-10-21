import { hrEmployeeRepository } from '../repositories/hr-employee.repository'
import {
  bankAccountSchema,
  employeeCreateSchema,
  employeePersonalSchema,
  employmentChangeSchema,
  rehireSchema,
  terminationSchema,
  type EmployeeCreateInput,
  type EmployeePersonalInput,
  type EmploymentChangeInput,
  type RehireInput,
  type TerminationInput,
} from '../schemas/hr.schema'
import type { Employee, EmployeeFilters, EmployeeListItem, EmploymentEvent, TerminationResult } from '../types'

/** Valida en el cliente con Zod; la base vuelve a validar con CHECK, triggers y RLS. */
export class HrEmployeeService {
  list(filters: EmployeeFilters, page: number): Promise<{ data: EmployeeListItem[]; total: number }> {
    return hrEmployeeRepository.list(filters, page)
  }

  getById(id: string): Promise<Employee | null> {
    return hrEmployeeRepository.getById(id)
  }

  create(input: EmployeeCreateInput): Promise<string> {
    return hrEmployeeRepository.create(employeeCreateSchema.parse(input))
  }

  updatePersonal(id: string, input: EmployeePersonalInput): Promise<void> {
    return hrEmployeeRepository.updatePersonal(id, employeePersonalSchema.parse(input))
  }

  changeEmployment(employee: Employee, input: EmploymentChangeInput): Promise<number> {
    return hrEmployeeRepository.changeEmployment(employee.id, employmentChangeSchema.parse(input), employee)
  }

  terminate(id: string, input: TerminationInput): Promise<TerminationResult> {
    return hrEmployeeRepository.terminate(id, terminationSchema.parse(input))
  }

  rehire(id: string, input: RehireInput): Promise<void> {
    return hrEmployeeRepository.rehire(id, rehireSchema.parse(input))
  }

  listEvents(employeeId: string): Promise<EmploymentEvent[]> {
    return hrEmployeeRepository.listEvents(employeeId)
  }

  getBankAccountNumber(employeeId: string): Promise<string | null> {
    return hrEmployeeRepository.getBankAccountNumber(employeeId)
  }

  saveBankAccountNumber(employeeId: string, accountNumber: string): Promise<void> {
    const { accountNumber: clean } = bankAccountSchema.parse({ accountNumber })
    return hrEmployeeRepository.saveBankAccountNumber(employeeId, clean)
  }

  refresh(employeeId?: string): Promise<void> {
    return hrEmployeeRepository.refresh(employeeId)
  }
}

export const hrEmployeeService = new HrEmployeeService()
